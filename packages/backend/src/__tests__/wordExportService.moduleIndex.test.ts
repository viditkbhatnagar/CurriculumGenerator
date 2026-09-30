/**
 * A per-module Word export builds exactly the module it names, and refuses an index that names
 * none. It used to fall back to the whole step, which for the BBA's Step 10 is a document of
 * every lesson that needs about 1.9GB to build.
 */
import JSZip from 'jszip';

// Mock OpenAI before importing the service (as wordExportService.property.test.ts does).
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ paragraphs: [], bullets: [] }) } }],
        }),
      },
    },
  })),
}));

import { wordExportService } from '../services/wordExportService';

const workflow = {
  projectName: 'Test Programme',
  step1: { programTitle: 'Test Programme' },
  step10: {
    moduleLessonPlans: [
      { moduleId: 'mod-m01', moduleCode: 'M01', moduleTitle: 'Alpha Foundations', lessons: [] },
      {
        moduleId: 'mod-m42',
        moduleCode: 'M42',
        moduleTitle: 'Strategic Decision Making',
        lessons: [],
      },
    ],
  },
  step12: { summary: 'no per-module array here' },
};

async function documentText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ');
}

describe('wordExportService.generateStepDocument with a module index', () => {
  it('builds only the module the index names', async () => {
    const buffer = await wordExportService.generateStepDocument(workflow, 10, { moduleIndex: 1 });
    const text = await documentText(buffer);
    expect(text).toContain('Strategic Decision Making');
    expect(text).not.toContain('Alpha Foundations');
  });

  it.each([2, 99, -1, NaN, 0.5])(
    'refuses index %p instead of building the whole step',
    async (i) => {
      await expect(
        wordExportService.generateStepDocument(workflow, 10, { moduleIndex: i })
      ).rejects.toThrow(RangeError);
    }
  );

  it('refuses a module index for a step that has no per-module array', async () => {
    await expect(
      wordExportService.generateStepDocument(workflow, 12, { moduleIndex: 0 })
    ).rejects.toThrow(RangeError);
  });
});
