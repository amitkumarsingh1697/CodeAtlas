const { chromium } = require('playwright');
(async()=>{
 const TOKEN=process.argv[2];
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 p.setDefaultTimeout(240000);
 await p.goto('http://127.0.0.1:4317/#token='+TOKEN); await p.waitForTimeout(1500);
 await p.goto('http://127.0.0.1:4317/repos/1/brain'); await p.waitForTimeout(15000);
 const inp=p.getByPlaceholder(/Recall anything/);
 await inp.fill('getAlbumInfo'); await p.waitForTimeout(4000);
 await inp.press('ArrowDown'); await p.waitForTimeout(500); await inp.press('ArrowDown'); await p.waitForTimeout(500);
 await inp.press('Enter'); await p.waitForTimeout(20000);
 await p.screenshot({path:'final/immich-brain-method.png'});
 await b.close();
})();
