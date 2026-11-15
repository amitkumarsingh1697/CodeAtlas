import { describe, expect, it } from 'vitest';
import { GraphBuilder } from '../src/indexer/model';

/** Risk T-11: one kind of gap must not crowd the others out of the unresolved list. */
describe('unresolved list cap', () => {
  const gap = (kind: 'call' | 'route_handler', i: number) => ({
    filePath: `src/f${i}.ts`,
    line: i,
    kind,
    text: `x${i}`,
    reason: 'test',
  });

  it('caps each kind on its own, so route gaps survive a flood of call gaps', () => {
    const g = new GraphBuilder();
    const cap = GraphBuilder.MAX_UNRESOLVED_PER_KIND;
    for (let i = 0; i < cap + 7; i++) g.addUnresolved(gap('call', i));
    for (let i = 0; i < 3; i++) g.addUnresolved(gap('route_handler', i));
    expect(g.unresolved.filter((u) => u.kind === 'call')).toHaveLength(cap);
    expect(g.unresolved.filter((u) => u.kind === 'route_handler')).toHaveLength(3);
    expect(g.unresolvedDropped).toBe(7);
    expect(g.unresolvedDroppedByKind).toEqual({ call: 7 });
  });

  it('cuts stored text to 200 characters', () => {
    const g = new GraphBuilder();
    g.addUnresolved({ ...gap('call', 1), text: 'a'.repeat(300) });
    expect(g.unresolved[0]!.text).toHaveLength(200);
  });
});
