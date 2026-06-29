/**
 * Step 10 (Lesson Plans) DOCX Re-upload — Parser
 *
 * Reads an edited copy of a Step 10 Word export (full or per-module) and
 * recovers the editable lesson content so an SME can correct lesson plans in
 * Word and have the edits applied back. Per lesson it captures:
 *   - number, title, duration, Bloom level, linked MLOs/PLOs/KSCs
 *   - learning objectives
 *   - topic coverage (exact topic, subtopics, practical activity, evidence)
 *   - the activity sequence (table)
 *   - required materials, instructor notes, adaptation options
 *   - the independent activity block (table)
 *
 * Robust to Word/LibreOffice re-saves that flatten tables into paragraphs.
 * Modules are matched by a "{CODE}: {title}" heading or the following
 * "Total Contact Hours: … | Total Lessons: …" line.
 */

import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { loggingService } from './loggingService';

export interface ParsedActivity {
  sequenceOrder: number;
  title: string;
  type: string;
  duration: number;
  description: string;
}

export interface ParsedLesson {
  lessonNumber: number;
  lessonTitle: string;
  duration: number | null;
  bloomLevel?: string;
  linkedMLOs?: string[];
  linkedPLOs?: string[];
  linkedKSCs?: string[];
  objectives: string[];
  topicCoverage?: {
    exactTopic?: string;
    subtopics?: string[];
    practicalActivity?: string;
    studentEvidence?: string;
  };
  activities?: ParsedActivity[];
  materials?: string[];
  instructorNotes?: { pedagogicalGuidance?: string; adaptationOptions?: string[] };
  independentActivity?: {
    independentHours?: number;
    sourceMaterialMapping?: string;
    independentTask?: string;
    aiPlatformSupport?: string;
    studentEvidence?: string;
  };
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
// A module-code heading, e.g. "MOD101: Title", "M1: Title", "CAFHN-406-1701: Title".
// Lets us recognise a module even when an edit changed/removed the totals line.
// Requires an uppercase, digit-bearing code so lesson sub-headers (Duration:,
// Learning Objectives:, Topic Coverage…) are never mistaken for modules.
const MODULE_CODE_HEADING_RE = /^([A-Z][A-Z0-9]*-?[A-Z0-9]*\d[A-Z0-9-]*)\s*:\s+(.+)$/;
// Section labels that appear inside a lesson and end the objectives list.
const LESSON_SUBHEADER_RE =
  /^(Duration:|MLOs:|PLOs:|KSCs:|Learning Objectives:|Activity Sequence:|Required Materials:|Instructor Notes:|Adaptation Options:|Case Study|Independent Study:|Formative|Topic Coverage|Independent Activity Block:)/i;
// Headings that sit above a totals-style line but are NOT modules.
const NON_MODULE_HEADING_RE =
  /^(Lesson Plans|Module Lesson Plans|Validation Summary|Summary Statistics|Generated:|Total Program|\d+(\.\d+)*\s)/i;

// ---------------------------------------------------------------------------
// "Narrative" lesson-plan format (e.g. an externally-authored / AI-drafted doc
// rather than our structured Step 10 Word export). Modules are introduced with
// "Starting MOD101: <title>.", each lesson with "Here's Lesson N, mapped to …",
// and the title/duration sit on a "Lesson Title: <title> Duration: N minutes …"
// line, followed by a bullet list of objectives. Used only as a fallback when
// the structured parser recognises nothing.
const NARRATIVE_MODULE_RE = /^Starting\s+([A-Za-z]{1,8}\s?\d[A-Za-z0-9-]*)\s*[:.\-–]\s*(.+)$/i;
const NARRATIVE_LESSON_RE = /^Here.?s\s+Lesson\s+(\d+)\b/i;
const NARRATIVE_TITLE_RE = /Lesson\s+Title:\s*(.+?)(?:\s+Duration:|\s+Learning\s+Objectives|$)/i;
const NARRATIVE_DURATION_RE = /Duration:\s*(\d+)\s*min/i;
const NARRATIVE_MLO_RE = /mapped to\s+([A-Z0-9][A-Z0-9-]*)/i;

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
    // Which free-text/bullet block we are currently inside a lesson.
    let section: 'objectives' | 'materials' | 'notes' | 'adaptation' | null = null;
    const seenLessonNumbers = new Set<number>();

