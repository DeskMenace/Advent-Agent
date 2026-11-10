import { describe, expect, it } from 'vitest';
import { listEntities, mascotCentred, sameSubjectShare } from '../../scripts/lab/subject.js';

describe('lab: what a pitch is about', () => {
  it('flags pitches centred on the mascot or its makers, not a passing mention', () => {
    expect(mascotCentred('A Shanty for gary.js', 'A song.')).toBe(true);
    expect(mascotCentred('Museum Room', "Gary's plaid shirt sits on a pedestal.")).toBe(true);
    expect(mascotCentred('Trailer', 'A horror trailer for a week of shipping. Gary walks by once, then Gary waves.')).toBe(true);
    expect(mascotCentred('Trailer', 'A horror trailer for a week of shipping, cut like a short clip. A plaid man walks by.')).toBe(false);
    expect(mascotCentred('Fish tank', 'A tank of tiny office fish. A tiny credit to Desk Menace sits in the corner.')).toBe(false);
    expect(mascotCentred('Desk Menace Quiz', 'Questions.')).toBe(true);
  });

  it('finds the one subject that most pitches share', () => {
    const list = '- Builds Topoli, a Swiss address tool. [source: a]\n- Rows on Lake Zurich. [source: b]\n';
    const pitches = [
      { title: 'A Topoli zine', pitch: 'x' }, { title: 'Lake', pitch: 'Row on Lake Zurich' }, { title: 'Topoli song', pitch: 'y' }, { title: 'Bread', pitch: 'z' },
    ];
    expect(listEntities(list)).toContain('topoli');
    const r = sameSubjectShare(pitches, list);
    expect(r.entity).toBe('topoli');
    expect(r.count).toBe(2);
    expect(r.share).toBeCloseTo(0.5);
  });
});
