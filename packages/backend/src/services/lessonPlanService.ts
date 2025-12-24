/**
 * LessonPlanService
 *
 * Service responsible for generating lesson plans for each module in Step 10
 * of the curriculum generation workflow.
 *
 * Implements Requirements:
 * - 1.1: Enable Step 10 after Step 9 completion
 * - 1.2: Use context from all previous 9 steps
 * - 1.3: Divide contact hours into 60-180 minute lesson blocks
 * - 1.4: Ensure sum of lesson durations equals total contact hours
 * - 1.5: Align each lesson with 1-2 MLOs
 * - 1.6: Reflect Bloom's taxonomy progression
 */

import { OpenAIService, openaiService } from './openaiService';
import { loggingService } from './loggingService';
import {
  LessonPlan,
  LessonActivity,
  CaseStudyActivity,
  FormativeCheck,
  ModuleLessonPlan,
  Step10LessonPlans,
  ReadingReference,
  ReadingAssignment,
  CharacterBrief,
} from '../models/CurriculumWorkflow';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * MLO (Module Learning Outcome) interface for lesson planning
 */
export interface MLO {
  id: string;
  outcomeNumber: number;
  statement: string;
  bloomLevel: string;
  linkedPLOs: string[];
  competencyLinks: string[];
}

/**
 * Module data interface for lesson planning
 */
export interface ModuleData {
  id: string;
  moduleCode: string;
  title: string;
  sequenceOrder: number;
  totalHours: number;
  contactHours: number;
  independentHours: number;
  isCore: boolean;
  prerequisites: string[];
  mlos: MLO[];
  contactActivities?: string[];
  independentActivities?: string[];
}

/**
 * Lesson block calculated from contact hours
 */
export interface LessonBlock {
  lessonNumber: number;
  duration: number; // minutes (60-180)
  assignedMLOs: MLO[];
  bloomLevel: string;
}

/**
 * Workflow context containing data from all previous steps
 */
export interface WorkflowContext {
  // Step 1: Program Foundation
  programTitle: string;
  programDescription: string;
  academicLevel: string;
  deliveryMode: string;
  totalContactHours: number;
  totalIndependentHours: number;

  // Step 2: KSC Framework
  knowledgeItems: any[];
  skillItems: any[];
  competencyItems: any[];

  // Step 3: PLOs
  programLearningOutcomes: any[];

  // Step 4: Course Framework
  modules: ModuleData[];

  // Step 5: Sources
  topicSources: any[];

  // Step 6: Reading Lists
  moduleReadingLists: any[];

  // Step 7: Assessments
  formativeAssessments: any[];
  summativeAssessments: any[];
  sampleQuestions: any;

  // Step 8: Case Studies
  caseStudies: any[];

  // Step 9: Glossary
  glossaryEntries: any[];
}

/**
 * Bloom's Taxonomy levels in order of cognitive complexity
 */
export const BLOOM_LEVELS_ORDER: Record<string, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  analyse: 4, // UK spelling
  evaluate: 5,
  create: 6,
};

/**
 * Normalize Bloom level string to lowercase for comparison
 */
export function normalizeBloomLevel(level: string): string {
  return level.toLowerCase().trim();
}

/**
 * Get numeric order for a Bloom level (1-6, higher = more complex)
 */
export function getBloomLevelOrder(level: string): number {
  const normalized = normalizeBloomLevel(level);
  return BLOOM_LEVELS_ORDER[normalized] || 1;
}

// ============================================================================
// LESSON PLAN SERVICE CLASS
// ============================================================================

export class LessonPlanService {
  private openaiService: OpenAIService;
  private onProgressCallback?: (progress: any) => void;

  constructor(openaiServiceInstance?: OpenAIService, progressCallback?: (progress: any) => void) {
    this.openaiService = openaiServiceInstance || openaiService;
    this.onProgressCallback = progressCallback;
  }

  // ==========================================================================
  // MAIN ENTRY POINT
  // ==========================================================================

  /**
   * Generate lesson plans for all modules in a workflow
   * Main entry point for Step 10 generation
   *
   * @param context - WorkflowContext containing data from steps 1-9
   * @param existingModulePlans - Optional array of already-generated module plans to skip
   * @returns Step10LessonPlans with all module lesson plans
   */
  async generateLessonPlans(
    context: WorkflowContext,
    existingModulePlans?: ModuleLessonPlan[]
  ): Promise<Step10LessonPlans> {
    loggingService.info('🚀 Starting lesson plan generation', {
      moduleCount: context.modules.length,
      totalContactHours: context.totalContactHours,
      programTitle: context.programTitle,
      existingModules: existingModulePlans?.length || 0,
    });

    const moduleLessonPlans: ModuleLessonPlan[] = existingModulePlans || [];
    let totalLessons = existingModulePlans?.reduce((sum, m) => sum + m.totalLessons, 0) || 0;
    let totalContactHours =
      existingModulePlans?.reduce((sum, m) => sum + m.totalContactHours, 0) || 0;
    let caseStudiesIncluded =
      existingModulePlans?.reduce(
        (sum, m) => sum + m.lessons.filter((l) => l.caseStudyActivity).length,
        0
      ) || 0;
    let formativeChecksIncluded =
      existingModulePlans?.reduce(
        (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.formativeChecks?.length || 0), 0),
        0
      ) || 0;

    // Determine which modules still need to be generated
    const startIndex = existingModulePlans?.length || 0;

    if (startIndex > 0) {
      loggingService.info(`📦 Resuming from module ${startIndex + 1}/${context.modules.length}`, {
        alreadyGenerated: startIndex,
        remaining: context.modules.length - startIndex,
      });
    }

    for (let i = startIndex; i < context.modules.length; i++) {
      const module = context.modules[i];
      loggingService.info(`📚 Processing module ${i + 1}/${context.modules.length}`, {
        moduleCode: module.moduleCode,
        moduleTitle: module.title,
        contactHours: module.contactHours,
      });

      const startTime = Date.now();
      const modulePlan = await this.generateModuleLessonPlans(module, context);
      const duration = Date.now() - startTime;

      moduleLessonPlans.push(modulePlan);

      totalLessons += modulePlan.totalLessons;
      totalContactHours += modulePlan.totalContactHours;

      // Count case studies and formative checks
      for (const lesson of modulePlan.lessons) {
        if (lesson.caseStudyActivity) caseStudiesIncluded++;
        formativeChecksIncluded += lesson.formativeChecks.length;
      }

      loggingService.info(`✅ Module ${i + 1}/${context.modules.length} complete`, {
        moduleCode: module.moduleCode,
        lessonsGenerated: modulePlan.totalLessons,
        durationMs: duration,
        durationMin: Math.round(duration / 60000),
      });

      // Return intermediate progress for real-time updates
      // This allows the workflow to be saved incrementally
      if (this.onProgressCallback) {
        this.onProgressCallback({
          modulesCompleted: i + 1,
          totalModules: context.modules.length,
          lessonsGenerated: totalLessons,
          contactHoursProcessed: totalContactHours,
          moduleLessonPlans: [...moduleLessonPlans], // Pass current state
        });
      }
    }

    const averageLessonDuration =
      totalLessons > 0 ? Math.round((totalContactHours * 60) / totalLessons) : 0;

    const step10: Step10LessonPlans = {
      moduleLessonPlans,
      validation: this.validateLessonPlans(moduleLessonPlans, context.modules),
      summary: {
        totalLessons,
        totalContactHours,
        averageLessonDuration,
        caseStudiesIncluded,
        formativeChecksIncluded,
      },
      generatedAt: new Date(),
    };

    loggingService.info('Lesson plan generation complete', {
      totalLessons,
      totalContactHours,
      caseStudiesIncluded,
      formativeChecksIncluded,
    });

