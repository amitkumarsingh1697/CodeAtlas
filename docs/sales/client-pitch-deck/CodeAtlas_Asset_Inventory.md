# CodeAtlas client pitch deck: asset inventory

Version 1, 22 November 2026. Every visual in `CodeAtlas_Client_Pitch_Deck.pptx`, where it came from, and what to replace before a client sees it.

## 1. Where the product visuals come from

All product screens and the 3D brain are **real CodeAtlas output**. Nothing was mocked up or retouched; screenshots were only cropped, framed (window chrome, border, shadow) and, on slide 8, tilted in perspective.

| Item | Value |
| --- | --- |
| CodeAtlas build | `amitkumarsingh1697/codeatlas`, commit `e688dcf` (17 Nov 2026), service run locally on 127.0.0.1:4317 |
| Repository 1 | Immich (open source, AGPL-3.0), `github.com/immich-app/immich`, commit `e5d6eb7` |
| Repository 2 | Spring PetClinic (open source, Apache-2.0), `github.com/spring-projects/spring-petclinic`, commit `500158f` |
| Machine | 4-vCPU Linux cloud container, Node v22.23.5 |
| Capture | Playwright Chromium, 1600 × 1000 viewport at 2× pixel density, 22 Nov 2026 |

Showing screenshots of these public repositories is showing our own tool's output about public code. Their names appear only as the analysed subject, never as customers.

## 2. Measured figures used on slides

Source files: `immich-assessment.json` and `petclinic-assessment.json` (CodeAtlas `assessment` command, 22 Nov 2026). Single runs; not a benchmark.

| Figure | Value | Slides |
| --- | --- | --- |
| Immich files / analysed | 3,656 / 3,154 | 1, 7, 8, 11 |
| Immich routes | 315 (269 observed, 46 inferred) | 11 |
| Immich tables | 104 | 11 |
| Immich relationships | 257,281: 142,612 observed, 112,879 inferred, 1,790 unknown | 10 |
| Unresolved call sites | 5,480 stored and listed (a listing cap was reached, and the report says so) | 10 |
| Immich index time | 42.1 s | 7, 12 |
| Files in one import cycle | 96 | 11 |
| Server module | 765 files (slide 4 shows its 250 most connected files) | 4 |
| PetClinic | 132 files, 17 routes, 7 tables, 1.4 s | 7, 9 |
| Automated tests | 784 passed, `pnpm -r --workspace-concurrency=1 test`, 22 Nov 2026 | 21 |
| Languages | TypeScript/JavaScript plus 71 tree-sitter grammars ("70+"), ORM and migrations of 23 frameworks (README) | 7, 11, 17, 18 |

**Not used on purpose:** precision and recall percentages. They stay out of client material until the independent spot-check is done.

## 3. Illustrative values (assumptions, tagged on the slide)

| Slide | Values | Source |
| --- | --- | --- |
| 5 | 3 engineers × 15 days × ₹15,000 (USD 600) per day = ₹6.75 lakh (USD 27,000) | Example assumptions, tagged "Illustrative · use your numbers" |
| 13 | Four use-case scenarios | Tagged "Illustrative scenarios"; no real clients |
| 15 | Break-even 15 engineer-days (India) and 10 (international) | Standard package fee ÷ the illustrative day rate |
| 20 | ₹1.5 lakh / ₹2.25 lakh / ₹3 lakh+ and USD 5,000 / 6,000 / 7,500+ | Indicative prices from the pricing hypothesis (strategy doc 11). Confirm before sending |

## 4. Files used in the deck

### Product screens (real screenshots)

| File (in `build/img`) | Source screenshot (in `assets`) | Slide |
| --- | --- | --- |
| `screen-hairball.png` | `crop-hairball.png` from `immich-deps.png` (Dependencies, Immich server) | 4 |
| `tilt-l-overview.png` | `crop-overview.png` from `immich-overview.png` (Overview and coverage report) | 8 |
| `tilt-r-er.png` | `crop-er.png` from `immich-er.png` (ER diagram from migrations) | 8 |
| `screen-brainmethod.png` | `brain-method.png` from `immich-brain-method.png` (brain with the evidence panel for `AlbumController.getAlbumInfo`) | 8 |
| `screen-flow.png` | `crop-flow.png` from `immich-flow.png` (Flows, `GET /albums/:id` to repository) | 9 |
| `crop-method-panel.png` | from `immich-brain-method.png` (evidence panel only) | 10 |

