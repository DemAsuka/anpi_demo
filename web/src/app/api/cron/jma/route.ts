import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

const FEEDS = [
  "https://www.data.jma.go.jp/developer/xml/feed/regular.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/extra.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/other.xml",
] as const;

type AtomEntry = {
  entryKey: string;
  title: string | null;
  updated: string | null;
  link: string | null;
  contentHash: string;
  sourceFeed: string;
  raw: unknown;
};

type UnknownRecord = Record<string, unknown>;
function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function asUnknownArray(v: unknown): unknown[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseAtom(xml: string, sourceFeed: string): AtomEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(xml) as unknown;
  const feed = isRecord(doc) ? doc.feed : undefined;
  const entries = isRecord(feed) ? asUnknownArray(feed.entry) : [];

  return entries
    .map((e) => {
      if (!isRecord(e)) return null;

      const id = asString(e.id);
      const linkNode = e.link;

      let linkHref: string | null = null;
      if (Array.isArray(linkNode) && linkNode.length) {
        const first = linkNode[0];
        if (isRecord(first)) linkHref = asString(first["@_href"]);
      } else if (isRecord(linkNode)) {
        linkHref = asString(linkNode["@_href"]);
      }

      const entryKey = id || linkHref;
      if (!entryKey) return null;

      const title = asString(e.title);
      const updated = asString(e.updated);
      const link = (linkHref ?? null) as string | null;
      const contentHash = sha256Hex(`${title ?? ""}|${updated ?? ""}|${link ?? ""}`);

      return {
        entryKey,
        title,
        updated,
        link,
        contentHash,
        sourceFeed,
        raw: e,
      } satisfies AtomEntry;
    })
    .filter(Boolean) as AtomEntry[];
}

