"""Presenter script DOCX from build/script.json. Run: python3 src/make-script-docx.py (from the deck folder)."""
import json
from pathlib import Path
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

ROOT = Path(__file__).resolve().parent.parent
S = json.loads((ROOT / 'build' / 'script.json').read_text())
VIOLET, SLATE, MUTED, INK = RGBColor(0x5B, 0x3D, 0xF0), RGBColor(0x3A, 0x41, 0x5E), RGBColor(0x6B, 0x73, 0x94), RGBColor(0x12, 0x15, 0x2B)
ACTS = {1: 'Act 1 · The opportunity', 6: 'Act 2 · Our solution', 12: 'Act 3 · User transformation', 14: 'Act 4 · Business value',
        17: 'Act 5 · Technology, execution and trust', 22: 'Act 6 · The next step'}
SHORT = [1, 2, 4, 6, 8, 9, 10, 15, 19, 20, 22]

doc = Document()
sec = doc.sections[0]
sec.left_margin = sec.right_margin = Cm(2.2)
sec.top_margin = sec.bottom_margin = Cm(2)
st = doc.styles['Normal']
st.font.name = 'Inter'
st.font.size = Pt(10.5)
st.font.color.rgb = SLATE
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Inter')
for name, size, color in [('Title', 26, INK), ('Heading 1', 16, VIOLET), ('Heading 2', 13.5, INK)]:
    s = doc.styles[name]
    s.font.name = 'Manrope'
    s.font.size = Pt(size)
    s.font.bold = True
    s.font.color.rgb = color
    rf = s.element.rPr.rFonts
    for att in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
        rf.attrib.pop(qn(att), None)


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), hexcolor)
    tcPr.append(sh)


def label_para(label, text, after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    r = p.add_run(label + '  ')
    r.bold = True; r.font.color.rgb = INK
    p.add_run(text)
    return p


# Footer with page numbers
fp = sec.footer.paragraphs[0]
fp.text = 'CodeAtlas · Client pitch deck · Presenter script   '
fp.runs[0].font.size = Pt(8.5); fp.runs[0].font.color.rgb = MUTED
for tag, txt in [('begin', None), (None, 'PAGE'), ('end', None)]:
    r = fp.add_run(); r.font.size = Pt(8.5); r.font.color.rgb = MUTED
    if tag:
        fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), tag); r._r.append(fc)
    else:
        it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = txt; r._r.append(it)

doc.add_paragraph('CodeAtlas client pitch deck', style='Title')
p = doc.add_paragraph('Presenter script · 23 slides · version 1, 22 November 2026')
p.runs[0].font.color.rgb = MUTED
total = sum(s['minutes'] for s in S)
doc.add_heading('How to use this script', level=1)
for t in [
    f'Full talk: about {total:g} minutes of speaking, plus questions. Timings per slide are guides, not targets.',
    f'Short path (about {sum(S[i - 1]["minutes"] for i in SHORT):g} minutes of speaking): slides ' + ', '.join(map(str, SHORT)) + '. Hide the others in PowerPoint (right-click, Hide Slide) rather than deleting them.',
    'Each slide builds by itself in under 2.5 seconds. Let it finish before you speak to it.',
    'Say "illustrative" out loud whenever a slide carries the amber tag (slides 5, 13 and 15), and invite the client to use their own numbers.',
    'Quote only the measured figures shown on the slides, with their source. Do not quote accuracy percentages: they are not published until independently reviewed.',
    'The same notes are in the PowerPoint speaker notes (Presenter View).',
]:
    doc.add_paragraph(t, style='List Bullet')

doc.add_heading('Running order', level=1)
tbl = doc.add_table(rows=1, cols=4)
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl.style = 'Table Grid'
for i, h in enumerate(['#', 'Slide', 'Act', 'Min']):
    c = tbl.rows[0].cells[i]; c.text = h; shade(c, '161C3D')
    c.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); c.paragraphs[0].runs[0].bold = True
act = ''
for i, s in enumerate(S, 1):
    act = ACTS.get(i, act)
    row = tbl.add_row().cells
    for j, v in enumerate([str(i), s['title'], act.split(' · ')[1], f"{s['minutes']:g}"]):
        row[j].text = v
        row[j].paragraphs[0].runs[0].font.size = Pt(9.5)
tbl.autofit = False
for j, w in enumerate([Cm(1), Cm(9.6), Cm(4.6), Cm(1.4)]):
    tbl.columns[j].width = w
    for cell in tbl.columns[j].cells:
        cell.width = w

act = ''
for i, s in enumerate(S, 1):
    if i in ACTS:
        doc.add_page_break()
        doc.add_heading(ACTS[i], level=1)
    doc.add_heading(f"Slide {i}: {s['title']}", level=2)
    label_para('Duration', f"about {s['minutes']:g} min" + ('  ·  in the short path' if i in SHORT else ''))
    label_para('Objective', s['objective'])
    label_para('Key message', s['key'])
    label_para('Speaker notes', s['notes'])
    pp = doc.add_paragraph(); r = pp.add_run('Talking points'); r.bold = True; r.font.color.rgb = INK
    pp.paragraph_format.space_after = Pt(2)
    for t in s['points']:
        doc.add_paragraph(t, style='List Bullet')
    label_para('Transition', s['transition'], after=12)

doc.core_properties.title = 'CodeAtlas client pitch deck: presenter script'
doc.core_properties.author = 'CodeAtlas'
# python-docx's default template writes <w:zoom> without the required percent attribute.
for z in doc.settings.element.findall(qn('w:zoom')):
    z.set(qn('w:percent'), '100')
out = ROOT / 'build' / 'CodeAtlas_Presenter_Script.docx'
doc.save(out)
print('wrote', out)
