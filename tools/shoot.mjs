/**
 * Screenshot harness: serves the exported web bundle and captures the
 * iPhone-sized viewport for each screen so UI changes can be reviewed.
 *
 * Usage: node tools/shoot.mjs [screen...]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const EXEC = '/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT = new URL('../shots/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(normalize(ROOT))) {
      res.writeHead(403).end();
      return;
    }
    let body;
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(join(ROOT, 'index.html'));
      file = join(ROOT, 'index.html');
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const shots = process.argv.slice(2);
const want = (name) => shots.length === 0 || shots.includes(name);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
if (want('menu')) await page.screenshot({ path: join(OUT, '01-menu.png') });

if (want('select')) {
  await page.getByText('CREATE CHARACTER').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, '02-select.png') });
}

if (want('game')) {
  await page.getByText('ENTER THE WORLD').click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, '03-game.png') });
}

console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no console errors');
await browser.close();
server.close();
