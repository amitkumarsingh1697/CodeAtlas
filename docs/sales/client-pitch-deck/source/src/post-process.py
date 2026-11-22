"""Adds what pptxgenjs cannot write: Morph transitions (fade fallback), entrance animations and
video autoplay/loop. Input: build/CodeAtlas_Client_Pitch_Deck.raw.pptx + build/animations.json.
Output: build/CodeAtlas_Client_Pitch_Deck.pptx. Run: python3 src/post-process.py (from the deck folder)."""
import json, re, shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'build' / 'CodeAtlas_Client_Pitch_Deck.raw.pptx'
OUT = ROOT / 'build' / 'CodeAtlas_Client_Pitch_Deck.pptx'
ANIMS = json.loads((ROOT / 'build' / 'animations.json').read_text())

DEFAULT_DUR = {'fade': 700, 'rise': 800, 'zoom': 900, 'wipe': 700}
MORPH_MS = 1000

TRANSITION = (
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
    '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
    f'<p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="slow" p14:dur="{MORPH_MS}">'
    '<p159:morph option="byObject"/></p:transition></mc:Choice>'
    '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
)


class Ids:
    def __init__(self):
        self.n = 2  # 1 = root, 2 = main sequence

    def __call__(self):
        self.n += 1
        return self.n


def set_visible(nid, spid):
    return (f'<p:set><p:cBhvr><p:cTn id="{nid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>'
            '</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>')


def anim_effect(nid, spid, dur, flt):
    return (f'<p:animEffect transition="in" filter="{flt}"><p:cBhvr><p:cTn id="{nid()}" dur="{dur}"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')


def anim_prop(nid, spid, dur, attr, frm, to, decel=True):
    d = ' decel="100000"' if decel else ''
    return (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="{nid()}" dur="{dur}" fill="hold"{d}/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>'
            f'<p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst></p:anim>')


def effect(nid, spid, fx, delay, dur, first):
    # presetID: 10 Fade, 42 Float In (rise), 53 Zoom, 22 Wipe (from left)
    preset = {'fade': (10, 0), 'rise': (42, 0), 'zoom': (53, 16), 'wipe': (22, 8)}[fx]
    node = 'afterEffect' if first else 'withEffect'
    body = set_visible(nid, spid)
    if fx == 'fade':
        body += anim_effect(nid, spid, dur, 'fade')
    elif fx == 'rise':
        body += anim_effect(nid, spid, dur, 'fade')
        body += anim_prop(nid, spid, dur, 'ppt_x', '#ppt_x', '#ppt_x', decel=False)
        body += anim_prop(nid, spid, dur, 'ppt_y', '#ppt_y+.06', '#ppt_y')
    elif fx == 'zoom':
        body += anim_effect(nid, spid, dur, 'fade')
        body += anim_prop(nid, spid, dur, 'ppt_w', '#ppt_w*0.88', '#ppt_w')
        body += anim_prop(nid, spid, dur, 'ppt_h', '#ppt_h*0.88', '#ppt_h')
    elif fx == 'wipe':
        body += anim_effect(nid, spid, dur, 'wipe(left)')
    return (f'<p:par><p:cTn id="{nid()}" presetID="{preset[0]}" presetClass="entr" presetSubtype="{preset[1]}" fill="hold" '
            f'grpId="0" nodeType="{node}"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}'
            '</p:childTnLst></p:cTn></p:par>')


def shapes_by_name(xml):
    """name -> list of (spid, kind). The title placeholder is also mapped to 'Title'."""
    out = {}
    for m in re.finditer(r'<p:(sp|pic|graphicFrame|cxnSp)>\s*<p:nv\w+Pr><p:cNvPr id="(\d+)" name="([^"]*)"', xml):
        kind, spid, name = m.group(1), m.group(2), m.group(3)
        out.setdefault(name, []).append((spid, kind))
    return out


def process(xml, anims, idx):
    # Give the title placeholder a readable name in the selection pane.
    xml = re.sub(r'(<p:cNvPr id="\d+" name=")Text \d+("[^>]*>(?:(?!</p:nvSpPr>).)*<p:ph[^>]*type="title")', r'\1Title\2', xml, flags=re.S)
    names = shapes_by_name(xml)
    nid = Ids()
    g_outer, g_inner = nid(), nid()  # ids in document order: root 1, main sequence 2, groups 3-4, effects after
    effects, bld, video = [], [], None
    first = True
    vid = re.search(r'<p:pic>\s*<p:nvPicPr><p:cNvPr id="(\d+)"[^>]*>(?:(?!</p:nvPicPr>).)*<a:videoFile', xml, re.S)
    if vid:
        spid = vid.group(1)
        effects.append(f'<p:par><p:cTn id="{nid()}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect">'
                       '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)">'
                       f'<p:cBhvr><p:cTn id="{nid()}" dur="20000" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:cmd>'
                       '</p:childTnLst></p:cTn></p:par>')
        video = spid
        first = False
    missing = []
    for a in anims:
        targets = names.get(a['name'])
        if not targets:
            missing.append(a['name'])
            continue
        for spid, kind in targets:
            effects.append(effect(nid, spid, a['fx'], a.get('delay', 0), a.get('dur', DEFAULT_DUR[a['fx']]), first))
            first = False
            if kind == 'sp' and spid not in [b for b in bld]:
                bld.append(spid)
    if missing:
        sys.exit(f'slide {idx}: animation targets not found: {missing}')
    timing = ''
    if effects:
        seq = (f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
               f'<p:par><p:cTn id="{g_outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
               '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
               f'<p:par><p:cTn id="{g_inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
               + ''.join(effects) +
               '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>'
               '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
               '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>')
        media = ''
        if video:
            media = (f'<p:video><p:cMediaNode vol="0" mute="1"><p:cTn id="{nid()}" repeatCount="indefinite" fill="hold" display="0">'
                     '<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn>'
                     f'<p:tgtEl><p:spTgt spid="{video}"/></p:tgtEl></p:cMediaNode></p:video>')
        blds = ''.join(f'<p:bldP spid="{s}" grpId="0" animBg="1"/>' for s in bld)
        timing = ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
                  + seq + media + '</p:childTnLst></p:cTn></p:par></p:tnLst>'
                  + (f'<p:bldLst>{blds}</p:bldLst>' if blds else '') + '</p:timing>')
    assert '<p:transition' not in xml and '<p:timing' not in xml, 'raw slide already has transition/timing'
    return xml.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + TRANSITION + timing, 1)


def main():
    zin = zipfile.ZipFile(RAW)
    tmp = OUT.with_suffix('.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.endswith('/'):
                continue  # folder entries break some cloud viewers
            data = zin.read(item.filename)
            m = re.fullmatch(r'ppt/slides/slide(\d+)\.xml', item.filename)
            if m:
                i = int(m.group(1))
                data = process(data.decode('utf-8'), ANIMS[i - 1], i).encode('utf-8')
            # media is already compressed; store it to keep the save fast
            ctype = zipfile.ZIP_STORED if item.filename.startswith('ppt/media/') and item.filename.endswith(('.mp4', '.jpg', '.jpeg')) else zipfile.ZIP_DEFLATED
            zout.writestr(item, data, compress_type=ctype)
    shutil.move(tmp, OUT)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
