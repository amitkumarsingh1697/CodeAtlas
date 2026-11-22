// Builds CodeAtlas_Client_Pitch_Deck.pptx with pptxgenjs, then writes build/animations.json for
// post-process.py, which adds Morph transitions, entrance animations and video autoplay.
// Run from the deck folder: node src/build-deck.js
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const React = require('react');
const RDS = require('react-dom/server');
const lu = require('react-icons/lu');
const T = require('./tokens');
const SCRIPT = require('./script');

const ROOT = path.resolve(__dirname, '..');
const IMG = (f) => path.join(ROOT, 'build', 'img', f);
const OPT = (f) => path.join(ROOT, 'build', 'opt', f);
fs.mkdirSync(path.join(ROOT, 'build', 'opt'), { recursive: true });
const C = T.color;
const F = T.font;
const W = 13.333, H = 7.5, MX = 0.65;

// ---------- asset preparation ----------
const meta = {};
async function prep(name, maxW) {
  const out = OPT(name.replace(/\.(png|jpg)$/, '.png'));
  const isJpg = name.endsWith('.jpg');
  const target = isJpg ? OPT(name) : out;
  if (!fs.existsSync(target)) {
    let img = sharp(IMG(name));
    if (!isJpg) img = img.trim({ threshold: 1 });
    img = img.resize({ width: maxW, withoutEnlargement: true });
    await (isJpg ? img.jpeg({ quality: 88 }) : img.png({ compressionLevel: 9, palette: false })).toFile(target);
  }
  const m = await sharp(target).metadata();
  meta[name] = { file: target, ar: m.width / m.height };
  return meta[name];
}
async function icon(name, color, px = 256) {
  const Comp = lu[name];
  if (!Comp) throw new Error('icon ' + name);
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.75 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ---------- deck helpers ----------
const ANIM = []; // per slide: [{name, fx, delay, dur}]
let S = null; // current slide
let sIdx = -1;
const objNames = new Set();
function newSlide(pres, master, section) {
  S = pres.addSlide({ masterName: master, sectionTitle: section });
  sIdx++;
  ANIM[sIdx] = [];
  objNames.clear();
  const sc = SCRIPT[sIdx];
  const notes = [
    `OBJECTIVE: ${sc.objective}`,
    `KEY MESSAGE: ${sc.key}`,
    '',
    sc.notes,
    '',
    'TALKING POINTS:',
    ...sc.points.map((p) => `- ${p}`),
    '',
    `TRANSITION: ${sc.transition}`,
    `TIME: about ${sc.minutes} min`,
  ].join('\n');
  S.addNotes(notes);
  return S;
}
function nm(name) {
  if (objNames.has(name)) throw new Error(`duplicate object name on slide ${sIdx + 1}: ${name}`);
  objNames.add(name);
  return name;
}
function anim(name, fx = 'rise', delay = 0, dur) {
  ANIM[sIdx].push({ name, fx, delay, dur });
}
function text(t, o) {
  const name = nm(o.name);
  S.addText(t, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fontFace: o.font || F.body, fontSize: o.size || 14, color: o.color || C.text,
    bold: !!o.bold, italic: !!o.italic, align: o.align || 'left', valign: o.valign || 'top',
    margin: o.margin ?? 0, isTextBox: true, objectName: name,
    charSpacing: o.charSpacing, lineSpacingMultiple: o.lsm || 1.08, paraSpaceAfter: o.psa,
    fit: 'none', autoFit: false, wrap: true,
  });
  if (o.fx) anim(name, o.fx, o.delay || 0, o.dur);
}
function shape(type, o) {
  const name = nm(o.name);
  const opt = {
    x: o.x, y: o.y, w: o.w, h: o.h, objectName: name,
    fill: o.fill ? { color: o.fill, transparency: o.ft ?? 0 } : { type: 'none' },
    line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash || 'solid', transparency: o.lt ?? 0 } : { type: 'none' },
  };
  if (o.radius) opt.rectRadius = o.radius;
  if (o.shadow) opt.shadow = { type: 'outer', blur: 18, offset: 6, angle: 90, color: '000000', opacity: 0.45 };
  if (o.flipH) opt.flipH = true;
  if (o.rotate) opt.rotate = o.rotate;
  S.addShape(type, opt);
  if (o.fx) anim(name, o.fx, o.delay || 0, o.dur);
}
function image(file, o) {
  const name = nm(o.name);
  const opt = { x: o.x, y: o.y, w: o.w, h: o.h, objectName: name, altText: o.alt || '' };
  if (file.startsWith('image/')) opt.data = file; else opt.path = file;
  if (o.transparency) opt.transparency = o.transparency;
  S.addImage(opt);
  if (o.fx) anim(name, o.fx, o.delay || 0, o.dur);
}
// Place an image by width, keeping its aspect ratio. Returns its height.
function imageW(key, o) {
  const m = meta[key];
  const h = o.w / m.ar;
  image(m.file, { ...o, h });
  return h;
}
function imageH(key, o) {
  const m = meta[key];
  const w = o.h * m.ar;
  image(m.file, { ...o, w });
  return w;
}
// Ambient glows: same names on every slide so Morph drifts them between positions.
function glows(v, c) {
  image(meta['glow-violet.png'].file, { name: '!!glowV', x: v[0], y: v[1], w: v[2] || 7, h: v[2] || 7, alt: 'Decorative light' });
  image(meta['glow-cyan.png'].file, { name: '!!glowC', x: c[0], y: c[1], w: c[2] || 6, h: c[2] || 6, alt: 'Decorative light' });
}
function kicker(num, label) {
  text(`${num}  ·  ${label}`.toUpperCase(), { name: 'Kicker', x: MX, y: 0.46, w: 9, h: 0.3, size: 11, color: C.cyan, bold: true, charSpacing: 3, fx: 'fade', delay: 0 });
}
function title(t) {
  S.addText(t, { placeholder: 'title' });
  anim('Title', 'rise', 120);
}
function card(o) {
  shape('roundRect', { fill: C.surface, ft: o.ft ?? 8, line: o.line || C.stroke, lw: 1, radius: 0.14, shadow: true, ...o });
}
function iconDot(data, o) {
  shape('ellipse', { name: o.name + ' bg', x: o.x, y: o.y, w: o.d, h: o.d, fill: o.bg || C.violet, ft: o.ft ?? 78, line: o.ring || C.violetLight, lw: 1, lt: 40, fx: o.fx, delay: o.delay });
  const p = o.d * 0.26;
  image(data, { name: o.name, x: o.x + p, y: o.y + p, w: o.d - 2 * p, h: o.d - 2 * p, alt: o.alt || '', fx: o.fx, delay: o.delay });
}
function tag(label, o) {
  shape('roundRect', { name: o.name + ' box', x: o.x, y: o.y, w: o.w, h: 0.3, fill: C.amber, ft: 85, line: C.amber, lw: 0.75, radius: 0.15, fx: o.fx, delay: o.delay });
  text(label.toUpperCase(), { name: o.name, x: o.x, y: o.y, w: o.w, h: 0.3, size: 10, bold: true, color: C.amber, align: 'center', valign: 'middle', charSpacing: 2, fx: o.fx, delay: o.delay });
}
// Evidence legend line (observed solid cyan, inferred dashed amber, unknown dotted muted)
function evLine(kind, o) {
  const map = { observed: [C.cyan, 'solid'], inferred: [C.amber, 'dash'], unknown: [C.muted, 'sysDot'] };
  const [col, dash] = map[kind];
  shape('line', { name: o.name, x: o.x, y: o.y, w: o.w, h: 0, line: col, lw: o.lw || 2.5, dash, fx: o.fx, delay: o.delay });
}

