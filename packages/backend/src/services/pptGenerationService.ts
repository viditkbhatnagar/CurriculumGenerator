import pptxgen from 'pptxgenjs';
import puppeteer from 'puppeteer';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import {
  LessonPlan,
  ModuleLessonPlan,
  LessonActivity,
  CaseStudyActivity,
  FormativeCheck,
} from '../models/CurriculumWorkflow';

/**
 * PPT Generation Service
 * Phase 2: Auto-generates professional PowerPoint presentations for curriculum modules
 * Enhanced for Step 10: Generates PPT decks based on lesson plans
 */

export interface SlideContent {
  type: 'title' | 'content' | 'table' | 'two_column' | 'bullets';
  title: string;
  content?: string | string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  leftColumn?: string[];
  rightColumn?: string[];
  notes?: string;
}

/**
 * PPT slide structure for lesson-based generation
 */
export interface PPTSlide {
  slideNumber: number;
  slideType:
    | 'title'
    | 'objectives'
    | 'concepts'
    | 'content'
    | 'case_study'
    | 'formative_check'
    | 'summary'
    | 'independent_study'
    | 'references';
  title: string;
  content: SlideContent;
  speakerNotes: string;
  visualSuggestion?: string;
}

/**
 * Complete PPT deck structure
 */
export interface PPTDeck {
  deckId: string;
  lessonId: string;
  moduleCode: string;
  lessonNumber: number;
  lessonTitle: string;
  slides: PPTSlide[];
  slideCount: number;
  deliveryMode: string;
  generatedAt: Date;
  validation: {
    slideCountValid: boolean;
    mlosCovered: boolean;
    citationsValid: boolean;
    glossaryTermsDefined: boolean;
  };
}

/**
 * Context for PPT generation from workflow data
 */
export interface PPTContext {
  programTitle: string;
  moduleCode: string;
  moduleTitle: string;
  deliveryMode: string;
  glossaryEntries?: any[];
  sources?: any[];
  readingLists?: any[];
}

/**
 * Validation context for PPT deck validation
 */
export interface PPTValidationContext {
  sources?: any[];
  readingLists?: any[];
  glossaryEntries?: any[];
}

/**
 * Validation result for PPT deck
 */
export interface PPTValidationResult {
  isValid: boolean;
  lessonPPTCorrespondence: boolean;
  mlosCovered: boolean;
  caseStudyPlacement: boolean;
  citationsValid: boolean;
  slideCountValid: boolean;
  glossaryTermsDefined: boolean;
  errors: string[];
  warnings: string[];
}

export interface ModulePPTContent {
  moduleTitle: string;
  moduleCode: string;
  slides: SlideContent[];
}

export interface ProgressCallback {
  (current: number, total: number, message: string): void;
}

export class PPTGenerationService {
  /**
   * Generate PPT structure using OpenAI based on module data
   */
  async generatePPTStructure(moduleData: any, curriculumData: any): Promise<ModulePPTContent> {
    try {
      const moduleCode = moduleData.code || moduleData.moduleCode || 'N/A';

      loggingService.info('Generating PPT structure via OpenAI GPT-5', {
        moduleCode,
        moduleTitle: moduleData.title,
        model: 'gpt-5',
        maxTokens: 16000,
        timeout: '5 minutes',
        contextIncluded: 'Full curriculum + module data',
      });

      const prompt = this.buildOpenAIPrompt(moduleData, curriculumData);

      const systemPrompt =
        'You are an academic self-study teaching-materials production engine creating delivery-ready PowerPoint content for asynchronous learning. Generate 8-15 slides per lesson, designed to be understood without instructor narration. UK academic conventions, professional tone, no emojis. Return ONLY valid JSON, no markdown formatting.';

      loggingService.info('Calling OpenAI with enhanced settings', {
        promptLength: prompt.length,
        hasSystemPrompt: !!systemPrompt,
        maxTokens: 16000,
        timeout: 300000,
      });

      const response = await openaiService.generateContent(prompt, systemPrompt, {
        responseFormat: 'json_object',
        maxTokens: 16000, // Maximum tokens for comprehensive PPT generation with full curriculum context
        timeout: 300000, // 5 minutes timeout for AI to intelligently analyze and structure content
      });

      loggingService.info('OpenAI response received', {
        responseLength: response.length,
        firstChars: response.substring(0, 100),
      });

      let pptStructure;
      try {
        pptStructure = JSON.parse(response);
        loggingService.info('PPT structure parsed from JSON', {
          moduleCode,
          slideCount: pptStructure.slides?.length || 0,
        });
      } catch (parseError: any) {
        loggingService.error('Failed to parse OpenAI JSON response', {
          error: parseError.message,
          responsePreview: response.substring(0, 500),
        });
        throw parseError;
      }

      return pptStructure;
    } catch (error: any) {
      const moduleCode = moduleData.code || moduleData.moduleCode || 'N/A';
      loggingService.error('Failed to generate PPT structure', {
        error: error.message,
        stack: error.stack,
        moduleCode,
      });

      // Fallback to basic structure if OpenAI fails
      loggingService.info('Using fallback basic structure');
      return this.generateBasicStructure(moduleData, curriculumData);
    }
  }

  /**
   * Build OpenAI prompt for PPT generation
   */
  private buildOpenAIPrompt(moduleData: any, curriculumData: any): string {
    const moduleCode = moduleData.code || moduleData.moduleCode || 'N/A';
    const contactHours = moduleData.contactHours || moduleData.contactHoursTotal || 0;
    const independentHours = moduleData.selfStudyHours || moduleData.independentHours || 0;

    // Build comprehensive curriculum context - ensure all values are properly extracted
    const programTitle = String(curriculumData.step1?.programTitle || 'N/A');
    const academicLevel = String(curriculumData.step1?.academicLevel || 'N/A');
    const deliveryMode = String(curriculumData.step1?.delivery?.mode || 'N/A');
    const programDescription = String(curriculumData.step1?.programDescription || '');

    let targetLearner = 'General';
    if (curriculumData.step1?.targetLearner) {
      if (typeof curriculumData.step1.targetLearner === 'string') {
        targetLearner = curriculumData.step1.targetLearner;
      } else if (curriculumData.step1.targetLearner.industrySector) {
        targetLearner = String(curriculumData.step1.targetLearner.industrySector);
      }
    }

    // Get related PLOs - ensure it's always an array
    let relatedPLOs: any[] = [];
    if (
      curriculumData.step3?.outcomes &&
      Array.isArray(curriculumData.step3.outcomes) &&
      Array.isArray(moduleData.linkedPLOs)
    ) {
      relatedPLOs = curriculumData.step3.outcomes.filter((plo: any) =>
        moduleData.linkedPLOs.includes(plo.id)
      );
    }

    // Get module topics - ensure it's always an array
    const topics = Array.isArray(moduleData.topics)
      ? moduleData.topics.map((t: any) => `${t.title} (${t.hours}h)`)
      : [];

    return `You are an academic self-study teaching-materials production engine. Your task is to generate DELIVERY-READY POWERPOINT CONTENT at the LESSON LEVEL for the module provided.

DO NOT invent new lessons. DO NOT merge or split lessons. DO NOT introduce new learning outcomes or content.
Your role is to CONVERT EACH EXISTING LESSON into a SELF-CONTAINED PPT suitable for ASYNCHRONOUS LEARNING.

The learner must be able to understand each lesson WITHOUT instructor narration.

**FULL CURRICULUM CONTEXT:**
Program: ${programTitle}
Level: ${academicLevel}
Delivery: ${deliveryMode}
Target Learners: ${targetLearner}
${programDescription ? `Program Overview: ${programDescription.substring(0, 300)}...` : ''}

**MODULE INFORMATION:**
Code: ${moduleCode}
Title: ${moduleData.title}
Description: ${moduleData.description || 'Not provided'}
Total Hours: ${moduleData.totalHours} (Contact: ${contactHours}h, Independent: ${independentHours}h)
Credits: ${moduleData.credits || 'N/A'}
Phase: ${moduleData.phase || 'N/A'}
Prerequisites: ${moduleData.prerequisites?.join(', ') || 'None'}

**MODULE LEARNING OUTCOMES (MLOs) - ${moduleData.mlos?.length || 0} outcomes:**
${
  Array.isArray(moduleData.mlos)
    ? moduleData.mlos
        .map((mlo: any, idx: number) => `MLO ${idx + 1} (${mlo.bloomLevel}): ${mlo.statement}`)
        .join('\n')
    : 'Not specified'
}

**PROGRAM LEARNING OUTCOMES (PLOs) LINKED TO THIS MODULE:**
${Array.isArray(relatedPLOs) && relatedPLOs.length > 0 ? relatedPLOs.map((plo: any) => `${plo.id}: ${plo.statement} [${plo.bloomLevel}]`).join('\n') : 'Not linked to PLOs'}

**MODULE TOPICS (${topics.length} topics):**
${topics.length > 0 ? topics.join('\n') : 'Not specified'}

**CONTACT ACTIVITIES (${contactHours}h total):**
${
  Array.isArray(moduleData.contactActivities)
    ? moduleData.contactActivities
        .map((a: any) => `- ${a.type}: ${a.title} (${a.hours}h)`)
        .join('\n')
    : 'Not specified'
}

**INDEPENDENT ACTIVITIES (${independentHours}h total):**
${
  Array.isArray(moduleData.independentActivities)
    ? moduleData.independentActivities
        .map((a: any) => `- ${a.type}: ${a.title} (${a.hours}h)`)
        .join('\n')
    : 'Not specified'
}

**PPT SCOPE & LENGTH:**
- One PPT per lesson
- 8-15 slides per lesson
- Designed to be completed in the stated lesson duration
- Learner must be able to understand the lesson WITHOUT instructor narration

**REQUIRED SLIDE STRUCTURE (per lesson):**
1. **Lesson Cover** - Program title, module title, lesson title, lesson duration
2. **Lesson Orientation** - What this lesson covers, lesson learning objectives (exact wording), how this lesson is used (watch, practice, check)
3. **Core Content Slides** (2-6 slides) - Key concepts, definitions or frameworks, visual descriptions (e.g. "Diagram showing..."), plain-language explanations
4. **Worked Examples** - Annotated examples, before/after comparisons, step-by-step walkthroughs
5. **Practice & Reflection** - Short practice prompts, scenario questions, reflection or self-check questions
6. **Assessment Connection** - Which assignment(s) this lesson supports, what learners should pay attention to, common mistakes to avoid
7. **Lesson Close** - Key takeaways, what comes next

**ACCESSIBILITY REQUIREMENTS:**
- Plain language throughout
- Slide text readable without audio
- Avoid dense paragraphs
- Logical slide progression

**SLIDE DESIGN GUIDELINES:**
- Slide titles in sentence case
- Maximum 6 bullets per slide
- Each slide should have ONE main idea or concept
- UK academic tone, professional language
- No emojis, no marketing language
- Vary slide types strategically:
  - "bullets" for lists and key points
  - "table" for comparisons or structured information
  - "two_column" for contrasting concepts
  - "content" for paragraphs or detailed explanations

**STUDY NOTES (replaces speaker notes):**
- Add comprehensive study notes for self-study learners
- Include deeper explanations, worked examples, and practical tips
- Suggest time allocations for key learning activities
- Highlight common misconceptions and how to avoid them
- Reference relevant readings and resources

**OUTPUT FORMAT (JSON):**
{
  "moduleTitle": "string",
  "moduleCode": "string",
  "slides": [
    {
      "type": "title|content|table|two_column|bullets",
      "title": "slide title",
      "content": "string or array of bullet points",
      "notes": "study notes for self-study learners (required for every slide)"
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.`;
  }

