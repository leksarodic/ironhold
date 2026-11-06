import { chromium } from 'playwright-core';
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:EXEC,headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const page=await browser.newPage(); await page.goto('about:blank');
const res=await page.evaluate(async()=>{
  const out=[];
  const cfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  // Candidates INLINE in SDP; simulate a long human-signaling delay before apply.
  const run=async(delay, label, addEndOfCandidates)=>{
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    // wait for gathering to produce inline candidates, then emulate 30s code transit
    await new Promise(r=>{ if(a.iceGatheringState==='complete')return r(); a.onicegatheringstatechange=()=>{if(a.iceGatheringState==='complete')r()}; setTimeout(r,5000); });
    let aSdp=a.localDescription.sdp;
    const aInline=aSdp.includes('a=candidate');
    await new Promise(r=>setTimeout(r,delay));   // the "human pastes code" delay
    await b.setRemoteDescription({type:'offer', sdp: aSdp});
    await b.setLocalDescription(await b.createAnswer());
    await new Promise(r=>{ if(b.iceGatheringState==='complete')return r(); b.onicegatheringstatechange=()=>{if(b.iceGatheringState==='complete')r()}; setTimeout(r,5000); });
    let bSdp=b.localDescription.sdp;
    await new Promise(r=>setTimeout(r,delay));
    await a.setRemoteDescription({type:'answer', sdp:bSdp});
    await new Promise(r=>setTimeout(r,8000));
    out.push({label, delay, aInline, a:a.connectionState,b:b.connectionState,log});
    a.close();b.close();
  };
  await run(15000,'inline-15s-delay');
  return out;
});
console.log(JSON.stringify(res,null,1));
await browser.close();
