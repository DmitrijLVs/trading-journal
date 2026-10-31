import { describe, expect, it } from 'vitest';
import {
  encodeManualTags,
  jsonBytes,
  manualTagFilter,
  manualTagOfFilter,
  normalizeTag,
  readManualTags,
  tagUsage,
  withTag,
  withoutTag,
} from './manual-tags.model';

describe('manual tags', () => {
  it('normalizes what the trader types', () => {
    expect(normalizeTag('  #Пробой   уровня ')).toBe('пробой уровня');
    expect(normalizeTag('##')).toBeNull();
    expect(normalizeTag('x'.repeat(33))).toBeNull();
  });

  it('round-trips through the compact stored form, frequent names first', () => {
    let tags = withTag(new Map(), '101', 'пробой');
    tags = withTag(tags, '102', 'пробой');
    tags = withTag(tags, '102', 'новости');
    const stored = encodeManualTags(tags);
    expect(stored).toEqual({ v: 1, n: ['пробой', 'новости'], t: { '101': [0], '102': [0, 1] } });
    expect(readManualTags(JSON.parse(JSON.stringify(stored)))).toEqual(tags);
  });

  it('drops broken records instead of failing', () => {
    expect(readManualTags({ v: 1, n: ['a'], t: { '1': [0, 7], '2': 'x' } })).toEqual(new Map([['1', ['a']]]));
    expect(readManualTags(null).size).toBe(0);
  });

  it('removes the trade when its last tag goes and keeps identity when nothing changes', () => {
    const tags = withTag(new Map(), '1', 'a');
    expect(withTag(tags, '1', 'a')).toBe(tags);
    expect(withoutTag(tags, '1', 'b')).toBe(tags);
    expect(withoutTag(tags, '1', 'a').has('1')).toBe(false);
  });

  it('counts usage and measures UTF-8 bytes like the server', () => {
    const tags = new Map([['1', ['b', 'a']], ['2', ['a']]]);
    expect(tagUsage(tags)).toEqual([{ tag: 'a', count: 2 }, { tag: 'b', count: 1 }]);
    expect(jsonBytes('ё')).toBe(4);
  });

  it('tells manual-tag filters from auto-tag codes', () => {
    expect(manualTagOfFilter(manualTagFilter('пробой'))).toBe('пробой');
    expect(manualTagOfFilter('revenge')).toBeNull();
  });
});
