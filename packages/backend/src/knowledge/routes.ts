/**
 * /api/v3/knowledge — the textbook knowledge library.
 *
 * Books are added by upload or, for open textbooks, by a link on an allow-listed official host
 * (the server fetches it, so nobody has to push a 60MB PDF through a browser). Each book is
 * ingested in the background; its concepts, with their evidence, are then searchable and a
 * programme can draw on them (PUT /programmes/:workflowId).
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import * as sourceFileStore from '../services/sourceFileStore';
import { openaiService } from '../services/openaiService';
import { shorten } from '../services/occupations/occupationIndex';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { KbBook, KbConcept, KbMeta, KbPassage, LICENCES } from './models';
import { DOMAINS } from './ontology';
import { dot } from './clustering';
import { bodyOfKnowledge, searchConcepts, citation, evidenceByRole } from './retrieval';
import { enqueueIngest, enqueueConsolidation } from './queue';
import { conceptsByCodes } from './programmeLibrary';
import { sha256, workKeyOf, removeBook, recomputeDomainStats } from './ingestBook';

const router = Router();

/**
 * Express 4 does not catch a rejected async handler: the request hangs. Every handler on this
 * router is wrapped so an error answers 500 instead.
 */
const safe = (fn: any) => (req: Request, res: Response, next: (err?: unknown) => void) =>
  Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
    loggingService.error('Library route failed', { path: req.path, error: String(error) });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: (error as Error)?.message || 'Library error' });
    }
  });
for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
  const original = (router as any)[method].bind(router);
  (router as any)[method] = (path: string, ...handlers: any[]) =>
    original(path, ...handlers.map((h) => safe(h)));
}

const MAX_BYTES = 250 * 1024 * 1024;

/**
 * One book is taken in at a time: a 250MB upload or fetch is held in memory, and several at
 * once would exhaust the 2GB container.
 */
let addingBook = false;
function oneBookAtATime(req: Request, res: Response, next: () => void) {
  if (addingBook) {
    return res
      .status(429)
      .json({ success: false, error: 'Another book is being added; try again in a minute' });
  }
  addingBook = true;
  const release = () => {
    addingBook = false;
  };
  res.on('finish', release);
  res.on('close', release);
  next();
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

/** Official hosts of open textbooks the server may fetch from (plus KB_FETCH_HOSTS). */
const FETCH_HOSTS = [
  'assets.openstax.org',
  'd2l.ai',
  'fairmlbook.org',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'jeffe.cs.illinois.edu',
  'mlsysbook.ai',
  'opendatastructures.org',
  'pressbooks.pub',
  'opentextbc.ca',
  'libretexts.org',
  'open.umn.edu',
  'open.oregonstate.education',
  ...(process.env.KB_FETCH_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
];

function allowedHost(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    FETCH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
  );
}

/** Fetch a PDF from an allow-listed host, following redirects only to allow-listed hosts. */
async function fetchPdf(link: string): Promise<Buffer> {
  let url = new URL(link);
  for (let hop = 0; hop < 5; hop++) {
    if (!allowedHost(url)) throw new Error(`${url.hostname} is not an allowed textbook host`);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(600000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new Error(`${url.hostname} answered ${res.status}`);
    const size = Number(res.headers.get('content-length') || 0);
    if (size > MAX_BYTES)
      throw new Error(`the file is ${Math.round(size / 1e6)}MB; the limit is 250MB`);
    // Read with a running count: the length header is often absent (chunked) or compressed,
    // so a body is never trusted to stop at the cap by itself.
    const chunks: Buffer[] = [];
    let total = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error('the link returned no body');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error('the file is over 250MB');
      }
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.subarray(0, 5).toString() !== '%PDF-')
      throw new Error('the link did not return a PDF');
    return buffer;
  }
  throw new Error('too many redirects');
}

const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean)
    : typeof v === 'string' && v.trim()
      ? v
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

/** Book metadata from a form or JSON body, checked against the fixed lists. */
function bookFields(body: any) {
  const domainKeys = asList(body.domainKeys).filter((k) => DOMAINS.some((d) => d.key === k));
  const licence = LICENCES.includes(body.licence) ? body.licence : 'unknown';
  const year = Number(body.year);
  return {
    title: String(body.title || '')
      .trim()
      .slice(0, 300),
    authors: asList(body.authors).slice(0, 12),
    edition: String(body.edition || '')
      .trim()
      .slice(0, 80),
    year: Number.isInteger(year) && year > 1800 && year < 2100 ? year : undefined,
    publisher: String(body.publisher || '')
      .trim()
      .slice(0, 200),
    isbn: String(body.isbn || '')
      .replace(/[^0-9Xx-]/g, '')
      .slice(0, 20),
    licence,
    licenceStatement: String(body.licenceStatement || '')
      .trim()
      .slice(0, 500),
    licenceUrl: String(body.licenceUrl || '')
      .trim()
      .slice(0, 500),
    sourceUrl: String(body.sourceUrl || body.url || '')
      .trim()
      .slice(0, 500),
    providedBy: String(body.providedBy || '')
      .trim()
      .slice(0, 200),
    accessTier: body.accessTier === 'restricted' ? 'restricted' : 'teaching',
    domainKeys,
    programmes: asList(body.programmes).slice(0, 20),
  };
}