export async function GET(request: NextRequest) {
  const token =
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const userAgent = request.headers.get("user-agent");
  const isVercelCron = vercelCronHeader === "1" || userAgent?.startsWith("vercel-cron/");
  
  const supabase = createSupabaseServiceRoleClient();
  const isAuthorized = token === env.CRON_SECRET() || isVercelCron;

  await supabase.from("system_status").upsert({
    id: "jma_receiver",
    status: isAuthorized ? "ok" : "error",
    metadata: {
      last_request_at: new Date().toISOString(),
      auth_result: isAuthorized ? "success" : "failed",
      evidence: {
        has_valid_token: token === env.CRON_SECRET(),
        received_token_preview: token ? (token.substring(0, 4) + "...") : "empty",
        vercel_cron_header: vercelCronHeader,
        is_vercel_cron: isVercelCron,
        user_agent_preview: userAgent ? (userAgent.substring(0, 20) + "...") : "empty"
      },
      status_detail: isAuthorized ? "processing" : "blocked_by_auth"
    },
    updated_at: new Date().toISOString()
  });

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const fetched: AtomEntry[] = [];
  for (const feed of FEEDS) {
    const res = await fetch(feed, { cache: "no-store" });
    if (!res.ok) continue;
    const xml = await res.text();
    fetched.push(...parseAtom(xml, feed));
  }

  if (!fetched.length) {
    return NextResponse.json({ ok: true, fetched: 0, changed: 0 });
  }

  const existing = new Map<string, string>();
  const keys = Array.from(new Set(fetched.map((e) => e.entryKey)));
  const chunkSize = 100;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("jma_entries")
      .select("entry_key, content_hash")
      .in("entry_key", chunk);
    if (error) continue;
    for (const row of data ?? []) {
      existing.set(row.entry_key, row.content_hash);
    }
  }

  const changed = fetched.filter((e) => existing.get(e.entryKey) !== e.contentHash);

  const { data: rules } = await supabase.from("activation_menus").select("*");

  const sortedChanged = [...changed].sort((a, b) => {
    const isEqA = a.sourceFeed.includes("eqvol.xml");
    const isEqB = b.sourceFeed.includes("eqvol.xml");
    if (isEqA && !isEqB) return -1;
    if (!isEqA && isEqB) return 1;
    const ta = a.updated ? new Date(a.updated).getTime() : 0;
    const tb = b.updated ? new Date(b.updated).getTime() : 0;
    return tb - ta;
  });

  const entriesToProcess = sortedChanged.slice(0, 20);

  const { data: prevStatus } = await supabase
    .from("system_status")
    .select("*")
    .eq("id", "jma_receiver")
    .single();

  if (prevStatus && prevStatus.status !== "ok") {
    await sendNotification({
      text: `【システム復旧】気象データ受信が正常に再開されました。\n前回の成功: ${new Date(prevStatus.last_success_at).toLocaleString('ja-JP')}`,
      mode: "production",
    });
  }

  await supabase.from("system_status").upsert({
    id: "jma_receiver",
    last_success_at: new Date().toISOString(),
    status: "ok",
    updated_at: new Date().toISOString()
  });

  if (changed.length) {
    const saveSize = 50;
    for (let i = 0; i < changed.length; i += saveSize) {
      const chunk = changed.slice(i, i + saveSize);
      await supabase.from("jma_entries").upsert(
        chunk.map((e) => ({
          entry_key: e.entryKey,
          source_feed: e.sourceFeed,
          title: e.title,
          updated_at: e.updated ? new Date(e.updated).toISOString() : null,
          link: e.link,
          content_hash: e.contentHash,
          raw_atom: e.raw,
        })),
        { onConflict: "entry_key" },
      );
    }

    for (const entry of entriesToProcess) {
      const raw = entry.raw as any;
      const contentText = raw?.content?.['#text'] || raw?.headline?.['#text'] || "";
      const searchTarget = `${entry.title ?? ""} ${contentText}`;

      for (const rule of rules ?? []) {
        const ruleKeywords = (rule.threshold as Record<string, any>)?.keywords ?? [];
        const testKeywords = (rule.test_threshold as Record<string, any>)?.keywords ?? [];
        if (!rule.enabled && !rule.test_enabled) continue;

        const isProdMatch = rule.enabled && ruleKeywords.length > 0 && ruleKeywords.some((k: string) => searchTarget.includes(k));
        if (isProdMatch) {
          await createIncidentAndNotify(supabase, entry, rule, "production");
          continue;
        }

        const isTestMatch = rule.test_enabled && testKeywords.length > 0 && testKeywords.some((k: string) => searchTarget.includes(k));
        if (isTestMatch) {
          await createIncidentAndNotify(supabase, entry, rule, "test");
        }
      }
    }
  }

  await supabase.rpc("cleanup_old_jma_entries");
  return NextResponse.json({ ok: true, fetched: fetched.length, changed: changed.length });
}

