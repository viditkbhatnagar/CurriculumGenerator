/**
 * Curriculum DOCX Re-upload — Parser
 *
 * Reads the Step 4 ("Course Structure & Module Learning Outcomes") section
 * from an edited copy of the full curriculum Word export and returns a
 * normalised shape that the apply endpoint can merge back into step4.
 *
 * The export generator was extended so every editable field appears in the
 * doc with a stable label / column header. Match keys:
 *
 *   - Modules match by moduleCode (the bold "{CODE}: {title}" line).
 *   - MLOs   match by code        (the first column in the MLO table).
 *
 * Missing items are treated as deletions; new items are added. The applier
 * is responsible for snapshotting step4 before mutating it.
 */

import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { loggingService } from './loggingService';

export interface ParsedMlo {
  code: string;
  statement: string;
  bloomLevel: string;
  verb: string;
  linkedPLOs: string[];
}

export interface ParsedTopic {
  sequence: number;
  title: string;
  hours: number;
}

export interface ParsedModule {
  moduleCode: string;
  title: string;
  description: string;
  totalHours: number | null;
  contactHours: number | null;
  independentHours: number | null;
  mlos: ParsedMlo[];
  topics: ParsedTopic[];
  contactActivities: string[];
  independentActivities: string[];
}

export interface ParsedCurriculum {
  modules: ParsedModule[];
  warnings: string[];
}

