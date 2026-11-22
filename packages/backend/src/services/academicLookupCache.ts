/**
 * Read-through cache for academic lookups (see models/AcademicLookupCache).
 *
 * Only successful responses are stored; a 429 or an error is never cached, so an exhausted
 * allowance cannot turn into a month of "no sources". Every failure here is swallowed: the
 * cache is an optimisation, and without a database connection (tests, scripts) it is simply
 * absent.
 */
import mongoose from 'mongoose';
import { AcademicLookupCache, ACADEMIC_CACHE_TTL_DAYS } from '../models/AcademicLookupCache';

/** The request without the parts that identify the caller, so a key or contact change keeps the cache. */
export function lookupCacheKey(url: string): string {
  const [base, query = ''] = url.split('?');
  const kept = query.split('&').filter((p) => p && !/^(mailto|api_key)=/.test(p));
  return kept.length ? `${base}?${kept.join('&')}` : base;
}

const connected = (): boolean => mongoose.connection?.readyState === 1;

export async function readLookupCache(url: string): Promise<any | null> {
  if (!connected()) return null;
  try {
    const row: any = await AcademicLookupCache.findOne({
      key: lookupCacheKey(url),
      expiresAt: { $gt: new Date() },
    })
      .lean()
      .maxTimeMS(3000);
    return row?.body ?? null;
  } catch {
    return null;
  }
}

export async function writeLookupCache(url: string, body: unknown): Promise<void> {
  if (!connected() || !body) return;
  try {
    const expiresAt = new Date(Date.now() + ACADEMIC_CACHE_TTL_DAYS * 86_400_000);
    await AcademicLookupCache.updateOne(
      { key: lookupCacheKey(url) },
      { $set: { body, expiresAt } },
      { upsert: true }
    ).maxTimeMS(3000);
  } catch {
    // A failed write only costs a repeat request later.
  }
}
