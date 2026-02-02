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

async function postSlackSummary(entries: AtomEntry[]) {
  if (!entries.length) return;

  const top = entries.slice(0, 5);
  const lines = top.map((e) => `- ${e.title ?? "(no title)"} (${e.updated ?? "n/a"})`);

  await sendNotification({
    text: [
      `【安否確認ツール】JMAフィード更新: ${entries.length}件`,
      ...lines,
      entries.length > top.length ? `…他 ${entries.length - top.length}件` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function GET(request: NextRequest) {
  // --- セキュリティ再構築：ステップ1（詳細な証拠の記録） ---
  const token =
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const userAgent = request.headers.get("user-agent");
  // 精密な分析結果に基づき、User-Agentも判定に含める
  const isVercelCron = vercelCronHeader === "1" || userAgent?.startsWith("vercel-cron/");
  
  const supabase = createSupabaseServiceRoleClient();

  // 判定ロジック：
  // 1. 正しいトークンがある
  // 2. または、Vercel Cronの証拠（ヘッダーまたはUser-Agent）がある
  const isAuthorized = token === env.CRON_SECRET() || isVercelCron;

  // デバッグ用：どのような証拠でアクセスしてきたかを詳細に記録
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

  // Load existing hashes for diff (chunked)
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

    // --- 2. Activation Logic ---
    const { data: rules } = await supabase
      .from("activation_menus")
      .select("*");

    // 地震・津波・火山関連（eqvol.xml）を最優先にしつつ、処理対象を50件に拡大
    const sortedChanged = [...changed].sort((a, b) => {
      const isEqA = a.sourceFeed.includes("eqvol.xml");
      const isEqB = b.sourceFeed.includes("eqvol.xml");
      if (isEqA && !isEqB) return -1;
      if (!isEqA && isEqB) return 1;
      const ta = a.updated ? new Date(a.updated).getTime() : 0;
      const tb = b.updated ? new Date(b.updated).getTime() : 0;
      return tb - ta;
    });

    const entriesToProcess = sortedChanged.slice(0, 50);

    // --- ステータス更新 & 復旧通知ロジック ---
    const { data: prevStatus } = await supabase
      .from("system_status")
      .select("*")
      .eq("id", "jma_receiver")
      .single();

    if (prevStatus && prevStatus.status !== "ok") {
      // エラーからの復旧通知
      await sendNotification({
        text: `【システム復旧】気象データ受信が正常に再開されました。\n前回の成功: ${new Date(prevStatus.last_success_at).toLocaleString('ja-JP')}`,
        mode: "production",
      });
    }

    await supabase
      .from("system_status")
      .upsert({
        id: "jma_receiver",
        last_success_at: new Date().toISOString(),
        status: "ok",
        updated_at: new Date().toISOString()
      });

    if (changed.length) {
      // --- 1. まず変更があったエントリをすべてDBに保存する ---
      // (チャンク分けして保存)
      const chunkSize = 50;
      for (let i = 0; i < changed.length; i += chunkSize) {
        const chunk = changed.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase.from("jma_entries").upsert(
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
        if (upsertError) {
          console.error("Failed to upsert jma_entries chunk:", upsertError.message);
        }
      }

      // --- 2. Activation Logic ---
      const { data: rules } = await supabase
        .from("activation_menus")
        .select("*");

    // 大量のエントリがある場合（初回同期時など）に通知が漏れないよう、
    // 判定対象を最新の50件に拡張し、さらに地震情報は最優先で処理する
    const sortedChanged = [...changed].sort((a, b) => {
      // 地震・津波・火山関連（eqvol.xml）を最優先にする
      const isEqA = a.sourceFeed.includes("eqvol.xml");
      const isEqB = b.sourceFeed.includes("eqvol.xml");
      if (isEqA && !isEqB) return -1;
      if (!isEqA && isEqB) return 1;
      const ta = a.updated ? new Date(a.updated).getTime() : 0;
      const tb = b.updated ? new Date(b.updated).getTime() : 0;
      return tb - ta;
    });

    const entriesToProcess = sortedChanged.slice(0, 50);

    for (const entry of entriesToProcess) {
        // 詳細内容 (content or headline) を抽出
        const raw = entry.raw as any;
        const contentText = raw?.content?.['#text'] || raw?.headline?.['#text'] || "";
        const searchTarget = `${entry.title ?? ""} ${contentText}`;

        for (const rule of rules ?? []) {
          // 判定を効率化するため、キーワードがない場合はスキップ
          const ruleKeywords = (rule.threshold as Record<string, any>)?.keywords ?? [];
          const testKeywords = (rule.test_threshold as Record<string, any>)?.keywords ?? [];
          
          if (!rule.enabled && !rule.test_enabled) continue;

          // --- 1. Production Match ---
          const isProdMatch = rule.enabled && ruleKeywords.length > 0 && ruleKeywords.some((k: string) => searchTarget.includes(k));

          if (isProdMatch) {
            await createIncidentAndNotify(supabase, entry, rule, "production");
            // 本番通知をした場合は試験通知はスキップ（ノイズ抑制）
            continue;
          }

          // --- 2. Test Match ---
          const isTestMatch = rule.test_enabled && testKeywords.length > 0 && testKeywords.some((k: string) => searchTarget.includes(k));

          if (isTestMatch) {
            await createIncidentAndNotify(supabase, entry, rule, "test");
          }
        }
      }
    }

  // --- 3. データのクリーンアップ (1週間以上前の不要なデータを削除) ---
  await supabase.rpc("cleanup_old_jma_entries");

  return NextResponse.json({ ok: true, fetched: fetched.length, changed: changed.length });
}

async function createIncidentAndNotify(
  supabase: any,
  entry: AtomEntry,
  rule: any,
  mode: "production" | "test"
) {
  // Check for duplicate incident for this entry AND mode
  const { data: existingIncident } = await supabase
    .from("incidents")
    .select("id")
    .eq("jma_entry_key", entry.entryKey)
    .eq("mode", mode)
    .single();

  if (existingIncident) return;

  const { data: incident, error: incError } = await supabase
    .from("incidents")
    .insert({
      status: "active",
      menu_type: rule.menu_type,
      jma_entry_key: entry.entryKey,
      title: entry.title,
      is_drill: mode === "test",
      mode: mode,
      slack_channel: rule.slack_channel ?? "dm",
    })
    .select()
    .single();

  if (incError || !incident) return;

  // XML解析用のデータを取得
  let maxInt = "確認中";
  let epicenter = "確認中";
  let depth = "確認中";
  let magnitude = "確認中";
  let tsunamiText = "";
  let matchedLocations: string[] = [];
  let actualAreasInXml: string[] = []; // XMLに含まれる実際のエリア名
  const mentionList: string[] = [];

  try {
    if (entry.link) {
      const res = await fetch(entry.link);
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const doc = parser.parse(xml);
      const body = doc?.Report?.Body;

      if (body) {
        // ... (中略: maxInt, epicenter 等の解析) ...
        
        // 地点マッチング用のセット
        const cities = new Set<string>();
        const areasInXml = new Set<string>();
        
        // --- 再帰的なエリア抽出関数の定義 ---
        const extractNames = (obj: any): string[] => {
          const names: string[] = [];
          if (!obj || typeof obj !== "object") return names;

          if (Array.isArray(obj)) {
            for (const item of obj) {
              names.push(...extractNames(item));
            }
          } else {
            // Areaタグを見つけたらその中のNameを取得
            if (obj.Area) {
              const areas = asUnknownArray(obj.Area);
              for (const a of areas) {
                if (isRecord(a) && a.Name) {
                  const n = asString(a.Name);
                  if (n) names.push(n);
                }
              }
            }
            // さらに深く探索
            for (const key in obj) {
              if (key !== "Area") {
                names.push(...extractNames(obj[key]));
              }
            }
          }
          return names;
        };

        // --- 気象警報・注意報の解析 (Warning) ---
        if (body.Warning) {
          actualAreasInXml.push(...extractNames(body.Warning));
        }

        // --- 震度情報の解析 (Intensity) ---
        if (body.Intensity) {
          actualAreasInXml.push(...extractNames(body.Intensity));
        }

        // 重複削除と空文字の除外
        actualAreasInXml = Array.from(new Set(actualAreasInXml.filter(n => n && n.length > 0)));

        // 登録地点（システム・ユーザー）を取得
        const [{ data: sysLocs }, { data: userLocs }] = await Promise.all([
          supabase.from("system_locations").select("city, label, jma_area_name"),
          supabase.from("user_locations").select("city, display_name, user_id, jma_area_name")
        ]);

        const isEarthquake = rule.menu_type === "earthquake";

        const matchedSys = (sysLocs || []).filter((reg: any) => {
          if (!reg.city) return false;
          // 地震の場合は市区町村レベルでチェック
          const cityMatch = Array.from(cities).some(xmlCity => 
            xmlCity.includes(reg.city) || reg.city.includes(xmlCity)
          );
          if (isEarthquake) return cityMatch;
          
          // 警報などの場合はエリアレベル（細分区域）でもチェック
          const areaMatch = reg.jma_area_name && areasInXml.has(reg.jma_area_name);
          return cityMatch || areaMatch;
        });

        const matchedUsers = (userLocs || []).filter((reg: any) => {
          if (!reg.city) return false;
          const cityMatch = Array.from(cities).some(xmlCity => 
            xmlCity.includes(reg.city) || reg.city.includes(xmlCity)
          );
          if (isEarthquake) return cityMatch;

          const areaMatch = reg.jma_area_name && areasInXml.has(reg.jma_area_name);
          return cityMatch || areaMatch;
        });

        matchedLocations = [
          ...matchedSys.map((l: any) => `${l.label}(${l.city})`),
          ...matchedUsers.map((l: any) => `${l.display_name}(${l.city})`)
        ];

        // メンション先の決定
        if (matchedSys.length > 0) {
          // 全社共通の地点が含まれる場合は全社員メンション
          mentionList.push("<!here>");
        } else if (matchedUsers.length > 0) {
          // ユーザー個別の地点のみの場合は該当ユーザーのみメンション
          const userIds = Array.from(new Set(matchedUsers.map((l: any) => l.user_id)));
          const { data: profileList } = await supabase
            .from("profiles")
            .select("slack_user_id")
            .in("id", userIds);
          
          if (profileList) {
            for (const p of profileList as any[]) {
              if (p.slack_user_id) {
                mentionList.push(`<@${p.slack_user_id}>`);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("XML Parsing error:", e);
  }

  // 地点マッチングが必須な場合（登録地点以外不要）の判定
  if (matchedLocations.length === 0) {
    if (mode === "test") {
      // 試験モードの場合は、マッチしなくても実際のエリア名があればそれを使用
      if (actualAreasInXml.length > 0) {
        matchedLocations = [
          actualAreasInXml.slice(0, 5).join("、") + 
          (actualAreasInXml.length > 5 ? `ほか${actualAreasInXml.length - 5}地点` : "")
        ];
      } else {
        matchedLocations = ["デモ用全国通知（試験環境）"];
      }
    } else {
      // 本番モードでマッチしない場合は削除して終了
      await supabase.from("incidents").delete().eq("id", incident.id);
      return;
    }
  }

  // 詳細内容 (#text) を抽出
  const raw = entry.raw as any;
  const contentText = raw?.content?.['#text'] || raw?.headline?.['#text'] || "";

  // テンプレート内のプレースホルダーを置換
  // \n を実際の改行に変換し、各項目を埋める
  const formattedText = (rule.template ?? "安否確認を開始します: {title}")
    .replace(/\\n/g, "\n")
    .replace("{title}", entry.title ?? "")
    .replace("{content}", contentText)
    .replace("{max_shindo}", `震度${maxInt}`)
    .replace("{target_summary}", matchedLocations.join("、"))
    .replace(/対象目安[：:]\s*/g, "通知対象エリア：");

  const prefix = mode === "test" ? `【訓練：${rule.menu_type.toUpperCase()}】` : "";
  const eventTime = entry.updated 
    ? new Date(entry.updated).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) 
    : "不明";

  // 地震情報セクションの組み立て（地震の場合のみ）
  const eqInfoSection = rule.menu_type === "earthquake" ? [
    `最大震度：震度${maxInt}`,
    `震源地：${epicenter}`,
    `（M${magnitude} / 深さ：${depth}）`,
  ] : [];

  // 登録地点ごとの警報発表メッセージ（地震以外）
  const locationAlerts = rule.menu_type !== "earthquake" 
    ? (matchedLocations.length > 0 && !matchedLocations.includes("デモ用全国通知（試験環境）")
        ? matchedLocations.map(loc => `*${loc}にて${entry.title}が発表されています。*`)
        : actualAreasInXml.length > 0 
          ? [`*${actualAreasInXml.slice(0, 5).join("、")}${actualAreasInXml.length > 5 ? `ほか${actualAreasInXml.length - 5}地点` : ""}にて${entry.title}が発表されています。*`]
          : [`*対象の登録地点：${matchedLocations.join("、")}*`])
    : [];

  // メンション先がある場合、メッセージの先頭に追加
  const mentions = mentionList.length > 0 ? mentionList : undefined;

  await sendNotification({
    mode: mode,
    mentions: mentions,
    text: [
      prefix,
      locationAlerts.length > 0 ? locationAlerts.join("\n") : `*対象の登録地点：${matchedLocations.join("、")}*`,
      ...eqInfoSection,
      "",
      formattedText,
      tsunamiText ? `\n${tsunamiText}` : "",
      "",
      `発表時刻: ${eventTime}`,
      "",
      mode === "test" 
        ? "※これはJMA連携試験による自動配信です。内容を確認し、問題なければ回答してください。"
        : "上記の内容を確認し、速やかに回答してください。",
    ].filter(Boolean).join("\n"),
  });

  await supabase.from("audit_logs").insert({
    action: "auto_incident_start",
    target_type: "incident",
    target_id: incident.id,
    metadata: { menu_type: rule.menu_type, entry_key: entry.entryKey, mode },
  });
}

