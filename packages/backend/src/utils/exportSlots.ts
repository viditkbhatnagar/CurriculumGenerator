/**
 * Limits on export work, so a burst of downloads cannot exhaust the API container.
 *
 * Each export route loads the programme with every lesson body and hashes it before the cache
 * is even consulted, and a build can need 500-700MB (the BBA's whole-programme Word and PDF,
 * measured 2026-09-30) in a 2GB container shared with the API and the queue workers. Nothing
 * limited them: four concurrent BBA downloads would OOM-kill the server, and each click on the
 * same download started a fresh build (found 2026-10-01).
 *
 * Pure, no imports, so it can be tested.
 */

type Release = () => void;
type Waiting = Promise<Release> & { cancel: () => void };

/**
 * A counted limit with a bounded queue. tryAcquire returns a release function when a slot is
 * free, a promise of one when the caller is queued (with cancel() to give up its place), or
 * 'busy' when the queue is full too.
 */
export function createSlots(max: number, maxWaiting: number) {
  let active = 0;
  const queue: ((release: Release) => void)[] = [];

  const releaser = (): Release => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = queue.shift();
      // The slot passes straight to the next caller, so nobody can slip in between.
      if (next) next(releaser());
      else active--;
    };
  };

  return {
    tryAcquire(): Release | Waiting | 'busy' {
      if (active < max) {
        active++;
        return releaser();
      }
      if (queue.length >= maxWaiting) return 'busy';
      let resolveWaiter!: (release: Release) => void;
      const waiting = new Promise<Release>((resolve) => (resolveWaiter = resolve)) as Waiting;
      queue.push(resolveWaiter);
      waiting.cancel = () => {
        const at = queue.indexOf(resolveWaiter);
        if (at >= 0) queue.splice(at, 1);
      };
      return waiting;
    },
    state: () => ({ active, waiting: queue.length }),
  };
}

/** `build`, shared by every caller asking for the same key while a build is in progress. */
export function singleFlight<T>(
  inFlight: Map<string, Promise<T>>,
  key: string,
  build: () => Promise<T>
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const started = build().finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
}