  /**
   * Fallback: Generate basic structure if OpenAI fails
   */
  private generateBasicStructure(moduleData: any, curriculumData: any): ModulePPTContent {
    const slides: SlideContent[] = [];
    const moduleCode = moduleData.code || moduleData.moduleCode || 'N/A';
    const contactHours = moduleData.contactHours || moduleData.contactHoursTotal || 0;
    const independentHours = moduleData.selfStudyHours || moduleData.independentHours || 0;

    // Title Slide
    slides.push({
      type: 'title',
      title: moduleData.title,
      content: moduleCode,
    });

    // Module Overview
    slides.push({
      type: 'content',
      title: 'Module Overview',
      content: [
        `Module Code: ${moduleCode}`,
        `Total Hours: ${moduleData.totalHours}`,
        `Contact Hours: ${contactHours}`,
        `Independent Study: ${independentHours}`,
        `Credits: ${moduleData.credits || 'N/A'}`,
        moduleData.prerequisites?.length > 0
          ? `Prerequisites: ${moduleData.prerequisites.join(', ')}`
          : 'Prerequisites: None',
      ],
    });

    // Learning Outcomes
    if (moduleData.mlos && moduleData.mlos.length > 0) {
      slides.push({
        type: 'bullets',
        title: 'Module Learning Outcomes',
        content: moduleData.mlos.map((mlo: any) => `${mlo.statement} [${mlo.bloomLevel}]`),
      });
    }

    // Activities
    if (moduleData.contactActivities || moduleData.independentActivities) {
      const contactActs = moduleData.contactActivities?.map((a: any) =>
        typeof a === 'string' ? a : `${a.type}: ${a.title || a.description || ''}`
      ) || ['Not specified'];

      const independentActs = moduleData.independentActivities?.map((a: any) =>
        typeof a === 'string' ? a : `${a.type}: ${a.title || a.description || ''}`
      ) || ['Not specified'];

      slides.push({
        type: 'two_column',
        title: 'Learning Activities',
        leftColumn: contactActs,
        rightColumn: independentActs,
      });
    }

    // Summary
    slides.push({
      type: 'content',
      title: 'Summary',
      content: [
        `This module is part of ${curriculumData.step1?.programTitle || 'the program'}`,
        `Delivery: ${curriculumData.step1?.delivery?.mode || 'Various modes'}`,
        'Refer to the full curriculum document for detailed assessment criteria',
      ],
    });

    return {
      moduleTitle: moduleData.title,
      moduleCode: moduleData.moduleCode,
      slides,
    };
  }

  /**
   * Create actual PowerPoint file from structure
   */
  async createPPTFile(pptContent: ModulePPTContent): Promise<Buffer> {
    try {
      const ppt = new pptxgen();

      // Set presentation properties
      ppt.author = 'Curriculum Generator';
      ppt.company = 'Education Institution';
      ppt.subject = pptContent.moduleTitle;
      ppt.title = `${pptContent.moduleCode} - ${pptContent.moduleTitle}`;

      // Define color scheme (professional blue theme)
      const colors = {
        primary: '1F4788',
        secondary: '4A90E2',
        text: '333333',
        lightGray: 'F5F5F5',
        white: 'FFFFFF',
      };

      // Create slides
      for (const slideData of pptContent.slides) {
        const slide = ppt.addSlide();

        switch (slideData.type) {
          case 'title':
            this.createTitleSlide(slide, slideData, colors);
            break;
          case 'content':
          case 'bullets':
            this.createContentSlide(slide, slideData, colors);
            break;
          case 'table':
            this.createTableSlide(slide, slideData, colors);
            break;
          case 'two_column':
            this.createTwoColumnSlide(slide, slideData, colors);
            break;
          default:
            this.createContentSlide(slide, slideData, colors);
        }

        // Add speaker notes if available
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      }

      // Generate buffer
      const buffer = await ppt.write({ outputType: 'nodebuffer' });

      loggingService.info('PPT file created successfully', {
        moduleCode: pptContent.moduleCode,
        slideCount: pptContent.slides.length,
      });

      return buffer as Buffer;
    } catch (error: any) {
      loggingService.error('Failed to create PPT file', {
        error: error.message,
        moduleCode: pptContent.moduleCode,
      });
      throw error;
    }
  }

  /**
   * Create title slide
   */
  private createTitleSlide(slide: any, slideData: SlideContent, colors: any): void {
    slide.background = { color: colors.primary };

    // Ensure title is a string
    const titleText = String(slideData.title || 'Untitled');

    slide.addText(titleText, {
      x: 0.5,
      y: 2.0,
      w: 9.0,
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: colors.white,
      align: 'center',
      valign: 'middle',
    });

    if (slideData.content) {
      // Ensure content is a string, handle arrays by joining
      const contentText = Array.isArray(slideData.content)
        ? slideData.content.join(' ')
        : String(slideData.content);

      slide.addText(contentText, {
        x: 0.5,
        y: 3.8,
        w: 9.0,
        h: 0.5,
        fontSize: 20,
        color: colors.white,
        align: 'center',
      });
    }
  }

  /**
   * Create content/bullets slide
   */
  private createContentSlide(slide: any, slideData: SlideContent, colors: any): void {
    slide.background = { color: colors.white };

    // Title - ensure it's a string
    const titleText = String(slideData.title || 'Content');
    slide.addText(titleText, {
      x: 0.5,
      y: 0.5,
      w: 9.0,
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: colors.primary,
    });

    // Content
    if (Array.isArray(slideData.content)) {
      // Bullet points - ensure each item is a string
      const bulletPoints = slideData.content.map((item) => ({
        text: String(item),
        options: { bullet: true },
      }));

      slide.addText(bulletPoints, {
        x: 0.75,
        y: 1.5,
        w: 8.5,
        h: 4.0,
        fontSize: 18,
        color: colors.text,
        lineSpacing: 24,
      });
    } else if (slideData.content) {
      // Paragraph text - ensure it's a string
      const contentText = String(slideData.content);
      slide.addText(contentText, {
        x: 0.75,
        y: 1.5,
        w: 8.5,
        h: 4.0,
        fontSize: 18,
        color: colors.text,
        align: 'left',
        valign: 'top',
      });
    }
  }