### 3D brain (real render, motion added)

| File | What it is | Slide |
| --- | --- | --- |
| `brain-loop.mp4` | 20 s H.264 loop, 1920 × 1080, muted, 5.4 MB. 300 frames of the CodeAtlas offline brain map of Immich, rotated by a scripted mouse drag, composited over `bg-hero.jpg`, played forward then backward | 1 (video) |
| `brain-poster.jpg` | First frame of the loop | 1 (poster frame, shown in PDF and where video is unsupported), 23 |
| `brain-alt.jpg` | Frame at 9.8 s (another angle) | 6 |

The brain map was generated with `codeatlas brain --exclude "i18n/**" --exclude "open-api/**"`, so translation files and the generated OpenAPI client are left out (24,055 parts instead of about 100,000) to keep the render smooth. The slide caption calls it a navigation aid, which it is.

### Generated design assets (rendered from HTML/CSS by `src/make-assets.js`)

| File | What it is | Slides |
| --- | --- | --- |
| `bg-hero.jpg` | Midnight background with violet and cyan light, stars and a perspective grid floor | Cover, statement and closing layouts (1, 6, 22, 23) |
| `bg-main.jpg` | Midnight background with a faint dot grid and vignette | Content layout (all other slides) |
| `glow-violet.png`, `glow-cyan.png` | Transparent light orbs, moved by Morph between slides | All |
| `layers3d.png` | Five glass layers (interface, APIs, services, data, build) with evidence beams | 3 |
| `brand-mark.png` | CodeAtlas mark, drawn as SVG in `src/build-deck.js` | All |

### Icons

Lucide icons from `react-icons` 5.4.0 (`lu` set, ISC licence), rendered to PNG in the palette colours: ArrowRight, BadgeCheck, BookOpen, Bot, Box, Brain, Briefcase, Building2, CalendarCheck, Check, CircleHelp, Clock, Code, Coins, Compass, Cpu, Database, Eye, EyeOff, FileJson, FileSearch, FileText, FolderGit2, GitBranch, GitCompare, Globe, GraduationCap, Handshake, History, KeyRound, Layers, ListChecks, Lock, Mail, Map, MessageSquare, Monitor, Network, Package, Phone, Rocket, Route, Scale, ScanSearch, Search, Server, ShieldCheck, Target, Terminal, TriangleAlert, UserSearch, Users, WifiOff, Workflow, Zap. (Not every one appears on a slide.)

### Fonts

Manrope (ExtraBold 800, SemiBold 600) and Inter, both SIL Open Font License. TTFs for Manrope are in `source/fonts`.

### Built but not used (available alternatives)

Framed and tilted versions of every screen: `screen-`, `tilt-l-` and `tilt-r-` for `overview`, `er`, `flow`, `petclinic` (PetClinic flow), `hairball`, `repos` (local repository list) and `brainmethod`. Swap them in through `src/build-deck.js`.

## 5. Not available: no videos, renders or photos beyond the above

There are no customer logos, testimonials, case studies, team photos, stock photos or product demo videos in the deck, because none exist yet. Nothing was invented to fill those gaps.

## 6. Replace before sending

| Slide | Placeholder (shown in amber) | Replace with |
| --- | --- | --- |
| 1 | `[Client name]`, `[Month Year]` | The prospect's name and the meeting date |
| 21 | Team card `[Add founder and delivery-lead profiles …]` | Real names, roles and relevant experience; verified facts only |
| 22 | `[Name, role]`, `[email address]`, `[phone]` | Your contact details |
| 20 | Two currencies | Delete the currency row that does not apply; confirm prices |
| All | "CodeAtlas" | Keep only after trademark clearance |

Worth adding when they exist: a sample assessment report (the report generator is not built yet), approved accuracy figures after the independent spot-check, a reference client with written permission, and a short screen recording of the live product.
