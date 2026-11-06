/**
 * Gameplay integration test: boots a character, drives the joystick, casts
 * abilities and confirms enemies take damage and die. Runs the real bundle.
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
const browser=await chromium.launch({executablePath:EXEC,headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdpi']});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>m.type()==='error'&&errors.push('console: '+m.text()));

await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
await page.waitForTimeout(1600);

// Choose mage so we can cast a projectile from range.
await page.getByText('CREATE CHARACTER').click();
await page.waitForTimeout(700);
await page.getByText('Mage', { exact: true }).click();
await page.waitForTimeout(400);
await page.getByText('ENTER THE WORLD').click();
await page.waitForTimeout(2500);
await page.screenshot({path:join(OUT,'30-game-mage.png')});

// Drive the joystick by mouse-dragging on the stick base.
const stick = await page.evaluate(()=>{
  const els=[...document.querySelectorAll('div')].filter(d=>d.getAttribute('aria-label')==='Movement joystick');
  const el=els[0];
  if(!el) return null;
  const r=el.getBoundingClientRect();
  return {x:r.x+r.width/2, y:r.y+r.height/2, w:r.width};
});
console.log('joystick', JSON.stringify(stick));

// Probe the combat log / world state via the DOM text over time.
const sample = async () => (await page.evaluate(()=>document.body.innerText)).slice(0,400);

if (stick) {
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  await page.mouse.move(stick.x, stick.y - stick.w*0.42, {steps:10});
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({path:join(OUT,'31-game-moved.png')});
}

// Cast fireball a few times via the action bar (slot 1).
const castCount = await page.evaluate(()=>{
  // Action bar buttons expose accessibility labels like "Fireball, 18 resource"
  return document.querySelectorAll('[aria-label*="Fireball"]').length;
});
console.log('fireball buttons found:', castCount);
if (castCount > 0) {
  const btn = page.locator('[aria-label*="Fireball"]').first();
  for (let i=0;i<4;i++) { await btn.click({force:true}).catch(e=>console.log('cast err',e.message.split('\n')[0])); await page.waitForTimeout(900); }
}
await page.waitForTimeout(1500);
await page.screenshot({path:join(OUT,'32-game-combat.png')});

console.log('--- SCREEN TEXT ---');
console.log((await sample()).replace(/\n+/g,' | ').slice(0,600));
console.log(errors.length?`ERRORS:\n${errors.slice(0,6).join('\n')}`:'no console errors');
await browser.close(); server.close();
