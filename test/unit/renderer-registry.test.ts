import { describe, expect, it } from 'vitest';
import { GIFT_KINDS, GiftManifestSchema } from '../../src/shared/gift.js';
import { manifestPrimaryKind, kindForFile } from '../../src/intake/manifest.js';

describe('renderer kinds (D5)', () => {
  it('every declared kind resolves and unknown kinds fall back to download', () => {
    for (const kind of GIFT_KINDS) {
      const m = GiftManifestSchema.parse({ schema: 'advent-agent/gift@1', day: 1, title: 't', note: 'n', primary: 'x.bin', artifacts: [{ path: 'x.bin', kind }] });
      expect(manifestPrimaryKind(m)).toBe(kind);
    }
    const unknown = GiftManifestSchema.parse({ schema: 'advent-agent/gift@1', day: 1, title: 't', note: 'n', primary: 'thing.xyz', artifacts: [{ path: 'thing.xyz', kind: 'hologram' }] });
    expect(manifestPrimaryKind(unknown)).toBe('download');
    const unknownButImage = GiftManifestSchema.parse({ schema: 'advent-agent/gift@1', day: 1, title: 't', note: 'n', primary: 'a.png', artifacts: [{ path: 'a.png', kind: 'hologram' }] });
    expect(manifestPrimaryKind(unknownButImage)).toBe('image');
  });
  it('kind inference from files', () => {
    expect(kindForFile('a.html')).toBe('interactive-html');
    expect(kindForFile('a.webp')).toBe('image');
    expect(kindForFile('a.mp3')).toBe('audio');
    expect(kindForFile('a.webm')).toBe('video');
    expect(kindForFile('a.pdf')).toBe('document');
    expect(kindForFile('a.md')).toBe('document');
    expect(kindForFile('a.stl')).toBe('download');
  });
});
