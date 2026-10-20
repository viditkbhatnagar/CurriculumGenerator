/**
 * Ingesting one book into the knowledge library (Rejin's design, "the ideal workflow"):
 *
 *   PDF -> pages and bookmarks -> Book / Chapter / Section / Page / Passage
 *       -> knowledge objects per section -> merged with the same concept from other books
 *       -> evidence roles, prevalence and importance recomputed for the domain
 *
 * Resumable: each finished section is recorded on the book, so a re-run (a stalled job, a
 * redeploy, a failed call) continues where it stopped. A model that cannot be reached at all
 * (rejected key, exhausted quota) stops the run instead of producing an empty book, which is
 * what happened to 510 lessons on 30 September.
 */
import crypto from 'crypto';
import { openaiService } from '../services/openaiService';
import { loggingService } from '../services/loggingService';
import * as sourceFileStore from '../services/sourceFileStore';
import { isAiUnavailable } from '../services/aiAvailability';
import { withUsageContext } from '../services/usageContext';
import { shorten } from '../services/occupations/occupationIndex';
import { readPdf } from './pdf/readPdf';
import { structureBook, passagesOf, sectionWindows, pageLabelsIn, BookSection } from './structure';
import {
  extractionSystemPrompt,
  extractionUserPrompt,
  parseExtraction,
  ExtractedConcept,
} from './extraction';
import {
  assignRoles,
  classifyImportance,
  conceptKey,
  deepestTreatment,
  keysFor,
  matchConcept,
  tidyEvidence,
  Existing,
} from './clustering';
import { areasFor, findArea, DOMAINS, OTHER_AREA } from './ontology';
import { KbBook, KbConcept, KbCounter, KbMeta, KbPassage } from './models';

/** Extraction is reading, not reasoning: a small model at low effort keeps a book near $1. */
export const EXTRACTION_MODEL = process.env.KB_EXTRACTION_MODEL || 'gpt-5-mini';
/** Sections read at once. gpt-5-mini takes about a minute a section, so throughput is set by this: 20 read about 12 a minute, leaving the MAIB library four hours from done. */
const EXTRACTION_CONCURRENCY = Math.max(1, Number(process.env.KB_EXTRACTION_CONCURRENCY) || 40);
const EXTRACTABLE = new Set(['body', 'summary']);

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** "Morin, Open Data Structures" style key for one work across editions. */
export function workKeyOf(title: string, authors: string[]): string {
  const surname = (authors[0] || '').trim().split(/\s+/).pop() || '';
  return `${conceptKey(title)}|${surname.toLowerCase()}`;
}

