import { createSlots, singleFlight } from '../utils/exportSlots';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('createSlots', () => {
  it('lets the first callers in and queues the next ones', async () => {
    const slots = createSlots(2, 1);
    const a = slots.tryAcquire();
    const b = slots.tryAcquire();
    const c = slots.tryAcquire();
    expect(typeof a).toBe('function');
    expect(typeof b).toBe('function');
    expect(c).toBeInstanceOf(Promise);
    expect(slots.state()).toEqual({ active: 2, waiting: 1 });
  });

  it('refuses a caller when every slot is busy and the queue is full', () => {
    const slots = createSlots(1, 1);
    slots.tryAcquire();
    slots.tryAcquire();
    expect(slots.tryAcquire()).toBe('busy');
  });

  it('hands a released slot straight to the next caller waiting', async () => {
    const slots = createSlots(1, 2);
    const release = slots.tryAcquire() as () => void;
    let second: (() => void) | undefined;
    (slots.tryAcquire() as Promise<() => void>).then((r) => (second = r));
    release();
    await tick();
    expect(typeof second).toBe('function');
    expect(slots.state()).toEqual({ active: 1, waiting: 0 });
    second!();
    expect(slots.state()).toEqual({ active: 0, waiting: 0 });
  });

  it('ignores a second release of the same slot', () => {
    const slots = createSlots(2, 0);
    const release = slots.tryAcquire() as () => void;
    release();
    release();
    expect(slots.state()).toEqual({ active: 0, waiting: 0 });
  });

  it('lets a waiting caller give up its place', () => {
    const slots = createSlots(1, 2);
    slots.tryAcquire();
    const waiting = slots.tryAcquire() as Promise<() => void> & { cancel?: () => void };
    expect(slots.state().waiting).toBe(1);
    waiting.cancel!();
    expect(slots.state().waiting).toBe(0);
  });
});

describe('singleFlight', () => {
  it('runs one build for identical requests made while it is in progress', async () => {
    const inFlight = new Map<string, Promise<string>>();
    let builds = 0;
    const build = async () => {
      builds++;
      await tick();
      return 'file';
    };
    const results = await Promise.all([
      singleFlight(inFlight, 'k', build),
      singleFlight(inFlight, 'k', build),
      singleFlight(inFlight, 'k', build),
    ]);
    expect(results).toEqual(['file', 'file', 'file']);
    expect(builds).toBe(1);
    expect(inFlight.size).toBe(0);
  });

  it('starts a new build once the previous one has finished, even after a failure', async () => {
    const inFlight = new Map<string, Promise<string>>();
    await expect(
      singleFlight(inFlight, 'k', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(inFlight.size).toBe(0);
    await expect(singleFlight(inFlight, 'k', async () => 'ok')).resolves.toBe('ok');
  });

  it('keeps different files apart', async () => {
    const inFlight = new Map<string, Promise<string>>();
    let builds = 0;
    const build = async () => {
      builds++;
      return 'x';
    };
    await Promise.all([singleFlight(inFlight, 'a', build), singleFlight(inFlight, 'b', build)]);
    expect(builds).toBe(2);
  });
});
