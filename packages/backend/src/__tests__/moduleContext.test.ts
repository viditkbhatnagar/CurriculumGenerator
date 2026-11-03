/**
 * Logan Pacey's re-test, 2 November 2026: nothing told a module its level or what the earlier
 * modules had taught.
 */
import {
  EARLIER_MODULE_CHARS,
  EARLIER_TOTAL_CHARS,
  moduleContextBlock,
} from '../services/moduleContext';

const workflow = (modules: any[], credits = 60) => ({
  step1: {
    programTitle: 'Certificate in Business Analytics',
    academicLevel: 'certificate',
    creditFramework: { system: 'uk_credits', credits },
  },
  step4: { modules },
});

const mod = (n: number, extra: any = {}) => ({
  id: `m${n}`,
  code: `M0${n}`,
  title: `Module ${n}`,
  sequence: n,
  credits: 15,
  topics: [{ title: `Topic ${n}a` }, `Topic ${n}b`],
  mlos: [{ statement: `Explain thing ${n}` }],
  ...extra,
});

describe('moduleContextBlock', () => {
  const w = workflow([mod(1), mod(2), mod(3), mod(4)]);

  it("states the module's level, year, position and descriptor", () => {
    const block = moduleContextBlock(w, 3);
    expect(block).toContain('RQF Level 4 · Year 1');
    expect(block).toContain('module 4 of 4');
    expect(block).toContain('a late module');
    expect(block).toContain('Level descriptor (EQF level 5');
  });

  it('lists what earlier modules taught, and tells the model to build on it', () => {
    const block = moduleContextBlock(w, 2);
    expect(block).toContain(
      'M01 – Module 1: topics: Topic 1a; Topic 1b | outcomes: Explain thing 1'
    );
    expect(block).toContain('M02 – Module 2');
    expect(block).not.toContain('M03 – Module 3:');
    expect(block).toMatch(/do not re-teach/);
  });

  it('says the first module has nothing before it, and accepts the module itself', () => {
    expect(moduleContextBlock(w, 0)).toContain('first module');
    expect(moduleContextBlock(w, w.step4.modules[1])).toContain('M01 – Module 1');
  });

  it('caps each earlier module and shrinks the oldest to titles over budget', () => {
    const long = Array.from({ length: 6 }, (_, i) => ({ title: 'x'.repeat(80) + i }));
    const many = Array.from({ length: 14 }, (_, i) => mod(i + 1, { topics: long }));
    const block = moduleContextBlock(workflow(many, 420), 13);
    const lines = block.split('\n').filter((l) => l.startsWith('- M'));
    expect(lines).toHaveLength(13);
    expect(lines.every((l) => l.length <= EARLIER_MODULE_CHARS + 40)).toBe(true);
    expect(lines.join('').length).toBeLessThanOrEqual(EARLIER_TOTAL_CHARS + 13 * 4);
    expect(lines[0]).toBe('- M01 – Module 1');
  });

  it('is empty for a module not in Step 4, and keeps electives out of each other', () => {
    expect(moduleContextBlock(w, 9)).toBe('');
    const withTracks = workflow([
      mod(1),
      mod(2, { isElective: true, group: 'Finance' }),
      mod(3, { isElective: true, group: 'Marketing' }),
      mod(4),
    ]);
    const block = moduleContextBlock(withTracks, 2);
    expect(block).toContain('M01');
    expect(block).not.toContain('M02 – Module 2');
  });
});