async function createIncidentAndNotify(
  supabase: any,
  entry: AtomEntry,
  rule: any,
  mode: "production" | "test"
) {
  const rawAtom = entry.raw as any;
  const eventId = rawAtom?.eventID;
  const infoType = rawAtom?.infoType;

  if (eventId) {
    const { data: past } = await supabase.from("incidents").select("info_type").eq("event_id", eventId).eq("mode", mode);
    if (past?.some((i: any) => i.info_type === infoType)) return;
    if (rule.menu_type === "earthquake" && past?.some((i: any) => i.info_type === "VXSE53")) return;
  } else {
    const { data: existing } = await supabase.from("incidents").select("id").eq("jma_entry_key", entry.entryKey).eq("mode", mode).single();
    if (existing) return;
  }

  const { data: incident, error: incError } = await supabase.from("incidents").insert({
    status: "active", menu_type: rule.menu_type, jma_entry_key: entry.entryKey,
    title: entry.title, is_drill: mode === "test", mode: mode,
    slack_channel: rule.slack_channel ?? "dm", event_id: eventId || null, info_type: infoType || null,
  }).select().single();

  if (incError || !incident) return;

  let maxInt = "確認中", epicenter = "確認中", depth = "確認中", magnitude = "確認中", tsunamiText = "";
  let actualAreasInXml: string[] = [];

  try {
    if (entry.link) {
      const res = await fetch(entry.link);
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const doc = parser.parse(xml);
      const body = doc?.Report?.Body;

      if (body) {
        if (body.Intensity) maxInt = body.Intensity.Observation?.MaxInt || maxInt;
        if (body.Earthquake) {
          const eq = body.Earthquake;
          epicenter = eq.Hypocenter?.Area?.Name || epicenter;
          magnitude = eq.Magnitude || magnitude;
          const dNode = eq.Hypocenter?.Area?.['jmx_eb:Depth'];
          if (dNode) depth = (dNode['#text'] || dNode).toString().replace('km','') + 'km';
        }
        if (body.Tsunami) tsunamiText = "【津波情報】津波警報・注意報が発表されています。海岸付近から離れてください。";

        const extractAreaDetails = (obj: any): Map<string, Set<string>> => {
          const areaMap = new Map<string, Set<string>>();
          if (!obj || typeof obj !== "object") return areaMap;
          if (Array.isArray(obj)) {
            obj.forEach(item => {
              extractAreaDetails(item).forEach((v, k) => {
                if (!areaMap.has(k)) areaMap.set(k, new Set());
                v.forEach(ki => areaMap.get(k)?.add(ki));
              });
            });
          } else {
            if (obj.Area && obj.Kind) {
              const areas = asUnknownArray(obj.Area);
              const kinds = asUnknownArray(obj.Kind).map(k => isRecord(k) ? asString(k.Name) : null).filter(Boolean) as string[];
              areas.forEach(a => {
                if (isRecord(a) && a.Name) {
                  const n = asString(a.Name);
                  if (n) {
                    if (!areaMap.has(n)) areaMap.set(n, new Set());
                    kinds.forEach(k => areaMap.get(n)?.add(k));
                  }
                }
              });
            }
            Object.keys(obj).forEach(key => {
              if (key !== "Area" && key !== "Kind") {
                extractAreaDetails(obj[key]).forEach((v, k) => {
                  if (!areaMap.has(k)) areaMap.set(k, new Set());
                  v.forEach(ki => areaMap.get(k)?.add(ki));
                });
              }
            });
          }
          return areaMap;
        };

        const areaDetails = new Map<string, Set<string>>();
        const merge = (m: Map<string, Set<string>>) => m.forEach((v, k) => {
          if (!areaDetails.has(k)) areaDetails.set(k, new Set());
          v.forEach(ki => areaDetails.get(k)?.add(ki));
        });
        if (body.Warning) merge(extractAreaDetails(body.Warning));
        if (body.Intensity) merge(extractAreaDetails(body.Intensity));
        if (body.MeteorologicalInfos) merge(extractAreaDetails(body.MeteorologicalInfos));

        actualAreasInXml = Array.from(areaDetails.keys());
        const areasInXml = new Set(actualAreasInXml);

        const [{ data: sysLocs }, { data: userLocs }] = await Promise.all([
          supabase.from("system_locations").select("city, label, jma_area_name"),
          supabase.from("user_locations").select("city, display_name, user_id, jma_area_name")
        ]);

        const isEarthquake = rule.menu_type === "earthquake";
        const getKinds = (l: any) => {
          const kinds = new Set<string>();
          areaDetails.forEach((v, k) => {
            if (k.includes(l.city) || l.city.includes(k) || k === l.jma_area_name) v.forEach(ki => kinds.add(ki));
          });
          return Array.from(kinds);
        };

        const matchedSys = (sysLocs || []).filter((l: any) => {
          if (!l.city) return false;
          const cityMatch = Array.from(areasInXml).some(xmlArea => xmlArea.includes(l.city) || l.city.includes(xmlArea));
          return isEarthquake ? cityMatch : (cityMatch || (l.jma_area_name && areasInXml.has(l.jma_area_name)));
        });

        const matchedUsers = (userLocs || []).filter((l: any) => {
          if (!l.city) return false;
          const cityMatch = Array.from(areasInXml).some(xmlArea => xmlArea.includes(l.city) || l.city.includes(xmlArea));
          return isEarthquake ? cityMatch : (cityMatch || (l.jma_area_name && areasInXml.has(l.jma_area_name)));
        });

        const prefix = mode === "test" ? `【訓練：${rule.menu_type.toUpperCase()}】` : "";
        const eventTime = entry.updated ? new Date(entry.updated).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : "不明";
        const eqInfo = isEarthquake ? [`最大震度：震度${maxInt}`, `震源地：${epicenter}`, `（M${magnitude} / 深さ：${depth}）`] : [];
        const contentText = (entry.raw as any)?.content?.['#text'] || (entry.raw as any)?.headline?.['#text'] || "";

        if (matchedSys.length > 0) {
          const targetSummary = matchedSys.map((l: any) => `${l.label}(${l.city})`).join("、");
          const alerts = !isEarthquake ? matchedSys.map((l: any) => {
            const k = getKinds(l);
            return `*${l.label}(${l.city})にて${k.length > 0 ? `【${k.join("、")}】` : entry.title}が発表されています。*`;
          }) : [];
          await sendNotification({
            mode, mentions: ["<!here>"],
            text: buildMessage(prefix, alerts, eqInfo, rule.template, entry.title, contentText, maxInt, targetSummary, tsunamiText, eventTime, mode)
          });
        }

        const userGroups = new Map<string, any[]>();
        matchedUsers.forEach((l: any) => {
          if (!userGroups.has(l.user_id)) userGroups.set(l.user_id, []);
          userGroups.get(l.user_id)?.push(l);
        });

        for (const [uid, locs] of Array.from(userGroups.entries())) {
          const targetSummary = locs.map((l: any) => `${l.display_name}(${l.city})`).join("、");
          const alerts = !isEarthquake ? locs.map((l: any) => {
            const k = getKinds(l);
            return `*${l.display_name}(${l.city})にて${k.length > 0 ? `【${k.join("、")}】` : entry.title}が発表されています。*`;
          }) : [];
          const { data: prof } = await supabase.from("profiles").select("slack_user_id").eq("id", uid).single();
          await sendNotification({
            mode, mentions: prof?.slack_user_id ? [`<@${prof.slack_user_id}>`] : undefined,
            text: buildMessage(prefix, alerts, eqInfo, rule.template, entry.title, contentText, maxInt, targetSummary, tsunamiText, eventTime, mode)
          });
        }

        if (mode === "test" && matchedSys.length === 0 && userGroups.size === 0) {
          const targetSummary = actualAreasInXml.length > 0 ? actualAreasInXml.slice(0, 5).join("、") + (actualAreasInXml.length > 5 ? `ほか${actualAreasInXml.length - 5}地点` : "") : "デモ用全国通知（試験環境）";
          const alerts = !isEarthquake ? [`*${targetSummary}にて${entry.title}が発表されています。*`] : [];
          await sendNotification({
            mode, text: buildMessage(prefix, alerts, eqInfo, rule.template, entry.title, contentText, maxInt, targetSummary, tsunamiText, eventTime, mode)
          });
        }
      }
    }
  } catch (e) { console.error("XML Error:", e); }

  await supabase.from("audit_logs").insert({
    action: "auto_incident_start", target_type: "incident", target_id: incident.id,
    metadata: { menu_type: rule.menu_type, entry_key: entry.entryKey, mode },
  });
}

function buildMessage(prefix: string, alerts: string[], eq: string[], temp: string|null, title: string|null, content: string, max: string, target: string, tsunami: string, time: string, mode: string) {
  const formatted = (temp ?? "安否確認を開始します: {title}").replace(/\\n/g, "\n").replace("{title}", title ?? "").replace("{content}", content).replace("{max_shindo}", `震度${max}`).replace("{target_summary}", target).replace(/対象目安[：:]\s*/g, "通知対象エリア：");
  return [prefix, alerts.length > 0 ? alerts.join("\n") : `*対象の登録地点：${target}*`, ...eq, "", formatted, tsunami ? `\n${tsunami}` : "", "", `発表時刻: ${time}`, "", mode === "test" ? "※これはJMA連携試験による自動配信です。内容を確認し、問題なければ回答してください。" : "上記の内容を確認し、速やかに回答してください。"].filter(Boolean).join("\n");
}
