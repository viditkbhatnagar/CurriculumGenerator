/**
 * Syllabus Generation Service (Step 14)
 *
 * Aggregates data from steps 1–13 of an approved curriculum workflow and
 * combines it with instructor-provided info (name/email/schedule) to produce
 * a complete course syllabus document. Most content is pulled verbatim from
 * earlier steps; the course description and policy paragraphs get a light
 * LLM polish so the tone reads as one document rather than stitched-together
 * fragments.
 */

import { CurriculumWorkflow, ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import type {
  Step14Syllabus,
  Step14SyllabusInputs,
  SyllabusWeekRow,
  SyllabusAssignmentItem,
  ModuleSyllabus,
} from '../models/CurriculumWorkflow';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';

// Default policy text — used when the user doesn't provide overrides.
// Phrased generically so it works for most academic settings; the user can
// edit before publishing.
const DEFAULT_POLICIES = {
  attendance:
    'Regular attendance is expected for all scheduled sessions. Students are responsible for any material covered during absences. More than three unexcused absences may affect the participation grade.',
  lateWork:
    'Assignments submitted after the posted deadline lose 10% per day for up to three days, after which they will not be accepted without prior written approval from the instructor. Extensions are granted only for documented medical or family emergencies.',
  technologyUse:
    'Laptops and tablets are welcome for note-taking and coursework. Phones should be silenced during class. Use of generative AI tools is permitted only when explicitly indicated for an activity or assignment; in all other cases, submitted work must be the student’s own.',
  communicationNorms:
    'Email is the primary channel for course communication. Please use your university email and include the course code in the subject line. The instructor aims to respond within 48 hours on weekdays.',
  academicIntegrity:
    'All submitted work must reflect the student’s own thinking. Quoting, paraphrasing, or otherwise drawing on outside sources requires citation. Suspected violations will be referred to the institution’s academic integrity office.',
  accessibility:
    'Students requiring accommodations should contact the disability services office and share the resulting accommodation letter with the instructor in the first two weeks of the term so adjustments can be made in advance.',
};

const DEFAULT_GRADING_SCALE = [
  { grade: 'A', range: '90–100%' },
  { grade: 'B', range: '80–89%' },
  { grade: 'C', range: '70–79%' },
  { grade: 'D', range: '60–69%' },
  { grade: 'F', range: 'Below 60%' },
];

class SyllabusService {
  /**
   * Save the user-provided inputs (instructor info, schedule, policies) to
   * step14.inputs without triggering generation.
   */
  async saveInputs(workflowId: string, inputs: Step14SyllabusInputs): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    if (!workflow.step14) {
      workflow.step14 = { inputs } as Step14Syllabus;
    } else {
      workflow.step14.inputs = inputs;
    }
    workflow.markModified('step14');
    await workflow.save();

    loggingService.info('Step 14 inputs saved', { workflowId, instructor: inputs.instructor.name });
    return workflow;
  }

  /**
   * Generate the full syllabus by aggregating data from steps 1–13 and
   * applying light LLM polish to the description / policy paragraphs.
   * Saves the result to step14.generatedSections.
   */
  async generateSyllabus(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (!workflow.step14?.inputs) {
      throw new Error('Step 14 inputs missing — save instructor and schedule details first');
    }

    const inputs = workflow.step14.inputs;
    const step1 = (workflow as any).step1 || {};
    const step3 = (workflow as any).step3 || {};
    const step4 = (workflow as any).step4 || {};
    const step6 = (workflow as any).step6 || {};
    const step12 = (workflow as any).step12 || {};
    const step13 = (workflow as any).step13 || {};

    loggingService.info('Generating syllabus', {
      workflowId,
      programTitle: step1.programTitle,
      moduleCount: step4.modules?.length || 0,
    });

    // ----- Course description (light LLM polish) -----
    const courseDescription = await this.polishCourseDescription(step1, inputs).catch((err) => {
      loggingService.warn('LLM polish failed, falling back to raw description', {
        error: err?.message,
      });
      return step1.programDescription || '';
    });

    // ----- Learning outcomes (verbatim from Step 3) -----
    const learningOutcomes: string[] = (step3.outcomes || [])
      .map((o: any) => o.statement || o.outcome || '')
      .filter(Boolean);

    // ----- Weekly schedule (auto-paired) -----
    const weeklySchedule = this.buildWeeklySchedule(inputs, step4, step6, step12, step13);

    // ----- Assignments (from Step 12 + Step 13 + user-defined exams) -----
    const assignments = this.buildAssignmentsList(step12, step13, inputs);

    // ----- Policies (user override OR defaults) -----
    const policies = {
      attendance: inputs.policies?.attendance?.trim() || DEFAULT_POLICIES.attendance,
      lateWork: inputs.policies?.lateWork?.trim() || DEFAULT_POLICIES.lateWork,
      technologyUse: inputs.policies?.technologyUse?.trim() || DEFAULT_POLICIES.technologyUse,
      communicationNorms:
        inputs.policies?.communicationNorms?.trim() || DEFAULT_POLICIES.communicationNorms,
      academicIntegrity:
        inputs.policies?.academicIntegrity?.trim() || DEFAULT_POLICIES.academicIntegrity,
      accessibility: inputs.policies?.accessibility?.trim() || DEFAULT_POLICIES.accessibility,
    };

    // ----- Per-module syllabi (Logan's primary ask) -----
    // Each module gets its own focused syllabus: its own MLOs, just its
    // own topics in the schedule, and just the assignments scoped to it.
    const moduleSyllabi = this.buildModuleSyllabi(inputs, step4, step6, step12);

    workflow.step14.generatedSections = {
      courseDescription,
      learningOutcomes,
      weeklySchedule,
      assignments,
      gradingScale: DEFAULT_GRADING_SCALE,
      policies,
      moduleSyllabi,
    };
    workflow.step14.generatedAt = new Date();
    workflow.markModified('step14');
    await workflow.save();

    loggingService.info('Syllabus generated', {
      workflowId,
      learningOutcomes: learningOutcomes.length,
      weeks: weeklySchedule.length,
      assignments: assignments.length,
    });

    return workflow;
  }

  /**
   * Single-call LLM polish for the course description so it reads as a
   * professor-authored paragraph rather than a generated programme blurb.
   * Kept short (<300 tokens) — failures fall back to the raw description.
   */
  private async polishCourseDescription(step1: any, inputs: Step14SyllabusInputs): Promise<string> {
    const raw =
      step1.programDescription ||
      step1.executiveSummary ||
      step1.programPurpose ||
      'Course description not yet provided.';

    const systemPrompt =
      'You are an academic writing assistant. Polish the provided course description so it reads as a single coherent paragraph (120–180 words) suitable for the top of a university syllabus. Do not invent new content — only tighten and unify the tone. Keep the original facts. Output plain text, no markdown.';
    const userPrompt = `Course title: ${step1.programTitle || 'Untitled course'}
Semester: ${inputs.semester}
Academic level: ${step1.academicLevel || 'unspecified'}
Delivery: ${step1.delivery?.mode || 'unspecified'}

Raw description / purpose:
${raw}`;

    const response = await openaiService.generateContent(userPrompt, systemPrompt, {
      maxTokens: 500,
      timeout: 60000,
    });
    return (response || raw).trim();
  }

  /**
   * Auto-pair the user's session count with Step 4 modules + topics in
   * sequence, attaching readings (Step 6) and assignment due dates (from
   * exam schedule + assignment packs).
   *
   * Algorithm:
   *   - Flatten step4.modules[].topics[] in order → ordered topic list
   *   - Compute totalSessions = numWeeks * sessionsPerWeek (default 1 of each)
   *   - Distribute topics evenly across sessions
   *   - For each session, attach matching readings (by moduleId) and exam/assignment dueItems by date proximity
   */
  private buildWeeklySchedule(
    inputs: Step14SyllabusInputs,
    step4: any,
    step6: any,
    step12: any,
    step13: any
  ): SyllabusWeekRow[] {
    const numWeeks = Math.max(1, inputs.numWeeks || 12);
    const sessionsPerWeek = Math.max(1, inputs.sessionsPerWeek || 2);
    const totalSessions = numWeeks * sessionsPerWeek;

    // Flatten topics with their owning module reference, preserving order
    const topicsFlat: Array<{ moduleId: string; moduleCode: string; title: string }> = [];
    (step4.modules || []).forEach((m: any) => {
      const moduleCode = m.moduleCode || m.code || '';
      (m.topics || []).forEach((t: any) => {
        topicsFlat.push({
          moduleId: m.id,
          moduleCode,
          title: t.title || t.name || '',
        });
      });
    });

    if (topicsFlat.length === 0) {
      // Fallback: one row per module if no topics declared
      (step4.modules || []).forEach((m: any) => {
        topicsFlat.push({
          moduleId: m.id,
          moduleCode: m.moduleCode || m.code || '',
          title: m.title || '',
        });
      });
    }

    // Build readings index: moduleId → list of citations
    const readingsByModule = new Map<string, string[]>();
    (step6.moduleReadingLists || []).forEach((list: any) => {
      const cites: string[] = [];
      (list.coreReadings || []).forEach((r: any) => {
        if (r.citation) cites.push(r.citation);
      });
      readingsByModule.set(list.moduleId, cites);
    });

    // Build due-items map: dateString → list of items
    const dueByDate = new Map<string, string[]>();
    (inputs.examSchedule || []).forEach((exam) => {
      if (!exam.date) return;
      const list = dueByDate.get(exam.date) || [];
      list.push(`${exam.name} (${exam.weight}%)`);
      dueByDate.set(exam.date, list);
    });

    // Distribute topics across sessions — round-robin, with the last session
    // sweeping any remaining topics so nothing is dropped.
    const topicsPerSession = Math.max(1, Math.ceil(topicsFlat.length / totalSessions));
    const rows: SyllabusWeekRow[] = [];

    const startDate = inputs.startDate ? new Date(inputs.startDate) : null;

    for (let i = 0; i < totalSessions; i++) {
      const sessionTopics = topicsFlat.slice(i * topicsPerSession, (i + 1) * topicsPerSession);
      if (sessionTopics.length === 0 && i > 0) break; // ran out of content

      const week = Math.floor(i / sessionsPerWeek) + 1;
      const sessionNumber = i + 1;

      const dateStr = startDate
        ? new Date(startDate.getTime() + i * (7 / sessionsPerWeek) * 86400000)
            .toISOString()
            .slice(0, 10)
        : undefined;

      // Collect readings: union of every module touched in this session
      const readings: string[] = [];
      const seenReadings = new Set<string>();
      const moduleCodes = new Set<string>();
      sessionTopics.forEach((t) => {
        if (t.moduleCode) moduleCodes.add(t.moduleCode);
        const cites = readingsByModule.get(t.moduleId) || [];
        cites.forEach((c) => {
          if (!seenReadings.has(c)) {
            seenReadings.add(c);
            readings.push(c);
          }
        });
      });

      const dueItems = dateStr ? dueByDate.get(dateStr) || [] : [];

      rows.push({
        week,
        sessionNumber,
        date: dateStr,
        moduleCode: [...moduleCodes].join(', '),
        topics: sessionTopics.map((t) => t.title).filter(Boolean),
        readings: readings.slice(0, 6), // cap to keep table compact
        dueItems,
      });
    }

    return rows;
  }

  /**
   * Per-module syllabi: one ModuleSyllabus entry per step4 module, each
   * carrying just that module's MLOs, topics, readings, and assignments.
   *
   * Session count per module is proportional to its contactHours when the
   * user supplied numWeeks/sessionsPerWeek; otherwise we default to one
   * session per topic.
   */
  private buildModuleSyllabi(
    inputs: Step14SyllabusInputs,
    step4: any,
    step6: any,
    step12: any
  ): ModuleSyllabus[] {
    const modules: any[] = step4.modules || [];
    if (modules.length === 0) return [];

    const totalContact = modules.reduce((sum, m) => sum + (m.contactHours || m.totalHours || 0), 0);
    const programSessions =
      Math.max(1, inputs.numWeeks || 12) * Math.max(1, inputs.sessionsPerWeek || 2);

    // Build a global readings index once (moduleId → citations)
    const readingsByModule = new Map<string, string[]>();
    (step6.moduleReadingLists || []).forEach((list: any) => {
      const cites: string[] = [];
      (list.coreReadings || []).forEach((r: any) => {
        if (r.citation) cites.push(r.citation);
      });
      readingsByModule.set(list.moduleId, cites);
    });

    // Track running session number across modules so each module's first
    // session aligns with where the previous module left off.
    let runningSession = 0;
    const startDate = inputs.startDate ? new Date(inputs.startDate) : null;
    const sessionsPerWeek = Math.max(1, inputs.sessionsPerWeek || 2);

    return modules.map((m) => {
      const moduleCode = m.moduleCode || m.code || '';
      const moduleHours = m.contactHours || m.totalHours || 0;
      const moduleTopics = (m.topics || [])
        .map((t: any) => t.title || t.name || '')
        .filter(Boolean);

      // How many sessions this module gets — proportional to its contact
      // hours, with a sensible floor of one session per topic.
      const proportional =
        totalContact > 0
          ? Math.max(1, Math.round((moduleHours / totalContact) * programSessions))
          : moduleTopics.length;
      const moduleSessions = Math.max(moduleTopics.length || 1, proportional);

      // Pace topics across the module's sessions. If we have more sessions
      // than topics, repeat the last topic's title so the schedule isn't
      // empty rows; if more topics than sessions, batch them.
      const topicsPerSession = Math.max(1, Math.ceil(moduleTopics.length / moduleSessions));

      const cites = readingsByModule.get(m.id) || [];
      const rows: SyllabusWeekRow[] = [];
      for (let i = 0; i < moduleSessions; i++) {
        if (moduleTopics.length === 0) break;
        const slice = moduleTopics.slice(i * topicsPerSession, (i + 1) * topicsPerSession);
        if (slice.length === 0 && i > 0) break;

        const globalSession = runningSession + i + 1;
        const week = Math.floor((globalSession - 1) / sessionsPerWeek) + 1;
        const dateStr = startDate
          ? new Date(startDate.getTime() + (globalSession - 1) * (7 / sessionsPerWeek) * 86400000)
              .toISOString()
              .slice(0, 10)
          : undefined;

        rows.push({
          week,
          sessionNumber: globalSession,
          date: dateStr,
          moduleCode,
          topics: slice,
          // Dedupe readings to first 6 to keep the table compact
          readings: cites.slice(0, 6),
          dueItems: [],
        });
      }
      runningSession += moduleSessions;

      // MLOs for this module
      const mloList: string[] = (m.mlos || m.learningOutcomes || [])
        .map((mlo: any) => mlo.statement || mlo.outcome || '')
        .filter(Boolean);

      // Assignments scoped to this module — only Step 12 packs for this
      // moduleId. The course-wide summative is handled in the program
      // overview, not duplicated here.
      const moduleAssignments: SyllabusAssignmentItem[] = [];
      const matchingPack =
        (step12.modulePacks || []).find(
          (p: any) => p.moduleId === m.id || p.moduleCode === moduleCode
        ) || null;
      if (matchingPack) {
        const rep = matchingPack.variants?.[0] || matchingPack.assignments?.[0];
        if (rep) {
          moduleAssignments.push({
            title: rep.overview?.title || `${moduleCode} assignment`,
            description:
              rep.overview?.assignmentType || rep.description || 'Module-level applied assignment.',
            weight: rep.overview?.weighting || 0,
            source: 'step12',
          });
        }
      }

      return {
        moduleId: m.id,
        moduleCode,
        moduleTitle: m.title || moduleCode,
        moduleDescription: m.description || '',
        contactHours: moduleHours,
        moduleLearningOutcomes: mloList,
        weeklySchedule: rows,
        assignments: moduleAssignments,
      };
    });
  }

  /**
   * Build the assignments + grading list combining:
   *   - Step 12 assignment packs (one per module, weighted assignments)
   *   - Step 13 summative exam (single high-weight exam)
   *   - User-supplied examSchedule (extra exams the workflow doesn't know about)
   */
  private buildAssignmentsList(
    step12: any,
    step13: any,
    inputs: Step14SyllabusInputs
  ): SyllabusAssignmentItem[] {
    const items: SyllabusAssignmentItem[] = [];

    // Step 12 assignment packs (each pack has 3 delivery variants — pick one
    // representative title per module to avoid 24 rows of near-duplicates).
    (step12.modulePacks || []).forEach((pack: any) => {
      const rep = pack.variants?.[0] || pack.assignments?.[0];
      if (!rep) return;
      items.push({
        title: rep.overview?.title || `${pack.moduleCode || 'Module'} assignment`,
        description:
          rep.overview?.assignmentType || rep.description || 'Module-level applied assignment.',
        weight: rep.overview?.weighting || 0,
        source: 'step12',
      });
    });

    // Step 13 summative exam (single course-wide exam)
    if (step13.overview) {
      items.push({
        title: step13.overview.title || 'Summative Exam',
        description:
          step13.overview.description ||
          'Course-wide summative assessment covering all programme learning outcomes.',
        weight: step13.markingScheme?.weightingPercent || 40,
        source: 'step13',
      });
    }

    // User-supplied exam schedule (midterms, presentations, etc. that the
    // workflow's auto-generated assessments don't cover)
    (inputs.examSchedule || []).forEach((exam) => {
      items.push({
        title: exam.name,
        description: exam.description || 'Instructor-defined assessment.',
        weight: exam.weight,
        dueDate: exam.date,
        source: 'user',
      });
    });

    return items;
  }
}

export const syllabusService = new SyllabusService();