class CurriculumImportService {
  async parseDocx(buffer: Buffer): Promise<ParsedCurriculum> {
    const html = (await mammoth.convertToHtml({ buffer })).value;
    const $ = cheerio.load(`<div id="root">${html}</div>`);

    const warnings: string[] = [];

    // Walk every direct child of #root in document order. Section boundaries
    // are detected by looking at the bold heading paragraphs the exporter
    // writes ("4. Course Structure & Module Learning Outcomes").
    const root = $('#root').first();
    const children = root.children().toArray();

    let inStep4 = false;
    let currentModule: ParsedModule | null = null;
    const modules: ParsedModule[] = [];

    // Helpers ------------------------------------------------------------
    const finishCurrent = () => {
      if (currentModule) {
        modules.push(currentModule);
        currentModule = null;
      }
    };

    const isStep4Heading = (text: string) =>
      /course\s+structure\s*&\s*module\s+learning\s+outcomes/i.test(text);

    const isOtherStepHeading = (text: string) =>
      /^\s*(\d{1,2})\.\s+[A-Z]/.test(text) && !isStep4Heading(text);

    // "Hours: X (Contact: Y, Independent: Z)" — the most reliable anchor in a
    // module body. We use it two ways: to read the hours, and (via lookahead)
    // to recognise the paragraph just before it as a module heading. This is
    // robust to headings that carry no code (title-only) and to Word/LibreOffice
    // re-saves that reshuffle run boundaries.
    const HOURS_RE = /Hours:\s*(\d+)\s*\(\s*Contact:\s*(\d+|-)\s*,\s*Independent:\s*(\d+|-)\s*\)/i;
    // Optional "{CODE}: {title}" prefix. A real module code is uppercase and
    // carries at least one digit (DFE101, CAFHN-406-1701, MOD201). Requiring a
    // digit stops a normal title that merely contains a colon — e.g.
    // "Capstone: Seasonal Capsule" — from being mis-split into code + title.
    const CODE_TITLE_RE = /^([A-Z][A-Z0-9-]*\d[A-Z0-9-]*)\s*:\s+(.+)$/;

    const textOf = (i: number): string =>
      i >= 0 && i < children.length ? $(children[i]).text().replace(/\s+/g, ' ').trim() : '';

    // Signals that the FIRST non-empty sibling marks the start of a module
    // body: the Hours line (normal case), or — if an SME deleted the Hours
    // line in Word — the Description line or the MLO-table header. We only
    // look at the immediate next non-empty element so we never catch the
    // *following* module's Hours line (which would mis-detect summary and
    // activity lines as headings).
    const MODULE_BODY_START_RE = /^(Hours:|Description:|Module Learning Outcomes:)/i;
    const nextStartsModuleBody = (from: number): boolean => {
      for (let j = from + 1; j < children.length; j++) {
        const t = textOf(j);
        if (!t) continue; // skip blank paragraphs a re-save may insert
        return HOURS_RE.test(t) || MODULE_BODY_START_RE.test(t);
      }
      return false;
    };

    const startModule = (headingText: string) => {
      finishCurrent();
      const m = headingText.match(CODE_TITLE_RE);
      currentModule = {
        moduleCode: m ? m[1].trim() : '',
        title: m ? m[2].trim() : headingText.trim(),
        description: '',
        totalHours: null,
        contactHours: null,
        independentHours: null,
        mlos: [],
        topics: [],
        contactActivities: [],
        independentActivities: [],
      };
    };

    for (let idx = 0; idx < children.length; idx++) {
      const el = children[idx];
      const $el = $(el);
      const tag = (el as any).tagName?.toLowerCase?.() || '';
      const text = $el.text().replace(/\s+/g, ' ').trim();

      if (!text && tag !== 'table' && tag !== 'ul') continue;

      // Section transitions ---------------------------------------------
      if (!inStep4) {
        if (isStep4Heading(text)) inStep4 = true;
        continue;
      }
      // Leave the section as soon as we hit the next numbered top-level
      // heading (5. Academic Sources, 6. Reading Lists, ...).
      if (isOtherStepHeading(text) && !/contact\s+activities/i.test(text)) {
        finishCurrent();
        break;
      }

      // Inside Step 4 ---------------------------------------------------

      // Hours line for the current module.
      const hoursMatch = text.match(HOURS_RE);
      if (hoursMatch && currentModule) {
        currentModule.totalHours = Number(hoursMatch[1]);
        currentModule.contactHours = hoursMatch[2] === '-' ? null : Number(hoursMatch[2]);
        currentModule.independentHours = hoursMatch[3] === '-' ? null : Number(hoursMatch[3]);
        continue;
      }

      // Module heading detection. A paragraph is a module heading when the
      // next line (within a short window) is a Hours line — this holds whether
      // or not the heading carries a code, and survives Word re-saves.
      const isSubHeader =
        /^(Hours|Description|Module Learning Outcomes|Topics|Contact Activities|Independent Activities)\b/i.test(
          text
        );
      const looksLikeParagraph = tag === 'p' || /^h[1-6]$/.test(tag);
      if (looksLikeParagraph && !isSubHeader && nextStartsModuleBody(idx)) {
        startModule(text);
        continue;
      }

      if (!currentModule) continue;

      // Description --------------------------------------------------------
      if (/^Description:/i.test(text)) {
        currentModule.description = text.replace(/^Description:\s*/i, '').trim();
        continue;
      }

      // MLO table ----------------------------------------------------------
      if (tag === 'table') {
        const rows = $el.find('tr').toArray();
        if (rows.length < 2) continue;
        // First row is header — figure out column order by header text.
        const headerCells = $(rows[0]).find('th, td').toArray();
        const headers = headerCells.map((c) =>
          $(c).text().replace(/\s+/g, ' ').trim().toLowerCase()
        );
        const colIndex: Record<string, number> = {};
        headers.forEach((h, i) => {
          if (h === 'code' || h.includes(' code') || h.endsWith('code') || h === 'id')
            colIndex.code = i;
          else if (
            /learning\s+(outcome|objective|goal|statement)|^(outcome|objective|mlo|lo)\b/.test(h)
          )
            colIndex.statement = i;
          else if (h.includes('bloom')) colIndex.bloom = i;
          else if (h === 'verb') colIndex.verb = i;
          else if (h.includes('linked plo') || h === 'plos' || h === 'plo') colIndex.plos = i;
        });
        // Fallback: if no statement header matched but a code column exists,
        // the statement is almost always the column immediately after it.
        if (colIndex.statement === undefined && colIndex.code !== undefined) {
          colIndex.statement = colIndex.code + 1;
        }
        if (colIndex.statement === undefined) {
          warnings.push(
            `Module ${currentModule.moduleCode || currentModule.title}: could not find a Learning Outcome column in its MLO table (headers seen: ${headers.join(', ')}). Its MLOs were left unchanged.`
          );
          continue;
        }
        rows.slice(1).forEach((row) => {
          const cells = $(row).find('td, th').toArray();
          if (cells.length === 0) return;
          const cellText = (i: number | undefined) =>
            i === undefined ? '' : $(cells[i]).text().replace(/\s+/g, ' ').trim();
          const code = cellText(colIndex.code);
          const statement = cellText(colIndex.statement);
          if (!statement || statement === '-') return;
          currentModule!.mlos.push({
            code: code && code !== '-' ? code : '',
            statement,
            bloomLevel: (cellText(colIndex.bloom) || 'apply').toLowerCase().replace(/^-$/, 'apply'),
            verb: cellText(colIndex.verb).replace(/^-$/, ''),
            linkedPLOs: cellText(colIndex.plos)
              .split(/[,;]+/)
              .map((s) => s.trim())
              .filter((s) => s && s !== '-'),
          });
        });
        continue;
      }

      // Topics / Activities — block headers followed by bullet lists -----
      // We don't try to parse them here; the bullet <ul> that follows is
      // handled in the next loop iterations via a small lookahead state.
      // Instead, we set a "mode" we remember between iterations.
      // Simpler approach: detect "Topics:", "Contact Activities:",
      // "Independent Activities:" headers and consume bullets directly
      // from the next sibling <ul>.
      const modeForHeading = this.detectListHeading(text);
      if (modeForHeading) {
        const list = this.collectFollowingBullets($, el);
        list.forEach((line) => {
          if (modeForHeading === 'topics') {
            const m = line.match(/^\[?(\d+)\]?\s+(.+?)(?:\s*\((\d+(?:\.\d+)?)h?\))?\s*$/);
            if (m) {
              currentModule!.topics.push({
                sequence: Number(m[1]),
                title: m[2].trim(),
                hours: m[3] ? Number(m[3]) : 0,
              });
            } else if (line.trim()) {
              currentModule!.topics.push({
                sequence: currentModule!.topics.length + 1,
                title: line.trim(),
                hours: 0,
              });
            }
          } else if (modeForHeading === 'contact') {
            if (line.trim()) currentModule!.contactActivities.push(line.trim());
          } else if (modeForHeading === 'independent') {
            if (line.trim()) currentModule!.independentActivities.push(line.trim());
          }
        });
        continue;
      }
    }

    finishCurrent();

    // A module with no hours usually means its "Hours:" line was deleted or
    // mangled during editing — surface it rather than silently keeping nulls.
    modules.forEach((m) => {
      if (m.totalHours === null) {
        warnings.push(
          `Module "${m.moduleCode || m.title}" had no readable Hours line — its hours were left unchanged. Check the "Hours: N (Contact: N, Independent: N)" line wasn't deleted.`
        );
      }
    });

    loggingService.info('Curriculum DOCX parsed', {
      modules: modules.length,
      totalMlos: modules.reduce((sum, m) => sum + m.mlos.length, 0),
      warnings: warnings.length,
    });

    return { modules, warnings };
  }

