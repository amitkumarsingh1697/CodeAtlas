/** Run metadata recorded on every index run (REP-001): what produced the index, and under which policy. */
import { createHash } from 'node:crypto';
import ts from 'typescript';
import type { DiscoveryLimits } from '../indexer/files';
import { RULES } from '../indexer/rules';
import { SCHEMA_VERSION } from '../store/db';
import { ENGINE_VERSION } from '../version';
import type { RunMetadata } from './model';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function ruleCatalogueHash(): string {
  return sha256(
    JSON.stringify(
      Object.entries(RULES)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, r]) => [id, r.adapter, [...r.labels]]),
    ),
  );
}

export function runMetadata(input: {
  limits: DiscoveryLimits;
  adapters: string[];
  incremental: boolean;
  scipFiles: number;
  runIndexers: boolean;
}): RunMetadata {
  const scanPolicy = {
    maxFiles: Number.isFinite(input.limits.maxFiles) ? input.limits.maxFiles : null,
    maxFileBytes: input.limits.maxFileBytes,
    maxLockfileBytes: input.limits.maxLockfileBytes,
    adapters: [...input.adapters].sort(),
    incremental: input.incremental,
    scipFiles: input.scipFiles,
    runIndexers: input.runIndexers,
  };
  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    scanPolicyHash: sha256(JSON.stringify(scanPolicy)),
    scanPolicy,
    ruleCatalogueHash: ruleCatalogueHash(),
    typescriptVersion: ts.version,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
  };
}
