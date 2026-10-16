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

describe('laying out text in the Word export', () => {
  // Rejin's audit, 16 October 2026: approved text must be printed as approved, so no model
  // reformats it on the way into the document.
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

  it('prints a long passage word for word, without a model call', async () => {
    const scenario = LONG + 'The warehouse team recorded every inbound pallet by hand.';
    const workflow = {
      ...base,
      step8: { caseStudies: [{ id: 'cs1', title: 'Inbound', moduleId: 'mod-a', scenario }] },
    };
    const text = textOf(
      await documentXml(await wordExportService.generateStepDocument(workflow, 8))
    );
    expect(mockCreate).not.toHaveBeenCalled();
    const said = text.match(/The warehouse team recorded every inbound pallet by hand\./g) || [];
    // Every repetition survives: the model used to be told to remove duplicate sentences.
    expect(said.length).toBeGreaterThanOrEqual(13);
  });

  it('keeps text written as a list in a section that renders paragraphs', async () => {
    const scenario = `${LONG}\nFindings:\n- Pallets were counted by hand\n- Errors reached 4%`;
    const workflow = {
      ...base,
      step8: { caseStudies: [{ id: 'cs1', title: 'Inbound errors', moduleId: 'mod-a', scenario }] },
    };
    const text = textOf(
      await documentXml(await wordExportService.generateStepDocument(workflow, 8))
    );
    expect(text).toContain('Pallets were counted by hand');
    expect(text).toContain('Errors reached 4%');
  });

  it('keeps characters XML forbids out of the document', async () => {
    const workflow = {
      ...base,
      step8: {
        caseStudies: [
          {
            id: 'cs1',
            title: 'Margins',
            moduleId: 'mod-a',
            scenario: `${LONG} Margin \u0014 cost.`,
          },
        ],
      },
    };
    const xml = await documentXml(await wordExportService.generateStepDocument(workflow, 8));
    // These are the characters that made the M42 guide "not well-formed" to every XML parser.
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(textOf(xml)).toContain('Margin');
  });
});
