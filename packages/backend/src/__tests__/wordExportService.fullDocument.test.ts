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

import { headingBookmark, wordExportService } from '../services/wordExportService';
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

describe('whole-programme Word document, headings', () => {
  it('marks section headings as Word headings, so the document has an outline', async () => {
    const zip = await JSZip.loadAsync(await wordExportService.generateDocument(programme(1)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/>/);
    expect(xml).toMatch(/<w:pStyle w:val="Heading2"\/>/);
  });
});

describe('whole-programme Word document, unresolved issues', () => {
  it('opens with the list of unresolved issues', async () => {
    const text = await documentText(await wordExportService.generateDocument(programme(1)));
    expect(text).toContain('Unresolved Issues');
    // Steps 2, 3, 5-9 and 11-13 are absent from this test programme.
    expect(text).toContain('This step has not been generated');
    expect(text.indexOf('Unresolved Issues')).toBeLessThan(text.indexOf('Program Foundation'));
  });
});

describe('whole-programme Word document, contents page', () => {
  it('links every contents entry to a section heading that exists', async () => {
    const zip = await JSZip.loadAsync(await wordExportService.generateDocument(programme(1)));
    const xml = await zip.file('word/document.xml')!.async('string');
    const anchors = [...xml.matchAll(/<w:hyperlink [^>]*w:anchor="([^"]+)"/g)].map((m) => m[1]);
    const bookmarks = new Set(
      [...xml.matchAll(/<w:bookmarkStart [^>]*w:name="([^"]+)"/g)].map((m) => m[1])
    );
    // Unresolved Issues, Step 1, Step 4 and Step 10 are in this test programme.
    expect(anchors).toHaveLength(4);
    for (const anchor of anchors) expect(bookmarks.has(anchor)).toBe(true);
  });

  it('comes before the unresolved issues, and lists only the sections the document has', async () => {
    const text = await documentText(await wordExportService.generateDocument(programme(1)));
    const start = text.indexOf('Contents');
    const end = text.indexOf('This list is produced automatically');
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(end);
    const contents = text.slice(start, end);
    expect(contents).toContain('10. Lesson Plans &amp; PPT Generation');
    expect(contents).not.toContain('8. Case Studies');
  });
});

describe('headingBookmark', () => {
  it('makes a valid Word bookmark name', () => {
    const name = headingBookmark('4. Course Structure & Module Learning Outcomes');
    expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_]{0,39}$/);
    expect(headingBookmark('Unresolved Issues')).toBe('h_unresolved_issues');
  });
});
