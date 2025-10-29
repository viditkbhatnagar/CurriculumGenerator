/**
 * Prompt Library Service
 * Manages course prompts with AGI SME Submission Template
 * Based on your email template for CHRP and similar certification prep courses
 */

import { CoursePrompt, ICoursePrompt } from '../models/CoursePrompt';
import { CurriculumProject } from '../models/CurriculumProject';
import { loggingService } from './loggingService';

// AGI SME Submission Template (from your email)
const AGI_SME_SUBMISSION_TEMPLATE = `You are the Subject Matter Expert (SME) for {DOMAIN}. Your task is to produce a complete AGI SME Submission for a 120-hour (15 ECTS) self-study {QUALIFICATION_TYPE} for {COURSE_TITLE}.

Follow the AGI Rules and Standards exactly, and deliver all content in the AGI SME Excel Template (required sheet names listed below) plus an accompanying Word Guide summarising decisions and reviewer notes.

Think step-by-step and produce fully traceable, verifiable content. Use UK English spelling. Do not include promotional or proprietary material without permission. Cite all evidence using APA 7th edition and verify accessibility of each URL/DOI.

**Deliverables:**
- Completed AGI SME Excel workbook with 14 required tabs
- Accompanying Word document (Submission Guide)

**General Constraints & Standards:**
- Course length: 120 hours total; 6–8 modules; 15 ECTS
- Sources: Published within last 5 years (except seminal works). Minimum 2–3 verified sources per topic (≥1 academic, ≥1 industry)
- Citations: APA 7th Edition with complete author, year, title, publisher/journal, DOI or URL
- Language: Professional, globally neutral, UK English spelling
- Unacceptable sources: blogs, Wikipedia, AI summaries, social media posts

**Required Excel Tabs:**
1. Program Overview
2. Competency Framework
3. Learning Outcomes & Assessment Criteria
4. Course Framework
5. Topic Sources
6. Reading List
7. Assessments
8. Glossary
9. Case Studies
10. Delivery & Tools
11. References
12. Submission Metadata
13. Outcome Writing Guide
14. Comparative Benchmarking

**Specific Instructions by Section:**

**Section 1 — Program Overview:**
- Program title, Aim (2-3 sentences), Qualification type
- Industry need (evidence-based, 3-4 bullet points)
- Target audience, Entry requirements
- Duration and study intensity
- Career outcomes (3-6 job roles/levels)
- Benchmarking vs 2-3 comparable certifications
- 15 ECTS alignment justification

**Section 2 — Competency & Knowledge Framework:**
- Identify {DOMAIN_COUNT} knowledge domains
- For each domain: 3-5 core skills, workplace applications (2-3 examples), 2-3 credible sources (≤5 years)
- Indicate source type: academic or industry

**Section 3 — Learning Outcomes, Assessment Criteria & Competencies:**
- Define 5-8 measurable Learning Outcomes (Verb + Object + Context)
- Approved verbs: apply, analyse, evaluate, design, recommend, construct, implement, justify
- Each outcome: 2-4 Assessment Criteria (observable performance, active verbs)
- Indicate: Knowledge, Skill, or Competency
- Map to Competency Framework domains and modules

**Section 4 — Course Framework:**
- Structure: 6-8 modules totalling 120 hours
- Per module: Code ({MODULE_CODE_FORMAT}), Title, Aim (1 sentence), Hours (Core/Elective)
- Objectives (3-6, aligned to Learning Outcomes), Key Topics, Indicative Content
- Assessment Type(s), Assessment Policy (weightings, thresholds, reassessment)
- Self-study guidance breakdown (reading, practice, assessment hours)
- Mapping table: modules → Learning Outcomes → Competency domains

**Section 5 — Topic-Level Sources:**
- For every topic: 2-3 verified sources (≥1 academic, ≥1 industry)
- Full APA 7 citation, URL/DOI, one-sentence explanation
- Verify link accessibility before submission

**Section 6 — Indicative & Additional Reading List:**
- Books (latest editions), professional guides, reports, authoritative websites
- Per entry: Citation, synopsis (1-2 sentences), estimated reading time

**Section 7 — Assessments & Mapping:**
- Per module: 5-10 MCQs (stem, 4 options, correct answer, rationale with source)
- Per module: 1-2 case questions (150-300 words, marking rubric)
- MCQs test application/analysis/evaluation (not pure recall)
- Cases: realistic, recent (≤5 years), anonymised if needed
- Map to Learning Outcomes and Assessment Criteria

**Section 8 — Glossary and Key Terms:**
- 30-50 key terms
- Each: Definition (≤30 words) with APA 7 citation

**Section 9 — Case Studies:**
- 2-3 recent (≤5 years) real or anonymised cases (150-300 words each)
- Organisation, situation description, learning takeaways (2-3 points)
- Source citation (APA 7) and link

**Section 10 — Delivery & Digital Tools:**
- Delivery mode (self-study), interactive elements
- LMS features (SCORM/xAPI, progress tracking, timed assessments)
- Digital tools, minimum technical requirements

**Section 11 — Review & Metadata:**
- Author name, credentials, organisation, submission date
- Conflict of interest disclosure, reviewer notes
- QA checklist verification

**Section 12 — Outcome Writing Guide:**
- Templates, example outcomes, approved verbs

**Section 13 — Comparative Benchmarking:**
- 2-3 competitor certifications comparison

**Quality Assurance:**
- Module code format: {MODULE_CODE_FORMAT} (consistent)
- Learning outcomes: Verb + Object + Context
- MCQs: plausible distractors, correct answer + rationale with source
- Case questions: marking rubric with banded marks
- Glossary: ≤30 words each with citation
- All sources accessible and valid (include verification date)
- No duplicate sources across unrelated topics

**Submission checklist:**
- Excel workbook with all 14 tabs fully completed
- Word Submission Guide with decisions, notes, conflict of interest, QA checklist
- File naming: {FILE_NAMING_CONVENTION}
- All links/DOIs verified and working

**Work methodically:**
1. Draft Competency Framework first
2. Then Learning Outcomes
3. Map to modules and assessments
4. Source each topic
5. Run QA checklist before finalizing

Begin by producing the Excel workbook content. If you need clarifications, ask one focused question before starting.`;

