# CodeAtlas — UI/UX Design Specification

## 1. Design direction
Professional developer tool with an enterprise-grade, restrained visual language. Use dark mode as the primary product presentation if validated by user testing, but provide accessible light mode. The 3D/brain metaphor may be retained as an optional visualization, not the default information architecture.

Avoid a visually impressive interface that hides uncertainty or makes graph density unreadable.

## 2. Core information architecture
1. Home / Projects
2. New Analysis
3. Analysis Progress
4. Project Overview
5. Architecture Explorer
6. Dependency Explorer
7. Database Explorer
8. API / Routes Explorer
9. Change Impact
10. Coverage & Confidence
11. Reports
12. Settings / Scan Policy
13. Help / Supported Capabilities

## 3. Primary workflow
### First run
Welcome → explain local processing → choose repository → review exclusions and scan scope → run analysis → show progress → results overview → inspect evidence → preview report → export.

### Returning user
Projects → choose project → select latest run or compare runs → inspect changes/impact → export updated report.

## 4. Screen requirements
### A. Home / Projects
- Clear CTA: Analyze a repository.
- Recent projects and last analysis status.
- Supported stack notice.
- Local-processing explanation and link to data-flow details.
- Empty state with sample project option.

### B. New Analysis
- Repository path picker.
- Project label (optional).
- Scan profile and exclusions.
- Show files excluded by default.
- Network status: core analysis runs offline.
- Explain any optional network/model feature separately.
- Confirm scan scope before execution.

### C. Progress
- Stages: inventory, parsing, resolution, graph construction, coverage, report.
- Counters: files scanned, supported, unsupported, failed, skipped.
- Cancellation.
- Partial-success messaging.
- No fake percentage if total work is unknown.

### D. Overview
- Executive summary.
- Technology and module inventory.
- Coverage status.
- Observed/inferred/unknown distribution.
- Top unresolved areas.
- High-impact components (describe methodology).
- Suggested exploration paths.

### E. Architecture Explorer
- Search-first layout.
- Filters for node types and evidence class.
- Graph canvas with progressive expansion.
- Details panel with provenance and limitations.
- Avoid showing all nodes at once.
- Keyboard navigation and accessible list alternative.

### F. Dependency Explorer
- Upstream/downstream views.
- Relationship type and direction.
- Bounded depth.
- Evidence filter.
- Explain why each edge exists.

### G. Database Explorer
- Tables, columns, constraints and relationships.
- Code-to-table mapping only where supported.
- Distinguish declared schema facts from inferred code references.
- Show migration source and line provenance.

### H. Change Impact
- Select component/symbol/table.
- Show direct and transitive dependencies.
- Group by evidence class.
- Show likely affected tests/routes/services.
- Explicit caveat: impact is an analysis aid, not a guarantee of complete blast radius.

### I. Coverage & Confidence
- Files by status.
- Languages/frameworks detected.
- Parsed vs semantically resolved.
- Observed vs inferred relationships.
- Unsupported constructs and unresolved candidates.
- Scan policy/exclusions.
- Exportable appendix.

### J. Reports
- Executive/technical report preview.
- Scope, limitations and run metadata visible.
- PDF and self-contained HTML export.
- Redaction controls for paths and customer identifiers.

## 5. Visual system
- Neutral dark slate background with restrained violet/blue accent.
- Semantic colors: observed, inferred, unknown, error; never rely on color alone.
- Typography: highly legible sans-serif; monospace only for code/evidence.
- Spacing and grid consistent; dense technical data should remain scannable.
- Graph nodes use shape/icon plus label, not color alone.
- Avoid unnecessary 3D motion; support reduced motion.

## 6. Component inventory
Buttons, repository picker, scan-policy editor, progress timeline, metric cards, evidence badge, coverage table, graph canvas, node detail panel, source-location viewer, filters, report preview, export dialog, warning banners, empty states, error states, toast notifications, accessible tables.

## 7. UX copy principles
Say “Observed in source” rather than “Verified truth” unless verification semantics are precisely defined. Say “Inferred from naming/pattern” and “Not resolved” where appropriate. Avoid “complete architecture,” “zero risk,” “guaranteed safe changes,” and “all dependencies found.”

## 8. Required usability tests
- First-time consultant starts an analysis without help.
- User understands whether source leaves the machine.
- User can distinguish observed from inferred edges.
- User can find why a relationship exists.
- User can identify what the analysis did not cover.
- User can produce a client-ready report.
- User can recover from partial scan and unsupported language.
