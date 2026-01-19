const FEEDS = [
  "https://www.data.jma.go.jp/developer/xml/feed/regular.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/extra.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/other.xml",
];

async function test() {
  for (const feed of FEEDS) {
    console.log(`Fetching ${feed}...`);
    try {
      const res = await fetch(feed);
      const xml = await res.text();
      const titles = xml.match(/<title>(.*?)<\/title>/g) || [];
      const updates = xml.match(/<updated>(.*?)<\/updated>/g) || [];
      
      console.log(`Found ${titles.length} title tags.`);
      titles.slice(1, 5).forEach((t, i) => {
        console.log(` - ${t.replace(/<\/?title>/g, '')} (${updates[i+1]?.replace(/<\/?updated>/g, '')})`);
      });
    } catch (e) {
      console.error(`Failed to fetch ${feed}: ${e.message}`);
    }
  }
}

test();


