import { chromium } from 'playwright-core';
const EXEC='/Users/aleksa/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:EXEC,headless:true,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const page=await browser.newPage(); await page.goto('about:blank');
const res=await page.evaluate(async()=>{
  const out=[];
  const cfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  // True trickle: forward candidates live, SDP has no candidates at all.
  {
    const a=new RTCPeerConnection(cfg), b=new RTCPeerConnection(cfg);
    const log=[];
    let bRemoteSet=false, aRemoteSet=false;
    const aq=[], bq=[];
    a.onicecandidate=e=>{ if(!e.candidate)return; if(bRemoteSet) b.addIceCandidate(e.candidate).catch(err=>log.push('Bcand:'+err.message)); else aq.push(e.candidate); };
    b.onicecandidate=e=>{ if(!e.candidate)return; if(aRemoteSet) a.addIceCandidate(e.candidate).catch(err=>log.push('Acand:'+err.message)); else bq.push(e.candidate); };
    a.onconnectionstatechange=()=>log.push('A:'+a.connectionState);
    b.onconnectionstatechange=()=>log.push('B:'+b.connectionState);
    const dc=a.createDataChannel('t',{ordered:true});
    await a.setLocalDescription(await a.createOffer());
    const offer={type:'offer', sdp:a.localDescription.sdp};
    // set remote immediately (offer from createOffer has no candidates)
    await b.setRemoteDescription(offer);
    bRemoteSet=true;
    for(const c of aq) await b.addIceCandidate(c).catch(()=>{});
    await b.setLocalDescription(await b.createAnswer());
    const answer={type:'answer', sdp:b.localDescription.sdp};
    await a.setRemoteDescription(answer);
    aRemoteSet=true;
    for(const c of bq) await a.addIceCandidate(c).catch(()=>{});
    await new Promise(r=>setTimeout(r,7000));
    out.push({v:'true-trickle', a:a.connectionState,b:b.connectionState,dc:dc.readyState,log});
    a.close();b.close();
  }
  return out;
});
console.log(JSON.stringify(res,null,2));
await browser.close();
