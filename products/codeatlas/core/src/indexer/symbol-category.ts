/**
 * Which symbol nodes count as code (ACC-007). Markup elements (XML, SVG, HTML), configuration
 * keys, document headings and build or deployment entries are stored as symbol nodes so they can
 * be browsed and searched, but counting them as code symbols inflates the figures a reader sees:
 * in Spring PetClinic 85% of the "symbols" were SVG elements.
 */
export type SymbolCategory = 'code' | 'markup' | 'documentation' | 'configuration';

const MARKUP = new Set(['element']);
const DOCUMENTATION = new Set(['heading', 'section']);
/** Configuration, build, dependency, CI and deployment entries read from manifests and config. */
const CONFIGURATION = new Set([
  'key',
  'dependency',
  'plugin',
  'task',
  'profile',
  'ci-job',
  'k8s-object',
  'service',
  'build-stage',
  'build-target',
  'build-module',
  'make-target',
  'bean',
  'resource',
  'operation',
  'schema',
  'index',
]);

/** Every kind not listed above is a declaration in a programming language and counts as code. */
export function symbolCategory(symbolKind: string | undefined | null): SymbolCategory {
  const k = symbolKind ?? '';
  if (MARKUP.has(k)) return 'markup';
  if (DOCUMENTATION.has(k)) return 'documentation';
  if (CONFIGURATION.has(k) || k.startsWith('android-')) return 'configuration';
  return 'code';
}

export function countSymbolsByCategory(
  nodes: Iterable<{ kind: string; symbolKind?: string | null }>,
): Record<SymbolCategory, number> {
  const out: Record<SymbolCategory, number> = {
    code: 0,
    markup: 0,
    documentation: 0,
    configuration: 0,
  };
  for (const n of nodes) if (n.kind === 'symbol') out[symbolCategory(n.symbolKind)]++;
  return out;
}