const bookSummary = (b: any) => ({
  id: String(b._id),
  title: b.title,
  authors: b.authors,
  edition: b.edition,
  year: b.year,
  publisher: b.publisher,
  licence: b.licence,
  accessTier: b.accessTier,
  domainKeys: b.domainKeys,
  programmes: b.programmes,
  providedBy: b.providedBy,
  sourceUrl: b.sourceUrl,
  pageCount: b.pageCount,
  status: b.status,
  error: b.error || null,
  progress: b.progress,
  stats: b.stats,
  updatedAt: b.updatedAt,
});

router.get('/ontology', (_req, res) => res.json({ success: true, data: DOMAINS }));

router.get('/books', validateJWT, loadUser, async (_req: Request, res: Response) => {
  const books: any[] = await KbBook.find().select('-toc').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: books.map(bookSummary) });
});

router.get('/books/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(404).json({ success: false, error: 'Book not found' });
  const book: any = await KbBook.findById(req.params.id).lean();
  if (!book) return res.status(404).json({ success: false, error: 'Book not found' });
  res.json({
    success: true,
    data: { ...bookSummary(book), toc: book.toc, usedOutline: book.usedOutline },
  });
});

/** Add a book: multipart `file`, or JSON/form `url` on an allowed host, plus its metadata. */
router.post(
  '/books',
  validateJWT,
  loadUser,
  oneBookAtATime,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const fields = bookFields(req.body || {});
      if (!fields.title)
        return res.status(400).json({ success: false, error: 'A title is required' });
      if (!fields.domainKeys.length) {
        return res.status(400).json({
          success: false,
          error: `domainKeys must include one of: ${DOMAINS.map((d) => d.key).join(', ')}`,
        });
      }
      let buffer: Buffer;
      if (req.file) {
        buffer = req.file.buffer;
        if (buffer.subarray(0, 5).toString() !== '%PDF-') {
          return res.status(400).json({ success: false, error: 'Only PDF files can be added' });
        }
      } else if (fields.sourceUrl) {
        try {
          buffer = await fetchPdf(fields.sourceUrl);
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: `Could not fetch the book: ${(error as Error).message}`,
          });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, error: 'Attach a PDF or give an https link to one' });
      }

      const hash = sha256(buffer);
      const duplicate: any = await KbBook.findOne({ fileSha256: hash }).lean();
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'This file is already in the library',
          data: bookSummary(duplicate),
        });
      }
      const stored = await sourceFileStore.uploadBuffer(
        buffer,
        `library-${hash.slice(0, 12)}.pdf`,
        'application/pdf',
        (req as any).user?.email
      );
      const book: any = await KbBook.create({
        ...fields,
        workKey: workKeyOf(fields.title, fields.authors),
        fileId: stored.fileId,
        fileSha256: hash,
        fileBytes: buffer.length,
        status: 'queued',
      });
      const mode = await enqueueIngest(String(book._id));
      loggingService.info('Library: book added', {
        bookId: String(book._id),
        title: book.title,
        bytes: buffer.length,
        mode,
      });
      res.status(202).json({ success: true, data: bookSummary(book) });
    } catch (error) {
      loggingService.error('Library: adding a book failed', { error: (error as Error).message });
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/** Edit a book's metadata (licence, domains, programmes, access tier). */
router.patch('/books/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(404).json({ success: false, error: 'Book not found' });
  const fields: any = bookFields({ ...req.body });
  const set: any = {};
  for (const k of [
    'title',
    'authors',
    'edition',
    'year',
    'publisher',
    'isbn',
    'licence',
    'licenceStatement',
    'licenceUrl',
    'providedBy',
    'accessTier',
    'domainKeys',
    'programmes',
  ]) {
    if (req.body?.[k] !== undefined && fields[k] !== undefined) set[k] = fields[k];
  }
  const before: any = await KbBook.findById(req.params.id).select('accessTier domainKeys').lean();
  if (!before) return res.status(404).json({ success: false, error: 'Book not found' });
  const book: any = await KbBook.findByIdAndUpdate(
    req.params.id,
    { $set: set },
    { new: true }
  ).lean();
  // A change of access tier or domains has to reach what the book already contributed:
  // its passages' restricted flag, and the statistics of the domains it is counted in.
  if (book.accessTier !== before.accessTier) {
    await KbPassage.updateMany(
      { bookId: book._id, kind: { $ne: 'restricted' } },
      { $set: { restricted: book.accessTier === 'restricted' } }
    );
  }
  if (
    book.accessTier !== before.accessTier ||
    String(book.domainKeys) !== String(before.domainKeys)
  ) {
    await recomputeDomainStats(Array.from(new Set([...before.domainKeys, ...book.domainKeys])));
    await KbMeta.updateOne({ _id: 'concepts' }, { $inc: { version: 1 } }, { upsert: true });
  }
  res.json({ success: true, data: bookSummary(book) });
});

