/**
 * Renders scripts/social-card/card.html to assets/social-preview.png at
 * exactly 1280 x 640, the size GitHub asks for in a social preview.
 *
 *   npm run social-card
 *
 * Needs Playwright's Chromium (`npx playwright install chromium` once).
 * The card loads nothing from the network, so the render is the same on
 * every machine that has the same Chromium.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const WIDTH = 1280;
const HEIGHT = 640;

const here = dirname(fileURLToPath(import.meta.url));
const cardPath = resolve(here, 'card.html');
const outPath = resolve(here, '../../assets/social-preview.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });

  // Fail loudly if the card ever reaches for the network.
  const blocked: string[] = [];
  await page.route(/^(?!file:)/, (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });

  await page.goto(pathToFileURL(cardPath).href);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 15_000 });
  if (blocked.length > 0) {
    throw new Error(`card.html tried to load from the network: ${blocked.join(', ')}`);
  }

  const missing = await page.evaluate(() =>
    ['400', 'italic 400']
      .map((w) => `${w} 40px "Cormorant Garamond"`)
      .filter((spec) => !document.fonts.check(spec)),
  );
  if (missing.length > 0) {
    throw new Error(`Fonts did not load: ${missing.join(', ')}`);
  }

  await page.locator('#card').screenshot({ path: outPath });
} finally {
  await browser.close();
}

// Read the size back from the PNG header rather than trusting the viewport.
const png = await readFile(outPath);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== WIDTH || height !== HEIGHT) {
  throw new Error(`Expected ${WIDTH} x ${HEIGHT}, got ${width} x ${height}`);
}
console.log(`Wrote ${outPath} (${width} x ${height}, ${Math.round(png.length / 1024)} KB)`);
