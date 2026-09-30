import {
  buildWithReflows,
  inReflowSlot,
  MAX_REFLOWS_IN_FLIGHT,
  reflowFromScope,
  Reflowed,
} from '../services/reflowScope';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stand-in for the model: tracks how many calls run at once, answers after a short wait. */
function fakeModel() {
  let now = 0;
  const seen = { max: 0, calls: 0 };
  const reflow = async (text: string): Promise<Reflowed> => {
    seen.calls++;
    now++;
    seen.max = Math.max(seen.max, now);
    await delay(20);
    now--;
    return { paragraphs: [`reflowed: ${text}`], bullets: [] };
  };
  return { reflow, seen };
}

/** A section as the export builds one: reflows each passage in turn, awaiting each. */
function section(passages: string[], reflow: (t: string, c: string) => Promise<Reflowed>) {
  let builds = 0;
  const build = async () => {
    builds++;
    const out: string[] = [];
    for (const text of passages) {
      const answer = (await (reflowFromScope(text, 'Case') ??
        inReflowSlot(() => reflow(text, 'Case')))) as Reflowed;
      out.push(...answer.paragraphs);
    }
    return out;
  };
  return { build, builds: () => builds };
}

describe('buildWithReflows', () => {
  it('fetches every passage together, then builds from the answers', async () => {
    const { reflow, seen } = fakeModel();
    const passages = Array.from({ length: 6 }, (_, i) => `passage ${i}`);
    const s = section(passages, reflow);
    const out = await buildWithReflows(s.build, reflow);
    expect(out).toEqual(passages.map((p) => `reflowed: ${p}`));
    expect(seen.calls).toBe(6);
    expect(seen.max).toBeGreaterThan(1);
    expect(s.builds()).toBe(2);
  });

  it('never runs more than the limit at once', async () => {
    const { reflow, seen } = fakeModel();
    const passages = Array.from({ length: 30 }, (_, i) => `passage ${i}`);
    await buildWithReflows(section(passages, reflow).build, reflow);
    expect(seen.max).toBeLessThanOrEqual(MAX_REFLOWS_IN_FLIGHT);
    expect(seen.max).toBe(MAX_REFLOWS_IN_FLIGHT);
  });

  it('keeps the limit across builds running side by side', async () => {
    const { reflow, seen } = fakeModel();
    const sections = [0, 1, 2].map((n) =>
      section(
        Array.from({ length: 12 }, (_, i) => `s${n} p${i}`),
        reflow
      )
    );
    await Promise.all(sections.map((s) => buildWithReflows(s.build, reflow)));
    expect(seen.calls).toBe(36);
    expect(seen.max).toBeLessThanOrEqual(MAX_REFLOWS_IN_FLIGHT);
  });

  it('builds once when nothing needs reflowing', async () => {
    const { reflow, seen } = fakeModel();
    const s = section([], reflow);
    await buildWithReflows(s.build, reflow);
    expect(s.builds()).toBe(1);
    expect(seen.calls).toBe(0);
  });

  it('asks once for a passage that appears twice', async () => {
    const { reflow, seen } = fakeModel();
    await buildWithReflows(section(['same', 'same'], reflow).build, reflow);
    expect(seen.calls).toBe(1);
  });
});

describe('reflowFromScope', () => {
  it('is undefined outside a build, so the caller reflows the passage itself', () => {
    expect(reflowFromScope('text', 'Case')).toBeUndefined();
  });
});
