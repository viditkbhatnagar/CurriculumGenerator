/**
 * The whole-programme Word document writes every lesson out only while it stays buildable.
 * The BBA's 1,380 lessons needed about 1.7GB for Step 10 alone and restarted the 2GB API
 * container; above the limit Step 10 lists each module's lessons instead.
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
import { FULL_DOCUMENT_LESSON_LIMIT } from '../services/step10Completion';

const lesson = (n: number) => ({
  lessonNumber: n,
  lessonTitle: `Topic number ${n}`,
  duration: 90,
  bloomLevel: 'apply',
  objectives: [`Explain the BODYMARKER concept for lesson ${n}`],
});

function programme(lessonCount: number) {
  return {
    projectName: 'Test Programme',
    step1: { programTitle: 'Test Programme' },
    step4: { modules: [{ id: 'mod-a', code: 'MA', title: 'Alpha', contactHours: 30 }] },
    step10: {
      moduleLessonPlans: [
        {
          moduleId: 'mod-a',
          moduleCode: 'MA',
          moduleTitle: 'Alpha',
          totalContactHours: 30,
          lessons: Array.from({ length: lessonCount }, (_, i) => lesson(i + 1)),
        },
      ],
    },
  };
}

async function documentText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, '');
}

describe('whole-programme Word document, Step 10', () => {
  it('writes every lesson out for a programme within the limit', async () => {
    const text = await documentText(await wordExportService.generateDocument(programme(2)));
    expect(text).toContain('Explain the BODYMARKER concept for lesson 2');
    expect(text).not.toContain('too many for the server to build into one document');
  });

  it('lists the lessons, and says where the plans are, above the limit', async () => {
    const count = FULL_DOCUMENT_LESSON_LIMIT + 1;
    const text = await documentText(await wordExportService.generateDocument(programme(count)));
    expect(text).toContain(`This programme has ${count} lessons`);
    expect(text).toContain('too many for the server to build into one document');
    expect(text).toContain(`Lesson ${count}: Topic number ${count} (90 minutes)`);
    expect(text).not.toContain('BODYMARKER');
    // The validation summary is still computed and printed.
    expect(text).toContain('10.1 Validation Summary');
  });
});
