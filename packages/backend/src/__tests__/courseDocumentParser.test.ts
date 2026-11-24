/**
 * The course-document import (Athira Hari, India Learns, 19 November 2026): a course drafted
 * in ChatGPT is read by rule where it is structured, and by a stubbed model where it is not.
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../services/openaiService', () => ({
  openaiService: { generateContent: jest.fn() },
}));

import { blocksFromMarkdown, blocksFromHtml } from '../services/courseDocumentBlocks';
import { parseCourseBlocks, parseTitleLine, splitLabelled } from '../services/courseDocumentParser';
import { toStep1Prefill, toBlueprint, academicLevelFrom } from '../services/courseDocumentMapping';
import { normaliseModelCourse } from '../services/courseDocumentModel';
import { importCourseDocument } from '../services/courseDocumentImport';
import { openaiService } from '../services/openaiService';

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/chatgptCourseOutline.md'), 'utf8');
const parse = (md: string) => parseCourseBlocks(blocksFromMarkdown(md));

describe('heading-structured course (ChatGPT style)', () => {
  const course = parse(fixture);

  it('reads the programme fields the document states', () => {
    const p = course.programme;
    expect(p.title).toBe('Professional Certificate in Digital Marketing');
    expect(p.levelText).toBe('Level 5 Diploma');
    expect(p.credits).toBe(60);
    expect(p.totalHours).toBe(600);
    expect(p.description).toMatch(/working professionals/);
    expect(p.purpose).toMatch(/integrated digital campaigns/);
    expect(p.targetLearners).toMatch(/Early-career marketers/);
    expect(p.jobRoles.map((r) => r.title)).toEqual([
      'Digital Marketing Executive',
      'Social Media Manager',
    ]);
  });

  it('finds all six modules in order with their figures, topics and outcomes', () => {
    expect(course.modules.map((m) => m.title)).toEqual([
      'Foundations of Digital Marketing',
      'Search Engine Optimisation',
      'Paid Advertising',
      'Social Media Strategy',
      'Email and Automation',
      'Analytics and Reporting',
    ]);
    expect(course.modules[0]).toMatchObject({ credits: 10, totalHours: 100, code: 'M01' });
    expect(course.modules[0].topics).toHaveLength(3);
    expect(course.modules[0].outcomes).toEqual([
      'Explain the main digital marketing channels',
      'Map a customer journey for a product',
    ]);
    expect(course.modules[1].totalHours).toBe(100);
    expect(course.modules[5].outcomes).toEqual(['Build a performance dashboard']);
  });

  it('flags what is missing instead of inventing it', () => {
    const flags = course.flags.join(' ');
    expect(flags).toMatch(/no descriptions/i);
    expect(flags).toMatch(/modules list no outcomes/);
    expect(flags).not.toMatch(/No programme description/);
  });
});

describe('table-structured course', () => {
  const md = `# Diploma in Data Analysis

## Modules

| No. | Module | Credits | Contact Hours | Independent Hours | Topics |
| --- | --- | --- | --- | --- | --- |
| 1 | Spreadsheet Skills | 10 | 30 | 70 | formulas; pivot tables |
| 2 | SQL Basics | 15 | 45 | 105 | selects, joins; grouping |
| | Total | 25 | 75 | 175 | |
`;
  const course = parse(md);

  it('reads rows, skipping the total row', () => {
    expect(course.modules).toHaveLength(2);
    expect(course.modules[0]).toMatchObject({
      title: 'Spreadsheet Skills',
      credits: 10,
      contactHours: 30,
      independentHours: 70,
    });
    expect(course.modules[0].topics).toEqual(['formulas', 'pivot tables']);
    expect(course.modules[1].topics).toEqual(['selects, joins', 'grouping']);
  });

  it('skips a total row whose title cell is a count ("6 modules"), wherever "Total" sits', () => {
    // Athira's Fashion Illustration course (21 November 2026) became seven modules, the last
    // titled "6 modules" with 96 hours: the word "Total" was in the code column.
    const md = `# Fashion Illustration
| Code | Module | Independent Hours |
|---|---|---|
| M01 | Drawing Fundamentals | 16 |
| M02 | Garment Rendering | 16 |
| Total | 2 modules | 32 |
`;
    expect(parse(md).modules.map((m) => m.title)).toEqual([
      'Drawing Fundamentals',
      'Garment Rendering',
    ]);
  });

  it('reads an HTML table the same way', () => {
    const html = `<h1>Course</h1><table><tr><th>Module</th><th>ECTS</th></tr><tr><td>Ethics</td><td>5</td></tr></table>`;
    const c = parseCourseBlocks(blocksFromHtml(html));
    expect(c.modules).toEqual([expect.objectContaining({ title: 'Ethics', credits: 5 })]);
  });
});

describe('list-structured course', () => {
  const md = `# Short Course in Leadership

## Modules
1. Leading Self (5 credits)
   - Self awareness
   - Time management
2. Leading Teams - 10 credits
   - Delegation
`;
  const course = parse(md);
  it('reads numbered items as modules and nested items as topics', () => {
    expect(course.modules.map((m) => [m.title, m.credits])).toEqual([
      ['Leading Self', 5],
      ['Leading Teams', 10],
    ]);
    expect(course.modules[0].topics).toEqual(['Self awareness', 'Time management']);
  });
});

describe('parseTitleLine', () => {
  it('strips the prefix and pulls out figures', () => {
    expect(parseTitleLine('Module 3: Pricing (15 credits, 40 hours)')).toEqual({
      title: 'Pricing',
      credits: 15,
      hours: 40,
    });
  });
});

describe('mapping', () => {
  const course = parse(fixture);

  it('fills Step 1 only with stated fields', () => {
    const prefill = toStep1Prefill(course);
    expect(prefill).toMatchObject({
      programTitle: 'Professional Certificate in Digital Marketing',
      academicLevel: 'diploma',
      programmeLevel: 5,
      programmeLevelOrigin: 'stated',
      credits: 60,
      totalHours: 600,
    });
    expect(prefill.jobRoles).toHaveLength(2);
    expect(
      toStep1Prefill(parse('# Untitled Course\n\n## Modules\n1. A module'))
    ).not.toHaveProperty('credits');
  });

  it('maps degree credentials to their own options and leaves a doctorate unset', () => {
    expect(academicLevelFrom('Master of Business')).toBe('master');
    expect(academicLevelFrom('MBA in AI Strategy')).toBe('master');
    expect(academicLevelFrom('Executive Diploma in Leadership')).toBe('postgraduate-diploma');
    expect(academicLevelFrom('Bachelor in Business Administration')).toBe('bachelor');
    expect(academicLevelFrom('Diploma in Logistics')).toBe('diploma');
    expect(academicLevelFrom('Doctorate of Business')).toBeNull();
    expect(academicLevelFrom('Micro-credential')).toBe('micro-credential');
  });

  it('builds a blueprint in the moduleBlueprintService shape, with the outline kept', () => {
    const bp = toBlueprint(course.modules);
    expect(bp).toHaveLength(6);
    expect(bp[1]).toMatchObject({
      sequenceOrder: 2,
      code: 'M02',
      title: 'Search Engine Optimisation',
      credits: 10,
      totalHours: 100,
      contactHours: null,
      independentHours: null,
      group: '',
      isElective: false,
    });
    expect(bp[1].sourceTopics).toContain('Keyword research');
  });
});

describe('model fallback', () => {
  const generate = openaiService.generateContent as jest.Mock;
  beforeEach(() => generate.mockReset());

  it('uses the model only when the rules find no modules, and flags it', async () => {
    generate.mockResolvedValue(
      JSON.stringify({
        title: 'Intro to Baking',
        credits: 20,
        jobRoles: [{ title: 'Baker', description: '' }],
        modules: [
          { title: 'Bread', credits: 10, topics: ['dough'] },
          { title: 'Pastry', credits: 10 },
        ],
      })
    );
    const result = await importCourseDocument({
      text: 'This course teaches bread and pastry baking in prose only.',
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.course.method).toBe('model');
    expect(result.course.flags[0]).toMatch(/read by the model/);
    expect(result.blueprint.map((m) => m.title)).toEqual(['Bread', 'Pastry']);
    expect(result.step1Prefill.programTitle).toBe('Intro to Baking');
  });

  it('does not call the model for a structured document', async () => {
    const result = await importCourseDocument({ text: fixture });
    expect(generate).not.toHaveBeenCalled();
    expect(result.course.method).toBe('deterministic');
  });

  it('drops wrong-typed model output rather than passing it on', () => {
    const c = normaliseModelCourse({
      title: 5,
      credits: 'ten',
      modules: [{ title: 'Ok', credits: -3, topics: 'x' }, 'bad'],
    });
    expect(c.programme.title).toBe('');
    expect(c.programme.credits).toBeNull();
    expect(c.modules).toEqual([
      expect.objectContaining({ title: 'Ok', credits: null, topics: [] }),
    ]);
  });

  it('rejects unreadable model replies', async () => {
    generate.mockResolvedValue('not json');
    await expect(importCourseDocument({ text: 'prose only' })).rejects.toThrow(/did not return/);
  });
});

describe('splitLabelled (several fields in one Word paragraph)', () => {
  it('cuts "Level: … Credits: … Duration: …" into its fields', () => {
    expect(splitLabelled('Level: Level 5 Diploma Credits: 60 Duration: 600 hours')).toEqual([
      'Level: Level 5 Diploma',
      'Credits: 60',
      'Duration: 600 hours',
    ]);
    expect(splitLabelled('Purpose: to prepare learners for roles in X')).toEqual([
      'Purpose: to prepare learners for roles in X',
    ]);
  });
});
