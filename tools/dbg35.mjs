import { chromium } from 'playwright-core';
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:EXEC,headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const page=await browser.newPage(); await page.goto('about:blank');
const res=await page.evaluate(async()=>{
  const out=[];
  const cfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  // Full inline SDP, no stripping, added immediately (setRemoteDescription includes candidates natively)
  {
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    await new Promise(r=>setTimeout(r,1500));
    await b.setRemoteDescription(a.localDescription);   // full, inline
    await b.setLocalDescription(await b.createAnswer());
    await new Promise(r=>setTimeout(r,1500));
    await a.setRemoteDescription(b.localDescription);
    await new Promise(r=>setTimeout(r,7000));
    out.push({v:'full-inline', a:a.connectionState,b:b.connectionState,log});
    a.close();b.close();
  }
  // Full inline, but ALSO forward live candidates
  {
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    let bReady=false; const q=[];
    a.onicecandidate=e=>{ if(!e.candidate)return; if(bReady) b.addIceCandidate(e.candidate).catch(()=>{}); else q.push(e.candidate); };
    b.onicecandidate=e=>{ if(e.candidate) a.addIceCandidate(e.candidate).catch(()=>{}); };
    a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    await new Promise(r=>setTimeout(r,1500));
    await b.setRemoteDescription(a.localDescription);
    bReady=true; for(const c of q) await b.addIceCandidate(c).catch(()=>{});
    await b.setLocalDescription(await b.createAnswer());
    await new Promise(r=>setTimeout(r,1500));
    await a.setRemoteDescription(b.localDescription);
    await new Promise(r=>setTimeout(r,7000));
    out.push({v:'full-inline-plus-trickle', a:a.connectionState,b:b.connectionState,log});
    a.close();b.close();
  }
  return out;
});
console.log(JSON.stringify(res,null,2));
await browser.close();