async function nextCode(areaCode: string): Promise<string> {
  const row: any = await KbCounter.findOneAndUpdate(
    { _id: `K-${areaCode}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return `K-${areaCode}-${String(row.seq).padStart(4, '0')}`;
}

async function bumpLibraryVersion(): Promise<void> {
  await KbMeta.updateOne({ _id: 'concepts' }, { $inc: { version: 1 } }, { upsert: true });
}

const uniq = (a: string[], b: string[], max: number) => {
  const seen = new Set(a.map((x) => x.toLowerCase()));
  const out = [...a];
  for (const x of b) {
    if (out.length >= max) break;
    if (!seen.has(x.toLowerCase())) {
      seen.add(x.toLowerCase());
      out.push(x);
    }
  }
  return out;
};

async function extractSection(book: any, section: BookSection, areaNames: string[]) {
  const concepts: ExtractedConcept[] = [];
  for (const window of sectionWindows(section)) {
    const reply = await openaiService.generateContent(
      extractionUserPrompt(
        {
          bookTitle: book.title,
          authors: book.authors,
          edition: book.edition,
          chapter: `${section.chapter.number ? section.chapter.number + ' ' : ''}${section.chapter.title}`,
          section: `${section.section.number ? section.section.number + ' ' : ''}${section.section.title}`,
          sectionKind: section.kind,
          areas: areaNames,
          subAreas: Object.fromEntries(
            areasFor(book.domainKeys).map(({ area }) => [area.name, area.subAreas])
          ),
        },
        window
      ),
      extractionSystemPrompt(),
      {
        model: EXTRACTION_MODEL,
        reasoningEffort: 'low',
        responseFormat: 'json_object',
        maxTokens: 16000,
        timeout: 300000,
        maxRetries: 3,
      }
    );
    concepts.push(...parseExtraction(reply, pageLabelsIn(window), areaNames));
  }
  return concepts;
}

/** File one section's concepts: merge each with the same concept already held, or add it. */
async function mergeSection(
  book: any,
  section: BookSection,
  extracted: ExtractedConcept[],
  existing: Existing[],
  counters: { extracted: number; created: number; merged: number; unverified: number }
) {
  if (!extracted.length) return;
  const vectors = await openaiService.generateEmbeddingsBatch(
    extracted.map((c) => `${c.name}: ${c.definition}`.slice(0, 2000))
  );
  for (let i = 0; i < extracted.length; i++) {
    const c = extracted[i];
    counters.extracted++;
    if (!c.pagesVerified) counters.unverified++;
    const placed = findArea(c.area);
    const domainKey = placed?.domain.key || book.domainKeys[0] || DOMAINS[0].key;
    const area = placed?.area || OTHER_AREA;
    const vector = shorten(vectors[i]);
    const keys = keysFor(c.name, c.aliases);
    const evidence = {
      bookId: book._id,
      bookTitle: book.title,
      authors: book.authors,
      edition: book.edition,
      year: book.year,
      chapter: { number: section.chapter.number, title: section.chapter.title },
      section: { number: section.section.number, title: section.section.title },
      sectionKey: section.key,
      pageLabelStart: c.pageStart,
      pageLabelEnd: c.pageEnd,
      treatment: c.treatment,
      level: c.level,
      workedExamplePages: c.workedExamplePages,
      critique: c.critique,
      role: 'additional',
    };
    const hit = matchConcept({ key: conceptKey(c.name), keys, area: area.name, vector }, existing);

    // The matched concept may have been removed (with its only book) since this run began;
    // then this one is created afresh rather than lost.
    const doc: any = hit ? await KbConcept.findById(hit.id) : null;
    if (hit && !doc) {
      const gone = existing.findIndex((e) => e.id === hit.id);
      if (gone !== -1) existing.splice(gone, 1);
    }
    if (doc) {
      counters.merged++;
      const ev: any[] = tidyEvidence(doc.evidence || [], evidence, section.key);
      doc.evidence = ev;
      doc.markModified('evidence');
      doc.aliases = uniq(
        doc.aliases,
        [c.name, ...c.aliases].filter((n) => n !== doc.name),
        12
      );
      doc.aliasKeys = Array.from(new Set([...(doc.aliasKeys || []), ...keys]));
      // A fuller treatment replaces a definition taken from a passing mention.
      if (!doc.definition || (c.treatment === 'extended' && c.definition.length > 40)) {
        const hadDeep = ev.some((e: any) => e !== evidence && e.treatment === 'extended');
        if (!doc.definition || !hadDeep) doc.definition = c.definition;
      }
      for (const field of [
        'components',
        'applications',
        'misconceptions',
        'prerequisites',
        'related',
        'skillsEnabled',
        'assessmentPossibilities',
      ] as const) {
        doc[field] = uniq(doc[field] || [], c[field], 14);
      }
      doc.formulae = [
        ...(doc.formulae || []),
        ...c.formulae.filter(
          (f) => !(doc.formulae || []).some((g: any) => g.expression === f.expression)
        ),
      ].slice(0, 8);
      await doc.save();
      const mem = existing.find((e) => e.id === String(doc._id));
      if (mem) mem.keys = Array.from(new Set([...mem.keys, ...keys]));
    } else {
      counters.created++;
      const created: any = await KbConcept.create({
        code: await nextCode(area.code),
        name: c.name,
        key: conceptKey(c.name),
        aliases: c.aliases,
        aliasKeys: keys,
        domainKey,
        area: area.name,
        subArea: c.subArea,
        conceptType: c.conceptType,
        level: c.level,
        definition: c.definition,
        components: c.components,
        formulae: c.formulae,
        applications: c.applications,
        misconceptions: c.misconceptions,
        prerequisites: c.prerequisites,
        related: c.related,
        skillsEnabled: c.skillsEnabled,
        assessmentPossibilities: c.assessmentPossibilities,
        evidence: [evidence],
        embedding: vector,
      });
      existing.push({ id: String(created._id), key: created.key, keys, area: area.name, vector });
    }
  }
}

/**
 * Evidence roles, prevalence and importance for every concept in the given domains, from the
 * library as it now stands: adding a book changes how prevalent every other book's concepts are.
 */
export async function recomputeDomainStats(domainKeys: string[]): Promise<void> {
  for (const domainKey of domainKeys) {
    const books: any[] = await KbBook.find({
      domainKeys: domainKey,
      status: 'ready',
      accessTier: 'teaching',
      supersededBy: null,
    })
      .select('_id')
      .lean();
    const live = new Set(books.map((b) => String(b._id)));
    const cursor = KbConcept.find({ domainKey }).select('evidence level').cursor();
    const ops: any[] = [];
    for await (const doc of cursor as any) {
      // All evidence is kept. Only books that are ready, teaching and current count towards
      // the statistics; evidence from a book still being read waits for its own turn. (This
      // once wrote back only the counted evidence, deleting every unfinished book's.)
      const all: any[] = doc.evidence || [];
      const counted = all.filter((e: any) => live.has(String(e.bookId)));
      const ranked = assignRoles(counted.map((e: any) => ({ ...e, bookId: String(e.bookId) })));
      const roleOf = new Map(counted.map((e: any, i: number) => [e, ranked[i].role]));
      const treating = new Set(
        ranked.filter((e) => e.treatment !== 'mention').map((e) => e.bookId)
      );
      const levels = ranked.map((e: any) => e.level).filter(Boolean);
      const level =
        levels.sort(
          (a: string, b: string) =>
            levels.filter((x: string) => x === b).length -
            levels.filter((x: string) => x === a).length
        )[0] || doc.level;
      const { prevalence, importance } = classifyImportance({
        booksTreating: treating.size,
        domainBooks: live.size,
        deepest: deepestTreatment(ranked.map((e) => e.treatment)),
        level,
      });
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              evidence: all.map((e: any) => ({ ...e, role: roleOf.get(e) || 'additional' })),
              bookCount: new Set(ranked.map((e) => e.bookId)).size,
              prevalence,
              importance,
              level,
            },
          },
        },
      });
      if (ops.length >= 200) await KbConcept.bulkWrite(ops.splice(0));
    }
    if (ops.length) await KbConcept.bulkWrite(ops);
  }
}

export async function ingestBook(bookId: string): Promise<void> {
  const book: any = await KbBook.findById(bookId);
  if (!book) throw new Error(`Library book ${bookId} not found`);
  if (book.status === 'ready') return;

  return withUsageContext({ step: 'knowledge-library' }, async () => {
    try {
      book.status = 'reading';
      book.error = undefined;
      await book.save();

      const buffer = await streamToBuffer(await sourceFileStore.getDownloadStream(book.fileId));
      const pdf = await readPdf(buffer);
      const { sections, usedOutline } = structureBook(pdf);
      if (!sections.length) throw new Error('No readable text: the PDF may be scanned images');

      const restrictedBook = book.accessTier === 'restricted';
      const haveRows = await KbPassage.countDocuments({ bookId: book._id });
      if (!haveRows || !(book.progress?.doneKeys || []).length) {
        await KbPassage.deleteMany({ bookId: book._id });
        const rows = sections.flatMap((s) =>
          passagesOf(s).map((p) => ({
            ...p,
            bookId: book._id,
            chapter: { number: s.chapter.number, title: s.chapter.title },
            section: { number: s.section.number, title: s.section.title },
            kind: s.kind,
            restricted: restrictedBook || s.kind === 'restricted',
          }))
        );
        for (let i = 0; i < rows.length; i += 500)
          await KbPassage.insertMany(rows.slice(i, i + 500));
        const chapters = new Map<number, any>();
        for (const s of sections) {
          if (!chapters.has(s.chapter.index)) {
            chapters.set(s.chapter.index, {
              chapter: s.chapter.number,
              title: s.chapter.title,
              pages: '',
              sections: [],
            });
          }
          chapters.get(s.chapter.index).sections.push({
            number: s.section.number,
            title: s.section.title,
            pages: `${s.pageLabelStart}-${s.pageLabelEnd}`,
            kind: s.kind,
          });
        }
        for (const c of chapters.values()) {
          const first = c.sections[0]?.pages.split('-')[0];
          const last = c.sections[c.sections.length - 1]?.pages.split('-')[1];
          c.pages = `${first}-${last}`;
        }
        book.toc = Array.from(chapters.values());
        book.pageCount = pdf.pages.length;
        book.usedOutline = usedOutline;
        book.stats = {
          ...(book.stats || {}),
          sections: sections.length,
          passages: rows.length,
          restrictedPassages: rows.filter((r) => r.restricted).length,
        };
        book.markModified('toc');
        book.markModified('stats');
      }

      const todo = restrictedBook ? [] : sections.filter((s) => EXTRACTABLE.has(s.kind));
      const done = new Set<string>(book.progress?.doneKeys || []);
      book.progress = {
        sectionsTotal: todo.length,
        sectionsDone: done.size,
        doneKeys: Array.from(done),
      };
      book.status = 'extracting';
      book.markModified('progress');
      await book.save();

      const areaNames = areasFor(book.domainKeys).map((a) => a.area.name);
      const known: any[] = await KbConcept.find({
        domainKey: { $in: book.domainKeys.length ? book.domainKeys : DOMAINS.map((d) => d.key) },
      })
        .select('key aliasKeys area embedding')
        .lean();
      const existing: Existing[] = known.map((k) => ({
        id: String(k._id),
        key: k.key,
        keys: k.aliasKeys?.length ? k.aliasKeys : [k.key],
        area: k.area,
        vector: k.embedding || [],
      }));
      const counters = {
        extracted: book.stats?.conceptsExtracted || 0,
        created: book.stats?.conceptsNew || 0,
        merged: book.stats?.conceptsMerged || 0,
        unverified: book.stats?.pagesCitedOutsideSection || 0,
      };

      const pending = todo.filter((s) => !done.has(s.key));
      const failed: string[] = [];
      for (let i = 0; i < pending.length; i += EXTRACTION_CONCURRENCY) {
        const batch = pending.slice(i, i + EXTRACTION_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((s) => extractSection(book, s, areaNames))
        );
        for (let j = 0; j < batch.length; j++) {
          const r = results[j];
          if (r.status === 'rejected') {
            if (isAiUnavailable(r.reason)) throw r.reason;
            failed.push(batch[j].key);
            loggingService.warn('Library: a section could not be read', {
              bookId,
              section: batch[j].key,
              error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
            continue;
          }
          await mergeSection(book, batch[j], r.value, existing, counters);
          done.add(batch[j].key);
        }
        await KbBook.updateOne(
          { _id: book._id },
          {
            $set: {
              'progress.sectionsDone': done.size,
              'progress.doneKeys': Array.from(done),
              'stats.conceptsExtracted': counters.extracted,
              'stats.conceptsNew': counters.created,
              'stats.conceptsMerged': counters.merged,
              'stats.pagesCitedOutsideSection': counters.unverified,
            },
          }
        );
      }

      if (failed.length) {
        throw new Error(
          `${failed.length} of ${todo.length} sections could not be read (${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}); run the ingest again to resume`
        );
      }

      await KbBook.updateOne({ _id: book._id }, { $set: { status: 'ready' } });
      await recomputeDomainStats(book.domainKeys);
      await bumpLibraryVersion();
      loggingService.info('Library: book ingested', { bookId, title: book.title, ...counters });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await KbBook.updateOne({ _id: book._id }, { $set: { status: 'failed', error: message } });
      loggingService.error('Library: ingest failed', { bookId, error: message });
      throw error;
    }
  });
}

/**
 * Take a book out of the library: its passages, its evidence on every concept, and any concept
 * no other book teaches. Statistics for its domains are recomputed. The stored PDF is kept.
 */
export async function removeBook(
  bookId: string
): Promise<{ conceptsRemoved: number; conceptsKept: number }> {
  const book: any = await KbBook.findById(bookId);
  if (!book) throw new Error(`Library book ${bookId} not found`);
  await KbPassage.deleteMany({ bookId: book._id });
  let removed = 0;
  let kept = 0;
  const cursor = KbConcept.find({ 'evidence.bookId': book._id }).cursor();
  for await (const doc of cursor as any) {
    const rest = (doc.evidence || []).filter((e: any) => String(e.bookId) !== String(book._id));
    if (!rest.length) {
      await KbConcept.deleteOne({ _id: doc._id });
      removed++;
    } else {
      await KbConcept.updateOne({ _id: doc._id }, { $set: { evidence: rest } });
      kept++;
    }
  }
  // Concepts left with no evidence at all (a removed book was their only source).
  removed += (await KbConcept.deleteMany({ evidence: { $size: 0 } })).deletedCount || 0;
  await KbBook.deleteOne({ _id: book._id });
  await recomputeDomainStats(book.domainKeys);
  await bumpLibraryVersion();
  return { conceptsRemoved: removed, conceptsKept: kept };
}
