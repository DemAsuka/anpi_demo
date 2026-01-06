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
  const token =
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  if (token !== env.CRON_SECRET()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

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

  if (changed.length) {
    const { error } = await supabase.from("jma_entries").upsert(
      changed.map((e) => ({
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
    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error", details: error.message },
        { status: 500 },
      );
    }

    // MVP: notify Slack with a summary of updated feed entries.
    await postSlackSummary(changed);

    // --- Activation Logic ---
    const { data: rules } = await supabase
      .from("activation_menus")
      .select("*")
      .eq("enabled", true);

    for (const entry of changed) {
      for (const rule of rules ?? []) {
        // --- 1. Production Match ---
        const ruleKeywords = (rule.threshold as Record<string, any>)?.keywords ?? [];
        const isProdMatch = ruleKeywords.length > 0 && ruleKeywords.some((k: string) => entry.title?.includes(k));

        if (isProdMatch) {
          await createIncidentAndNotify(supabase, entry, rule, "production");
          continue; // Prioritize production alert
        }

        // --- 2. Test Match ---
        const testKeywords = (rule.test_threshold as Record<string, any>)?.keywords ?? [];
        const isTestMatch = rule.test_enabled && testKeywords.length > 0 && testKeywords.some((k: string) => entry.title?.includes(k));

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

  await sendNotification({
    mode: mode,
    text: [
      (rule.template ?? "安否確認を開始します: {title}").replace("{title}", entry.title ?? ""),
      "",
      mode === "test" 
        ? "【JMA連携試験】気象庁XMLを検知して自動発動しました。下記のボタンから回答してください。"
        : "下記のボタンから回答してください。",
    ].join("\n"),
  });

  await supabase.from("audit_logs").insert({
    action: "auto_incident_start",
    target_type: "incident",
    target_id: incident.id,
    metadata: { menu_type: rule.menu_type, entry_key: entry.entryKey, mode },
  });
}

