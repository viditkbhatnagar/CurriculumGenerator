/**
 * Reads an uploaded or pasted course document into an extracted course for review.
 *
 * Athira Hari at India Learns asked on 19 November 2026 to develop courses already drafted in
 * ChatGPT here. Word, PDF, markdown and plain text are accepted; structured documents are
 * parsed by rule, and the model is used only when no modules could be found that way.
 */
import * as mammoth from 'mammoth';
import {
  blocksFromHtml,
  blocksFromMarkdown,
  blocksFromPdfText,
  blocksToText,
  type CourseBlock,
} from './courseDocumentBlocks';
import { parseCourseBlocks, type ExtractedCourse } from './courseDocumentParser';
import { extractWithModel } from './courseDocumentModel';
import {
  toBlueprint,
  toStep1Prefill,
  type BlueprintModuleWithOutline,
  type Step1Prefill,
} from './courseDocumentMapping';

export const COURSE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 400000;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');

export interface CourseImportResult {
  course: ExtractedCourse;
  step1Prefill: Step1Prefill;
  blueprint: BlueprintModuleWithOutline[];
  filename: string;
}

export async function blocksFromFile(buffer: Buffer, filename: string): Promise<CourseBlock[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) {
    const html = (await mammoth.convertToHtml({ buffer })).value;
    return blocksFromHtml(html);
  }
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    return blocksFromPdfText(String(parsed.text || ''));
  }
  if (/\.(md|markdown|txt|text)$/.test(lower)) return blocksFromMarkdown(buffer.toString('utf8'));
  throw new Error('Upload a Word (.docx), PDF, markdown or text file, or paste the text.');
}

export async function importCourseDocument(input: {
  buffer?: Buffer;
  filename?: string;
  text?: string;
  workflowId?: string;
}): Promise<CourseImportResult> {
  const filename = input.filename || 'pasted text';
  const blocks = input.buffer
    ? await blocksFromFile(input.buffer, filename)
    : blocksFromMarkdown(String(input.text || '').slice(0, MAX_TEXT_CHARS));
  if (!blocks.length) throw new Error('No readable text was found in that document.');

  let course = parseCourseBlocks(blocks);
  if (!course.modules.length) {
    const viaModel = await extractWithModel(blocksToText(blocks), input.workflowId);
    // Keep anything the rules did read about the programme if the model left it blank.
    const rules = course.programme;
    const p = viaModel.programme;
    course = {
      ...viaModel,
      programme: {
        ...p,
        title: p.title || rules.title,
        description: p.description || rules.description,
        purpose: p.purpose || rules.purpose,
        targetLearners: p.targetLearners || rules.targetLearners,
        jobRoles: p.jobRoles.length ? p.jobRoles : rules.jobRoles,
      },
    };
  }
  return {
    course,
    step1Prefill: toStep1Prefill(course),
    blueprint: toBlueprint(course.modules),
    filename,
  };
}
