/**
 * Checking a feedback entry before it is stored (models/StepFeedback). Kept free of the database
 * so it can be tested on its own.
 */
import type { Satisfaction } from '../models/StepFeedback';

export const MAX_FEEDBACK_CHARS = 4000;
const MAX_NAME_CHARS = 80;
const LAST_STEP = 14;
const SATISFACTION: Satisfaction[] = ['yes', 'partly', 'no'];

export interface FeedbackInput {
  stepNumber: number;
  reviewerName: string;
  satisfactory: Satisfaction;
  whatChanged: string;
  comments: string;
}

const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';

/** The entry, or the reason it cannot be stored. */
export function parseFeedback(body: any): { value?: FeedbackInput; error?: string } {
  const stepNumber = Number(body?.stepNumber);
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > LAST_STEP) {
    return { error: `stepNumber must be a whole number from 1 to ${LAST_STEP}` };
  }
  const reviewerName = text(body?.reviewerName, MAX_NAME_CHARS);
  if (reviewerName.length < 2) return { error: 'Give your name' };
  const satisfactory = body?.satisfactory;
  if (!SATISFACTION.includes(satisfactory)) {
    return { error: 'Say whether the output is satisfactory: yes, partly or no' };
  }
  const whatChanged = text(body?.whatChanged, MAX_FEEDBACK_CHARS);
  const comments = text(body?.comments, MAX_FEEDBACK_CHARS);
  if (!whatChanged && !comments) {
    return { error: 'Describe what changed, or add a comment' };
  }
  return { value: { stepNumber, reviewerName, satisfactory, whatChanged, comments } };
}

/** One CSV field: quoted, quotes doubled, formula prefixes neutralised for spreadsheets. */
export function csvField(v: unknown): string {
  const s = String(v ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