class PromptLibraryService {
  /**
   * Get all prompts with optional filters
   */
  async getPrompts(
    filters: {
      domain?: string;
      level?: string;
      status?: string;
      search?: string;
    } = {}
  ): Promise<ICoursePrompt[]> {
    try {
      const query: any = {};

      if (filters.domain) query.domain = filters.domain;
      if (filters.level) query.level = filters.level;
      if (filters.status) query.status = filters.status;
      else query.status = 'active'; // Default to active prompts

      // Search in title or domain
      if (filters.search) {
        query.$or = [
          { promptTitle: { $regex: filters.search, $options: 'i' } },
          { domain: { $regex: filters.search, $options: 'i' } },
          { courseCode: { $regex: filters.search, $options: 'i' } },
        ];
      }

      const prompts = await CoursePrompt.find(query)
        .sort({ usageCount: -1, createdAt: -1 })
        .populate('createdBy', 'email profile')
        .populate('variantOf', 'promptTitle courseCode')
        .populate('relatedCourses', 'promptTitle courseCode')
        .lean();

      loggingService.info('Prompts retrieved', {
        count: prompts.length,
        filters,
      });

      return prompts;
    } catch (error) {
      loggingService.error('Error retrieving prompts', { error, filters });
      throw error;
    }
  }

  /**
   * Get single prompt by ID
   */
  async getPromptById(promptId: string): Promise<ICoursePrompt | null> {
    try {
      const prompt = await CoursePrompt.findById(promptId)
        .populate('createdBy', 'email profile')
        .populate('variantOf', 'promptTitle courseCode')
        .populate('relatedCourses', 'promptTitle courseCode')
        .lean();

      if (!prompt) {
        loggingService.warn('Prompt not found', { promptId });
        return null;
      }

      return prompt;
    } catch (error) {
      loggingService.error('Error retrieving prompt by ID', { error, promptId });
      throw error;
    }
  }

