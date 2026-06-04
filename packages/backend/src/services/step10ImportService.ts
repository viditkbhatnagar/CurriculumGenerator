/**
 * Step 10 (Lesson Plans) DOCX Re-upload — Parser
 *
 * Reads an edited copy of a Step 10 Word export (full or per-module) and
 * recovers the editable, cleanly-round-tripping fields per lesson:
 *   - lesson number + title   ("Lesson 3: …")
 *   - duration                ("Duration: 90 minutes | …")
 *   - learning objectives      (bullets under "Learning Objectives:")
 *
 * The richer nested content (activity tables, materials, instructor notes,
 * case studies) is intentionally NOT parsed — it does not survive a Word
 * re-save reliably. The apply step matches lessons by number within each
 * module, updates these fields, appends any extra lessons, and preserves all
 * other lesson content. Modules are matched by code (the "M1: Title" heading,
 * anchored on the following "Total Contact Hours: … | Total Lessons: …" line).
 */

import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { loggingService } from './loggingService';

export interface ParsedLesson {
  lessonNumber: number;
  lessonTitle: string;
  duration: number | null;
  objectives: string[];
}

export interface ParsedStep10Module {
  moduleCode: string;
  moduleTitle: string;
  lessons: ParsedLesson[];
}

export interface ParsedStep10 {
  modules: ParsedStep10Module[];
  warnings: string[];
}

const MODULE_TOTALS_RE = /Total\s+Contact\s+Hours:.*Total\s+Lessons:/i;
const LESSON_RE = /^Lesson\s+(\d+)\s*:\s*(.+)$/i;
const DURATION_RE = /^Duration:\s*(\d+)\s*min/i;
const CODE_TITLE_RE = /^([A-Za-z][A-Za-z0-9-]{0,30})\s*:\s+(.+)$/;
// Section labels that appear inside a lesson and end the objectives list.
const LESSON_SUBHEADER_RE =
  /^(Duration:|MLOs:|PLOs:|Learning Objectives:|Activity Sequence:|Required Materials:|Instructor Notes:|Adaptation Options:|Case Study|Independent Study:|Formative)/i;
// Headings that sit above a totals-style line but are NOT modules.
const NON_MODULE_HEADING_RE =
  /^(Lesson Plans|Module Lesson Plans|Validation Summary|Summary Statistics|Generated:|Total Program|\d+(\.\d+)*\s)/i;

class Step10ImportService {
  async parseDocx(buffer: Buffer): Promise<ParsedStep10> {
    const html = (await mammoth.convertToHtml({ buffer })).value;
    const $ = cheerio.load(`<div id="root">${html}</div>`);
    const children = $('#root').first().children().toArray();
    const warnings: string[] = [];

    const textOf = (i: number): string =>
      i >= 0 && i < children.length ? $(children[i]).text().replace(/\s+/g, ' ').trim() : '';
    const tagOf = (i: number): string =>
      i >= 0 && i < children.length ? (children[i] as any).tagName?.toLowerCase?.() || '' : '';

    // Is the next non-empty sibling the module-totals line? Used to recognise
    // a module heading regardless of whether the code survived the re-save.
    const nextIsModuleTotals = (from: number): boolean => {
      for (let j = from + 1; j < children.length; j++) {
        const t = textOf(j);
        if (!t) continue;
        return MODULE_TOTALS_RE.test(t);
      }
      return false;
    };

    const modules: ParsedStep10Module[] = [];
    let currentModule: ParsedStep10Module | null = null;
    let currentLesson: ParsedLesson | null = null;
    let collectingObjectives = false;
    const seenLessonNumbers = new Set<number>();

    const finishLesson = () => {
      if (currentModule && currentLesson) currentModule.lessons.push(currentLesson);
      currentLesson = null;
      collectingObjectives = false;
    };
    const finishModule = () => {
      finishLesson();
      if (currentModule) modules.push(currentModule);
      currentModule = null;
    };

    for (let idx = 0; idx < children.length; idx++) {
      const tag = tagOf(idx);
      const text = textOf(idx);
      if (!text) continue;

      // Module heading — the line whose next non-empty sibling is the
      // "Total Contact Hours: … | Total Lessons: …" summary. Skip known
      // non-module headings that could sit above a totals line.
      if (
        !LESSON_RE.test(text) &&
        !MODULE_TOTALS_RE.test(text) &&
        !NON_MODULE_HEADING_RE.test(text) &&
        nextIsModuleTotals(idx)
      ) {
        finishModule();
        const m = text.match(CODE_TITLE_RE);
        currentModule = {
          moduleCode: m ? m[1].trim() : '',
          moduleTitle: m ? m[2].trim() : text.trim(),
          lessons: [],
        };
        seenLessonNumbers.clear();
        continue;
      }

      if (!currentModule) continue;

      // Lesson heading.
      const lessonMatch = text.match(LESSON_RE);
      if (lessonMatch) {
        finishLesson();
        const num = Number(lessonMatch[1]);
        if (seenLessonNumbers.has(num)) {
          warnings.push(
            `Module "${currentModule.moduleCode || currentModule.moduleTitle}": lesson number ${num} appears more than once in the file — only one will be applied.`
          );
        }
        seenLessonNumbers.add(num);
        currentLesson = {
          lessonNumber: num,
          lessonTitle: lessonMatch[2].trim(),
          duration: null,
          objectives: [],
        };
        continue;
      }

      if (!currentLesson) continue;

      // Duration line.
      const durMatch = text.match(DURATION_RE);
      if (durMatch) {
        currentLesson.duration = Number(durMatch[1]);
        continue;
      }

      // Objectives block.
      if (/^Learning Objectives:/i.test(text)) {
        collectingObjectives = true;
        continue;
      }
      if (collectingObjectives) {
        // A new sub-header / lesson / module — or flattened activity-table
        // debris (a re-save turns the table into pipe/column-style paragraphs)
        // — ends the objectives list.
        if (
          LESSON_SUBHEADER_RE.test(text) ||
          LESSON_RE.test(text) ||
          tag === 'table' ||
          /[|\t]/.test(text) ||
          /^\d+\s+\S+.*\b(min|minutes)\b/i.test(text)
        ) {
          collectingObjectives = false;
          // fall through so this paragraph is still processed below
        } else {
          // Bullet items: mammoth may emit <ul><li> or "• …" paragraphs.
          if (tag === 'ul' || tag === 'ol') {
            $(children[idx])
              .find('li')
              .each((_, li) => {
                const t = $(li).text().replace(/\s+/g, ' ').trim();
                if (t) currentLesson!.objectives.push(t.replace(/^[•‣◦-]\s*/, ''));
              });
          } else {
            currentLesson.objectives.push(text.replace(/^[•‣◦-]\s*/, '').trim());
          }
          continue;
        }
      }
      // Any other content (activities, materials, notes) is ignored — those
      // fields are preserved from the existing lesson on apply.
    }
    finishModule();

    if (modules.length === 0) {
      warnings.push(
        'No modules/lessons were recognised. Make sure you uploaded a Step 10 (Lesson Plans) Word export.'
      );
    }

    loggingService.info('Step 10 DOCX parsed', {
      modules: modules.length,
      totalLessons: modules.reduce((s, m) => s + m.lessons.length, 0),
      warnings: warnings.length,
    });

    return { modules, warnings };
  }
}

export const step10ImportService = new Step10ImportService();
