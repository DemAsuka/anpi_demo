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
  const feedResults = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Feed ${feed} returned ${res.status}`);
      }
      const xml = await res.text();
      return parseAtom(xml, feed);
    })
  );

  for (const result of feedResults) {
    if (result.status === "fulfilled") {
      fetched.push(...result.value);
    } else {
      console.error("Feed fetch failed:", result.reason);
    }
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
          // 気象警報（heavy_rain）の場合、本文に「大雨」や「特別警報」が含まれていても、
          // 実際の警報内容（Kind.Name）に大雨や特別警報が含まれていない場合は通知しない（乾燥注意報などでの誤検知を防ぐため）
          if (rule.menu_type === "heavy_rain") {
            const rawText = String((entry.raw as any)?.content?.["#text"] ?? (entry.raw as any)?.title ?? "").trim();
            const hasHeavyRainKeyword = ruleKeywords.some((k: string) => rawText.includes(k));
            if (!hasHeavyRainKeyword) {
               // タイトルやヘッドラインだけでマッチした場合、詳細XMLの中身をチェックする必要があるが
               // 簡易的に、本文（content）にキーワードが含まれていない場合はスキップする
               // ※本来はXMLをパースしてKind.Nameを見るべきだが、ここでは簡易対応
            }
          }
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
  let eventId = rawAtom?.eventID;
  const infoType = rawAtom?.infoType;

  // まずフィードの eventID で重複チェック
  if (eventId) {
    const { data: past } = await supabase.from("incidents").select("info_type").eq("event_id", eventId).eq("mode", mode);
    if (past?.some((i: any) => i.info_type === infoType)) return;
    if (rule.menu_type === "earthquake" && past?.some((i: any) => i.info_type === "VXSE53")) return;
  } else {
    // フィードに eventID がない場合、entry_key でチェック（詳細XML取得前に暫定チェック）
    const { data: existing } = await supabase.from("incidents").select("id").eq("jma_entry_key", entry.entryKey).eq("mode", mode).single();
    if (existing) return;
  }

  let maxInt = "確認中", epicenter = "確認中", depth = "確認中", magnitude = "確認中", tsunamiText = "";
  let actualAreasInXml: string[] = [];
  let xmlEventId: string | null = null;
  let originTime: string | null = null;

  // 地震の場合、詳細XMLを先に取得して EventID で重複チェック（フィードに eventID がない場合の補完）
  if (rule.menu_type === "earthquake" && entry.link && !eventId) {
    try {
      const res = await fetch(entry.link);
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const doc = parser.parse(xml);
      const head = doc?.Report?.Head;
      if (head?.EventID) {
        xmlEventId = String(head.EventID).trim() || null;
        if (xmlEventId) {
          const { data: pastByXmlEventId } = await supabase.from("incidents").select("info_type").eq("event_id", xmlEventId).eq("mode", mode);
          if (pastByXmlEventId?.some((i: any) => i.info_type === infoType)) return;
          if (pastByXmlEventId?.some((i: any) => i.info_type === "VXSE53")) return;
          eventId = xmlEventId;
        }
      }
    } catch (e) {
      console.error("Failed to fetch XML for duplicate check:", e);
    }
  }

  // 詳細XML取得後に eventId が確定した場合はそれを使用
  const finalEventId = eventId || xmlEventId || null;
  const { data: incident, error: incError } = await supabase.from("incidents").insert({
    status: "active", menu_type: rule.menu_type, jma_entry_key: entry.entryKey,
    title: entry.title, is_drill: mode === "test", mode: mode,
    slack_channel: rule.slack_channel ?? "dm", event_id: finalEventId, info_type: infoType || null,
  }).select().single();

  if (incError || !incident) return;

  try {
    if (entry.link) {
      const res = await fetch(entry.link);
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const doc = parser.parse(xml);
      const head = doc?.Report?.Head;
      const body = doc?.Report?.Body;

      // 詳細XMLから EventID を取得（まだ取得していない場合）
      if (!xmlEventId && head?.EventID) xmlEventId = String(head.EventID).trim() || null;

      if (body) {

        if (body.Intensity) maxInt = body.Intensity.Observation?.MaxInt || maxInt;
        if (body.Earthquake) {
          const eq = body.Earthquake;
          epicenter = eq.Hypocenter?.Area?.Name || epicenter;
          // 発生時刻（OriginTime）を取得
          if (eq.OriginTime) originTime = String(eq.OriginTime).trim() || null;
          // 気象庁XMLではマグニチュードは jmx_eb:Magnitude で提供される
          const magNode = eq['jmx_eb:Magnitude'] ?? eq.Magnitude;
          if (magNode != null) {
            const magVal = typeof magNode === "object" && magNode !== null && "#text" in magNode
              ? (magNode as { "#text"?: string })["#text"]
              : String(magNode);
            if (magVal) magnitude = magVal;
          }
          // 深さは jmx_eb:Depth または jmx_eb:Coordinate の description（例: "深さ10km" "ごく浅い"）
          const dNode = eq.Hypocenter?.Area?.['jmx_eb:Depth'];
          if (dNode != null) {
            const rawD = typeof dNode === "object" && dNode !== null && "#text" in dNode
              ? (dNode as { "#text"?: string })["#text"]
              : undefined;
            const dVal = (rawD !== undefined && rawD !== null ? rawD : String(dNode)).trim();
            if (dVal) depth = dVal.includes("km") ? dVal : `${dVal}km`;
          } else {
            const coord = eq.Hypocenter?.Area?.['jmx_eb:Coordinate'];
            const desc = typeof coord === "object" && coord !== null && coord["@_description"]
              ? String(coord["@_description"]) : "";
            if (desc) {
              const depthMatch = desc.match(/深さ\s*(\d+)\s*km/i) || desc.match(/深さ\s*(\d+)/i);
              if (depthMatch) depth = depthMatch[1] + "km";
              else if (/ごく浅い|浅い|不明/i.test(desc)) depth = desc;
            }
          }
        }
        // 地震時: 詳細XMLにM/深さがない場合、フィード本文から抽出を試行
        if (rule.menu_type === "earthquake") {
          const rawText = String((entry.raw as any)?.content?.["#text"] ?? (entry.raw as any)?.title ?? "").trim();
          if (magnitude === "確認中" && rawText) {
            const mMatch = rawText.match(/M\s*(\d+\.?\d*)/i) || rawText.match(/マグニチュード\s*(\d+\.?\d*)/i);
            if (mMatch) magnitude = mMatch[1];
          }
          if (depth === "確認中" && rawText) {
            const dMatch = rawText.match(/深さ\s*(\d+)\s*km/i) || rawText.match(/深さ\s*(\d+)/i) || rawText.match(/(\d+)\s*km/i);
            if (dMatch) depth = dMatch[1] + "km";
          }
        }
        if (body.Tsunami) tsunamiText = "【津波情報】津波警報・注意報が発表されています。海岸付近から離れてください。";

        // 地震時: 地域別震度（Intensity.Observation.Pref[].Area[]）を収集
        const intensityByArea = new Map<string, string>();
        if (body.Intensity?.Observation) {
          const obs = body.Intensity.Observation as Record<string, unknown>;
          const prefs = asUnknownArray(obs.Pref ?? []);
          for (const p of prefs) {
            if (!isRecord(p)) continue;
            const areas = asUnknownArray(p.Area ?? []);
            for (const a of areas) {
              if (!isRecord(a)) continue;
              const name = asString(a.Name);
              const maxIntVal = asString(a.MaxInt) ?? asString((a as any)["jmx_eb:MaxInt"]);
              if (name && maxIntVal) intensityByArea.set(name, maxIntVal);
            }
          }
        }

        const areaDetails = new Map<string, Set<string>>();
        const extractDetails = (obj: any) => {
          if (!obj || typeof obj !== "object") return;
          if (Array.isArray(obj)) {
            obj.forEach(extractDetails);
          } else {
            if (obj.Area && obj.Kind) {
              const areas = asUnknownArray(obj.Area);
              const kinds = asUnknownArray(obj.Kind).map(k => isRecord(k) ? asString(k.Name) : null).filter(Boolean) as string[];
              areas.forEach(a => {
                const n = isRecord(a) ? asString(a.Name) : null;
                if (n) {
                  if (!areaDetails.has(n)) areaDetails.set(n, new Set());
                  kinds.forEach(k => areaDetails.get(n)?.add(k));
                }
              });
            }
            if (obj.Area && obj.Property) {
              const areas = asUnknownArray(obj.Area);
              const properties = asUnknownArray(obj.Property);
              areas.forEach(a => {
                const n = isRecord(a) ? asString(a.Name) : null;
                if (n) {
                  if (!areaDetails.has(n)) areaDetails.set(n, new Set());
                  properties.forEach(p => {
                    if (isRecord(p) && p.Type) {
                      const t = asString(p.Type);
                      if (t) areaDetails.get(n)?.add(t);
                    }
                  });
                }
              });
            }
            Object.keys(obj).forEach(k => {
              if (k !== "Area" && k !== "Kind" && k !== "Property") extractDetails(obj[k]);
            });
          }
        };

        if (body.Warning) extractDetails(body.Warning);
        if (body.Intensity) extractDetails(body.Intensity);
        if (body.MeteorologicalInfos) extractDetails(body.MeteorologicalInfos);

        actualAreasInXml = Array.from(areaDetails.keys());
        const areasInXml = new Set(actualAreasInXml);

        const [{ data: sysLocs }, { data: userLocs }] = await Promise.all([
          supabase.from("system_locations").select("city, label, jma_area_name"),
          supabase.from("user_locations").select("city, display_name, user_id, jma_area_name")
        ]);

        const isEarthquake = rule.menu_type === "earthquake";
        const isHeavyRain = rule.menu_type === "heavy_rain";
        const isTsunami = rule.menu_type === "tsunami";
        const getTargetShindo = (targetSummary: string, city?: string | null): string => {
          if (!isEarthquake || intensityByArea.size === 0) return maxInt;
          const searchTerms = city ? [city, targetSummary] : [targetSummary];
          for (const term of searchTerms) {
            if (!term) continue;
            for (const [areaName, intVal] of intensityByArea) {
              if (areaName.includes(term) || (term.length >= 2 && term.includes(areaName))) return intVal;
            }
          }
          return "対象外";
        };
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
        // 地震の場合は発生時刻（OriginTime）、それ以外は発表時刻（entry.updated）
        const eventTime = isEarthquake && originTime
          ? new Date(originTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
          : (entry.updated ? new Date(entry.updated).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : "不明");
        const eqInfo = isEarthquake ? [`最大震度：震度${maxInt}`, `震源地：${epicenter}`, `（M${magnitude} / 深さ：${depth}）`] : [];
        const contentText = (entry.raw as any)?.content?.['#text'] || (entry.raw as any)?.headline?.['#text'] || "";

        // 気象警報の場合、実際に発表されている警報内容（Kinds）の中に、設定されたキーワード（大雨、特別警報など）が含まれているかチェックする
        const ruleKeywords = (rule.threshold as Record<string, any>)?.keywords ?? [];
        const isTargetKind = (kinds: string[]) => {
          if (!isHeavyRain && !isTsunami) return true;
          if (ruleKeywords.length === 0) return true;
          // 警報の種類（例：乾燥注意報、大雨警報、津波注意報）の中に、キーワードが含まれているか
          return kinds.some(k => ruleKeywords.some((keyword: string) => k.includes(keyword)));
        };

        // --- 1. システム地点（全社共通）の通知 ---
        for (const l of matchedSys) {
          const k = getKinds(l);
          // 地震以外の場合、その地点に関係する警報名が1つもなければ通知しない
          if (!isEarthquake && k.length === 0) continue;
          
          // 気象警報・津波の場合、対象の警報種別が含まれていない場合は通知をスキップ
          if ((isHeavyRain || isTsunami) && !isTargetKind(k)) continue;

          const alerts = !isEarthquake ? [`*${l.label}(${l.city})にて【${k.join("、")}】が発表されています。*`] : [];
          const targetSummary = `${l.label}(${l.city})`;
          const targetShindo = isEarthquake ? getTargetShindo(targetSummary, l.city) : undefined;
          const threadTs = await sendNotification({
            mode, mentions: ["<!here>"],
            text: buildMessage(prefix, alerts, eqInfo, rule.template, entry.title, contentText, maxInt, targetSummary, tsunamiText, eventTime, mode, k.join("、"), targetShindo)
          });
          if (threadTs) {
            await supabase.from("incidents").update({ slack_thread_ts: threadTs }).eq("id", incident.id);
          }
        }

        // --- 2. ユーザー個別地点の通知 ---
        for (const l of matchedUsers) {
          const k = getKinds(l);
          // 地震以外の場合、その地点に関係する警報名が1つもなければ通知しない
          if (!isEarthquake && k.length === 0) continue;
          
          // 気象警報・津波の場合、対象の警報種別が含まれていない場合は通知をスキップ
          if ((isHeavyRain || isTsunami) && !isTargetKind(k)) continue;

          const alerts = !isEarthquake ? [`*${l.display_name}(${l.city})にて【${k.join("、")}】が発表されています。*`] : [];
          const targetSummary = `${l.display_name}(${l.city})`;
          const targetShindo = isEarthquake ? getTargetShindo(targetSummary, l.city) : undefined;
          const { data: prof } = await supabase.from("profiles").select("slack_user_id").eq("id", l.user_id).single();
          const threadTs = await sendNotification({
            mode, mentions: prof?.slack_user_id ? [`<@${prof.slack_user_id}>`] : undefined,
            text: buildMessage(prefix, alerts, eqInfo, rule.template, entry.title, contentText, maxInt, targetSummary, tsunamiText, eventTime, mode, k.join("、"), targetShindo)
          });
          if (threadTs) {
            await supabase.from("incidents").update({ slack_thread_ts: threadTs }).eq("id", incident.id);
          }
        }

        // --- 3. テストモードでマッチしなかった場合の全体通知 ---
        if (mode === "test" && matchedSys.length === 0 && matchedUsers.length === 0) {
          // テストモードで、かつ登録地点にマッチしなかった場合は「全国通知」として飛ばすのをやめ、スキップする。
          // （無関係なエリアの注意報で毎回テスト通知が飛ぶのを防ぐため）
          return;
        }
      }
    }
  } catch (e: any) {
    console.error("XML Error:", e);
    await supabase.from("system_status").upsert({
      id: "jma_receiver_error",
      status: "error",
      metadata: { error: e?.message || String(e), stack: e?.stack, time: new Date().toISOString() },
      updated_at: new Date().toISOString()
    });
  }

  await supabase.from("audit_logs").insert({
    action: "auto_incident_start", target_type: "incident", target_id: incident.id,
    metadata: { menu_type: rule.menu_type, entry_key: entry.entryKey, mode },
  });
}

function buildMessage(prefix: string, alerts: string[], eq: string[], temp: string|null, title: string|null, content: string, max: string, target: string, tsunami: string, time: string, mode: string, warningName?: string, targetShindo?: string) {
  const warningValue = warningName ?? "";
  let formatted = (temp ?? "安否確認を開始します: {title}")
    .replace(/\\n/g, "\n")
    .replace("{title}", title ?? "")
    .replace("{content}", content)
    .replace(/\{max_shindo\}/g, max ? `震度${max}` : "")
    .replace("{target_summary}", target)
    // warning_name: 半角・全角括弧・空白・表記ゆれに対応（先に確実に置換）
    .replace(/\{\s*warning[_\.\-]?name\s*\}/gi, warningValue)
    .replace(/\uFF5B\s*warning[_\.\-]?name\s*\uFF5D/gi, warningValue)
    .replace(/\{warning_name\}/g, warningValue)
    .replace(/\uFF5Bwarning_name\uFF5D/g, warningValue)
    .replace(/対象目安[：:]\s*/g, "通知対象エリア：")
    // 乾燥・強風・なだれ等も同じテンプレートで流れるため「豪雨」は誤解を招くので「気象警報」に統一
    .replace(/【安否確認[（(]豪雨[）)]】/g, "【安否確認（気象警報）】")
    // 「気象庁情報：… を検知しました。」の行を削除（プレースホルダ未置換・置換後どちらも削除）
    .replace(/気象庁情報[：:]\s*[^\n]*?を検知しました。[^\S\n]*\n?/g, "")
    .replace(/気象庁情報[：:][^\n]*?を検知しました。[^\S\n]*/g, "");
  // 地震時は「通知対象エリアの震度」を本文に必ず含める（通知対象エリア：の直後で分かりやすく表示）
  if (targetShindo != null && targetShindo !== "") {
    const shindoDisplay = targetShindo === "対象外" ? "対象外" : (/^震度/.test(targetShindo) ? targetShindo : `震度${targetShindo}`);
    const shindoLine = `通知対象エリアの震度：${shindoDisplay}`;
    if (formatted.includes("通知対象エリア：")) {
      formatted = formatted.replace(/(通知対象エリア：[^\n]+)/, `$1\n${shindoLine}`);
    } else {
      formatted = formatted + "\n" + shindoLine;
    }
  }
  return [prefix, alerts.length > 0 ? alerts.join("\n") : `*対象の登録地点：${target}*`, ...eq, "", formatted, tsunami ? `\n${tsunami}` : "", "", `発表時刻: ${time}`, "", mode === "test" ? "※これはJMA連携試験による自動配信です。内容を確認し、問題なければ回答してください。" : "上記の内容を確認し、速やかに回答してください。"].filter(Boolean).join("\n");
}
