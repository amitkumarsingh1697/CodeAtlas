// Renders the deck's generated visual assets (backgrounds, glows, 3D-style scenes, framed product
// screens) from HTML/CSS with headless Chromium. Product screens are real CodeAtlas screenshots; this
// script only frames, tilts and lights them. Run: node src/make-assets.js (from the deck folder).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const T = require('./tokens');

const ROOT = path.resolve(__dirname, '..');
const A = (f) => path.join(ROOT, 'assets', f);
const OUT = (f) => path.join(ROOT, 'build', 'img', f);
fs.mkdirSync(path.join(ROOT, 'build', 'img'), { recursive: true });
const c = (k) => '#' + T.color[k];
const dataUri = (f) => 'data:image/png;base64,' + fs.readFileSync(A(f)).toString('base64');

const FONTS = `
@font-face{font-family:Manrope;font-weight:800;src:url(file://${process.env.HOME}/.fonts/Manrope-800.ttf)}
@font-face{font-family:Manrope;font-weight:600;src:url(file://${process.env.HOME}/.fonts/Manrope-600.ttf)}
body{margin:0;font-family:Inter,sans-serif}`;

// Seeded random so re-renders are identical.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function stars(n, w, h, seed, maxA = 0.5) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = r() < 0.92 ? 1 : 2, a = (0.08 + r() * maxA).toFixed(2);
    out += `<i style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s}px;height:${s}px;opacity:${a}"></i>`;
  }
  return `<div class="stars">${out}</div><style>.stars i{position:absolute;background:#cfd8ff;border-radius:50%}</style>`;
}

const scenes = [];

// 1. Hero background: deep midnight, violet and cyan light, a perspective grid floor.
scenes.push({
  name: 'bg-hero.jpg', w: 1920, h: 1080, type: 'jpeg',
  html: `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:${c('bg0')}">
    <div style="position:absolute;left:-420px;top:-520px;width:1500px;height:1300px;border-radius:50%;background:radial-gradient(closest-side,rgba(124,92,255,.30),rgba(124,92,255,0))"></div>
    <div style="position:absolute;right:-520px;bottom:-640px;width:1500px;height:1300px;border-radius:50%;background:radial-gradient(closest-side,rgba(34,211,238,.16),rgba(34,211,238,0))"></div>
    ${stars(260, 1920, 1080, 7, 0.35)}
    <div style="position:absolute;left:-50%;right:-50%;bottom:-120px;height:520px;transform:perspective(520px) rotateX(72deg);transform-origin:bottom;
      background-image:linear-gradient(rgba(124,92,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(124,92,255,.22) 1px,transparent 1px);background-size:64px 64px;
      -webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.9),transparent 85%)"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55))"></div></div>`,
});

// 2. Main background: midnight with a faint dot grid and vignette (content slides).
scenes.push({
  name: 'bg-main.jpg', w: 1920, h: 1080, type: 'jpeg',
  html: `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:${c('bg1')}">
    <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(185,193,221,.10) 1.2px,transparent 1.3px);background-size:36px 36px;
      -webkit-mask-image:radial-gradient(ellipse at 60% 40%,rgba(0,0,0,.9),transparent 75%)"></div>
    ${stars(90, 1920, 1080, 11, 0.25)}
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(2,3,8,.65))"></div></div>`,
});

// 3. Ambient glow orbs (transparent). They are separate objects so Morph can drift them between slides.
for (const [n, rgb, a] of [['glow-violet.png', '124,92,255', 0.55], ['glow-cyan.png', '34,211,238', 0.38]]) {
  scenes.push({
    name: n, w: 900, h: 900, transparent: true,
    html: `<div style="width:900px;height:900px;border-radius:50%;background:radial-gradient(closest-side,rgba(${rgb},${a}),rgba(${rgb},${a * 0.35}) 45%,rgba(${rgb},0))"></div>`,
  });
}

