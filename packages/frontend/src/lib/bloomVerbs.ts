/**
 * Custom Bloom's taxonomy verbs added by the user.
 *
 * The built-in BLOOM_VERBS list (types/workflow) is fixed; verbs the user
 * adds in the PLO/MLO editors are persisted here in localStorage so they
 * stay available across sessions and across every workflow.
 */
import type { BloomLevel } from '@/types/workflow';

const STORAGE_KEY = 'bloom:customVerbs';

type CustomVerbStore = Partial<Record<BloomLevel, string[]>>;

function read(): CustomVerbStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomVerbStore) : {};
  } catch {
    return {};
  }
}

/** Verbs the user has added for a given Bloom's level. */
export function getCustomVerbs(level: BloomLevel): string[] {
  return read()[level] || [];
}

/**
 * Add a custom verb for a level. Returns the updated custom-verb list.
 * No-op if the verb is blank or already stored.
 */
export function addCustomVerb(level: BloomLevel, verb: string): string[] {
  const cleaned = verb.trim().toLowerCase();
  const store = read();
  const list = store[level] || [];
  if (!cleaned || list.includes(cleaned)) return list;
  const updated = [...list, cleaned];
  store[level] = updated;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return updated;
}

/** Remove a previously added custom verb. Returns the updated list. */
export function removeCustomVerb(level: BloomLevel, verb: string): string[] {
  const store = read();
  const list = store[level] || [];
  const updated = list.filter((v) => v !== verb);
  store[level] = updated;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return updated;
}
