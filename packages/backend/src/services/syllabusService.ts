/**
 * Syllabus Generation Service (Step 14)
 *
 * Generates the programme overview and checks one course syllabus per module (see
 * courseSyllabus for the incident, Dr Sherin Thomas, 18 November 2026). The programme
 * description gets a light LLM polish; everything in the course syllabi is built from the
 * stored steps in code, and the institution's rules are never generated.
 */

import { CurriculumWorkflow, ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import type { Step14Syllabus, Step14SyllabusInputs } from '../models/CurriculumWorkflow';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { withLessons } from './step10Store';
import { withPacks } from './step12Store';
import { buildCourseSyllabi, missingStudentRules } from './courseSyllabus';
import { checkAllCourses } from './courseSyllabusChecks';

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

    loggingService.info('Generating syllabus', {
      workflowId,
      programTitle: step1.programTitle,
      moduleCount: step4.modules?.length || 0,
    });

    // ----- Programme description (light LLM polish) -----
    const courseDescription = await this.polishCourseDescription(step1, inputs).catch((err) => {
      loggingService.warn('LLM polish failed, falling back to raw description', {
        error: err?.message,
      });
      return step1.programDescription || '';
    });

    // ----- Programme outcomes (verbatim from Step 3), for the overview only -----
    const learningOutcomes: string[] = (step3.outcomes || [])
      .map((o: any) => o.statement || o.outcome || '')
      .filter(Boolean);

    // ----- One course syllabus per module, checked in code -----
    // Built from the lessons and packs, which live outside the workflow document. Only the
    // completeness result is stored: the content is rebuilt from the steps whenever a
    // document is written, so it cannot go stale, and 46 modules of schedule stay out of the
    // 16MB workflow document.
    const hydrated = await withPacks(await withLessons(workflow));
    const courses = buildCourseSyllabi(hydrated, inputs);
    const results = checkAllCourses(courses, hydrated.step4?.modules || []);
    const moduleSyllabi = results.map((r) => ({
      moduleId: r.moduleId,
      moduleCode: r.moduleCode,
      moduleTitle: r.moduleTitle,
      completeness: { ok: r.ok, checks: r.checks },
    }));

    workflow.step14.generatedSections = {
      courseDescription,
      learningOutcomes,
      moduleSyllabi,
      missingRules: missingStudentRules(hydrated.assessmentRules, inputs),
    };
    workflow.step14.generatedAt = new Date();
    workflow.markModified('step14');
    await workflow.save();

    loggingService.info('Syllabus generated', {
      workflowId,
      programmeOutcomes: learningOutcomes.length,
      courseSyllabi: moduleSyllabi.length,
      incomplete: results.filter((r) => !r.ok).length,
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
}

export const syllabusService = new SyllabusService();
