const { XMLParser } = require('fast-xml-parser');

const FEEDS = [
  "https://www.data.jma.go.jp/developer/xml/feed/regular.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/extra.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml",
  "https://www.data.jma.go.jp/developer/xml/feed/other.xml",
];

async function test() {
  for (const feed of FEEDS) {
    console.log(`Fetching ${feed}...`);
    const res = await fetch(feed);
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xml);
    const entries = doc.feed?.entry || [];
    const entryArray = Array.isArray(entries) ? entries : [entries];
    
    console.log(`Found ${entryArray.length} entries.`);
    entryArray.slice(0, 3).forEach(e => {
      console.log(` - ${e.title} (${e.updated})`);
    });
  }
}

test();