  private detectListHeading(text: string): 'topics' | 'contact' | 'independent' | null {
    if (/^topics\s*:?\s*$/i.test(text)) return 'topics';
    if (/^contact\s+activities\s*:?\s*$/i.test(text)) return 'contact';
    if (/^independent\s+activities\s*:?\s*$/i.test(text)) return 'independent';
    return null;
  }

  /**
   * Mammoth often renders our bullet paragraphs as a sequence of <p>•...</p>
   * elements rather than a single <ul>. Walk forward from the heading until
   * we hit a non-bullet paragraph and collect the lines either way.
   */
  private collectFollowingBullets($: cheerio.CheerioAPI, headingEl: any): string[] {
    const lines: string[] = [];
    let next: any = headingEl.next;
    while (next) {
      const $n = $(next);
      const tag = next.tagName?.toLowerCase?.() || '';
      if (tag === 'ul' || tag === 'ol') {
        $n.find('li').each((_, li) => {
          const t = $(li).text().replace(/\s+/g, ' ').trim();
          if (t) lines.push(t.replace(/^•\s*/, ''));
        });
        return lines;
      }
      if (tag === 'p') {
        const text = $n.text().replace(/\s+/g, ' ').trim();
        if (!text) {
          next = next.next;
          continue;
        }
        // Bullet-ish paragraphs start with • or - . If the next paragraph
        // doesn't look like a bullet we've reached the end of the block.
        if (/^[•-]\s*/.test(text)) {
          lines.push(text.replace(/^[•-]\s*/, '').trim());
          next = next.next;
          continue;
        }
        // A Word/LibreOffice re-save can strip the bullet symbol from list
        // items. For the FIRST item only, accept any line that isn't itself
        // a heading (module heading / sub-header) — otherwise we'd drop a
        // de-bulleted item. Subsequent lines still require a bullet symbol so
        // we never run past the block into the next module.
        const isHeadingLike =
          /^(Hours:|Description:|Module Learning Outcomes:|Topics:|Contact Activities:|Independent Activities:)/i.test(
            text
          ) || /^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\s*:\s+/.test(text);
        if (lines.length === 0 && !isHeadingLike) {
          // Keep the raw text — the Topics branch still needs any "[n]" prefix
          // to recover the sequence number.
          lines.push(text);
          next = next.next;
          continue;
        }
        return lines;
      }
      // Tables / other elements end the block.
      return lines;
    }
    return lines;
  }
}

export const curriculumImportService = new CurriculumImportService();
