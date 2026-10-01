/**
 * At most two downloads are prepared at once; up to eight more wait their turn, and beyond that
 * the server answers 503 with Retry-After. See utils/exportSlots for why.
 *
 * Mounted before the routers on every export path, because each export route loads and hashes
 * the whole programme before its cache is even consulted, so the limit has to cover the whole
 * request, not only the build.
 */
import { NextFunction, Request, Response } from 'express';
import { createSlots } from '../utils/exportSlots';
import { loggingService } from '../services/loggingService';

export const MAX_ACTIVE_EXPORTS = 2;
export const MAX_WAITING_EXPORTS = 8;

const slots = createSlots(MAX_ACTIVE_EXPORTS, MAX_WAITING_EXPORTS);

/** Paths whose requests build or assemble a download (Express path patterns). */
export const EXPORT_PATHS = [
  '/api/v3/workflow/:id/export',
  '/api/export',
  '/api/v3/standalone/export',
  '/api/v3/ppt/download',
  '/api/v3/ppt/generate/all',
  '/api/agu/drafts/:id/export',
];

export function exportRequestSlot(req: Request, res: Response, next: NextFunction): void {
  const holdUntilDone = (release: () => void) => {
    // 'close' fires when the response ends or the client goes away, whichever comes first.
    res.once('finish', release);
    res.once('close', release);
    next();
  };

  const slot = slots.tryAcquire();
  if (slot === 'busy') {
    loggingService.warn('Export refused: the server is busy', {
      path: req.originalUrl,
      ...slots.state(),
    });
    res.setHeader('Retry-After', '30');
    res.status(503).json({
      success: false,
      error: 'The server is busy preparing other downloads. Please try again in a minute.',
    });
    return;
  }
  if (typeof slot === 'function') {
    holdUntilDone(slot);
    return;
  }
  // Queued: give up the place if the client leaves before a slot is free.
  const giveUp = () => slot.cancel();
  res.once('close', giveUp);
  slot.then((release) => {
    res.off('close', giveUp);
    if (res.destroyed || res.writableEnded) return release();
    holdUntilDone(release);
  });
}