  /**
   * Create new course prompt with AGI template
   */
  async createPrompt(promptData: Partial<ICoursePrompt>, userId: string): Promise<ICoursePrompt> {
    try {
      // Generate full prompt template with placeholders replaced
      const fullPromptTemplate = this.generateFullPrompt(promptData);

      const prompt = new CoursePrompt({
        ...promptData,
        fullPromptTemplate,
        createdBy: userId,
        status: promptData.status || 'draft',
        usageCount: 0,
      });

      await prompt.save();

      loggingService.info('Course prompt created', {
        promptId: prompt._id,
        courseCode: prompt.courseCode,
        userId,
      });

      return prompt;
    } catch (error) {
      loggingService.error('Error creating prompt', { error, promptData });
      throw error;
    }
  }

  /**
   * Initialize curriculum project from prompt
   */
  async initializeProject(
    promptId: string,
    smeId: string
  ): Promise<{
    projectId: string;
    projectName: string;
    courseCode: string;
    currentStage: number;
    status: string;
  }> {
    try {
      const prompt = await CoursePrompt.findById(promptId);

      if (!prompt) {
        throw new Error('Prompt not found');
      }

      // Increment usage count
      if (typeof (prompt as any).incrementUsage === 'function') {
        await (prompt as any).incrementUsage();
      } else {
        prompt.usageCount += 1;
        prompt.lastUsed = new Date();
        await prompt.save();
      }

      // Create new curriculum project
      const project = new CurriculumProject({
        promptId: prompt._id,
        smeId,
        projectName: prompt.promptTitle,
        courseCode: prompt.courseCode,
        status: 'prompt_selected',
        currentStage: 1,
        stageProgress: {
          stage1: {
            completedAt: new Date(),
            promptSelected: prompt._id,
          },
        },
      });

      await project.save();

      loggingService.info('Curriculum project initialized', {
        projectId: project._id,
        promptId,
        smeId,
        courseCode: prompt.courseCode,
      });

      return {
        projectId: project._id.toString(),
        projectName: project.projectName,
        courseCode: project.courseCode,
        currentStage: project.currentStage,
        status: project.status,
      };
    } catch (error) {
      loggingService.error('Error initializing project', { error, promptId, smeId });
      throw error;
    }
  }

  /**
   * Get available domains for filtering
   */
  async getAvailableDomains(): Promise<string[]> {
    try {
      const domains = await CoursePrompt.distinct('domain', { status: 'active' });
      return domains.sort();
    } catch (error) {
      loggingService.error('Error getting domains', { error });
      throw error;
    }
  }

  /**
   * Generate full prompt template with placeholders replaced
   */
  private generateFullPrompt(promptData: Partial<ICoursePrompt>): string {
    let template = AGI_SME_SUBMISSION_TEMPLATE;

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{DOMAIN}': promptData.domain || '{DOMAIN}',
      '{COURSE_TITLE}': promptData.promptTitle || '{COURSE_TITLE}',
      '{QUALIFICATION_TYPE}':
        promptData.agiTemplate?.programOverview?.qualificationType ||
        'Certification Preparation Course',
      '{MODULE_CODE_FORMAT}': promptData.agiTemplate?.courseFramework?.moduleCodeFormat || 'MOD###',
      '{FILE_NAMING_CONVENTION}':
        promptData.agiTemplate?.deliverables?.fileNamingConvention || 'CourseCode_SMEName_YYYYMMDD',
      '{DOMAIN_COUNT}':
        promptData.agiTemplate?.competencyFramework?.knowledgeDomains?.length?.toString() || '5-8',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return template;
  }

