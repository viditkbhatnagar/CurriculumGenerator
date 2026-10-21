/**
 * Reviewers' feedback on each step of a programme (backend: routes/stepFeedbackRoutes).
 */
import { fetchAPI } from './api';
import { downloadFile } from './download';

const BASE = '/api/v3/feedback';

export type Satisfaction = 'yes' | 'partly' | 'no';

export interface FeedbackEntry {
  id: string;
  workflowId: string;
  programme: string;
  stepNumber: number;
  reviewerName: string;
  satisfactory: Satisfaction;
  whatChanged: string;
  comments: string;
  createdAt: string;
}

export interface NewFeedback {
  workflowId: string;
  stepNumber: number;
  reviewerName: string;
  satisfactory: Satisfaction;
  whatChanged: string;
  comments: string;
}

const query = (filter: { workflowId?: string; step?: number }) => {
  const params = new URLSearchParams();
  if (filter.workflowId) params.set('workflowId', filter.workflowId);
  if (filter.step) params.set('step', String(filter.step));
  const s = params.toString();
  return s ? `?${s}` : '';
};

export const listFeedback = (filter: { workflowId?: string; step?: number } = {}) =>
  fetchAPI(`${BASE}${query(filter)}`).then((res: { data: FeedbackEntry[] }) => res.data);

export const sendFeedback = (entry: NewFeedback) =>
  fetchAPI(BASE, { method: 'POST', body: JSON.stringify(entry) });

export const downloadFeedbackCsv = (filter: { workflowId?: string; step?: number } = {}) =>
  downloadFile(`${BASE}/export.csv${query(filter)}`, 'step-feedback.csv');

export const VERDICTS: { value: Satisfaction; label: string; tone: string }[] = [
  { value: 'yes', label: 'Yes', tone: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'partly', label: 'Partly', tone: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'no', label: 'No', tone: 'bg-rose-100 text-rose-800 border-rose-300' },
];