// 4. Layer stack: five translucent glass planes in perspective, connected by evidence lines.
{
  const layers = [
    ['Interface', '34,211,238'], ['APIs & routes', '124,92,255'], ['Services & logic', '165,148,255'],
    ['Data & schemas', '45,212,191'], ['Build, config & CI', '245,184,65'],
  ];
  let planes = '';
  layers.forEach(([, rgb], i) => {
    planes += `<div class="pl" style="transform:translateZ(${(4 - i) * 120}px);
      background:linear-gradient(135deg,rgba(${rgb},.30),rgba(${rgb},.06));border:2px solid rgba(${rgb},.75);
      box-shadow:0 0 60px rgba(${rgb},.35), inset 0 0 50px rgba(${rgb},.18)">
      <div class="grid" style="background-image:linear-gradient(rgba(${rgb},.25) 1px,transparent 1px),linear-gradient(90deg,rgba(${rgb},.25) 1px,transparent 1px)"></div>
      ${[[0.22, 0.3], [0.5, 0.62], [0.74, 0.28], [0.34, 0.74], [0.8, 0.7]].map(([x, y]) => `<b style="left:${x * 100}%;top:${y * 100}%;background:rgb(${rgb});box-shadow:0 0 14px rgb(${rgb})"></b>`).join('')}
    </div>`;
  });
  // vertical beams through the stack
  const beams = [[0.22, 0.3], [0.5, 0.62], [0.8, 0.7]].map(([x, y], k) => `<div class="beam" style="left:${x * 100}%;top:${y * 100}%;
     background:linear-gradient(to top,rgba(34,211,238,.0),rgba(34,211,238,.85) 20%,rgba(124,92,255,.85) 80%,rgba(124,92,255,0));${k === 1 ? 'opacity:.6' : ''}"></div>`).join('');
  scenes.push({
    name: 'layers3d.png', w: 1100, h: 1100, transparent: true,
    html: `<style>.st{position:absolute;left:250px;top:470px;width:600px;height:440px;transform-style:preserve-3d;transform:rotateX(58deg) rotateZ(-38deg)}
      .pl{position:absolute;inset:0;border-radius:26px;transform-style:preserve-3d}
      .grid{position:absolute;inset:0;border-radius:26px;background-size:40px 40px;opacity:.55}
      .pl b{position:absolute;width:16px;height:16px;border-radius:50%;margin:-8px}
      .beam{position:absolute;width:4px;height:520px;margin-left:-2px;transform-origin:top;transform:rotateX(90deg);filter:blur(.4px)}</style>
      <div style="position:relative;width:1100px;height:1100px;perspective:2600px"><div class="st">${planes}${beams}</div></div>`,
  });
}

// 5. Product screens: framed (flat) and tilted in perspective with light. Screens are unaltered crops.
const frame = (img, w, tilt, label) => {
  const tf = tilt || 'none';
  return `<div style="padding:110px;display:inline-block;perspective:2800px">
    <div id="f" style="width:${w}px;transform:${tf};transform-style:preserve-3d;border-radius:18px;overflow:hidden;background:#0b0f22;
      border:1.5px solid rgba(165,148,255,.45);box-shadow:0 50px 110px rgba(0,0,0,.65),0 0 90px rgba(124,92,255,.28)">
      <div style="height:42px;display:flex;align-items:center;gap:10px;padding:0 18px;background:linear-gradient(#141a38,#0f1430);border-bottom:1px solid rgba(165,148,255,.25)">
        <i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i>
        <span style="margin-left:16px;font:500 17px Inter;color:#b9c1dd;letter-spacing:.2px">${label}</span></div>
      <img src="${dataUri(img)}" style="display:block;width:100%">
    </div></div>`;
};
const screens = [
  ['crop-flow.png', 'Flows · Immich (open source) · route to repository', 'flow'],
  ['crop-overview.png', 'Overview · Immich · coverage report', 'overview'],
  ['crop-er.png', 'Diagrams · Immich · ER diagram from migrations', 'er'],
  ['crop-petclinic-flow.png', 'Flows · Spring PetClinic (Java) · route to table', 'petclinic'],
  ['crop-hairball.png', 'Dependencies · Immich server · 250 most connected files', 'hairball'],
  ['crop-repos.png', 'Repositories · local only · 127.0.0.1', 'repos'],
  ['brain-method.png', 'Architecture brain · Immich · one method and its evidence', 'brainmethod'],
];
for (const [img, label, key] of screens) {
  if (!fs.existsSync(A(img))) { console.warn('missing', img); continue; }
  scenes.push({ name: `screen-${key}.png`, transparent: true, sel: 'body > div', html: frame(img, 1500, null, label) });
  scenes.push({ name: `tilt-l-${key}.png`, transparent: true, sel: 'body > div', html: frame(img, 1500, 'rotateY(16deg) rotateX(5deg)', label) });
  scenes.push({ name: `tilt-r-${key}.png`, transparent: true, sel: 'body > div', html: frame(img, 1500, 'rotateY(-16deg) rotateX(5deg)', label) });
}

(async () => {
  const only = process.argv[2];
  const b = await chromium.launch();
  for (const s of scenes) {
    if (only && !s.name.includes(only)) continue;
    const p = await b.newPage({ viewport: { width: s.w || 2000, height: s.h || 1400 }, deviceScaleFactor: 2 });
    await p.setContent(`<!doctype html><html><head><style>${FONTS}html,body{background:${s.transparent ? 'transparent' : c('bg0')}}</style></head><body>${s.html}</body></html>`);
    await p.waitForTimeout(300);
    const opts = { path: OUT(s.name), omitBackground: !!s.transparent };
    if (s.type === 'jpeg') { opts.type = 'jpeg'; opts.quality = 90; }
    if (s.sel) await p.locator(s.sel).screenshot(opts); else await p.screenshot(opts);
    await p.close();
    console.log('wrote', s.name);
  }
  await b.close();
})();
