/**
 * Matching a programme's job roles to national occupation codes (India, US, UK, Singapore), as
 * Rejin asked on 16 October 2026, and giving the Step 2 and Step 4 writers their official tasks.
 */
import {
  IndexEntry,
  occupationEvidenceIssues,
  occupationText,
  roleText,
  shorten,
  topMatches,
} from '../services/occupations/occupationIndex';
import { unresolvedIssues } from '../services/unresolvedIssues';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { Occupation } from '../models/Occupation';
import { openaiService } from '../services/openaiService';
import { bundledOccupations, occupationPromptBlock } from '../services/occupations/occupationStore';

const entry = (
  country: any,
  system: any,
  code: string,
  title: string,
  v: number[]
): IndexEntry => ({
  country,
  system,
  code,
  title,
  vector: Float32Array.from(shorten(v, v.length)),
});

describe('occupation index', () => {
  it('shortens a vector and scales it back to length 1', () => {
    const v = shorten([3, 4, 12], 2);
    expect(v).toEqual([0.6, 0.8]);
  });

  it('embeds an occupation from its title, description, first tasks and other names', () => {
    const text = occupationText({
      system: 'SSOC 2024',
      country: 'SG',
      code: '25121',
      title: 'Software developer',
      description: 'Designs software.',
      tasks: ['researching requirements'],
      alternateTitles: ['Full stack developer'],
    });
    expect(text).toBe(
      'Software developer. Designs software. researching requirements Also called: Full stack developer.'
    );
    expect(roleText({ title: 'Business Analyst', tasks: ['Gather data.'] })).toBe(
      'Business Analyst. Gather data.'
    );
  });

  it('keeps the closest occupations per country, above the floor', () => {
    const entries = [
      entry('US', 'O*NET-SOC 2019', '13-1111.00', 'Management Analysts', [1, 0.1]),
      entry('US', 'O*NET-SOC 2019', '29-1141.00', 'Registered Nurses', [0, 1]),
      entry('UK', 'UK SOC 2020', '2431/01', 'Management consultants', [1, 0.3]),
      entry('IN', 'NCO 2015', '2421.0100', 'Management Analyst', [0.9, 0.2]),
    ];
    const matches = topMatches(shorten([1, 0.15], 2), entries, { floor: 0.5, perCountry: 3 });
    expect(matches.map((m) => [m.country, m.code])).toEqual([
      ['IN', '2421.0100'],
      ['US', '13-1111.00'],
      ['UK', '2431/01'],
    ]);
  });
});

describe('occupation evidence issues', () => {
  it('says the roles were not matched when they never were', () => {
    expect(occupationEvidenceIssues(undefined, true)).toEqual([
      expect.objectContaining({ kind: 'not_checked' }),
    ]);
    expect(occupationEvidenceIssues(undefined, false)).toEqual([]);
  });

  it('names roles with no match, and countries no role matched', () => {
    const m = (country: any) => ({
      country,
      system: 'x' as any,
      code: '1',
      title: 't',
      similarity: 0.6,
    });
    const issues = occupationEvidenceIssues(
      {
        matchedAt: '2026-10-17',
        floor: 0.4,
        roles: [
          { role: 'Business Analyst', matches: [m('US'), m('UK'), m('IN')] },
          { role: 'Chief Vibes Officer', matches: [] },
        ],
      },
      true
    );
    expect(issues.map((i) => i.issue)).toEqual([
      'No national occupation matches these job roles, so their skills rest on the AI model alone: Chief Vibes Officer',
      'No job role matches an occupation in Singapore',
    ]);
  });

  it('lists the gap among Step 1 unresolved issues', () => {
    const issues = unresolvedIssues(
      { step1: { programTitle: 'BBA', jobRoles: [{ title: 'Business Analyst' }] } },
      2026
    ).filter((i) => /occupation/.test(i.issue));
    expect(issues).toEqual([expect.objectContaining({ step: 1, kind: 'not_checked' })]);
  });
});

describe('bundled occupation data', () => {
  it('holds every occupation of the four classifications', () => {
    const records = bundledOccupations();
    const count = (c: string) => records.filter((r: any) => r.country === c).length;
    expect([count('IN'), count('US'), count('UK'), count('SG')]).toEqual([3452, 1016, 1384, 1001]);
    const keys = new Set(records.map((r: any) => `${r.system}|${r.code}`));
    expect(keys.size).toBe(records.length);
  });
});

describe('occupational standards for the writers', () => {
  afterEach(() => jest.restoreAllMocks());

  it("matches afresh when the job roles changed, and gives the matches' official tasks", async () => {
    const lean = (value: unknown) => ({ lean: async () => value });
    jest.spyOn(CurriculumWorkflow, 'findById').mockImplementation((() =>
      lean({
        _id: '6a619d817a037be307a8fa7c',
        step1: { jobRoles: [{ title: 'Business Analyst', tasks: ['Gather data.'] }] },
        occupationEvidence: { roles: [{ role: 'Management Trainee', matches: [] }] },
      })) as never);
    jest.spyOn(CurriculumWorkflow.collection, 'updateOne').mockResolvedValue({} as never);
    const stored = {
      system: 'O*NET-SOC 2019',
      country: 'US',
      code: '13-1111.00',
      title: 'Management Analysts',
      description: 'Conduct organizational studies.',
      tasks: ['Gather and organize information on problems.'],
      embedding: shorten([1, 0], 2),
    };
    jest.spyOn(Occupation, 'find').mockImplementation((() => lean([stored])) as never);
    const embed = jest
      .spyOn(openaiService, 'generateEmbeddingsBatch')
      .mockResolvedValue([[1, 0.05]] as never);

    const block = await occupationPromptBlock('6a619d817a037be307a8fa7c');
    expect(embed).toHaveBeenCalledTimes(1);
    expect(block).toContain('Job role: Business Analyst');
    expect(block).toContain('O*NET-SOC 2019 13-1111.00 Management Analysts');
    expect(block).toContain('Tasks: Gather and organize information on problems.');
  });
});
