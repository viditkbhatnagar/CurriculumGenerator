/**
 * Book Intelligence Service — the "Step 5.5 / Book Ingestion" engine.
 *
 * Turns one SME-opted-in, rights-cleared textbook (sourced in Step 5) into a
 * structured, source-grounded knowledge layer:
 *   parse → decompose (chunked + checkpointed) → embed nodes into the vector KB.
 *
 * Decomposition is chunk-scoped and resumable (mirrors the Step 13
 * checkpoint/resume pattern): an interrupted ingest continues from the last
 * completed segment instead of restarting. See docs/book-ingestion/.
 */

import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { openaiService } from './openaiService';
import { vectorSearchService } from './vectorSearchService';
import { loggingService } from './loggingService';
import {
  BookIntelligence,
  IBookIntelligence,
  BookIntelligenceNode,
} from '../models/BookIntelligence';

interface BookSegment {
  id: string;
  title: string;
  text: string;
}

interface DecomposeContext {
  programTitle: string;
  academicLevel: string;
  mappedMloIds: string[];
  depth: string;
  bookTitle: string;
}

// Roughly one decomposition window. Textbook chapters exceed a single model
// call, so we window the text and decompose (and checkpoint) per window.
const SEGMENT_CHAR_LIMIT = 9000;
const MAX_NODES_PER_SEGMENT: Record<string, number> = {
  essential: 4,
  standard: 8,
  comprehensive: 14,
  forensic: 24,
};

export class BookIntelligenceService {
  /**
   * Extract text from a DOCX buffer and split it into decomposition segments.
   * Prefers real headings; falls back to fixed-size windows so ingestion works
   * even for a heading-less export. (Page-aware PDF parsing is a P1 follow-up —
   * this handles the DOCX/text sources we have today.)
   */
  async parseBook(buffer: Buffer): Promise<{ segments: BookSegment[]; chapterTitles: string[] }> {
    const html = (await mammoth.convertToHtml({ buffer })).value;
    const $ = cheerio.load(`<div id="root">${html}</div>`);
    const children = $('#root').children().toArray();

    const segments: BookSegment[] = [];
    const chapterTitles: string[] = [];
    let currentTitle = 'Front matter';
    let buf = '';
    let segIdx = 0;

    const flush = () => {
      const text = buf.replace(/\s+/g, ' ').trim();
      if (text.length > 40) {
        // Window large sections so each decomposition call stays in budget.
        for (let i = 0; i < text.length; i += SEGMENT_CHAR_LIMIT) {
          segments.push({
            id: `seg-${segIdx++}`,
            title: currentTitle,
            text: text.slice(i, i + SEGMENT_CHAR_LIMIT),
          });
        }
      }
      buf = '';
    };

    for (const c of children) {
      const tag = (c as any).tagName?.toLowerCase?.() || '';
      const text = $(c).text().replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const isHeading =
        /^h[1-3]$/.test(tag) ||
        /^(chapter|part|module|unit)\s+\d+/i.test(text) ||
        (text.length < 80 && /^(chapter|introduction|conclusion|preface)/i.test(text));
      if (isHeading) {
        flush();
        currentTitle = text.slice(0, 120);
        chapterTitles.push(currentTitle);
      } else {
        buf += ' ' + text;
        if (buf.length >= SEGMENT_CHAR_LIMIT * 2) flush();
      }
    }
    flush();

    return { segments, chapterTitles };
  }

  private buildSystemPrompt(ctx: DecomposeContext): string {
    return `You are the Book Intelligence Decomposition Engine for a curriculum platform.
Decompose the provided textbook segment into atomic, SOURCE-GROUNDED knowledge nodes,
in service of this curriculum (program: "${ctx.programTitle}", level: ${ctx.academicLevel}).

RULES:
- Extract only what the text actually supports. NO fabrication — never invent facts, stats, quotes or examples.
- Each node is the smallest independently useful unit (one idea).
- Prefer content that serves these curriculum outcomes (MLOs): ${ctx.mappedMloIds.join(', ') || "(none specified — extract the segment's core knowledge)"}.
- Store FAITHFUL PARAPHRASE, never verbatim copyrighted text. Short quotes only if essential.
- Label each node's type and a confidence (High/Medium/Low).
- Depth = ${ctx.depth}: return at most ${MAX_NODES_PER_SEGMENT[ctx.depth] ?? 8} of the most important nodes for this segment.

Return ONLY valid JSON:
{"nodes":[{
  "nodeType":"Concept|Claim|Framework|Example|Mechanism|Definition|Principle|Method|Model",
  "title":"short label",
  "oneSentenceMeaning":"one sentence",
  "detailedContent":"faithful paraphrase (2-5 sentences)",
  "mloIds":["MLO ids from the list that this serves, or []"],
  "confidence":"High|Medium|Low",
  "derivationType":"Direct extraction|Faithful paraphrase|Interpretation",
  "evidenceStrength":"strong|moderate|weak|n/a",
  "tags":["keyword", "..."]
}]}`;
  }

