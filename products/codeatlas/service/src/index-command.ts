/** `index <path>` argument parsing, kept apart from cli.ts so it can be tested (ACC-009). */
import { SCIP_USAGE, excludeFlags, scipFlags, takeFlag } from './brain-command';

export const INDEX_USAGE = `index <path> [--max-files n|all] [--exclude pattern]… ${SCIP_USAGE}`;

export interface IndexArgs {
  root: string;
  scip: { files: string[]; run: boolean };
  /** Undefined keeps the default limit (LIMITS.maxFiles); Infinity reads every file. */
  maxFiles?: number;
  /** User exclusions (`--exclude`), when any were given. */
  exclude?: string[];
}

export function parseIndexArgs(argv: string[]): IndexArgs {
  const args = [...argv];
  const raw = takeFlag(args, '--max-files');
  const scip = scipFlags(args);
  const ex = excludeFlags(args);
  const exclude = ex.length ? { exclude: ex } : {};
  const root = args[0];
  if (!root) throw new Error(`usage: codeatlas ${INDEX_USAGE}`);
  if (raw === undefined) return { root, scip, ...exclude };
  if (raw === 'all') return { root, scip, maxFiles: Infinity, ...exclude };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error('--max-files needs a positive whole number, or "all" for no limit');
  return { root, scip, maxFiles: n, ...exclude };
}

/** One line for the terminal when the file limit cut the run short; empty otherwise. */
export function limitNotice(fileLimit: {
  reached: boolean;
  filesRead: number;
  filesInRepository: number;
}): string {
  if (!fileLimit.reached) return '';
  const f = (n: number) => n.toLocaleString('en-US');
  return `WARNING: only ${f(fileLimit.filesRead)} of ${f(fileLimit.filesInRepository)} files were read because of the file limit. Coverage describes the files read. Re-run with --max-files all (or a larger number) to read every file.\n`;
}
