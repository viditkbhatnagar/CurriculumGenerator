/**
 * The Word export asks a model to reflow long text into paragraphs or a list. Three things
 * went wrong with that, found on 2026-09-30:
 * - Short text went to the model too. The BBA's whole-programme document made 751 calls one
 *   after another (382 for glossary definitions under 300 characters) and took over 15
 *   minutes to download.
 * - Seven sections rendered only the paragraphs, so text the model returned as a list was
 *   left out of the document.
 * - The model's answer went into the document uncleaned, after the export had already removed
 *   the characters XML forbids, so one stray control character made the file invalid.
 */
/* eslint-disable no-control-regex -- the tests look for the characters XML forbids */
import JSZip from 'jszip';

const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  })),
}));

import { wordExportService } from '../services/wordExportService';

const answer = (json: string) => ({ choices: [{ message: { content: json } }] });
const LONG = 'The warehouse team recorded every inbound pallet by hand. '.repeat(12);

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}
const textOf = (xml: string) => xml.replace(/<[^>]+>/g, '');

const base = {
  projectName: 'Test Programme',
  step1: { programTitle: 'Test Programme' },
  step4: { modules: [{ id: 'mod-a', code: 'MA', title: 'Alpha' }] },
};

beforeEach(() => mockCreate.mockReset());

describe('model reformatting in the Word export', () => {
  it('uses short text as written, without a model call', async () => {
    const workflow = {
      ...base,
      step9: { terms: [{ term: 'Lead time', definition: 'The time from order to delivery.' }] },
    };
    const text = textOf(
      await documentXml(await wordExportService.generateStepDocument(workflow, 9))
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(text).toContain('The time from order to delivery.');
  });

  it('keeps text the model returned as a list in a section that renders paragraphs', async () => {
    mockCreate.mockResolvedValue(
      answer(
        JSON.stringify({
          paragraphs: [],
          bullets: ['Pallets were counted by hand', 'Errors reached 4%'],
        })
      )
    );
    const workflow = {
      ...base,
      step8: {
        caseStudies: [{ id: 'cs1', title: 'Inbound errors', moduleId: 'mod-a', scenario: LONG }],
      },
    };
    const text = textOf(
      await documentXml(await wordExportService.generateStepDocument(workflow, 8))
    );
    expect(mockCreate).toHaveBeenCalled();
    expect(text).toContain('Pallets were counted by hand');
    expect(text).toContain('Errors reached 4%');
  });

  it('cleans an escaped control character out of the model answer', async () => {
    // Valid JSON: parsing turns "\\u0014" into a raw U+0014, which XML forbids.
    mockCreate.mockResolvedValue(answer('{"paragraphs": ["Margin \\u0014 cost"], "bullets": []}'));
    const workflow = {
      ...base,
      step8: {
        caseStudies: [{ id: 'cs1', title: 'Margins', moduleId: 'mod-a', scenario: LONG }],
      },
    };
    const xml = await documentXml(await wordExportService.generateStepDocument(workflow, 8));
    // These are the characters that made the M42 guide "not well-formed" to every XML parser.
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(textOf(xml)).toContain('Margin  cost');
  });

  it('keeps the model answer when it holds a raw control character', async () => {
    // A raw U+001F inside a JSON string is invalid JSON, so the answer used to be thrown away.
    mockCreate.mockResolvedValue(answer('{"paragraphs": ["Units\u001f sold"], "bullets": []}'));
    const workflow = {
      ...base,
      step8: {
        caseStudies: [{ id: 'cs1', title: 'Units', moduleId: 'mod-a', scenario: LONG }],
      },
    };
    const xml = await documentXml(await wordExportService.generateStepDocument(workflow, 8));
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(textOf(xml)).toContain('Units sold');
  });
});
