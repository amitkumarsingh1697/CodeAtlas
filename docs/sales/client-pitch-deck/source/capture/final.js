const { chromium } = require('playwright');
(async()=>{
 const TOKEN=process.argv[2]; const O='final/';
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 const go=async(u,w)=>{await p.goto('http://127.0.0.1:4317'+u); await p.waitForTimeout(w||2500);};
 await go('/#token='+TOKEN,1500);
 await p.screenshot({path:O+'repositories.png'});
 await go('/repos/1/overview'); await p.screenshot({path:O+'immich-overview.png'});
 await go('/repos/1/flows'); await p.getByText('GET /albums/:id',{exact:true}).first().click(); await p.waitForTimeout(3500);
 await p.screenshot({path:O+'immich-flow.png'});
 await go('/repos/1/dependencies'); await p.selectOption('select >> nth=0',{label:'immich'}); await p.waitForTimeout(5000);
 await p.screenshot({path:O+'immich-deps.png'});
 await go('/repos/1/risk'); await p.screenshot({path:O+'immich-risk.png'});
 await go('/repos/1/brain',10000); await p.screenshot({path:O+'immich-brain.png'});
 const inp=p.getByPlaceholder(/Recall anything/);
 await inp.fill('getAlbumInfo'); await p.waitForTimeout(2000);
 await p.getByText('AlbumController.getAlbumInfo').first().click(); await p.waitForTimeout(6000);
 await p.screenshot({path:O+'immich-brain-method.png'});
 await go('/repos/1/brain',10000);
 await p.getByRole('button',{name:'Diagrams'}).click(); await p.waitForTimeout(4000);
 await p.screenshot({path:O+'immich-er.png'});
 // petclinic
 await go('/repos/2/overview'); await p.screenshot({path:O+'petclinic-overview.png'});
 await go('/repos/2/flows');
 const t=await p.evaluate(()=>document.body.innerText); console.log(t.match(/(GET|POST) \/[^\n]*/g)?.slice(0,20));
 await b.close();
})();
