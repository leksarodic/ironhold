import { chromium } from 'playwright-core';
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:EXEC,headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const page=await browser.newPage(); await page.goto('about:blank');
const res=await page.evaluate(async()=>{
  const out=[];
  const cfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  // 1: no wait at all, full SDP (candidates likely not inline yet)
  {
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    await b.setRemoteDescription(a.localDescription);
    await b.setLocalDescription(await b.createAnswer());
    await a.setRemoteDescription(b.localDescription);
    await new Promise(r=>setTimeout(r,7000));
    out.push({v:'no-wait', a:a.connectionState,b:b.connectionState,log});
    a.close();b.close();
  }
  // 2: wait 1500 then use localDescription (inline TRUE) - previously failed
  {
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    await new Promise(r=>setTimeout(r,1500));
    const inline=a.localDescription.sdp.includes('a=candidate');
    await b.setRemoteDescription(a.localDescription);
    await b.setLocalDescription(await b.createAnswer());
    await new Promise(r=>setTimeout(r,1500));
    const bInline=b.localDescription.sdp.includes('a=candidate');
    await a.setRemoteDescription(b.localDescription);
    await new Promise(r=>setTimeout(r,7000));
    out.push({v:'wait1500-inline', inline, bInline, a:a.connectionState,b:b.connectionState,log});
    a.close();b.close();
  }
  return out;
});
console.log(JSON.stringify(res,null,2));
await browser.close();