    const finishLesson = () => {
      if (currentModule && currentLesson) currentModule.lessons.push(currentLesson);
      currentLesson = null;
      section = null;
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

      // Module heading. Recognised two ways so an edited file still works:
      //   1. a "{CODE}: {title}" line where CODE is a real module code, OR
      //   2. any non-lesson line whose next non-empty sibling is the
      //      "Total Contact Hours: … | Total Lessons: …" summary.
      const codeHeading = text.match(MODULE_CODE_HEADING_RE);
      const isModuleHeading =
        !LESSON_RE.test(text) &&
        !MODULE_TOTALS_RE.test(text) &&
        !NON_MODULE_HEADING_RE.test(text) &&
        !LESSON_SUBHEADER_RE.test(text) &&
        (!!codeHeading || nextIsModuleTotals(idx));
      if (isModuleHeading) {
        finishModule();
        const m = codeHeading || text.match(CODE_TITLE_RE);
        currentModule = {
          moduleCode: m ? m[1].trim() : '',
          moduleTitle: m ? m[2].trim() : text.trim(),
          lessons: [],
        };
        seenLessonNumbers.clear();
        continue;
      }

      // Lesson heading. If a lesson appears before any module heading was
      // found (e.g. the module heading/totals line was edited away), open an
      // implicit module so the lessons are still captured — a per-module file
      // is about one module, and the apply step matches it by title/code.
      const lessonMatch = text.match(LESSON_RE);
      if (lessonMatch && !currentModule) {
        currentModule = { moduleCode: '', moduleTitle: '', lessons: [] };
        seenLessonNumbers.clear();
      }

      if (!currentModule) continue;

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
        section = null;
        continue;
      }

      if (!currentLesson) continue;
      const L = currentLesson;

      // Tables FIRST — route by header to activities or the independent block.
      // (Handled before the text checks because the independent table's text
      // starts with "Independent Study Hours…", which the sub-header check
      // below would otherwise swallow.)
      if (tag === 'table') {
        const rows = $(children[idx]).find('tr').toArray();
        const header = $(rows[0])
          .find('td,th')
          .toArray()
          .map((c) => $(c).text().replace(/\s+/g, ' ').trim().toLowerCase());
        const cellsFor = (r: any) =>
          $(r)
            .find('td,th')
            .toArray()
            .map((c) => $(c).text().replace(/\s+/g, ' ').trim());
        if (header.some((h) => h.includes('activity')) && header.some((h) => h.includes('type'))) {
          const col = {
            seq: header.findIndex((h) => h === '#' || h.includes('seq')),
            title: header.findIndex((h) => h.includes('activity')),
            type: header.findIndex((h) => h.includes('type')),
            dur: header.findIndex((h) => h.includes('duration')),
            desc: header.findIndex((h) => h.includes('description')),
          };
          const acts: ParsedActivity[] = [];
          rows.slice(1).forEach((r, i) => {
            const c = cellsFor(r);
            const title = col.title >= 0 ? c[col.title] : '';
            if (!title || title === '-') return;
            acts.push({
              sequenceOrder: col.seq >= 0 ? Number(c[col.seq]) || i + 1 : i + 1,
              title,
              type: (col.type >= 0 ? c[col.type] : '') || 'mini_lecture',
              duration: col.dur >= 0 ? Number((c[col.dur] || '').replace(/[^\d.]/g, '')) || 0 : 0,
              description: col.desc >= 0 ? c[col.desc] : '',
            });
          });
          if (acts.length) L.activities = acts;
        } else if (
          header.some((h) => h.includes('independent') || h.includes('source-material')) &&
          header.some((h) => h.includes('task') || h.includes('evidence'))
        ) {
          const dataRow = rows.length > 1 ? cellsFor(rows[1]) : [];
          const at = (pred: (h: string) => boolean) => {
            const i = header.findIndex(pred);
            return i >= 0 ? (dataRow[i] || '').trim() : '';
          };
          const hoursStr = at((h) => h.includes('hour'));
          L.independentActivity = {
            independentHours: hoursStr
              ? Number(hoursStr.replace(/[^\d.]/g, '')) || undefined
              : undefined,
            sourceMaterialMapping: at((h) => h.includes('source')),
            independentTask: at((h) => h.includes('task')),
            aiPlatformSupport: at(
              (h) => h.includes('ai') || h.includes('platform') || h.includes('validation')
            ),
            studentEvidence: at((h) => h.includes('evidence')),
          };
        }
        section = null;
        continue;
      }

