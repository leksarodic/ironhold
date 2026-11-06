import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const EXEC =
  '/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(normalize(ROOT))) return res.writeHead(403).end();
  let body;
  try { body = await readFile(file); } catch { body = await readFile(join(ROOT, 'index.html')); file = join(ROOT, 'index.html'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});
const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('ENTER THE HOLD').click();
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const vw = window.innerWidth;
  const wide = [];
  document.querySelectorAll('div,span,svg,text,input').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      const st = getComputedStyle(el);
      wide.push({
        tag: el.tagName,
        cls: (el.getAttribute('class') || '').slice(0, 40),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        text: (el.textContent || '').slice(0, 20),
        pos: st.position,
        overflow: st.overflow,
        wCss: st.width,
      });
    }
  });
  return { vw, wide: wide.slice(0, 25), html: document.documentElement.scrollWidth, vp: document.querySelector('meta[name=viewport]')?.content };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
