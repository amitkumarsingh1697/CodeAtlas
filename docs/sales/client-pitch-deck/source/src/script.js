// Presenter script: one entry per slide. Used for the PPTX speaker notes and the presenter-script DOCX.
// Figures quoted here come from the CodeAtlas runs recorded in the asset inventory (22 Nov 2026).
module.exports = [
  {
    title: 'Understand complex software before you change it',
    objective: 'Set the theme in one sentence and earn the next ten minutes.',
    key: 'CodeAtlas helps teams understand a system they did not build, without the code leaving their machine.',
    notes:
      'Let the video run for a few seconds before you speak. What they are looking at is not an illustration: it is CodeAtlas drawing the open-source Immich photo platform, about 3,600 files, as a navigable map. Open with the problem, not the product: "Every team in this room has inherited code it did not write. Today is about understanding that code before you change it."',
    points: [
      'The visual is a real render of a public repository, not a mock-up.',
      'One promise: understand, see the connections, then change.',
      'Local-first: the analysis runs where the code lives.',
    ],
    transition: '"Let me summarise what we do in one slide, then show you why it matters."',
    minutes: 0.5,
  },
  {
    title: 'CodeAtlas turns an unfamiliar codebase into a map you can defend',
    objective: 'Give the decision-maker the whole story in 60 seconds.',
    key: 'A local-first analysis engine plus a fixed-scope assessment, built for teams that inherit systems.',
    notes:
      'Walk the four cards left to right. Stress "map you can defend": every link carries its evidence. Close on the bottom line: the code stays on their machine, and indexing runs with no network connection, which an automated test checks on every change.',
    points: [
      'What: local code intelligence across modules, APIs, calls and tables.',
      'Who: modernization consultancies, CTOs, engineering leads.',
      'Why: observed, inferred and unknown are shown, so gaps are visible early.',
      'Start: one bounded assessment on one repository.',
    ],
    transition: '"Why does this matter now? Because of how software estates have changed."',
    minutes: 1.5,
  },
  {
    title: 'Every modernization starts with a system nobody fully remembers',
    objective: 'Make the audience recognise their own situation.',
    key: 'Systems outlive their authors, change is speeding up, and code often cannot leave the building.',
    notes:
      'Ask: "When did your team last inherit a codebase? How long before you trusted your understanding of it?" Let them answer. Point to the layers: interface, APIs, services, data, build and CI. Knowledge of how those layers connect usually lives in a few people\'s heads.',
    points: [
      'Documentation drifts from what actually runs.',
      'AI coding tools speed up writing changes; understanding what a change touches is still manual.',
      'Client contracts and security policies often rule out uploading source to a hosted service.',
    ],
    transition: '"Here is what that looks like from the inside."',
    minutes: 1.5,
  },
  {
    title: 'Discovery is slow, manual and hard to prove',
    objective: 'Make the problem visible and felt.',
    key: 'Real systems are dense; manual discovery costs senior time and produces findings nobody can trace.',
    notes:
      'The image is real CodeAtlas output: the 250 most connected files of the Immich server module, which has 765 files. Say: "This is one module of one open-source application. Your client systems are usually larger and older." Then walk the four pains. Pause on "findings are hard to defend": a diagram on a whiteboard does not say where each line came from or what was not checked.',
    points: [
      'Senior engineers spend weeks reading instead of delivering.',
      'Hidden dependencies surface after the estimate is agreed.',
      'Findings without sources are hard to defend to a client or a board.',
      'Upload-based tools are often ruled out by confidentiality.',
    ],
    transition: '"What does that cost? Let us put your own numbers on it."',
    minutes: 1.5,
  },
  {
    title: 'The cost of not knowing shows up in effort, estimates and risk',
    objective: 'Translate the pain into money, transparently.',
    key: 'Discovery cost is people x days x day rate, plus the cost of surprises.',
    notes:
      'The numbers on this slide are illustrative and marked as such. Ask the client for their own: how many engineers, how many days, what loaded day rate. Write them in. The point is not our example; it is that discovery is a real line item that is rarely measured. The hidden costs on the right are usually larger and harder to see.',
    points: [
      'Illustrative: 3 engineers x 15 days x INR 15,000 = INR 6.75 lakh (or x USD 600 = USD 27,000).',
      'Hidden costs: re-estimates, senior capacity taken from delivery, risk accepted without evidence.',
      'We will measure actual effort in a pilot instead of claiming savings.',
    ],
    transition: '"So what would it look like if the map already existed?"',
    minutes: 1.5,
  },
  {
    title: 'Meet CodeAtlas: a map of your system, with the evidence behind every line',
    objective: 'Reveal the product and its promise.',
    key: 'Understand what exists, see how it connects, and know what is not covered.',
    notes:
      'Slow down here. The three promises are the product in one line each. Be precise about the brain view: it is a navigation aid, and its lobe placement is inferred from paths and imports. The 2D views you are about to see are the primary architecture views in an assessment.',
    points: [
      'Understand what exists: inventory and coverage of every file.',
      'See how it connects: routes, calls, tables, dependencies.',
      'Know what is not covered: gaps are listed, not hidden.',
    ],
    transition: '"Here is how a repository becomes that map."',
    minutes: 1,
  },
  {
    title: 'Four steps from repository to decision',
    objective: 'Show that the workflow is simple and contained.',
    key: 'Point, analyse locally, explore with evidence, decide.',
    notes:
      'Walk the four steps. Mention the measured speed: Immich, 3,656 files, indexed in 42 seconds on a 4-vCPU cloud machine; Spring PetClinic in 1.4 seconds. These are single runs, not a performance guarantee: timing depends on the repository and the machine.',
    points: [
      'Exclusions are under the user\'s control; credential-like files are never read.',
      'Compilers and parsers, not guesses: TypeScript compiler API, tree-sitter grammars, PostgreSQL\'s own SQL parser.',
      'Outputs: web explorer, CLI, a single offline HTML map and a structured assessment data model.',
    ],
    transition: '"Let me show you the actual screens."',
    minutes: 1.5,
  },
  {
    title: 'Real screens, real repository: what your team will use',
    objective: 'Make the product tangible; build trust that it exists.',
    key: 'Everything shown is the working product on a public codebase.',
    notes:
      'If you can, switch to a live demo here (15 to 20 minutes, see the demo sequence in the sales playbook). Otherwise walk the three screens: the overview with coverage, the ER diagram drawn from migrations, and the architecture brain with a method\'s evidence panel. Every screen is CodeAtlas v0.1.0 on Immich at commit e5d6eb7, captured on 22 Nov 2026, cropped and framed but not edited.',
    points: [
      'Overview: files analysed, symbols, routes, and how each link was made.',
      'ER diagram: 35 tables drawn from Immich\'s initial migration.',
      'Brain: click any method to see inputs, outputs and cited links.',
    ],
    transition: '"The best way to judge it is to follow one request end to end."',
    minutes: 1.5,
  },
  {
    title: 'Follow one request from the API to the database, with proof at every step',
    objective: 'Demonstrate the core value with one concrete trace.',
    key: 'A route is traced to its handler, services and repositories, and every link says how it was found.',
    notes:
      'Point at GET /albums/:id. It is handled by AlbumController.getAlbumInfo (observed, from the decorator at album.controller.ts line 62), which calls AlbumService.get and from there the repositories. Solid lines are observed, dashed amber lines are inferred, dotted lines are unknown. Read the caption under the canvas aloud: flows follow resolved calls; callbacks and computed members are not followed and are reported in the coverage report.',
    points: [
      'Observed: the compiler or the source states it.',
      'Inferred: a named rule matched; the rule is shown so it can be checked.',
      'Unknown: seen but unresolved; counted, never hidden.',
    ],
    transition: '"That labelling is the heart of the product, so let us look at it across a whole repository."',
    minutes: 2,
  },
  {
    title: 'Every relationship tells you how it was found',
    objective: 'Establish the evidence model as the key differentiator.',
    key: '257,281 relationships in one run, each one labelled; unresolved items are listed with the cap disclosed.',
    notes:
      'These counts are the output of one run on Immich (assessment data model v1, 22 Nov 2026). They are counts, not accuracy figures. Accuracy benchmarks exist internally and will be published per stack once they have been independently reviewed; say so if asked. The panel on the right is the real evidence panel for one method.',
    points: [
      'Observed 142,612; inferred 112,879; unknown 1,790.',
      'Inferred links carry the rule that produced them.',
      '5,480 unresolved items are stored and listed; when a cap is hit the report says so.',
    ],
    transition: '"Here is how those capabilities map to the questions your team asks every week."',
    minutes: 2,
  },
  {
    title: 'Each capability answers a question your team already asks',
    objective: 'Connect features to real problems, not a checklist.',
    key: 'Six questions, six capabilities, each with visible evidence.',
    notes:
      'Pick the two questions most relevant to this client and spend your time there. For a consultancy: "what is in this repository" and "which code serves this API". For a CTO: "which code reads or writes this table" and "what might this change affect". Be precise that impact analysis is an aid, not a guarantee of the full blast radius.',
    points: [
      'Immich example: 315 HTTP routes mapped to handlers; 96 files found in one import cycle.',
      'Tables come from SQL, ORM models and migrations of 23 frameworks.',
      'Ask answers with numbered citations; AI uses a local model by default and can be turned off.',
    ],
    transition: '"What changes for the people doing this work?"',
    minutes: 1.5,
  },
  {
    title: 'From manual archaeology to an evidence-backed map',
    objective: 'Show the transformation in one glance.',
    key: 'The same work, done from evidence and in a fraction of the elapsed time for the mapping step.',
    notes:
      'Read across the rows: each "before" has an "after". Be careful with time: the measured part is the indexing (42 seconds for Immich). Reviewing and interpreting findings still takes expert time; CodeAtlas removes the manual mapping, not the judgement.',
    points: [
      'Diagrams are generated from source, not redrawn.',
      'Every link cites file and line.',
      'Coverage and gaps are stated before the work starts.',
    ],
    transition: '"Where does this fit in practice? Four typical moments."',
    minutes: 1,
  },
  {
    title: 'Where teams use it: four typical moments',
    objective: 'Help each stakeholder see their own use case.',
    key: 'Scoping, database change, due diligence and onboarding.',
    notes:
      'These are illustrative scenarios, not customer case studies: say so. Ask which one is closest to the client\'s situation and go deeper on that one. If none fits, ask about their last inherited codebase.',
    points: [
      'Consultancy: quote a migration from observed dependencies.',
      'CTO: list readers and writers of a table before splitting it.',
      'Due diligence: baseline a target\'s architecture without moving its code.',
      'Onboarding: a navigable map and cited answers.',
    ],
    transition: '"What does that mean for the business, beyond engineering?"',
    minutes: 2,
  },
  {
    title: 'Value for the business, not only for engineers',
    objective: 'Speak to the buyer\'s outcomes.',
    key: 'Win and scope work confidently, de-risk change, and keep control of the code.',
    notes:
      'Match the pillar to the person in the room: delivery heads care about the first, CTOs about the second, security and legal about the third. Keep it short.',
    points: [
      'Consultancies: scope from evidence and show a cited baseline.',
      'CTOs: see what a change touches; make unknowns explicit in plans.',
      'Security: local analysis, no telemetry, open engine.',
    ],
    transition: '"Is it worth the money? Here is a simple way to test that."',
    minutes: 1.5,
  },
  {
    title: 'A simple test: the assessment must save more effort than it costs',
    objective: 'Give the economic buyer a transparent business case.',
    key: 'Break-even = fee / loaded day rate; the pilot measures whether that is met.',
    notes:
      'Use the client\'s day rate. With the illustrative figures, a Standard assessment breaks even if it saves about 15 engineer-days in India or 10 internationally. We do not claim a saving we have not measured; the pilot is designed to measure it, and the client keeps the data.',
    points: [
      'Fees are indicative test prices; day rates are illustrative.',
      'Pilot metrics: discovery hours, findings used, findings wrong, decisions changed.',
      'If the numbers do not work for them, that is a useful answer too.',
    ],
    transition: '"How should you compare us with other options?"',
    minutes: 2,
  },
  {
    title: 'Five questions to ask any code-intelligence tool, and our answers',
    objective: 'Differentiate on verifiable properties, not adjectives.',
    key: 'Local execution, evidence labels, visible coverage, code-to-database links, an open engine.',
    notes:
      'This slide is deliberately not a competitor grid: we do not claim superiority over named tools without a comparative test. Invite them to ask these questions of every option they evaluate, including us, and to check our answers in the demo.',
    points: [
      'Each answer has a way to verify it.',
      'The egress test runs on Linux; macOS and Windows are not yet covered by it.',
      'The engine is public under Apache-2.0.',
    ],
    transition: '"Under the hood, it is built to run where your code lives."',
    minutes: 2,
  },
  {
    title: 'Built to run where your code lives',
    objective: 'Answer the technical and security questions early.',
    key: 'One local process, a local index, loopback-only UI; optional AI stays local unless explicitly allowed.',
    notes:
      'Walk left to right: repository on disk, the local engine and its readers, the SQLite index, then the four outputs. Then the dotted box: the only flows that can leave the machine are started by a user (asking an AI question with a remote model, which needs explicit consent; cloning a public repository; running the repository\'s own test scripts in an investigation). No telemetry exists.',
    points: [
      'Web UI binds to 127.0.0.1 and needs a session token.',
      'Credential-like files are listed but never read.',
      'Egress test in CI: index, assessment and brain make no network connection.',
    ],
    transition: '"Here is what is proven today and what comes next."',
    minutes: 1.5,
  },
  {
    title: 'What is proven today, and what comes next',
    objective: 'Separate existing capabilities from plans; build credibility through honesty.',
    key: 'A working engine today; the report generator, published benchmarks and wider packaging are next.',
    notes:
      'Be explicit that the middle and right columns are plans, not commitments with dates. The lead stack is TypeScript with PostgreSQL; Java with Spring is second; other languages get inventory and structure. Read the limit line: CodeAtlas reads source and does not run the application.',
    points: [
      'Available now: engine, UI, CLI, offline map, assessment data model, ArchLens skill.',
      'Next: report generator, published per-stack benchmarks, run comparison, signed installers.',
      'Later: multi-repository, CI drift checks, MCP adapter, team features.',
    ],
    transition: '"So how would we start working together?"',
    minutes: 1.5,
  },
  {
    title: 'A bounded engagement your team can approve quickly',
    objective: 'Make adoption feel low-risk and concrete.',
    key: 'Scope, set up, analyse and review, present.',
    notes:
      'Emphasise the written scope and exclusions, and that analysis runs in their environment by default. Any optional data transfer or AI service needs their separate written approval. They keep the outputs.',
    points: [
      'We need: written authorisation, an environment, a technical contact, review time.',
      'Deliverables: inventory, architecture overview, dependency and data findings, evidence appendix, coverage and limits, impact walkthrough, report, workshop.',
      'Exclusions: runtime guarantees, full manual audit, penetration testing, unsupported stacks.',
    ],
    transition: '"Here are the options."',
    minutes: 1.5,
  },
  {
    title: 'Start small, with a fixed price and a written scope',
    objective: 'Make the offer and anchor the price.',
    key: 'Three fixed-scope packages and a discounted design-partner pilot.',
    notes:
      'Prices are indicative and confirmed after a scoping call; delete the currency row that does not apply to this client before sending. We do not price by lines of code. Offer the design-partner pilot to early clients who will give structured feedback; any reference use needs their written approval.',
    points: [
      'Discovery: one bounded repository, inventory, overview, coverage and findings.',
      'Standard: adds dependency, API and database findings and an impact walkthrough.',
      'Complex: larger or multi-module scope, deeper framework review and a workshop.',
    ],
    transition: '"Why work with us specifically?"',
    minutes: 1.5,
  },
  {
    title: 'How we work: evidence first, scope in writing, your code stays yours',
    objective: 'Build trust in the team and its discipline.',
    key: 'Principles backed by engineering evidence anyone can inspect.',
    notes:
      'Add the team profiles before using this deck (the placeholder card). Do not add client names, certifications or case studies until they exist and are approved. The engineering evidence is real: the test suite, the egress test, the SBOM and the hostile-repository tests run in CI.',
    points: [
      'We publish what we cannot see.',
      'Fixed scope, written exclusions, no surprise invoices.',
      'Open engine: the client\'s engineers can read the code that reads their code.',
    ],
    transition: '"Here is the next step."',
    minutes: 1,
  },
  {
    title: 'Let\'s map one of your systems',
    objective: 'Close with one clear, low-friction action.',
    key: 'Book a 30-minute scoping call; pick one repository and the decision it supports.',
    notes:
      'Ask for the meeting directly: "Which system would you want to understand first, and what decision depends on it?" Agree a date for the scoping call before you leave the room.',
    points: [
      'Step 1: 30-minute scoping call.',
      'Step 2: one repository, one decision.',
      'Step 3: findings workshop.',
    ],
    transition: 'Move to the closing slide and stop talking.',
    minutes: 1,
  },
  {
    title: 'Understand what exists. See how it connects. Change with confidence.',
    objective: 'Leave one memorable line.',
    key: 'The promise, restated.',
    notes: 'Leave this slide up during questions.',
    points: ['Take questions.', 'Confirm the follow-up date.'],
    transition: 'End.',
    minutes: 0.5,
  },
];