      // Duration + Bloom (often one line: "Duration: 90 minutes | Bloom Level: understand").
      const durMatch = text.match(DURATION_RE);
      if (durMatch) L.duration = Number(durMatch[1]);
      const bloomMatch = text.match(
        /Bloom\s*Level:\s*(remember|understand|apply|analy[sz]e|evaluate|create)/i
      );
      if (bloomMatch) L.bloomLevel = bloomMatch[1].toLowerCase().replace('analyze', 'analyse');
      // MLO/PLO/KSC links — may be on their own line or glued to the Bloom line.
      const grabLinks = (label: RegExp) => {
        const m = text.match(label);
        return m
          ? m[1]
              .split(/[,;]+/)
              .map((s) => s.trim())
              .filter((s) => s && s !== '-')
          : undefined;
      };
      if (/MLOs?:/i.test(text)) L.linkedMLOs = grabLinks(/MLOs?:\s*([^|]+?)(?:\s*\||$)/i);
      if (/PLOs?:/i.test(text)) L.linkedPLOs = grabLinks(/PLOs?:\s*([^|]+?)(?:\s*\||$)/i);
      if (/KSCs?:/i.test(text)) L.linkedKSCs = grabLinks(/KSCs?:\s*([^|]+?)(?:\s*\||$)/i);
      if (durMatch || bloomMatch) {
        section = null;
        continue;
      }

      // Topic coverage — labelled single-value paragraphs.
      const tcExact = text.match(/^Exact Topic to Teach:\s*(.+)$/i);
      const tcSub = text.match(/^Specific Subtopics(?:\s*\/\s*Skill List)?:\s*(.+)$/i);
      const tcPrac = text.match(/^Practical(?:\s*\/\s*AI\s*\/\s*Case)?\s*Activity:\s*(.+)$/i);
      const tcEvid = text.match(/^Student Evidence:\s*(.+)$/i);
      if (tcExact || tcSub || tcPrac || tcEvid) {
        L.topicCoverage = L.topicCoverage || {};
        if (tcExact) L.topicCoverage.exactTopic = tcExact[1].trim();
        if (tcSub)
          L.topicCoverage.subtopics = tcSub[1]
            .split(/[;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (tcPrac) L.topicCoverage.practicalActivity = tcPrac[1].trim();
        if (tcEvid) L.topicCoverage.studentEvidence = tcEvid[1].trim();
        section = null;
        continue;
      }

      // Block sub-headers.
      if (/^Learning Objectives:/i.test(text)) {
        section = 'objectives';
        continue;
      }
      if (/^Required Materials:/i.test(text)) {
        section = 'materials';
        L.materials = L.materials || [];
        continue;
      }
      if (/^Adaptation Options:/i.test(text)) {
        section = 'adaptation';
        L.instructorNotes = L.instructorNotes || {};
        L.instructorNotes.adaptationOptions = L.instructorNotes.adaptationOptions || [];
        continue;
      }
      if (/^Instructor Notes:/i.test(text)) {
        section = 'notes';
        L.instructorNotes = L.instructorNotes || {};
        continue;
      }
      // Topic-Coverage / Activity-Sequence / Independent headers reset section;
      // their content is a table (handled below) or labelled lines (above).
      if (/^(Topic Coverage|Activity Sequence|Contact Activity Sequence|Independent)/i.test(text)) {
        section = null;
        continue;
      }

      // Bullet / paragraph content for the active free-text section.
      const pushLines = (target: string[]) => {
        if (tag === 'ul' || tag === 'ol') {
          $(children[idx])
            .find('li')
            .each((_, li) => {
              const t = $(li).text().replace(/\s+/g, ' ').trim();
              if (t) target.push(t.replace(/^[•‣◦-]\s*/, ''));
            });
        } else {
          target.push(text.replace(/^[•‣◦-]\s*/, '').trim());
        }
      };
      if (section === 'objectives') pushLines(L.objectives);
      else if (section === 'materials' && L.materials) pushLines(L.materials);
      else if (section === 'adaptation' && L.instructorNotes?.adaptationOptions)
        pushLines(L.instructorNotes.adaptationOptions);
      else if (section === 'notes' && L.instructorNotes) {
        L.instructorNotes.pedagogicalGuidance = [L.instructorNotes.pedagogicalGuidance, text]
          .filter(Boolean)
          .join('\n\n');
      }
    }
    finishModule();

    // Drop any module that ended up with no lessons (e.g. a stray heading).
    const withLessons = modules.filter((m) => m.lessons.length > 0);

    if (withLessons.length === 0) {
      // The structured export wasn't recognised — try the "narrative" format
      // (externally-authored / AI-drafted lesson plans) before giving up.
      const narrative = this.parseNarrative($, children);
      if (narrative.modules.length > 0) {
        const totalLessons = narrative.modules.reduce((s, m) => s + m.lessons.length, 0);
        loggingService.info('Step 10 DOCX parsed (narrative format)', {
          modules: narrative.modules.length,
          totalLessons,
        });
        return narrative;
      }

      // Diagnostic: tell the user what the document actually contained so a
      // re-formatted/edited file is easier to fix.
      const allText = children.map((_, i) => textOf(i)).join(' ');
      const lessonLineCount = (allText.match(/Lesson\s+\d+\s*:/gi) || []).length;
      const hasTotals = MODULE_TOTALS_RE.test(allText);
      const codeHeadings = children
        .map((_, i) => textOf(i))
        .filter((t) => MODULE_CODE_HEADING_RE.test(t)).length;
      let detail =
        'No lesson plans were recognised in that document. Make sure you uploaded a Step 10 (Lesson Plans) Word export';
      if (lessonLineCount > 0) {
        detail += ` — the file has ${lessonLineCount} "Lesson N:" line(s) but they were not grouped under a recognisable module heading. Keep a module heading line like "MOD101: <title>" and a "Total Contact Hours: … | Total Lessons: …" line above the lessons`;
      } else if (codeHeadings > 0 || hasTotals) {
        detail +=
          ' — a module heading was found but no lessons. Each lesson must start with a "Lesson N: <title>" heading';
      } else {
        detail += ' (the document had no "Lesson N:" headings at all)';
      }
      detail += '.';
      warnings.push(detail);
    }

    loggingService.info('Step 10 DOCX parsed', {
      modules: withLessons.length,
      totalLessons: withLessons.reduce((s, m) => s + m.lessons.length, 0),
      warnings: warnings.length,
    });

    return { modules: withLessons, warnings };
  }

