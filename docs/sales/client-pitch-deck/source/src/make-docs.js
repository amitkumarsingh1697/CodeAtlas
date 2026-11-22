// Builds the design guide PDF and the "about this PDF" page appended to the deck PDF.
// Run after the deck is built and rendered: node src/make-docs.js (from the deck folder).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const T = require('./tokens');

const ROOT = path.resolve(__dirname, '..');
const B = (f) => path.join(ROOT, 'build', f);
const c = (k) => '#' + T.color[k];
const img = (p) => 'data:image/' + (p.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(p).toString('base64');
const thumb = (n) => img(B(`thumbs/t-${String(n).padStart(2, '0')}.jpg`));
const HOME = process.env.HOME;
// The presenter-script DOCX (src/make-script-docx.py) reads this JSON copy of src/script.js.
fs.writeFileSync(B('script.json'), JSON.stringify(require('./script')));

const BASE = `
@font-face{font-family:Manrope;font-weight:800;src:url(file://${HOME}/.fonts/Manrope-800.ttf)}
@font-face{font-family:Manrope;font-weight:600;src:url(file://${HOME}/.fonts/Manrope-600.ttf)}
*{box-sizing:border-box}
html,body{margin:0;background:${c('bg1')};color:${c('text')};font-family:Inter,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3{font-family:Manrope;margin:0}
h1{font-weight:800}h2{font-weight:800;font-size:26px;letter-spacing:-.2px}h3{font-weight:600;font-size:15px}
p,li{color:${c('text2')};font-size:11.5px;line-height:1.55;margin:0}
.k{font:700 9.5px Inter;letter-spacing:2.6px;text-transform:uppercase;color:${c('cyan')};margin-bottom:8px}
`;

// ---------- design guide ----------
const swatches = [
  ['bg0', 'Deepest midnight', 'Cover, statement and closing slides'],
  ['bg1', 'Midnight', 'Content slide background'],
  ['surface', 'Surface', 'Cards'],
  ['surface2', 'Raised surface', 'Table headers, raised cards'],
  ['stroke', 'Hairline', 'Card borders, dividers'],
  ['violet', 'Electric violet', 'Primary: brand, emphasis, the recommended option'],
  ['violetLight', 'Violet tint', 'Secondary labels, icons on violet'],
  ['cyan', 'Cyan', 'Kickers, data highlights, observed evidence'],
  ['cyanSoft', 'Soft cyan', 'Icons'],
  ['amber', 'Amber', 'Inferred evidence, assumptions, "illustrative" tags, placeholders'],
  ['rose', 'Rose', 'Rare: risk only'],
  ['text', 'White', 'Titles and primary text'],
  ['text2', 'Slate', 'Body text'],
  ['muted', 'Muted slate', 'Captions, footers, unknown evidence'],
];
const type = [
  ['Cover title', 'Manrope ExtraBold', '48 pt', 'One idea, three lines at most. Line spacing 0.98.'],
  ['Statement / closing title', 'Manrope ExtraBold', '40 pt', 'Short sentences; the last line can turn cyan.'],
  ['Slide title', 'Manrope ExtraBold', '32 pt', 'A full sentence that states the message, two lines at most.'],
  ['Big number', 'Manrope ExtraBold', '40 to 48 pt', 'Only measured counts, or values tagged illustrative.'],
  ['Card heading', 'Manrope SemiBold', '15 to 19 pt', 'Three to six words.'],
  ['Kicker', 'Inter Bold, caps, +3 spacing', '11 pt', 'Section number and name, cyan.'],
  ['Body', 'Inter Regular', '12 to 17 pt', 'Never below 12 pt on content that must be read.'],
  ['Caption, source, footer', 'Inter Regular / Italic', '10 to 11 pt', 'Sources, dates and limits, muted slate.'],
];
const motion = [
  ['Slide transition', 'Morph, 1.0 s (fade fallback)', 'Every slide. Objects named with a leading "!!" (brand mark, glows, product screens) are matched across slides, so the light drifts and the screens glide between slides.'],
  ['Fade', '0.5 to 0.7 s', 'Kickers, captions, footnotes, legends.'],
  ['Rise (Float In)', '0.8 s, decelerate, 6 % travel', 'Titles, cards, list items, step text.'],
  ['Zoom', '0.9 to 1.1 s, from 88 % size', 'Hero objects only: product screens, the layer stack, the big result number.'],
  ['Wipe from left', '0.7 s', 'Evidence lines, timeline connectors, drawing the eye along a path.'],
  ['Stagger', '120 to 250 ms between items', 'Lists and card rows reveal in reading order; a slide finishes building in under 2.5 s.'],
  ['Trigger', 'Automatic on slide entry', 'No clicks needed to build a slide, so the presenter never waits on the deck. One click moves to the next slide.'],
  ['Video', 'Cover only, muted, loops', 'The 20 s architecture-brain render plays and loops on the cover. Nowhere else.'],
];

const guide = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
@page{size:297mm 167mm;margin:0}
.pg{width:297mm;height:167mm;position:relative;overflow:hidden;padding:15mm 16mm;page-break-after:always;background:${c('bg1')}}
.pg:last-child{page-break-after:auto}
.foot{position:absolute;left:16mm;right:16mm;bottom:7mm;display:flex;justify-content:space-between;font-size:8.5px;color:${c('muted')}}
.cols{display:grid;gap:18px}
.card{background:${c('surface')};border:1px solid ${c('stroke')};border-radius:10px;padding:12px 14px}
.sw{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-top:14px}
.sw div.c{height:46px;border-radius:8px;border:1px solid rgba(255,255,255,.12)}
.sw b{display:block;font:600 10.5px Manrope;margin-top:6px;color:${c('text')}}
.sw span{display:block;font-size:9px;color:${c('muted')};line-height:1.35}
table{width:100%;border-collapse:collapse;margin-top:12px}
td,th{text-align:left;padding:7px 9px;border-bottom:1px solid ${c('stroke')};font-size:10.5px;vertical-align:top;color:${c('text2')}}
th{font:700 9px Inter;letter-spacing:1.6px;text-transform:uppercase;color:${c('cyan')};background:${c('surface2')}}
td:first-child{color:${c('text')};font-weight:600}
.th{width:100%;border-radius:6px;border:1px solid ${c('stroke')};display:block}
ul{margin:6px 0 0;padding-left:16px}li{margin-bottom:4px}
.tag{display:inline-block;border:1px solid ${c('amber')};color:${c('amber')};border-radius:20px;padding:2px 9px;font:700 8px Inter;letter-spacing:1.8px}
</style></head><body>

<section class="pg" style="background:url(${img(B('opt/bg-hero.jpg'))}) center/cover">
  <div style="display:flex;align-items:center;gap:10px"><img src="${img(B('opt/brand-mark.png'))}" style="width:30px"><span style="font:800 18px Manrope">CodeAtlas</span></div>
  <div style="position:absolute;left:16mm;top:52mm;width:150mm">
    <div class="k">Presentation design guide</div>
    <h1 style="font-size:40px;line-height:1.05">How the CodeAtlas client deck looks, moves and is presented</h1>
    <p style="font-size:13px;margin-top:14px;max-width:130mm">Palette, type, layout, motion and presenting rules for the client pitch deck, so the next version stays consistent. Version 1, 22 November 2026.</p>
  </div>
  <img src="${thumb(1)}" style="position:absolute;right:14mm;top:40mm;width:118mm;border-radius:8px;border:1px solid rgba(165,148,255,.45);box-shadow:0 20px 60px rgba(0,0,0,.6)">
  <div class="foot"><span>CodeAtlas is a working name, pending trademark clearance.</span><span>1</span></div>
</section>

<section class="pg">
  <div class="k">01 · Design principles</div><h2>Proof over decoration</h2>
  <div class="cols" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
    ${[
      ['Show the real product', 'Every product image is an unedited CodeAtlas screenshot of a real open-source repository, cropped and framed. Never mock up a screen that does not exist.'],
      ['Every number has a source', 'Counts carry the repository, commit and date. Assumptions carry an amber "Illustrative" tag. Accuracy percentages stay out until they are independently reviewed.'],
      ['One message per slide', 'The title is the message, written as a sentence. Everything else on the slide supports it or is removed.'],
      ['Depth with restraint', 'Dark midnight space, soft violet and cyan light, glass cards and perspective screens. Light comes from the glows, never from gradients on text.'],
      ['Evidence has a visual language', 'Solid cyan line = observed. Dashed amber line = inferred. Dotted grey line = unknown. Use these three meanings everywhere, never as decoration.'],
      ['Honest limits are part of the design', 'Every slide that makes a claim has room for its limit, in a muted caption. A limit is never hidden in the notes.'],
    ].map(([h, p]) => `<div class="card"><h3>${h}</h3><p style="margin-top:6px">${p}</p></div>`).join('')}
  </div>
  <div class="cols" style="grid-template-columns:repeat(3,1fr);margin-top:16px;align-items:center">
    <div style="display:flex;align-items:center;gap:10px"><i style="display:block;width:46px;border-top:3px solid ${c('cyan')}"></i><span style="color:${c('cyan')};font:600 12px Manrope">Observed</span></div>
    <div style="display:flex;align-items:center;gap:10px"><i style="display:block;width:46px;border-top:3px dashed ${c('amber')}"></i><span style="color:${c('amber')};font:600 12px Manrope">Inferred</span></div>
    <div style="display:flex;align-items:center;gap:10px"><i style="display:block;width:46px;border-top:3px dotted ${c('muted')}"></i><span style="color:${c('text2')};font:600 12px Manrope">Unknown</span></div>
  </div>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>2</span></div>
</section>

<section class="pg">
  <div class="k">02 · Colour</div><h2>Midnight, violet and a little cyan</h2>
  <p style="margin-top:8px;max-width:210mm">Roughly 70 % midnight and surface, 20 % white and slate text, 10 % accent. Violet leads, cyan supports, amber marks anything assumed. All values are in <code>src/tokens.js</code>; change them there and rebuild.</p>
  <div class="sw">${swatches.map(([k, n, u]) => `<div><div class="c" style="background:${c(k)}"></div><b>${n}</b><span>#${T.color[k]}</span><span>${u}</span></div>`).join('')}</div>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>3</span></div>
</section>

<section class="pg">
  <div class="k">03 · Typography</div><h2>Manrope for voice, Inter for reading</h2>
  <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:22px;margin-top:12px">
    <div>
      <div style="font:800 44px/1 Manrope">Aa</div><p style="margin:4px 0 12px">Manrope ExtraBold and SemiBold: titles, numbers and card headings.</p>
      <div style="font:400 44px/1 Inter">Aa</div><p style="margin-top:4px">Inter Regular, Bold and Italic: body, labels and captions.</p>
      <p style="margin-top:12px">Both are free under the SIL Open Font License. Install them on every machine that presents or edits the deck (the TTFs are in <code>source/fonts</code>); otherwise PowerPoint substitutes a default font and lines re-wrap.</p>
    </div>
    <table><tr><th>Role</th><th>Font</th><th>Size</th><th>Rule</th></tr>
      ${type.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>
  </div>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>4</span></div>
</section>

<section class="pg">
  <div class="k">04 · Layout</div><h2>A 16:9 grid with one fixed frame</h2>
  <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:22px;margin-top:12px">
    <div style="position:relative">
      <img class="th" src="${thumb(11)}">
      <div style="position:absolute;inset:0;border-radius:6px;pointer-events:none">
        <div style="position:absolute;left:4.9%;top:0;bottom:0;border-left:1px dashed ${c('amber')}"></div>
        <div style="position:absolute;right:4.9%;top:0;bottom:0;border-left:1px dashed ${c('amber')}"></div>
        <div style="position:absolute;left:0;right:0;top:6.1%;border-top:1px dashed ${c('cyan')}"></div>
        <div style="position:absolute;left:0;right:0;top:10.9%;border-top:1px dashed ${c('cyan')}"></div>
        <div style="position:absolute;left:0;right:0;top:93.6%;border-top:1px dashed ${c('cyan')}"></div>
      </div>
    </div>
    <div>
      <ul>
        <li><b style="color:${c('text')}">Canvas</b> 13.33 × 7.5 in (16:9). Side margins 0.65 in (amber lines).</li>
        <li><b style="color:${c('text')}">Frame</b> kicker at 0.46 in, title at 0.82 in (up to two lines), content from about 1.95 in, footer and slide number at 7.02 in (cyan lines).</li>
        <li><b style="color:${c('text')}">Four layouts</b>: MAIN (content), HERO_COVER, HERO_STATEMENT (call to action) and HERO_CLOSE. Titles are real placeholders, so the outline view and accessibility tools read them.</li>
        <li><b style="color:${c('text')}">Cards</b> radius 0.14 in, 1 pt hairline, soft shadow, 0.3 in inner padding. Gutters 0.18 to 0.2 in.</li>
        <li><b style="color:${c('text')}">Patterns</b>: 2 × 3 capability grid, 4-column cards, numbered rows beside a product screen, comparison columns, chevron timeline, evidence legend.</li>
        <li><b style="color:${c('text')}">Captions</b> sit below the content and above the footer, never on top of a screen.</li>
      </ul>
    </div>
  </div>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>5</span></div>
</section>

<section class="pg">
  <div class="k">05 · Motion</div><h2>Slow, layered and always in reading order</h2>
  <table style="margin-top:10px"><tr><th style="width:20%">Element</th><th style="width:24%">Setting</th><th>Use</th></tr>
    ${motion.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>
  <p style="margin-top:10px">Animations are native PowerPoint effects written into the file, so they stay editable in the Animation Pane. They are written for PowerPoint 2019 or Microsoft 365 on Windows and Mac; other apps play a simpler version or none (see the technical notes). The PDF and image exports show the final state of each slide.</p>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>6</span></div>
</section>

<section class="pg">
  <div class="k">06 · Imagery and brand</div><h2>Real screens, framed and lit</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:12px">
    <div><img class="th" src="${thumb(8)}"><p style="margin-top:6px">Product screens sit in a dark window frame with a violet rim light. Tilt at most 16°, so text stays readable.</p></div>
    <div><img class="th" src="${thumb(6)}"><p style="margin-top:6px">The architecture brain is a real render of Immich. Always caption it as a navigation aid, never as the analysis itself.</p></div>
    <div><img class="th" src="${thumb(3)}"><p style="margin-top:6px">Generated 3D objects (the layer stack) explain a concept. They never stand in for a product screen.</p></div>
  </div>
  <ul style="margin-top:12px">
    <li>The mark is a triangle of three connected nodes in a violet-to-cyan ring. Keep clear space of half its width around it; do not recolour or stretch it.</li>
    <li>"CodeAtlas" is a working name until trademark clearance. Check before printing or registering anything with it.</li>
    <li>Do not use client logos, testimonials or case studies without written approval from that client.</li>
  </ul>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>7</span></div>
</section>

<section class="pg">
  <div class="k">07 · Presenting</div><h2>Run it as a conversation, not a reading</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:12px">
    <div class="card"><h3>Before the meeting</h3><ul>
      <li>Fill the amber placeholders: client name and date (slide 1), contact (22), team (21). Delete the currency row that does not apply (20).</li>
      <li>Install Manrope and Inter. Open in PowerPoint for Windows or Mac and play from slide 1 once to check the video and Morph.</li>
      <li>Have the live product ready on the Immich index as a backup demo for slides 8 to 10.</li></ul></div>
    <div class="card"><h3>In the room</h3><ul>
      <li>About 33 minutes for 23 slides by the presenter script timings, plus questions. For a shorter slot, use the 16-minute short path in the script.</li>
      <li>Let each slide finish building (under 2.5 s) before speaking to it.</li>
      <li>Say "illustrative" out loud on slides 5, 13 and 15. Invite the client to replace the numbers with theirs.</li>
      <li>Slides 17 and 18 can be skipped for a business-only audience; 5 and 15 for a technical deep dive.</li></ul></div>
    <div class="card"><h3>Sending it afterwards</h3><ul>
      <li>Send the PDF, not the PPTX. Its last page says motion is not included.</li>
      <li>Remove internal notes if you send the PPTX: the speaker notes contain presenter guidance.</li></ul></div>
    <div class="card"><h3>Claims you may and may not make</h3><ul>
      <li>May: the measured counts and timings on the slides, with their source.</li>
      <li>May not: "100 % accurate", "understands any codebase", certifications, customer names, or accuracy percentages before independent review.</li></ul></div>
  </div>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>8</span></div>
</section>

<section class="pg">
  <div class="k">08 · The deck at a glance</div><h2>Six acts, 23 slides</h2>
  <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin-top:12px">
    ${Array.from({ length: 23 }, (_, i) => `<div><img class="th" src="${thumb(i + 1)}"><span style="font-size:8px;color:${c('muted')}">${i + 1}</span></div>`).join('')}
  </div>
  <p style="margin-top:6px">Acts: opportunity (1 to 5), solution (6 to 11), user transformation (12, 13), business value (14 to 16), technology, execution and trust (17 to 21), next step (22, 23).</p>
  <div class="foot"><span>CodeAtlas · Presentation design guide</span><span>9</span></div>
</section>
</body></html>`;

const note = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
@page{size:13.333in 7.5in;margin:0}
.pg{width:13.333in;height:7.5in;position:relative;background:url(${img(B('opt/bg-main.jpg'))}) center/cover;padding:.9in .65in}
</style></head><body><section class="pg">
  <div class="k" style="font-size:14px">About this PDF</div>
  <h1 style="font-size:40px;line-height:1.1;max-width:9in">This is the static version of a live presentation</h1>
  <p style="font-size:17px;margin-top:22px;max-width:9.6in;line-height:1.6">The presentation version (PowerPoint) includes slide transitions, build animations and, on the cover, a 20-second video of the CodeAtlas architecture brain rendering the open-source Immich repository. This PDF shows each slide in its final state and the cover shows one frame of that video.</p>
  <p style="font-size:17px;margin-top:16px;max-width:9.6in;line-height:1.6">Product images are unedited CodeAtlas screenshots of public open-source repositories, cropped and framed. Figures marked "illustrative" are assumptions for discussion, not measured client data.</p>
  <p style="font-size:13px;margin-top:40px;color:${c('muted')}">CodeAtlas is a working name, pending trademark clearance.</p>
</section></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(guide, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: B('CodeAtlas_Presentation_Design_Guide.pdf'), width: '297mm', height: '167mm', printBackground: true, preferCSSPageSize: true });
  await p.setContent(note, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: B('pdf-note.pdf'), width: '13.333in', height: '7.5in', printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log('wrote design guide and pdf note');
})();
