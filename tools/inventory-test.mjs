/**
 * Inventory UI integration test: opens the bag, verifies the grid renders the
 * starter kit, and checks the tooltip appears for a slot.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT=new URL('../shots/',import.meta.url).pathname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{const url=new URL(req.url??'/','http://localhost');let file=normalize(join(ROOT,decodeURIComponent(url.pathname)));if(!file.startsWith(normalize(ROOT)))return res.writeHead(403).end();let body;try{body=await readFile(file)}catch{body=await readFile(join(ROOT,'index.html'));file=join(ROOT,'index.html')}res.writeHead(200,{'content-type':MIME[extname(file)]??'application/octet-stream'});res.end(body)});
const port=await new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const browser=await chromium.launch({executablePath:EXEC,headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>m.type()==='error'&&errors.push('console: '+m.text()));

await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(1600);
await page.getByText('CREATE CHARACTER').click();
await page.waitForTimeout(600);
await page.getByText('ENTER THE WORLD').click();
await page.waitForTimeout(2200);

const bagBtn = page.getByLabel('Open inventory bag');
console.log('bag button found:', await bagBtn.count());
await bagBtn.click();
await page.waitForTimeout(800);
await page.screenshot({path:join(OUT,'40-inventory-open.png')});

// Count rendered slots
const slotCount = await page.evaluate(()=>document.querySelectorAll('[data-testid^="inv-slot-"]').length);
console.log('inventory slots rendered:', slotCount);

// Inspect a filled slot (starter kit puts sword at 0)
const firstLabel = await page.locator('[data-testid="inv-slot-0"]').getAttribute('aria-label').catch(()=>null);
console.log('slot 0:', firstLabel);

// Tap a slot with an item to reveal details
await page.locator('[data-testid="inv-slot-0"]').click();
await page.waitForTimeout(600);
const tooltip = await page.evaluate(()=>{
  const t = document.querySelector('[data-testid="item-tooltip"]');
  return t ? t.textContent : null;
});
console.log('tooltip:', tooltip ? tooltip.slice(0,160) : 'MISSING');
await page.screenshot({path:join(OUT,'41-inventory-tooltip.png')});

// Layout check
const layout = await page.evaluate(()=>({vw:window.innerWidth, sw:document.documentElement.scrollWidth}));
console.log('layout:', JSON.stringify(layout));
// Close the inventory overlay before interacting with the HUD again.
await page.getByLabel('Close inventory').click();
await page.waitForTimeout(500);

// Drive loot deterministically through the E2E hook instead of farming.
const injected = await page.evaluate(() => {
  const h = window.__ironhold;
  if (!h) return { ok: false };
  const ws = h.world.getState();
  const inv = h.inventory.getState();
  const world = ws.world;
  if (!world) return { ok: false, reason: 'no world' };
  // Simulate a player standing on a dropped item.
  world.groundLoot.push({
    id: 'test-loot-1',
    itemId: 'militia_blade',
    qty: 1,
    quality: 2,
    // Just outside the 1.1-unit auto-pickup radius so it stays on the ground.
    pos: { x: world.players[0].pos.x + 3, y: world.players[0].pos.y },
    ownerId: null,
    droppedAt: 0,
  });
  ws.refresh();
  return { ok: true, lootCount: world.groundLoot.length, bagUsed: inv.slots.filter(Boolean).length };
});
console.log('loot injected:', JSON.stringify(injected));
await page.waitForTimeout(700);
const lootBtn = page.getByLabel('Loot nearby');
const hasLootBtn = (await lootBtn.count()) > 0;
console.log('loot button appeared:', hasLootBtn);
if (hasLootBtn) {
  await lootBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '42-loot-window.png') });
  const txt = await page.evaluate(() => document.body.innerText);
  console.log('loot window text:', txt.split('LOOT').slice(-1)[0]?.slice(0, 150).replace(/\n+/g, ' | '));
  const takeAll = page.getByText('TAKE ALL');
  if (await takeAll.count()) {
    await takeAll.click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => {
      const inv = window.__ironhold.inventory.getState();
      return inv.slots.filter(Boolean).map(s => s.itemId + 'x' + s.qty);
    });
    console.log('bag after take all:', JSON.stringify(after));
    await page.screenshot({ path: join(OUT, '43-loot-taken.png') });
  }
}

console.log(errors.length?`ERRORS:\n${errors.slice(0,5).join('\n')}`:'no console errors');
await browser.close(); server.close();
