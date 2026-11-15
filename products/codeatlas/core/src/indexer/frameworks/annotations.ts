/**
 * Reads the annotations (Java, Kotlin) or decorators (TypeScript) written above a declaration,
 * straight from the source text, so a long annotation list is never cut short.
 */
export interface Annotation {
  name: string;
  /** The text between the parentheses, or null when written without them. */
  args: string | null;
  line: number;
}

/** Offset of the start of a 1-based line. */
export function lineOffset(text: string, line: number): number {
  let off = 0;
  for (let l = 1; l < line; l++) {
    const i = text.indexOf('\n', off);
    if (i < 0) return text.length;
    off = i + 1;
  }
  return off;
}

function skipSpaceAndComments(text: string, i: number): number {
  for (;;) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (text.startsWith('//', i)) {
      const e = text.indexOf('\n', i);
      i = e < 0 ? text.length : e + 1;
    } else if (text.startsWith('/*', i)) {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? text.length : e + 2;
    } else return i;
  }
}

/** The end (exclusive) of a balanced `(...)` starting at `open`, honouring string literals. */
function balancedEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"' || ch === "'" || ch === '`') {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Annotations from the declaration's first line onwards, stopping at the first token that is
 * not an annotation. Modifiers between annotations (`public`, `async`) are skipped.
 */
export function annotationsAt(text: string, line: number): Annotation[] {
  const out: Annotation[] = [];
  let i = lineOffset(text, line);
  const lineAt = (off: number) =>
    line + (text.slice(lineOffset(text, line), off).match(/\n/g)?.length ?? 0);
  for (let guard = 0; guard < 64; guard++) {
    i = skipSpaceAndComments(text, i);
    if (text[i] !== '@') {
      const mod =
        /^(public|private|protected|static|final|abstract|async|export|default|readonly|override|open|suspend)\b/.exec(
          text.slice(i, i + 20),
        );
      if (mod) {
        i += mod[0].length;
        continue;
      }
      break;
    }
    const m = /^@([A-Za-z_][\w.]*)/.exec(text.slice(i, i + 200));
    if (!m) break;
    const at = i;
    i += m[0].length;
    const j = skipSpaceAndComments(text, i);
    let args: string | null = null;
    if (text[j] === '(') {
      const end = balancedEnd(text, j);
      if (end < 0) break;
      args = text.slice(j + 1, end - 1);
      i = end;
    }
    out.push({ name: m[1]!.split('.').pop()!, args, line: lineAt(at) });
  }
  return out;
}

/** String literals in an expression, in order, with quotes removed. */
function literals(expr: string): string[] {
  return [...expr.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$]*)`/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? '',
  );
}

/** Splits at top-level commas. */
function topLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!;
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      for (; j < args.length && args[j] !== ch; j++) if (args[j] === '\\') j++;
      cur += args.slice(i, j + 1);
      i = j;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * The paths an annotation names. `[""]` when it names none (a mapping with no path), or null
 * when the path is not a literal (a constant or an expression), which cannot be read statically.
 */
export function pathsOf(
  args: string | null,
  names: string[],
  constants?: Map<string, string>,
  used?: { constant: boolean },
): string[] | null {
  if (args === null || !args.trim()) return [''];
  let parts = topLevel(args.trim());
  // A TypeScript options object: @Controller({ path: 'users', host: … }).
  const only = parts.length === 1 ? parts[0]! : '';
  if (/^\{\s*\w+\s*:/.test(only)) parts = topLevel(only.slice(1, -1));
  const named = new RegExp(`^(${names.join('|')})\\s*[=:]\\s*([\\s\\S]*)$`);
  let expr: string | undefined;
  for (const p of parts) {
    const m = named.exec(p);
    if (m) {
      expr = m[2];
      break;
    }
  }
  if (expr === undefined) {
    const first = parts[0];
    // Only other attributes (method = …, produces = …): no path.
    if (first === undefined || /^\w+\s*[=:]/.test(first)) return [''];
    expr = first;
  }
  const e = expr.trim();
  // A single named constant (`RouteKey.Asset`, `BASE_PATH`) declared once in the repository.
  const c = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(e) ? constants?.get(e) : undefined;
  if (c !== undefined) {
    if (used) used.constant = true;
    return [c];
  }
  const lits = literals(e);
  // Anything left besides literals, commas, braces and brackets is a constant or expression.
  const rest = e
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`$]*`/g, '')
    .replace(/[\s{}[\],]/g, '');
  if (!lits.length || rest) return null;
  return lits;
}

/** A named attribute's raw expression (`method = RequestMethod.GET`), or undefined. */
export function attribute(args: string | null, name: string): string | undefined {
  if (!args) return undefined;
  for (const p of topLevel(args)) {
    const m = new RegExp(`^${name}\\s*[=:]\\s*([\\s\\S]*)$`).exec(p);
    if (m) return m[1]!.trim();
  }
  return undefined;
}

/** Joins a class prefix and a method path into one route path with a leading slash. */
export function joinPath(prefix: string, path: string): string {
  const p = [prefix, path]
    .map((s) => s.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${p}`;
}

/**
 * String constants declared in the repository, by the name code refers to them with:
 * TypeScript enum members (`RouteKey.Asset`) and `const X = '…'`, Java and Kotlin
 * `static final String X = "…"` (`Class.X` and `X`). A name declared with two values is left out.
 */
export function stringConstants(
  files: { path: string; language: string; text: string }[],
): Map<string, string> {
  const seen = new Map<string, string | null>();
  const put = (k: string, v: string) => {
    const prev = seen.get(k);
    seen.set(k, prev === undefined || prev === v ? v : null);
  };
  for (const f of files) {
    if (f.language === 'TypeScript' || f.language === 'JavaScript') {
      for (const m of f.text.matchAll(/\benum\s+([A-Za-z_$][\w$]*)\s*\{([^}]*)\}/g))
        for (const x of m[2]!.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`\n]*)\2/g))
          put(`${m[1]}.${x[1]}`, x[3]!);
      for (const m of f.text.matchAll(
        /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(['"`])([^'"`\n]*)\2\s*(?:as\s+const\s*)?;/g,
      ))
        put(m[1]!, m[3]!);
    } else if (f.language === 'Java' || f.language === 'Kotlin') {
      const cls = f.path.replace(/^.*\//, '').replace(/\.\w+$/, '');
      for (const m of f.text.matchAll(
        /\bstatic\s+final\s+String\s+([A-Za-z_]\w*)\s*=\s*"((?:[^"\\\n]|\\.)*)"\s*;/g,
      )) {
        put(m[1]!, m[2]!);
        put(`${cls}.${m[1]}`, m[2]!);
      }
      for (const m of f.text.matchAll(
        /\bconst\s+val\s+([A-Za-z_]\w*)\s*=\s*"((?:[^"\\\n]|\\.)*)"/g,
      ))
        put(m[1]!, m[2]!);
    }
  }
  const out = new Map<string, string>();
  for (const [k, v] of seen) if (v !== null) out.set(k, v);
  return out;
}
