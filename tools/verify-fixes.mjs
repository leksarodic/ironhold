import { chromium } from 'playwright-core';
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:EXEC,headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errs=[];
page.on('pageerror',e=>errs.push(e.message));
page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.waitForTimeout(1600);

// --- SETTINGS ---
await page.getByText('SETTINGS',{exact:true}).first().click();
await page.waitForTimeout(800);
const settingsVisible = await page.getByText('OPTIONS',{exact:false}).count() > 0;
console.log('settings screen opened:', settingsVisible);
const toggles = await page.evaluate(()=>document.querySelectorAll('[role="switch"]').length);
console.log('toggle switches rendered:', toggles);
// flip haptics off and confirm aria-checked changes
const hap = page.getByLabel('Haptics').first();
const before = await hap.getAttribute('aria-checked');
await hap.click();
await page.waitForTimeout(400);
const after = await hap.getAttribute('aria-checked');
console.log('haptics toggle:', before, '->', after);
await page.screenshot({path:'docs/screenshots/50-settings.png'});
await page.getByLabel('Close settings').click();
await page.waitForTimeout(600);
console.log('back at menu:', await page.getByText('IRONHOLD',{exact:true}).count()>0);

// --- WORLD ---
await page.getByText('ENTER THE HOLD').click();
await page.waitForTimeout(3000);
await page.screenshot({path:'docs/screenshots/51-world-fixed.png'});

const probes = await page.evaluate(() => {
  const svg = document.querySelectorAll('svg')[0];
  const out = [];
  for (const [label, gx, gy] of [['center',0.5,0.5],['upper',0.5,0.28],['lower',0.5,0.72]]) {
    const el = document.elementFromPoint(window.innerWidth*gx, window.innerHeight*gy);
    out.push({label, tag: el?.tagName, fill: el?.getAttribute?.('fill')});
  }
  const trees = svg.querySelectorAll('path[fill="#22361f"], path[fill="#2c4627"]').length;
  const actors = svg.querySelectorAll('text').length;
  return { probes: out, treeShapes: trees, textNodes: actors };
});
console.log(JSON.stringify(probes,null,1));
console.log('errors:', errs.length ? errs.slice(0,3).join(' | ') : 'none');
await browser.close();
