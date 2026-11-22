const { chromium } = require('playwright');
(async()=>{
 const N=+process.argv[2]||300;
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.setDefaultTimeout(120000);
 await p.addInitScript(()=>{ window.__q=[]; window.requestAnimationFrame=(cb)=>{window.__q.push(cb); return window.__q.length;}; window.cancelAnimationFrame=()=>{};
   window.__step=(n)=>{for(let i=0;i<n;i++){const q=window.__q; window.__q=[]; const t=performance.now(); q.forEach(cb=>cb(t));}}; });
 await p.goto('file:///tmp/claude-0/out/immich-brain-scoped.html'); await p.waitForTimeout(6000);
 await p.addStyleTag({content:'.nb-top,.nb-left,.nb-right,.nb-legend,.nb-status,.nb-tooltip{display:none!important}'});
 await p.evaluate(()=>window.__step(2)); 
 // start drag in an empty area near the bottom left so hover tooltips don't show
 let x=300,y=980; await p.mouse.move(x,y); await p.mouse.down();
 for(let i=0;i<N;i++){
   x+=2.2; await p.mouse.move(x, y - i*0.08);
   await p.evaluate(()=>window.__step(1));
   await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});
   if(i%50==0) console.log('frame',i,new Date().toISOString());
 }
 await p.mouse.up(); await b.close();
})();