  /**
   * Fallback parser for the "narrative" lesson-plan format (an externally
   * authored / AI-drafted document) that our structured parser doesn't
   * recognise: modules introduced with "Starting MOD101: <title>.", lessons
   * with "Here's Lesson N, mapped to …", and a "Lesson Title: <title>
   * Duration: N minutes … Learning Objectives:" line followed by a bullet list.
   * Extracts the editable fields (title, duration, objectives, linked MLO,
   * pedagogical guidance) so the apply step can match and update lessons.
   */
  private parseNarrative($: cheerio.CheerioAPI, children: any[]): ParsedStep10 {
    const modules: ParsedStep10Module[] = [];
    let mod: ParsedStep10Module | null = null;
    let lesson: ParsedLesson | null = null;
    const txt = (c: any): string => $(c).text().replace(/\s+/g, ' ').trim();
    const tagOf = (c: any): string => (c as any)?.tagName?.toLowerCase?.() || '';

    const finishLesson = () => {
      if (mod && lesson && lesson.lessonTitle) mod.lessons.push(lesson);
      lesson = null;
    };
    const finishModule = () => {
      finishLesson();
      if (mod) modules.push(mod);
      mod = null;
    };

    for (const c of children) {
      const t = txt(c);
      if (!t) continue;

      const modM = t.match(NARRATIVE_MODULE_RE);
      if (modM) {
        finishModule();
        mod = {
          moduleCode: modM[1].replace(/\s+/g, '').trim(),
          moduleTitle: modM[2].trim().replace(/\.\s*$/, ''),
          lessons: [],
        };
        continue;
      }

      const lesM = t.match(NARRATIVE_LESSON_RE);
      if (lesM) {
        finishLesson();
        if (!mod) mod = { moduleCode: '', moduleTitle: '', lessons: [] };
        const mlo = (t.match(NARRATIVE_MLO_RE) || [])[1];
        lesson = {
          lessonNumber: Number(lesM[1]),
          lessonTitle: '',
          duration: null,
          objectives: [],
          linkedMLOs: mlo ? [mlo] : undefined,
        };
        continue;
      }

      if (!lesson) continue;

      if (!lesson.lessonTitle) {
        const titleM = t.match(NARRATIVE_TITLE_RE);
        if (titleM) {
          lesson.lessonTitle = titleM[1].trim();
          const durM = t.match(NARRATIVE_DURATION_RE);
          if (durM) lesson.duration = Number(durM[1]);
          continue;
        }
      }

      // First bullet list after the title = learning objectives.
      if (tagOf(c) === 'ul' && lesson.lessonTitle && lesson.objectives.length === 0) {
        lesson.objectives = $(c)
          .find('li')
          .toArray()
          .map((li: any) => $(li).text().replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        continue;
      }

      const pgM = t.match(/^Pedagogical Guidance:\s*(.+)$/i);
      if (pgM) {
        lesson.instructorNotes = {
          ...(lesson.instructorNotes || {}),
          pedagogicalGuidance: pgM[1].trim(),
        };
        continue;
      }
    }
    finishModule();
    return { modules: modules.filter((m) => m.lessons.length > 0), warnings: [] };
  }
}

export const step10ImportService = new Step10ImportService();
