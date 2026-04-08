import { NextResponse } from 'next/server';

const FALLBACK_ITEMS = {
  "-932201673": { name: "Scrap", short: "scrap" },
  "317398316": { name: "High Quality Metal", short: "metal.hq" },
  "69511070": { name: "Metal Fragments", short: "metal.fragments" },
  "-1461508848": { name: "Wood", short: "wood" },
  "-1581843485": { name: "Stones", short: "stones" },
  "-151838493": { name: "Sulfur", short: "sulfur" },
  "-2099697608": { name: "Cloth", short: "cloth" },
  "1103488722": { name: "Leather", short: "leather" }
};

// In-memory cache for item data
let cachedItems = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchCorrosionHourMap() {
  const CORROSION_HOUR_URL = 'https://www.corrosionhour.com/rust-item-list/';

  const response = await fetch(CORROSION_HOUR_URL, {
    headers: { 'user-agent': 'rust-trader-web/1.0' }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching Corrosion Hour`);
  }

  const html = await response.text();
  const map = {};

  // Parse HTML using regex
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const cells = match.slice(1, 5).map(cell => cell.replace(/<[^>]*>/g, '').trim());

    if (cells.length >= 3) {
      const possibleId = cells.find(cell => /^-?\d+$/.test(cell));
      const possibleName = cells.find(cell => cell.length > 2 && !(/^-?\d+$/.test(cell)) && !cell.includes('.'));
      const possibleShort = cells.find(cell => cell.includes('.') || (cell.length > 2 && cell !== possibleName));

      if (possibleId && possibleName) {
        map[possibleId] = {
          name: possibleName,
          short: possibleShort || possibleName.toLowerCase().replace(/\s+/g, '.')
        };
      }
    }
  }

  // If regex parse failed, try with cheerio
  if (Object.keys(map).length === 0) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const tables = $('table');

    tables.each((_, tbl) => {
      const $tbl = $(tbl);
      const headers = $tbl.find('thead th').map((_, th) => $(th).text().trim().toLowerCase()).get();
      if (!headers.length) return;

      const nameIdx = headers.findIndex(h => h.includes('display') || h === 'item');
      const shortIdx = headers.findIndex(h => h.includes('short'));
      const idIdx = headers.findIndex(h => h.includes('item id') || h === 'id');

      if (nameIdx === -1 || shortIdx === -1 || idIdx === -1) return;

      $tbl.find('tbody tr').each((_, tr) => {
        const tds = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
        if (!tds.length) return;

        const name = tds[nameIdx];
        const short = tds[shortIdx];
        const idStr = tds[idIdx];

        if (!name || !short || !/^-?\d+$/.test(idStr)) return;
        map[idStr] = { name, short };
      });
    });
  }

  if (Object.keys(map).length === 0) {
    throw new Error('Could not parse item table from Corrosion Hour');
  }

  return map;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Return cached items if available and not expired
  if (!forceRefresh && cachedItems && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    return NextResponse.json(cachedItems);
  }

  try {
    const items = await fetchCorrosionHourMap();
    cachedItems = items;
    cacheTimestamp = Date.now();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch items:', error);
    // Return cached if available, otherwise fallback
    if (cachedItems) {
      return NextResponse.json(cachedItems);
    }
    return NextResponse.json(FALLBACK_ITEMS);
  }
}