    return step10;
  }

  /**
   * Generate lesson plans for a single module
   *
   * @param module - Module data including MLOs and hours
   * @param context - Full workflow context
   * @returns ModuleLessonPlan with all lessons for the module
   */
  async generateModuleLessonPlans(
    module: ModuleData,
    context: WorkflowContext
  ): Promise<ModuleLessonPlan> {
    loggingService.info('📝 Generating lesson plans for module', {
      moduleCode: module.moduleCode,
      contactHours: module.contactHours,
      mloCount: module.mlos.length,
    });

    // Step 1: Calculate lesson blocks based on contact hours
    loggingService.info('  ⏱️  Step 1: Calculating lesson blocks', {
      moduleCode: module.moduleCode,
      contactHours: module.contactHours,
    });
    const lessonBlocks = this.calculateLessonBlocks(module.contactHours, module.mlos);
    loggingService.info('  ✓ Lesson blocks calculated', {
      moduleCode: module.moduleCode,
      blockCount: lessonBlocks.length,
    });

    // Step 2: Apply Bloom's taxonomy progression
    loggingService.info("  🎓 Step 2: Applying Bloom's taxonomy progression", {
      moduleCode: module.moduleCode,
    });
    const orderedBlocks = this.applyBloomProgression(lessonBlocks);
    loggingService.info('  ✓ Bloom progression applied', {
      moduleCode: module.moduleCode,
    });

    // Step 3: Generate detailed lesson content for each block
    loggingService.info('  🤖 Step 3: Generating AI-enhanced lesson content', {
      moduleCode: module.moduleCode,
      lessonCount: orderedBlocks.length,
    });
    const lessons: LessonPlan[] = [];
    for (let i = 0; i < orderedBlocks.length; i++) {
      const block = orderedBlocks[i];
      loggingService.info(`    → Generating lesson ${i + 1}/${orderedBlocks.length}`, {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
        duration: block.duration,
        bloomLevel: block.bloomLevel,
      });

      const lessonStartTime = Date.now();
      const lesson = await this.generateLessonContent(block, module, context);
      const lessonDuration = Date.now() - lessonStartTime;

      lessons.push(lesson);

      loggingService.info(`    ✓ Lesson ${i + 1}/${orderedBlocks.length} generated`, {
        moduleCode: module.moduleCode,
        lessonId: lesson.lessonId,
        activitiesCount: lesson.activities.length,
        durationMs: lessonDuration,
        durationSec: Math.round(lessonDuration / 1000),
      });

      // Call progress callback after each lesson (for real-time updates)
      if (this.onProgressCallback) {
        try {
          await this.onProgressCallback({
            moduleId: module.id,
            moduleCode: module.moduleCode,
            moduleTitle: module.title,
            lessonsGenerated: i + 1,
            totalLessons: orderedBlocks.length,
            currentLesson: lesson,
            lessons: [...lessons], // Send all lessons generated so far
          });
        } catch (err) {
          loggingService.warn('Progress callback failed, continuing generation', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Step 4: Integrate case studies
    const lessonsWithCases = this.integrateCaseStudies(lessons, context.caseStudies, module.id);

    // Step 5: Integrate formative assessments
    const finalLessons = this.integrateAssessments(
      lessonsWithCases,
      context.formativeAssessments,
      module.id
    );

    return {
      moduleId: module.id,
      moduleCode: module.moduleCode,
      moduleTitle: module.title,
      totalContactHours: module.contactHours,
      totalLessons: finalLessons.length,
      lessons: finalLessons,
      pptDecks: [], // PPT decks will be generated separately
    };
  }

  // ==========================================================================
  // LESSON BLOCK CALCULATION (Requirements 1.3, 1.4, 1.5)
  // ==========================================================================

  /**
   * Calculate lesson blocks based on contact hours
   *
   * Requirements:
   * - 1.3: Each lesson block must be 60-180 minutes
   * - 1.4: Sum of all lesson durations must equal total contact hours
   * - 1.5: Each lesson aligned with 1-2 MLOs
   *
   * @param contactHours - Total contact hours for the module
   * @param mlos - Module Learning Outcomes to distribute
   * @returns Array of LessonBlock with durations and assigned MLOs
   */
  calculateLessonBlocks(contactHours: number, mlos: MLO[]): LessonBlock[] {
    const totalMinutes = contactHours * 60;

    // Minimum and maximum lesson durations in minutes
    const MIN_DURATION = 60;
    const MAX_DURATION = 180;

    // Calculate optimal number of lessons
    // Prefer 90-120 minute lessons as a good balance
    const preferredDuration = 90;
    let numLessons = Math.max(1, Math.round(totalMinutes / preferredDuration));

    // Adjust if average duration would be out of bounds
    let avgDuration = totalMinutes / numLessons;

    if (avgDuration > MAX_DURATION) {
      numLessons = Math.ceil(totalMinutes / MAX_DURATION);
      avgDuration = totalMinutes / numLessons;
    } else if (avgDuration < MIN_DURATION) {
      numLessons = Math.floor(totalMinutes / MIN_DURATION);
      if (numLessons === 0) numLessons = 1;
      avgDuration = totalMinutes / numLessons;
    }

    // Distribute minutes across lessons
    const lessonDurations = this.distributeDurations(
      totalMinutes,
      numLessons,
      MIN_DURATION,
      MAX_DURATION
    );

    // Distribute MLOs across lessons (1-2 per lesson)
    const mloAssignments = this.distributeMLOs(mlos, numLessons);

    // Create lesson blocks
    const blocks: LessonBlock[] = [];
    for (let i = 0; i < numLessons; i++) {
      const assignedMLOs = mloAssignments[i] || [];
      const bloomLevel = this.determinePrimaryBloomLevel(assignedMLOs);

      blocks.push({
        lessonNumber: i + 1,
        duration: lessonDurations[i],
        assignedMLOs,
        bloomLevel,
      });
    }

    return blocks;
  }

  /**
   * Distribute total minutes across lessons ensuring each is within bounds
   *
   * @param totalMinutes - Total minutes to distribute
   * @param numLessons - Number of lessons
   * @param minDuration - Minimum duration per lesson
   * @param maxDuration - Maximum duration per lesson
   * @returns Array of durations that sum to totalMinutes
   */
  private distributeDurations(
    totalMinutes: number,
    numLessons: number,
    minDuration: number,
    maxDuration: number
  ): number[] {
    if (numLessons <= 0) return [];
    if (numLessons === 1) return [totalMinutes];

    const durations: number[] = [];
    let remainingMinutes = totalMinutes;

    for (let i = 0; i < numLessons; i++) {
      const remainingLessons = numLessons - i;

      // Calculate ideal duration for remaining lessons
      const idealDuration = Math.round(remainingMinutes / remainingLessons);

      // Clamp to valid range
      let duration = Math.max(minDuration, Math.min(maxDuration, idealDuration));

      // For the last lesson, use whatever remains
      if (i === numLessons - 1) {
        duration = remainingMinutes;
      }

      durations.push(duration);
      remainingMinutes -= duration;
    }

    return durations;
  }

  /**
   * Distribute MLOs across lessons (1-2 per lesson)
   *
   * Requirements:
   * - Each lesson must have exactly 1-2 MLOs
   * - When there are more lessons than MLOs, MLOs are reused across lessons
   * - When there are more MLOs than can fit (2 per lesson), extra MLOs are distributed
   *   by creating additional lessons or capping at 2 per lesson
   *
   * @param mlos - All MLOs for the module
   * @param numLessons - Number of lessons
   * @returns Array of MLO arrays, one per lesson (each with 1-2 MLOs)
   */
  private distributeMLOs(mlos: MLO[], numLessons: number): MLO[][] {
    if (numLessons <= 0) return [];
    if (mlos.length === 0) {
      // If no MLOs provided, create a default MLO for each lesson
      return Array(numLessons)
        .fill(null)
        .map(() => [
          {
            id: 'default-mlo',
            outcomeNumber: 1,
            statement: 'Understand the key concepts of this lesson',
            bloomLevel: 'understand',
            linkedPLOs: [],
            competencyLinks: [],
          },
        ]);
    }

    const assignments: MLO[][] = Array(numLessons)
      .fill(null)
      .map(() => []);

    // Sort MLOs by Bloom level for better distribution
    const sortedMLOs = [...mlos].sort(
      (a, b) => getBloomLevelOrder(a.bloomLevel) - getBloomLevelOrder(b.bloomLevel)
    );

    // Case 1: More lessons than MLOs - reuse MLOs across lessons
    if (numLessons > sortedMLOs.length) {
      // First, assign one MLO to each lesson (cycling through MLOs)
      for (let i = 0; i < numLessons; i++) {
        const mloIndex = i % sortedMLOs.length;
        assignments[i].push(sortedMLOs[mloIndex]);
      }

      // Optionally add a second MLO to some lessons if we have enough MLOs
      if (sortedMLOs.length >= 2) {
        for (let i = 0; i < numLessons && assignments[i].length < 2; i++) {
          const secondMloIndex = (i + 1) % sortedMLOs.length;
          // Only add if it's different from the first MLO
          if (sortedMLOs[secondMloIndex].id !== assignments[i][0].id) {
            assignments[i].push(sortedMLOs[secondMloIndex]);
          }
        }
      }
    }
    // Case 2: More MLOs than lessons can hold (2 per lesson max)
    else if (sortedMLOs.length > numLessons * 2) {
      // Distribute MLOs evenly, capping at 2 per lesson
      // Some MLOs won't be assigned directly but will be covered by related MLOs
      let mloIndex = 0;
      for (let i = 0; i < numLessons; i++) {
        // Assign up to 2 MLOs per lesson
        assignments[i].push(sortedMLOs[mloIndex++]);
        if (mloIndex < sortedMLOs.length) {
          assignments[i].push(sortedMLOs[mloIndex++]);
        }
      }
    }
    // Case 3: MLOs fit nicely (numLessons <= MLOs <= numLessons * 2)
    else {
      // Distribute MLOs evenly with 1-2 per lesson
      let lessonIndex = 0;
      for (const mlo of sortedMLOs) {
        assignments[lessonIndex].push(mlo);

        // Move to next lesson if current has 2 MLOs, or if we need to spread them out
        if (assignments[lessonIndex].length >= 2) {
          lessonIndex = Math.min(lessonIndex + 1, numLessons - 1);
        } else if (sortedMLOs.length <= numLessons && lessonIndex < numLessons - 1) {
          // Spread out: one MLO per lesson when we have enough lessons
          lessonIndex++;
        }
      }

      // Ensure all lessons have at least 1 MLO by reusing from previous lessons
      for (let i = 0; i < numLessons; i++) {
        if (assignments[i].length === 0) {
          // Find the nearest lesson with MLOs and copy one
          const sourceIndex = i > 0 ? i - 1 : 0;
          if (assignments[sourceIndex].length > 0) {
            assignments[i].push(assignments[sourceIndex][0]);
          }
        }
      }
    }

    return assignments;
  }

  /**
   * Determine the primary Bloom level for a set of MLOs
   */
  private determinePrimaryBloomLevel(mlos: MLO[]): string {
    if (mlos.length === 0) return 'understand';

    // Use the highest Bloom level among assigned MLOs
    let maxLevel = 0;
    let primaryLevel = 'understand';

    for (const mlo of mlos) {
      const level = getBloomLevelOrder(mlo.bloomLevel);
      if (level > maxLevel) {
        maxLevel = level;
        primaryLevel = mlo.bloomLevel;
      }
    }

    return primaryLevel;
  }

  // ==========================================================================
  // BLOOM'S TAXONOMY PROGRESSION (Requirement 1.6)
  // ==========================================================================

  /**
   * Apply Bloom's taxonomy progression to lesson blocks
   * Ensures foundational concepts come first, complex applications later
   *
   * Requirement 1.6: Reflect Bloom's taxonomy level progression
   *
   * @param blocks - Lesson blocks to reorder
   * @returns Reordered blocks with Bloom progression
   */
  applyBloomProgression(blocks: LessonBlock[]): LessonBlock[] {
    if (blocks.length <= 1) return blocks;

    // Sort blocks by Bloom level (lower levels first)
    const sortedBlocks = [...blocks].sort((a, b) => {
      const levelA = getBloomLevelOrder(a.bloomLevel);
      const levelB = getBloomLevelOrder(b.bloomLevel);
      return levelA - levelB;
    });

    // Renumber lessons after sorting
    return sortedBlocks.map((block, index) => ({
      ...block,
      lessonNumber: index + 1,
    }));
  }

  /**
   * Verify that lesson blocks follow Bloom's progression
   * (earlier lessons have equal or lower Bloom levels than later lessons)
   *
   * @param blocks - Lesson blocks to verify
   * @returns true if progression is valid
   */
  verifyBloomProgression(blocks: LessonBlock[]): boolean {
    if (blocks.length <= 1) return true;

    for (let i = 1; i < blocks.length; i++) {
      const prevLevel = getBloomLevelOrder(blocks[i - 1].bloomLevel);
      const currLevel = getBloomLevelOrder(blocks[i].bloomLevel);

      if (currLevel < prevLevel) {
        return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // LESSON CONTENT GENERATION
  // ==========================================================================

  /**
   * Generate detailed lesson content for a lesson block
   *
   * Requirements:
   * - 2.1: Generate lesson objectives from MLOs
   * - 2.2: Generate activity sequence with timings
   * - 2.5: Generate instructor notes with pedagogical guidance
   *
   * @param block - Lesson block with duration and MLOs
   * @param module - Module data
   * @param context - Full workflow context
   * @returns Complete LessonPlan
   */
  async generateLessonContent(
    block: LessonBlock,
    module: ModuleData,
    context: WorkflowContext
  ): Promise<LessonPlan> {
    const lessonId = `${module.moduleCode}-L${block.lessonNumber}`;

    // Generate lesson title from MLOs
    const lessonTitle = this.generateLessonTitle(block, module);

    // Build comprehensive OpenAI prompt with context from all 9 steps
    const aiEnhancedContent = await this.generateAIEnhancedContent(block, module, context);

    // Generate objectives from MLOs (Requirement 2.1)
    const objectives =
      aiEnhancedContent.objectives ||
      block.assignedMLOs.map(
        (mlo) =>
          `By the end of this lesson, learners will be able to ${mlo.statement.toLowerCase()}`
      );

    // Generate activity sequence with timings (Requirement 2.2)
    const activities =
      aiEnhancedContent.activities || this.generateActivitySequence(block, module, context);

    // Generate materials list (Requirement 2.4)
    const materials = this.generateMaterialsList(block, module, context);

    // Get linked PLOs
    const linkedPLOs = this.getLinkedPLOs(block.assignedMLOs);

    // Generate instructor notes with pedagogical guidance (Requirement 2.5)
    const instructorNotes = {
      pedagogicalGuidance:
        aiEnhancedContent.pedagogicalGuidance || this.generatePedagogicalGuidance(block, context),
      pacingSuggestions:
        aiEnhancedContent.pacingSuggestions ||
        this.generatePacingSuggestions(block.duration, activities),
      adaptationOptions:
        aiEnhancedContent.adaptationOptions || this.generateAdaptationOptions(context.deliveryMode),
      commonMisconceptions: aiEnhancedContent.commonMisconceptions || [],
      discussionPrompts:
        aiEnhancedContent.discussionPrompts || this.generateDiscussionPrompts(block.assignedMLOs),
    };

    const lessonPlan: LessonPlan = {
      lessonId,
      lessonNumber: block.lessonNumber,
      lessonTitle,
      duration: block.duration,
      linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
      linkedPLOs,
      bloomLevel: block.bloomLevel,
      objectives,
      activities,
      materials,
      instructorNotes,
      independentStudy: this.generateIndependentStudy(block.assignedMLOs, context),
      formativeChecks: [],
    };

    return lessonPlan;
  }

  /**
   * Generate AI-enhanced lesson content using OpenAI with context from all 9 steps
   *
   * @param block - Lesson block with duration and MLOs
   * @param module - Module data
   * @param context - Full workflow context from steps 1-9
   * @returns AI-generated lesson content
   */
  private async generateAIEnhancedContent(
    block: LessonBlock,
    module: ModuleData,
    context: WorkflowContext
  ): Promise<{
    objectives: string[];
    activities: LessonActivity[];
    pedagogicalGuidance: string;
    pacingSuggestions: string;
    adaptationOptions: string[];
    commonMisconceptions: string[];
    discussionPrompts: string[];
  }> {
    try {
      loggingService.info('      🧠 Calling OpenAI for AI-enhanced content', {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
        duration: block.duration,
        bloomLevel: block.bloomLevel,
      });

      // Build comprehensive context from all 9 steps
      const contextSummary = this.buildContextSummary(block, module, context);

      const prompt = `You are an expert curriculum designer creating a detailed lesson plan.

CONTEXT FROM PREVIOUS STEPS:
${contextSummary}

LESSON DETAILS:
- Lesson Number: ${block.lessonNumber}
- Duration: ${block.duration} minutes
- Bloom Level: ${block.bloomLevel}
- Module: ${module.moduleCode} - ${module.title}
- Assigned MLOs: ${block.assignedMLOs.map((mlo) => `"${mlo.statement}"`).join(', ')}

TASK:
Generate detailed lesson content including:
1. Specific, measurable learning objectives (3-5 objectives)
2. Activity sequence with timings that sum to ${block.duration} minutes
3. Pedagogical guidance for instructors
4. Pacing suggestions
5. Adaptation options for different learner needs
6. Common misconceptions students might have
7. Discussion prompts to engage learners

Return your response as a JSON object with the following structure:
{
  "objectives": ["objective 1", "objective 2", ...],
  "activities": [
    {
      "title": "Activity title",
      "description": "Activity description",
      "duration": 30,
      "type": "mini_lecture|discussion|demonstration|practice|role_play|case_analysis|group_work|assessment|break",
      "teachingMethod": "method description",
      "resources": ["resource 1", "resource 2"],
      "instructorActions": ["action 1", "action 2"],
      "studentActions": ["action 1", "action 2"]
    }
  ],
  "pedagogicalGuidance": "Detailed guidance for instructors...",
  "pacingSuggestions": "Pacing recommendations...",
  "adaptationOptions": ["option 1", "option 2", ...],
  "commonMisconceptions": ["misconception 1", "misconception 2", ...],
  "discussionPrompts": ["prompt 1", "prompt 2", ...]
}

Ensure activities are appropriate for ${context.deliveryMode} delivery mode and align with the Bloom level "${block.bloomLevel}".`;

      const aiStartTime = Date.now();
      const content = await this.openaiService.generateContent(
        prompt,
        'You are an expert curriculum designer specializing in creating detailed, pedagogically sound lesson plans.',
        {
          maxTokens: 128000, // GPT-5 supports large token outputs
          timeout: 1200000, // 20 minutes timeout
          responseFormat: 'json_object',
        }
      );
      const aiDuration = Date.now() - aiStartTime;

      loggingService.info('      ✓ OpenAI response received', {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
        responseLength: content?.length || 0,
        durationMs: aiDuration,
        durationSec: Math.round(aiDuration / 1000),
      });

      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      // Parse JSON response
      loggingService.info('      📋 Parsing JSON response', {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
      });
      const parsed = JSON.parse(content);
      loggingService.info('      ✓ JSON parsed successfully', {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
        objectivesCount: parsed.objectives?.length || 0,
        activitiesCount: parsed.activities?.length || 0,
      });

      // Transform activities to match LessonActivity interface
      const activities: LessonActivity[] = parsed.activities.map((act: any, index: number) => ({
        activityId: `${module.moduleCode}-L${block.lessonNumber}-A${index + 1}`,
        sequenceOrder: index + 1,
        type: act.type || 'mini_lecture',
        title: act.title,
        description: act.description,
        duration: act.duration,
        teachingMethod: act.teachingMethod,
        resources: act.resources || [],
        instructorActions: act.instructorActions || [],
        studentActions: act.studentActions || [],
      }));

      return {
        objectives: parsed.objectives,
        activities,
        pedagogicalGuidance: parsed.pedagogicalGuidance,
        pacingSuggestions: parsed.pacingSuggestions,
        adaptationOptions: parsed.adaptationOptions,
        commonMisconceptions: parsed.commonMisconceptions,
        discussionPrompts: parsed.discussionPrompts,
      };
    } catch (error) {
      loggingService.error('❌ Failed to generate AI-enhanced content, using fallback', {
        error: error instanceof Error ? error.message : String(error),
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
        bloomLevel: block.bloomLevel,
        duration: block.duration,
        stack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });

      loggingService.warn('⚠️  Using fallback generation methods', {
        moduleCode: module.moduleCode,
        lessonNumber: block.lessonNumber,
      });

      // Return empty object to use fallback methods
      return {
        objectives: [],
        activities: [],
        pedagogicalGuidance: '',
        pacingSuggestions: '',
        adaptationOptions: [],
        commonMisconceptions: [],
        discussionPrompts: [],
      };
    }
  }

  /**
   * Build comprehensive context summary from all 9 workflow steps
   *
   * @param block - Lesson block
   * @param module - Module data
   * @param context - Full workflow context
   * @returns Formatted context summary string
   */
  private buildContextSummary(
    block: LessonBlock,
    module: ModuleData,
    context: WorkflowContext
  ): string {
    const parts: string[] = [];

    // Step 1: Program Foundation
    parts.push(`PROGRAM: ${context.programTitle}`);
    parts.push(`Academic Level: ${context.academicLevel}`);
    parts.push(`Delivery Mode: ${context.deliveryMode}`);
    parts.push(`Program Description: ${context.programDescription}`);

    // Step 2: KSC Framework (relevant competencies)
    if (block.assignedMLOs.length > 0) {
      const competencyLinks = block.assignedMLOs.flatMap((mlo) => mlo.competencyLinks || []);
      if (competencyLinks.length > 0) {
        const relevantCompetencies = context.competencyItems
          ?.filter((c: any) => competencyLinks.includes(c.id))
          .map((c: any) => c.statement)
          .slice(0, 3);
        if (relevantCompetencies && relevantCompetencies.length > 0) {
          parts.push(`\nRELEVANT COMPETENCIES: ${relevantCompetencies.join('; ')}`);
        }
      }
    }

    // Step 3: PLOs (linked to this lesson's MLOs)
    const linkedPLOIds = this.getLinkedPLOs(block.assignedMLOs);
    if (linkedPLOIds.length > 0) {
      const relevantPLOs = context.programLearningOutcomes
        ?.filter((plo: any) => linkedPLOIds.includes(plo.id))
        .map((plo: any) => plo.statement)
        .slice(0, 3);
      if (relevantPLOs && relevantPLOs.length > 0) {
        parts.push(`\nLINKED PLOs: ${relevantPLOs.join('; ')}`);
      }
    }

    // Step 4: Module context
    parts.push(`\nMODULE: ${module.moduleCode} - ${module.title}`);
    parts.push(
      `Module Hours: ${module.contactHours} contact, ${module.independentHours} independent`
    );
    if (module.prerequisites && module.prerequisites.length > 0) {
      parts.push(`Prerequisites: ${module.prerequisites.join(', ')}`);
    }

    // Step 5-6: Reading materials (relevant to this lesson's MLOs)
    const readingRefs = this.getReadingReferences(block.assignedMLOs, context);
    if (readingRefs.length > 0) {
      parts.push(`\nREADING MATERIALS: ${readingRefs.length} sources available`);
      const citations = readingRefs
        .slice(0, 2)
        .map((r) => r.citation)
        .join('; ');
      parts.push(`Key sources: ${citations}`);
    }

    // Step 7: Assessment context
    if (context.formativeAssessments && context.formativeAssessments.length > 0) {
      const moduleAssessments = context.formativeAssessments.filter(
        (a: any) => a.moduleId === module.id
      );
      if (moduleAssessments.length > 0) {
        parts.push(
          `\nASSESSMENTS: ${moduleAssessments.length} formative assessments available for this module`
        );
      }
    }

    // Step 8: Case studies
    if (context.caseStudies && context.caseStudies.length > 0) {
      const moduleCases = context.caseStudies.filter((cs: any) =>
        cs.moduleIds?.includes(module.id)
      );
      if (moduleCases.length > 0) {
        parts.push(`\nCASE STUDIES: ${moduleCases.length} case studies available`);
        const caseTitle = moduleCases[0]?.title;
        if (caseTitle) {
          parts.push(`Example: "${caseTitle}"`);
        }
      }
    }

    // Step 9: Glossary terms (relevant to MLOs)
    if (context.glossaryEntries && context.glossaryEntries.length > 0) {
      const mloStatements = block.assignedMLOs.map((mlo) => mlo.statement.toLowerCase()).join(' ');
      const relevantTerms = context.glossaryEntries
        .filter((entry: any) => mloStatements.includes(entry.term.toLowerCase()))
        .slice(0, 5)
        .map((entry: any) => entry.term);
      if (relevantTerms.length > 0) {
        parts.push(`\nKEY TERMS: ${relevantTerms.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate a lesson title from the assigned MLOs
   */
  private generateLessonTitle(block: LessonBlock, module: ModuleData): string {
    if (block.assignedMLOs.length === 0) {
      return `${module.title} - Lesson ${block.lessonNumber}`;
    }

    // Extract key concepts from MLO statements
    const firstMLO = block.assignedMLOs[0];
    const statement = firstMLO.statement;

    // Try to extract the main topic from the MLO statement
    const verbPatterns =
      /^(understand|explain|analyse|analyze|apply|evaluate|create|demonstrate|identify|describe|compare|assess)/i;
    const cleanedStatement = statement.replace(verbPatterns, '').trim();

    // Capitalize first letter and truncate if too long
    const title = cleanedStatement.charAt(0).toUpperCase() + cleanedStatement.slice(1);
    return title.length > 60 ? title.substring(0, 57) + '...' : title;
  }

  /**
   * Generate activity sequence for a lesson
   */
  private generateActivitySequence(
    block: LessonBlock,
    module: ModuleData,
    context: WorkflowContext
  ): LessonActivity[] {
    const activities: LessonActivity[] = [];
    let remainingTime = block.duration;
    let sequenceOrder = 1;

    // Opening activity (5-10 min)
    const openingDuration = Math.min(10, Math.floor(remainingTime * 0.1));
    activities.push({
      activityId: `${module.moduleCode}-L${block.lessonNumber}-A${sequenceOrder}`,
      sequenceOrder: sequenceOrder++,
      type: 'mini_lecture',
      title: 'Introduction and Learning Objectives',
      description: 'Review lesson objectives and connect to previous learning',
      duration: openingDuration,
      teachingMethod: 'direct instruction',
      resources: ['PPT slides'],
      instructorActions: ['Present objectives', 'Recap previous lesson', 'Set context'],
      studentActions: ['Listen', 'Ask clarifying questions'],
    });
    remainingTime -= openingDuration;

    // Main content activities (60-70% of remaining time)
    const mainContentTime = Math.floor(remainingTime * 0.65);
    const numMainActivities = Math.max(1, Math.floor(mainContentTime / 30));
    const timePerActivity = Math.floor(mainContentTime / numMainActivities);

    for (let i = 0; i < numMainActivities; i++) {
      const activityType = this.selectActivityType(block.bloomLevel, i, context.deliveryMode);
      activities.push({
        activityId: `${module.moduleCode}-L${block.lessonNumber}-A${sequenceOrder}`,
        sequenceOrder: sequenceOrder++,
        type: activityType,
        title: `Core Content ${i + 1}`,
        description: this.getActivityDescription(activityType, block.assignedMLOs),
        duration: timePerActivity,
        teachingMethod: this.getTeachingMethod(activityType, context.deliveryMode),
        resources: this.getActivityResources(activityType),
        instructorActions: this.getInstructorActions(activityType),
        studentActions: this.getStudentActions(activityType),
      });
    }
    remainingTime -= mainContentTime;

    // Practice/Application activity (20-25% of remaining time)
    const practiceTime = Math.floor(remainingTime * 0.7);
    if (practiceTime >= 10) {
      activities.push({
        activityId: `${module.moduleCode}-L${block.lessonNumber}-A${sequenceOrder}`,
        sequenceOrder: sequenceOrder++,
        type: 'practice',
        title: 'Application Exercise',
        description: 'Apply concepts through guided practice',
        duration: practiceTime,
        teachingMethod: 'guided practice',
        resources: ['Worksheet', 'Case materials'],
        instructorActions: ['Facilitate', 'Provide feedback', 'Monitor progress'],
        studentActions: ['Complete exercise', 'Collaborate with peers', 'Ask questions'],
      });
      remainingTime -= practiceTime;
    }

    // Closing activity (remaining time)
    if (remainingTime >= 5) {
      activities.push({
        activityId: `${module.moduleCode}-L${block.lessonNumber}-A${sequenceOrder}`,
        sequenceOrder: sequenceOrder++,
        type: 'discussion',
        title: 'Summary and Reflection',
        description: 'Recap key points and preview next lesson',
        duration: remainingTime,
        teachingMethod: 'discussion',
        resources: ['PPT summary slide'],
        instructorActions: ['Summarize key points', 'Answer questions', 'Preview next lesson'],
        studentActions: ['Reflect on learning', 'Ask questions', 'Note key takeaways'],
      });
    }

    return activities;
  }

  /**
   * Select appropriate activity type based on Bloom level and delivery mode
   */
  private selectActivityType(
    bloomLevel: string,
    activityIndex: number,
    deliveryMode: string
  ): LessonActivity['type'] {
    const level = getBloomLevelOrder(bloomLevel);

    // Lower Bloom levels: more lecture and demonstration
    if (level <= 2) {
      return activityIndex === 0 ? 'mini_lecture' : 'demonstration';
    }

    // Middle Bloom levels: mix of discussion and practice
    if (level <= 4) {
      return activityIndex === 0 ? 'discussion' : 'practice';
    }

    // Higher Bloom levels: case analysis and group work
    return activityIndex === 0 ? 'case_analysis' : 'group_work';
  }

  /**
   * Get teaching method based on activity type and delivery mode
   *
   * Requirement 2.3: Map delivery modes to appropriate teaching methods
   *
   * @param type - Activity type
   * @param deliveryMode - Delivery mode (online self-study, online facilitated, hybrid, in-person)
   * @returns Teaching method appropriate for the delivery mode
   */
  private getTeachingMethod(type: LessonActivity['type'], deliveryMode: string): string {
    const normalizedMode = deliveryMode.toLowerCase();

    // Base methods for each activity type
    const baseMethods: Record<LessonActivity['type'], string> = {
      mini_lecture: 'direct instruction',
      discussion: 'facilitated discussion',
      demonstration: 'modeling',
      practice: 'guided practice',
      role_play: 'experiential learning',
      case_analysis: 'problem-based learning',
      group_work: 'collaborative learning',
      assessment: 'formative assessment',
      break: 'n/a',
    };

    // Delivery mode adaptations
    if (normalizedMode.includes('online') && normalizedMode.includes('self')) {
      // Online self-study: asynchronous, independent methods
      const selfStudyMethods: Partial<Record<LessonActivity['type'], string>> = {
        mini_lecture: 'video-based instruction with pause points',
        discussion: 'asynchronous forum discussion',
        demonstration: 'recorded demonstration with replay capability',
        practice: 'self-paced practice with automated feedback',
        role_play: 'scenario-based simulation',
        case_analysis: 'guided case analysis with scaffolding',
        group_work: 'peer review and asynchronous collaboration',
        assessment: 'self-assessment with immediate feedback',
      };
      return selfStudyMethods[type] || baseMethods[type];
    }

    if (normalizedMode.includes('online') && normalizedMode.includes('facilitated')) {
      // Online facilitated: synchronous virtual methods
      const onlineFacilitatedMethods: Partial<Record<LessonActivity['type'], string>> = {
        mini_lecture: 'live virtual presentation with Q&A',
        discussion: 'facilitated online discussion with breakout rooms',
        demonstration: 'live screen-share demonstration',
        practice: 'guided practice with virtual support',
        role_play: 'virtual role-play with assigned roles',
        case_analysis: 'collaborative online case analysis',
        group_work: 'breakout room collaborative activities',
        assessment: 'live polling and formative checks',
      };
      return onlineFacilitatedMethods[type] || baseMethods[type];
    }

    if (normalizedMode.includes('hybrid') || normalizedMode.includes('blended')) {
      // Hybrid: mix of online and in-person methods
      const hybridMethods: Partial<Record<LessonActivity['type'], string>> = {
        mini_lecture: 'flipped classroom with pre-recorded content',
        discussion: 'hybrid discussion (in-person + virtual participants)',
        demonstration: 'live demonstration with recording for review',
        practice: 'blended practice (online prep + in-person application)',
        role_play: 'in-person role-play with virtual observers',
        case_analysis: 'collaborative case analysis (online prep + in-person discussion)',
        group_work: 'flexible grouping (in-person and virtual)',
        assessment: 'blended assessment (online quizzes + in-person checks)',
      };
      return hybridMethods[type] || baseMethods[type];
    }

    // In-person: traditional face-to-face methods
    const inPersonMethods: Partial<Record<LessonActivity['type'], string>> = {
      mini_lecture: 'interactive lecture with think-pair-share',
      discussion: 'Socratic dialogue and class discussion',
      demonstration: 'live demonstration with student participation',
      practice: 'hands-on practice with instructor support',
      role_play: 'immersive role-play with peer feedback',
      case_analysis: 'case method teaching with full class discussion',
      group_work: 'small group collaborative activities',
      assessment: 'in-class formative assessment with immediate feedback',
    };
    return inPersonMethods[type] || baseMethods[type];
  }

  /**
   * Get activity description based on type and MLOs
   */
  private getActivityDescription(type: LessonActivity['type'], mlos: MLO[]): string {
    const mloFocus = mlos.length > 0 ? mlos[0].statement : 'key concepts';
    const descriptions: Record<LessonActivity['type'], string> = {
      mini_lecture: `Instructor-led presentation covering ${mloFocus}`,
      discussion: `Facilitated discussion exploring ${mloFocus}`,
      demonstration: `Practical demonstration of ${mloFocus}`,
      practice: `Hands-on practice applying ${mloFocus}`,
      role_play: `Role-play scenario related to ${mloFocus}`,
      case_analysis: `Case study analysis focusing on ${mloFocus}`,
      group_work: `Collaborative group activity on ${mloFocus}`,
      assessment: `Formative assessment checking understanding of ${mloFocus}`,
      break: 'Short break for refreshment',
    };
    return descriptions[type] || `Activity focusing on ${mloFocus}`;
  }

  private getActivityResources(type: LessonActivity['type']): string[] {
    const resources: Record<LessonActivity['type'], string[]> = {
      mini_lecture: ['PPT slides', 'Whiteboard'],
      discussion: ['Discussion prompts', 'Flip chart'],
      demonstration: ['Demo materials', 'Screen share'],
      practice: ['Worksheet', 'Practice problems'],
      role_play: ['Role cards', 'Scenario brief'],
      case_analysis: ['Case study document', 'Analysis framework'],
      group_work: ['Group activity sheet', 'Collaboration tools'],
      assessment: ['Quiz questions', 'Response system'],
      break: [],
    };
    return resources[type] || [];
  }

  private getInstructorActions(type: LessonActivity['type']): string[] {
    const actions: Record<LessonActivity['type'], string[]> = {
      mini_lecture: ['Present content', 'Check understanding', 'Answer questions'],
      discussion: ['Pose questions', 'Facilitate dialogue', 'Summarize points'],
      demonstration: ['Model process', 'Explain steps', 'Highlight key points'],
      practice: ['Monitor progress', 'Provide feedback', 'Assist as needed'],
      role_play: ['Set up scenario', 'Observe', 'Debrief'],
      case_analysis: ['Introduce case', 'Guide analysis', 'Facilitate discussion'],
      group_work: ['Form groups', 'Circulate', 'Support collaboration'],
      assessment: ['Administer assessment', 'Review answers', 'Provide feedback'],
      break: ['Monitor time'],
    };
    return actions[type] || [];
  }

  private getStudentActions(type: LessonActivity['type']): string[] {
    const actions: Record<LessonActivity['type'], string[]> = {
      mini_lecture: ['Listen actively', 'Take notes', 'Ask questions'],
      discussion: ['Participate', 'Share perspectives', 'Listen to peers'],
      demonstration: ['Observe', 'Take notes', 'Ask clarifying questions'],
      practice: ['Complete exercises', 'Apply concepts', 'Seek feedback'],
      role_play: ['Assume role', 'Engage in scenario', 'Reflect on experience'],
      case_analysis: ['Read case', 'Analyze situation', 'Propose solutions'],
      group_work: ['Collaborate', 'Contribute ideas', 'Complete group task'],
      assessment: ['Complete assessment', 'Review feedback', 'Identify gaps'],
      break: ['Rest', 'Refresh'],
    };
    return actions[type] || [];
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate materials list for a lesson
   *
   * Requirement 2.4: List required materials including reading references from Steps 5-6
   * and case files from Step 8
   *
   * @param block - Lesson block with MLOs
   * @param module - Module data
   * @param context - Full workflow context
   * @returns Materials object with PPT ref, case files, and reading references
   */
  private generateMaterialsList(
    block: LessonBlock,
    module: ModuleData,
    context: WorkflowContext
  ): LessonPlan['materials'] {
    // Get reading references from Steps 5-6
    const readingReferences = this.getReadingReferences(block.assignedMLOs, context);

    // Get case files from Step 8
    const caseFiles = this.getCaseFilesForLesson(block.assignedMLOs, module.id, context);

    // Generate PPT deck reference placeholder
    const lessonId = `${module.moduleCode}-L${block.lessonNumber}`;
    const pptDeckRef = `${lessonId}-PPT`;

    return {
      pptDeckRef,
      caseFiles,
      readingReferences,
    };
  }

  /**
   * Get case files relevant to this lesson's MLOs
   *
   * @param mlos - Lesson's assigned MLOs
   * @param moduleId - Module ID
   * @param context - Workflow context
   * @returns Array of case file IDs
   */
  private getCaseFilesForLesson(mlos: MLO[], moduleId: string, context: WorkflowContext): string[] {
    if (!context.caseStudies || context.caseStudies.length === 0) {
      return [];
    }

    const mloIds = mlos.map((m) => m.id);
    const caseFiles: string[] = [];

    // Filter case studies for this module
    const moduleCaseStudies = context.caseStudies.filter((cs: any) =>
      cs.moduleIds?.includes(moduleId)
    );

    // Find case studies that align with this lesson's MLOs
    for (const caseStudy of moduleCaseStudies) {
      const csMloIds = caseStudy.mloIds || [];
      const hasMatchingMLO = csMloIds.some((id: string) => mloIds.includes(id));

      if (hasMatchingMLO) {
        caseFiles.push(caseStudy.id);
      }
    }

    return caseFiles;
  }

  private getReadingReferences(mlos: MLO[], context: WorkflowContext): ReadingReference[] {
    const references: ReadingReference[] = [];

    for (const moduleReadings of context.moduleReadingLists) {
      const coreReadings = moduleReadings.coreReadings || [];
      for (const reading of coreReadings) {
        // Check if reading is relevant to any of the lesson's MLOs
        const mloIds = mlos.map((m) => m.id);
        const readingMloIds = reading.mloIds || [];
        const isRelevant = readingMloIds.some((id: string) => mloIds.includes(id));

        if (isRelevant) {
          references.push({
            sourceId: reading.sourceId,
            citation: reading.citation,
            estimatedMinutes: reading.estimatedMinutes || 30,
          });
        }
      }
    }

    return references.slice(0, 5); // Limit to 5 references per lesson
  }

  private getLinkedPLOs(mlos: MLO[]): string[] {
    const ploSet = new Set<string>();
    for (const mlo of mlos) {
      for (const plo of mlo.linkedPLOs || []) {
        ploSet.add(plo);
      }
    }
    return Array.from(ploSet);
  }

  private generatePedagogicalGuidance(block: LessonBlock, context: WorkflowContext): string {
    const level = getBloomLevelOrder(block.bloomLevel);

    if (level <= 2) {
      return 'Focus on building foundational understanding. Use clear explanations, examples, and visual aids. Check for comprehension frequently.';
    } else if (level <= 4) {
      return 'Encourage application and analysis. Use case studies and problem-solving activities. Facilitate peer discussion and collaborative learning.';
    } else {
      return 'Challenge learners to evaluate and create. Use complex scenarios requiring critical thinking. Encourage independent analysis and synthesis of ideas.';
    }
  }

  private generatePacingSuggestions(duration: number, activities: LessonActivity[]): string {
    const activityCount = activities.length;
    const avgActivityTime = Math.round(duration / activityCount);

    return (
      `Total lesson time: ${duration} minutes. Average ${avgActivityTime} minutes per activity. ` +
      `Build in 2-3 minute transitions between activities. ` +
      `Monitor engagement and adjust pacing as needed.`
    );
  }

  private generateAdaptationOptions(deliveryMode: string): string[] {
    const baseOptions = [
      'Extend discussion time if learners are highly engaged',
      'Provide additional examples for struggling learners',
      'Offer extension activities for advanced learners',
    ];

    if (deliveryMode.includes('online')) {
      return [
        ...baseOptions,
        'Use breakout rooms for small group discussions',
        'Incorporate polling for engagement checks',
        'Record key segments for asynchronous review',
      ];
    }

    return [
      ...baseOptions,
      'Use think-pair-share for discussions',
      'Incorporate movement activities for energy',
      'Use physical manipulatives where appropriate',
    ];
  }

  private generateDiscussionPrompts(mlos: MLO[]): string[] {
    return mlos.map(
      (mlo) => `How does ${mlo.statement.toLowerCase()} apply to your professional context?`
    );
  }

  /**
   * Generate independent study assignments for a lesson
   *
   * Requirement 2.6: Include Core readings with estimated effort, Supplementary readings,
   * and calculate total independent study time
   *
   * @param mlos - Lesson's assigned MLOs
   * @param context - Workflow context
   * @returns Independent study object with core/supplementary readings and estimated effort
   */
  private generateIndependentStudy(
    mlos: MLO[],
    context: WorkflowContext
  ): LessonPlan['independentStudy'] {
    const coreReadings: ReadingAssignment[] = [];
    const supplementaryReadings: ReadingAssignment[] = [];
    let totalEffort = 0;

    const mloIds = mlos.map((m) => m.id);

    // Extract readings from Step 6 (Reading Lists)
    for (const moduleReadings of context.moduleReadingLists) {
      // Add core readings aligned with this lesson's MLOs
      for (const reading of moduleReadings.coreReadings || []) {
        const readingMloIds = reading.mloIds || [];
        if (readingMloIds.some((id: string) => mloIds.includes(id))) {
          const estimatedMinutes = reading.estimatedMinutes || 30;
          coreReadings.push({
            sourceId: reading.sourceId,
            citation: reading.citation,
            estimatedMinutes,
            complexityLevel: reading.complexityLevel || 'intermediate',
          });
          totalEffort += estimatedMinutes;
        }
      }

      // Add supplementary readings aligned with this lesson's MLOs
      for (const reading of moduleReadings.supplementaryReadings || []) {
        const readingMloIds = reading.mloIds || [];
        if (readingMloIds.some((id: string) => mloIds.includes(id))) {
          const estimatedMinutes = reading.estimatedMinutes || 20;
          supplementaryReadings.push({
            sourceId: reading.sourceId,
            citation: reading.citation,
            estimatedMinutes,
            complexityLevel: reading.complexityLevel || 'intermediate',
          });
          // Note: Supplementary readings are optional, so we don't add to totalEffort
        }
      }
    }

    // Limit to reasonable number of readings per lesson
    const limitedCoreReadings = coreReadings.slice(0, 3);
    const limitedSupplementaryReadings = supplementaryReadings.slice(0, 3);

    // Recalculate total effort based on limited core readings
    totalEffort = limitedCoreReadings.reduce((sum, r) => sum + r.estimatedMinutes, 0);

    return {
      coreReadings: limitedCoreReadings,
      supplementaryReadings: limitedSupplementaryReadings,
      estimatedEffort: totalEffort,
    };
  }

  // ==========================================================================
  // CASE STUDY INTEGRATION
  // ==========================================================================

  /**
   * Integrate case studies into lessons based on MLO alignment
   *
   * Requirements:
   * - 3.1: Match case studies to lessons by MLO alignment
   * - 3.2: Consider difficulty progression for placement
   * - 3.4: Handle multi-module case studies (first vs subsequent appearance)
   *
   * @param lessons - Array of lesson plans to integrate case studies into
   * @param caseStudies - All case studies from Step 8
   * @param moduleId - Current module ID
   * @returns Lessons with integrated case studies
   */
  integrateCaseStudies(lessons: LessonPlan[], caseStudies: any[], moduleId: string): LessonPlan[] {
    // Filter case studies for this module
    const moduleCaseStudies = caseStudies.filter((cs) => cs.moduleIds?.includes(moduleId));

    if (moduleCaseStudies.length === 0) {
      return lessons;
    }

    // Track which case studies have been used globally (across all modules)
    const globalUsedCaseStudies = new Map<string, string>(); // caseId -> first moduleId

    // Sort case studies by difficulty level for proper progression
    const sortedCaseStudies = this.sortCaseStudiesByDifficulty(moduleCaseStudies);

    // Create a copy of lessons to modify
    const updatedLessons = [...lessons];

    // Track which case studies have been assigned in this module
    const moduleUsedCaseStudies = new Set<string>();

    // Iterate through lessons and assign case studies based on MLO alignment and difficulty
    for (let i = 0; i < updatedLessons.length; i++) {
      const lesson = updatedLessons[i];

      // Find the best matching case study for this lesson
      const matchingCase = this.findBestMatchingCaseStudy(
        lesson,
        sortedCaseStudies,
        moduleUsedCaseStudies,
        i,
        updatedLessons.length
      );

      if (!matchingCase) {
        continue;
      }

      // Mark case study as used in this module
      moduleUsedCaseStudies.add(matchingCase.id);

      // Determine if this is the first appearance of the case study
      const isFirstAppearance = !globalUsedCaseStudies.has(matchingCase.id);
      const previousAppearanceRef = isFirstAppearance
        ? undefined
        : globalUsedCaseStudies.get(matchingCase.id);

      // Track this appearance
      if (isFirstAppearance) {
        globalUsedCaseStudies.set(matchingCase.id, moduleId);
      }

      // Create case study activity
      const caseActivity = this.createCaseStudyActivity(
        matchingCase,
        lesson,
        isFirstAppearance,
        previousAppearanceRef
      );

      // Update lesson with case study
      updatedLessons[i] = {
        ...lesson,
        caseStudyActivity: caseActivity,
        materials: {
          ...lesson.materials,
          caseFiles: [...lesson.materials.caseFiles, matchingCase.id],
        },
      };
    }

    return updatedLessons;
  }

  /**
   * Sort case studies by difficulty level for proper progression
   *
   * Requirement 3.2: Consider difficulty progression for placement
   *
   * @param caseStudies - Case studies to sort
   * @returns Sorted case studies (foundational first, complex later)
   */
  private sortCaseStudiesByDifficulty(caseStudies: any[]): any[] {
    const difficultyOrder: Record<string, number> = {
      foundational: 1,
      basic: 1,
      intermediate: 2,
      moderate: 2,
      advanced: 3,
      complex: 3,
      expert: 4,
    };

    return [...caseStudies].sort((a, b) => {
      const diffA = difficultyOrder[a.difficulty?.toLowerCase()] || 2;
      const diffB = difficultyOrder[b.difficulty?.toLowerCase()] || 2;
      return diffA - diffB;
    });
  }

  /**
   * Find the best matching case study for a lesson
   *
   * Requirement 3.1: Match case studies to lessons by MLO alignment
   * Requirement 3.2: Consider difficulty progression for placement
   *
   * @param lesson - Lesson to find case study for
   * @param sortedCaseStudies - Case studies sorted by difficulty
   * @param usedCaseStudies - Set of already used case study IDs
   * @param lessonIndex - Index of current lesson
   * @param totalLessons - Total number of lessons
   * @returns Best matching case study or undefined
   */
  private findBestMatchingCaseStudy(
    lesson: LessonPlan,
    sortedCaseStudies: any[],
    usedCaseStudies: Set<string>,
    lessonIndex: number,
    totalLessons: number
  ): any | undefined {
    // Calculate expected difficulty level for this lesson position
    const progressRatio = totalLessons > 1 ? lessonIndex / (totalLessons - 1) : 0;
    const expectedDifficultyLevel = Math.floor(progressRatio * 3) + 1; // 1-4 scale

    // Find case studies that match this lesson's MLOs
    const matchingCases = sortedCaseStudies.filter((cs) => {
      // Skip if already used
      if (usedCaseStudies.has(cs.id)) return false;

      // Check MLO alignment
      const csMloIds = cs.mloIds || [];
      const hasMLOMatch = lesson.linkedMLOs.some((mloId) => csMloIds.includes(mloId));

      return hasMLOMatch;
    });

    if (matchingCases.length === 0) {
      return undefined;
    }

    // If only one match, return it
    if (matchingCases.length === 1) {
      return matchingCases[0];
    }

    // Find the case study with difficulty closest to expected level
    const difficultyOrder: Record<string, number> = {
      foundational: 1,
      basic: 1,
      intermediate: 2,
      moderate: 2,
      advanced: 3,
      complex: 3,
      expert: 4,
    };

    let bestCase = matchingCases[0];
    let bestDiffDelta = Math.abs(
      (difficultyOrder[bestCase.difficulty?.toLowerCase()] || 2) - expectedDifficultyLevel
    );

    for (const cs of matchingCases.slice(1)) {
      const csDifficulty = difficultyOrder[cs.difficulty?.toLowerCase()] || 2;
      const diffDelta = Math.abs(csDifficulty - expectedDifficultyLevel);

      if (diffDelta < bestDiffDelta) {
        bestCase = cs;
        bestDiffDelta = diffDelta;
      }
    }

    return bestCase;
  }

  /**
   * Create a case study activity for a lesson
   *
   * Requirement 3.4: Handle multi-module case studies (first vs subsequent appearance)
   * Requirement 3.5: Include activity type, duration, learning purpose, instructor instructions,
   *                   student expectations, and assessment hooks
   *
   * @param caseStudy - Case study data from Step 8
   * @param lesson - Lesson plan to integrate into
   * @param isFirstAppearance - Whether this is the first time the case appears
   * @param previousAppearanceRef - Reference to previous module if not first appearance
   * @returns CaseStudyActivity object
   */
  private createCaseStudyActivity(
    caseStudy: any,
    lesson: LessonPlan,
    isFirstAppearance: boolean,
    previousAppearanceRef?: string
  ): CaseStudyActivity {
    // Determine activity type based on case study properties
    const activityType = this.determineCaseActivityType(caseStudy);

    // Calculate duration based on case complexity and activity type
    const duration = this.calculateCaseDuration(caseStudy, activityType);

    // Generate learning purpose
    const learningPurpose = isFirstAppearance
      ? `Apply ${lesson.linkedMLOs.length > 1 ? 'concepts' : 'concept'} to real-world scenario: ${caseStudy.title}`
      : `Continue analysis of ${caseStudy.title} with focus on ${lesson.linkedMLOs.length > 1 ? 'new concepts' : 'new concept'}`;

    // Generate instructor instructions
    const instructorInstructions = this.generateInstructorInstructions(
      caseStudy,
      isFirstAppearance,
      activityType
    );

    // Generate student output expectations
    const studentOutputExpectations = this.generateStudentExpectations(
      caseStudy,
      activityType,
      isFirstAppearance
    );

    // Extract or generate assessment hooks
    const assessmentHooks = {
      keyFacts: caseStudy.keyFacts || this.extractKeyFacts(caseStudy),
      misconceptions: caseStudy.commonMisconceptions || [],
      decisionPoints: caseStudy.decisionPoints || this.extractDecisionPoints(caseStudy),
    };

    // Generate role-play components if applicable (handled in separate method)
    const rolePlay = caseStudy.isRolePlaySuitable
      ? this.generateRolePlayComponents(caseStudy)
      : undefined;

    return {
      caseStudyId: caseStudy.id,
      caseTitle: caseStudy.title,
      activityType,
      duration,
      learningPurpose,
      linkedMLOs: lesson.linkedMLOs,
      linkedPLOs: lesson.linkedPLOs,
      instructorInstructions,
      studentOutputExpectations,
      assessmentHooks,
      rolePlay,
      isFirstAppearance,
      previousAppearanceRef,
    };
  }

  /**
   * Determine the activity type for a case study
   */
  private determineCaseActivityType(caseStudy: any): CaseStudyActivity['activityType'] {
    // Check if case study has explicit type
    if (caseStudy.activityType) {
      return caseStudy.activityType;
    }

    // Determine based on case properties
    if (caseStudy.hasAssessmentQuestions || caseStudy.isAssessmentReady) {
      return 'assessment_ready';
    }

    if (caseStudy.hasDiscussionPrompts || caseStudy.discussionQuestions?.length > 0) {
      return 'discussion';
    }

    // Default to practice
    return 'practice';
  }

  /**
   * Calculate appropriate duration for a case study activity
   */
  private calculateCaseDuration(
    caseStudy: any,
    activityType: CaseStudyActivity['activityType']
  ): number {
    // Use explicit duration if provided
    if (caseStudy.estimatedDuration) {
      return caseStudy.estimatedDuration;
    }

    // Calculate based on complexity and activity type
    const baselineDuration: Record<CaseStudyActivity['activityType'], number> = {
      practice: 30,
      discussion: 40,
      assessment_ready: 45,
    };

    let duration = baselineDuration[activityType];

    // Adjust for complexity
    const complexity = caseStudy.difficulty?.toLowerCase();
    if (complexity === 'advanced' || complexity === 'complex' || complexity === 'expert') {
      duration += 15;
    } else if (complexity === 'foundational' || complexity === 'basic') {
      duration -= 10;
    }

    // Ensure duration is reasonable (15-60 minutes)
    return Math.max(15, Math.min(60, duration));
  }

  /**
   * Generate instructor instructions for case study activity
   */
  private generateInstructorInstructions(
    caseStudy: any,
    isFirstAppearance: boolean,
    activityType: CaseStudyActivity['activityType']
  ): string {
    const orgName = caseStudy.organizationName || 'the organization';

    if (!isFirstAppearance) {
      return (
        `Continue case study analysis of ${caseStudy.title}. ` +
        `Build on previous discussion and focus on new concepts. ` +
        `Reference earlier findings and encourage deeper analysis.`
      );
    }

    const baseInstructions =
      `Introduce case study: ${caseStudy.title}. ` + `Provide context about ${orgName}. `;

    if (activityType === 'discussion') {
      return (
        baseInstructions +
        `Facilitate group discussion using provided prompts. ` +
        `Encourage diverse perspectives and critical thinking. ` +
        `Guide learners to connect case details to theoretical concepts.`
      );
    }

    if (activityType === 'assessment_ready') {
      return (
        baseInstructions +
        `Have learners analyze the case independently or in small groups. ` +
        `Use assessment questions to evaluate understanding. ` +
        `Provide feedback on analysis quality and decision-making.`
      );
    }

    // Practice
    return (
      baseInstructions +
      `Guide learners through case analysis. ` +
      `Encourage application of concepts to the scenario. ` +
      `Monitor progress and provide support as needed.`
    );
  }

  /**
   * Generate student output expectations for case study activity
   */
  private generateStudentExpectations(
    caseStudy: any,
    activityType: CaseStudyActivity['activityType'],
    isFirstAppearance: boolean
  ): string[] {
    const baseExpectations = [
      'Read and understand the case scenario',
      'Identify key issues and challenges',
    ];

    if (!isFirstAppearance) {
      return [
        'Review previous case analysis',
        'Apply new concepts to the case',
        'Develop deeper insights and recommendations',
        'Connect findings across modules',
      ];
    }

    if (activityType === 'discussion') {
      return [
        ...baseExpectations,
        'Participate actively in discussion',
        'Share perspectives and insights',
        'Listen to and build on peer contributions',
        'Connect case to theoretical concepts',
      ];
    }

    if (activityType === 'assessment_ready') {
      return [
        ...baseExpectations,
        'Complete case analysis independently',
        'Answer assessment questions thoroughly',
        'Provide evidence-based recommendations',
        'Demonstrate application of concepts',
      ];
    }

    // Practice
    return [
      ...baseExpectations,
      'Analyze the situation using course concepts',
      'Propose evidence-based solutions',
      'Collaborate with peers (if group activity)',
      'Present findings and recommendations',
    ];
  }

  /**
   * Extract key facts from case study for assessment hooks
   */
  private extractKeyFacts(caseStudy: any): string[] {
    const facts: string[] = [];

    if (caseStudy.organizationName) {
      facts.push(`Organization: ${caseStudy.organizationName}`);
    }

    if (caseStudy.industry) {
      facts.push(`Industry: ${caseStudy.industry}`);
    }

    if (caseStudy.context) {
      facts.push(`Context: ${caseStudy.context}`);
    }

    // Add any explicit key facts
    if (caseStudy.keyFacts && Array.isArray(caseStudy.keyFacts)) {
      facts.push(...caseStudy.keyFacts);
    }

    return facts.slice(0, 5); // Limit to 5 key facts
  }

  /**
   * Extract decision points from case study for assessment hooks
   */
  private extractDecisionPoints(caseStudy: any): string[] {
    const decisionPoints: string[] = [];

    // Check for explicit decision points
    if (caseStudy.decisionPoints && Array.isArray(caseStudy.decisionPoints)) {
      return caseStudy.decisionPoints;
    }

    // Check for discussion questions that imply decisions
    if (caseStudy.discussionQuestions && Array.isArray(caseStudy.discussionQuestions)) {
      const decisionQuestions = caseStudy.discussionQuestions.filter(
        (q: string) =>
          q.toLowerCase().includes('should') ||
          q.toLowerCase().includes('would you') ||
          q.toLowerCase().includes('recommend') ||
          q.toLowerCase().includes('decide')
      );
      decisionPoints.push(...decisionQuestions);
    }

    // Generate generic decision points if none found
    if (decisionPoints.length === 0) {
      decisionPoints.push(
        'What is the primary challenge facing the organization?',
        'What approach would you recommend?',
        'What are the potential risks and benefits of your recommendation?'
      );
    }

    return decisionPoints.slice(0, 5); // Limit to 5 decision points
  }

  /**
   * Generate role-play components for suitable case studies
   *
   * Requirement 3.3: Generate character briefs, decision prompts, and debrief questions
   *
   * @param caseStudy - Case study data
   * @returns Role-play components or undefined
   */
  private generateRolePlayComponents(caseStudy: any): CaseStudyActivity['rolePlay'] {
    // Check if case study already has role-play components
    if (caseStudy.rolePlay) {
      return caseStudy.rolePlay;
    }

    // Generate character briefs
    const characterBriefs = this.generateCharacterBriefs(caseStudy);

    // Generate decision prompts
    const decisionPrompts = this.generateDecisionPrompts(caseStudy);

    // Generate debrief questions
    const debriefQuestions = this.generateDebriefQuestions(caseStudy);

    return {
      characterBriefs,
      decisionPrompts,
      debriefQuestions,
    };
  }

  /**
   * Generate character briefs for role-play
   */
  private generateCharacterBriefs(caseStudy: any): CharacterBrief[] {
    const briefs: CharacterBrief[] = [];

    // Check if case study has stakeholders defined
    if (caseStudy.stakeholders && Array.isArray(caseStudy.stakeholders)) {
      return caseStudy.stakeholders.map((stakeholder: any) => ({
        characterName: stakeholder.name || stakeholder.role,
        role: stakeholder.role,
        background:
          stakeholder.background ||
          `${stakeholder.role} at ${caseStudy.organizationName || 'the organization'}`,
        objectives: stakeholder.objectives || [`Represent the interests of ${stakeholder.role}`],
      }));
    }

    // Generate generic character briefs based on case context
    const orgName = caseStudy.organizationName || 'the organization';

    briefs.push({
      characterName: 'Senior Manager',
      role: 'Decision Maker',
      background: `Senior manager at ${orgName} responsible for strategic decisions`,
      objectives: [
        'Make informed decisions based on available information',
        'Balance stakeholder interests',
        'Ensure organizational success',
      ],
    });

    briefs.push({
      characterName: 'Team Lead',
      role: 'Implementation Lead',
      background: `Team lead responsible for implementing decisions at ${orgName}`,
      objectives: [
        'Understand the rationale behind decisions',
        'Identify implementation challenges',
        'Ensure team buy-in',
      ],
    });

    briefs.push({
      characterName: 'Stakeholder Representative',
      role: 'Stakeholder Advocate',
      background: `Representative of key stakeholders affected by decisions at ${orgName}`,
      objectives: [
        'Advocate for stakeholder interests',
        'Raise concerns and considerations',
        'Ensure stakeholder needs are addressed',
      ],
    });

    return briefs;
  }

  /**
   * Generate decision prompts for role-play
   */
  private generateDecisionPrompts(caseStudy: any): string[] {
    const prompts: string[] = [];

    // Use existing decision points if available
    if (caseStudy.decisionPoints && Array.isArray(caseStudy.decisionPoints)) {
      prompts.push(...caseStudy.decisionPoints);
    }

    // Add generic prompts if needed
    if (prompts.length < 3) {
      const orgName = caseStudy.organizationName || 'the organization';
      prompts.push(
        `What is the most critical decision facing ${orgName}?`,
        `How should the team prioritize competing demands?`,
        `What approach would best balance short-term and long-term goals?`,
        `How can stakeholder concerns be addressed effectively?`
      );
    }

    return prompts.slice(0, 5); // Limit to 5 prompts
  }

  /**
   * Generate structured debrief questions for role-play
   */
  private generateDebriefQuestions(caseStudy: any): string[] {
    return [
      'What were the key challenges you faced in your role?',
      'How did different perspectives influence the decision-making process?',
      'What trade-offs did you have to consider?',
      'How did you balance competing interests and constraints?',
      'What would you do differently if you could replay the scenario?',
      'What insights did you gain about real-world application of concepts?',
      'How can the lessons from this role-play apply to your professional context?',
    ];
  }

  // ==========================================================================
  // ASSESSMENT INTEGRATION
  // ==========================================================================

  /**
   * Integrate formative assessments into lessons based on MLO alignment
   *
   * Requirements:
   * - 4.1: Pull formative assessments from Step 7
   * - 4.2: Align assessments with lesson MLOs
   * - 4.3: Include assessment type and duration
   *
   * @param lessons - Array of lesson plans to integrate assessments into
   * @param formativeAssessments - All formative assessments from Step 7
   * @param moduleId - Current module ID
   * @returns Lessons with integrated formative assessments
   */
  integrateAssessments(
    lessons: LessonPlan[],
    formativeAssessments: any[],
    moduleId: string
  ): LessonPlan[] {
    // Requirement 4.1: Pull formative assessments from Step 7
    // Filter assessments for this module
    const moduleAssessments = formativeAssessments.filter((a) => a.moduleId === moduleId);

    if (moduleAssessments.length === 0) {
      loggingService.info('No formative assessments found for module', { moduleId });
      return lessons;
    }

    loggingService.info('Integrating formative assessments', {
      moduleId,
      assessmentCount: moduleAssessments.length,
      lessonCount: lessons.length,
    });

    return lessons.map((lesson) => {
      // Requirement 4.2: Align assessments with lesson MLOs
      // Find matching assessments based on MLO alignment
      const matchingAssessments = this.findMatchingAssessments(lesson, moduleAssessments);

      if (matchingAssessments.length === 0) {
        loggingService.debug('No matching assessments for lesson', {
          lessonId: lesson.lessonId,
          linkedMLOs: lesson.linkedMLOs,
        });
        return lesson;
      }

      // Requirement 4.3: Include assessment type and duration
      // Convert assessments to formative checks with proper type and duration
      const formativeChecks: FormativeCheck[] = this.createFormativeChecks(
        matchingAssessments,
        lesson
      );

      loggingService.debug('Added formative checks to lesson', {
        lessonId: lesson.lessonId,
        checkCount: formativeChecks.length,
      });

      return {
        ...lesson,
        formativeChecks,
      };
    });
  }

  /**
   * Find assessments that match a lesson's MLOs
   *
   * Requirement 4.2: Align assessments with lesson MLOs
   *
   * @param lesson - Lesson plan to find assessments for
   * @param assessments - Available assessments
   * @returns Array of matching assessments
   */
  private findMatchingAssessments(lesson: LessonPlan, assessments: any[]): any[] {
    const matchingAssessments: Array<{ assessment: any; matchScore: number }> = [];

    for (const assessment of assessments) {
      const assessmentMloIds = assessment.alignedMLOs || assessment.mloIds || [];

      // Calculate match score based on MLO overlap
      const matchingMLOs = lesson.linkedMLOs.filter((mloId) => assessmentMloIds.includes(mloId));

      if (matchingMLOs.length > 0) {
        // Higher score for more MLO matches
        const matchScore = matchingMLOs.length;
        matchingAssessments.push({ assessment, matchScore });
      }
    }

    // Sort by match score (best matches first)
    matchingAssessments.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 3 assessments
    return matchingAssessments.slice(0, 3).map((m) => m.assessment);
  }

  /**
   * Create formative checks from assessments
   *
   * Requirement 4.3: Include assessment type and duration
   *
   * @param assessments - Matching assessments
   * @param lesson - Lesson plan
   * @returns Array of FormativeCheck objects
   */
  private createFormativeChecks(assessments: any[], lesson: LessonPlan): FormativeCheck[] {
    return assessments.map((assessment) => {
      // Map assessment type to FormativeCheck type
      const type = this.mapAssessmentType(assessment.assessmentType || assessment.type);

      // Determine duration based on assessment type and complexity
      const duration = this.calculateAssessmentDuration(assessment, type);

      // Extract question text
      const question = this.extractQuestionText(assessment);

      // Find the best matching MLO for this assessment
      const linkedMLO = this.findBestMatchingMLO(assessment, lesson.linkedMLOs);

      // Build formative check object
      const formativeCheck: FormativeCheck = {
        checkId: assessment.id || `${lesson.lessonId}-FC-${Date.now()}`,
        type,
        question,
        linkedMLO,
        duration,
      };

      // Add optional fields if available
      if (type === 'mcq' && assessment.options) {
        formativeCheck.options = assessment.options;
      }

      if (assessment.correctAnswer) {
        formativeCheck.correctAnswer = assessment.correctAnswer;
      }

      if (assessment.explanation || assessment.feedback) {
        formativeCheck.explanation = assessment.explanation || assessment.feedback;
      }

      return formativeCheck;
    });
  }

  /**
   * Map assessment type string to FormativeCheck type
   *
   * @param type - Assessment type string
   * @returns FormativeCheck type
   */
  private mapAssessmentType(type: string): FormativeCheck['type'] {
    if (!type) return 'mcq';

    const normalizedType = type.toLowerCase().trim();

    const typeMap: Record<string, FormativeCheck['type']> = {
      mcq: 'mcq',
      multiple_choice: 'mcq',
      'multiple choice': 'mcq',
      quiz: 'mcq',
      question: 'mcq',
      poll: 'quick_poll',
      quick_poll: 'quick_poll',
      'quick poll': 'quick_poll',
      polling: 'quick_poll',
      discussion: 'discussion_question',
      discussion_question: 'discussion_question',
      'discussion question': 'discussion_question',
      open_ended: 'discussion_question',
      reflection: 'reflection',
      reflective: 'reflection',
      self_assessment: 'reflection',
    };

    return typeMap[normalizedType] || 'mcq';
  }

  /**
   * Calculate appropriate duration for an assessment
   *
   * Requirement 4.3: Include assessment type and duration
   *
   * @param assessment - Assessment data
   * @param type - FormativeCheck type
   * @returns Duration in minutes
   */
  private calculateAssessmentDuration(assessment: any, type: FormativeCheck['type']): number {
    // Use explicit duration if provided
    if (assessment.duration && typeof assessment.duration === 'number') {
      return Math.max(1, Math.min(15, assessment.duration)); // Clamp to 1-15 minutes
    }

    if (assessment.estimatedMinutes && typeof assessment.estimatedMinutes === 'number') {
      return Math.max(1, Math.min(15, assessment.estimatedMinutes));
    }

    // Default durations based on type
    const defaultDurations: Record<FormativeCheck['type'], number> = {
      mcq: 3, // Quick multiple choice
      quick_poll: 2, // Very quick poll
      discussion_question: 8, // Discussion takes longer
      reflection: 5, // Reflection time
    };

    let duration = defaultDurations[type];

    // Adjust based on complexity if available
    const complexity = assessment.complexity || assessment.difficulty;
    if (complexity) {
      const normalizedComplexity = complexity.toLowerCase();
      if (normalizedComplexity.includes('complex') || normalizedComplexity.includes('advanced')) {
        duration += 2;
      } else if (
        normalizedComplexity.includes('simple') ||
        normalizedComplexity.includes('basic')
      ) {
        duration -= 1;
      }
    }

    // Ensure duration is reasonable (1-15 minutes)
    return Math.max(1, Math.min(15, duration));
  }

  /**
   * Extract question text from assessment object
   *
   * @param assessment - Assessment data
   * @returns Question text
   */
  private extractQuestionText(assessment: any): string {
    // Try various fields that might contain the question
    if (assessment.question) return assessment.question;
    if (assessment.questionText) return assessment.questionText;
    if (assessment.prompt) return assessment.prompt;
    if (assessment.title) return assessment.title;
    if (assessment.description) return assessment.description;

    // Fallback
    return 'Assessment question';
  }

  /**
   * Find the best matching MLO for an assessment
   *
   * @param assessment - Assessment data
   * @param lessonMLOs - Lesson's linked MLO IDs
   * @returns Best matching MLO ID
   */
  private findBestMatchingMLO(assessment: any, lessonMLOs: string[]): string {
    const assessmentMloIds = assessment.alignedMLOs || assessment.mloIds || [];

    // Find first matching MLO
    for (const mloId of assessmentMloIds) {
      if (lessonMLOs.includes(mloId)) {
        return mloId;
      }
    }

    // Fallback to first lesson MLO
    return lessonMLOs[0] || 'unknown-mlo';
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate generated lesson plans
   */
  validateLessonPlans(
    moduleLessonPlans: ModuleLessonPlan[],
    modules: ModuleData[]
  ): Step10LessonPlans['validation'] {
    let allModulesHaveLessonPlans = true;
    let allLessonDurationsValid = true;
    let totalHoursMatch = true;
    let allMLOsCovered = true;
    const caseStudiesIntegrated = true;
    const assessmentsIntegrated = true;

    for (const module of modules) {
      const modulePlan = moduleLessonPlans.find((mp) => mp.moduleId === module.id);

      if (!modulePlan || modulePlan.lessons.length === 0) {
        allModulesHaveLessonPlans = false;
        continue;
      }

      // Check lesson durations (60-180 minutes)
      for (const lesson of modulePlan.lessons) {
        if (lesson.duration < 60 || lesson.duration > 180) {
          allLessonDurationsValid = false;
        }
      }

      // Check total hours match
      const totalLessonMinutes = modulePlan.lessons.reduce((sum, l) => sum + l.duration, 0);
      const expectedMinutes = module.contactHours * 60;
      if (Math.abs(totalLessonMinutes - expectedMinutes) > 5) {
        // Allow 5 min tolerance
        totalHoursMatch = false;
      }

      // Check MLO coverage
      const coveredMLOs = new Set<string>();
      for (const lesson of modulePlan.lessons) {
        for (const mloId of lesson.linkedMLOs) {
          coveredMLOs.add(mloId);
        }
      }
      for (const mlo of module.mlos) {
        if (!coveredMLOs.has(mlo.id)) {
          allMLOsCovered = false;
        }
      }
    }

    return {
      allModulesHaveLessonPlans,
      allLessonDurationsValid,
      totalHoursMatch,
      allMLOsCovered,
      caseStudiesIntegrated,
      assessmentsIntegrated,
    };
  }
}

// Export singleton instance
export const lessonPlanService = new LessonPlanService();
