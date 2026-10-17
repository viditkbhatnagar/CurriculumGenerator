/**
 * National occupation codes (India NCO 2015, US O*NET, UK SOC 2020, Singapore SSOC 2024).
 *
 * POST /api/v3/occupations/sync    load the bundled data and embed what changed (administrators)
 * GET  /api/v3/occupations/sync    the last sync's progress
 * GET  /api/v3/occupations/stats   occupations held per country
 * GET  /api/v3/occupations/search?q=…&floor=…   closest occupations to a text, per country
 */
import express, { Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { Occupation } from '../models/Occupation';
import {
  searchOccupations,
  startOccupationSync,
  syncStatus,
} from '../services/occupations/occupationStore';

const router = express.Router();
router.use(validateJWT);
router.use(loadUser);

router.post('/sync', (req: Request, res: Response) => {
  if ((req as any).user?.role !== 'administrator') {
    return res
      .status(403)
      .json({ success: false, error: 'Only an administrator can load occupation codes' });
  }
  res.status(202).json({ success: true, data: startOccupationSync() });
});

router.get('/sync', (_req: Request, res: Response) => {
  res.json({ success: true, data: syncStatus() });
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const rows = await Occupation.aggregate([
      { $group: { _id: { country: '$country', system: '$system' }, occupations: { $sum: 1 } } },
      { $sort: { '_id.country': 1 } },
    ]);
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r._id, occupations: r.occupations })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to count occupations' });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) {
    return res
      .status(400)
      .json({ success: false, error: 'Give a job title or description to search for' });
  }
  const floor = Number(req.query.floor ?? 0);
  try {
    res.json({
      success: true,
      data: await searchOccupations(q, Number.isFinite(floor) ? floor : 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    res
      .status(/not been loaded/.test(message) ? 409 : 500)
      .json({ success: false, error: message });
  }
});

export default router;
