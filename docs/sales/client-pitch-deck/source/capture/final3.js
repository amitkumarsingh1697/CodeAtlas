const { chromium } = require('playwright');
(async()=>{
 const TOKEN=process.argv[2]; const O='final/';
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:4317/#token='+TOKEN); await p.waitForTimeout(1500);
 await p.goto('http://127.0.0.1:4317/repos/2/flows'); await p.waitForTimeout(2500);
 await p.getByText('POST /owners/{ownerId}/pets/new',{exact:true}).first().click(); await p.waitForTimeout(3500);
 await p.screenshot({path:O+'petclinic-flow.png'});
 await b.close();
})();
