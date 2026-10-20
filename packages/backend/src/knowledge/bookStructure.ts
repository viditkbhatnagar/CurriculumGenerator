/**
 * A book's structure on disk: its passages and table of contents, written from the parsed PDF.
 *
 * Shared by the ingest and by restructureBook, which re-reads only the structure of a book
 * already in the library. That exists because the parser improves after books are loaded: on
 * 20 October 2026 Murphy's Probabilistic Machine Learning was found citing "Ch. 4 §13" for
 * chapter 13, its roman-numeral parts having been read as chapters. Re-extracting the book to
 * fix a label would cost an hour of model calls and could change its concepts; the concepts
 * are right and only where they sit in the book was wrong, so evidence is relabelled by page.
 */
import * as sourceFileStore from '../services/sourceFileStore';
import { readPdf } from './pdf/readPdf';
import { structureBook, passagesOf, BookSection } from './structure';
import { KbBook, KbConcept, KbPassage } from './models';

const INSERT_BATCH = 500;
const EXTRACTABLE = new Set(['body', 'summary']);

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export interface ParsedBook {
  sections: BookSection[];
  usedOutline: boolean;
  pageCount: number;
  /** Printed page label to its 1-based position in the file (first occurrence). */
  pageOfLabel: Map<string, number>;
}

export async function parseBookFile(fileId: string): Promise<ParsedBook> {
  const buffer = await streamToBuffer(await sourceFileStore.getDownloadStream(fileId));
  const pdf = await readPdf(buffer);
  const { sections, usedOutline } = structureBook(pdf);
  if (!sections.length) throw new Error('No readable text: the PDF may be scanned images');
  const pageOfLabel = new Map<string, number>();
  for (const p of pdf.pages) if (!pageOfLabel.has(p.label)) pageOfLabel.set(p.label, p.number);
  return { sections, usedOutline, pageCount: pdf.pages.length, pageOfLabel };
}

function tocOf(sections: BookSection[]): any[] {
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
  return Array.from(chapters.values()).map((c) => ({
    ...c,
    pages: `${c.sections[0]?.pages.split('-')[0]}-${c.sections[c.sections.length - 1]?.pages.split('-')[1]}`,
  }));
}

/** Replace a book's passages and contents with those of `parsed`. Saving the book is the caller's. */
export async function writeStructure(book: any, parsed: ParsedBook): Promise<void> {
  const restrictedBook = book.accessTier === 'restricted';
  await KbPassage.deleteMany({ bookId: book._id });
  const rows = parsed.sections.flatMap((s) =>
    passagesOf(s).map((p) => ({
      ...p,
      bookId: book._id,
      chapter: { number: s.chapter.number, title: s.chapter.title },
      section: { number: s.section.number, title: s.section.title },
      kind: s.kind,
      restricted: restrictedBook || s.kind === 'restricted',
    }))
  );
  for (let i = 0; i < rows.length; i += INSERT_BATCH)
    await KbPassage.insertMany(rows.slice(i, i + INSERT_BATCH));
  book.toc = tocOf(parsed.sections);
  book.pageCount = parsed.pageCount;
  book.usedOutline = parsed.usedOutline;
  book.stats = {
    ...(book.stats || {}),
    sections: parsed.sections.length,
    passages: rows.length,
    restrictedPassages: rows.filter((r) => r.restricted).length,
  };
  book.markModified('toc');
  book.markModified('stats');
}

/**
 * The section a citation belongs to, found by its pages: of the sections covering its first
 * page, those also covering its last; among them the section it was already filed under if
 * that is one, else the latest to begin (the section in force on that page). Null when the
 * page is not in the book.
 */
export function sectionForPages(
  sections: BookSection[],
  pageOfLabel: Map<string, number>,
  labelStart: string,
  labelEnd: string,
  currentSection?: string
): BookSection | null {
  const first = pageOfLabel.get(String(labelStart));
  if (first === undefined) return null;
  const last = pageOfLabel.get(String(labelEnd)) ?? first;
  const covering = sections.filter((s) => s.pdfPageStart <= first && first <= s.pdfPageEnd);
  if (!covering.length) return null;
  const whole = covering.filter((s) => last <= s.pdfPageEnd);
  const candidates = whole.length ? whole : covering;
  const unchanged = currentSection
    ? candidates.find((s) => s.section.number === currentSection)
    : undefined;
  return unchanged || candidates.reduce((a, b) => (b.pdfPageStart >= a.pdfPageStart ? b : a));
}

export interface RestructureResult {
  sections: number;
  passages: number;
  conceptsUpdated: number;
  evidenceRelabelled: number;
  evidenceUnplaced: number;
}

/** Re-read a ready book's structure and relabel its evidence by page; no model is called. */
export async function restructureBook(bookId: string): Promise<RestructureResult> {
  const book: any = await KbBook.findById(bookId);
  if (!book) throw new Error(`Library book ${bookId} not found`);
  if (book.status !== 'ready')
    throw new Error(`The book is ${book.status}; wait until it is ready`);

  const parsed = await parseBookFile(book.fileId);
  await writeStructure(book, parsed);
  const done = parsed.sections.filter((s) => EXTRACTABLE.has(s.kind)).map((s) => s.key);
  book.progress = { sectionsTotal: done.length, sectionsDone: done.length, doneKeys: done };
  book.markModified('progress');
  await book.save();

  let evidenceRelabelled = 0;
  let evidenceUnplaced = 0;
  const writes: any[] = [];
  const concepts: any[] = await KbConcept.find({ 'evidence.bookId': book._id })
    .select('evidence')
    .lean();
  for (const c of concepts) {
    const evidence = (c.evidence || []).map((e: any) => {
      if (String(e.bookId) !== String(book._id)) return e;
      const s = sectionForPages(
        parsed.sections,
        parsed.pageOfLabel,
        e.pageLabelStart,
        e.pageLabelEnd,
        e.section?.number
      );
      if (!s) {
        evidenceUnplaced += 1;
        return e;
      }
      evidenceRelabelled += 1;
      return {
        ...e,
        chapter: { number: s.chapter.number, title: s.chapter.title },
        section: { number: s.section.number, title: s.section.title },
        sectionKey: s.key,
      };
    });
    writes.push({ updateOne: { filter: { _id: c._id }, update: { $set: { evidence } } } });
  }
  for (let i = 0; i < writes.length; i += INSERT_BATCH)
    await KbConcept.bulkWrite(writes.slice(i, i + INSERT_BATCH), { ordered: false });

  return {
    sections: parsed.sections.length,
    passages: book.stats.passages,
    conceptsUpdated: writes.length,
    evidenceRelabelled,
    evidenceUnplaced,
  };
}
