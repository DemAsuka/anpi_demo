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
        // 1. Simple Keyword Match (MVP level logic)
        // In a production system, you would fetch entry.link and parse the detailed XML.
        const ruleKeywords = (rule.threshold as Record<string, any>)?.keywords ?? [];
        // Default keywords if none set in DB
        const defaultKeywords: Record<string, string[]> = {
          earthquake: ["震度5弱", "震度5強", "震度6弱", "震度6強", "震度7"],
          tsunami: ["大津波警報", "津波警報"],
          heavy_rain: ["大雨特別警報"],
          flood: ["氾濫危険", "氾濫発生"],
          civil_protection: ["国民保護", "Jアラート"],
        };
        const keywords = ruleKeywords.length ? ruleKeywords : (defaultKeywords[rule.menu_type] ?? []);

        const isMatch = keywords.some((k: string) => entry.title?.includes(k));
        if (!isMatch) continue;

        // 2. Check for duplicate incident for this entry
        const { data: existingIncident } = await supabase
          .from("incidents")
          .select("id")
          .eq("jma_entry_key", entry.entryKey)
          .single();

        if (existingIncident) continue;

        // 3. Create real incident (NOT a drill)
        const { data: incident, error: incError } = await supabase
          .from("incidents")
          .insert({
            status: "active",
            menu_type: rule.menu_type,
            jma_entry_key: entry.entryKey,
            title: entry.title,
            is_drill: false,
            slack_channel: rule.slack_channel ?? "dm",
          })
          .select()
          .single();

        if (incError || !incident) continue;

        // 4. Send Slack notification
        await sendNotification({
          isDrill: false,
          text: [
            (rule.template ?? "安否確認を開始します: {title}").replace("{title}", entry.title ?? ""),
            "",
            "下記のボタンから回答してください。",
          ].join("\n"),
        });

        // 5. Audit log
        await supabase.from("audit_logs").insert({
          action: "auto_incident_start",
          target_type: "incident",
          target_id: incident.id,
          metadata: { menu_type: rule.menu_type, entry_key: entry.entryKey },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, fetched: fetched.length, changed: changed.length });
}

