/**
 * Layout probe: loads the exported web build at iPhone size and reports the
 * measured geometry of key HUD elements plus any horizontal overflow, so the
 * layout can be validated without eyeballing screenshots.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const EXEC =
  '/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(normalize(ROOT))) return res.writeHead(403).end();
  let body;
  try {
    body = await readFile(file);
  } catch {
    body = await readFile(join(ROOT, 'index.html'));
    file = join(ROOT, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});

const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const report = (label, value) => console.log(`${label}: ${JSON.stringify(value)}`);

async function overview(name) {
  const info = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const overflow = [];
    const svgs = document.querySelectorAll('svg').length;
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.right > vw + 1 || r.left < -1) {
        // Ignore elements that are intentionally clipped inside a scroller.
        overflow.push({
          tag: el.tagName,
          text: (el.textContent ?? '').slice(0, 28),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    });
    return {
      vw,
      vh,
      bodyScrollW: document.documentElement.scrollWidth,
      bodyScrollH: document.documentElement.scrollHeight,
      svgCount: svgs,
      overflowCount: overflow.length,
      overflow: overflow.slice(0, 6),
    };
  });
  report(name, info);
}

async function box(text) {
  const loc = page.getByText(text, { exact: false }).first();
  if (!(await loc.count())) return { text, found: false };
  const b = await loc.boundingBox();
  return { text, found: true, ...(b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : {}) };
}

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await overview('menu');
report('menu.title', await box('IRONHOLD'));
report('menu.enter', await box('ENTER THE HOLD'));
report('menu.create', await box('CREATE CHARACTER'));
await page.screenshot({ path: new URL('../shots/probe-menu.png', import.meta.url).pathname });

await page.getByText('CREATE CHARACTER').click();
await page.waitForTimeout(800);
await overview('select');
report('select.header', await box('CHOOSE YOUR PATH'));
report('select.warrior', await box('Warrior'));
report('select.mage', await box('Mage'));
report('select.confirm', await box('ENTER THE WORLD'));
await page.screenshot({ path: new URL('../shots/probe-select.png', import.meta.url).pathname });

await page.getByText('ENTER THE WORLD').click();
await page.waitForTimeout(2400);
await overview('game');
report('game.name', await box('Thrall'));
report('game.menu', await box('MENU'));
report('game.zone', await box('ELWYNN VALE'));
await page.screenshot({ path: new URL('../shots/probe-game.png', import.meta.url).pathname });

console.log(errors.length ? `ERRORS:\n${errors.slice(0, 8).join('\n')}` : 'no console errors');
await browser.close();
server.close();