  /**
   * Create variant of existing prompt
   */
  async createVariant(
    basePromptId: string,
    variantData: Partial<ICoursePrompt>,
    userId: string
  ): Promise<ICoursePrompt> {
    try {
      const basePrompt = await CoursePrompt.findById(basePromptId);

      if (!basePrompt) {
        throw new Error('Base prompt not found');
      }

      // Merge base prompt data with variant data
      const variantPrompt = await this.createPrompt(
        {
          ...basePrompt.toObject(),
          ...variantData,
          variantOf: basePrompt._id,
          _id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        },
        userId
      );

      // Add to related courses of base prompt
      basePrompt.relatedCourses.push(variantPrompt._id);
      await basePrompt.save();

      loggingService.info('Prompt variant created', {
        basePromptId,
        variantId: variantPrompt._id,
        userId,
      });

      return variantPrompt;
    } catch (error) {
      loggingService.error('Error creating variant', { error, basePromptId });
      throw error;
    }
  }

  /**
   * Seeds the database with initial AGI-compliant course prompts, including the CHRP template.
   * This method is idempotent.
   */
  async seedInitialPrompts(): Promise<void> {
    loggingService.info('Attempting to seed initial course prompts...');

    const mongoose = await import('mongoose');

    const promptsToSeed = [
      {
        promptTitle: 'CHRP Certification Preparation Course',
        courseCode: 'CHRP-PREP',
        domain: 'Human Resource Management',
        level: 'certificate' as const,
        totalHours: 120,
        ectsCredits: 15,
        moduleCount: 6,
        learningObjectives: [
          'Understand core HR functions and their strategic importance.',
          'Apply employment law principles to HR practices.',
          'Develop effective talent acquisition and management strategies.',
          'Design compensation and benefits programs.',
          'Implement learning and development initiatives.',
          'Utilize HR analytics for data-driven decision making.',
        ],
        targetAudience: 'HR professionals seeking CHRP certification, HR generalists, HR managers.',
        prerequisites: ["Minimum 2 years HR experience or relevant bachelor's degree."],
        curriculumRules: {
          agiCompliance: true,
          bloomTaxonomyLevels: ['Apply', 'Analyze', 'Evaluate', 'Design', 'Implement', 'Justify'],
          assessmentTypes: ['MCQ', 'Case Study', 'Practical Exercise'],
          sourceRecencyYears: 5,
          citationFormat: 'APA 7',
        },
        status: 'active' as const,
        createdBy: new mongoose.default.Types.ObjectId('000000000000000000000001'), // Placeholder Admin User ID
      },
      {
        promptTitle: 'Advanced Data Analytics Professional Certificate',
        courseCode: 'ADA-CERT',
        domain: 'Data Analytics',
        level: 'certificate' as const,
        totalHours: 150,
        ectsCredits: 20,
        moduleCount: 8,
        learningObjectives: [
          'Master advanced statistical analysis techniques.',
          'Apply machine learning algorithms to business problems.',
          'Develop data visualization and reporting skills.',
          'Understand big data technologies and their applications.',
          'Implement data governance and ethics principles.',
        ],
        targetAudience: 'Data analysts, business intelligence professionals, data scientists.',
        prerequisites: ['Proficiency in Python/R, basic statistics, and SQL.'],
        curriculumRules: {
          agiCompliance: true,
          bloomTaxonomyLevels: ['Apply', 'Analyze', 'Evaluate', 'Create'],
          assessmentTypes: ['Project', 'Case Study', 'Coding Challenge'],
          sourceRecencyYears: 5,
          citationFormat: 'APA 7',
        },
        status: 'active' as const,
        createdBy: new mongoose.default.Types.ObjectId('000000000000000000000001'), // Placeholder Admin User ID
      },
    ];

    for (const promptData of promptsToSeed) {
      const existingPrompt = await CoursePrompt.findOne({ promptTitle: promptData.promptTitle });
      if (!existingPrompt) {
        await this.createPrompt(promptData, promptData.createdBy.toString());
        loggingService.info(`✅ Created prompt: ${promptData.promptTitle}`);
      } else {
        loggingService.info(`✓ Prompt "${promptData.promptTitle}" already exists, skipping.`);
      }
    }
    loggingService.info('Initial course prompts seeding complete.');
  }
}

/**
 * Singleton instance
 */
const promptLibraryServiceInstance = new PromptLibraryService();

// Export both the class and instance for flexibility
export { PromptLibraryService };
export const promptLibraryService = promptLibraryServiceInstance;