/** Run (or resume) a book's ingest. */
router.post('/books/:id/ingest', validateJWT, loadUser, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(404).json({ success: false, error: 'Book not found' });
  const book: any = await KbBook.findById(req.params.id);
  if (!book) return res.status(404).json({ success: false, error: 'Book not found' });
  // A book still being read saves progress every few seconds; one that has saved nothing for
  // 15 minutes was orphaned by a restart and may be resumed with a fresh job.
  const STALE_MS = 15 * 60 * 1000;
  const orphaned =
    ['reading', 'extracting'].includes(book.status) &&
    Date.now() - new Date(book.updatedAt).getTime() > STALE_MS;
  if (['reading', 'extracting'].includes(book.status) && !orphaned) {
    return res.status(409).json({ success: false, error: 'The book is being read already' });
  }
  if (req.body?.restart === true) {
    await KbPassage.deleteMany({ bookId: book._id });
    book.progress = { sectionsTotal: 0, sectionsDone: 0, doneKeys: [] };
    book.stats = {};
  }
  book.status = 'queued';
  book.error = undefined;
  await book.save();
  res.status(202).json({
    success: true,
    data: { bookId: String(book._id), mode: await enqueueIngest(String(book._id), orphaned) },
  });
});

/** Take a book out of the library (its passages, its evidence, concepts only it taught). */
router.delete('/books/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Book not found' });
  }
  const book: any = await KbBook.findById(req.params.id).select('status').lean();
  if (!book) return res.status(404).json({ success: false, error: 'Book not found' });
  if (['reading', 'extracting'].includes(book.status)) {
    return res
      .status(409)
      .json({ success: false, error: 'The book is being read; remove it once that stops' });
  }
  try {
    res.json({ success: true, data: await removeBook(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/** Concepts: `q` searches by meaning; otherwise the body of knowledge, filtered. */
router.get('/concepts', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const domainKeys = asList(req.query.domain);
    const areas = asList(req.query.area);
    const limit = Math.max(1, Math.min(Math.floor(Number(req.query.limit)) || 50, 500));
    const strip = (c: any) => ({
      ...c,
      sources: evidenceByRole(c).map((e: any) => ({
        role: e.role,
        citation: citation(e),
        treatment: e.treatment,
      })),
    });
    // Specific concepts by code (merged codes resolve to the concept they were merged into).
    if (req.query.codes) {
      const rows = await conceptsByCodes(asList(req.query.codes).slice(0, 200));
      return res.json({ success: true, data: rows.map(strip) });
    }
    if (req.query.q) {
      const hits = await searchConcepts([String(req.query.q).slice(0, 500)], {
        domainKeys,
        areas,
        k: limit,
      });
      return res.json({
        success: true,
        data: hits.map((h) => ({ ...strip(h.concept), similarity: h.similarity })),
      });
    }
    const importance = asList(req.query.importance) as any[];
    const rows = await bodyOfKnowledge({ domainKeys, areas, importance, limit });
    res.json({ success: true, data: rows.map(strip) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/** One knowledge object with its evidence and the passages behind each source. */
router.get('/concepts/:code', validateJWT, loadUser, async (req: Request, res: Response) => {
  const concept: any = await KbConcept.findOne({ code: req.params.code })
    .select('-embedding')
    .lean();
  if (!concept) return res.status(404).json({ success: false, error: 'Concept not found' });
  // Excerpts only from openly licensed teaching books: an institution's licensed ebook is cited
  // by chapter and page, never quoted to whoever asks.
  const bookIds = Array.from(new Set((concept.evidence || []).map((e: any) => String(e.bookId))));
  const books: any[] = await KbBook.find({ _id: { $in: bookIds } })
    .select('licence accessTier')
    .lean();
  const quotable = new Set(
    books
      .filter((b) => String(b.licence).startsWith('cc-') && b.accessTier === 'teaching')
      .map((b) => String(b._id))
  );
  const evidence = [];
  for (const e of concept.evidence || []) {
    if (!quotable.has(String(e.bookId))) {
      evidence.push({ ...e, citation: citation(e), passages: [] });
      continue;
    }
    const passages: any[] = await KbPassage.find({
      bookId: e.bookId,
      sectionKey: e.sectionKey,
      restricted: false,
    })
      .sort({ order: 1 })
      .select('text pageLabelStart pageLabelEnd')
      .limit(3)
      .lean();
    evidence.push({
      ...e,
      citation: citation(e),
      passages: passages.map((p) => ({
        pages: `${p.pageLabelStart}-${p.pageLabelEnd}`,
        excerpt: String(p.text).slice(0, 600),
      })),
    });
  }
  res.json({ success: true, data: { ...concept, evidence } });
});

/** The library at a glance: books by status, concepts by domain, area and importance. */
router.get('/overview', validateJWT, loadUser, async (_req: Request, res: Response) => {
  const [books, concepts] = await Promise.all([
    KbBook.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    KbConcept.aggregate([
      {
        $group: {
          _id: { domain: '$domainKey', area: '$area', importance: '$importance' },
          n: { $sum: 1 },
        },
      },
    ]),
  ]);
  res.json({ success: true, data: { books, concepts } });
});

/**
 * Similarities between pairs of texts on the same vectors the library uses, to set the merge
 * and search thresholds from evidence (clustering.MERGE_SIMILARITY, retrieval.CONCEPT_FLOOR).
 */
router.post('/calibrate', validateJWT, loadUser, async (req: Request, res: Response) => {
  const pairs: [string, string][] = (Array.isArray(req.body?.pairs) ? req.body.pairs : [])
    .filter((p: any) => Array.isArray(p) && p.length === 2)
    .slice(0, 100);
  if (!pairs.length)
    return res.status(400).json({ success: false, error: 'pairs: [[a, b], ...] required' });
  const texts = pairs.flat().map((t) => String(t).slice(0, 2000));
  const vectors = (await openaiService.generateEmbeddingsBatch(texts)).map((v) => shorten(v));
  res.json({
    success: true,
    data: pairs.map((p, i) => ({
      a: p[0],
      b: p[1],
      similarity: Math.round(dot(vectors[2 * i], vectors[2 * i + 1]) * 1000) / 1000,
    })),
  });
});

/**
 * Merge concepts that different books (or sections) hold under different names: embeddings
 * shortlist pairs, a model judges them (knowledge/consolidate). Runs after queued ingests.
 */
router.post('/consolidate', validateJWT, loadUser, async (req: Request, res: Response) => {
  const domainKeys = asList(req.body?.domainKeys).filter((k) => DOMAINS.some((d) => d.key === k));
  res.status(202).json({ success: true, data: { mode: await enqueueConsolidation(domainKeys) } });
});

router.get('/consolidate', validateJWT, loadUser, async (_req: Request, res: Response) => {
  res.json({ success: true, data: (await KbMeta.findById('consolidation').lean()) || null });
});

/** Which part of the library a programme draws on. */
router.get(
  '/programmes/:workflowId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.workflowId))
      return res.status(404).json({ success: false, error: 'Programme not found' });
    const wf: any = await CurriculumWorkflow.findById(req.params.workflowId)
      .select('knowledgeLibrary')
      .lean();
    if (!wf) return res.status(404).json({ success: false, error: 'Programme not found' });
    res.json({ success: true, data: wf.knowledgeLibrary || { enabled: false, domainKeys: [] } });
  }
);

router.put(
  '/programmes/:workflowId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.workflowId))
      return res.status(404).json({ success: false, error: 'Programme not found' });
    const domainKeys = asList(req.body?.domainKeys).filter((k) => DOMAINS.some((d) => d.key === k));
    const enabled = req.body?.enabled !== false;
    if (enabled && !domainKeys.length) {
      return res.status(400).json({
        success: false,
        error: `domainKeys must include one of: ${DOMAINS.map((d) => d.key).join(', ')}`,
      });
    }
    const bookIds = asList(req.body?.bookIds)
      .filter((id) => mongoose.isValidObjectId(id))
      .slice(0, 50);
    const knownAreas = new Set(DOMAINS.flatMap((d) => d.areas.map((a) => a.name)));
    const areas = asList(req.body?.areas)
      .filter((a) => knownAreas.has(a))
      .slice(0, 40);
    const library = { enabled, domainKeys, areas, bookIds, enabledAt: new Date() };
    const result = await CurriculumWorkflow.updateOne(
      { _id: req.params.workflowId },
      { $set: { knowledgeLibrary: library } }
    );
    if (!result.matchedCount)
      return res.status(404).json({ success: false, error: 'Programme not found' });
    res.json({ success: true, data: library });
  }
);

export default router;