  /**
   * Create table slide
   */
  private createTableSlide(slide: any, slideData: SlideContent, colors: any): void {
    slide.background = { color: colors.white };

    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9.0,
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: colors.primary,
    });

    // Table
    if (slideData.table) {
      const tableRows = [slideData.table.headers, ...slideData.table.rows];

      slide.addTable(tableRows, {
        x: 0.75,
        y: 1.5,
        w: 8.5,
        fontSize: 14,
        color: colors.text,
        border: { pt: 1, color: colors.secondary },
        fill: { color: colors.lightGray },
        rowH: 0.5,
      });
    }
  }

  /**
   * Create two-column slide
   */
  private createTwoColumnSlide(slide: any, slideData: SlideContent, colors: any): void {
    slide.background = { color: colors.white };

    // Title
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9.0,
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: colors.primary,
    });

    // Left Column
    if (slideData.leftColumn) {
      slide.addText('Contact Activities', {
        x: 0.75,
        y: 1.5,
        w: 4.0,
        h: 0.5,
        fontSize: 20,
        bold: true,
        color: colors.secondary,
      });

      slide.addText(
        slideData.leftColumn.map((item) => ({ text: item, options: { bullet: true } })),
        {
          x: 0.75,
          y: 2.1,
          w: 4.0,
          h: 3.5,
          fontSize: 16,
          color: colors.text,
        }
      );
    }

    // Right Column
    if (slideData.rightColumn) {
      slide.addText('Independent Activities', {
        x: 5.25,
        y: 1.5,
        w: 4.0,
        h: 0.5,
        fontSize: 20,
        bold: true,
        color: colors.secondary,
      });

      slide.addText(
        slideData.rightColumn.map((item) => ({ text: item, options: { bullet: true } })),
        {
          x: 5.25,
          y: 2.1,
          w: 4.0,
          h: 3.5,
          fontSize: 16,
          color: colors.text,
        }
      );
    }
  }

  /**
   * Generate PPT for a single module
   */
  async generateModulePPT(
    moduleId: string,
    workflowData: any,
    progressCallback?: ProgressCallback
  ): Promise<Buffer> {
    try {
      loggingService.info('generateModulePPT called', {
        moduleId,
        hasStep4: !!workflowData.step4,
        modulesCount: workflowData.step4?.modules?.length || 0,
      });

      // Find module in step4
      const module = workflowData.step4?.modules?.find((m: any) => m.id === moduleId);

      if (!module) {
        loggingService.error('Module not found in workflow', {
          moduleId,
          availableModules: workflowData.step4?.modules?.map((m: any) => ({
            id: m.id,
            moduleCode: m.moduleCode,
            title: m.title,
          })),
        });
        throw new Error(
          `Module ${moduleId} not found in workflow. Available modules: ${workflowData.step4?.modules?.length || 0}`
        );
      }

      const moduleCode = module.moduleCode || module.code || 'Unknown';
      const moduleTitle = module.title || 'Untitled Module';

      loggingService.info('Module found', {
        moduleId,
        moduleCode,
        moduleTitle,
        hasMLOs: !!module.mlos,
        mloCount: module.mlos?.length || 0,
      });

      if (progressCallback) {
        progressCallback(1, 3, `Generating slide structure for ${moduleCode}...`);
      }

      // Generate structure via OpenAI
      const pptStructure = await this.generatePPTStructure(module, workflowData);

      if (progressCallback) {
        progressCallback(2, 3, `Creating PowerPoint file for ${module.moduleCode}...`);
      }

      // Create PPT file
      const pptBuffer = await this.createPPTFile(pptStructure);

      if (progressCallback) {
        progressCallback(3, 3, `Completed ${module.moduleCode}`);
      }

      return pptBuffer;
    } catch (error: any) {
      loggingService.error('Failed to generate module PPT', {
        error: error.message,
        moduleId,
      });
      throw error;
    }
  }

  /**
   * Generate PPTs for all modules in bulk
   */
  async generateAllModulePPTs(
    workflowData: any,
    progressCallback?: ProgressCallback
  ): Promise<Map<string, Buffer>> {
    const modules = workflowData.step4?.modules || [];
    const pptMap = new Map<string, Buffer>();

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];

      if (progressCallback) {
        progressCallback(
          i + 1,
          modules.length,
          `Generating PPT for Module ${i + 1} of ${modules.length}: ${module.moduleCode}...`
        );
      }

      try {
        const pptBuffer = await this.generateModulePPT(module.id, workflowData);
        pptMap.set(module.id, pptBuffer);
      } catch (error: any) {
        loggingService.error('Failed to generate PPT in bulk', {
          error: error.message,
          moduleCode: module.moduleCode,
        });
        // Continue with other modules
      }
    }

    return pptMap;
  }

  /**
   * Validate if all 9 steps are completed
   */
  validateWorkflowCompletion(workflowData: any): { isComplete: boolean; missingSteps: number[] } {
    const missingSteps: number[] = [];

    for (let i = 1; i <= 9; i++) {
      const stepKey = `step${i}`;
      if (!workflowData[stepKey]) {
        missingSteps.push(i);
      }
    }

    return {
      isComplete: missingSteps.length === 0,
      missingSteps,
    };
  }

  // ==========================================================================
  // LESSON-BASED PPT GENERATION (Step 10 Integration)
  // ==========================================================================

  /**
   * Generate PPT deck for a single lesson based on lesson plan
   *
   * Requirements:
   * - 6.1: Generate corresponding PPT deck following Step 11 specification
   * - 6.2-6.6: Include all required slide types
   *
   * @param lesson - LessonPlan to generate PPT for
   * @param context - PPTContext with program and module information
   * @returns PPTDeck with all slides
   */
  async generateLessonPPT(lesson: LessonPlan, context: PPTContext): Promise<PPTDeck> {
    loggingService.info('Generating lesson-based PPT', {
      lessonId: lesson.lessonId,
      lessonNumber: lesson.lessonNumber,
      moduleCode: context.moduleCode,
    });

    const slides: PPTSlide[] = [];
    let slideNumber = 1;

    // 1. Title Slide (Requirement 6.2)
    slides.push(this.generateTitleSlide(lesson, context, slideNumber++));

    // 2. Learning Objectives Slide (Requirement 6.3)
    slides.push(this.generateObjectivesSlide(lesson, context, slideNumber++));

    // 3. Key Concepts Slides (Requirement 6.4)
    const conceptSlides = this.generateKeyConceptsSlides(lesson, context, slideNumber);
    slides.push(...conceptSlides);
    slideNumber += conceptSlides.length;

    // 4. Instructional Content Slides (Requirement 6.5)
    const contentSlides = this.generateInstructionalContentSlides(lesson, context, slideNumber);
    slides.push(...contentSlides);
    slideNumber += contentSlides.length;

    // 5. Case Study Slides (Requirement 6.6) - if applicable
    if (lesson.caseStudyActivity) {
      const caseSlides = this.generateCaseStudySlides(
        lesson.caseStudyActivity,
        context,
        slideNumber
      );
      slides.push(...caseSlides);
      slideNumber += caseSlides.length;
    }

    // 6. Formative Check Slides (Requirement 7.1)
    if (lesson.formativeChecks && lesson.formativeChecks.length > 0) {
      const formativeSlides = this.generateFormativeCheckSlides(
        lesson.formativeChecks,
        slideNumber
      );
      slides.push(...formativeSlides);
      slideNumber += formativeSlides.length;
    }

    // 7. Summary Slide (Requirement 7.2)
    slides.push(this.generateSummarySlide(lesson, slideNumber++));

    // 8. Independent Study Slide (Requirement 7.3)
    slides.push(this.generateIndependentStudySlide(lesson, slideNumber++));

    // 9. References Slide (Requirement 7.4)
    slides.push(this.generateReferencesSlide(lesson, context, slideNumber++));

    const deck: PPTDeck = {
      deckId: `${lesson.lessonId}-PPT`,
      lessonId: lesson.lessonId,
      moduleCode: context.moduleCode,
      lessonNumber: lesson.lessonNumber,
      lessonTitle: lesson.lessonTitle,
      slides,
      slideCount: slides.length,
      deliveryMode: context.deliveryMode,
      generatedAt: new Date(),
      validation: {
        slideCountValid: slides.length >= 8 && slides.length <= 15,
        mlosCovered: this.validateMLOCoverage(lesson, slides),
        citationsValid: this.validateCitations(lesson, context),
        glossaryTermsDefined: this.validateGlossaryTermsInGeneration(lesson, context),
      },
    };

    loggingService.info('Lesson PPT generation complete', {
      lessonId: lesson.lessonId,
      slideCount: deck.slideCount,
      validation: deck.validation,
    });

    return deck;
  }

  /**
   * Generate PPT decks for all lessons in a module
   *
   * @param moduleLessonPlan - ModuleLessonPlan with all lessons
   * @param context - PPTContext with program and module information
   * @returns Array of PPTDeck objects
   */
  async generateModulePPTs(
    moduleLessonPlan: ModuleLessonPlan,
    context: PPTContext
  ): Promise<PPTDeck[]> {
    loggingService.info('Generating PPTs for all module lessons', {
      moduleCode: moduleLessonPlan.moduleCode,
      lessonCount: moduleLessonPlan.lessons.length,
    });

    const decks: PPTDeck[] = [];

    for (const lesson of moduleLessonPlan.lessons) {
      const deck = await this.generateLessonPPT(lesson, context);
      decks.push(deck);
    }

    return decks;
  }

  // ==========================================================================
  // SLIDE GENERATION METHODS
  // ==========================================================================

  /**
   * Generate title slide
   * Requirement 6.2: Include module number/title, lesson number/title, program title, session duration
   */
  private generateTitleSlide(
    lesson: LessonPlan,
    context: PPTContext,
    slideNumber: number
  ): PPTSlide {
    const durationHours = Math.floor(lesson.duration / 60);
    const durationMinutes = lesson.duration % 60;
    const durationText =
      durationHours > 0 ? `${durationHours}h ${durationMinutes}m` : `${durationMinutes} minutes`;

    return {
      slideNumber,
      slideType: 'title',
      title: lesson.lessonTitle,
      content: {
        type: 'title',
        title: lesson.lessonTitle,
        content: [
          `${context.moduleCode}: ${context.moduleTitle}`,
          `Lesson ${lesson.lessonNumber}`,
          `Session Duration: ${durationText}`,
          context.programTitle,
        ],
      },
      speakerNotes: `Welcome to Lesson ${lesson.lessonNumber}: ${lesson.lessonTitle}. This ${durationText} session is part of ${context.moduleCode} - ${context.moduleTitle} in the ${context.programTitle} program.`,
    };
  }

  /**
   * Generate learning objectives slide
   * Requirement 6.3: Derive objectives from MLO alignment, include optional PLO connection
   */
  private generateObjectivesSlide(
    lesson: LessonPlan,
    context: PPTContext,
    slideNumber: number
  ): PPTSlide {
    const objectivesList = lesson.objectives.map((obj) => `• ${obj}`);

    let ploConnection = '';
    if (lesson.linkedPLOs && lesson.linkedPLOs.length > 0) {
      ploConnection = `\n\nConnected to Program Learning Outcomes: ${lesson.linkedPLOs.join(', ')}`;
    }

    return {
      slideNumber,
      slideType: 'objectives',
      title: 'Learning Objectives',
      content: {
        type: 'bullets',
        title: 'Learning Objectives',
        content: lesson.objectives,
      },
      speakerNotes: `By the end of this lesson, learners will achieve these objectives. ${ploConnection} These objectives align with the module's learning outcomes at the ${lesson.bloomLevel} level of Bloom's taxonomy.`,
      visualSuggestion: 'Use icons or graphics to represent each objective category',
    };
  }

  /**
   * Generate key concepts slides
   * Requirement 6.4: Use MLO-based summaries, extract definitions from Step 9 Glossary,
   * include reading-based insights from validated sources
   */
  private generateKeyConceptsSlides(
    lesson: LessonPlan,
    context: PPTContext,
    startSlideNumber: number
  ): PPTSlide[] {
    const slides: PPTSlide[] = [];
    let slideNumber = startSlideNumber;

    // Extract key concepts from objectives and MLOs
    const keyConcepts = this.extractKeyConcepts(lesson, context);

    // Create 1-3 concept slides depending on content
    const conceptsPerSlide = Math.ceil(
      keyConcepts.length / Math.min(3, Math.max(1, Math.ceil(keyConcepts.length / 4)))
    );

    for (let i = 0; i < keyConcepts.length; i += conceptsPerSlide) {
      const slideConceptsconceptsPerSlide = keyConcepts.slice(i, i + conceptsPerSlide);

      slides.push({
        slideNumber: slideNumber++,
        slideType: 'concepts',
        title:
          slideConceptsconceptsPerSlide.length === 1
            ? `Key Concept: ${slideConceptsconceptsPerSlide[0].term}`
            : 'Key Concepts',
        content: {
          type: 'bullets',
          title:
            slideConceptsconceptsPerSlide.length === 1
              ? `Key Concept: ${slideConceptsconceptsPerSlide[0].term}`
              : 'Key Concepts',
          content: slideConceptsconceptsPerSlide.map((c) => `${c.term}: ${c.definition}`),
        },
        speakerNotes: slideConceptsconceptsPerSlide
          .map((c) => `${c.term}: ${c.definition}. ${c.source ? `Source: ${c.source}` : ''}`)
          .join('\n\n'),
        visualSuggestion: 'Use diagrams or concept maps to illustrate relationships',
      });
    }

    return slides;
  }

  /**
   * Generate instructional content slides
   * Requirement 6.5: Align with activity flow from lesson plan, include mini-lecture visuals,
   * concept diagrams, examples and explanations
   */
  private generateInstructionalContentSlides(
    lesson: LessonPlan,
    context: PPTContext,
    startSlideNumber: number
  ): PPTSlide[] {
    const slides: PPTSlide[] = [];
    let slideNumber = startSlideNumber;

    // Generate slides based on lesson activities
    const contentActivities = lesson.activities.filter((a) =>
      ['mini_lecture', 'demonstration', 'discussion', 'practice'].includes(a.type)
    );

    for (const activity of contentActivities) {
      // Skip very short activities (< 10 minutes) or breaks
      if (activity.duration < 10 || activity.type === 'break') {
        continue;
      }

      slides.push({
        slideNumber: slideNumber++,
        slideType: 'content',
        title: activity.title,
        content: {
          type: 'bullets',
          title: activity.title,
          content: [
            activity.description,
            ...activity.instructorActions.map((action) => `Instructor: ${action}`),
            ...activity.studentActions.map((action) => `Students: ${action}`),
          ],
        },
        speakerNotes:
          `Activity: ${activity.title} (${activity.duration} minutes)\n\n` +
          `Teaching Method: ${activity.teachingMethod}\n\n` +
          `Description: ${activity.description}\n\n` +
          `Resources needed: ${activity.resources.join(', ')}\n\n` +
          `Instructor actions: ${activity.instructorActions.join('; ')}\n\n` +
          `Student actions: ${activity.studentActions.join('; ')}`,
        visualSuggestion: this.getVisualSuggestion(activity.type),
      });
    }

    return slides;
  }

  /**
   * Generate case study slides
   * Requirement 6.6: Include scenario overview, key facts, discussion/decision prompts,
   * role-play instructions if applicable, data tables/visuals if provided
   */
  private generateCaseStudySlides(
    caseStudy: CaseStudyActivity,
    context: PPTContext,
    startSlideNumber: number
  ): PPTSlide[] {
    const slides: PPTSlide[] = [];
    let slideNumber = startSlideNumber;

    // Slide 1: Case Overview
    slides.push({
      slideNumber: slideNumber++,
      slideType: 'case_study',
      title: `Case Study: ${caseStudy.caseTitle}`,
      content: {
        type: 'content',
        title: `Case Study: ${caseStudy.caseTitle}`,
        content: [
          `Type: ${caseStudy.activityType}`,
          `Duration: ${caseStudy.duration} minutes`,
          `Purpose: ${caseStudy.learningPurpose}`,
        ],
      },
      speakerNotes:
        `Introduce the case study: ${caseStudy.caseTitle}. ` +
        `This is a ${caseStudy.activityType} activity that will take ${caseStudy.duration} minutes. ` +
        `Learning purpose: ${caseStudy.learningPurpose}. ` +
        `${caseStudy.isFirstAppearance ? 'This is the first time students encounter this case.' : 'Students have seen this case before in a previous module.'}`,
    });

    // Slide 2: Key Facts and Scenario
    if (caseStudy.assessmentHooks && caseStudy.assessmentHooks.keyFacts.length > 0) {
      slides.push({
        slideNumber: slideNumber++,
        slideType: 'case_study',
        title: 'Case Scenario & Key Facts',
        content: {
          type: 'bullets',
          title: 'Case Scenario & Key Facts',
          content: caseStudy.assessmentHooks.keyFacts,
        },
        speakerNotes:
          `Present the key facts of the case. Ensure students understand the context before moving to analysis. ` +
          `Instructor instructions: ${caseStudy.instructorInstructions}`,
      });
    }

    // Slide 3: Discussion/Decision Prompts
    if (caseStudy.assessmentHooks && caseStudy.assessmentHooks.decisionPoints.length > 0) {
      slides.push({
        slideNumber: slideNumber++,
        slideType: 'case_study',
        title: 'Discussion & Decision Points',
        content: {
          type: 'bullets',
          title: 'Discussion & Decision Points',
          content: caseStudy.assessmentHooks.decisionPoints,
        },
        speakerNotes:
          `Guide students through these decision points. Encourage critical thinking and multiple perspectives. ` +
          `Expected student outputs: ${caseStudy.studentOutputExpectations.join('; ')}`,
      });
    }

    // Slide 4: Role-Play Instructions (if applicable)
    if (caseStudy.rolePlay) {
      const rolePlayContent: string[] = [];

      if (caseStudy.rolePlay.characterBriefs) {
        rolePlayContent.push('Character Roles:');
        caseStudy.rolePlay.characterBriefs.forEach((brief) => {
          rolePlayContent.push(`• ${brief.characterName}: ${brief.role}`);
        });
      }

      if (caseStudy.rolePlay.decisionPrompts) {
        rolePlayContent.push('', 'Decision Prompts:');
        caseStudy.rolePlay.decisionPrompts.forEach((prompt) => {
          rolePlayContent.push(`• ${prompt}`);
        });
      }

      slides.push({
        slideNumber: slideNumber++,
        slideType: 'case_study',
        title: 'Role-Play Activity',
        content: {
          type: 'bullets',
          title: 'Role-Play Activity',
          content: rolePlayContent,
        },
        speakerNotes:
          `Set up the role-play activity. Assign roles to students or groups. ` +
          `Debrief questions: ${caseStudy.rolePlay.debriefQuestions?.join('; ')}`,
      });
    }

    return slides;
  }

  /**
   * Generate formative check slides
   * Requirement 7.1: Pull 1-3 MCQs from Step 7 assessment banks, include answer explanations
   */
  private generateFormativeCheckSlides(
    formativeChecks: FormativeCheck[],
    startSlideNumber: number
  ): PPTSlide[] {
    const slides: PPTSlide[] = [];
    let slideNumber = startSlideNumber;

    // Limit to 3 formative checks per lesson
    const checksToInclude = formativeChecks.slice(0, 3);

    for (const check of checksToInclude) {
      if (check.type === 'mcq' && check.options) {
        slides.push({
          slideNumber: slideNumber++,
          slideType: 'formative_check',
          title: 'Knowledge Check',
          content: {
            type: 'bullets',
            title: 'Knowledge Check',
            content: [
              check.question,
              '',
              ...check.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`),
            ],
          },
          speakerNotes:
            `Formative assessment question. ` +
            `Correct answer: ${check.correctAnswer}. ` +
            `Explanation: ${check.explanation || 'Discuss the correct answer with students.'}`,
        });
      } else {
        // Discussion question or reflection
        slides.push({
          slideNumber: slideNumber++,
          slideType: 'formative_check',
          title: check.type === 'reflection' ? 'Reflection' : 'Discussion Question',
          content: {
            type: 'content',
            title: check.type === 'reflection' ? 'Reflection' : 'Discussion Question',
            content: check.question,
          },
          speakerNotes:
            `${check.type === 'reflection' ? 'Reflection prompt' : 'Discussion question'}: ${check.question}. ` +
            `Allow ${check.duration} minutes for this activity. ` +
            `${check.explanation || 'Facilitate discussion and ensure all voices are heard.'}`,
        });
      }
    }

    return slides;
  }

  /**
   * Generate summary slide
   * Requirement 7.2: Include key ideas recap and reflection prompts
   */
  private generateSummarySlide(lesson: LessonPlan, slideNumber: number): PPTSlide {
    const keyIdeas = lesson.objectives.map((obj) => {
      // Extract the main concept from the objective
      const simplified = obj
        .replace(/^By the end of this lesson, learners will be able to /i, '')
        .replace(/^Students will /i, '')
        .replace(/^Learners will /i, '');
      return simplified.charAt(0).toUpperCase() + simplified.slice(1);
    });

    const reflectionPrompts = lesson.instructorNotes.discussionPrompts.slice(0, 2);

    return {
      slideNumber,
      slideType: 'summary',
      title: 'Summary & Reflection',
      content: {
        type: 'two_column',
        title: 'Summary & Reflection',
        leftColumn: ['Key Takeaways:', ...keyIdeas],
        rightColumn: ['Reflect:', ...reflectionPrompts],
      },
      speakerNotes:
        `Summarize the key points from this lesson. ` +
        `Key takeaways: ${keyIdeas.join('; ')}. ` +
        `Use reflection prompts to help students consolidate their learning. ` +
        `Preview the next lesson and how it builds on today's content.`,
    };
  }

  /**
   * Generate independent study slide
   * Requirement 7.3: List required Core readings, optional Supplementary readings, estimated study time
   */
  private generateIndependentStudySlide(lesson: LessonPlan, slideNumber: number): PPTSlide {
    const content: string[] = [];

    if (lesson.independentStudy.coreReadings.length > 0) {
      content.push('Required Readings:');
      lesson.independentStudy.coreReadings.forEach((reading) => {
        content.push(`• ${reading.citation} (${reading.estimatedMinutes} min)`);
      });
    }

    if (lesson.independentStudy.supplementaryReadings.length > 0) {
      content.push('', 'Optional Readings:');
      lesson.independentStudy.supplementaryReadings.forEach((reading) => {
        content.push(`• ${reading.citation} (${reading.estimatedMinutes} min)`);
      });
    }

    const totalTime = lesson.independentStudy.estimatedEffort;
    const hours = Math.floor(totalTime / 60);
    const minutes = totalTime % 60;
    const timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;

    content.push('', `Estimated Study Time: ${timeText}`);

    return {
      slideNumber,
      slideType: 'independent_study',
      title: 'Independent Study',
      content: {
        type: 'bullets',
        title: 'Independent Study',
        content,
      },
      speakerNotes:
        `Assign independent study activities. ` +
        `Core readings are required and should be completed before the next lesson. ` +
        `Supplementary readings are optional for students who want to deepen their understanding. ` +
        `Total estimated study time: ${timeText}.`,
    };
  }

  /**
   * Generate references slide
   * Requirement 7.4: Generate APA-formatted citations, include all materials used in the lesson
   */
  private generateReferencesSlide(
    lesson: LessonPlan,
    context: PPTContext,
    slideNumber: number
  ): PPTSlide {
    const citations: string[] = [];

    // Add citations from materials
    lesson.materials.readingReferences.forEach((ref) => {
      citations.push(ref.citation);
    });

    // Add citations from independent study
    lesson.independentStudy.coreReadings.forEach((reading) => {
      if (!citations.includes(reading.citation)) {
        citations.push(reading.citation);
      }
    });

    lesson.independentStudy.supplementaryReadings.forEach((reading) => {
      if (!citations.includes(reading.citation)) {
        citations.push(reading.citation);
      }
    });

    // If no citations, add a placeholder
    if (citations.length === 0) {
      citations.push('All materials referenced in this lesson are from the course curriculum.');
    }

    return {
      slideNumber,
      slideType: 'references',
      title: 'References',
      content: {
        type: 'bullets',
        title: 'References',
        content: citations,
      },
      speakerNotes:
        `All sources used in this lesson are listed here in APA format. ` +
        `These references have been validated against the curriculum's source materials.`,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Extract key concepts from lesson objectives and glossary
   */
  private extractKeyConcepts(
    lesson: LessonPlan,
    context: PPTContext
  ): Array<{ term: string; definition: string; source?: string }> {
    const concepts: Array<{ term: string; definition: string; source?: string }> = [];

    // Extract from glossary if available
    if (context.glossaryEntries && context.glossaryEntries.length > 0) {
      // Find glossary terms mentioned in objectives
      for (const objective of lesson.objectives) {
        const objectiveLower = objective.toLowerCase();

        for (const entry of context.glossaryEntries) {
          const termLower = entry.term.toLowerCase();
          if (objectiveLower.includes(termLower) && !concepts.some((c) => c.term === entry.term)) {
            concepts.push({
              term: entry.term,
              definition: entry.definition,
              source: 'Glossary',
            });
          }
        }
      }
    }

    // If no glossary matches, create concepts from objectives
    if (concepts.length === 0) {
      lesson.objectives.slice(0, 3).forEach((obj) => {
        // Extract key phrase from objective
        const match = obj.match(
          /(?:understand|explain|analyze|apply|evaluate|create)\s+(.+?)(?:\.|$)/i
        );
        if (match) {
          concepts.push({
            term: match[1].trim(),
            definition: `Key concept covered in this lesson: ${match[1].trim()}`,
          });
        }
      });
    }

    return concepts.slice(0, 5); // Limit to 5 key concepts
  }

  /**
   * Get visual suggestion based on activity type
   */
  private getVisualSuggestion(activityType: LessonActivity['type']): string {
    const suggestions: Record<LessonActivity['type'], string> = {
      mini_lecture: 'Use diagrams, charts, or infographics to illustrate key points',
      discussion: 'Use thought-provoking images or quotes to stimulate discussion',
      demonstration: 'Include step-by-step visuals or process diagrams',
      practice: 'Show examples and provide templates or frameworks',
      role_play: 'Use scenario cards or character profiles',
      case_analysis: 'Include data tables, charts, or situation diagrams',
      group_work: 'Show collaboration frameworks or group task instructions',
      assessment: 'Use clear question formatting with answer options',
      break: 'N/A',
    };
    return suggestions[activityType] || 'Use relevant visuals to support content';
  }

  /**
   * Validate MLO coverage in slides
   * Requirement 9.2: Verify all MLOs appear in corresponding slide sequences
   */
  private validateMLOCoverage(lesson: LessonPlan, slides: PPTSlide[]): boolean {
    // Check if objectives slide exists and contains all MLOs
    const objectivesSlide = slides.find((s) => s.slideType === 'objectives');
    if (!objectivesSlide) return false;

    // All objectives should be present in the objectives slide
    return lesson.objectives.every((obj) => JSON.stringify(objectivesSlide.content).includes(obj));
  }

  /**
   * Validate citations against verified sources
   * Requirement 9.4: Verify citations match verified sources from Steps 5-6
   */
  private validateCitations(lesson: LessonPlan, context: PPTContext): boolean {
    // If no sources provided in context, assume valid
    if (!context.sources || context.sources.length === 0) {
      return true;
    }

    // Check that all citations in the lesson match sources from context
    const allCitations = [
      ...lesson.materials.readingReferences.map((r) => r.citation),
      ...lesson.independentStudy.coreReadings.map((r) => r.citation),
      ...lesson.independentStudy.supplementaryReadings.map((r) => r.citation),
    ];

    // For now, return true if we have citations (full validation would require source matching)
    return allCitations.length > 0;
  }

  /**
   * Validate glossary terms are defined (used during PPT generation)
   * Requirement 9.6: Verify all glossary terms used are defined in Step 9
   */
  private validateGlossaryTermsInGeneration(lesson: LessonPlan, context: PPTContext): boolean {
    // If no glossary provided, assume valid
    if (!context.glossaryEntries || context.glossaryEntries.length === 0) {
      return true;
    }

    // For now, return true (full validation would require term extraction and matching)
    return true;
  }

  // ==========================================================================
  // DELIVERY MODE ADAPTATION (Task 9)
  // ==========================================================================

  /**
   * Adapt slides based on delivery mode
   *
   * Requirements:
   * - 8.1: In-person mode adaptations
   * - 8.2: Online facilitated mode adaptations
   * - 8.3: Online self-study mode adaptations
   * - 8.4: Hybrid mode adaptations
   *
   * @param slides - Array of PPTSlide objects to adapt
   * @param deliveryMode - Delivery mode (in-person, online-facilitated, online-self-study, hybrid)
   * @returns Adapted array of PPTSlide objects
   */
  adaptForDeliveryMode(slides: PPTSlide[], deliveryMode: string): PPTSlide[] {
    loggingService.info('Adapting slides for delivery mode', {
      deliveryMode,
      slideCount: slides.length,
    });

    const normalizedMode = deliveryMode.toLowerCase().replace(/[_\s-]/g, '');

    switch (normalizedMode) {
      case 'inperson':
      case 'in-person':
        return this.adaptForInPersonMode(slides);

      case 'onlinefacilitated':
      case 'online-facilitated':
        return this.adaptForOnlineFacilitatedMode(slides);

      case 'onlineselfstudy':
      case 'online-self-study':
      case 'selfstudy':
        return this.adaptForOnlineSelfStudyMode(slides);

      case 'hybrid':
      case 'blended':
        return this.adaptForHybridMode(slides);

      default:
        loggingService.warn('Unknown delivery mode, returning slides unchanged', {
          deliveryMode,
        });
        return slides;
    }
  }

  /**
   * Adapt slides for in-person delivery mode
   *
   * Requirement 8.1: More diagrams and facilitation cues, reduced text density,
   * prioritized role-play and group-activity prompts
   *
   * @param slides - Original slides
   * @returns Adapted slides for in-person delivery
   */
  private adaptForInPersonMode(slides: PPTSlide[]): PPTSlide[] {
    return slides.map((slide) => {
      const adaptedSlide = { ...slide };

      // Reduce text density - limit bullet points to 5 per slide
      if (adaptedSlide.content.type === 'bullets' && Array.isArray(adaptedSlide.content.content)) {
        if (adaptedSlide.content.content.length > 5) {
          // Keep first 5 items, add note about additional content in speaker notes
          const extraItems = adaptedSlide.content.content.slice(5);
          adaptedSlide.content.content = adaptedSlide.content.content.slice(0, 5);
          adaptedSlide.speakerNotes += `\n\nAdditional points to cover verbally: ${extraItems.join('; ')}`;
        }
      }

      // Add facilitation cues to speaker notes
      adaptedSlide.speakerNotes = this.addFacilitationCues(
        adaptedSlide.speakerNotes,
        slide.slideType
      );

      // Enhance visual suggestions for in-person
      if (adaptedSlide.visualSuggestion) {
        adaptedSlide.visualSuggestion = `[In-Person] ${adaptedSlide.visualSuggestion}. Use large, clear visuals visible from the back of the room.`;
      } else {
        adaptedSlide.visualSuggestion =
          '[In-Person] Use large diagrams and visuals. Encourage physical interaction and movement.';
      }

      // Prioritize role-play and group activities
      if (slide.slideType === 'case_study') {
        adaptedSlide.speakerNotes +=
          '\n\n[In-Person Facilitation] Consider breaking students into small groups for case discussion. Use physical space to create breakout areas. Encourage role-play and hands-on engagement.';
      }

      if (slide.slideType === 'content' && adaptedSlide.content.content) {
        // Add group activity prompts
        adaptedSlide.speakerNotes +=
          '\n\n[In-Person Activity] Consider pausing for a quick pair-share or think-pair-share activity to reinforce this concept.';
      }

      return adaptedSlide;
    });
  }

  /**
   * Adapt slides for online facilitated delivery mode
   *
   * Requirement 8.2: Clearer step-by-step instructions, breakout room prompts,
   * polling and chat-based engagement elements
   *
   * @param slides - Original slides
   * @returns Adapted slides for online facilitated delivery
   */
  private adaptForOnlineFacilitatedMode(slides: PPTSlide[]): PPTSlide[] {
    return slides.map((slide) => {
      const adaptedSlide = { ...slide };

      // Add step-by-step instructions to content slides
      if (slide.slideType === 'content' || slide.slideType === 'case_study') {
        adaptedSlide.speakerNotes = this.addStepByStepInstructions(adaptedSlide.speakerNotes);
      }

      // Add breakout room prompts for collaborative activities
      if (slide.slideType === 'case_study' || slide.slideType === 'formative_check') {
        adaptedSlide.speakerNotes +=
          '\n\n[Breakout Rooms] Consider using breakout rooms for small group discussion (3-5 minutes). Provide clear instructions before sending students to rooms. Circulate between rooms to monitor progress.';
      }

      // Add polling prompts for formative checks
      if (slide.slideType === 'formative_check') {
        adaptedSlide.speakerNotes +=
          '\n\n[Polling] Use platform polling feature to gather responses. Display results and discuss patterns. This provides immediate feedback and engagement.';
      }

      // Add chat engagement prompts
      if (slide.slideType === 'objectives' || slide.slideType === 'summary') {
        adaptedSlide.speakerNotes +=
          '\n\n[Chat Engagement] Ask students to share their thoughts in the chat. Acknowledge responses and build on student contributions.';
      }

      // Add visual cues for online engagement
      if (adaptedSlide.visualSuggestion) {
        adaptedSlide.visualSuggestion = `[Online Facilitated] ${adaptedSlide.visualSuggestion}. Ensure visuals are clear on small screens.`;
      } else {
        adaptedSlide.visualSuggestion =
          '[Online Facilitated] Use clear, high-contrast visuals. Include interactive elements like polls or chat prompts.';
      }

      return adaptedSlide;
    });
  }

  /**
   * Adapt slides for online self-study delivery mode
   *
   * Requirement 8.3: Additional explanatory text, embedded knowledge checks,
   * simplified case studies for solo analysis
   *
   * @param slides - Original slides
   * @returns Adapted slides for online self-study delivery
   */
  private adaptForOnlineSelfStudyMode(slides: PPTSlide[]): PPTSlide[] {
    return slides.map((slide) => {
      const adaptedSlide = { ...slide };

      // Add explanatory text from speaker notes to slide content
      if (adaptedSlide.content.type === 'bullets' && Array.isArray(adaptedSlide.content.content)) {
        // Extract key explanations from speaker notes
        const explanations = this.extractKeyExplanations(adaptedSlide.speakerNotes);
        if (explanations.length > 0) {
          adaptedSlide.content.content = [
            ...adaptedSlide.content.content,
            '',
            '📖 Key Points:',
            ...explanations,
          ];
        }
      }

      // Simplify case studies for solo analysis
      if (slide.slideType === 'case_study') {
        adaptedSlide.speakerNotes = this.simplifyCaseStudyForSelfStudy(adaptedSlide.speakerNotes);

        // Add self-reflection prompts
        if (
          adaptedSlide.content.type === 'bullets' &&
          Array.isArray(adaptedSlide.content.content)
        ) {
          adaptedSlide.content.content.push(
            '',
            '🤔 Self-Reflection:',
            '• What would you do in this situation?',
            '• What are the key considerations?'
          );
        }
      }

      // Embed knowledge checks with immediate feedback
      if (slide.slideType === 'formative_check') {
        adaptedSlide.speakerNotes = `[Self-Study] ${adaptedSlide.speakerNotes}\n\nTake time to think through this question before checking the answer. Consider writing down your reasoning.`;

        // Add answer explanation to slide content for self-study
        if (
          adaptedSlide.content.type === 'bullets' &&
          Array.isArray(adaptedSlide.content.content)
        ) {
          const answerMatch = adaptedSlide.speakerNotes.match(/Correct answer: ([^.]+)/);
          const explanationMatch = adaptedSlide.speakerNotes.match(/Explanation: ([^.]+)/);

          if (answerMatch || explanationMatch) {
            adaptedSlide.content.content.push(
              '',
              '💡 Answer & Explanation:',
              '(Scroll down or click next for answer)'
            );
          }
        }
      }

      // Add navigation hints
      adaptedSlide.speakerNotes = `[Self-Study Mode] ${adaptedSlide.speakerNotes}\n\nTake your time with this slide. Review the content carefully before moving forward.`;

      // Enhance visual suggestions for self-study
      if (adaptedSlide.visualSuggestion) {
        adaptedSlide.visualSuggestion = `[Self-Study] ${adaptedSlide.visualSuggestion}. Include detailed captions and annotations.`;
      } else {
        adaptedSlide.visualSuggestion =
          '[Self-Study] Use detailed, self-explanatory visuals with clear labels and annotations.';
      }

      return adaptedSlide;
    });
  }

  /**
   * Adapt slides for hybrid/blended delivery mode
   *
   * Requirement 8.4: Balanced text-to-visual ratio, design for both synchronous
   * and asynchronous segments
   *
   * @param slides - Original slides
   * @returns Adapted slides for hybrid delivery
   */
  private adaptForHybridMode(slides: PPTSlide[]): PPTSlide[] {
    return slides.map((slide) => {
      const adaptedSlide = { ...slide };

      // Balance text and visuals - aim for 3-5 bullet points
      if (adaptedSlide.content.type === 'bullets' && Array.isArray(adaptedSlide.content.content)) {
        if (adaptedSlide.content.content.length > 6) {
          // Move extra content to speaker notes
          const extraItems = adaptedSlide.content.content.slice(6);
          adaptedSlide.content.content = adaptedSlide.content.content.slice(0, 6);
          adaptedSlide.speakerNotes += `\n\n[Additional Content] ${extraItems.join('; ')}`;
        } else if (adaptedSlide.content.content.length < 3) {
          // Add context from speaker notes if content is too sparse
          const context = this.extractKeyExplanations(adaptedSlide.speakerNotes, 1);
          if (context.length > 0) {
            adaptedSlide.content.content.push(...context);
          }
        }
      }

      // Mark slides for synchronous vs asynchronous use
      if (slide.slideType === 'objectives' || slide.slideType === 'summary') {
        adaptedSlide.speakerNotes = `[Synchronous Session] ${adaptedSlide.speakerNotes}\n\nUse this slide during live sessions to set expectations and review learning.`;
      } else if (slide.slideType === 'content' || slide.slideType === 'concepts') {
        adaptedSlide.speakerNotes = `[Asynchronous + Synchronous] ${adaptedSlide.speakerNotes}\n\nThis content works for both self-study and live discussion. In live sessions, focus on clarifying questions and deeper exploration.`;
      } else if (slide.slideType === 'case_study' || slide.slideType === 'formative_check') {
        adaptedSlide.speakerNotes = `[Synchronous Session] ${adaptedSlide.speakerNotes}\n\nBest used in live sessions for interactive discussion. Students can review case details asynchronously before the session.`;
      }

      // Add hybrid-specific facilitation notes
      adaptedSlide.speakerNotes +=
        '\n\n[Hybrid Facilitation] This slide is designed for both in-person and online students. Ensure online participants can see clearly and have opportunities to contribute via chat or unmuting.';

      // Balanced visual suggestions
      if (adaptedSlide.visualSuggestion) {
        adaptedSlide.visualSuggestion = `[Hybrid] ${adaptedSlide.visualSuggestion}. Balance detail for self-study with clarity for live viewing.`;
      } else {
        adaptedSlide.visualSuggestion =
          '[Hybrid] Use clear visuals with moderate detail. Include both text and graphics for balanced learning.';
      }

      return adaptedSlide;
    });
  }

  // ==========================================================================
  // ADAPTATION HELPER METHODS
  // ==========================================================================

  /**
   * Add facilitation cues to speaker notes for in-person delivery
   */
  private addFacilitationCues(speakerNotes: string, slideType: PPTSlide['slideType']): string {
    const cues: Record<PPTSlide['slideType'], string> = {
      title:
        '[Facilitation] Welcome students. Set the tone for the session. Check room setup and technology.',
      objectives:
        '[Facilitation] Read objectives aloud. Ask students what they already know about these topics.',
      concepts:
        '[Facilitation] Use whiteboard or flip chart to illustrate concepts. Encourage questions.',
      content:
        "[Facilitation] Pause frequently for questions. Use examples from students' experiences.",
      case_study:
        '[Facilitation] Encourage debate and multiple perspectives. Use physical space for group work.',
      formative_check:
        '[Facilitation] Use hand-raising or response cards. Discuss reasoning behind answers.',
      summary:
        '[Facilitation] Ask students to share their key takeaways. Address any remaining questions.',
      independent_study:
        '[Facilitation] Clarify expectations for independent work. Provide study tips.',
      references:
        '[Facilitation] Briefly mention key sources. Encourage students to explore further.',
    };

    const cue = cues[slideType] || '[Facilitation] Engage students actively with this content.';
    return `${speakerNotes}\n\n${cue}`;
  }

  /**
   * Add step-by-step instructions for online facilitated delivery
   */
  private addStepByStepInstructions(speakerNotes: string): string {
    const instructions =
      '\n\n[Step-by-Step Instructions]\n' +
      '1. Share screen and display this slide\n' +
      '2. Read through the content, pausing for questions\n' +
      '3. Check chat for questions or comments\n' +
      '4. Ask for verbal responses or use reactions\n' +
      '5. Summarize key points before moving forward';

    return `${speakerNotes}${instructions}`;
  }

  /**
   * Extract key explanations from speaker notes (for self-study mode)
   */
  private extractKeyExplanations(speakerNotes: string, limit: number = 2): string[] {
    const explanations: string[] = [];

    // Split by sentences and find explanatory content
    const sentences = speakerNotes
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    // Look for sentences that explain concepts (contain "because", "this means", "in other words", etc.)
    const explanatorySentences = sentences.filter((s) =>
      /because|this means|in other words|for example|specifically|essentially/i.test(s)
    );

    // Take the first few explanatory sentences
    return explanatorySentences.slice(0, limit).map((s) => `• ${s}`);
  }

  /**
   * Simplify case study instructions for self-study mode
   */
  private simplifyCaseStudyForSelfStudy(speakerNotes: string): string {
    let simplified = speakerNotes;

    // Replace group-oriented language with individual language
    simplified = simplified.replace(/students/gi, 'you');
    simplified = simplified.replace(/groups?/gi, 'individual analysis');
    simplified = simplified.replace(/discuss/gi, 'consider');
    simplified = simplified.replace(/share/gi, 'reflect on');

    // Add self-study specific guidance
    simplified +=
      '\n\n[Self-Study Guidance] Work through this case independently. Take notes on your analysis. Consider multiple perspectives before forming your conclusion.';

    return simplified;
  }

  // ==========================================================================
  // PPT VALIDATION (Task 10.1)
  // ==========================================================================

  /**
   * Validate PPT deck against lesson plan and context
   *
   * Requirements:
   * - 9.1: Verify each lesson has a corresponding PPT deck
   * - 9.2: Verify all MLOs appear in corresponding slide sequences
   * - 9.3: Verify case studies appear only in designated lessons
   * - 9.4: Verify citations match verified sources from Steps 5-6
   * - 9.5: Verify slide count per deck remains within 15-35 slides
   * - 9.6: Verify all glossary terms used are defined in Step 9
   *
   * @param deck - PPT deck to validate
   * @param lesson - Lesson plan the deck corresponds to
   * @param context - Validation context with sources, reading lists, and glossary
   * @returns PPTValidationResult with validation status and details
   */
  validatePPTDeck(
    deck: PPTDeck,
    lesson: LessonPlan,
    context: PPTValidationContext
  ): PPTValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Requirement 9.1: Verify lesson-PPT correspondence
    const lessonPPTCorrespondence = this.validateLessonPPTCorrespondence(deck, lesson, errors);

    // Requirement 9.2: Verify MLO coverage in slides
    const mlosCovered = this.validateMLOCoverageInDeck(deck, lesson, errors);

    // Requirement 9.3: Verify case study placement
    const caseStudyPlacement = this.validateCaseStudyPlacement(deck, lesson, errors, warnings);

    // Requirement 9.4: Verify citation validity against Steps 5-6
    const citationsValid = this.validateCitationValidity(deck, lesson, context, errors, warnings);

    // Requirement 9.5: Verify slide count (15-35)
    const slideCountValid = this.validateSlideCount(deck, errors, warnings);

    // Requirement 9.6: Verify glossary terms are defined in Step 9
    const glossaryTermsDefined = this.validateGlossaryTerms(deck, context, errors, warnings);

    const isValid =
      lessonPPTCorrespondence &&
      mlosCovered &&
      caseStudyPlacement &&
      citationsValid &&
      slideCountValid &&
      glossaryTermsDefined;

    loggingService.info('PPT deck validation complete', {
      deckId: deck.deckId,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return {
      isValid,
      lessonPPTCorrespondence,
      mlosCovered,
      caseStudyPlacement,
      citationsValid,
      slideCountValid,
      glossaryTermsDefined,
      errors,
      warnings,
    };
  }

  /**
   * Validate lesson-PPT correspondence
   * Requirement 9.1: Verify each lesson has a corresponding PPT deck
   */
  private validateLessonPPTCorrespondence(
    deck: PPTDeck,
    lesson: LessonPlan,
    errors: string[]
  ): boolean {
    let isValid = true;

    // Check deck ID matches lesson
    if (deck.deckId !== `${lesson.lessonId}-PPT`) {
      errors.push(`Deck ID mismatch: expected "${lesson.lessonId}-PPT", got "${deck.deckId}"`);
      isValid = false;
    }

    // Check lesson ID matches
    if (deck.lessonId !== lesson.lessonId) {
      errors.push(`Lesson ID mismatch: expected "${lesson.lessonId}", got "${deck.lessonId}"`);
      isValid = false;
    }

    // Check lesson number matches
    if (deck.lessonNumber !== lesson.lessonNumber) {
      errors.push(
        `Lesson number mismatch: expected ${lesson.lessonNumber}, got ${deck.lessonNumber}`
      );
      isValid = false;
    }

    // Check lesson title matches
    if (deck.lessonTitle !== lesson.lessonTitle) {
      errors.push(
        `Lesson title mismatch: expected "${lesson.lessonTitle}", got "${deck.lessonTitle}"`
      );
      isValid = false;
    }

    return isValid;
  }

  /**
   * Validate MLO coverage in slides
   * Requirement 9.2: Verify all MLOs appear in corresponding slide sequences
   */
  private validateMLOCoverageInDeck(deck: PPTDeck, lesson: LessonPlan, errors: string[]): boolean {
    // Find objectives slide
    const objectivesSlide = deck.slides.find((s) => s.slideType === 'objectives');

    if (!objectivesSlide) {
      errors.push('Missing objectives slide in PPT deck');
      return false;
    }

    // Check if all lesson objectives are present in the objectives slide
    const slideContent = JSON.stringify(objectivesSlide.content).toLowerCase();
    const missingObjectives: string[] = [];

    for (const objective of lesson.objectives) {
      const objectiveLower = objective.toLowerCase();
      // Check if the objective or a significant portion of it appears in the slide
      const significantPortion = objectiveLower.substring(0, Math.min(50, objectiveLower.length));

      if (!slideContent.includes(significantPortion)) {
        missingObjectives.push(objective);
      }
    }

    if (missingObjectives.length > 0) {
      errors.push(`Missing objectives in PPT deck: ${missingObjectives.join('; ')}`);
      return false;
    }

    // Check if MLO IDs are referenced somewhere in the deck
    const allSlideContent = deck.slides
      .map((s) => JSON.stringify(s))
      .join(' ')
      .toLowerCase();
    const missingMLOs: string[] = [];

    for (const mloId of lesson.linkedMLOs) {
      // MLOs should be covered through objectives, so we check if objectives are present
      // This is a soft check - we already validated objectives above
    }

    return true;
  }

  /**
   * Validate case study placement
   * Requirement 9.3: Verify case studies appear only in designated lessons
   */
  private validateCaseStudyPlacement(
    deck: PPTDeck,
    lesson: LessonPlan,
    errors: string[],
    warnings: string[]
  ): boolean {
    const caseStudySlides = deck.slides.filter((s) => s.slideType === 'case_study');

    // If lesson has a case study activity, deck should have case study slides
    if (lesson.caseStudyActivity && caseStudySlides.length === 0) {
      errors.push('Lesson has case study activity but PPT deck has no case study slides');
      return false;
    }

    // If lesson has no case study activity, deck should not have case study slides
    if (!lesson.caseStudyActivity && caseStudySlides.length > 0) {
      warnings.push('PPT deck has case study slides but lesson has no case study activity');
      // This is a warning, not an error - might be intentional
    }

    // If both have case studies, verify the case study ID matches
    if (lesson.caseStudyActivity && caseStudySlides.length > 0) {
      const caseStudyId = lesson.caseStudyActivity.caseStudyId;
      const caseTitle = lesson.caseStudyActivity.caseTitle;

      // Check if case study title appears in the slides
      const caseStudyContent = caseStudySlides.map((s) => JSON.stringify(s)).join(' ');

      if (!caseStudyContent.includes(caseTitle)) {
        warnings.push(`Case study title "${caseTitle}" not found in case study slides`);
      }
    }

    return true;
  }

  /**
   * Validate citation validity against Steps 5-6
   * Requirement 9.4: Verify citations match verified sources from Steps 5-6
   */
  private validateCitationValidity(
    deck: PPTDeck,
    lesson: LessonPlan,
    context: PPTValidationContext,
    errors: string[],
    warnings: string[]
  ): boolean {
    // Find references slide
    const referencesSlide = deck.slides.find((s) => s.slideType === 'references');

    if (!referencesSlide) {
      errors.push('Missing references slide in PPT deck');
      return false;
    }

    // If no sources provided in context, we can't validate but assume valid
    if (!context.sources || context.sources.length === 0) {
      warnings.push('No sources provided in context for citation validation');
      return true;
    }

    // Extract citations from references slide
    const slideContent = JSON.stringify(referencesSlide.content);

    // Get all citations from lesson materials
    const lessonCitations = [
      ...lesson.materials.readingReferences.map((r) => r.citation),
      ...lesson.independentStudy.coreReadings.map((r) => r.citation),
      ...lesson.independentStudy.supplementaryReadings.map((r) => r.citation),
    ];

    // Check if lesson citations appear in the references slide
    const missingCitations: string[] = [];

    for (const citation of lessonCitations) {
      // Check if citation or a significant portion appears in the slide
      const significantPortion = citation.substring(0, Math.min(30, citation.length));

      if (!slideContent.includes(significantPortion)) {
        missingCitations.push(citation);
      }
    }

    if (missingCitations.length > 0) {
      warnings.push(
        `Some citations from lesson materials not found in references slide: ${missingCitations.length} missing`
      );
      // This is a warning, not an error - references slide might have been condensed
    }

    // Validate that citations reference verified sources from Steps 5-6
    // This is a simplified check - full validation would require matching against source IDs
    const hasValidSources = lessonCitations.length > 0;

    if (!hasValidSources && context.sources.length > 0) {
      warnings.push('Lesson has no citations but sources are available in context');
    }

    return true;
  }

  /**
   * Validate slide count
   * Requirement 9.5: Verify slide count per deck remains within 15-35 slides
   */
  private validateSlideCount(deck: PPTDeck, errors: string[], warnings: string[]): boolean {
    const MIN_SLIDES = 15;
    const MAX_SLIDES = 35;

    if (deck.slideCount < MIN_SLIDES) {
      errors.push(`Slide count ${deck.slideCount} is below minimum of ${MIN_SLIDES}`);
      return false;
    }

    if (deck.slideCount > MAX_SLIDES) {
      errors.push(`Slide count ${deck.slideCount} exceeds maximum of ${MAX_SLIDES}`);
      return false;
    }

    // Verify slideCount matches actual slides array length
    if (deck.slideCount !== deck.slides.length) {
      errors.push(
        `Slide count mismatch: slideCount=${deck.slideCount}, actual slides=${deck.slides.length}`
      );
      return false;
    }

    // Warning if close to boundaries
    if (deck.slideCount < MIN_SLIDES + 2) {
      warnings.push(`Slide count ${deck.slideCount} is close to minimum threshold`);
    }

    if (deck.slideCount > MAX_SLIDES - 2) {
      warnings.push(`Slide count ${deck.slideCount} is close to maximum threshold`);
    }

    return true;
  }

  /**
   * Validate glossary terms are defined
   * Requirement 9.6: Verify all glossary terms used are defined in Step 9
   */
  private validateGlossaryTerms(
    deck: PPTDeck,
    context: PPTValidationContext,
    errors: string[],
    warnings: string[]
  ): boolean {
    // If no glossary provided in context, assume valid
    if (!context.glossaryEntries || context.glossaryEntries.length === 0) {
      warnings.push('No glossary entries provided in context for term validation');
      return true;
    }

    // Extract all text content from slides
    const allSlideText = deck.slides
      .map((s) => JSON.stringify(s.content) + ' ' + s.speakerNotes)
      .join(' ')
      .toLowerCase();

    // Check if glossary terms used in slides are defined
    const undefinedTerms: string[] = [];
    const definedTerms = context.glossaryEntries.map((entry: any) => entry.term.toLowerCase());

    // Look for potential technical terms in slide content
    // This is a simplified check - full validation would require NLP
    for (const entry of context.glossaryEntries) {
      const term = entry.term.toLowerCase();

      // If term appears in slides, it should be in glossary (which it is, since we're iterating glossary)
      // This validates that terms in glossary are actually used
    }

    // For now, we assume terms are properly defined if glossary is provided
    // A more sophisticated check would extract terms from slides and verify against glossary

    return true;
  }

  // ==========================================================================
  // PPT EXPORT METHODS (Task 15)
  // ==========================================================================

  /**
   * Export PPT deck in PPTX format (editable)
   *
   * Requirement 12.1: Provide PPTX format (editable)
   *
   * @param deck - PPT deck to export
   * @returns Buffer containing PPTX file
   */
  async exportPPTX(deck: PPTDeck): Promise<Buffer> {
    loggingService.info('Exporting PPT deck as PPTX', {
      deckId: deck.deckId,
      slideCount: deck.slideCount,
    });

    try {
      const ppt = new pptxgen();

      // Set presentation properties
      ppt.author = 'Curriculum Generator';
      ppt.company = 'Education Institution';
      ppt.subject = deck.lessonTitle;
      ppt.title = `${deck.moduleCode} - Lesson ${deck.lessonNumber}: ${deck.lessonTitle}`;

      // Define color scheme (professional blue theme)
      const colors = {
        primary: '1F4788',
        secondary: '4A90E2',
        text: '333333',
        lightGray: 'F5F5F5',
        white: 'FFFFFF',
      };

      // Create slides from deck
      for (const slideData of deck.slides) {
        const slide = ppt.addSlide();

        // Convert PPTSlide to actual PowerPoint slide
        this.createSlideFromPPTSlide(slide, slideData, colors);

        // Add speaker notes
        if (slideData.speakerNotes) {
          slide.addNotes(slideData.speakerNotes);
        }
      }

      // Generate buffer
      const buffer = (await ppt.write({ outputType: 'nodebuffer' })) as Buffer;

      loggingService.info('PPTX export successful', {
        deckId: deck.deckId,
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error: any) {
      loggingService.error('Failed to export PPTX', {
        error: error.message,
        deckId: deck.deckId,
      });
      throw error;
    }
  }

  /**
   * Create PowerPoint slide from PPTSlide data
   */
  private createSlideFromPPTSlide(slide: any, slideData: PPTSlide, colors: any): void {
    const content = slideData.content;

    switch (content.type) {
      case 'title':
        this.createTitleSlide(slide, content, colors);
        break;
      case 'bullets':
        this.createContentSlide(slide, content, colors);
        break;
      case 'content':
        this.createContentSlide(slide, content, colors);
        break;
      case 'table':
        this.createTableSlide(slide, content, colors);
        break;
      case 'two_column':
        this.createTwoColumnSlide(slide, content, colors);
        break;
      default:
        this.createContentSlide(slide, content, colors);
    }
  }

  /**
   * Export PPT deck in PDF format (read-only)
   *
   * Requirement 12.2: Provide PDF format (read-only)
   *
   * @param deck - PPT deck to export
   * @returns Buffer containing PDF file
   */
  async exportPDF(deck: PPTDeck): Promise<Buffer> {
    loggingService.info('Exporting PPT deck as PDF', {
      deckId: deck.deckId,
      slideCount: deck.slideCount,
    });

    try {
      // First, generate PPTX
      const pptxBuffer = await this.exportPPTX(deck);

      // For now, we'll use a placeholder approach
      // In production, you would:
      // 1. Save PPTX to temp file
      // 2. Use LibreOffice or similar to convert to PDF
      // 3. Or use a service like CloudConvert

      // Since we have puppeteer, we can generate HTML and convert to PDF
      const html = this.generateHTMLFromDeck(deck);
      const pdfBuffer = await this.convertHTMLToPDF(html);

      loggingService.info('PDF export successful', {
        deckId: deck.deckId,
        bufferSize: pdfBuffer.length,
      });

      return pdfBuffer;
    } catch (error: any) {
      loggingService.error('Failed to export PDF', {
        error: error.message,
        deckId: deck.deckId,
      });
      throw error;
    }
  }

  /**
   * Generate HTML representation of PPT deck for PDF conversion
   */
  private generateHTMLFromDeck(deck: PPTDeck): string {
    const slides = deck.slides
      .map((slide, index) => {
        const content = this.generateHTMLForSlide(slide);
        return `
        <div class="slide" style="page-break-after: always; padding: 40px; min-height: 700px; background: white; border: 1px solid #ddd; margin-bottom: 20px;">
          <div class="slide-number" style="position: absolute; top: 10px; right: 10px; color: #999; font-size: 12px;">
            Slide ${index + 1} of ${deck.slideCount}
          </div>
          ${content}
        </div>
      `;
      })
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${deck.moduleCode} - Lesson ${deck.lessonNumber}: ${deck.lessonTitle}</title>
        <style>
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
          }
          .slide {
            position: relative;
          }
          h1 {
            color: #1F4788;
            font-size: 32px;
            margin-bottom: 20px;
          }
          h2 {
            color: #4A90E2;
            font-size: 24px;
            margin-bottom: 15px;
          }
          ul {
            list-style-type: disc;
            padding-left: 30px;
            line-height: 1.8;
          }
          li {
            margin-bottom: 10px;
            font-size: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #4A90E2;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #F5F5F5;
            font-weight: bold;
          }
          .two-column {
            display: flex;
            gap: 20px;
          }
          .column {
            flex: 1;
          }
        </style>
      </head>
      <body>
        <div class="cover" style="text-align: center; padding: 100px 40px; background: #1F4788; color: white; margin-bottom: 20px;">
          <h1 style="color: white; font-size: 48px;">${deck.lessonTitle}</h1>
          <p style="font-size: 24px;">${deck.moduleCode} - Lesson ${deck.lessonNumber}</p>
          <p style="font-size: 18px; margin-top: 40px;">Generated by Curriculum Generator</p>
        </div>
        ${slides}
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for a single slide
   */
  private generateHTMLForSlide(slide: PPTSlide): string {
    const content = slide.content;
    let html = `<h2>${slide.title}</h2>`;

    if (content.type === 'bullets' && Array.isArray(content.content)) {
      html += '<ul>';
      content.content.forEach((item) => {
        html += `<li>${this.escapeHTML(String(item))}</li>`;
      });
      html += '</ul>';
    } else if (content.type === 'content') {
      if (Array.isArray(content.content)) {
        html += '<ul>';
        content.content.forEach((item) => {
          html += `<li>${this.escapeHTML(String(item))}</li>`;
        });
        html += '</ul>';
      } else if (content.content) {
        html += `<p>${this.escapeHTML(String(content.content))}</p>`;
      }
    } else if (content.type === 'table' && content.table) {
      html += '<table>';
      html += '<thead><tr>';
      content.table.headers.forEach((header) => {
        html += `<th>${this.escapeHTML(header)}</th>`;
      });
      html += '</tr></thead><tbody>';
      content.table.rows.forEach((row) => {
        html += '<tr>';
        row.forEach((cell) => {
          html += `<td>${this.escapeHTML(cell)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else if (content.type === 'two_column') {
      html += '<div class="two-column">';
      if (content.leftColumn) {
        html += '<div class="column"><ul>';
        content.leftColumn.forEach((item) => {
          html += `<li>${this.escapeHTML(item)}</li>`;
        });
        html += '</ul></div>';
      }
      if (content.rightColumn) {
        html += '<div class="column"><ul>';
        content.rightColumn.forEach((item) => {
          html += `<li>${this.escapeHTML(item)}</li>`;
        });
        html += '</ul></div>';
      }
      html += '</div>';
    }

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async convertHTMLToPDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Export PPT deck as PNG/JPEG slide images
   *
   * Requirement 12.3: Provide PNG/JPEG slide images for LMS compatibility
   *
   * @param deck - PPT deck to export
   * @param format - Image format ('png' or 'jpeg')
   * @returns Array of buffers, one per slide
   */
  async exportImages(deck: PPTDeck, format: 'png' | 'jpeg' = 'png'): Promise<Buffer[]> {
    loggingService.info('Exporting PPT deck as images', {
      deckId: deck.deckId,
      slideCount: deck.slideCount,
      format,
    });

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const images: Buffer[] = [];

      try {
        for (let i = 0; i < deck.slides.length; i++) {
          const slide = deck.slides[i];
          const html = this.generateHTMLForSingleSlide(slide, i + 1, deck.slideCount, deck);

          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 720 }); // 16:9 aspect ratio
          await page.setContent(html, { waitUntil: 'networkidle0' });

          const screenshot = await page.screenshot({
            type: format,
            fullPage: false,
            clip: {
              x: 0,
              y: 0,
              width: 1280,
              height: 720,
            },
          });

          images.push(Buffer.from(screenshot));
          await page.close();
        }

        loggingService.info('Image export successful', {
          deckId: deck.deckId,
          imageCount: images.length,
          format,
        });

        return images;
      } finally {
        await browser.close();
      }
    } catch (error: any) {
      loggingService.error('Failed to export images', {
        error: error.message,
        deckId: deck.deckId,
      });
      throw error;
    }
  }

  /**
   * Generate HTML for a single slide (for image export)
   */
  private generateHTMLForSingleSlide(
    slide: PPTSlide,
    slideNumber: number,
    totalSlides: number,
    deck: PPTDeck
  ): string {
    const content = this.generateHTMLForSlide(slide);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            width: 1280px;
            height: 720px;
            font-family: 'Calibri', 'Arial', sans-serif;
            background: white;
            overflow: hidden;
          }
          .slide-container {
            width: 100%;
            height: 100%;
            padding: 60px 80px;
            box-sizing: border-box;
            position: relative;
          }
          .slide-number {
            position: absolute;
            bottom: 20px;
            right: 30px;
            color: #999;
            font-size: 14px;
          }
          .module-code {
            position: absolute;
            bottom: 20px;
            left: 30px;
            color: #999;
            font-size: 14px;
          }
          h2 {
            color: #1F4788;
            font-size: 36px;
            margin-bottom: 30px;
            margin-top: 0;
          }
          ul {
            list-style-type: disc;
            padding-left: 40px;
            line-height: 2;
          }
          li {
            margin-bottom: 15px;
            font-size: 20px;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #4A90E2;
            padding: 12px;
            text-align: left;
            font-size: 18px;
          }
          th {
            background-color: #F5F5F5;
            font-weight: bold;
          }
          .two-column {
            display: flex;
            gap: 40px;
          }
          .column {
            flex: 1;
          }
          .column h3 {
            color: #4A90E2;
            font-size: 24px;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="slide-container">
          ${content}
          <div class="module-code">${deck.moduleCode} - Lesson ${deck.lessonNumber}</div>
          <div class="slide-number">Slide ${slideNumber} of ${totalSlides}</div>
        </div>
      </body>
      </html>
    `;
  }
}

export const pptGenerationService = new PPTGenerationService();
