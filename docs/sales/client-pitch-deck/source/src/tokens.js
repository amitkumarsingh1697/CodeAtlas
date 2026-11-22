// CodeAtlas pitch deck design tokens. One source for the deck, the assets and the design guide.
module.exports = {
  color: {
    bg0: '05060D', // deepest midnight (cover, closing, brain renders)
    bg1: '080B1C', // main slide background
    surface: '0F1430', // cards
    surface2: '161C3D', // raised cards, table headers
    stroke: '2A3263', // hairlines, card borders
    violet: '7C5CFF', // primary: brand, emphasis
    violetLight: 'A594FF', // primary tint: kickers on violet, chart secondary
    cyan: '22D3EE', // secondary: observed evidence, data highlights
    cyanSoft: '67E8F9',
    amber: 'F5B841', // accent: inferred evidence, assumptions, "illustrative" tags
    rose: 'F472B6', // rare highlight (risk)
    text: 'F4F6FF', // primary text
    text2: 'B9C1DD', // secondary text
    muted: '8089AE', // captions, footers, unknown evidence
  },
  font: {
    display: 'Manrope ExtraBold', // titles, big numbers
    sub: 'Manrope SemiBold', // subtitles, card headings
    body: 'Inter', // body, captions, labels
  },
};