(async () => {
  // Prepare raster assets
  await prep('bg-hero.jpg', 2400);
  await prep('bg-main.jpg', 2400);
  await prep('glow-violet.png', 700);
  await prep('glow-cyan.png', 700);
  await prep('layers3d.png', 1600);
  await prep('brain-poster.jpg', 1920);
  for (const k of ['flow', 'overview', 'er', 'petclinic', 'hairball', 'repos', 'brainmethod']) {
    await prep(`screen-${k}.png`, 2600);
    await prep(`tilt-l-${k}.png`, 2600);
    await prep(`tilt-r-${k}.png`, 2600);
  }
  // Method panel crop (real screenshot), framed plainly
  fs.copyFileSync(path.join(ROOT, 'assets', 'crop-method-panel.png'), IMG('crop-method-panel.png'));
  await prep('crop-method-panel.png', 1400);
  // A second brain angle for the reveal slide: a frame from the middle of the loop
  if (!fs.existsSync(IMG('brain-alt.jpg'))) fs.copyFileSync(path.join(ROOT, 'qa', 'brain-mid.jpg'), IMG('brain-alt.jpg'));
  await prep('brain-alt.jpg', 1920);

  const I = {};
  const iconList = {
    layers: 'LuLayers', users: 'LuUsers', shield: 'LuShieldCheck', rocket: 'LuRocket', history: 'LuHistory', zap: 'LuZap',
    lock: 'LuLock', search: 'LuSearch', branch: 'LuGitBranch', db: 'LuDatabase', network: 'LuNetwork', route: 'LuRoute',
    chat: 'LuMessageSquare', target: 'LuTarget', file: 'LuFileText', scale: 'LuScale', eye: 'LuEye', help: 'LuCircleHelp',
    folder: 'LuFolderGit2', cpu: 'LuCpu', compass: 'LuCompass', list: 'LuListChecks', brief: 'LuBriefcase', building: 'LuBuilding2',
    grad: 'LuGraduationCap', workflow: 'LuWorkflow', fsearch: 'LuFileSearch', badge: 'LuBadgeCheck', code: 'LuCode', server: 'LuServer',
    monitor: 'LuMonitor', terminal: 'LuTerminal', box: 'LuBox', wifioff: 'LuWifiOff', eyeoff: 'LuEyeOff', key: 'LuKeyRound',
    scan: 'LuScanSearch', hand: 'LuHandshake', cal: 'LuCalendarCheck', map: 'LuMap', alert: 'LuTriangleAlert', clock: 'LuClock',
    coins: 'LuCoins', usersearch: 'LuUserSearch', pkg: 'LuPackage', compare: 'LuGitCompare', bot: 'LuBot', json: 'LuFileJson',
    globe: 'LuGlobe', book: 'LuBookOpen', check: 'LuCheck', x: 'LuX', arrow: 'LuArrowRight', mail: 'LuMail', phone: 'LuPhone', brain: 'LuBrain',
  };
  for (const [k, n] of Object.entries(iconList)) {
    I[k] = await icon(n, C.cyanSoft);
    I[k + 'V'] = await icon(n, C.violetLight);
    I[k + 'A'] = await icon(n, C.amber);
    I[k + 'M'] = await icon(n, C.muted);
    I[k + 'W'] = await icon(n, C.text);
  }
  // Brand mark: three linked nodes in a ring (working mark; the product name is not yet cleared)
  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${C.violet}"/><stop offset="1" stop-color="#${C.cyan}"/></linearGradient></defs>
    <circle cx="32" cy="32" r="29" fill="none" stroke="url(#g)" stroke-width="3.2"/>
    <path d="M32 15 L17 43 L47 43 Z" fill="none" stroke="url(#g)" stroke-width="3.2" stroke-linejoin="round"/>
    <circle cx="32" cy="15" r="5" fill="#${C.cyan}"/><circle cx="17" cy="43" r="5" fill="#${C.violet}"/><circle cx="47" cy="43" r="5" fill="#${C.violetLight}"/></svg>`;
  const MARK = 'image/png;base64,' + (await sharp(Buffer.from(markSvg)).png().toBuffer()).toString('base64');
  fs.writeFileSync(OPT('brand-mark.png'), await sharp(Buffer.from(markSvg)).png().toBuffer());

  // ---------- presentation ----------
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'CodeAtlas: Client Pitch Deck';
  pres.subject = 'Local-first software architecture intelligence: Architecture Intelligence Assessment';
  pres.author = 'CodeAtlas';
  pres.company = 'CodeAtlas';
  pres.theme = { headFontFace: F.display, bodyFontFace: F.body };

  const titlePh = (x, y, w, h, size) => ({
    placeholder: {
      options: { name: 'title', type: 'title', x, y, w, h, fontFace: F.display, fontSize: size, color: C.text, valign: 'top', align: 'left', margin: 0, lineSpacingMultiple: 0.98 },
      text: '',
    },
  });
  pres.defineSlideMaster({
    title: 'MAIN',
    background: { path: meta['bg-main.jpg'].file },
    objects: [
      titlePh(MX, 0.82, 12.0, 1.2, 32),
      { text: { text: 'CodeAtlas  ·  Architecture Intelligence Assessment', options: { x: MX, y: 7.02, w: 6, h: 0.25, fontFace: F.body, fontSize: 10, color: C.muted, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.02, w: 0.5, h: 0.25, fontFace: F.body, fontSize: 10, color: C.muted, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'HERO_COVER',
    background: { path: meta['bg-hero.jpg'].file },
    objects: [titlePh(MX, 2.45, 7.0, 2.75, 48)],
  });
  pres.defineSlideMaster({
    title: 'HERO_STATEMENT',
    background: { path: meta['bg-hero.jpg'].file },
    objects: [titlePh(MX, 1.05, 6.6, 2.2, 40)],
  });
  pres.defineSlideMaster({
    title: 'HERO_CLOSE',
    background: { path: meta['bg-hero.jpg'].file },
    objects: [titlePh(MX, 2.45, 7.0, 2.2, 40)],
  });

  // ============ ACT 1: THE OPPORTUNITY ============
  pres.addSection({ title: 'Act 1 · The opportunity' });

  // 1. Cover
  newSlide(pres, 'HERO_COVER', 'Act 1 · The opportunity');
  S.addMedia({ type: 'video', path: IMG('brain-loop.mp4'), x: 0, y: 0, w: W, h: H, objectName: nm('Hero brain video'),
    cover: 'data:image/jpeg;base64,' + fs.readFileSync(meta['brain-poster.jpg'].file).toString('base64') });
  glows([-9, -9, 7], [14, 9, 6]); // parked off-slide; they drift in on the next slide
  image(MARK, { name: '!!brand', x: MX, y: 0.55, w: 0.5, h: 0.5, alt: 'CodeAtlas mark' });
  text('CodeAtlas', { name: '!!brandName', x: MX + 0.62, y: 0.6, w: 3, h: 0.42, font: F.display, size: 20, valign: 'middle' });
  text('LOCAL-FIRST SOFTWARE ARCHITECTURE INTELLIGENCE', { name: 'Kicker', x: MX, y: 2.0, w: 7, h: 0.3, size: 12, bold: true, color: C.cyan, charSpacing: 3, fx: 'fade', delay: 300 });
  S.addText([{ text: 'Understand complex', options: { breakLine: true } }, { text: 'software before', options: { breakLine: true } }, { text: 'you change it' }], { placeholder: 'title' });
  anim('Title', 'rise', 550, 900);
  text('CodeAtlas maps your architecture, dependencies and data on your own machine, and shows the evidence behind every connection.',
    { name: 'Subtitle', x: MX, y: 5.3, w: 6.0, h: 0.85, size: 17, color: C.text2, lsm: 1.15, fx: 'rise', delay: 1000 });
  text('Prepared for [Client name]  ·  [Month Year]', { name: 'Prepared for', x: MX, y: 6.62, w: 6, h: 0.3, size: 12, color: C.muted, fx: 'fade', delay: 1400 });
  text('Live render: the CodeAtlas architecture brain of the open-source Immich repository (3,656 files). Lobe placement is a navigation aid.',
    { name: 'Video caption', x: 7.4, y: 6.95, w: 5.3, h: 0.4, size: 10, color: C.muted, align: 'right', fx: 'fade', delay: 1800 });

  // 2. Executive summary
  newSlide(pres, 'MAIN', 'Act 1 · The opportunity');
  glows([7.6, -3.2, 7.5], [-2.5, 4.2, 6]);
  kicker('01', 'Executive summary');
  title('CodeAtlas turns an unfamiliar codebase into a map you can defend');
  const ex = [
    ['What it is', 'Local-first code intelligence', 'Reads a repository on your machine and maps modules, APIs, calls and database tables, each link with its evidence.', 'scan'],
    ['Who it serves', 'Teams that inherit systems', 'Modernization consultancies, CTOs and engineering leads who must change code they did not write.', 'users'],
    ['Why it matters', 'Decisions on proof, not memory', 'Every relationship is labelled observed, inferred or unknown, so gaps show up before they become surprises.', 'eye'],
    ['How to start', 'One bounded assessment', 'We analyse one agreed repository in your environment and walk your team through the findings.', 'target'],
  ];
  ex.forEach(([lab, head, body, ic], i) => {
    const x = MX + i * 3.06, y = 2.25, w = 2.86, h = 3.5, d = 300 + i * 160;
    card({ name: `Card ${i + 1}`, x, y, w, h, fx: 'rise', delay: d });
    iconDot(I[ic], { name: `Card ${i + 1} icon`, x: x + 0.3, y: y + 0.32, d: 0.62, fx: 'rise', delay: d });
    text(lab.toUpperCase(), { name: `Card ${i + 1} label`, x: x + 0.3, y: y + 1.12, w: w - 0.6, h: 0.25, size: 10, bold: true, color: C.violetLight, charSpacing: 2, fx: 'rise', delay: d });
    text(head, { name: `Card ${i + 1} head`, x: x + 0.3, y: y + 1.4, w: w - 0.6, h: 0.62, font: F.sub, size: 17, fx: 'rise', delay: d });
    text(body, { name: `Card ${i + 1} body`, x: x + 0.3, y: y + 2.06, w: w - 0.55, h: 1.2, size: 13.5, color: C.text2, lsm: 1.12, fx: 'rise', delay: d });
  });
  card({ name: 'Bottom line', x: MX, y: 6.0, w: 12.03, h: 0.78, fill: C.violet, ft: 82, line: C.violet, fx: 'fade', delay: 1100 });
  image(I.lockW, { name: 'Bottom line icon', x: MX + 0.3, y: 6.19, w: 0.4, h: 0.4, fx: 'fade', delay: 1100 });
  text([{ text: 'Your source code stays on your machine. ', options: { bold: true, color: C.text } }, { text: 'Indexing runs with no network connection, and an automated test checks this on every change.', options: { color: C.text2 } }],
    { name: 'Bottom line text', x: MX + 0.9, y: 6.0, w: 10.9, h: 0.78, size: 15, valign: 'middle', fx: 'fade', delay: 1100 });

  // 3. The world today
  newSlide(pres, 'MAIN', 'Act 1 · The opportunity');
  glows([5.2, 1.0, 8], [9.5, 3.5, 6]);
  kicker('02', 'The world today');
  title('Every modernization starts with a system nobody fully remembers');
  const world = [
    ['history', 'Systems outlive their authors', 'Teams inherit code spread across frameworks, languages and years of change. Documentation drifts from what actually runs.'],
    ['zap', 'Change is accelerating', 'AI coding tools make writing changes faster. Understanding what a change touches is still manual work.'],
    ['lock', 'Code often cannot leave the building', 'Client contracts and security policies can rule out uploading source code to a hosted service.'],
  ];
  world.forEach(([ic, head, body], i) => {
    const y = 2.35 + i * 1.45, d = 300 + i * 200;
    iconDot(I[ic], { name: `Point ${i + 1} icon`, x: MX, y, d: 0.7, fx: 'rise', delay: d });
    text(head, { name: `Point ${i + 1} head`, x: MX + 0.95, y: y - 0.02, w: 5.0, h: 0.4, font: F.sub, size: 19, fx: 'rise', delay: d });
    text(body, { name: `Point ${i + 1} body`, x: MX + 0.95, y: y + 0.42, w: 5.0, h: 0.85, size: 14.5, color: C.text2, lsm: 1.12, fx: 'rise', delay: d });
  });
  imageW('layers3d.png', { name: 'Layer stack', x: 6.75, y: 2.0, w: 4.5, alt: 'Five stacked layers of a software system: interface, APIs, services, data, build and CI', fx: 'zoom', delay: 200, dur: 1100 });
  const layerLabels = ['Interface', 'APIs & routes', 'Services & logic', 'Data & schemas', 'Build, config & CI'];
  const layerCol = [C.cyan, C.violet, C.violetLight, '2DD4BF', C.amber];
  layerLabels.forEach((l, i) => {
    text(l, { name: `Layer ${i + 1} label`, x: 11.0, y: 2.33 + i * 0.63, w: 1.75, h: 0.3, size: 12, bold: true, color: layerCol[i], fx: 'fade', delay: 900 + i * 120 });
  });
  text('Knowledge of how these layers connect usually lives in a few people\'s heads.', { name: 'Layer caption', x: 7.35, y: 6.45, w: 5.4, h: 0.45, size: 12, italic: true, color: C.muted, align: 'right', fx: 'fade', delay: 1600 });

  // 4. The problem
  newSlide(pres, 'MAIN', 'Act 1 · The opportunity');
  glows([-1.5, 2.2, 8], [8.5, -2.5, 6]);
  kicker('03', 'The problem');
  title('Discovery is slow, manual and hard to prove');
  const hb = imageH('screen-hairball.png', { name: 'Hairball screen', x: 0.35, y: 1.95, h: 4.75, alt: 'CodeAtlas dependency view of the Immich server module: the 250 most connected files', fx: 'zoom', delay: 250, dur: 1000 });
  text('Real CodeAtlas output: the 250 most connected files of one module (Immich server, 765 files).', { name: 'Hairball caption', x: 0.65, y: 6.5, w: hb - 0.6, h: 0.3, size: 10.5, color: C.muted, fx: 'fade', delay: 900 });
  const pains = [
    ['Senior engineers become archaeologists', 'The people you need on delivery spend their time reading code to rebuild a mental map.'],
    ['Surprises arrive late', 'Hidden dependencies surface during the migration, after the estimate was agreed.'],
    ['Findings are hard to defend', 'Whiteboard diagrams and AI summaries rarely show where a claim came from or what was not checked.'],
    ['Upload-based tools are off the table', 'Confidentiality rules out tools that need the code on someone else\'s server.'],
  ];
  const px = 0.35 + hb + 0.15;
  pains.forEach(([head, body], i) => {
    const y = 2.1 + i * 1.18, d = 600 + i * 180;
    text(String(i + 1).padStart(2, '0'), { name: `Pain ${i + 1} num`, x: px, y, w: 0.6, h: 0.45, font: F.display, size: 20, color: C.violetLight, fx: 'rise', delay: d });
    text(head, { name: `Pain ${i + 1} head`, x: px + 0.65, y: y + 0.02, w: 12.7 - px - 0.65, h: 0.38, font: F.sub, size: 17, fx: 'rise', delay: d });
    text(body, { name: `Pain ${i + 1} body`, x: px + 0.65, y: y + 0.42, w: 12.7 - px - 0.65, h: 0.7, size: 13.5, color: C.text2, lsm: 1.1, fx: 'rise', delay: d });
  });

  // 5. Cost of the problem
  newSlide(pres, 'MAIN', 'Act 1 · The opportunity');
  glows([6.5, 3.2, 8], [-2.5, -2.0, 6]);
  kicker('04', 'The cost of the problem');
  title('The cost of not knowing shows up in effort, estimates and risk');
  tag('Illustrative · use your numbers', { name: 'Illustrative tag', x: MX, y: 2.12, w: 3.75, fx: 'fade', delay: 200 });
  const eq = [['3', 'engineers on discovery'], ['15', 'working days'], ['₹15,000', 'loaded cost per engineer-day']];
  let ex2 = MX;
  eq.forEach(([v, l], i) => {
    const w = i === 2 ? 2.35 : 1.6, d = 400 + i * 220;
    card({ name: `Factor ${i + 1}`, x: ex2, y: 2.65, w, h: 1.55, fx: 'rise', delay: d });
    text(v, { name: `Factor ${i + 1} value`, x: ex2 + 0.15, y: 2.78, w: w - 0.3, h: 0.7, font: F.display, size: i === 2 ? 28 : 34, color: C.text, align: 'center', valign: 'middle', fx: 'rise', delay: d });
    text(l, { name: `Factor ${i + 1} label`, x: ex2 + 0.12, y: 3.5, w: w - 0.24, h: 0.6, size: 12, color: C.text2, align: 'center', fx: 'rise', delay: d });
    ex2 += w;
    if (i < 2) { text('×', { name: `Times ${i + 1}`, x: ex2, y: 3.0, w: 0.4, h: 0.6, font: F.display, size: 26, color: C.muted, align: 'center', fx: 'fade', delay: d + 100 }); ex2 += 0.4; }
  });
  text('=', { name: 'Equals', x: MX, y: 4.42, w: 0.5, h: 0.6, font: F.display, size: 30, color: C.muted, fx: 'fade', delay: 1100 });
  text('₹6.75 lakh', { name: 'Result INR', x: MX + 0.55, y: 4.3, w: 4.0, h: 0.95, font: F.display, size: 48, color: C.amber, fx: 'zoom', delay: 1250 });
  text('for one discovery exercise. With a USD 600 day rate, the same effort is USD 27,000.', { name: 'Result note', x: MX + 0.55, y: 5.28, w: 6.0, h: 0.6, size: 14, color: C.text2, fx: 'fade', delay: 1450 });
  text('Example values are assumptions for discussion, not measured client data.', { name: 'Assumption note', x: MX, y: 6.45, w: 6.4, h: 0.3, size: 10.5, italic: true, color: C.muted, fx: 'fade', delay: 1600 });
  card({ name: 'Hidden costs card', x: 7.55, y: 2.12, w: 5.13, h: 4.6, fx: 'rise', delay: 700 });
  text('THE COSTS THAT DO NOT SHOW UP ON A TIMESHEET', { name: 'Hidden head', x: 7.9, y: 2.42, w: 4.6, h: 0.5, size: 11, bold: true, color: C.violetLight, charSpacing: 2, fx: 'rise', delay: 700 });
  const hidden = [
    ['alert', 'Re-estimates', 'when a dependency surfaces mid-migration.'],
    ['usersearch', 'Senior capacity', 'taken from delivery to rebuild knowledge.'],
    ['scale', 'Risk accepted without evidence', 'because nobody can show what was checked.'],
  ];
  hidden.forEach(([ic, head, body], i) => {
    const y = 3.15 + i * 1.12, d = 900 + i * 180;
    iconDot(I[ic + 'A'], { name: `Hidden ${i + 1} icon`, x: 7.9, y, d: 0.62, bg: C.amber, ring: C.amber, ft: 85, fx: 'rise', delay: d });
    text(head, { name: `Hidden ${i + 1} head`, x: 8.75, y: y - 0.02, w: 3.75, h: 0.36, font: F.sub, size: 16, fx: 'rise', delay: d });
    text(body, { name: `Hidden ${i + 1} body`, x: 8.75, y: y + 0.34, w: 3.75, h: 0.55, size: 13.5, color: C.text2, fx: 'rise', delay: d });
  });

  // ============ ACT 2: OUR SOLUTION ============
  pres.addSection({ title: 'Act 2 · Our solution' });

  // 6. Introducing CodeAtlas
  newSlide(pres, 'HERO_STATEMENT', 'Act 2 · Our solution');
  image(meta['brain-alt.jpg'].file, { name: 'Brain reveal', x: 0, y: 0, w: W, h: H, alt: 'CodeAtlas architecture brain of the Immich repository, seen from another angle', fx: 'fade', delay: 0, dur: 1400 });
  glows([-3.5, -3.0, 8], [10.5, 5.2, 5]);
  text('INTRODUCING CODEATLAS', { name: 'Kicker', x: MX, y: 0.6, w: 6, h: 0.3, size: 12, bold: true, color: C.cyan, charSpacing: 3, fx: 'fade', delay: 300 });
  S.addText('A map of your system, with the evidence behind every line', { placeholder: 'title' });
  anim('Title', 'rise', 500, 900);
  const promise = [
    ['Understand what exists', 'Every file, its language and whether it was analysed, and why.'],
    ['See how it connects', 'Routes, calls, tables and dependencies, traced through the code.'],
    ['Know what is not covered', 'Gaps and unresolved links are listed, never hidden.'],
  ];
  promise.forEach(([h, b], i) => {
    const y = 3.55 + i * 0.98, d = 1000 + i * 200;
    shape('ellipse', { name: `Promise ${i + 1} dot`, x: MX, y: y + 0.1, w: 0.18, h: 0.18, fill: [C.cyan, C.violetLight, C.amber][i], fx: 'zoom', delay: d });
    text(h, { name: `Promise ${i + 1} head`, x: MX + 0.4, y, w: 5.6, h: 0.4, font: F.sub, size: 19, fx: 'rise', delay: d });
    text(b, { name: `Promise ${i + 1} body`, x: MX + 0.4, y: y + 0.42, w: 5.0, h: 0.4, size: 14, color: C.text2, fx: 'rise', delay: d });
  });
  text('The brain view is a navigation aid: lobe placement is inferred from paths and imports. Assessments use the 2D views as the primary architecture views.',
    { name: 'Brain caption', x: 7.3, y: 6.85, w: 5.4, h: 0.45, size: 10, color: C.muted, align: 'right', fx: 'fade', delay: 1800 });

  // 7. How it works
  newSlide(pres, 'MAIN', 'Act 2 · Our solution');
  glows([3.5, -3.8, 7.5], [9.8, 3.8, 6]);
  kicker('05', 'How it works');
  title('Four steps from repository to decision');
  const steps = [
    ['folder', 'Point it at a repository', 'A local folder or an authorised clone. You set exclusions; files that look like credentials are never read.', 'Scan policy'],
    ['cpu', 'Analyse locally', 'Compilers and parsers read 70+ languages, SQL, ORM models, migrations, build and configuration files.', 'Local index (SQLite)'],
    ['compass', 'Explore with evidence', 'Routes, calls, tables and dependencies, each labelled observed, inferred or unknown, with file and line.', 'Web explorer · CLI · offline map'],
    ['target', 'Decide and deliver', 'Coverage, gaps and impact feed an assessment your team and your clients can act on.', 'Assessment data model + findings'],
  ];
  evLine('observed', { name: 'Step line', x: MX + 0.6, y: 2.72, w: 9.4, lw: 2, fx: 'wipe', delay: 250, dur: 1200 });
  steps.forEach(([ic, head, body, out], i) => {
    const x = MX + i * 3.06, d = 350 + i * 260;
    iconDot(I[ic], { name: `Step ${i + 1} icon`, x: x + 0.12, y: 2.32, d: 0.8, ft: 30, bg: C.surface2, ring: C.violetLight, fx: 'zoom', delay: d });
    text(`STEP ${i + 1}`, { name: `Step ${i + 1} label`, x, y: 3.35, w: 2.8, h: 0.25, size: 10.5, bold: true, color: C.violetLight, charSpacing: 2, fx: 'rise', delay: d + 80 });
    text(head, { name: `Step ${i + 1} head`, x, y: 3.62, w: 2.85, h: 0.75, font: F.sub, size: 18, lsm: 1.0, fx: 'rise', delay: d + 80 });
    text(body, { name: `Step ${i + 1} body`, x, y: 4.28, w: 2.8, h: 1.35, size: 13.5, color: C.text2, lsm: 1.12, fx: 'rise', delay: d + 80 });
    shape('roundRect', { name: `Step ${i + 1} out box`, x, y: 5.8, w: 2.8, h: 0.42, fill: C.surface2, ft: 0, line: C.stroke, radius: 0.21, fx: 'rise', delay: d + 160 });
    text(out, { name: `Step ${i + 1} out`, x, y: 5.8, w: 2.8, h: 0.42, size: 11.5, color: C.cyanSoft, align: 'center', valign: 'middle', fx: 'rise', delay: d + 160 });
  });
  text([{ text: 'Measured: ', options: { bold: true, color: C.text } }, { text: 'Immich (3,656 files) indexed in 42 s, Spring PetClinic (132 files) in 1.4 s, 4-vCPU cloud machine, 22 Nov 2026. Single runs, not a guarantee.', options: { color: C.muted } }],
    { name: 'Measured note', x: MX, y: 6.45, w: 12, h: 0.3, size: 11, fx: 'fade', delay: 1600 });

  // 8. Product showcase
  newSlide(pres, 'MAIN', 'Act 2 · Our solution');
  glows([3.2, 2.4, 8], [9.6, -2.4, 6]);
  kicker('06', 'Product showcase');
  title('Real screens, real repository: what your team will use');
  imageW('tilt-l-overview.png', { name: 'Screen overview', x: 0.3, y: 2.0, w: 6.6, alt: 'CodeAtlas overview and coverage report for Immich', fx: 'rise', delay: 250, dur: 900 });
  imageW('tilt-r-er.png', { name: 'Screen ER', x: 6.45, y: 1.85, w: 6.6, alt: 'CodeAtlas ER diagram drawn from Immich migrations', fx: 'rise', delay: 450, dur: 900 });
  imageW('screen-brainmethod.png', { name: '!!screenFront', x: 3.55, y: 3.2, w: 6.0, alt: 'CodeAtlas architecture brain with the evidence panel for one method', fx: 'zoom', delay: 750, dur: 1000 });
  const chips = [['Coverage report', 0.75, 2.05], ['ER diagram from migrations', 9.05, 1.95], ['Brain with evidence panel', 9.75, 6.15]];
  chips.forEach(([l, x, y], i) => {
    shape('roundRect', { name: `Chip ${i + 1} box`, x, y, w: 2.75, h: 0.38, fill: C.bg1, ft: 10, line: C.cyan, lw: 1, radius: 0.19, fx: 'fade', delay: 1300 + i * 150 });
    text(l, { name: `Chip ${i + 1}`, x, y, w: 2.75, h: 0.38, size: 11.5, bold: true, color: C.cyanSoft, align: 'center', valign: 'middle', fx: 'fade', delay: 1300 + i * 150 });
  });
  text('CodeAtlas v0.1.0 on the open-source Immich repository (commit e5d6eb7), 22 Nov 2026. Cropped and framed, not edited.',
    { name: 'Showcase caption', x: MX, y: 6.05, w: 2.8, h: 0.85, size: 10, color: C.muted, align: 'left', fx: 'fade', delay: 1700 });

  // 9. Trace a request
  newSlide(pres, 'MAIN', 'Act 2 · Our solution');
  glows([-2.0, 1.5, 8], [9.0, 4.5, 6]);
  kicker('07', 'See it work');
  title('Follow one request from the API to the database, with proof at every step');
  const fh = imageW('screen-flow.png', { name: '!!screenFlow', x: 0.25, y: 1.95, w: 7.9, alt: 'CodeAtlas execution flow for GET /albums/:id in Immich', fx: 'zoom', delay: 200, dur: 1000 });
  const lg = [
    ['observed', 'Observed', 'The compiler or the source states it, e.g. the route decorator at album.controller.ts:62.'],
    ['inferred', 'Inferred', 'A named rule matched, such as a method name. The rule is shown, so it can be checked.'],
    ['unknown', 'Unknown', 'Seen but not resolved. Counted in coverage, never silently dropped.'],
  ];
  lg.forEach(([k, head, body], i) => {
    const y = 2.05 + i * 1.32, d = 800 + i * 220;
    evLine(k, { name: `Legend ${i + 1} line`, x: 8.6, y: y + 0.2, w: 0.7, lw: 3, fx: 'wipe', delay: d });
    text(head, { name: `Legend ${i + 1} head`, x: 9.45, y, w: 3.2, h: 0.4, font: F.sub, size: 17, color: [C.cyan, C.amber, C.text2][i], fx: 'rise', delay: d });
    text(body, { name: `Legend ${i + 1} body`, x: 8.6, y: y + 0.42, w: 4.1, h: 0.85, size: 12, color: C.text2, lsm: 1.08, fx: 'rise', delay: d });
  });
  card({ name: 'Java note', x: 8.6, y: 6.0, w: 4.1, h: 0.72, fill: C.violet, ft: 85, line: C.violet, fx: 'fade', delay: 1600 });
  text('Same view on Java/Spring: in PetClinic, POST /owners/{ownerId}/pets/new traces through to the owners table.', { name: 'Java note text', x: 8.75, y: 6.03, w: 3.85, h: 0.66, size: 11, color: C.text, valign: 'middle', fx: 'fade', delay: 1600 });

  // 10. Evidence model
  newSlide(pres, 'MAIN', 'Act 2 · Our solution');
  glows([7.5, 2.5, 8], [-2.5, -2.5, 6]);
  kicker('08', 'The evidence model');
  title('Every relationship tells you how it was found');
  const evs = [
    ['observed', 'Observed', '142,612', 'The compiler or the source states it: a resolved import, a type-checked call, a literal route decorator.', C.cyan],
    ['inferred', 'Inferred', '112,879', 'A named rule matched, such as a method name or a path pattern, and the link records which rule.', C.amber],
    ['unknown', 'Unknown', '1,790', 'Seen but not resolved, such as an import that points outside what was read. Counted and listed.', C.muted],
  ];
  evs.forEach(([k, head, num, body, col], i) => {
    const y = 2.15 + i * 1.45, d = 300 + i * 220;
    card({ name: `Ev ${i + 1} card`, x: MX, y, w: 7.55, h: 1.28, fx: 'rise', delay: d });
    evLine(k, { name: `Ev ${i + 1} line`, x: MX + 0.3, y: y + 0.3, w: 0.8, lw: 3.5, fx: 'wipe', delay: d + 100 });
    text(head, { name: `Ev ${i + 1} head`, x: MX + 0.3, y: y + 0.45, w: 2.2, h: 0.38, font: F.sub, size: 17, color: col, fx: 'rise', delay: d });
    text(num, { name: `Ev ${i + 1} num`, x: MX + 0.3, y: y + 0.78, w: 2.3, h: 0.45, font: F.display, size: 22, color: C.text, fx: 'rise', delay: d });
    text(body, { name: `Ev ${i + 1} body`, x: MX + 2.7, y: y + 0.18, w: 4.65, h: 0.95, size: 13.5, color: C.text2, valign: 'middle', lsm: 1.1, fx: 'rise', delay: d });
  });
  text([{ text: '257,281 relationships ', options: { bold: true, color: C.text } }, { text: 'in one run on Immich, every one labelled. 5,480 unresolved call sites are stored and listed, and the report says when a listing cap was reached. Counts, not accuracy figures.', options: { color: C.muted } }],
    { name: 'Evidence note', x: MX, y: 6.48, w: 7.6, h: 0.5, size: 11, fx: 'fade', delay: 1200 });
  imageH('crop-method-panel.png', { name: 'Method panel', x: 8.75, y: 1.95, h: 4.95, alt: 'Real CodeAtlas evidence panel for AlbumController.getAlbumInfo, with observed links and file:line', fx: 'zoom', delay: 700, dur: 1000 });

  // 11. Capabilities mapped to questions
  newSlide(pres, 'MAIN', 'Act 2 · Our solution');
  glows([2.0, -3.5, 7.5], [8.8, 3.0, 6.5]);
  kicker('09', 'Capabilities');
  title('Each capability answers a question your team already asks');
  const caps = [
    ['fsearch', 'What is in this repository?', 'Languages & files', 'Every file with its language, one of seven statuses and the reason. Coverage you can quote.'],
    ['route', 'Which code serves this API?', 'Routes & flows', 'HTTP routes traced to handlers, services and repositories. Immich: 315 routes mapped.'],
    ['db', 'Who reads or writes a table?', 'Database map', 'Tables from SQL, ORM models and migrations of 23 frameworks, linked to the code that uses them.'],
    ['network', 'What depends on what?', 'Dependencies & cycles', 'Module, file and package dependencies with cycle detection. Immich: 96 files in one import cycle.'],
    ['branch', 'What might this change affect?', 'Impact analysis', 'Upstream and downstream links grouped by evidence. An analysis aid, not a guarantee of blast radius.'],
    ['chat', 'Can I just ask?', 'Ask with citations', 'Answers cite numbered sources. AI uses a local model by default and can be switched off.'],
  ];
  caps.forEach(([ic, q, name, body], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * 4.06, y = 2.1 + row * 2.33, w = 3.88, h = 2.18, d = 300 + i * 140;
    card({ name: `Cap ${i + 1} card`, x, y, w, h, fx: 'rise', delay: d });
    iconDot(I[ic], { name: `Cap ${i + 1} icon`, x: x + 0.28, y: y + 0.28, d: 0.55, fx: 'rise', delay: d });
    text(name.toUpperCase(), { name: `Cap ${i + 1} name`, x: x + 1.0, y: y + 0.33, w: w - 1.2, h: 0.45, size: 10.5, bold: true, color: C.violetLight, charSpacing: 1.5, valign: 'middle', fx: 'rise', delay: d });
    text(q, { name: `Cap ${i + 1} q`, x: x + 0.28, y: y + 0.95, w: w - 0.4, h: 0.4, font: F.sub, size: 15, color: C.text, fx: 'rise', delay: d });
    text(body, { name: `Cap ${i + 1} body`, x: x + 0.28, y: y + 1.38, w: w - 0.5, h: 0.75, size: 12.5, color: C.text2, lsm: 1.08, fx: 'rise', delay: d });
  });

  // ============ ACT 3: USER TRANSFORMATION ============
  pres.addSection({ title: 'Act 3 · User transformation' });

  // 12. Before vs after
  newSlide(pres, 'MAIN', 'Act 3 · User transformation');
  glows([8.0, 1.0, 8], [-2.0, 3.5, 6]);
  kicker('10', 'Before and after');
  title('From manual archaeology to an evidence-backed map');
  const ba = [
    ['Read code file by file to find the structure', 'A first full map in minutes: 42 s to index Immich'],
    ['Redraw architecture diagrams on a whiteboard', 'Diagrams generated from the source'],
    ['Rely on whoever remembers how it works', 'Every link cites a file and a line'],
    ['Present findings without sources', 'Coverage and gaps stated up front'],
    ['Discover dependencies mid-migration', 'Ask "what reads this table?" before the change'],
  ];
  card({ name: 'Before card', x: MX, y: 1.95, w: 5.55, h: 4.45, fill: C.surface, ft: 35, line: C.stroke, fx: 'rise', delay: 250 });
  card({ name: 'After card', x: 7.13, y: 1.95, w: 5.55, h: 4.45, fill: C.violet, ft: 84, line: C.violetLight, fx: 'rise', delay: 600 });
  text('BEFORE', { name: 'Before label', x: MX + 0.35, y: 2.17, w: 3, h: 0.3, size: 12, bold: true, color: C.muted, charSpacing: 3, fx: 'rise', delay: 250 });
  text('WITH CODEATLAS', { name: 'After label', x: 7.48, y: 2.17, w: 3.5, h: 0.3, size: 12, bold: true, color: C.cyan, charSpacing: 3, fx: 'rise', delay: 600 });
  ba.forEach(([b, a], i) => {
    const y = 2.7 + i * 0.74, d = 750 + i * 170;
    image(I.xM, { name: `Before ${i + 1} icon`, x: MX + 0.35, y: y + 0.06, w: 0.3, h: 0.3, fx: 'fade', delay: 300 + i * 90 });
    text(b, { name: `Before ${i + 1}`, x: MX + 0.8, y, w: 4.5, h: 0.45, size: 14.5, color: C.text2, valign: 'middle', fx: 'fade', delay: 300 + i * 90 });
    image(I.check, { name: `After ${i + 1} icon`, x: 7.48, y: y + 0.06, w: 0.3, h: 0.3, fx: 'rise', delay: d });
    text(a, { name: `After ${i + 1}`, x: 7.93, y, w: 4.55, h: 0.45, size: 14.5, color: C.text, bold: true, valign: 'middle', fx: 'rise', delay: d });
  });
  shape('ellipse', { name: 'Swap circle', x: 6.27, y: 3.82, w: 0.72, h: 0.72, fill: C.bg1, line: C.violetLight, lw: 1.5, fx: 'zoom', delay: 500 });
  image(I.arrowV, { name: 'Swap arrow', x: 6.43, y: 3.98, w: 0.4, h: 0.4, fx: 'zoom', delay: 500 });
  text('Interpreting findings still takes expert judgement. CodeAtlas removes the manual mapping, not the expertise.', { name: 'BA note', x: MX, y: 6.55, w: 12, h: 0.22, size: 10.5, italic: true, color: C.muted, fx: 'fade', delay: 1700 });

  // 13. Use cases
  newSlide(pres, 'MAIN', 'Act 3 · User transformation');
  glows([3.0, 3.4, 8], [10.0, -2.8, 6]);
  kicker('11', 'Use cases');
  title('Where teams use it: four typical moments');
  tag('Illustrative scenarios', { name: 'Scenario tag', x: 10.18, y: 0.92, w: 2.5, fx: 'fade', delay: 200 });
  const uc = [
    ['brief', 'Modernization consultancy', 'Scoping a migration', 'A client wants a fixed quote to migrate a legacy service. The consultant indexes the repository on the client\'s machine.', 'Estimate built on observed dependencies; exclusions written into the scope.'],
    ['building', 'CTO or engineering head', 'Changing a core table', 'Before splitting a table: which services read it, which write it, and what could not be resolved?', 'Readers and writers with file and line, and the gaps listed.'],
    ['scale', 'Technical due diligence', 'Assessing a target', 'An acquirer needs an architecture baseline without moving the target\'s code off-site.', 'Inventory, coverage and risk findings, run inside the target\'s environment.'],
    ['grad', 'Engineering onboarding', 'Joining an inherited platform', 'New engineers need to find their way around a system its authors have left.', 'A navigable map and cited answers instead of tribal knowledge.'],
  ];
  uc.forEach(([ic, who, moment, body, out], i) => {
    const x = MX + i * 3.06, y = 2.05, w = 2.86, h = 4.7, d = 300 + i * 180;
    card({ name: `UC ${i + 1} card`, x, y, w, h, fx: 'rise', delay: d });
    iconDot(I[ic], { name: `UC ${i + 1} icon`, x: x + 0.28, y: y + 0.3, d: 0.6, fx: 'rise', delay: d });
    text(who.toUpperCase(), { name: `UC ${i + 1} who`, x: x + 0.28, y: y + 1.05, w: w - 0.5, h: 0.45, size: 10, bold: true, color: C.violetLight, charSpacing: 1.5, fx: 'rise', delay: d });
    text(moment, { name: `UC ${i + 1} moment`, x: x + 0.28, y: y + 1.48, w: w - 0.45, h: 0.7, font: F.sub, size: 16.5, fx: 'rise', delay: d });
    text(body, { name: `UC ${i + 1} body`, x: x + 0.28, y: y + 2.2, w: w - 0.5, h: 1.3, size: 13, color: C.text2, lsm: 1.1, fx: 'rise', delay: d });
    shape('line', { name: `UC ${i + 1} rule`, x: x + 0.28, y: y + 3.58, w: w - 0.56, h: 0, line: C.stroke, lw: 1, fx: 'rise', delay: d });
    text(out, { name: `UC ${i + 1} out`, x: x + 0.28, y: y + 3.7, w: w - 0.5, h: 0.8, size: 13, color: C.cyanSoft, lsm: 1.08, fx: 'rise', delay: d });
  });

  // ============ ACT 4: BUSINESS VALUE ============
  pres.addSection({ title: 'Act 4 · Business value' });

  // 14. Business value pillars
  newSlide(pres, 'MAIN', 'Act 4 · Business value');
  glows([4.0, -3.0, 8], [-2.5, 3.5, 6]);
  kicker('12', 'Business value');
  title('Value for the business, not only for engineers');
  const pil = [
    ['hand', 'Win and scope work with confidence', 'For consultancies and delivery heads', ['Scope from evidence, not optimism', 'Show clients a professional, cited baseline', 'Repeat the same method on every engagement']],
    ['shield', 'De-risk change', 'For CTOs and engineering leaders', ['See what a change touches before committing', 'Make unknowns explicit in plans and budgets', 'Keep architecture knowledge when people move on']],
    ['lock', 'Keep control of your code', 'For security, legal and procurement', ['Analysis runs on your machine', 'No telemetry; network use only when a user starts it', 'An open engine you can inspect (Apache-2.0)']],
  ];
  pil.forEach(([ic, head, who, items], i) => {
    const x = MX + i * 4.06, y = 2.15, w = 3.88, h = 4.55, d = 300 + i * 220;
    card({ name: `Pillar ${i + 1} card`, x, y, w, h, fx: 'rise', delay: d });
    iconDot(I[ic], { name: `Pillar ${i + 1} icon`, x: x + 0.32, y: y + 0.35, d: 0.78, ft: 70, fx: 'zoom', delay: d });
    text(head, { name: `Pillar ${i + 1} head`, x: x + 0.32, y: y + 1.35, w: w - 0.6, h: 0.8, font: F.sub, size: 19, lsm: 1.0, fx: 'rise', delay: d });
    text(who, { name: `Pillar ${i + 1} who`, x: x + 0.32, y: y + 2.15, w: w - 0.6, h: 0.3, size: 12, color: C.violetLight, fx: 'rise', delay: d });
    text(items.map((t, k) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: k < items.length - 1 } })),
      { name: `Pillar ${i + 1} list`, x: x + 0.32, y: y + 2.6, w: w - 0.55, h: 1.8, size: 13.5, color: C.text2, psa: 8, lsm: 1.05, fx: 'rise', delay: d + 120 });
  });

  // 15. Business case
  newSlide(pres, 'MAIN', 'Act 4 · Business value');
  glows([7.0, 3.5, 8], [-2.0, -3.0, 6]);
  kicker('13', 'Business case');
  title('A simple test: the assessment must save more effort than it costs');
  tag('Illustrative · use your numbers', { name: 'Illustrative tag', x: MX, y: 2.08, w: 3.75, fx: 'fade', delay: 200 });
  card({ name: 'Formula card', x: MX, y: 2.55, w: 7.25, h: 1.25, fill: C.violet, ft: 84, line: C.violetLight, fx: 'rise', delay: 300 });
  text([{ text: 'Break-even engineer-days', options: { bold: true, color: C.text } }, { text: '  =  assessment fee  ÷  loaded cost of one engineer-day', options: { color: C.text2 } }],
    { name: 'Formula', x: MX + 0.35, y: 2.55, w: 6.7, h: 1.25, size: 15.5, valign: 'middle', fx: 'rise', delay: 300 });
  const be = [
    ['India example', '₹2.25 lakh ÷ ₹15,000', '15', 'engineer-days', 'About one working week for a team of three.'],
    ['International example', 'USD 6,000 ÷ USD 600', '10', 'engineer-days', 'Under four working days for a team of three.'],
  ];
  be.forEach(([lab, calc, num, unit, note], i) => {
    const x = MX + i * 3.7, y = 4.0, w = 3.55, h = 2.45, d = 600 + i * 250;
    card({ name: `BE ${i + 1} card`, x, y, w, h, fx: 'rise', delay: d });
    text(lab.toUpperCase(), { name: `BE ${i + 1} label`, x: x + 0.3, y: y + 0.25, w: w - 0.6, h: 0.25, size: 10, bold: true, color: C.violetLight, charSpacing: 2, fx: 'rise', delay: d });
    text(calc, { name: `BE ${i + 1} calc`, x: x + 0.3, y: y + 0.55, w: w - 0.6, h: 0.35, size: 14, color: C.text2, fx: 'rise', delay: d });
    text([{ text: num, options: { fontFace: F.display, fontSize: 44, color: C.amber } }, { text: '  ' + unit, options: { fontSize: 14, color: C.text2 } }],
      { name: `BE ${i + 1} num`, x: x + 0.3, y: y + 0.92, w: w - 0.5, h: 0.8, valign: 'middle', fx: 'zoom', delay: d + 150 });
    text(note, { name: `BE ${i + 1} note`, x: x + 0.3, y: y + 1.78, w: w - 0.6, h: 0.5, size: 12.5, color: C.text2, fx: 'rise', delay: d });
  });
  text('Fees are the Standard package\'s indicative prices; day rates are illustrative assumptions.', { name: 'BE footnote', x: MX, y: 6.55, w: 7.3, h: 0.3, size: 10.5, italic: true, color: C.muted, fx: 'fade', delay: 1200 });
  card({ name: 'Pilot card', x: 8.35, y: 2.08, w: 4.33, h: 4.62, fx: 'rise', delay: 900 });
  text('WHAT THE PILOT MEASURES', { name: 'Pilot head', x: 8.7, y: 2.35, w: 3.8, h: 0.3, size: 11, bold: true, color: C.cyan, charSpacing: 2, fx: 'rise', delay: 900 });
  const pm = ['Discovery hours, with and without CodeAtlas', 'Findings used in a real decision', 'Findings that were wrong, and what was missed', 'Whether a scope, estimate or plan changed'];
  pm.forEach((t, i) => {
    const y = 2.9 + i * 0.85, d = 1050 + i * 150;
    image(I.check, { name: `PM ${i + 1} icon`, x: 8.7, y: y + 0.04, w: 0.32, h: 0.32, fx: 'rise', delay: d });
    text(t, { name: `PM ${i + 1}`, x: 9.15, y, w: 3.35, h: 0.7, size: 14, color: C.text, lsm: 1.08, fx: 'rise', delay: d });
  });
  text('You keep the data. We publish nothing without your written approval.', { name: 'Pilot note', x: 8.7, y: 6.15, w: 3.8, h: 0.45, size: 11.5, italic: true, color: C.muted, fx: 'rise', delay: 1700 });

  // 16. Differentiation: questions to ask
  newSlide(pres, 'MAIN', 'Act 4 · Business value');
  glows([1.0, 3.6, 8], [9.5, -3.0, 6]);
  kicker('14', 'Why it is different');
  title('Five questions to ask any code-intelligence tool, and our answers');
  const qa = [
    ['Does my source code leave my machine?', 'No. Indexing, the assessment model and the offline map run with no network connection.', 'Automated egress test on every change (Linux)'],
    ['How do I know a link is real?', 'Each relationship is labelled observed, inferred or unknown, with file and line.', 'Click any link in the demo'],
    ['What did it not see?', 'A coverage report gives every file\'s status and reason; unresolved items are listed.', 'Overview → Coverage report'],
    ['Does it connect code to the database?', 'Yes: tables from SQL, ORM models and migrations, linked to the code that reads and writes them.', 'Diagrams → ER; table details'],
    ['Can we inspect how it works?', 'Yes. The engine is open source under Apache-2.0.', 'The public source repository'],
  ];
  const hdrY = 2.05;
  [['The question', MX, 3.7], ['Our answer', MX + 3.9, 5.15], ['How to check it', MX + 9.25, 2.8]].forEach(([l, x, w], i) =>
    text(l.toUpperCase(), { name: `QA head ${i + 1}`, x, y: hdrY, w, h: 0.3, size: 10.5, bold: true, color: C.violetLight, charSpacing: 2, fx: 'fade', delay: 200 }));
  qa.forEach(([q, a, c], i) => {
    const y = 2.42 + i * 0.84, d = 350 + i * 170;
    shape('roundRect', { name: `QA ${i + 1} row`, x: MX - 0.12, y, w: 12.27, h: 0.76, fill: i % 2 ? C.surface : C.surface2, ft: 20, line: C.stroke, lw: 0.75, radius: 0.1, fx: 'rise', delay: d });
    text(q, { name: `QA ${i + 1} q`, x: MX + 0.05, y, w: 3.65, h: 0.76, font: F.sub, size: 14, valign: 'middle', fx: 'rise', delay: d });
    text(a, { name: `QA ${i + 1} a`, x: MX + 3.9, y, w: 5.15, h: 0.76, size: 12.5, color: C.text2, valign: 'middle', lsm: 1.05, fx: 'rise', delay: d });
    text(c, { name: `QA ${i + 1} c`, x: MX + 9.25, y, w: 2.75, h: 0.76, size: 12, color: C.cyanSoft, valign: 'middle', fx: 'rise', delay: d });
  });
  text('We do not claim superiority over named tools without a comparative test. Ask every option these questions, including us.', { name: 'QA note', x: MX, y: 6.68, w: 12, h: 0.22, size: 10.5, italic: true, color: C.muted, fx: 'fade', delay: 1400 });

  // ============ ACT 5: TECHNOLOGY, EXECUTION & TRUST ============
  pres.addSection({ title: 'Act 5 · Technology, execution and trust' });

  // 17. Architecture & security
  newSlide(pres, 'MAIN', 'Act 5 · Technology, execution and trust');
  glows([4.5, 0.5, 8], [10.0, 4.0, 5.5]);
  kicker('15', 'Technology and security');
  title('Built to run where your code lives');
  // Machine boundary
  shape('roundRect', { name: 'Machine boundary', x: MX - 0.1, y: 2.05, w: 12.25, h: 3.62, fill: C.bg1, ft: 60, line: C.cyan, lw: 1.25, dash: 'dash', radius: 0.08, fx: 'fade', delay: 150 });
  text('YOUR MACHINE  ·  NO NETWORK NEEDED FOR ANALYSIS', { name: 'Boundary label', x: MX + 0.15, y: 2.15, w: 6, h: 0.3, size: 10.5, bold: true, color: C.cyan, charSpacing: 2, fx: 'fade', delay: 150 });
  // Repository
  card({ name: 'Repo box', x: MX + 0.15, y: 2.75, w: 2.2, h: 2.6, fx: 'rise', delay: 300 });
  image(I.folder, { name: 'Repo icon', x: MX + 0.95, y: 3.0, w: 0.6, h: 0.6, fx: 'rise', delay: 300 });
  text('Your repository', { name: 'Repo head', x: MX + 0.25, y: 3.75, w: 2.0, h: 0.35, font: F.sub, size: 15, align: 'center', fx: 'rise', delay: 300 });
  text('On disk. Credential-like files are listed, never read.', { name: 'Repo body', x: MX + 0.3, y: 4.15, w: 1.9, h: 1.0, size: 12, color: C.text2, align: 'center', fx: 'rise', delay: 300 });
  shape('rightArrow', { name: 'Arrow 1', x: 3.1, y: 3.85, w: 0.45, h: 0.4, fill: C.violetLight, fx: 'wipe', delay: 500 });
  // Engine
  card({ name: 'Engine box', x: 3.65, y: 2.75, w: 4.6, h: 2.6, fill: C.violet, ft: 82, line: C.violetLight, fx: 'rise', delay: 600 });
  text('CodeAtlas engine (one local process)', { name: 'Engine head', x: 3.85, y: 2.88, w: 4.2, h: 0.35, font: F.sub, size: 15, fx: 'rise', delay: 600 });
  const eng = ['TypeScript compiler API', 'tree-sitter: 70+ languages', 'PostgreSQL\'s own SQL parser', 'ORM & migrations: 23 frameworks', 'Build, config & docs readers', 'Evidence rules catalogue'];
  eng.forEach((e, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 3.85 + col * 2.12, y = 3.35 + row * 0.62, d = 700 + i * 90;
    shape('roundRect', { name: `Engine chip ${i + 1} box`, x, y, w: 2.02, h: 0.5, fill: C.bg1, ft: 20, line: C.stroke, radius: 0.12, fx: 'zoom', delay: d });
    text(e, { name: `Engine chip ${i + 1}`, x: x + 0.08, y, w: 1.86, h: 0.5, size: 10.5, color: C.text, align: 'center', valign: 'middle', fx: 'zoom', delay: d });
  });
  shape('rightArrow', { name: 'Arrow 2', x: 8.33, y: 3.85, w: 0.45, h: 0.4, fill: C.violetLight, fx: 'wipe', delay: 1250 });
  // Index + outputs
  card({ name: 'Index box', x: 8.86, y: 2.75, w: 1.55, h: 2.6, fx: 'rise', delay: 1300 });
  image(I.db, { name: 'Index icon', x: 9.33, y: 3.0, w: 0.6, h: 0.6, fx: 'rise', delay: 1300 });
  text('Local index', { name: 'Index head', x: 8.9, y: 3.75, w: 1.47, h: 0.35, font: F.sub, size: 14, align: 'center', fx: 'rise', delay: 1300 });
  text('SQLite, in one folder you can delete', { name: 'Index body', x: 8.95, y: 4.15, w: 1.37, h: 1.0, size: 11.5, color: C.text2, align: 'center', fx: 'rise', delay: 1300 });
  const outs = [['monitor', 'Web UI on 127.0.0.1, token-protected'], ['terminal', 'Command line'], ['map', 'Offline map (one HTML file)'], ['json', 'Assessment data model (JSON)']];
  outs.forEach(([ic, l], i) => {
    const y = 2.75 + i * 0.66, d = 1450 + i * 120;
    shape('roundRect', { name: `Out ${i + 1} box`, x: 10.55, y, w: 2.1, h: 0.56, fill: C.surface2, ft: 10, line: C.stroke, radius: 0.12, fx: 'rise', delay: d });
    image(I[ic], { name: `Out ${i + 1} icon`, x: 10.65, y: y + 0.13, w: 0.3, h: 0.3, fx: 'rise', delay: d });
    text(l, { name: `Out ${i + 1}`, x: 11.02, y, w: 1.58, h: 0.56, size: 10.5, color: C.text, valign: 'middle', fx: 'rise', delay: d });
  });
  // Optional flows
  shape('roundRect', { name: 'Optional box', x: MX - 0.1, y: 5.82, w: 7.45, h: 0.95, fill: C.surface, ft: 30, line: C.muted, lw: 1, dash: 'sysDot', radius: 0.1, fx: 'fade', delay: 1900 });
  text([{ text: 'Only when a user starts it:  ', options: { bold: true, color: C.text } }, { text: 'AI answers from a local model (Ollama on the same machine; a remote model is refused without explicit consent), cloning a public repository, or running the repository\'s own tests in an investigation.', options: { color: C.text2 } }],
    { name: 'Optional text', x: MX + 0.12, y: 5.82, w: 7.1, h: 0.95, size: 11.5, valign: 'middle', lsm: 1.05, fx: 'fade', delay: 1900 });
  const badges = [['wifioff', 'No telemetry'], ['badge', 'Egress test in CI'], ['code', 'Open engine, Apache-2.0']];
  badges.forEach(([ic, l], i) => {
    const x = 8.2 + i * 1.5, d = 2050 + i * 120;
    shape('roundRect', { name: `Badge ${i + 1} box`, x, y: 5.82, w: 1.42, h: 0.95, fill: C.cyan, ft: 88, line: C.cyan, lw: 0.75, radius: 0.1, fx: 'zoom', delay: d });
    image(I[ic], { name: `Badge ${i + 1} icon`, x: x + 0.56, y: 5.9, w: 0.3, h: 0.3, fx: 'zoom', delay: d });
    text(l, { name: `Badge ${i + 1}`, x: x + 0.05, y: 6.22, w: 1.32, h: 0.5, size: 10.5, bold: true, color: C.text, align: 'center', valign: 'middle', fx: 'zoom', delay: d });
  });

  // 18. Today and next
  newSlide(pres, 'MAIN', 'Act 5 · Technology, execution and trust');
  glows([-2.5, -2.0, 8], [8.5, 3.8, 6]);
  kicker('16', 'Maturity and roadmap');
  title('What is proven today, and what comes next');
  const cols = [
    ['AVAILABLE NOW', 'Implemented and tested', C.cyan, ['Local engine, web UI and CLI', 'Routes, flows, tables, dependencies, coverage', 'Offline map in one HTML file', 'Assessment data model (JSON)', 'ArchLens skill for Claude Code', 'Exclusions and redacted support bundle', 'Installable archive (Linux tested)']],
    ['NEXT', 'Planned', C.violetLight, ['Assessment report generator (HTML and PDF)', 'Per-stack accuracy benchmarks, published after independent review', 'Comparison between analysis runs', 'Signed installers for macOS and Windows']],
    ['LATER', 'Planned', C.muted, ['Multi-repository workspaces', 'Architecture drift checks in CI', 'MCP adapter for coding agents', 'Team features: roles, SSO, audit']],
  ];
  cols.forEach(([lab, sub, col, items], i) => {
    const x = MX + i * 4.06, y = 2.1, w = 3.88, h = 3.75, d = 300 + i * 260;
    card({ name: `RM ${i + 1} card`, x, y, w, h, fill: i === 0 ? C.surface2 : C.surface, ft: i === 0 ? 0 : 25, line: i === 0 ? C.cyan : C.stroke, lw: i === 0 ? 1.25 : 1, dash: i === 0 ? 'solid' : 'dash', fx: 'rise', delay: d });
    text(lab, { name: `RM ${i + 1} label`, x: x + 0.3, y: y + 0.25, w: 2.2, h: 0.3, size: 12, bold: true, color: col, charSpacing: 2.5, fx: 'rise', delay: d });
    text(sub, { name: `RM ${i + 1} sub`, x: x + 0.3, y: y + 0.58, w: 3.3, h: 0.28, size: 10.5, color: C.muted, align: 'left', fx: 'rise', delay: d });
    text(items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < items.length - 1 } })),
      { name: `RM ${i + 1} list`, x: x + 0.3, y: y + 1.0, w: w - 0.45, h: h - 1.1, size: 12, color: i === 0 ? C.text : C.text2, psa: 6, lsm: 1.03, fx: 'rise', delay: d + 100 });
  });
  const st = [['TypeScript + PostgreSQL', 'Lead stack', C.cyan], ['Java + Spring', 'Second stack', C.violetLight], ['70+ other languages', 'Inventory and structure', C.muted]];
  st.forEach(([h, s, col], i) => {
    const x = MX + i * 4.06, d = 1200 + i * 150;
    shape('ellipse', { name: `Stack ${i + 1} dot`, x, y: 6.1, w: 0.16, h: 0.16, fill: col, fx: 'fade', delay: d });
    text([{ text: h + '  ', options: { bold: true, color: C.text } }, { text: s, options: { color: C.text2 } }], { name: `Stack ${i + 1}`, x: x + 0.28, y: 5.98, w: 3.75, h: 0.4, size: 12.5, valign: 'middle', fx: 'fade', delay: d });
  });
  text('Limit: CodeAtlas reads source; it does not run your application. Framework wiring it does not model, such as dependency injection, events and queued jobs, is reported as a gap.',
    { name: 'Limit note', x: MX, y: 6.48, w: 12, h: 0.42, size: 11, italic: true, color: C.muted, fx: 'fade', delay: 1700 });

  // 19. Implementation / engagement process
  newSlide(pres, 'MAIN', 'Act 5 · Technology, execution and trust');
  glows([6.0, -3.0, 8], [-2.0, 4.0, 6]);
  kicker('17', 'Implementation');
  title('A bounded engagement your team can approve quickly');
  const ph = [
    ['Scope', '30-minute call: repository, stack fit and the decision you need to make. Written scope and exclusions.'],
    ['Set up', 'CodeAtlas runs in your environment. You authorise the repository and mark restricted files.'],
    ['Analyse & review', 'We run the analysis, check findings against the source and record what could not be resolved.'],
    ['Present', 'Findings workshop, plus an executive and technical report with an evidence appendix.'],
  ];
  ph.forEach(([h, b], i) => {
    const x = MX + i * 3.06, d = 300 + i * 240;
    shape('chevron', { name: `Phase ${i + 1} chevron`, x, y: 2.15, w: 2.95, h: 0.72, fill: i === 3 ? C.violet : C.surface2, ft: 0, line: i === 3 ? C.violetLight : C.stroke, lw: 1, fx: 'wipe', delay: d });
    text(`${i + 1}  ${h}`, { name: `Phase ${i + 1} name`, x: x + 0.45, y: 2.15, w: 2.2, h: 0.72, font: F.sub, size: 15.5, valign: 'middle', fx: 'wipe', delay: d });
    text(b, { name: `Phase ${i + 1} body`, x: x + 0.1, y: 3.05, w: 2.75, h: 1.2, size: 13, color: C.text2, lsm: 1.1, fx: 'rise', delay: d + 120 });
  });
  const blocks = [
    ['list', 'What we need from you', ['Written authorisation to analyse the repository', 'An environment and a technical contact', 'Time to review findings']],
    ['file', 'What you receive', ['Inventory, architecture overview, dependency and data findings', 'Coverage, exclusions and unresolved items', 'Impact walkthrough, report and workshop']],
    ['x', 'What is out of scope', ['Runtime guarantees or a full manual audit', 'Penetration testing or certification', 'Unsupported stacks, code changes, legal opinions']],
  ];
  blocks.forEach(([ic, h, items], i) => {
    const x = MX + i * 4.06, y = 4.4, w = 3.88, h2 = 2.42, d = 1300 + i * 200;
    card({ name: `Block ${i + 1} card`, x, y, w, h: h2, fx: 'rise', delay: d });
    image(I[ic + 'V'], { name: `Block ${i + 1} icon`, x: x + 0.3, y: y + 0.27, w: 0.34, h: 0.34, fx: 'rise', delay: d });
    text(h, { name: `Block ${i + 1} head`, x: x + 0.75, y: y + 0.22, w: w - 1.0, h: 0.42, font: F.sub, size: 15, fx: 'rise', delay: d });
    text(items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < items.length - 1 } })),
      { name: `Block ${i + 1} list`, x: x + 0.3, y: y + 0.75, w: w - 0.55, h: 1.45, size: 12.5, color: C.text2, psa: 5, lsm: 1.03, fx: 'rise', delay: d });
  });

  // 20. Engagement options
  newSlide(pres, 'MAIN', 'Act 5 · Technology, execution and trust');
  glows([8.0, 2.8, 8], [-2.5, -2.5, 6]);
  kicker('18', 'Engagement options');
  title('Start small, with a fixed price and a written scope');
  const pk = [
    ['Discovery', '₹1.5 lakh', 'USD 5,000', ['One bounded repository', 'Inventory and architecture overview', 'Coverage and findings']],
    ['Standard', '₹2.25 lakh', 'USD 6,000', ['Everything in Discovery', 'Dependency, API and database findings', 'Impact walkthrough']],
    ['Complex', '₹3 lakh+', 'USD 7,500+', ['Larger or multi-module scope', 'Deeper framework review', 'Findings workshop']],
  ];
  pk.forEach(([n, inr, usd, items], i) => {
    const x = MX + i * 3.1, y = 2.1, w = 2.92, h = 3.85, d = 300 + i * 200, hi = i === 1;
    card({ name: `Pkg ${i + 1} card`, x, y, w, h, fill: hi ? C.violet : C.surface, ft: hi ? 80 : 8, line: hi ? C.violetLight : C.stroke, lw: hi ? 1.5 : 1, fx: 'rise', delay: d });
    text(n, { name: `Pkg ${i + 1} name`, x: x + 0.28, y: y + 0.25, w: w - 0.5, h: 0.4, font: F.sub, size: 19, fx: 'rise', delay: d });
    text('from', { name: `Pkg ${i + 1} from`, x: x + 0.28, y: y + 0.75, w: 1, h: 0.25, size: 11, color: C.muted, fx: 'rise', delay: d });
    text(inr, { name: `Pkg ${i + 1} inr`, x: x + 0.28, y: y + 0.98, w: w - 0.5, h: 0.55, font: F.display, size: 26, fx: 'rise', delay: d });
    text(usd + ' internationally', { name: `Pkg ${i + 1} usd`, x: x + 0.28, y: y + 1.53, w: w - 0.5, h: 0.3, size: 12.5, color: C.text2, fx: 'rise', delay: d });
    shape('line', { name: `Pkg ${i + 1} rule`, x: x + 0.28, y: y + 2.0, w: w - 0.56, h: 0, line: hi ? C.violetLight : C.stroke, lw: 1, lt: 30, fx: 'rise', delay: d });
    text(items.map((t, k) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: k < items.length - 1 } })),
      { name: `Pkg ${i + 1} list`, x: x + 0.28, y: y + 2.15, w: w - 0.45, h: 1.55, size: 12.5, color: C.text2, psa: 5, fx: 'rise', delay: d });
  });
  card({ name: 'Pilot offer', x: 9.95, y: 2.1, w: 2.73, h: 3.85, fill: C.amber, ft: 88, line: C.amber, lw: 1.25, fx: 'rise', delay: 950 });
  image(I.handA, { name: 'Pilot icon', x: 10.25, y: 2.38, w: 0.5, h: 0.5, fx: 'rise', delay: 950 });
  text('Design-partner pilot', { name: 'Pilot head', x: 10.25, y: 3.0, w: 2.3, h: 0.7, font: F.sub, size: 17, fx: 'rise', delay: 950 });
  text('A discounted fee for early clients who give structured feedback. Any reference or case study only with your written approval.', { name: 'Pilot body', x: 10.25, y: 3.75, w: 2.25, h: 2.0, size: 12.5, color: C.text2, lsm: 1.1, fx: 'rise', delay: 950 });
  text('Indicative prices, excluding taxes. Final quote after a scoping call; we do not price by lines of code. Remove the currency that does not apply before sending.',
    { name: 'Price note', x: MX, y: 6.2, w: 12, h: 0.45, size: 11, italic: true, color: C.muted, fx: 'fade', delay: 1300 });

  // 21. Why work with us
  newSlide(pres, 'MAIN', 'Act 5 · Technology, execution and trust');
  glows([2.5, 3.5, 8], [10.0, -2.5, 6]);
  kicker('19', 'Why work with us');
  title('How we work: evidence first, scope in writing, your code stays yours');
  const pr = [
    ['eye', 'We publish what we cannot see', 'Coverage, gaps and limits are part of every deliverable.'],
    ['file', 'Scope in writing', 'Fixed price, written exclusions, change orders for anything extra.'],
    ['lock', 'Your code stays yours', 'Analysis in your environment; outputs delivered to you.'],
    ['code', 'Open engine', 'Your engineers can read the code that reads your code.'],
  ];
  pr.forEach(([ic, h, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 3.95, y = 2.15 + row * 1.7, d = 300 + i * 160;
    iconDot(I[ic], { name: `Principle ${i + 1} icon`, x, y, d: 0.66, fx: 'rise', delay: d });
    text(h, { name: `Principle ${i + 1} head`, x: x + 0.85, y: y - 0.02, w: 2.95, h: 0.62, font: F.sub, size: 16, lsm: 1.0, fx: 'rise', delay: d });
    text(b, { name: `Principle ${i + 1} body`, x: x + 0.85, y: y + 0.62, w: 2.95, h: 0.85, size: 13, color: C.text2, lsm: 1.08, fx: 'rise', delay: d });
  });
  card({ name: 'Discipline card', x: MX, y: 5.6, w: 7.75, h: 1.12, fill: C.surface2, ft: 0, line: C.stroke, fx: 'rise', delay: 1100 });
  text([{ text: 'Engineering evidence  ', options: { bold: true, color: C.cyan } }, { text: '784 automated tests passing (22 Nov 2026)  ·  egress test on every change  ·  SBOM and third-party notices built in CI  ·  hostile-repository tests', options: { color: C.text2 } }],
    { name: 'Discipline text', x: MX + 0.3, y: 5.6, w: 7.25, h: 1.12, size: 12.5, valign: 'middle', lsm: 1.1, fx: 'rise', delay: 1100 });
  shape('roundRect', { name: 'Team placeholder', x: 8.75, y: 2.12, w: 3.93, h: 4.6, fill: C.surface, ft: 40, line: C.amber, lw: 1.25, dash: 'dash', radius: 0.14, fx: 'rise', delay: 800 });
  image(I.usersA, { name: 'Team icon', x: 9.08, y: 2.45, w: 0.5, h: 0.5, fx: 'rise', delay: 800 });
  text('Your team', { name: 'Team head', x: 9.08, y: 3.1, w: 3.3, h: 0.4, font: F.sub, size: 17, fx: 'rise', delay: 800 });
  text('[Add founder and delivery-lead profiles: name, role, relevant experience. Only verified facts; no client names without written approval.]',
    { name: 'Team body', x: 9.08, y: 3.6, w: 3.3, h: 2.0, size: 12.5, color: C.amber, lsm: 1.1, fx: 'rise', delay: 800 });

  // ============ ACT 6: THE NEXT STEP ============
  pres.addSection({ title: 'Act 6 · The next step' });

  // 22. Call to action
  newSlide(pres, 'HERO_STATEMENT', 'Act 6 · The next step');
  glows([6.8, -1.5, 9], [-2.5, 3.0, 7]);
  image(MARK, { name: '!!brand', x: MX, y: 0.45, w: 0.42, h: 0.42, alt: 'CodeAtlas mark' });
  text('CodeAtlas', { name: '!!brandName', x: MX + 0.55, y: 0.46, w: 3, h: 0.4, font: F.display, size: 17, valign: 'middle' });
  S.addText('Let\'s map one of your systems', { placeholder: 'title' });
  anim('Title', 'rise', 200, 900);
  const cta = [
    ['cal', 'Book a 30-minute scoping call', 'We agree the repository, the stack fit and what you need to decide.'],
    ['folder', 'Choose one repository and one decision', 'A migration, a database change, an acquisition or an onboarding.'],
    ['target', 'Get your findings workshop', 'An evidence-backed map, its gaps, and what they mean for your plan.'],
  ];
  cta.forEach(([ic, h, b], i) => {
    const y = 2.85 + i * 1.15, d = 600 + i * 220;
    iconDot(I[ic], { name: `CTA ${i + 1} icon`, x: MX, y, d: 0.7, fx: 'rise', delay: d });
    text(h, { name: `CTA ${i + 1} head`, x: MX + 0.95, y: y - 0.02, w: 6.4, h: 0.4, font: F.sub, size: 19, fx: 'rise', delay: d });
    text(b, { name: `CTA ${i + 1} body`, x: MX + 0.95, y: y + 0.4, w: 6.4, h: 0.5, size: 14, color: C.text2, fx: 'rise', delay: d });
  });
  card({ name: 'Contact card', x: 8.25, y: 2.85, w: 4.43, h: 3.05, fill: C.surface, ft: 20, line: C.violetLight, fx: 'rise', delay: 1300 });
  text('START HERE', { name: 'Contact label', x: 8.6, y: 3.12, w: 3.7, h: 0.3, size: 11, bold: true, color: C.cyan, charSpacing: 3, fx: 'rise', delay: 1300 });
  text('[Name, role]', { name: 'Contact name', x: 8.6, y: 3.5, w: 3.8, h: 0.45, font: F.sub, size: 19, color: C.amber, fx: 'rise', delay: 1300 });
  image(I.mail, { name: 'Mail icon', x: 8.6, y: 4.22, w: 0.3, h: 0.3, fx: 'rise', delay: 1400 });
  text('[email address]', { name: 'Contact email', x: 9.05, y: 4.16, w: 3.4, h: 0.42, size: 14, color: C.amber, valign: 'middle', fx: 'rise', delay: 1400 });
  image(I.phone, { name: 'Phone icon', x: 8.6, y: 4.77, w: 0.3, h: 0.3, fx: 'rise', delay: 1500 });
  text('[phone]', { name: 'Contact phone', x: 9.05, y: 4.71, w: 3.4, h: 0.42, size: 14, color: C.amber, valign: 'middle', fx: 'rise', delay: 1500 });
  text('Bring a question about a real system. We will tell you honestly whether CodeAtlas fits it.', { name: 'Contact note', x: 8.6, y: 5.25, w: 3.85, h: 0.6, size: 11.5, italic: true, color: C.text2, fx: 'rise', delay: 1600 });

  // 23. Closing
  newSlide(pres, 'HERO_CLOSE', 'Act 6 · The next step');
  image(meta['brain-poster.jpg'].file, { name: 'Closing brain', x: 0, y: 0, w: W, h: H, alt: 'CodeAtlas architecture brain of the Immich repository', fx: 'fade', delay: 0, dur: 1500 });
  glows([-9, -9, 7], [14, 9, 6]);
  image(MARK, { name: '!!brand', x: MX, y: 1.6, w: 0.62, h: 0.62, alt: 'CodeAtlas mark' });
  text('CodeAtlas', { name: '!!brandName', x: MX + 0.78, y: 1.62, w: 4, h: 0.58, font: F.display, size: 26, valign: 'middle' });
  S.addText([
    { text: 'Understand what exists.', options: { breakLine: true } },
    { text: 'See how it connects.', options: { breakLine: true } },
    { text: 'Change with confidence.', options: { color: C.cyan } },
  ], { placeholder: 'title' });
  anim('Title', 'rise', 500, 1100);
  text('Local-first software architecture intelligence', { name: 'Closing sub', x: MX, y: 4.75, w: 6.5, h: 0.4, size: 16, color: C.text2, fx: 'fade', delay: 1400 });

  // ---------- write ----------
  const out = path.join(ROOT, 'build', 'CodeAtlas_Client_Pitch_Deck.raw.pptx');
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(path.join(ROOT, 'build', 'animations.json'), JSON.stringify(ANIM, null, 1));
  console.log('wrote', out, 'slides', sIdx + 1);
})().catch((e) => { console.error(e); process.exit(1); });