  /** Decompose a single segment into nodes via the LLM. */
  async decomposeSegment(seg: BookSegment, ctx: DecomposeContext): Promise<BookIntelligenceNode[]> {
    const system = this.buildSystemPrompt(ctx);
    const prompt = `TEXTBOOK: "${ctx.bookTitle}"\nSECTION: ${seg.title}\n\nSEGMENT TEXT:\n${seg.text}\n\nReturn the JSON now.`;
    const resp = await openaiService.generateContent(prompt, system, {
      responseFormat: 'json_object',
      maxTokens: 8000,
      timeout: 5 * 60 * 1000,
    });
    let parsed: any;
    try {
      parsed = JSON.parse(resp);
    } catch {
      loggingService.warn('Book decomposition returned invalid JSON — skipping segment', {
        segment: seg.id,
      });
      return [];
    }
    const raw: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
    return raw
      .filter((n) => n && n.title && n.detailedContent)
      .map((n, i) => ({
        nodeId: `${seg.id}-n${i}`,
        nodeType: String(n.nodeType || 'Concept'),
        title: String(n.title).slice(0, 200),
        oneSentenceMeaning: String(n.oneSentenceMeaning || '').slice(0, 400),
        detailedContent: String(n.detailedContent || '').slice(0, 2000),
        sourceLocation: `${ctx.bookTitle} → ${seg.title}`,
        mloIds: Array.isArray(n.mloIds) ? n.mloIds.filter(Boolean) : [],
        tags: Array.isArray(n.tags) ? n.tags.filter(Boolean) : [],
        evidenceStrength: n.evidenceStrength ? String(n.evidenceStrength) : undefined,
        confidence: ['High', 'Medium', 'Low'].includes(n.confidence) ? n.confidence : 'Medium',
        derivationType: String(n.derivationType || 'Faithful paraphrase'),
        scope: 'core',
        reviewStatus: n.confidence === 'Low' ? 'needs_review' : 'auto',
      }));
  }

  /** Embed one node into the existing vector knowledge base; returns its KB id. */
  private async embedNode(node: BookIntelligenceNode, book: IBookIntelligence): Promise<string> {
    const embedding = await openaiService.generateEmbedding(node.detailedContent);
    const credibility =
      node.confidence === 'High' ? 0.9 : node.confidence === 'Medium' ? 0.75 : 0.6;
    return vectorSearchService.storeEmbedding({
      content: node.detailedContent,
      sourceType: 'docx',
      domain: 'book-intelligence',
      credibilityScore: credibility,
      metadata: {
        title: node.title,
        author: book.authors || undefined,
        tags: [
          `book:${book._id}`,
          `node:${node.nodeId}`,
          `type:${node.nodeType}`,
          `workflow:${book.workflowId}`,
          ...node.mloIds.map((m) => `mlo:${m}`),
        ],
        chunkIndex: 0,
        totalChunks: 1,
        isFoundational: node.confidence === 'High',
      },
      embedding,
    });
  }

  /**
   * Full ingest for one book document: parse → decompose (resumable) → embed.
   * Safe to call again after an interruption — completed segments are skipped.
   */
  async ingest(bookId: string, buffer: Buffer, ctx: DecomposeContext): Promise<IBookIntelligence> {
    const book = await BookIntelligence.findById(bookId);
    if (!book) throw new Error('BookIntelligence record not found');

    try {
      book.status = 'parsing';
      book.lastError = null;
      await book.save();

      const { segments, chapterTitles } = await this.parseBook(buffer);
      book.sourceMap = { chapters: chapterTitles, segmentCount: segments.length };
      book.status = 'decomposing';
      await book.save();

      const done = new Set(book.ingestDraft?.chaptersDone || []);
      loggingService.info('Book ingest: decomposing', {
        bookId,
        segments: segments.length,
        alreadyDone: done.size,
      });

      for (const seg of segments) {
        if (done.has(seg.id)) continue;
        const nodes = await this.decomposeSegment(seg, ctx);
        // Re-fetch to avoid clobbering concurrent writes, then checkpoint.
        const fresh = await BookIntelligence.findById(bookId);
        if (!fresh) throw new Error('BookIntelligence record vanished mid-ingest');
        fresh.nodes.push(...nodes);
        fresh.ingestDraft = {
          chaptersDone: [...(fresh.ingestDraft?.chaptersDone || []), seg.id],
          savedAt: new Date(),
        };
        fresh.markModified('nodes');
        fresh.markModified('ingestDraft');
        await fresh.save();
      }

      // Embed any nodes not yet embedded.
      const toEmbed = await BookIntelligence.findById(bookId);
      if (!toEmbed) throw new Error('BookIntelligence record vanished before embedding');
      toEmbed.status = 'embedding';
      await toEmbed.save();

      let embedded = 0;
      for (const node of toEmbed.nodes) {
        if (node.embeddingId) continue;
        try {
          node.embeddingId = await this.embedNode(node, toEmbed);
          embedded++;
        } catch (e) {
          loggingService.warn('Failed to embed book node (continuing)', {
            nodeId: node.nodeId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      toEmbed.markModified('nodes');

      const lowConfidence = toEmbed.nodes.filter((n) => n.confidence === 'Low').length;
      toEmbed.qualityReport = {
        totalNodes: toEmbed.nodes.length,
        embedded,
        lowConfidence,
        segments: segments.length,
      };
      toEmbed.status = lowConfidence > 0 ? 'needs_review' : 'ready';
      toEmbed.ingestDraft = undefined;
      toEmbed.markModified('ingestDraft');
      await toEmbed.save();

      loggingService.info('Book ingest complete', {
        bookId,
        nodes: toEmbed.nodes.length,
        embedded,
        status: toEmbed.status,
      });
      return toEmbed;
    } catch (error) {
      const fresh = await BookIntelligence.findById(bookId);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = {
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        };
        await fresh.save();
      }
      throw error;
    }
  }
}

export const bookIntelligenceService = new BookIntelligenceService();
