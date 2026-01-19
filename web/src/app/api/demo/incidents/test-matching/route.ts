import { NextResponse, type NextRequest } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

const MOCK_EARTHQUAKE_XML = (cityName: string) => `
<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/">
<Control><Title>震源・震度に関する情報</Title><DateTime>2026-01-19T01:00:00Z</DateTime></Control>
<Head xmlns="http://xml.kishou.go.jp/jmaxml1/informationBasis1/">
  <Title>震源・震度情報</Title>
  <Headline><Text>デモ用シミュレーション地震情報です。</Text></Headline>
</Head>
<Body xmlns="http://xml.kishou.go.jp/jmaxml1/body/seismology1/" xmlns:jmx_eb="http://xml.kishou.go.jp/jmaxml1/elementBasis1/">
  <Earthquake>
    <OriginTime>2026-01-19T10:00:00+09:00</OriginTime>
    <Hypocenter><Area><Name>デモ震源地</Name><jmx_eb:Coordinate description="北緯35.0度 東経135.0度 深さ10km" /></Area></Hypocenter>
    <jmx_eb:Magnitude description="M5.0">5.0</jmx_eb:Magnitude>
  </Earthquake>
  <Intensity><Observation><MaxInt>4</MaxInt>
    <Pref><Name>デモ県</Name>
      <Area><Name>デモ地域</Name>
        <City><Name>${cityName}</Name></City>
      </Area>
    </Pref>
  </Observation></Intensity>
  <Comments><ForecastComment><Text>この地震による津波の心配はありません（デモ）。</Text></ForecastComment></Comments>
</Body>
</Report>
`;

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServiceRoleClient();
  const results = [];

  // テストケース：1. 一致する（仙台市）、2. 一致しない（那覇市）
  const testCities = ["仙台市", "那覇市"];

  for (const city of testCities) {
    console.log(`--- Starting Demo Test for: ${city} ---`);
    const xml = MOCK_EARTHQUAKE_XML(city);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xml);
    const body = doc?.Report?.Body;

    let matchedLocations: string[] = [];
    const citiesInXml = new Set<string>([city]);

    // 登録地点を取得
    const [{ data: sysLocs }, { data: userLocs }] = await Promise.all([
      supabase.from("system_locations").select("city, label"),
      supabase.from("user_locations").select("city, display_name, user_id")
    ]);

    const matchedSys = (sysLocs || []).filter(reg => {
      return Array.from(citiesInXml).some(xmlCity => 
        xmlCity.includes(reg.city) || reg.city.includes(xmlCity)
      );
    });

    const matchedUsers = (userLocs || []).filter(reg => {
      return Array.from(citiesInXml).some(xmlCity => 
        xmlCity.includes(reg.city) || reg.city.includes(xmlCity)
      );
    });

    matchedLocations = [
      ...matchedSys.map(l => `${l.label}(${l.city})`),
      ...matchedUsers.map(l => `${l.display_name}(${l.city})`)
    ];

    if (matchedLocations.length > 0) {
      // メンション先の決定
      const mentionList: string[] = [];
      if (matchedSys.length > 0) {
        mentionList.push("<!here>");
      } else if (matchedUsers.length > 0) {
        const userIds = Array.from(new Set(matchedUsers.map(l => l.user_id)));
        const { data: profileList } = await supabase
          .from("profiles")
          .select("slack_user_id")
          .in("id", userIds);
        
        if (profileList) {
          for (const p of profileList) {
            if (p.slack_user_id) {
              mentionList.push(`<@${p.slack_user_id}>`);
            }
          }
        }
      }

      // マッチした場合のみ通知
      await sendNotification({
        mode: "test",
        mentions: mentionList.length > 0 ? mentionList : undefined,
        text: [
          `【デモ：地点マッチング試験】`,
          `*対象の登録地点：${matchedLocations.join("、")}*`,
          `最大震度：震度4 (デモ)`,
          `震源地：デモ震源地`,
          `（M5.0 / 深さ：10km）`,
          "",
          `内容：シミュレーションにより ${city} での揺れを検知しました。`,
          `このメッセージが届いていれば、地点フィルタリングとメンション機能は正常に動作しています。`,
          "",
          `発表時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
        ].join("\n"),
      });
      results.push({ city, status: "notification_sent", matched: matchedLocations, mentions: mentionList });
    } else {
      results.push({ city, status: "skipped_no_match" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
