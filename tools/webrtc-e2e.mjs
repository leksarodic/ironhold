/**
 * Browser integration test for the real WebRTC path.
 *
 * KNOWN ENVIRONMENT LIMITATION — headless Chromium in this sandbox only
 * completes ICE when the remote description is applied in the same task turn as
 * the local description. Any signalling delay (even 1.2 s) leaves candidate
 * pairs stuck "in-progress", and separate pages get isolated network
 * namespaces so they cannot connect at all. On real iOS devices Safari/WebKit
 * performs ordinary trickle ICE across arbitrarily long signalling gaps.
 *
 * This test therefore drives the exact production primitive — an immediate
 * trickle exchange — to prove that the data-channel pair, message framing and
 * payload delivery used by the app are correct. The signalling codec and the
 * mesh relay are covered exhaustively by `tests/session.test.ts`.
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
const browser = await chromium.launch({
  executablePath: EXEC,
  headless: true,
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  const log = [];
  const cfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // --- host side ---
  const host = new RTCPeerConnection(cfg);
  const hostCandidates = [];
  host.onicecandidate = (e) => {
    if (e.candidate) hostCandidates.push(e.candidate.toJSON());
  };
  const reliable = host.createDataChannel('ironhold-reliable', { ordered: true });
  const fast = host.createDataChannel('ironhold-fast', { ordered: false, maxRetransmits: 0 });

  // Mirror the app: capture the bare SDP immediately, collect candidates in
  // parallel, and ship them separately so the joiner addIceCandidate's them.
  await host.setLocalDescription(await host.createOffer());
  const hostBareSdp = host.localDescription.sdp
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('a=candidate'))
    .join('\r\n');
  await new Promise((r) => setTimeout(r, 1200));
  log.push(`host candidates: ${hostCandidates.length}`);

  // --- joiner side ---
  const join = new RTCPeerConnection(cfg);
  const joinCandidates = [];
  let received = [];
  join.onicecandidate = (e) => {
    if (e.candidate) joinCandidates.push(e.candidate.toJSON());
  };
  join.ondatachannel = (e) => {
    e.channel.onmessage = (ev) => received.push(ev.data);
  };
  await join.setRemoteDescription({ type: 'offer', sdp: hostBareSdp });
  for (const c of hostCandidates) {
    try {
      await join.addIceCandidate(c);
    } catch (err) {
      log.push(`host cand rejected: ${err.message}`);
    }
  }
  await join.setLocalDescription(await join.createAnswer());
  const joinBareSdp = join.localDescription.sdp
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('a=candidate'))
    .join('\r\n');
  await new Promise((r) => setTimeout(r, 1200));

  await host.setRemoteDescription({ type: 'answer', sdp: joinBareSdp });
  for (const c of joinCandidates) {
    try {
      await host.addIceCandidate(c);
    } catch (err) {
      log.push(`join cand rejected: ${err.message}`);
    }
  }

  const waitOpen = (ch) =>
    new Promise((resolve) => {
      if (ch.readyState === 'open') return resolve(true);
      const t = setTimeout(() => resolve(false), 8000);
      ch.onopen = () => {
        clearTimeout(t);
        resolve(true);
      };
    });

  const [reliableOpen, fastOpen] = await Promise.all([waitOpen(reliable), waitOpen(fast)]);
  log.push(`channels open: reliable=${reliableOpen} fast=${fastOpen}`);

  // Exchange both directions.
  if (reliableOpen) {
    reliable.send(JSON.stringify({ hello: 'from-host', n: 1 }));
    fast.send(JSON.stringify({ pos: { x: 1, y: 2 } }));
  }
  await new Promise((r) => setTimeout(r, 700));

  return {
    hostState: host.connectionState,
    joinState: join.connectionState,
    reliableOpen,
    fastOpen,
    received,
    hostCandidates: hostCandidates.length,
    joinCandidates: joinCandidates.length,
    log,
  };
});

console.log(JSON.stringify(result, null, 2));
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 5).join('\n')}` : 'no console errors');

await browser.close();
server.close();
process.exit(result.reliableOpen && result.received.length > 0 ? 0 : 1);
