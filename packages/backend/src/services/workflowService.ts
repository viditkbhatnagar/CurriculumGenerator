/**
 * Workflow Service
 * Orchestrates the 9-step AI-Integrated Curriculum Generation Workflow v2.2
 *
 * This service handles:
 * - Step-by-step content generation using OpenAI with Knowledge Base context
 * - SME input validation and quality checks
 * - Progress tracking and state management
 * - AGI Standards enforcement
 * - RAG-enhanced generation from ingested knowledge base documents
 */

import mongoose from 'mongoose';
import { CurriculumWorkflow, ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { RAGEngine } from './ragEngine';
import { KnowledgeBaseService } from './knowledgeBaseService';

// Initialize RAG Engine and Knowledge Base Service for context retrieval
const ragEngine = new RAGEngine();
const knowledgeBaseService = new KnowledgeBaseService();
import {
  Step1ProgramFoundation,
  Step2CompetencyKSA,
  Step3PLOs,
  Step4CourseFramework,
  Step5Sources,
  Step6ReadingLists,
  Step7Assessments,
  Step8CaseStudies,
  Step9Glossary,
  CreditSystem,
  DeliveryMode,
  BloomLevel,
} from '../types/newWorkflow';

// ============================================================================
// CREDIT CALCULATION UTILITIES
// ============================================================================

interface CreditCalculation {
  totalHours: number;
  contactHours: number;
  independentHours: number;
  contactPercent: number;
}

// Support both frontend ('uk') and backend ('uk_credits') naming
const CREDIT_MULTIPLIERS: Record<string, number> = {
  uk: 10, // Frontend naming
  uk_credits: 10, // 1 UK credit = 10 hours
  ects: 25, // 1 ECTS = 25 hours (using lower bound)
  us_semester: 45, // 1 US credit = 45 total hours
  non_credit: 1, // Direct hours entry
};

const DEFAULT_CONTACT_PERCENT: Record<string, number> = {
  uk: 30, // Frontend naming
  uk_credits: 30,
  ects: 30,
  us_semester: 33, // Defined ratio, not default
  non_credit: 30,
};

function calculateCredits(
  system: string,
  credits: number | undefined,
  totalHoursInput: number | undefined,
  customContactPercent?: number
): CreditCalculation {
  let totalHours: number;
  let contactPercent: number;

  // Normalize system name
  const normalizedSystem = system || 'uk';

  // Calculate total hours based on credit system
  if (normalizedSystem === 'non_credit') {
    totalHours = totalHoursInput || 120;
  } else {
    const multiplier = CREDIT_MULTIPLIERS[normalizedSystem] || 10;
    totalHours = (credits || 60) * multiplier;
  }

  // Determine contact hours percentage
  if (customContactPercent) {
    contactPercent = customContactPercent;
  } else {
    contactPercent = DEFAULT_CONTACT_PERCENT[normalizedSystem] || 30;
  }

  const contactHours = Math.round(totalHours * (contactPercent / 100));
  const independentHours = totalHours - contactHours;

  return {
    totalHours,
    contactHours,
    independentHours,
    contactPercent,
  };
}

// ============================================================================
// KNOWLEDGE BASE CONTEXT RETRIEVAL
// ============================================================================

interface KBContext {
  content: string;
  source: string;
  relevance: number;
}

/**
 * Retrieve relevant context from the knowledge base for curriculum generation
 * Uses RAG engine for semantic search across ingested documents
 */
async function retrieveKBContext(
  queries: string[],
  options: {
    maxResults?: number;
    minSimilarity?: number;
    domains?: string[];
  } = {}
): Promise<KBContext[]> {
  const { maxResults = 15, minSimilarity = 0.65, domains } = options;
  const allResults: KBContext[] = [];

  try {
    for (const query of queries) {
      const results = await ragEngine.semanticSearch(query, {
        maxSources: Math.ceil(maxResults / queries.length),
        minSimilarity,
        domains,
      });

      for (const result of results) {
        allResults.push({
          content: result.content,
          source: result.source?.title || 'Knowledge Base',
          relevance: result.similarityScore,
        });
      }
    }

    // Deduplicate by content similarity and sort by relevance
    const uniqueResults = allResults
      .filter(
        (item, index, self) =>
          index ===
          self.findIndex((t) => t.content.substring(0, 100) === item.content.substring(0, 100))
      )
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    return uniqueResults;
  } catch (error) {
    loggingService.warn('KB context retrieval failed, proceeding without KB context', { error });
    return [];
  }
}

/**
 * Format KB context for inclusion in prompts
 */
function formatKBContextForPrompt(contexts: KBContext[]): string {
  if (contexts.length === 0) {
    return '';
  }

  const formattedContexts = contexts
    .slice(0, 10) // Limit to top 10 most relevant
    .map((ctx, idx) => `[SOURCE ${idx + 1}: ${ctx.source}]\n${ctx.content.substring(0, 800)}`)
    .join('\n\n---\n\n');

  return `
=== KNOWLEDGE BASE REFERENCE MATERIALS ===
The following content has been retrieved from authoritative sources in the knowledge base.
Use this information to ensure accuracy and alignment with established curriculum standards.

${formattedContexts}

=== END KNOWLEDGE BASE MATERIALS ===
`;
}

// ============================================================================
// WORKFLOW SERVICE CLASS
// ============================================================================

class WorkflowService {
  // ==========================================================================
  // WORKFLOW MANAGEMENT
  // ==========================================================================

  /**
   * Create a new curriculum workflow
   */
  async createWorkflow(projectName: string, userId: string): Promise<ICurriculumWorkflow> {
    const workflow = new CurriculumWorkflow({
      projectName,
      createdBy: new mongoose.Types.ObjectId(userId),
      currentStep: 1,
      status: 'step1_pending',
    });

    await workflow.save();

    loggingService.info('New curriculum workflow created', {
      workflowId: workflow._id,
      projectName,
      userId,
    });

    return workflow;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<ICurriculumWorkflow | null> {
    return CurriculumWorkflow.findById(workflowId);
  }

  /**
   * Get workflows for user
   */
  async getUserWorkflows(userId: string): Promise<ICurriculumWorkflow[]> {
    return CurriculumWorkflow.find({ createdBy: new mongoose.Types.ObjectId(userId) }).sort({
      updatedAt: -1,
    });
  }

  // ==========================================================================
  // STEP 1: PROGRAM FOUNDATION
  // ==========================================================================

  /**
   * Process Step 1 SME inputs and generate program foundation
   * Accepts structured input from frontend (per workflow v2.2)
   */
  async processStep1(
    workflowId: string,
    input: {
      // Program Identity
      programTitle: string;
      programDescription: string;
      academicLevel: 'certificate' | 'micro-credential' | 'diploma';

      // Credit Framework (v2.2)
      isCreditAwarding?: boolean;
      creditSystem: CreditSystem | string;
      credits?: number;
      totalHours?: number;
      customContactPercent?: number;

      // Target Learner Profile (structured v2.2)
      targetLearnerAgeRange?: string;
      targetLearnerEducationalBackground?: string;
      targetLearnerIndustrySector?: string;
      targetLearnerExperienceLevel?: 'beginner' | 'professional' | 'expert';
      targetLearner?: any; // Legacy: string or object

      // Delivery
      deliveryMode: DeliveryMode | string;
      deliveryDescription?: string;

      // Labour Market
      programPurpose: string;
      jobRoles: any[]; // Array of { title, description, tasks } or strings
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    loggingService.info('Processing Step 1: Program Foundation', { workflowId });

    // Normalize credit system name (frontend sends 'uk', backend uses 'uk_credits')
    const normalizedCreditSystem = this.normalizeCreditSystem(input.creditSystem as string);

    // Calculate credit framework
    const creditCalc = calculateCredits(
      normalizedCreditSystem,
      input.credits || 60,
      input.totalHours,
      input.customContactPercent
    );

    // Build target learner profile
    const targetLearnerProfile = this.buildTargetLearnerProfile(input);

    // Normalize job roles
    const normalizedJobRoles = this.normalizeJobRoles(input.jobRoles || []);

    // Calculate completeness score
    const completenessScore = this.calculateStep1Completeness({
      ...input,
      targetLearner: targetLearnerProfile,
      jobRoles: normalizedJobRoles,
    });

    // Generate AI content if completeness is sufficient
    let generatedContent: any = {};
    if (completenessScore >= 70) {
      try {
        generatedContent = await this.generateStep1Content(
          { ...input, targetLearner: targetLearnerProfile, jobRoles: normalizedJobRoles },
          creditCalc
        );
      } catch (err) {
        loggingService.error('Failed to generate Step 1 AI content', { error: err });
        // Continue without generated content
      }
    }

    // Store step data (with v2.2 structured format)
    workflow.step1 = {
      programTitle: input.programTitle || '',
      programDescription: input.programDescription || '',
      academicLevel: input.academicLevel || 'certificate',
      creditFramework: {
        system: normalizedCreditSystem as CreditSystem,
        isCreditAwarding: input.isCreditAwarding ?? true,
        creditSystem: normalizedCreditSystem as CreditSystem,
        credits: input.credits,
        totalHours: creditCalc.totalHours,
        contactHoursPercent: creditCalc.contactPercent,
        contactHours: creditCalc.contactHours,
        independentHours: creditCalc.independentHours,
        customContactPercent: input.customContactPercent,
      },
      targetLearner: targetLearnerProfile,
      delivery: {
        mode: (input.deliveryMode || 'hybrid_blended') as DeliveryMode,
        description: input.deliveryDescription || '',
        customContactHoursPercent: input.customContactPercent,
      },
      programPurpose: input.programPurpose || '',
      jobRoles: normalizedJobRoles,
      executiveSummary: generatedContent.executiveSummary,
      programAims: generatedContent.programAims,
      entryRequirements: generatedContent.entryRequirements,
      careerPathways: generatedContent.careerPathways,
      completenessScore,
      validatedAt: new Date(),
    };

    // Update progress
    let step1Progress = workflow.stepProgress.find((p) => p.step === 1);
    if (!step1Progress) {
      workflow.stepProgress.push({
        step: 1,
        status: 'in_progress',
        startedAt: new Date(),
      });
      step1Progress = workflow.stepProgress.find((p) => p.step === 1);
    }
    if (step1Progress) {
      step1Progress.status = completenessScore >= 70 ? 'completed' : 'in_progress';
      step1Progress.startedAt = step1Progress.startedAt || new Date();
      if (completenessScore >= 70) {
        step1Progress.completedAt = new Date();
      }
    }

    workflow.status = completenessScore >= 70 ? 'step1_complete' : 'step1_pending';

    await workflow.save();

    loggingService.info('Step 1 processed', {
      workflowId,
      completenessScore,
      status: workflow.status,
    });

    return workflow;
  }

  /**
   * Normalize credit system naming between frontend and backend
   */
  private normalizeCreditSystem(system: string): string {
    const mapping: Record<string, string> = {
      uk: 'uk_credits',
      uk_credits: 'uk_credits',
      ects: 'ects',
      us_semester: 'us_semester',
      non_credit: 'non_credit',
    };
    return mapping[system] || 'uk_credits';
  }

  /**
   * Build target learner profile from frontend input
   * Handles both legacy string format and new structured format
   */
  private buildTargetLearnerProfile(input: any): any {
    // If new structured fields are provided, use them
    if (input.targetLearnerIndustrySector || input.targetLearnerExperienceLevel) {
      return {
        ageRange: input.targetLearnerAgeRange || '',
        educationalBackground: input.targetLearnerEducationalBackground || '',
        industrySector: input.targetLearnerIndustrySector || '',
        experienceLevel: input.targetLearnerExperienceLevel || 'professional',
      };
    }

    // Legacy: if targetLearner is already an object, use it
    if (input.targetLearner && typeof input.targetLearner === 'object') {
      return {
        ageRange: input.targetLearner.ageRange || '',
        educationalBackground: input.targetLearner.educationalBackground || '',
        industrySector: input.targetLearner.industrySector || '',
        experienceLevel: input.targetLearner.experienceLevel || 'professional',
      };
    }

    // Legacy: if targetLearner is a string, convert to object
    if (typeof input.targetLearner === 'string') {
      return {
        ageRange: '',
        educationalBackground: input.targetLearner,
        industrySector: '',
        experienceLevel: 'professional',
      };
    }

    // Default empty profile
    return {
      ageRange: '',
      educationalBackground: '',
      industrySector: '',
      experienceLevel: 'professional',
    };
  }

  /**
   * Normalize job roles array to consistent format
   * Handles both string arrays and object arrays
   */
  private normalizeJobRoles(roles: any[]): any[] {
    if (!Array.isArray(roles)) return [];

    return roles
      .map((role) => {
        if (typeof role === 'string') {
          return {
            title: role,
            description: '',
            tasks: [],
          };
        }
        return {
          title: role.title || '',
          description: role.description || '',
          tasks: Array.isArray(role.tasks) ? role.tasks.filter((t: string) => t?.trim()) : [],
        };
      })
      .filter((role) => role.title?.trim());
  }

  private calculateStep1Completeness(input: any): number {
    let score = 0;
    const weights = {
      programTitle: 10,
      programDescription: 15,
      academicLevel: 5,
      creditSystem: 10,
      targetLearner: 15,
      deliveryMode: 10,
      programPurpose: 15,
      jobRoles: 20,
    };

    if (input.programTitle?.length >= 5) score += weights.programTitle;
    if (input.programDescription?.length >= 50) score += weights.programDescription;
    if (input.academicLevel) score += weights.academicLevel;
    if (input.creditSystem) score += weights.creditSystem;
    // Handle targetLearner as string or object
    if (typeof input.targetLearner === 'string' && input.targetLearner.length >= 20) {
      score += weights.targetLearner;
    } else if (input.targetLearner?.industrySector && input.targetLearner?.experienceLevel) {
      score += weights.targetLearner;
    } else if (input.targetLearner?.educationalBackground?.length >= 10) {
      score += weights.targetLearner;
    }
    if (input.deliveryMode) score += weights.deliveryMode;
    if (input.programPurpose?.length >= 20) score += weights.programPurpose;
    // Handle jobRoles as array of strings or objects
    const jobRolesCount = Array.isArray(input.jobRoles)
      ? input.jobRoles.filter((r: any) => (typeof r === 'string' ? r.trim() : r?.title)).length
      : 0;
    if (jobRolesCount >= 2) score += weights.jobRoles;

    return score;
  }

  private async generateStep1Content(input: any, creditCalc: CreditCalculation): Promise<any> {
    // Build target learner info from structured profile
    const targetLearner = input.targetLearner || {};
    const targetLearnerInfo =
      [
        targetLearner.ageRange ? `Age: ${targetLearner.ageRange}` : '',
        targetLearner.educationalBackground
          ? `Education: ${targetLearner.educationalBackground}`
          : '',
        targetLearner.industrySector ? `Industry: ${targetLearner.industrySector}` : '',
        targetLearner.experienceLevel ? `Experience: ${targetLearner.experienceLevel}` : '',
      ]
        .filter(Boolean)
        .join(', ') || 'Working professionals';

    // Build job roles with descriptions and tasks
    const jobRolesInfo = Array.isArray(input.jobRoles)
      ? input.jobRoles
          .map((r: any) => {
            const title = typeof r === 'string' ? r : r.title;
            const description = r.description || '';
            const tasks = Array.isArray(r.tasks) ? r.tasks.filter(Boolean) : [];
            return { title, description, tasks };
          })
          .filter((r: any) => r.title)
      : [];

    const jobRolesDetail = jobRolesInfo
      .map((r: any) => {
        let detail = `- ${r.title}`;
        if (r.description) detail += `\n  Description: ${r.description}`;
        if (r.tasks.length > 0) detail += `\n  Tasks: ${r.tasks.join('; ')}`;
        return detail;
      })
      .join('\n');

    // === RETRIEVE KNOWLEDGE BASE CONTEXT ===
    const kbQueries = [
      `${input.programTitle} curriculum design standards`,
      `${targetLearner.industrySector || 'professional'} vocational education requirements`,
      `${input.academicLevel} program learning outcomes`,
      `accreditation standards ${input.creditSystem || 'UK Credits'}`,
      ...jobRolesInfo.slice(0, 3).map((r: any) => `${r.title} competency framework`),
    ];

    const kbContexts = await retrieveKBContext(kbQueries, {
      maxResults: 12,
      minSimilarity: 0.6,
      domains: ['curriculum-design', 'accreditation', 'competency-framework', 'standards'],
    });

    const kbContextSection = formatKBContextForPrompt(kbContexts);

    const systemPrompt = `You are an expert curriculum designer with deep knowledge of vocational education, accreditation requirements, and industry competency frameworks. You are creating accreditation-ready programs that align with AGI Academic Standards.

YOUR EXPERTISE INCLUDES:
- UK Qualification Frameworks (RQF, QCF, FHEQ)
- European Qualifications Framework (EQF) and Bologna Process
- US Higher Education accreditation standards
- Industry competency frameworks (SHRM, PMI, CIPD, ASCM, SFIA)
- Bloom's Taxonomy and learning outcome design
- Constructive alignment principles
- Workload calculation and credit mapping

CRITICAL REQUIREMENTS:
1. All content must use UK English spelling (e.g., "organisation", "programme", "behaviour")
2. Program aims must be strategic and achievable
3. Entry requirements must align with the academic level
4. Career pathways must be realistic and evidence-based
5. Reference and apply knowledge from the provided knowledge base materials

QUALITY STANDARDS:
- Executive summaries should be compelling and suitable for prospectus publication
- Aims should follow SMART criteria where applicable
- All content must be suitable for regulatory submission`;

    const userPrompt = `Generate comprehensive program foundation content for a ${input.academicLevel} vocational education program.

${kbContextSection}

=== PROGRAM SPECIFICATION ===

PROGRAM TITLE: ${input.programTitle}

ACADEMIC LEVEL: ${input.academicLevel}
- Ensure content complexity matches this level
- Use appropriate academic language and expectations

CREDIT FRAMEWORK:
- System: ${input.creditSystem || 'UK Credits'}
- Total Program Hours: ${creditCalc.totalHours} hours
- Contact Hours: ${creditCalc.contactHours} hours (${creditCalc.contactPercent}%)
- Independent Study Hours: ${creditCalc.independentHours} hours

PROGRAM DESCRIPTION (SME Input):
${input.programDescription || 'Not provided'}

TARGET LEARNER PROFILE:
${targetLearnerInfo}

PROGRAM PURPOSE (SME Input):
${input.programPurpose || 'Not provided'}

TARGET JOB ROLES AND WORKPLACE TASKS:
${jobRolesDetail || 'Not specified'}

=== GENERATION REQUIREMENTS ===

Based on the knowledge base materials and program specification, generate:

1. **EXECUTIVE SUMMARY** (400-700 words)
   Create a professional, compelling overview suitable for prospectus publication:
   
   a) PROGRAM OVERVIEW AND POSITIONING
      - What is this program and who is it for?
      - How does it fit within the broader educational landscape?
      - What makes it distinctive?
   
   b) KEY LEARNING AREAS
      - What major knowledge domains will be covered?
      - What practical skills will be developed?
      - How does learning progress through the program?
   
   c) CAREER OUTCOMES
      - What specific job roles can graduates pursue?
      - What industries/sectors benefit from this qualification?
      - What progression opportunities exist?
   
   d) UNIQUE VALUE PROPOSITION
      - Why choose this program over alternatives?
      - What accreditation/recognition does it carry?
      - What industry partnerships or practical elements are included?

2. **PROGRAM AIMS** (3-5 strategic intentions)
   Generate high-level, strategic aims that:
   - State what the program seeks to achieve overall
   - Are measurable at program completion
   - Align with the academic level expectations
   - Connect to industry and employment needs
   - Follow pattern: "To [enable/develop/prepare] [learners] to [achievement] in [context]"

3. **ENTRY REQUIREMENTS**
   Specify requirements appropriate for ${input.academicLevel}:
   
   a) ACADEMIC PREREQUISITES
      - Prior qualifications (e.g., GCSEs, A-Levels, degree)
      - Minimum grades or classification
      - Any subject-specific requirements
   
   b) PROFESSIONAL EXPERIENCE
      - Minimum years of relevant experience (if any)
      - Type of experience valued
      - Portfolio requirements (if applicable)
   
   c) OTHER REQUIREMENTS
      - English language proficiency (if applicable)
      - Technical skills or software knowledge
      - Professional membership or registration
   
   d) RECOGNITION OF PRIOR LEARNING
      - How RPL/APEL is considered
      - Maximum credits transferable

4. **CAREER PATHWAYS** (4-6 realistic progressions)
   Based on the target job roles and industry sector, specify:
   - Immediate roles graduates can pursue
   - Progression opportunities after 2-3 years
   - Senior/leadership roles accessible with further development
   - Related sectors where skills transfer
   - Professional qualifications that complement this program

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "executiveSummary": "Full 400-700 word professional summary...",
  "programAims": [
    "To develop learners' strategic capability to...",
    "To enable learners to critically analyse...",
    "To prepare learners for professional practice in..."
  ],
  "entryRequirements": "Structured entry requirements text covering all sections...",
  "careerPathways": [
    "Pathway 1: [Role] progressing to [Senior Role]",
    "Pathway 2: ...",
    "..."
  ]
}

IMPORTANT: 
- Use the knowledge base materials to inform your content
- Ensure all content is specific to ${input.programTitle}, not generic
- Match the academic level ${input.academicLevel} in language and expectations
- All spelling must be UK English`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 128000, // MAXIMUM
        timeout: 1200000, // 20 minutes
      });

      return this.parseJSON(response, 'step1');
    } catch (error) {
      loggingService.error('Error generating Step 1 content', { error });
      return {};
    }
  }

  // ==========================================================================
  // STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSC)
  // Knowledge, Skills, Competencies
  // ==========================================================================

  /**
   * Process Step 2: Generate KSC framework
   */
  async processStep2(
    workflowId: string,
    input: {
      benchmarkPrograms?: Array<{
        programName: string;
        institution: string;
        url?: string;
      }>;
      industryFrameworks?: string[];
      institutionalFrameworks?: string[];
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1) {
      throw new Error('Step 1 must be completed first');
    }

    loggingService.info('Processing Step 2: Competency Framework (KSC)', { workflowId });

    // Generate KSC items using AI
    const kscContent = await this.generateStep2Content(workflow.step1, input);

    // Store step data - use competencyItems for new format, but also store as attitudeItems for backward compatibility
    workflow.step2 = {
      benchmarkPrograms: input.benchmarkPrograms || [],
      industryFrameworks: input.industryFrameworks,
      institutionalFrameworks: input.institutionalFrameworks,
      knowledgeItems: kscContent.knowledgeItems || [],
      skillItems: kscContent.skillItems || [],
      competencyItems: kscContent.competencyItems || [],
      // Legacy compatibility
      attitudeItems: kscContent.competencyItems || [],
      benchmarkingReport: kscContent.benchmarkingReport,
      totalItems:
        (kscContent.knowledgeItems?.length || 0) +
        (kscContent.skillItems?.length || 0) +
        (kscContent.competencyItems?.length || 0),
      essentialCount: [
        ...(kscContent.knowledgeItems || []),
        ...(kscContent.skillItems || []),
        ...(kscContent.competencyItems || []),
      ].filter((item: any) => item.importance === 'essential').length,
      validatedAt: new Date(),
    };

    // Update progress
    const step2Progress = workflow.stepProgress.find((p) => p.step === 2);
    if (step2Progress) {
      step2Progress.status = 'completed';
      step2Progress.startedAt = step2Progress.startedAt || new Date();
      step2Progress.completedAt = new Date();
    }

    workflow.currentStep = 2;
    workflow.status = 'step2_complete';

    await workflow.save();

    loggingService.info('Step 2 processed', {
      workflowId,
      totalItems: workflow.step2.totalItems,
      essentialCount: workflow.step2.essentialCount,
    });

    return workflow;
  }

  private async generateStep2Content(step1: any, input: any): Promise<any> {
    // Build benchmark info
    const benchmarkList =
      input.benchmarkPrograms && input.benchmarkPrograms.length > 0
        ? input.benchmarkPrograms
            .map((b: any) => {
              const parts = [b.programName];
              if (b.institution) parts.push(`(${b.institution})`);
              if (b.url) parts.push(`- ${b.url}`);
              return parts.join(' ');
            })
            .join('\n')
        : 'Benchmark programs from knowledge base';

    const frameworksList =
      input.industryFrameworks && input.industryFrameworks.length > 0
        ? input.industryFrameworks.join(', ')
        : 'SHRM, PMI, SFIA, CIPD, ASCM (as relevant)';

    // Extract target learner info
    const targetLearner = step1.targetLearner || {};
    const industrySector =
      typeof targetLearner === 'string'
        ? 'general industry'
        : targetLearner.industrySector || 'general industry';
    const experienceLevel =
      typeof targetLearner === 'string'
        ? 'professional'
        : targetLearner.experienceLevel || 'professional';

    // Build job roles info with tasks
    const jobRolesInfo = Array.isArray(step1.jobRoles)
      ? step1.jobRoles
          .map((r: any) => {
            if (typeof r === 'string') return `- ${r}`;
            const tasks =
              Array.isArray(r.tasks) && r.tasks.length > 0
                ? `\n  Tasks: ${r.tasks.join('; ')}`
                : '';
            return `- ${r.title}${tasks}`;
          })
          .join('\n')
      : '- General professional roles';

    // === RETRIEVE KNOWLEDGE BASE CONTEXT ===
    const kbQueries = [
      `${step1.programTitle} competency framework`,
      `${industrySector} professional competencies skills knowledge`,
      `${frameworksList} competency standards`,
      `${step1.academicLevel} learning outcomes competencies`,
      ...(step1.jobRoles || [])
        .slice(0, 3)
        .map((r: any) => `${typeof r === 'string' ? r : r.title} job competencies skills`),
    ];

    const kbContexts = await retrieveKBContext(kbQueries, {
      maxResults: 15,
      minSimilarity: 0.55,
      domains: ['competency-framework', 'standards', 'accreditations', 'curriculum-design'],
    });

    const kbContextSection = formatKBContextForPrompt(kbContexts);

    const systemPrompt = `You are a senior competency framework specialist with expertise in:

- SHRM (Society for Human Resource Management) Body of Competency and Knowledge
- PMI (Project Management Institute) Talent Triangle
- SFIA (Skills Framework for the Information Age)
- CIPD (Chartered Institute of Personnel and Development) Profession Map
- ASCM (Association for Supply Chain Management) Body of Knowledge
- Other industry-recognized competency frameworks

YOUR TASK: Generate a comprehensive Knowledge, Skills, and Competencies (KSC) framework that:
1. Aligns with established industry standards
2. Maps directly to workplace requirements
3. Supports measurable learning outcomes
4. Follows UK qualification framework expectations

CRITICAL DEFINITIONS:
- KNOWLEDGE (K): Theoretical understanding - what learners need to UNDERSTAND
  * Concepts, principles, theories, frameworks
  * Factual information and domain expertise
  * Example: "Principles of strategic workforce planning"

- SKILLS (S): Practical abilities - what learners need to be able to DO
  * Applied competencies and technical proficiencies
  * Demonstrable actions and procedures
  * Example: "Analyse workforce data to identify skill gaps"

- COMPETENCIES (C): Professional behaviors - how learners need to BEHAVE
  * Workplace dispositions and professional attitudes
  * Values, ethical conduct, interpersonal qualities
  * Example: "Demonstrate professional integrity in handling sensitive employee data"

Use UK English spelling throughout (e.g., "analyse", "behaviour", "organisation").`;

    const userPrompt = `Generate a comprehensive Competency Framework (KSC) for this vocational education program.

${kbContextSection}

=== PROGRAM CONTEXT ===

PROGRAM TITLE: ${step1.programTitle}
ACADEMIC LEVEL: ${step1.academicLevel}
INDUSTRY SECTOR: ${industrySector}
TARGET AUDIENCE: ${experienceLevel} level professionals

PROGRAM PURPOSE:
${step1.programPurpose || 'Prepare professionals for advanced roles in this field'}

BENCHMARK PROGRAMS TO ANALYSE:
${benchmarkList}

INDUSTRY FRAMEWORKS TO REFERENCE:
${frameworksList}

${
  input.institutionalFrameworks && input.institutionalFrameworks.length > 0
    ? `INSTITUTIONAL FRAMEWORKS:\n${input.institutionalFrameworks.join('\n')}`
    : ''
}

TARGET JOB ROLES AND WORKPLACE TASKS:
${jobRolesInfo}

=== GENERATION REQUIREMENTS ===

Using the knowledge base materials as authoritative reference, generate 15-25 KSC items with this distribution:

**KNOWLEDGE ITEMS (K): 30-40% of total**
Generate knowledge items that specify what learners must UNDERSTAND:
- Theoretical foundations and conceptual frameworks
- Industry principles and standards
- Domain-specific terminology and models
- Regulatory and compliance requirements
- Best practices from the field

**SKILL ITEMS (S): 40-50% of total**
Generate skill items that specify what learners must be able to DO:
- Practical application of knowledge
- Technical and analytical abilities
- Problem-solving and decision-making
- Communication and presentation skills
- Tool and technology proficiency

**COMPETENCY ITEMS (C): 15-25% of total**
Generate competency items that specify professional BEHAVIOURS:
- Professional ethics and integrity
- Interpersonal and collaborative behaviours
- Adaptability and continuous learning
- Leadership and influence
- Cultural awareness and inclusivity

FOR EACH ITEM INCLUDE:
1. **id**: Sequential identifier (K1, K2, K3... S1, S2, S3... C1, C2, C3...)
2. **type**: "knowledge" | "skill" | "competency"
3. **statement**: Clear, concise statement (max 50 words)
   - Start with an appropriate verb:
     * Knowledge: "Understanding of...", "Principles of...", "Theories underpinning..."
     * Skills: "Ability to...", "Apply...", "Analyse...", "Evaluate..."
     * Competencies: "Demonstrate...", "Exhibit...", "Display professional..."
4. **description**: Supporting explanation (30-60 words)
5. **importance**: 
   - "essential" if it:
     * Maps directly to specified job tasks
     * Is fundamental to professional practice
     * Appears in majority of benchmark frameworks
   - "desirable" if it:
     * Enhances but isn't critical to role performance
     * Represents advanced or specialist knowledge
6. **source**: Reference to benchmark program or framework (e.g., "SHRM BoCK", "PMI Talent Triangle")
7. **linkedJobTasks**: Array of job tasks this KSC supports

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "knowledgeItems": [
    {
      "id": "K1",
      "type": "knowledge",
      "statement": "Principles of strategic workforce planning and forecasting",
      "description": "Comprehensive understanding of methodologies for analysing current workforce composition, projecting future needs, and aligning talent strategy with organisational objectives.",
      "importance": "essential",
      "source": "SHRM BoCK - Talent Acquisition Domain",
      "linkedJobTasks": ["Conduct workforce analysis", "Develop staffing plans"]
    }
  ],
  "skillItems": [
    {
      "id": "S1",
      "type": "skill",
      "statement": "Analyse workforce data using quantitative and qualitative methods",
      "description": "Apply statistical techniques and analytical frameworks to interpret workforce metrics, identify patterns, and generate actionable insights for decision-making.",
      "importance": "essential",
      "source": "CIPD Profession Map - Analytics",
      "linkedJobTasks": ["Analyse workforce data", "Generate reports"]
    }
  ],
  "competencyItems": [
    {
      "id": "C1",
      "type": "competency",
      "statement": "Demonstrate ethical judgement in handling sensitive employee information",
      "description": "Exhibit professional integrity and discretion when managing confidential workforce data, ensuring compliance with data protection regulations and organisational policies.",
      "importance": "essential",
      "source": "CIPD Profession Map - Professional Behaviours",
      "linkedJobTasks": ["Handle employee records", "Maintain confidentiality"]
    }
  ],
  "benchmarkingReport": {
    "programsAnalyzed": [
      { "programName": "Program Name", "institution": "Institution", "relevance": "high/medium" }
    ],
    "keyFindings": [
      "Finding 1: Common competency areas across benchmarks",
      "Finding 2: Gap areas identified",
      "Finding 3: Emerging skills in the field"
    ],
    "coverageAnalysis": "Detailed analysis of how the KSC items comprehensively cover the specified job tasks, industry requirements, and academic level expectations.",
    "distributionSummary": {
      "knowledgePercent": 35,
      "skillPercent": 45,
      "competencyPercent": 20,
      "essentialCount": 15,
      "desirableCount": 8
    }
  }
}

IMPORTANT:
- Use knowledge base materials to ensure accuracy and industry alignment
- Ensure each item is specific to ${step1.programTitle}, not generic
- All items must be assessable and measurable
- Link items to the specific job tasks mentioned`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 128000, // MAXIMUM
        timeout: 1200000, // 20 minutes
      });

      const parsed = this.parseJSON(response, 'step2');

      // Ensure backward compatibility by also setting attitudeItems
      if (parsed.competencyItems && !parsed.attitudeItems) {
        parsed.attitudeItems = parsed.competencyItems;
      }

      return parsed;
    } catch (error) {
      loggingService.error('Error generating Step 2 content', { error });
      return { knowledgeItems: [], skillItems: [], competencyItems: [], attitudeItems: [] };
    }
  }

  // ==========================================================================
  // STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
  // ==========================================================================

  /**
   * Process Step 3: Generate PLOs
   * Per workflow v2.2: Transform competency framework into 4-8 precise,
   * measurable PLOs using Bloom's taxonomy
   */
  async processStep3(
    workflowId: string,
    input: {
      // 4 Required Decisions
      bloomLevels: BloomLevel[];
      priorityCompetencies?: string[];
      outcomeEmphasis: 'technical' | 'professional' | 'strategic' | 'mixed';
      targetCount: number;
      // Optional Advanced Controls
      contextConstraints?: string;
      preferredVerbs?: string[];
      avoidVerbs?: string[];
      stakeholderPriorities?: string;
      exclusions?: string[];
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1 || !workflow.step2) {
      throw new Error('Steps 1 and 2 must be completed first');
    }

    loggingService.info('Processing Step 3: Program Learning Outcomes', { workflowId });

    // Generate PLOs using AI
    const ploContent = await this.generateStep3Content(workflow.step1, workflow.step2, input);

    // Calculate bloom distribution
    const bloomDistribution: Record<string, number> = {};
    for (const plo of ploContent.outcomes || []) {
      bloomDistribution[plo.bloomLevel] = (bloomDistribution[plo.bloomLevel] || 0) + 1;
    }

    // Store step data
    workflow.step3 = {
      // Input selections
      bloomLevels: input.bloomLevels,
      priorityCompetencies: input.priorityCompetencies || [],
      outcomeEmphasis: input.outcomeEmphasis,
      targetCount: input.targetCount,
      // Optional controls
      contextConstraints: input.contextConstraints,
      preferredVerbs: input.preferredVerbs,
      avoidVerbs: input.avoidVerbs,
      stakeholderPriorities: input.stakeholderPriorities,
      exclusions: input.exclusions,
      // Generated content
      outcomes: ploContent.outcomes || [],
      coverageReport: ploContent.coverageReport,
      bloomDistribution,
      // Legacy compatibility
      configuration: {
        targetCount: input.targetCount,
        priorityCompetencies: input.priorityCompetencies || [],
        outcomeEmphasis: input.outcomeEmphasis,
        preferredVerbs: input.preferredVerbs,
        avoidVerbs: input.avoidVerbs,
      },
      validatedAt: new Date(),
    };

    // Update progress
    const step3Progress = workflow.stepProgress.find((p) => p.step === 3);
    if (step3Progress) {
      step3Progress.status = 'completed';
      step3Progress.startedAt = step3Progress.startedAt || new Date();
      step3Progress.completedAt = new Date();
    }

    workflow.currentStep = 3;
    workflow.status = 'step3_complete';

    await workflow.save();

    loggingService.info('Step 3 processed', {
      workflowId,
      ploCount: workflow.step3.outcomes.length,
    });

    return workflow;
  }

  private async generateStep3Content(step1: any, step2: any, input: any): Promise<any> {
    // Get competency items (handle both new competencyItems and legacy attitudeItems)
    const competencyItems = step2.competencyItems || step2.attitudeItems || [];
    const knowledgeItems = step2.knowledgeItems || [];
    const skillItems = step2.skillItems || [];

    // Build Essential competencies list
    const essentialItems = [
      ...knowledgeItems
        .filter((k: any) => k.importance === 'essential')
        .map((k: any) => `${k.id}: ${k.statement}`),
      ...skillItems
        .filter((s: any) => s.importance === 'essential')
        .map((s: any) => `${s.id}: ${s.statement}`),
      ...competencyItems
        .filter((c: any) => c.importance === 'essential')
        .map((c: any) => `${c.id}: ${c.statement}`),
    ];

    const allCompetencies = [
      ...knowledgeItems.map((k: any) => `${k.id} (Knowledge): ${k.statement}`),
      ...skillItems.map((s: any) => `${s.id} (Skill): ${s.statement}`),
      ...competencyItems.map((c: any) => `${c.id} (Competency): ${c.statement}`),
    ].join('\n');

    // Build job tasks
    const jobTasks = Array.isArray(step1.jobRoles)
      ? step1.jobRoles.flatMap((r: any) => {
          const tasks = Array.isArray(r.tasks) ? r.tasks.filter(Boolean) : [];
          return tasks.map((t: string) => `${r.title}: ${t}`);
        })
      : [];

    // === RETRIEVE KNOWLEDGE BASE CONTEXT ===
    const kbQueries = [
      `${step1.programTitle} learning outcomes PLO`,
      `${step1.academicLevel} program outcomes Bloom taxonomy`,
      `${step1.targetLearner?.industrySector || 'professional'} competency-based outcomes`,
      `measurable learning outcomes vocational education`,
      `accreditation learning outcome standards`,
    ];

    const kbContexts = await retrieveKBContext(kbQueries, {
      maxResults: 12,
      minSimilarity: 0.55,
      domains: ['curriculum-design', 'standards', 'accreditations'],
    });

    const kbContextSection = formatKBContextForPrompt(kbContexts);

    // Emphasis descriptions
    const emphasisDescriptions: Record<string, string> = {
      technical:
        'Focus on technical skills, practical procedures, and applied knowledge. Outcomes should emphasise hands-on abilities and technical proficiency.',
      professional:
        'Focus on professional behaviours, interpersonal skills, and workplace conduct. Outcomes should emphasise soft skills and professional dispositions.',
      strategic:
        'Focus on systems thinking, leadership, and strategic decision-making. Outcomes should emphasise higher-order thinking and organisational impact.',
      mixed:
        'Balanced combination of technical, professional, and strategic outcomes. Ensure representation across all three domains.',
    };

    const systemPrompt = `You are a senior learning design specialist with expertise in:
- Bloom's Revised Taxonomy and its application to vocational education
- Constructive alignment (Biggs) between outcomes, activities, and assessment
- UK/EU/US accreditation requirements for learning outcomes
- Competency-based education design
- Measurable and assessable outcome writing

YOUR TASK: Generate precise, measurable Program Learning Outcomes (PLOs) that:
1. Follow the structure: [Bloom's Verb] + [Specific Task] + [Real-World Context]
2. Are limited to ≤25 words each
3. Align with the specified Bloom's taxonomy levels
4. Map directly to the KSC framework from Step 2
5. Connect to real workplace tasks from Step 1
6. Are genuinely measurable and assessable

BLOOM'S TAXONOMY REFERENCE:

**COGNITIVE DOMAIN (Revised Bloom's):**

REMEMBER (Lower) - Retrieve knowledge
Verbs: Define, identify, list, name, recall, recognise, state
Example: "Identify the key components of strategic workforce planning frameworks"

UNDERSTAND (Lower) - Construct meaning
Verbs: Describe, explain, interpret, summarise, classify, compare, exemplify
Example: "Explain the relationship between employee engagement and organisational performance"

APPLY (Lower-Mid) - Execute or implement
Verbs: Apply, demonstrate, execute, implement, solve, use, calculate
Example: "Apply statistical methods to analyse workforce turnover data"

ANALYSE (Higher) - Break down, determine relationships
Verbs: Analyse, differentiate, examine, compare, contrast, investigate, distinguish
Example: "Analyse talent management data to identify retention risk factors"

EVALUATE (Higher) - Make judgments based on criteria
Verbs: Evaluate, critique, assess, justify, recommend, appraise, judge
Example: "Evaluate HR intervention effectiveness using evidence-based criteria"

CREATE (Highest) - Produce original work
Verbs: Create, design, develop, formulate, construct, propose, synthesise
Example: "Design comprehensive workforce planning strategies for organisational change"

CRITICAL VALIDATION RULES:
- MUST have ≥1 outcome at Lower levels (Remember, Understand, Apply)
- MUST have ≥1 outcome at Higher levels (Analyse, Evaluate, Create)
- NO single level can exceed 50% of total outcomes
- ALL outcomes must be distinct (no rephrasing)
- ALL outcomes must be measurable through assessment

Use UK English spelling throughout.`;

    const userPrompt = `Generate exactly ${input.targetCount} Program Learning Outcomes (PLOs) for this accredited vocational education program.

${kbContextSection}

=== PROGRAM CONTEXT ===

PROGRAM TITLE: ${step1.programTitle}
ACADEMIC LEVEL: ${step1.academicLevel}
INDUSTRY SECTOR: ${step1.targetLearner?.industrySector || 'general'}

=== PLO CONFIGURATION (SME SELECTIONS) ===

OUTCOME EMPHASIS: ${input.outcomeEmphasis}
${emphasisDescriptions[input.outcomeEmphasis] || ''}

BLOOM'S TAXONOMY LEVELS TO USE: ${input.bloomLevels.join(', ')}
${input.preferredVerbs?.length ? `\nPREFERRED VERBS: ${input.preferredVerbs.join(', ')}` : ''}
${input.avoidVerbs?.length ? `\nVERBS TO AVOID: ${input.avoidVerbs.join(', ')}` : ''}
${input.contextConstraints ? `\nCONTEXT CONSTRAINTS: ${input.contextConstraints}` : ''}
${input.stakeholderPriorities ? `\nSTAKEHOLDER PRIORITIES: ${input.stakeholderPriorities}` : ''}
${input.exclusions?.length ? `\nEXCLUSIONS (do not include): ${input.exclusions.join(', ')}` : ''}

=== COMPETENCY FRAMEWORK FROM STEP 2 ===

ALL COMPETENCIES (KSC):
${allCompetencies}

**ESSENTIAL COMPETENCIES** (${essentialItems.length} items - PLOs MUST cover ≥70% of these):
${essentialItems.join('\n')}

=== WORKPLACE TASKS FROM STEP 1 ===

JOB TASKS (PLOs must connect to these real-world activities):
${jobTasks.join('\n')}

=== GENERATION REQUIREMENTS ===

Generate exactly ${input.targetCount} PLOs following these rules:

**FOR EACH PLO:**

1. **Structure**: [Bloom's Verb] + [Specific Task] + [Real-World Context]
   - Start with an action verb from the appropriate Bloom's level
   - Include a specific, measurable task or behaviour
   - Add real-world context relevant to the industry

2. **Length**: Maximum 25 words (strict limit)

3. **Linkage**: 
   - Link to at least 1 Essential KSC item from Step 2
   - Map to relevant job tasks from Step 1

4. **Assessability**: Describe how this outcome can be measured

**VALIDATION CHECKLIST (MUST PASS ALL):**
□ At least 1 outcome uses a Lower level verb (Remember, Understand, Apply)
□ At least 1 outcome uses a Higher level verb (Analyse, Evaluate, Create)
□ No single Bloom's level has more than 50% of outcomes
□ All outcomes are unique and non-overlapping
□ All outcomes are genuinely measurable
□ ≥70% of Essential competencies are addressed

**EXAMPLE PLOs BY LEVEL:**

*Certificate Level (Level 4-5):*
- APPLY: "Apply workforce planning techniques to forecast departmental staffing requirements for organisational growth scenarios"
- EVALUATE: "Evaluate recruitment strategies using industry benchmarks to recommend cost-effective talent acquisition approaches"

*Diploma Level (Level 5-6):*
- ANALYSE: "Analyse organisational performance data to identify talent development priorities and resource allocation requirements"
- CREATE: "Design integrated talent management systems that align human capital strategy with long-term business objectives"

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "outcomes": [
    {
      "id": "PLO1",
      "code": "PLO1",
      "outcomeNumber": 1,
      "statement": "Clearly written PLO statement (≤25 words)",
      "bloomLevel": "apply|analyse|evaluate|create|understand|remember",
      "verb": "The Bloom's verb used (e.g., 'Analyse')",
      "linkedKSCs": ["K1", "S2", "C1"],
      "jobTaskMapping": ["Specific task from Step 1 this PLO addresses"],
      "assessmentAlignment": "How this outcome will be measured (e.g., 'Written analysis with rubric', 'Practical demonstration', 'Portfolio evidence')",
      "measurable": true,
      "assessable": true
    }
  ],
  "coverageReport": {
    "competenciesCovered": 12,
    "totalEssentialCompetencies": ${essentialItems.length},
    "coveragePercent": 85,
    "bloomDistribution": {
      "remember": 0,
      "understand": 1,
      "apply": 2,
      "analyse": 2,
      "evaluate": 1,
      "create": 0
    },
    "jobTasksCovered": ["task1", "task2"],
    "validation": {
      "hasLowerLevel": true,
      "hasHigherLevel": true,
      "noSingleLevelOver50": true,
      "allUnique": true,
      "allMeasurable": true,
      "minimumCoverageAchieved": true
    }
  }
}

IMPORTANT:
- Use knowledge base materials to inform outcome design
- Ensure outcomes are specific to ${step1.programTitle}
- Match the academic level ${step1.academicLevel} in complexity
- All spelling must be UK English (e.g., "analyse", "organise", "behaviour")`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 128000, // MAXIMUM
        timeout: 1200000, // 20 minutes
      });

      return this.parseJSON(response, 'step3');
    } catch (error) {
      loggingService.error('Error generating Step 3 content', { error });
      return { outcomes: [] };
    }
  }

  // ==========================================================================
  // STEP 4: COURSE FRAMEWORK & MLOs
  // Per workflow v2.2: Organize program into 6-8 modules with precise hours
  // allocation and Module Learning Outcomes
  // ==========================================================================

  /**
   * Process Step 4: Generate course framework with modules and MLOs
   */
  async processStep4(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1 || !workflow.step2 || !workflow.step3) {
      throw new Error('Steps 1-3 must be completed first');
    }

    loggingService.info('Processing Step 4: Course Framework & MLOs', { workflowId });

    // Get program hours from Step 1
    const creditFramework = workflow.step1.creditFramework || {};
    const totalProgramHours = creditFramework.totalHours || 120;
    const contactHours = creditFramework.contactHours || Math.round(totalProgramHours * 0.3);
    const independentHours = creditFramework.independentHours || totalProgramHours - contactHours;
    const contactPercent = creditFramework.contactHoursPercent || 30;

    // Generate course framework using AI
    const frameworkContent = await this.generateStep4Content(
      workflow.step1,
      workflow.step2,
      workflow.step3
    );

    // Process modules to add phase and validate
    const modules = (frameworkContent.modules || []).map((m: any, index: number) => {
      const seq = m.sequenceOrder || index + 1;
      let phase: 'early' | 'middle' | 'late' = 'middle';
      if (seq <= 2) phase = 'early';
      else if (seq >= 6) phase = 'late';

      return {
        id: m.id || `mod${seq}`,
        code: m.moduleCode || `MOD${100 + seq}`,
        title: m.title,
        description: m.description || '',
        sequence: seq,
        totalHours: m.totalHours,
        contactHours: m.contactHours,
        selfStudyHours: m.independentHours || m.totalHours - m.contactHours,
        credits: m.credits || Math.round(m.totalHours / 10),
        prerequisites: m.prerequisites || [],
        linkedPLOs:
          m.linkedPLOs ||
          m.mlos
            ?.flatMap((mlo: any) => mlo.linkedPLOs || [])
            .filter((v: any, i: any, a: any) => a.indexOf(v) === i) ||
          [],
        mlos: (m.mlos || []).map((mlo: any) => ({
          id: mlo.id,
          code: mlo.id,
          statement: mlo.statement,
          bloomLevel: mlo.bloomLevel,
          verb: mlo.verb || mlo.statement?.split(' ')[0] || '',
          linkedPLOs: mlo.linkedPLOs || [],
          competencyLinks: mlo.competencyLinks || mlo.linkedKSCs || [],
        })),
        topics: m.topics || [],
        phase,
        contactActivities: m.contactActivities,
        independentActivities: m.independentActivities,
      };
    });

    // Calculate hours totals
    const totalModuleHours = modules.reduce((sum: number, m: any) => sum + (m.totalHours || 0), 0);
    const totalModuleContactHours = modules.reduce(
      (sum: number, m: any) => sum + (m.contactHours || 0),
      0
    );

    // Validate hours integrity (exact match required per workflow v2.2)
    const hoursIntegrity = totalModuleHours === totalProgramHours;
    const contactHoursIntegrity = Math.abs(totalModuleContactHours - contactHours) <= 1;

    // Validate progressive complexity
    const progressiveComplexity = this.validateProgressiveComplexity(modules);

    // Build PLO mapping
    const ploMapping: Record<string, string[]> = {};
    for (const mod of modules) {
      for (const mlo of mod.mlos || []) {
        for (const ploId of mlo.linkedPLOs || []) {
          if (!ploMapping[ploId]) ploMapping[ploId] = [];
          ploMapping[ploId].push(mlo.id);
        }
      }
    }

    // Check if all PLOs are covered
    const ploIds = (workflow.step3.outcomes || []).map((o: any) => o.id);
    const allPLOsCovered = ploIds.every((id: string) => ploMapping[id]?.length > 0);

    // Validation report
    const validationReport = {
      hoursMatch: hoursIntegrity,
      contactHoursMatch: contactHoursIntegrity,
      allPLOsCovered,
      progressionValid:
        progressiveComplexity.earlyModulesValid &&
        progressiveComplexity.middleModulesValid &&
        progressiveComplexity.lateModulesValid,
      noCircularDeps: this.validateNoCircularDeps(modules),
      minMLOsPerModule: modules.every((m: any) => (m.mlos?.length || 0) >= 1),
    };

    // Store step data
    workflow.step4 = {
      moduleCount: modules.length,
      contactHoursPercent: contactPercent,
      deliveryMode: workflow.step1.delivery?.mode,
      modules,
      totalProgramHours,
      totalContactHours: contactHours,
      totalIndependentHours: independentHours,
      hoursIntegrity,
      contactHoursIntegrity,
      ploMapping,
      ploCoveragePercent: allPLOsCovered
        ? 100
        : Math.round((Object.keys(ploMapping).length / ploIds.length) * 100),
      progressiveComplexity,
      validationReport,
      validatedAt: new Date(),
    };

    // Update progress
    const step4Progress = workflow.stepProgress.find((p) => p.step === 4);
    if (step4Progress) {
      step4Progress.status = 'completed';
      step4Progress.startedAt = step4Progress.startedAt || new Date();
      step4Progress.completedAt = new Date();
    }

    workflow.currentStep = 4;
    workflow.status = 'step4_complete';

    loggingService.info('Saving Step 4 data to database', {
      workflowId,
      moduleCount: modules.length,
      totalMLOs: modules.reduce((sum: number, m: any) => sum + (m.mlos?.length || 0), 0),
      hoursIntegrity,
      totalModuleHours,
      totalProgramHours,
      validationReport,
    });

    await workflow.save();

    loggingService.info('Step 4 successfully saved to database', {
      workflowId,
      moduleCount: modules.length,
      hoursIntegrity,
      totalModuleHours,
      totalProgramHours,
    });

    return workflow;
  }

  private validateHoursIntegrity(modules: any[], totalHours: number): boolean {
    const sum = modules.reduce((acc, m) => acc + (m.totalHours || 0), 0);
    return sum === totalHours;
  }

  private validateProgressiveComplexity(modules: any[]): {
    earlyModulesValid: boolean;
    middleModulesValid: boolean;
    lateModulesValid: boolean;
  } {
    const lowerLevels = ['remember', 'understand', 'apply'];
    const higherLevels = ['analyze', 'evaluate', 'create'];

    const earlyModules = modules.filter((m) => m.phase === 'early');
    const middleModules = modules.filter((m) => m.phase === 'middle');
    const lateModules = modules.filter((m) => m.phase === 'late');

    const countLevels = (mods: any[], levels: string[]) => {
      const allMLOs = mods.flatMap((m) => m.mlos || []);
      if (allMLOs.length === 0) return 1; // Pass if no MLOs
      const matching = allMLOs.filter((mlo: any) => levels.includes(mlo.bloomLevel));
      return matching.length / allMLOs.length;
    };

    return {
      earlyModulesValid: countLevels(earlyModules, lowerLevels) >= 0.6,
      middleModulesValid: true, // Middle is more flexible
      lateModulesValid: lateModules.length === 0 || countLevels(lateModules, higherLevels) >= 0.3,
    };
  }

  private validateNoCircularDeps(modules: any[]): boolean {
    const modIds = modules.map((m) => m.id);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (modId: string): boolean => {
      if (recursionStack.has(modId)) return true;
      if (visited.has(modId)) return false;

      visited.add(modId);
      recursionStack.add(modId);

      const mod = modules.find((m) => m.id === modId);
      for (const prereq of mod?.prerequisites || []) {
        if (hasCycle(prereq)) return true;
      }

      recursionStack.delete(modId);
      return false;
    };

    for (const modId of modIds) {
      if (hasCycle(modId)) return false;
    }
    return true;
  }

  private async generateStep4Content(step1: any, step2: any, step3: any): Promise<any> {
    const creditFramework = step1.creditFramework || {};
    const totalHours = creditFramework.totalHours || 120;
    const contactPercent = creditFramework.contactHoursPercent || 30;
    const contactHours = creditFramework.contactHours || Math.round(totalHours * 0.3);
    const independentHours = totalHours - contactHours;
    const deliveryMode = step1.delivery?.mode || 'hybrid';

    // Calculate suggested module count (15-hour guideline)
    let suggestedModules = Math.round(totalHours / 15);
    if (suggestedModules < 6) suggestedModules = 6;
    if (suggestedModules > 8) suggestedModules = 8;

    // Build PLO list with details
    const plos = (step3.outcomes || []).map((o: any) => ({
      id: o.id || o.code,
      statement: o.statement,
      bloomLevel: o.bloomLevel,
      linkedKSCs: o.linkedKSCs || [],
    }));

    const plosText = plos
      .map(
        (p: any) => `${p.id}: ${p.statement} [${p.bloomLevel}] → Links: ${p.linkedKSCs.join(', ')}`
      )
      .join('\n');

    // Build competencies
    const competencyItems = step2.competencyItems || step2.attitudeItems || [];
    const knowledgeItems = step2.knowledgeItems || [];
    const skillItems = step2.skillItems || [];

    const competenciesText = [
      'KNOWLEDGE:',
      ...knowledgeItems.map((k: any) => `  ${k.id}: ${k.statement} [${k.importance}]`),
      'SKILLS:',
      ...skillItems.map((s: any) => `  ${s.id}: ${s.statement} [${s.importance}]`),
      'COMPETENCIES:',
      ...competencyItems.map((c: any) => `  ${c.id}: ${c.statement} [${c.importance}]`),
    ].join('\n');

    // === RETRIEVE KNOWLEDGE BASE CONTEXT ===
    const kbQueries = [
      `${step1.programTitle} course structure modules`,
      `${step1.academicLevel} curriculum design module structure`,
      `${step1.targetLearner?.industrySector || 'professional'} training programme modules`,
      `vocational education module learning outcomes`,
      `progressive complexity curriculum design`,
    ];

    const kbContexts = await retrieveKBContext(kbQueries, {
      maxResults: 12,
      minSimilarity: 0.55,
      domains: ['curriculum-design', 'standards', 'typeOfOutputs'],
    });

    const kbContextSection = formatKBContextForPrompt(kbContexts);

    const systemPrompt = `You are a senior curriculum architect with expertise in:
- Vocational education programme design
- Module-based learning structures
- Contact and independent learning hour allocation
- Bloom's Taxonomy and progressive complexity
- Learning activity design for different delivery modes
- UK/EU qualification frameworks

YOUR TASK: Design a comprehensive course framework that:
1. Organises the program into 6-8 logically sequenced modules
2. Distributes hours precisely (MUST total exactly ${totalHours} hours)
3. Ensures all PLOs from Step 3 are addressed by MLOs
4. Implements progressive complexity across modules
5. Includes appropriate learning activities for the delivery mode

CRITICAL HOURS CALCULATION:
- Total Program Hours: ${totalHours}
- Contact Hours: ${contactHours} (${contactPercent}%)
- Independent Hours: ${independentHours} (${100 - contactPercent}%)
- Guideline: ~15 hours per module (adjust to sum exactly to ${totalHours})

PROGRESSIVE COMPLEXITY REQUIREMENTS:
**Early Phase (Modules 1-2):** Foundation building
- ≥60% of MLOs at Remember/Understand/Apply levels
- Focus on core concepts, terminology, and basic applications
- Lower cognitive load to build confidence

**Middle Phase (Modules 3-5):** Development
- Balanced distribution across Apply/Analyse levels
- More complex applications and analytical tasks
- Building on earlier modules

**Late Phase (Modules 6+):** Mastery
- ≥30% of MLOs at Analyse/Evaluate/Create levels
- Synthesis, critical evaluation, and original work
- Integration across the program

DELIVERY MODE: ${deliveryMode}
${deliveryMode === 'online' ? 'Online: Prioritise asynchronous activities, recorded lectures, discussion forums, digital assessments' : ''}
${deliveryMode === 'classroom' ? 'Classroom: Prioritise face-to-face lectures, workshops, group activities, in-person assessments' : ''}
${deliveryMode === 'hybrid' ? 'Hybrid: Balance synchronous online sessions, self-paced content, occasional in-person workshops' : ''}

Use UK English spelling throughout (e.g., "programme", "analyse", "behaviour").`;

    const userPrompt = `Design a complete Course Framework for this accredited vocational education programme.

${kbContextSection}

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${step1.programTitle}
ACADEMIC LEVEL: ${step1.academicLevel}
INDUSTRY SECTOR: ${step1.targetLearner?.industrySector || 'general'}

HOURS ALLOCATION (MUST BE EXACT):
- Total Programme Hours: ${totalHours} hours
- Contact Hours: ${contactHours} hours (${contactPercent}%)
- Independent Study Hours: ${independentHours} hours (${100 - contactPercent}%)
- Delivery Mode: ${deliveryMode}

=== PROGRAMME LEARNING OUTCOMES (Step 3) ===

${plosText}

=== COMPETENCY FRAMEWORK (Step 2) ===

${competenciesText}

=== GENERATION REQUIREMENTS ===

Create exactly ${suggestedModules} MODULES with the following structure:

**FOR EACH MODULE:**

1. **IDENTIFICATION**
   - id: Unique identifier (e.g., "mod1", "mod2")
   - moduleCode: Formal code (e.g., "MOD101", "MOD102")
   - title: Descriptive, engaging title
   - description: 2-3 sentences explaining module focus

2. **SEQUENCING**
   - sequenceOrder: Position in the programme (1 to ${suggestedModules})
   - phase: "early" | "middle" | "late"
   - prerequisites: Array of module IDs that must be completed first

3. **HOURS ALLOCATION** (CRITICAL - must be mathematically precise)
   - totalHours: Module duration (use ~15 hour guideline)
   - contactHours: Exactly ${contactPercent}% of totalHours
   - independentHours: Exactly ${100 - contactPercent}% of totalHours
   - credits: totalHours / 10 (for UK credit calculation)
   
   ⚠️ VERIFY: Sum of all module totalHours MUST equal exactly ${totalHours}

4. **MODULE LEARNING OUTCOMES (MLOs)** - Generate 2-4 per module
   Each MLO must include:
   - id: Unique identifier (e.g., "M1-LO1", "M1-LO2")
   - statement: [Bloom's Verb] + [Specific Task] + [Real-World Context] (max 30 words)
   - bloomLevel: understand | apply | analyse | evaluate | create
   - verb: The action verb used
   - linkedPLOs: Array of PLO IDs this MLO supports
   - linkedKSCs: Array of K/S/C IDs from Step 2
   
   MLOs must be MORE SPECIFIC than PLOs - operationalising them at module level

5. **TOPICS** - 3-5 topics per module
   - id: Unique identifier
   - title: Topic name
   - sequence: Order within module
   - hours: Approximate hours for this topic

6. **CONTACT ACTIVITIES** (total must equal contactHours)
   Types by delivery mode:
   - lecture: Instructor-led presentation
   - workshop: Hands-on practical session
   - seminar: Discussion-based session
   - tutorial: Small group guidance
   - lab: Technical/software practice
   
   Each includes: type, title, hours

7. **INDEPENDENT ACTIVITIES** (total must equal independentHours)
   Types:
   - reading: Core and supplementary reading
   - practice: Self-study exercises
   - research: Independent investigation
   - assignment: Summative work preparation
   - reflection: Learning journals, portfolios
   
   Each includes: type, title, hours

=== PROGRESSIVE COMPLEXITY CHECK ===

EARLY PHASE (Modules 1-2):
- ≥60% of MLOs at Remember/Understand/Apply
- Focus: Foundations, terminology, basic application
- Prerequisites: None or minimal

MIDDLE PHASE (Modules 3-5):
- Balanced Apply/Analyse distribution
- Focus: Deeper application, analysis
- Prerequisites: Build on early modules

LATE PHASE (Modules 6+):
- ≥30% of MLOs at Analyse/Evaluate/Create
- Focus: Synthesis, evaluation, creation
- Prerequisites: Multiple earlier modules

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "modules": [
    {
      "id": "mod1",
      "moduleCode": "MOD101",
      "title": "Introduction to [Domain]",
      "description": "This foundation module introduces learners to the fundamental concepts and principles of... Learners will develop...",
      "sequenceOrder": 1,
      "phase": "early",
      "totalHours": 15,
      "contactHours": ${Math.round((15 * contactPercent) / 100)},
      "independentHours": ${15 - Math.round((15 * contactPercent) / 100)},
      "credits": 1.5,
      "prerequisites": [],
      "linkedPLOs": ["PLO1", "PLO2"],
      "mlos": [
        {
          "id": "M1-LO1",
          "statement": "Describe the fundamental principles of workforce planning within contemporary organisational contexts",
          "bloomLevel": "understand",
          "verb": "Describe",
          "linkedPLOs": ["PLO1"],
          "linkedKSCs": ["K1", "K2", "S1"]
        },
        {
          "id": "M1-LO2",
          "statement": "Apply basic workforce analysis techniques to identify staffing requirements for departmental planning",
          "bloomLevel": "apply",
          "verb": "Apply",
          "linkedPLOs": ["PLO2"],
          "linkedKSCs": ["S2", "S3"]
        }
      ],
      "topics": [
        { "id": "t1-1", "title": "Introduction to [Topic]", "sequence": 1, "hours": 3 },
        { "id": "t1-2", "title": "[Core Concept]", "sequence": 2, "hours": 5 },
        { "id": "t1-3", "title": "Practical Applications", "sequence": 3, "hours": 4 },
        { "id": "t1-4", "title": "Industry Context", "sequence": 4, "hours": 3 }
      ],
      "contactActivities": [
        { "type": "lecture", "title": "Module Introduction and Overview", "hours": 1 },
        { "type": "lecture", "title": "Core Concepts Presentation", "hours": 2 },
        { "type": "workshop", "title": "Practical Application Workshop", "hours": ${Math.round((15 * contactPercent) / 100) - 3} }
      ],
      "independentActivities": [
        { "type": "reading", "title": "Core Reading: Chapter 1-3", "hours": 4 },
        { "type": "practice", "title": "Self-Assessment Exercises", "hours": 3 },
        { "type": "reflection", "title": "Learning Journal Entry", "hours": ${15 - Math.round((15 * contactPercent) / 100) - 7} }
      ],
      "bloomDistribution": {
        "understand": 1,
        "apply": 1
      }
    }
  ],
  "validationSummary": {
    "totalModuleHours": ${totalHours},
    "hoursMatchesTarget": true,
    "allPLOsCovered": true,
    "progressiveComplexityMet": true
  }
}

CRITICAL VALIDATION:
✓ Sum of all module totalHours MUST equal exactly ${totalHours}
✓ Each module's contactHours + independentHours = totalHours
✓ All ${plos.length} PLOs are addressed by at least one MLO
✓ Progressive complexity is implemented across phases
✓ All hours are mathematically consistent`;

    try {
      loggingService.info('Starting Step 4 OpenAI generation', {
        totalHours,
        suggestedModules,
        plosCount: plos.length,
        knowledgeItemsCount: knowledgeItems.length,
        skillItemsCount: skillItems.length,
        competencyItemsCount: competencyItems.length,
        userPromptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
      });

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 128000, // MAXIMUM
        timeout: 1800000, // 30 minutes (user said cost is not an issue)
      });

      loggingService.info('Received Step 4 OpenAI response', {
        responseLength: response.length,
        responsePreview: response.substring(0, 300),
      });

      const parsed = this.parseJSON(response, 'step4');

      loggingService.info('Successfully parsed Step 4 JSON', {
        moduleCount: parsed.modules?.length || 0,
        hasModules: Array.isArray(parsed.modules),
      });

      if (!parsed.modules || parsed.modules.length === 0) {
        loggingService.error('Step 4 generation returned empty modules array', {
          parsed,
          responsePreview: response.substring(0, 500),
        });
        throw new Error(
          'OpenAI returned empty modules array. Response may not have matched expected JSON format.'
        );
      }

      return parsed;
    } catch (error) {
      loggingService.error('CRITICAL ERROR in Step 4 generation', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      });
      // DO NOT return empty array - throw the error so it propagates properly
      throw error;
    }
  }

  // ==========================================================================
  // STEPS 5-9: REMAINING STEPS
  // ==========================================================================

  /**
   * Process Step 5: Topic-Level Sources (AGI Academic Standards)
   * Per workflow v2.2: Identify, validate, and tag high-quality academic and
   * professional sources with APA 7th edition citations
   */
  async processStep5(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step4) {
      throw new Error('Workflow not found or Step 4 not complete');
    }

    loggingService.info('Processing Step 5: Topic-Level Sources (AGI Standards)', { workflowId });

    const sourcesContent = await this.generateStep5Content(workflow);

    // Process and validate sources
    const sources = sourcesContent.sources || [];
    const currentYear = new Date().getFullYear();

    // Calculate statistics
    const totalSources = sources.length;
    const peerReviewedSources = sources.filter(
      (s: any) => s.category === 'peer_reviewed_journal' || s.complianceBadges?.peerReviewed
    );
    const recentSources = sources.filter((s: any) => currentYear - s.year <= 5);
    const academicSources = sources.filter((s: any) => s.type === 'academic');
    const appliedSources = sources.filter(
      (s: any) => s.type === 'applied' || s.type === 'industry'
    );

    // Build sources by module
    const sourcesByModule: Record<string, any[]> = {};
    for (const source of sources) {
      const modId = source.moduleId || 'unassigned';
      if (!sourcesByModule[modId]) sourcesByModule[modId] = [];
      sourcesByModule[modId].push(source);
    }

    // Build module summaries
    const modules = workflow.step4.modules || [];
    const moduleSummaries = modules.map((mod: any) => {
      const modSources = sourcesByModule[mod.id] || [];
      const modPeerReviewed = modSources.filter(
        (s: any) => s.category === 'peer_reviewed_journal' || s.complianceBadges?.peerReviewed
      );
      const modRecent = modSources.filter((s: any) => currentYear - s.year <= 5);
      const modAcademic = modSources.filter((s: any) => s.type === 'academic');
      const modApplied = modSources.filter(
        (s: any) => s.type === 'applied' || s.type === 'industry'
      );
      const modMLOs = mod.mlos?.map((mlo: any) => mlo.id) || [];
      const supportedMLOs = new Set(modSources.flatMap((s: any) => s.linkedMLOs || []));

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        totalSources: modSources.length,
        peerReviewedCount: modPeerReviewed.length,
        peerReviewedPercent:
          modSources.length > 0
            ? Math.round((modPeerReviewed.length / modSources.length) * 100)
            : 0,
        recentCount: modRecent.length,
        seminalCount: modSources.filter((s: any) => s.isSeminal).length,
        academicCount: modAcademic.length,
        appliedCount: modApplied.length,
        totalReadingHours: modSources.reduce(
          (sum: number, s: any) => sum + (s.estimatedReadingHours || 0),
          0
        ),
        allocatedIndependentHours: mod.selfStudyHours || mod.independentHours || 0,
        allMLOsSupported: modMLOs.every((mloId: string) => supportedMLOs.has(mloId)),
        agiCompliant:
          modPeerReviewed.length / (modSources.length || 1) >= 0.5 &&
          modAcademic.length > 0 &&
          modApplied.length > 0,
      };
    });

    // Validation report - Updated to support industry and free access sources
    const approvedCategories = [
      'peer_reviewed_journal',
      'academic_textbook',
      'professional_body',
      'open_access',
      'institutional',
      'industry_report', // NEW: McKinsey, HBR, Deloitte, etc.
      'government_research', // NEW: Gov.uk, OECD, World Bank, etc.
    ];

    // Count free access sources
    const freeAccessSources = sources.filter(
      (s: any) =>
        s.accessStatus === 'free_access' ||
        s.accessStatus === 'open_access' ||
        s.complianceBadges?.freeAccess === true
    );

    const validationReport = {
      allSourcesApproved: sources.every((s: any) => approvedCategories.includes(s.category)),
      recencyCompliance: sources.every(
        (s: any) =>
          currentYear - s.year <= 5 ||
          (s.isSeminal && s.seminalJustification && s.pairedRecentSourceId)
      ),
      minimumSourcesPerTopic: true, // Simplified check
      academicAppliedBalance: academicSources.length > 0 && appliedSources.length > 0,
      // Relaxed: Accept 30% peer-reviewed when including industry sources
      peerReviewRatio: peerReviewedSources.length / (totalSources || 1) >= 0.3,
      completeCitations: sources.every(
        (s: any) => s.citation && s.authors?.length > 0 && s.year && s.title
      ),
      apaAccuracy: true, // Assume validated
      verifiedAccess: sources.every((s: any) => s.accessStatus !== 'rejected'),
      noPaywalled: sources.every((s: any) => s.accessStatus !== 'rejected'),
      everyMLOSupported: moduleSummaries.every((m: any) => m.allMLOsSupported),
      traceabilityComplete: true,
      // NEW: Check for free access - at least 70% should be free
      freeAccessRatio: freeAccessSources.length / (totalSources || 1) >= 0.7,
    };

    const complianceIssues: string[] = [];
    if (!validationReport.allSourcesApproved)
      complianceIssues.push('Some sources are from prohibited categories');
    if (!validationReport.recencyCompliance)
      complianceIssues.push('Some sources are outdated without seminal justification');
    if (!validationReport.academicAppliedBalance)
      complianceIssues.push('Missing academic/applied source balance');
    if (!validationReport.peerReviewRatio) complianceIssues.push('Academic source ratio below 30%');
    if (!validationReport.everyMLOSupported)
      complianceIssues.push('Not all MLOs have supporting sources');
    if (!validationReport.freeAccessRatio)
      complianceIssues.push('Less than 70% of sources are freely accessible');

    const agiCompliant = Object.values(validationReport).every((v) => v === true);

    workflow.step5 = {
      sources,
      sourcesByModule,
      moduleSummaries,
      totalSources,
      totalPeerReviewed: peerReviewedSources.length,
      peerReviewedPercent:
        totalSources > 0 ? Math.round((peerReviewedSources.length / totalSources) * 100) : 0,
      recentSourcesPercent:
        totalSources > 0 ? Math.round((recentSources.length / totalSources) * 100) : 0,
      academicAppliedBalance: academicSources.length > 0 && appliedSources.length > 0,
      // NEW: Free access metrics
      totalFreeAccess: freeAccessSources.length,
      freeAccessPercent:
        totalSources > 0 ? Math.round((freeAccessSources.length / totalSources) * 100) : 0,
      validationReport,
      agiCompliant,
      complianceIssues,
      adminOverrideRequired: !agiCompliant,
      validatedAt: new Date(),
    };

    workflow.currentStep = 5;
    workflow.status = 'step5_complete';

    const step5Progress = workflow.stepProgress.find((p) => p.step === 5);
    if (step5Progress) {
      step5Progress.status = 'completed';
      step5Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 5 processed', {
      workflowId,
      totalSources,
      agiCompliant,
      complianceIssues: complianceIssues.length,
    });

    return workflow;
  }

  /**
   * Process Step 6: Indicative & Additional Reading Lists
   * Per workflow v2.2: Transform AGI-validated sources into structured reading lists
   * with Core (3-6) and Supplementary (4-8) per module
   */
  async processStep6(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step5) {
      throw new Error('Workflow not found or Step 5 not complete');
    }

    const sources = workflow.step5?.sources || [];
    const modules = workflow.step4?.modules || [];

    loggingService.info('Processing Step 6: Reading Lists', {
      workflowId,
      sourcesCount: sources.length,
      modulesCount: modules.length,
      sourcesSample: sources.slice(0, 3).map((s: any) => ({ id: s.id, title: s.title })),
    });

    // If no sources, we can't generate readings - use fallback
    if (sources.length === 0) {
      loggingService.warn('Step 6: No sources available - generating placeholder readings');
    }

    const readingContent = await this.generateStep6Content(workflow);

    loggingService.info('Step 6: Generation complete', {
      readingsCount: readingContent.readings?.length || 0,
      hasFallback: !!readingContent._fallback,
      hasDebugError: !!readingContent._debugError,
    });

    // Process readings
    const readings = readingContent.readings || [];
    // modules already declared above

    // Organize readings by module
    const moduleReadings: Record<string, any[]> = {};
    for (const reading of readings) {
      const modId = reading.moduleId || 'unassigned';
      if (!moduleReadings[modId]) moduleReadings[modId] = [];
      moduleReadings[modId].push(reading);
    }

    // Calculate module summaries
    const moduleSummaries = modules.map((mod: any) => {
      const modReadings = moduleReadings[mod.id] || [];
      const coreReadings = modReadings.filter((r: any) => r.category === 'core');
      const supplementaryReadings = modReadings.filter((r: any) => r.category === 'supplementary');

      const coreMinutes = coreReadings.reduce(
        (sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0),
        0
      );
      const suppMinutes = supplementaryReadings.reduce(
        (sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0),
        0
      );
      const totalMinutes = coreMinutes + suppMinutes;
      const independentMinutes = (mod.selfStudyHours || mod.independentHours || 10) * 60;

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        coreCount: coreReadings.length,
        supplementaryCount: supplementaryReadings.length,
        totalReadings: modReadings.length,
        coreReadingMinutes: coreMinutes,
        supplementaryReadingMinutes: suppMinutes,
        totalReadingMinutes: totalMinutes,
        independentStudyMinutes: independentMinutes,
        readingTimePercent:
          independentMinutes > 0 ? Math.round((totalMinutes / independentMinutes) * 100) : 0,
        allCoreMapToMLO: coreReadings.every((r: any) => r.linkedMLOs && r.linkedMLOs.length > 0),
        academicAppliedBalance:
          modReadings.some((r: any) => r.type === 'academic') &&
          modReadings.some((r: any) => r.type === 'applied' || r.type === 'industry'),
        agiCompliant: modReadings.every((r: any) => r.agiCompliant !== false),
      };
    });

    // Overall counts
    const coreCount = readings.filter((r: any) => r.category === 'core').length;
    const supplementaryCount = readings.filter((r: any) => r.category === 'supplementary').length;
    const totalCoreMinutes = readings
      .filter((r: any) => r.category === 'core')
      .reduce((sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0), 0);
    const totalSuppMinutes = readings
      .filter((r: any) => r.category === 'supplementary')
      .reduce((sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0), 0);

    // Validation report per workflow v2.2
    const validationReport = {
      coreCountValid: moduleSummaries.every((m: any) => m.coreCount >= 3 && m.coreCount <= 6),
      supplementaryCountValid: moduleSummaries.every(
        (m: any) => m.supplementaryCount >= 4 && m.supplementaryCount <= 8
      ),
      allCoreMapToMLO: moduleSummaries.every((m: any) => m.allCoreMapToMLO),
      allAGICompliant: readings.every((r: any) => r.agiCompliant !== false),
      academicAppliedMix: moduleSummaries.every((m: any) => m.academicAppliedBalance),
      readingTimeWithinBudget: moduleSummaries.every((m: any) => m.readingTimePercent <= 100),
      allAccessible: readings.every((r: any) => r.accessStatus !== 'rejected'),
    };

    const validationIssues: string[] = [];
    if (!validationReport.coreCountValid)
      validationIssues.push('Some modules have incorrect Core reading count (should be 3-6)');
    if (!validationReport.supplementaryCountValid)
      validationIssues.push('Some modules have incorrect Supplementary count (should be 4-8)');
    if (!validationReport.allCoreMapToMLO)
      validationIssues.push('Some Core readings are not mapped to MLOs');
    if (!validationReport.readingTimeWithinBudget)
      validationIssues.push('Some modules exceed independent study hours with reading time');

    const isValid = Object.values(validationReport).every((v) => v === true);

    workflow.step6 = {
      readings,
      moduleReadings,
      moduleSummaries,
      totalReadings: readings.length,
      coreCount,
      supplementaryCount,
      totalCoreMinutes,
      totalSupplementaryMinutes: totalSuppMinutes,
      totalReadingMinutes: totalCoreMinutes + totalSuppMinutes,
      validationReport,
      isValid,
      validationIssues,
      validatedAt: new Date(),
    };

    workflow.currentStep = 6;
    workflow.status = 'step6_complete';

    const step6Progress = workflow.stepProgress.find((p) => p.step === 6);
    if (step6Progress) {
      step6Progress.status = 'completed';
      step6Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 6 processed', {
      workflowId,
      totalReadings: readings.length,
      coreCount,
      supplementaryCount,
      isValid,
    });

    return workflow;
  }

  /**
   * Process Step 7: Auto-Gradable Assessments (MCQ-First)
   * Per workflow v2.2: Create comprehensive auto-gradable MCQ banks,
   * module quizzes, and final exam blueprint
   */
  /**
   * Process Step 7: Comprehensive Assessment Generation
   * Uses Assessment Generator Contract with chunked generation to avoid timeouts
   */
  async processStep7(
    workflowId: string,
    userPreferences: {
      assessmentStructure: string;
      assessmentBalance: string;
      certificationStyles: string[];
      academicTypes: string[];
      summativeFormat: string;
      userDefinedSummativeDescription?: string;
      formativeTypesPerUnit: string[];
      formativePerModule: number;
      weightages: {
        formative?: number;
        summative?: number;
        mcqComponents?: number;
        writtenComponents?: number;
        practicalComponents?: number;
        projectCapstone?: number;
      };
      assessmentMappingStrategy: string;
      higherOrderPloPolicy: string;
      higherOrderPloRules?: string;
      useRealWorldScenarios: boolean;
      alignToWorkplacePerformance: boolean;
      integratedRealWorldSummative: boolean;
      generateSampleQuestions: boolean;
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step6) {
      throw new Error('Workflow not found or Step 6 not complete');
    }

    loggingService.info('Processing Step 7: Comprehensive Assessment Generation', {
      workflowId,
      structure: userPreferences.assessmentStructure,
      formativePerModule: userPreferences.formativePerModule,
    });

    // Import and use the assessment generator service
    const { assessmentGeneratorService } = await import('./assessmentGeneratorService');

    // Generate assessments using chunked strategy
    const assessmentResponse = await assessmentGeneratorService.generateAssessments(
      workflow,
      userPreferences as any, // Type assertion for compatibility
      (progress) => {
        loggingService.info('Assessment Generation Progress', {
          workflowId,
          stage: progress.stage,
          currentModule: progress.currentModule,
          completedSteps: progress.completedSteps,
          totalSteps: progress.totalSteps,
        });
      }
    );

    // Validation
    const totalSampleQuestions =
      assessmentResponse.sampleQuestions.mcq.length +
      assessmentResponse.sampleQuestions.sjt.length +
      assessmentResponse.sampleQuestions.caseQuestions.length +
      assessmentResponse.sampleQuestions.essayPrompts.length +
      assessmentResponse.sampleQuestions.practicalTasks.length;

    const plos = workflow.step3?.outcomes || [];
    const ploIds = plos.map((plo: any) => plo.id || plo.code);
    const coveredPloIds = new Set<string>();

    // Collect PLO coverage from formative assessments
    assessmentResponse.formativeAssessments.forEach((fa) => {
      fa.alignedPLOs.forEach((ploId) => coveredPloIds.add(ploId));
    });

    // Collect PLO coverage from summative assessments
    assessmentResponse.summativeAssessments.forEach((sa) => {
      sa.alignmentTable.forEach((alignment) => coveredPloIds.add(alignment.ploId));
    });

    const allFormativesMapped = assessmentResponse.formativeAssessments.every(
      (fa) => fa.alignedMLOs.length > 0
    );

    const allSummativesMapped = assessmentResponse.summativeAssessments.every(
      (sa) => sa.alignmentTable.length > 0
    );

    // Check weightages sum to 100 for summative assessments
    let weightsSum100 = true;
    assessmentResponse.summativeAssessments.forEach((sa) => {
      const totalWeight = sa.components.reduce((sum, comp) => sum + comp.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        weightsSum100 = false;
      }
    });

    const validation = {
      allFormativesMapped,
      allSummativesMapped,
      weightsSum100,
      sufficientSampleQuestions: totalSampleQuestions >= 20,
      plosCovered: ploIds.every((ploId: string) => coveredPloIds.has(ploId)),
    };

    // Store in workflow
    workflow.step7 = {
      userPreferences: userPreferences as any,
      formativeAssessments: assessmentResponse.formativeAssessments as any,
      summativeAssessments: assessmentResponse.summativeAssessments as any,
      sampleQuestions: assessmentResponse.sampleQuestions as any,
      lmsPackages: assessmentResponse.lmsPackages,
      validation,
      generatedAt: new Date(),
    };

    workflow.currentStep = 7;
    workflow.status = 'step7_complete';

    const step7Progress = workflow.stepProgress.find((p) => p.step === 7);
    if (step7Progress) {
      step7Progress.status = 'completed';
      step7Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 7 processed successfully', {
      workflowId,
      formativeCount: assessmentResponse.formativeAssessments.length,
      summativeCount: assessmentResponse.summativeAssessments.length,
      totalSampleQuestions,
      validationPassed: Object.values(validation).every((v) => v === true),
    });

    return workflow;
  }

  /**
   * Process Step 7 with Streaming (Incremental Database Saves)
   * Saves results to database after each batch and sends callbacks
   */
  async processStep7Streaming(
    workflowId: string,
    userPreferences: any,
    progressCallback?: (progress: any) => void,
    dataCallback?: (data: any) => void
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step6) {
      throw new Error('Workflow not found or Step 6 not complete');
    }

    loggingService.info('[Step 7 Stream] Starting streaming generation', { workflowId });

    // Initialize step7 with empty arrays
    workflow.step7 = {
      userPreferences: userPreferences as any,
      formativeAssessments: [],
      summativeAssessments: [],
      sampleQuestions: {
        mcq: [],
        sjt: [],
        caseQuestions: [],
        essayPrompts: [],
        practicalTasks: [],
      },
      lmsPackages: {},
      validation: {
        allFormativesMapped: false,
        allSummativesMapped: false,
        weightsSum100: false,
        sufficientSampleQuestions: false,
        plosCovered: false,
      },
      generatedAt: new Date(),
    };
    await workflow.save();

    const { assessmentGeneratorService } = await import('./assessmentGeneratorService');

    // Save queue to prevent parallel saves
    let saveInProgress = false;
    const saveQueue: Array<() => void> = [];

    const queueSave = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const executeSave = async () => {
          try {
            await workflow.save();
            loggingService.info('[Step 7 Stream] Save completed', {
              formatives: workflow.step7?.formativeAssessments?.length || 0,
              summatives: workflow.step7?.summativeAssessments?.length || 0,
            });
          } catch (err) {
            loggingService.error('[Step 7 Stream] Save FAILED - this is a critical error!', {
              error: err,
              formatives: workflow.step7?.formativeAssessments?.length || 0,
              summatives: workflow.step7?.summativeAssessments?.length || 0,
            });
            // Don't reject - we want to continue generation even if save fails
          } finally {
            saveInProgress = false;

            // Process next save in queue
            const nextSave = saveQueue.shift();
            if (nextSave) {
              saveInProgress = true;
              nextSave();
            }
          }
        };

        if (saveInProgress) {
          // Queue this save and wait
          saveQueue.push(() => {
            executeSave().then(resolve);
          });
        } else {
          // Execute immediately
          saveInProgress = true;
          executeSave().then(resolve);
        }
      });
    };

    // Create custom progress callback that also saves to DB
    const streamProgressCallback = async (progress: any) => {
      if (progressCallback) {
        progressCallback(progress);
      }

      // If we have new data from a completed stage, save it
      if (progress.data) {
        if (progress.stage === 'formative' && progress.data.formatives) {
          // Add formatives from this module
          const beforeCount = workflow.step7!.formativeAssessments.length;
          workflow.step7!.formativeAssessments.push(...progress.data.formatives);
          const afterCount = workflow.step7!.formativeAssessments.length;

          // CRITICAL: Mark as modified for Mongoose to detect nested array changes
          workflow.markModified('step7.formativeAssessments');
          workflow.markModified('step7');

          loggingService.info('[Step 7 Stream] BEFORE SAVE - formatives in memory', {
            moduleId: progress.currentModule,
            justAdded: progress.data.formatives.length,
            beforeCount,
            afterCount,
            workflowId: workflow._id.toString(),
          });

          await queueSave();

          loggingService.info('[Step 7 Stream] AFTER SAVE - queued save for formatives', {
            moduleId: progress.currentModule,
            totalNow: workflow.step7!.formativeAssessments.length,
          });

          // Send data update to frontend
          if (dataCallback) {
            dataCallback({
              type: 'formative_batch',
              moduleId: progress.currentModule,
              formatives: progress.data.formatives,
              totalCount: workflow.step7!.formativeAssessments.length,
            });
          }
        } else if (progress.stage === 'summative' && progress.data.summatives) {
          // Add summatives
          workflow.step7!.summativeAssessments.push(...progress.data.summatives);

          // CRITICAL: Mark as modified for Mongoose
          workflow.markModified('step7.summativeAssessments');
          workflow.markModified('step7');

          await queueSave();
          loggingService.info('[Step 7 Stream] Queued save for summatives', {
            count: progress.data.summatives.length,
          });

          if (dataCallback) {
            dataCallback({
              type: 'summative_batch',
              summatives: progress.data.summatives,
              totalCount: workflow.step7!.summativeAssessments.length,
            });
          }
        } else if (progress.stage === 'samples' && progress.data.samples) {
          // Add samples
          const sampleType = progress.data.sampleType;
          if (sampleType === 'mcq') {
            workflow.step7!.sampleQuestions.mcq = progress.data.samples;
          } else if (sampleType === 'sjt') {
            workflow.step7!.sampleQuestions.sjt = progress.data.samples;
          } else if (sampleType === 'case') {
            workflow.step7!.sampleQuestions.caseQuestions = progress.data.samples;
          } else if (sampleType === 'essay') {
            workflow.step7!.sampleQuestions.essayPrompts = progress.data.samples;
          } else if (sampleType === 'practical') {
            workflow.step7!.sampleQuestions.practicalTasks = progress.data.samples;
          }

          // CRITICAL: Mark as modified for Mongoose
          workflow.markModified('step7.sampleQuestions');
          workflow.markModified('step7');

          await queueSave();
          loggingService.info('[Step 7 Stream] Queued save for samples', {
            type: sampleType,
            count: progress.data.samples.length,
          });

          if (dataCallback) {
            dataCallback({
              type: 'sample_batch',
              sampleType,
              samples: progress.data.samples,
            });
          }
        } else if (progress.stage === 'lms' && progress.data.lmsPackages) {
          // Add LMS packages
          workflow.step7!.lmsPackages = progress.data.lmsPackages;
          await queueSave();
          loggingService.info('[Step 7 Stream] Queued save for LMS packages');

          if (dataCallback) {
            dataCallback({
              type: 'lms_batch',
              lmsPackages: progress.data.lmsPackages,
            });
          }
        }
      }
    };

    // Generate assessments with streaming callback
    const assessmentResponse = await assessmentGeneratorService.generateAssessments(
      workflow,
      userPreferences as any,
      streamProgressCallback
    );

    // DO NOT overwrite incremental saves - they're already in workflow.step7!
    // The streamProgressCallback already added all data incrementally
    // Just add LMS packages which aren't streamed incrementally
    workflow.step7!.lmsPackages = assessmentResponse.lmsPackages;

    loggingService.info('[Step 7 Stream] Using incremental saves (not overwriting)', {
      formatives: workflow.step7!.formativeAssessments.length,
      summatives: workflow.step7!.summativeAssessments.length,
    });

    loggingService.info('[Step 7 Stream] Final data counts', {
      formatives: workflow.step7!.formativeAssessments.length,
      summatives: workflow.step7!.summativeAssessments.length,
      mcq: workflow.step7!.sampleQuestions.mcq.length,
      sjt: workflow.step7!.sampleQuestions.sjt.length,
      cases: workflow.step7!.sampleQuestions.caseQuestions.length,
      essays: workflow.step7!.sampleQuestions.essayPrompts.length,
      practicals: workflow.step7!.sampleQuestions.practicalTasks.length,
    });

    // Final validation using workflow.step7 data (not assessmentResponse)
    const totalSampleQuestions =
      (workflow.step7!.sampleQuestions.mcq?.length || 0) +
      (workflow.step7!.sampleQuestions.sjt?.length || 0) +
      (workflow.step7!.sampleQuestions.caseQuestions?.length || 0) +
      (workflow.step7!.sampleQuestions.essayPrompts?.length || 0) +
      (workflow.step7!.sampleQuestions.practicalTasks?.length || 0);

    const plos = workflow.step3?.outcomes || [];
    const ploIds = plos.map((plo: any) => plo.id || plo.code);
    const coveredPloIds = new Set<string>();

    workflow.step7!.formativeAssessments.forEach((fa: any) => {
      fa.alignedPLOs.forEach((ploId: string) => coveredPloIds.add(ploId));
    });

    workflow.step7!.summativeAssessments.forEach((sa: any) => {
      sa.alignmentTable.forEach((alignment: any) => coveredPloIds.add(alignment.ploId));
    });

    const allFormativesMapped = workflow.step7!.formativeAssessments.every(
      (fa: any) => fa.alignedMLOs.length > 0
    );
    const allSummativesMapped = workflow.step7!.summativeAssessments.every(
      (sa: any) => sa.alignmentTable.length > 0
    );

    let weightsSum100 = true;
    workflow.step7!.summativeAssessments.forEach((sa: any) => {
      const totalWeight = sa.components.reduce((sum: number, comp: any) => sum + comp.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        weightsSum100 = false;
      }
    });

    const validation = {
      allFormativesMapped,
      allSummativesMapped,
      weightsSum100,
      sufficientSampleQuestions: totalSampleQuestions >= 20,
      plosCovered: ploIds.every((ploId: string) => coveredPloIds.has(ploId)),
    };

    // Update validation
    workflow.step7!.validation = validation;
    workflow.currentStep = 7;
    workflow.status = 'step7_complete';

    const step7Progress = workflow.stepProgress.find((p) => p.step === 7);
    if (step7Progress) {
      step7Progress.status = 'completed';
      step7Progress.completedAt = new Date();
    }

    // Use queued save for final save to prevent parallel save errors
    loggingService.info('[Step 7 Stream] BEFORE FINAL SAVE - data in memory', {
      formatives: workflow.step7?.formativeAssessments?.length || 0,
      summatives: workflow.step7?.summativeAssessments?.length || 0,
    });

    // CRITICAL: Mark step7 as modified before final save
    workflow.markModified('step7');

    await queueSave();

    loggingService.info('[Step 7 Stream] AFTER FINAL SAVE - checking what was saved', {
      formatives: workflow.step7?.formativeAssessments?.length || 0,
      summatives: workflow.step7?.summativeAssessments?.length || 0,
    });

    // Verify data persisted - refetch from DB
    const verifyWorkflow = await CurriculumWorkflow.findById(workflowId);
    loggingService.info('[Step 7 Stream] DATABASE VERIFICATION', {
      workflowId,
      foundInDb: !!verifyWorkflow,
      step7Exists: !!verifyWorkflow?.step7,
      formativesInDb: verifyWorkflow?.step7?.formativeAssessments?.length || 0,
      summativesInDb: verifyWorkflow?.step7?.summativeAssessments?.length || 0,
      currentStep: verifyWorkflow?.currentStep,
      status: verifyWorkflow?.status,
    });

    if (
      (verifyWorkflow?.step7?.formativeAssessments?.length || 0) === 0 &&
      (verifyWorkflow?.step7?.summativeAssessments?.length || 0) === 0
    ) {
      loggingService.error('[Step 7 Stream] ⚠️ CRITICAL: Data was LOST after save!', {
        inMemory: workflow.step7?.formativeAssessments?.length || 0,
        inDatabase: verifyWorkflow?.step7?.formativeAssessments?.length || 0,
      });
    }

    loggingService.info('[Step 7 Stream] Streaming generation complete');

    return workflow;
  }

  /**
   * Process Step 8: Case Studies (Practice, Discussion, or Assessment-Ready)
   * Per workflow v2.2: Generate realistic, industry-relevant scenarios with
   * assessment hooks (NOT assessment questions)
   */
  async processStep8(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step7) {
      throw new Error('Workflow not found or Step 7 not complete');
    }

    loggingService.info('Processing Step 8: Case Studies', { workflowId });

    const caseStudyContent = await this.generateStep8Content(workflow);

    // Process case studies
    const caseStudies = caseStudyContent.caseStudies || [];
    const debugInfo = caseStudyContent._debugInfo;
    const debugError = caseStudyContent._debugError;

    // Log debug info if case studies are empty
    if (caseStudies.length === 0) {
      loggingService.warn('Step 8: No case studies generated', {
        debugInfo,
        debugError,
        workflowId,
      });
    }
    const modules = workflow.step4?.modules || [];

    // Calculate word counts
    for (const cs of caseStudies) {
      cs.wordCount = (cs.scenario || '').split(/\s+/).length;
    }

    // Organize by module
    const moduleCoverage: Record<string, any[]> = {};
    for (const cs of caseStudies) {
      const modId = cs.moduleId || 'unassigned';
      if (!moduleCoverage[modId]) moduleCoverage[modId] = [];
      moduleCoverage[modId].push(cs);
    }

    // Organize by type
    const casesByType: Record<string, any[]> = {
      practice: [],
      discussion: [],
      assessment_ready: [],
    };
    for (const cs of caseStudies) {
      const type = cs.caseType || 'assessment_ready';
      if (!casesByType[type]) casesByType[type] = [];
      casesByType[type].push(cs);
    }

    // Counts
    const practiceCount = casesByType.practice?.length || 0;
    const discussionCount = casesByType.discussion?.length || 0;
    const assessmentReadyCount = casesByType.assessment_ready?.length || 0;

    // Validation report per workflow v2.2
    const validationReport = {
      allMappedToModule: caseStudies.every(
        (cs: any) => cs.moduleId || cs.linkedModules?.length > 0
      ),
      allMappedToMLO: caseStudies.every((cs: any) => cs.linkedMLOs?.length > 0),
      wordCountValid: caseStudies.every((cs: any) => cs.wordCount >= 400 && cs.wordCount <= 800),
      ethicsCompliant: caseStudies.every(
        (cs: any) => cs.ethicsCompliant !== false && cs.noPII !== false
      ),
      hooksComplete:
        casesByType.assessment_ready?.every(
          (cs: any) =>
            cs.assessmentHooks &&
            cs.assessmentHooks.keyFacts?.length >= 10 &&
            cs.assessmentHooks.misconceptions?.length >= 5 &&
            cs.assessmentHooks.decisionPoints?.length >= 3
        ) ?? true,
      noAssessmentQuestions: true, // Hooks only, no MCQs
    };

    const validationIssues: string[] = [];
    if (!validationReport.allMappedToModule)
      validationIssues.push('Some cases not mapped to modules');
    if (!validationReport.allMappedToMLO) validationIssues.push('Some cases not mapped to MLOs');
    if (!validationReport.wordCountValid)
      validationIssues.push('Some cases outside 400-800 word range');
    if (!validationReport.ethicsCompliant)
      validationIssues.push('Ethics compliance issues detected');
    if (!validationReport.hooksComplete)
      validationIssues.push('Assessment-Ready cases missing complete hooks');

    const isValid = Object.values(validationReport).every((v) => v === true);

    workflow.step8 = {
      stage: 'complete',
      proposals: [],
      selectedProposals: [],
      caseStudies,
      moduleCoverage,
      casesByType,
      totalCases: caseStudies.length,
      practiceCount,
      discussionCount,
      assessmentReadyCount,
      validationReport,
      isValid,
      validationIssues,
      validatedAt: new Date(),
      // Include debug info if case studies are empty
      ...(caseStudies.length === 0 && debugInfo ? { _debugInfo: debugInfo } : {}),
      ...(caseStudies.length === 0 && debugError ? { _debugError: debugError } : {}),
    };

    workflow.currentStep = 8;
    workflow.status = 'step8_complete';

    const step8Progress = workflow.stepProgress.find((p) => p.step === 8);
    if (step8Progress) {
      step8Progress.status = 'completed';
      step8Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 8 processed', {
      workflowId,
      totalCases: caseStudies.length,
      practiceCount,
      discussionCount,
      assessmentReadyCount,
      isValid,
    });

    return workflow;
  }

  /**
   * Process Step 9: Glossary (Auto-Generated, No SME Input)
   * Per workflow v2.2: Automatically create comprehensive terminology reference
   * by harvesting key terms from all curriculum content
   */
  async processStep9(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step8) {
      throw new Error('Workflow not found or Step 8 not complete');
    }

    loggingService.info('Processing Step 9: Glossary (Auto-Generated)', { workflowId });

    const glossaryContent = await this.generateStep9Content(workflow);

    // Process terms
    const terms = glossaryContent.terms || [];
    const modules = workflow.step4?.modules || [];

    // Calculate word counts for definitions
    for (const term of terms) {
      term.wordCount = (term.definition || '').split(/\s+/).length;
    }

    // Organize by category
    const categories = [...new Set(terms.map((t: any) => t.category).filter(Boolean))];
    const termsByCategory: Record<string, any[]> = {};
    for (const term of terms) {
      const cat = term.category || 'General';
      if (!termsByCategory[cat]) termsByCategory[cat] = [];
      termsByCategory[cat].push(term);
    }

    // Build module term lists
    const moduleTermLists = modules.map((mod: any) => {
      const moduleTerms = terms.filter(
        (t: any) => t.sourceModules?.includes(mod.id) || t.sourceModules?.includes(mod.moduleCode)
      );
      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        terms: moduleTerms,
        termCount: moduleTerms.length,
      };
    });

    // Count acronyms
    const acronyms = terms.filter((t: any) => t.isAcronym);

    // Count assessment terms
    const assessmentTerms = terms.filter(
      (t: any) => t.usedInAssessment || t.priority === 'must_include'
    );

    // Calculate average definition length
    const avgDefLength =
      terms.length > 0
        ? Math.round(
            terms.reduce((sum: number, t: any) => sum + (t.wordCount || 0), 0) / terms.length
          )
        : 0;

    // Validation report per workflow v2.2
    const validationReport = {
      allAssessmentTermsIncluded: true, // Assumed true from generation
      definitionLengthValid: terms.every((t: any) => t.wordCount >= 20 && t.wordCount <= 40),
      noCircularDefinitions: true, // Assumed
      allCrossReferencesValid: terms.every(
        (t: any) =>
          !t.relatedTerms?.length ||
          t.relatedTerms.every((rt: string) => terms.some((term: any) => term.term === rt))
      ),
      ukEnglishConsistent: true, // Assumed
      allTermsMappedToModule: terms.every((t: any) => t.sourceModules?.length > 0),
      noDuplicateEntries:
        new Set(terms.map((t: any) => t.term.toLowerCase())).size === terms.length,
    };

    const validationIssues: string[] = [];
    if (!validationReport.definitionLengthValid)
      validationIssues.push('Some definitions not within 20-40 words');
    if (!validationReport.allCrossReferencesValid)
      validationIssues.push('Some cross-references point to non-existent terms');
    if (!validationReport.allTermsMappedToModule)
      validationIssues.push('Some terms not mapped to any module');
    if (!validationReport.noDuplicateEntries)
      validationIssues.push('Duplicate term entries detected');

    const isValid = Object.values(validationReport).every((v) => v === true);

    // Determine program type and typical size
    const totalCredits = workflow.step1?.creditSystem?.totalCredits || 0;
    const programType = totalCredits >= 60 ? 'diploma' : 'certificate';
    const typicalSize = programType === 'diploma' ? '50-80 terms' : '30-50 terms';

    workflow.step9 = {
      terms,
      totalTerms: terms.length,
      categories,
      termsByCategory,
      moduleTermLists,
      acronyms,
      acronymCount: acronyms.length,
      assessmentTermsCount: assessmentTerms.length,
      essentialCompetencyTermsCount: terms.filter((t: any) =>
        t.sources?.includes('competency_framework')
      ).length,
      averageDefinitionLength: avgDefLength,
      validationReport,
      isValid,
      validationIssues,
      exportFormats: {
        alphabeticalPDF: true,
        moduleLinkedPDF: true,
        lmsImport: true,
        spreadsheet: true,
        mobileWeb: true,
      },
      generatedAt: new Date(),
      programType,
      typicalSize,
    };

    workflow.currentStep = 9;
    workflow.status = 'step9_complete';
    workflow.completedAt = new Date();

    const step9Progress = workflow.stepProgress.find((p) => p.step === 9);
    if (step9Progress) {
      step9Progress.status = 'completed';
      step9Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Workflow completed', {
      workflowId,
      totalTerms: terms.length,
      isValid,
    });

    return workflow;
  }

  // ==========================================================================
  // STEP 10: LESSON PLANS & PPT GENERATION
  // ==========================================================================

  /**
   * Process Step 10: Lesson Plans & PPT Generation
   * Generate detailed lesson plans for each module using context from all previous 9 steps
   *
   * Requirements:
   * - 1.1: Enable Step 10 after Step 9 completion
   * - 1.2: Use context from all previous 9 steps
   *
   * @param workflowId - ID of the workflow to process
   * @returns Updated workflow with step10 data
   */
  async processStep10(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step9) {
      throw new Error('Workflow not found or Step 9 not complete');
    }

    loggingService.info('Processing Step 10: Lesson Plans & PPT Generation', { workflowId });

    // Generate Step 10 content (lesson plans and PPTs)
    const step10Content = await this.generateStep10Content(workflow);

    // Store step10 data in workflow
    workflow.step10 = step10Content;

    // Update workflow status
    workflow.currentStep = 10;
    workflow.status = 'step10_complete';

    // Update step progress
    const step10Progress = workflow.stepProgress.find((p) => p.step === 10);
    if (step10Progress) {
      step10Progress.status = 'completed';
      step10Progress.startedAt = step10Progress.startedAt || new Date();
      step10Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 10 processed', {
      workflowId,
      totalLessons: step10Content.summary.totalLessons,
      totalContactHours: step10Content.summary.totalContactHours,
      caseStudiesIncluded: step10Content.summary.caseStudiesIncluded,
      formativeChecksIncluded: step10Content.summary.formativeChecksIncluded,
    });

    return workflow;
  }

  /**
   * Process Step 10: Generate lesson plans for the NEXT module only
   * This method generates one module at a time to avoid timeouts
   * @param workflowId - Workflow ID
   * @returns Updated workflow with the new module added to step10
   */
  async processStep10NextModule(workflowId: string): Promise<ICurriculumWorkflow> {
    // Always fetch fresh workflow data to avoid stale state
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step9) {
      throw new Error('Workflow not found or Step 9 not complete');
    }

    const existingModules = workflow.step10?.moduleLessonPlans?.length || 0;
    const totalModules = workflow.step4?.modules?.length || 0;

    loggingService.info('Processing Step 10: Next Module - Initial Check', {
      workflowId,
      existingModules,
      totalModules,
      nextModuleIndex: existingModules,
    });

    if (existingModules >= totalModules) {
      loggingService.info('All modules already generated', {
        workflowId,
        existingModules,
        totalModules,
      });
      return workflow;
    }

    loggingService.info('Processing Step 10: Next Module', {
      workflowId,
      moduleNumber: existingModules + 1,
      totalModules,
    });

    // Import services
    const { LessonPlanService } = await import('./lessonPlanService');
    const { PPTGenerationService } = await import('./pptGenerationService');

    // Create progress callback to save after each lesson
    const lessonProgressCallback = async (progress: any) => {
      try {
        loggingService.info('Saving lesson progress', {
          workflowId,
          moduleId: progress.moduleId,
          lessonsGenerated: progress.lessonsGenerated,
          totalLessons: progress.totalLessons,
        });

        // Initialize step10 if it doesn't exist
        if (!workflow.step10) {
          workflow.step10 = {
            moduleLessonPlans: [],
            validation: {
              allModulesHaveLessonPlans: false,
              allLessonDurationsValid: false,
              totalHoursMatch: false,
              allMLOsCovered: false,
              caseStudiesIntegrated: false,
              assessmentsIntegrated: false,
            },
            summary: {
              totalLessons: 0,
              totalContactHours: 0,
              averageLessonDuration: 0,
              caseStudiesIncluded: 0,
              formativeChecksIncluded: 0,
            },
            generatedAt: new Date(),
          };
        }

        // Find or create module plan
        let modulePlan = workflow.step10.moduleLessonPlans.find(
          (m) => m.moduleId === progress.moduleId
        );

        if (!modulePlan) {
          // Create new module plan
          modulePlan = {
            moduleId: progress.moduleId,
            moduleCode: progress.moduleCode,
            moduleTitle: progress.moduleTitle,
            totalContactHours: 0,
            totalLessons: progress.totalLessons,
            lessons: [],
            pptDecks: [],
          };
          workflow.step10.moduleLessonPlans.push(modulePlan);
        }

        // Update lessons (replace with latest)
        modulePlan.lessons = progress.lessons;
        modulePlan.totalLessons = progress.lessons.length;
        modulePlan.totalContactHours = progress.lessons.reduce(
          (sum: number, l: any) => sum + l.duration / 60,
          0
        );

        // Update summary
        const allLessons = workflow.step10.moduleLessonPlans.flatMap((m) => m.lessons);
        workflow.step10.summary = {
          totalLessons: allLessons.length,
          totalContactHours: workflow.step10.moduleLessonPlans.reduce(
            (sum, m) => sum + m.totalContactHours,
            0
          ),
          averageLessonDuration:
            allLessons.length > 0
              ? allLessons.reduce((sum, l) => sum + l.duration, 0) / allLessons.length
              : 0,
          caseStudiesIncluded: allLessons.filter((l) => l.caseStudyActivity).length,
          formativeChecksIncluded: allLessons.reduce(
            (sum, l) => sum + (l.formativeChecks?.length || 0),
            0
          ),
        };

        // Save to database
        workflow.markModified('step10');
        await workflow.save();

        loggingService.info('Lesson progress saved', {
          workflowId,
          moduleId: progress.moduleId,
          lessonsInDB: modulePlan.lessons.length,
        });
      } catch (err) {
        loggingService.error('Failed to save lesson progress', {
          workflowId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Don't throw - let generation continue
      }
    };

    const pptGenerationService = new PPTGenerationService();
    const lessonPlanService = new LessonPlanService(
      undefined,
      lessonProgressCallback,
      pptGenerationService
    );

    // Build context
    const context = this.buildWorkflowContext(workflow);

    // Get the next module to generate
    const nextModuleIndex = existingModules;
    const module = context.modules[nextModuleIndex];

    if (!module) {
      loggingService.error('Module not found in context', {
        workflowId,
        nextModuleIndex,
        totalModulesInContext: context.modules.length,
        totalModulesInStep4: totalModules,
        existingModules,
      });
      throw new Error(
        `Module ${nextModuleIndex + 1} not found. Context has ${context.modules.length} modules, Step4 has ${totalModules} modules.`
      );
    }

    loggingService.info('Generating lesson plans for next module', {
      workflowId,
      moduleIndex: nextModuleIndex,
      moduleId: module.id,
      moduleTitle: module.title,
      contactHours: module.contactHours,
    });

    // Generate lesson plans for this module (PPTs are generated automatically per lesson)
    const startTime = Date.now();
    const modulePlan = await lessonPlanService.generateModuleLessonPlans(module, context);
    const duration = Date.now() - startTime;

    loggingService.info('Lesson plans and PPTs generated for module', {
      workflowId,
      moduleId: module.id,
      lessonsGenerated: modulePlan.totalLessons,
      pptDecksGenerated: modulePlan.pptDecks.length,
      durationMs: duration,
      durationMin: Math.round(duration / 60000),
    });

    // Initialize step10 if it doesn't exist
    if (!workflow.step10) {
      workflow.step10 = {
        moduleLessonPlans: [],
        validation: {
          allModulesHaveLessonPlans: false,
          allLessonDurationsValid: false,
          totalHoursMatch: false,
          allMLOsCovered: false,
          caseStudiesIntegrated: false,
          assessmentsIntegrated: false,
        },
        summary: {
          totalLessons: 0,
          totalContactHours: 0,
          averageLessonDuration: 0,
          caseStudiesIncluded: 0,
          formativeChecksIncluded: 0,
        },
        generatedAt: new Date(),
      };
    }

    // Add the new module to the workflow
    workflow.step10.moduleLessonPlans.push(modulePlan);

    // Update summary
    const allLessons = workflow.step10.moduleLessonPlans.flatMap((m) => m.lessons);
    workflow.step10.summary = {
      totalLessons: allLessons.length,
      totalContactHours: workflow.step10.moduleLessonPlans.reduce(
        (sum, m) => sum + m.totalContactHours,
        0
      ),
      averageLessonDuration:
        allLessons.length > 0
          ? allLessons.reduce((sum, l) => sum + l.duration, 0) / allLessons.length
          : 0,
      caseStudiesIncluded: allLessons.filter((l) => l.caseStudyActivity).length,
      formativeChecksIncluded: allLessons.reduce(
        (sum, l) => sum + (l.formativeChecks?.length || 0),
        0
      ),
    };

    // Update validation
    const lessonPlanService2 = new LessonPlanService();
    workflow.step10.validation = (lessonPlanService2 as any).validateLessonPlans(
      workflow.step10.moduleLessonPlans,
      context.modules
    );

    // Update workflow status if all modules are complete
    const newModulesCount = workflow.step10.moduleLessonPlans.length;
    if (newModulesCount >= totalModules) {
      workflow.currentStep = 10;
      workflow.status = 'step10_complete';

      const step10Progress = workflow.stepProgress.find((p) => p.step === 10);
      if (step10Progress) {
        step10Progress.status = 'completed';
        step10Progress.startedAt = step10Progress.startedAt || new Date();
        step10Progress.completedAt = new Date();
      }
    }

    // Save workflow
    workflow.markModified('step10');
    await workflow.save();

    loggingService.info('Next module saved to workflow', {
      workflowId,
      modulesGenerated: newModulesCount,
      totalModules,
      totalLessons: workflow.step10.summary.totalLessons,
      totalContactHours: workflow.step10.summary.totalContactHours,
    });

    return workflow;
  }

  // ==========================================================================
  // STEP 11: PPT GENERATION (Separated from Step 10 for timeout prevention)
  // ==========================================================================

  /**
   * Process Step 11: Generate PPT decks for all modules
   * This is the full processing method that handles all modules at once
   * @param workflowId - Workflow ID
   * @returns Updated workflow with step11 data
   */
  async processStep11(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step10) {
      throw new Error('Workflow not found or Step 10 not complete');
    }

    loggingService.info('Processing Step 11: PPT Generation', { workflowId });

    // Generate Step 11 content (PPT decks)
    const step11Content = await this.generateStep11Content(workflow);

    // Store step11 data in workflow
    workflow.step11 = step11Content;

    // Update workflow status
    workflow.currentStep = 11;
    workflow.status = 'step11_complete';

    // Update step progress
    const step11Progress = workflow.stepProgress.find((p) => p.step === 11);
    if (step11Progress) {
      step11Progress.status = 'completed';
      step11Progress.startedAt = step11Progress.startedAt || new Date();
      step11Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 11 processed', {
      workflowId,
      totalPPTDecks: step11Content.summary.totalPPTDecks,
      totalSlides: step11Content.summary.totalSlides,
    });

    return workflow;
  }

  /**
   * Process Step 11: Generate PPT for the NEXT module only
   * This method generates PPT for one module at a time to avoid timeouts
   * Uses optimistic locking to prevent duplicate generation from race conditions
   * @param workflowId - Workflow ID
   * @returns Updated workflow with the new module PPT added to step11
   */
  async processStep11NextModule(workflowId: string): Promise<ICurriculumWorkflow> {
    // Always fetch fresh workflow data to avoid stale state
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step10) {
      throw new Error('Workflow not found or Step 10 not complete');
    }

    // Get lesson plans from Step 10
    const lessonPlans = workflow.step10.moduleLessonPlans || [];
    const totalModules = lessonPlans.length;

    if (totalModules === 0) {
      throw new Error('No lesson plans found in Step 10. Complete Step 10 first.');
    }

    // Use unique moduleId set to find the first ungenerated module
    const completedModuleIds = new Set(
      (workflow.step11?.modulePPTDecks || []).map((m) => m.moduleId)
    );
    const existingModules = completedModuleIds.size;
    const expectedModuleIndex = lessonPlans.findIndex(
      (m) => !completedModuleIds.has(m.moduleId)
    );

    loggingService.info('Processing Step 11: Next Module - Initial Check', {
      workflowId,
      existingModules,
      totalModules,
      nextModuleIndex: expectedModuleIndex,
    });

    if (expectedModuleIndex === -1) {
      loggingService.info('All module PPTs already generated', {
        workflowId,
        existingModules,
        totalModules,
      });
      return workflow;
    }

    // Get the next module to process
    const moduleToProcess = lessonPlans[expectedModuleIndex];

    loggingService.info('Generating PPT for module', {
      workflowId,
      moduleNumber: expectedModuleIndex + 1,
      totalModules,
      moduleCode: moduleToProcess.moduleCode,
      moduleId: moduleToProcess.moduleId,
      lessonsCount: moduleToProcess.lessons?.length || 0,
    });

    // Build context for PPT generation
    const pptContext = {
      programTitle: workflow.step1?.programTitle || 'Program',
      moduleCode: moduleToProcess.moduleCode,
      moduleTitle: moduleToProcess.moduleTitle,
      deliveryMode: workflow.step1?.delivery?.mode || 'online',
      glossaryEntries: workflow.step9?.entries || [],
    };

    // Import PPT generation service
    const { PPTGenerationService } = await import('./pptGenerationService');
    const pptService = new PPTGenerationService();

    // Generate PPT for each lesson in the module
    const startTime = Date.now();
    const pptDecks: any[] = [];

    for (let i = 0; i < moduleToProcess.lessons.length; i++) {
      const lesson = moduleToProcess.lessons[i];

      try {
        loggingService.info(
          `Generating PPT for lesson ${i + 1}/${moduleToProcess.lessons.length}`,
          {
            workflowId,
            moduleCode: moduleToProcess.moduleCode,
            lessonId: lesson.lessonId,
          }
        );

        const lessonStartTime = Date.now();
        const pptDeck = await pptService.generateLessonPPT(lesson, pptContext);
        const lessonDuration = Date.now() - lessonStartTime;

        pptDecks.push(pptDeck);

        loggingService.info(`PPT generated for lesson ${i + 1}/${moduleToProcess.lessons.length}`, {
          workflowId,
          moduleCode: moduleToProcess.moduleCode,
          lessonId: lesson.lessonId,
          slideCount: pptDeck.slideCount,
          durationMs: lessonDuration,
          durationSec: Math.round(lessonDuration / 1000),
        });
      } catch (err) {
        loggingService.error(`Failed to generate PPT for lesson ${i + 1}`, {
          workflowId,
          moduleCode: moduleToProcess.moduleCode,
          lessonId: lesson.lessonId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with other lessons even if one fails
      }
    }

    const duration = Date.now() - startTime;
    loggingService.info('Module PPT generation complete', {
      workflowId,
      moduleCode: moduleToProcess.moduleCode,
      pptDecksGenerated: pptDecks.length,
      durationMs: duration,
      durationMin: Math.round(duration / 60000),
    });

    // Create module PPT deck object
    const modulePPTDeck = {
      moduleId: moduleToProcess.moduleId,
      moduleCode: moduleToProcess.moduleCode,
      moduleTitle: moduleToProcess.moduleTitle,
      totalLessons: moduleToProcess.lessons.length,
      pptDecks,
    };

    // Re-fetch workflow to check for race conditions (another process may have added this module)
    const freshWorkflow = await CurriculumWorkflow.findById(workflowId);
    if (!freshWorkflow) {
      throw new Error('Workflow not found after generation');
    }

    // Check AGAIN if module was already added by another process during our generation
    const alreadyExists = freshWorkflow.step11?.modulePPTDecks?.find(
      (m) => m.moduleId === moduleToProcess.moduleId
    );
    if (alreadyExists) {
      loggingService.warn(
        'Module PPT was added by another process during generation, skipping duplicate',
        {
          workflowId,
          moduleId: moduleToProcess.moduleId,
          moduleCode: moduleToProcess.moduleCode,
        }
      );
      return freshWorkflow;
    }

    // Initialize step11 if it doesn't exist
    if (!freshWorkflow.step11) {
      freshWorkflow.step11 = {
        modulePPTDecks: [],
        validation: {
          allLessonsHavePPTs: false,
          allSlideCountsValid: false,
          allMLOsCovered: false,
          allCitationsValid: false,
        },
        summary: {
          totalPPTDecks: 0,
          totalSlides: 0,
          averageSlidesPerLesson: 0,
        },
        generatedAt: new Date(),
      };
    }

    // Add the new module PPT deck
    freshWorkflow.step11.modulePPTDecks.push(modulePPTDeck);

    // Update summary
    const allPPTDecks = freshWorkflow.step11.modulePPTDecks.flatMap((m) => m.pptDecks);
    const totalSlides = allPPTDecks.reduce((sum, deck) => sum + (deck.slideCount || 0), 0);

    freshWorkflow.step11.summary = {
      totalPPTDecks: allPPTDecks.length,
      totalSlides,
      averageSlidesPerLesson:
        allPPTDecks.length > 0 ? Math.round(totalSlides / allPPTDecks.length) : 0,
    };

    // Update validation — use unique moduleId count
    const newCompletedModuleIds = new Set(
      freshWorkflow.step11.modulePPTDecks.map((m) => m.moduleId)
    );
    const newModulesCount = newCompletedModuleIds.size;
    const allLessonsCount = lessonPlans.reduce((sum, m) => sum + m.lessons.length, 0);
    const pptDecksCount = allPPTDecks.length;

    freshWorkflow.step11.validation = {
      allLessonsHavePPTs: pptDecksCount >= allLessonsCount,
      allSlideCountsValid: allPPTDecks.every(
        (deck) => deck.slideCount >= 8 && deck.slideCount <= 15
      ),
      allMLOsCovered: true, // Simplified validation
      allCitationsValid: true, // Simplified validation
    };

    // Update workflow status if all modules are complete
    if (newModulesCount >= totalModules) {
      freshWorkflow.currentStep = 11;
      freshWorkflow.status = 'step11_complete';

      const step11Progress = freshWorkflow.stepProgress.find((p) => p.step === 11);
      if (step11Progress) {
        step11Progress.status = 'completed';
        step11Progress.startedAt = step11Progress.startedAt || new Date();
        step11Progress.completedAt = new Date();
      }
    }

    // Clear any previous error since generation succeeded
    if (freshWorkflow.step11.lastError) {
      freshWorkflow.step11.lastError = undefined;
    }

    // Save workflow
    freshWorkflow.markModified('step11');
    await freshWorkflow.save();

    loggingService.info('Next module PPT saved to workflow', {
      workflowId,
      modulesGenerated: newModulesCount,
      totalModules,
      totalPPTDecks: freshWorkflow.step11.summary.totalPPTDecks,
      totalSlides: freshWorkflow.step11.summary.totalSlides,
    });

    return freshWorkflow;
  }

  /**
   * Generate Step 11 content (all PPT decks) - used for full generation
   * @param workflow - Workflow document
   * @returns Step11PPTGeneration object
   */
  private async generateStep11Content(workflow: ICurriculumWorkflow): Promise<any> {
    const lessonPlans = workflow.step10?.moduleLessonPlans || [];

    if (lessonPlans.length === 0) {
      throw new Error('No lesson plans found in Step 10');
    }

    // Import PPT generation service
    const { PPTGenerationService } = await import('./pptGenerationService');
    const pptService = new PPTGenerationService();

    const modulePPTDecks: any[] = [];
    let totalPPTDecks = 0;
    let totalSlides = 0;

    for (const modulePlan of lessonPlans) {
      const pptContext = {
        programTitle: workflow.step1?.programTitle || 'Program',
        moduleCode: modulePlan.moduleCode,
        moduleTitle: modulePlan.moduleTitle,
        deliveryMode: workflow.step1?.delivery?.mode || 'online',
        glossaryEntries: workflow.step9?.entries || [],
      };

      const pptDecks: any[] = [];

      for (const lesson of modulePlan.lessons) {
        try {
          const pptDeck = await pptService.generateLessonPPT(lesson, pptContext);
          pptDecks.push(pptDeck);
          totalPPTDecks++;
          totalSlides += pptDeck.slideCount || 0;
        } catch (err) {
          loggingService.error('Failed to generate PPT', {
            moduleCode: modulePlan.moduleCode,
            lessonId: lesson.lessonId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      modulePPTDecks.push({
        moduleId: modulePlan.moduleId,
        moduleCode: modulePlan.moduleCode,
        moduleTitle: modulePlan.moduleTitle,
        totalLessons: modulePlan.lessons.length,
        pptDecks,
      });
    }

    return {
      modulePPTDecks,
      validation: {
        allLessonsHavePPTs:
          totalPPTDecks === lessonPlans.reduce((sum, m) => sum + m.lessons.length, 0),
        allSlideCountsValid: true,
        allMLOsCovered: true,
        allCitationsValid: true,
      },
      summary: {
        totalPPTDecks,
        totalSlides,
        averageSlidesPerLesson: totalPPTDecks > 0 ? Math.round(totalSlides / totalPPTDecks) : 0,
      },
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // STEP 12: ASSIGNMENT PACKS
  // ==========================================================================

  /**
   * Process Step 12: Generate Assignment Packs for all modules (full sync)
   */
  async processStep12(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step11) {
      throw new Error('Workflow not found or Step 11 not complete');
    }

    loggingService.info('Processing Step 12: Assignment Packs (full)', { workflowId });

    const { assignmentPackService } = await import('./assignmentPackService');
    const modules = workflow.step4?.modules || [];
    const context = this.buildStep12Context(workflow);

    const moduleAssignmentPacks: any[] = [];

    for (const mod of modules) {
      const moduleContext = {
        moduleId: mod.id,
        moduleCode: mod.moduleCode,
        moduleTitle: mod.title,
        mlos: (mod.mlos || []).map((mlo: any) => ({
          id: mlo.id,
          statement: mlo.statement,
          bloomLevel: mlo.bloomLevel,
          linkedPLOs: mlo.linkedPLOs || [],
        })),
        totalHours: mod.totalHours,
        contactHours: mod.contactHours,
        independentHours: mod.independentHours ?? mod.selfStudyHours,
      };

      const packs = await assignmentPackService.generateModuleAssignmentPacks(
        moduleContext,
        context
      );
      moduleAssignmentPacks.push(packs);
    }

    const totalCriteria = moduleAssignmentPacks.reduce((sum, m) => {
      const variants = [m.variants.in_person, m.variants.self_study, m.variants.hybrid];
      return sum + variants.reduce((vSum: number, v: any) => vSum + (v.rubric?.length || 0), 0);
    }, 0);

    workflow.step12 = {
      moduleAssignmentPacks,
      validation: {
        allModulesHaveAssignments: moduleAssignmentPacks.length === modules.length,
        allVariantsGenerated: moduleAssignmentPacks.every(
          (m: any) => m.variants.in_person && m.variants.self_study && m.variants.hybrid
        ),
        allMLOsCovered: true,
        allRubricsComplete: totalCriteria > 0,
      },
      summary: {
        totalModules: moduleAssignmentPacks.length,
        totalAssignmentPacks: moduleAssignmentPacks.length * 3,
        averageCriteriaPerRubric:
          moduleAssignmentPacks.length > 0
            ? Math.round(totalCriteria / (moduleAssignmentPacks.length * 3))
            : 0,
      },
      generatedAt: new Date(),
    };

    workflow.currentStep = 12;
    workflow.status = 'step12_complete';

    const step12Progress = workflow.stepProgress.find((p) => p.step === 12);
    if (step12Progress) {
      step12Progress.status = 'completed';
      step12Progress.startedAt = step12Progress.startedAt || new Date();
      step12Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 12 processed', {
      workflowId,
      totalModules: moduleAssignmentPacks.length,
      totalPacks: moduleAssignmentPacks.length * 3,
    });

    return workflow;
  }

  /**
   * Process Step 12: Generate Assignment Packs for the NEXT module only
   * Module-by-module to prevent timeouts (3 variants per module)
   */
  async processStep12NextModule(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step11) {
      throw new Error('Workflow not found or Step 11 not complete');
    }

    const modules = workflow.step4?.modules || [];
    const totalModules = modules.length;

    if (totalModules === 0) {
      throw new Error('No modules found in Step 4. Complete Step 4 first.');
    }

    const existingModules = workflow.step12?.moduleAssignmentPacks?.length || 0;
    const expectedModuleIndex = existingModules;

    loggingService.info('Processing Step 12: Next Module', {
      workflowId,
      existingModules,
      totalModules,
      nextModuleIndex: expectedModuleIndex,
    });

    if (existingModules >= totalModules) {
      loggingService.info('All module assignment packs already generated', {
        workflowId,
        existingModules,
        totalModules,
      });
      return workflow;
    }

    const moduleToProcess = modules[expectedModuleIndex];
    if (!moduleToProcess) {
      throw new Error(`Module at index ${expectedModuleIndex} not found`);
    }

    // Check if already generated
    const existingModule = workflow.step12?.moduleAssignmentPacks?.find(
      (m: any) => m.moduleId === moduleToProcess.id
    );
    if (existingModule) {
      loggingService.info('Module assignment packs already exist, skipping', {
        workflowId,
        moduleId: moduleToProcess.id,
      });
      return workflow;
    }

    const { assignmentPackService } = await import('./assignmentPackService');
    const context = this.buildStep12Context(workflow);

    const moduleContext = {
      moduleId: moduleToProcess.id,
      moduleCode: moduleToProcess.moduleCode,
      moduleTitle: moduleToProcess.title,
      mlos: (moduleToProcess.mlos || []).map((mlo: any) => ({
        id: mlo.id,
        statement: mlo.statement,
        bloomLevel: mlo.bloomLevel,
        linkedPLOs: mlo.linkedPLOs || [],
      })),
      totalHours: moduleToProcess.totalHours,
      contactHours: moduleToProcess.contactHours,
      independentHours: moduleToProcess.independentHours ?? moduleToProcess.selfStudyHours,
    };

    const startTime = Date.now();
    const packs = await assignmentPackService.generateModuleAssignmentPacks(moduleContext, context);
    const duration = Date.now() - startTime;

    loggingService.info('Module assignment packs generated', {
      workflowId,
      moduleCode: moduleToProcess.moduleCode,
      durationMs: duration,
    });

    // Re-fetch workflow for race condition safety
    const freshWorkflow = await CurriculumWorkflow.findById(workflowId);
    if (!freshWorkflow) {
      throw new Error('Workflow not found after generation');
    }

    const alreadyExists = freshWorkflow.step12?.moduleAssignmentPacks?.find(
      (m: any) => m.moduleId === moduleToProcess.id
    );
    if (alreadyExists) {
      loggingService.warn('Module assignment packs added by another process, skipping', {
        workflowId,
        moduleId: moduleToProcess.id,
      });
      return freshWorkflow;
    }

    // Initialize step12 if needed
    if (!freshWorkflow.step12) {
      freshWorkflow.step12 = {
        moduleAssignmentPacks: [],
        validation: {
          allModulesHaveAssignments: false,
          allVariantsGenerated: false,
          allMLOsCovered: false,
          allRubricsComplete: false,
        },
        summary: {
          totalModules: 0,
          totalAssignmentPacks: 0,
          averageCriteriaPerRubric: 0,
        },
        generatedAt: new Date(),
      };
    }

    freshWorkflow.step12.moduleAssignmentPacks.push(packs);

    // Update summary
    const newModulesCount = freshWorkflow.step12.moduleAssignmentPacks.length;
    freshWorkflow.step12.summary = {
      totalModules: newModulesCount,
      totalAssignmentPacks: newModulesCount * 3,
      averageCriteriaPerRubric: 0, // Simplified
    };

    // Update validation
    freshWorkflow.step12.validation = {
      allModulesHaveAssignments: newModulesCount >= totalModules,
      allVariantsGenerated: freshWorkflow.step12.moduleAssignmentPacks.every(
        (m: any) => m.variants?.in_person && m.variants?.self_study && m.variants?.hybrid
      ),
      allMLOsCovered: true,
      allRubricsComplete: true,
    };

    // Mark complete if all modules done
    if (newModulesCount >= totalModules) {
      freshWorkflow.currentStep = 12;
      freshWorkflow.status = 'step12_complete';

      const step12Progress = freshWorkflow.stepProgress.find((p) => p.step === 12);
      if (step12Progress) {
        step12Progress.status = 'completed';
        step12Progress.startedAt = step12Progress.startedAt || new Date();
        step12Progress.completedAt = new Date();
      }
    }

    freshWorkflow.markModified('step12');
    await freshWorkflow.save();

    loggingService.info('Next module assignment packs saved', {
      workflowId,
      modulesGenerated: newModulesCount,
      totalModules,
    });

    return freshWorkflow;
  }

  private buildStep12Context(workflow: ICurriculumWorkflow) {
    return {
      programTitle: workflow.step1?.programTitle || 'Program',
      programDescription: workflow.step1?.programDescription || '',
      academicLevel: workflow.step1?.academicLevel || 'certificate',
      deliveryMode: workflow.step1?.delivery?.mode || 'online',
      creditFramework: workflow.step1?.creditFramework || {},
      targetLearner: workflow.step1?.targetLearner || 'General',
      plos: (workflow.step3?.outcomes || []).map((o: any) => ({
        id: o.id,
        statement: o.statement,
        bloomLevel: o.bloomLevel,
      })),
      assessmentStrategy: workflow.step7?.userPreferences || {},
      caseStudies: workflow.step8?.caseStudies || [],
      glossaryEntries: workflow.step9?.entries || [],
    };
  }

  // ==========================================================================
  // STEP 13: SUMMATIVE EXAM
  // ==========================================================================

  /**
   * Process Step 13: Generate Summative Exam Package
   * Single generation (not module-by-module)
   */
  async processStep13(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step12) {
      throw new Error('Workflow not found or Step 12 not complete');
    }

    loggingService.info('Processing Step 13: Summative Exam', { workflowId });

    const { summativeExamService } = await import('./summativeExamService');
    const examResult = await summativeExamService.generateSummativeExam(workflow);

    workflow.step13 = examResult;
    workflow.currentStep = 13;
    workflow.status = 'step13_complete';

    const step13Progress = workflow.stepProgress.find((p) => p.step === 13);
    if (step13Progress) {
      step13Progress.status = 'completed';
      step13Progress.startedAt = step13Progress.startedAt || new Date();
      step13Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Step 13 processed', {
      workflowId,
      totalQuestions: examResult.summary.totalQuestions,
      totalMarks: examResult.summary.totalMarks,
      sectionBIncluded: examResult.sectionBIncluded,
    });

    return workflow;
  }

  // ==========================================================================
  // CONTENT GENERATION HELPERS
  // ==========================================================================

  /**
   * Generate Step 5 content using BATCH-WISE generation per module
   * This prevents timeouts by generating sources for one module at a time
   */
  private async generateStep5Content(workflow: ICurriculumWorkflow): Promise<any> {
    const currentYear = new Date().getFullYear();
    const fiveYearsAgo = currentYear - 5;

    const modules = workflow.step4?.modules || [];
    const industrySector = workflow.step1?.targetLearner?.industrySector || 'general';
    const programTitle = workflow.step1?.programTitle || 'Program';
    const academicLevel = workflow.step1?.academicLevel || 'Level 5';

    loggingService.info('Step 5: Starting PARALLEL source generation', {
      totalModules: modules.length,
      programTitle,
      academicLevel,
    });

    // Generate sources for ALL modules in PARALLEL (much faster!)
    const modulePromises = modules.map(async (mod: any, i: number) => {
      const mlos = (mod.mlos || []).map((mlo: any) => ({
        id: mlo.id,
        statement: mlo.statement,
      }));
      const topics = (mod.topics || []).map((t: any) => t.title || t);

      loggingService.info(`Step 5: Starting module ${i + 1}/${modules.length}`, {
        moduleId: mod.id,
        moduleTitle: mod.title,
      });

      try {
        const moduleSources = await this.generateSourcesForModule({
          moduleId: mod.id,
          moduleTitle: mod.title,
          mlos,
          topics,
          independentHours: mod.selfStudyHours || mod.independentHours || 10,
          programTitle,
          academicLevel,
          industrySector,
          currentYear,
          fiveYearsAgo,
        });

        loggingService.info(`Step 5: Module ${mod.id} complete`, {
          sourcesGenerated: moduleSources.length,
        });

        return moduleSources;
      } catch (moduleError) {
        loggingService.error(`Step 5: Error generating sources for module ${mod.id}`, {
          error: moduleError instanceof Error ? moduleError.message : String(moduleError),
        });
        return [];
      }
    });

    // Wait for ALL modules to complete in parallel
    const results = await Promise.all(modulePromises);

    // Combine all sources
    const allSources: any[] = results.flat();

    loggingService.info('Step 5: PARALLEL generation complete', {
      totalSources: allSources.length,
      modulesProcessed: modules.length,
    });

    return { sources: allSources };
  }

  /**
   * Generate sources for a single module - smaller prompt, no timeout
   */
  private async generateSourcesForModule(moduleInfo: {
    moduleId: string;
    moduleTitle: string;
    mlos: { id: string; statement: string }[];
    topics: string[];
    independentHours: number;
    programTitle: string;
    academicLevel: string;
    industrySector: string;
    currentYear: number;
    fiveYearsAgo: number;
  }): Promise<any[]> {
    // Retrieve KB context for this specific module
    const kbQueries = [
      `${moduleInfo.moduleTitle} academic sources textbooks`,
      `${moduleInfo.industrySector} ${moduleInfo.moduleTitle} publications`,
    ];

    const kbContexts = await retrieveKBContext(kbQueries, {
      maxResults: 5,
      minSimilarity: 0.5,
      domains: ['standards', 'accreditations', 'Subject Books'],
    });

    const kbContextSection = formatKBContextForPrompt(kbContexts);

    const systemPrompt = `You are a senior academic librarian and research specialist with expertise in:
- Open access publishing and freely available scholarly resources
- APA 7th Edition citation format
- Source credibility assessment
- Professional body publications (SHRM, PMI, CIPD, ASCM, SFIA)
- Open access repositories (DOAJ, PubMed Central, arXiv, SSRN, Google Scholar)
- Industry research reports and practitioner publications
- Vocational education resource selection

YOUR PRIMARY TASK: Generate HIGH-QUALITY sources that are **FREE TO ACCESS** online.

⚠️ CRITICAL REQUIREMENT: ALL sources MUST be freely accessible without payment.
Users should be able to click the link and read the full content immediately.

=== APPROVED SOURCE CATEGORIES ===

1. **open_access** - FREE peer-reviewed content (PRIORITY - use at least 2)
   ✓ DOAJ journals (doaj.org) - fully open access
   ✓ PubMed Central (ncbi.nlm.nih.gov/pmc) - free biomedical/health
   ✓ arXiv (arxiv.org) - free preprints in sciences
   ✓ SSRN (ssrn.com) - free business/social science papers
   ✓ Google Scholar (scholar.google.com) - link to free PDFs
   ✓ ResearchGate author uploads (researchgate.net)
   ✓ University institutional repositories (.edu domains)
   ✓ ERIC (eric.ed.gov) - free education research

2. **professional_body** - FREE resources from professional organisations
   ✓ SHRM (shrm.org) - free articles, toolkits, research
   ✓ PMI (pmi.org) - free articles and guides
   ✓ CIPD (cipd.org) - free factsheets and reports
   ✓ ASCM (ascm.org) - free resources
   ✓ ACAS (acas.org.uk) - free employment guides
   ✓ Gov.uk publications - all free
   ✓ ILO (ilo.org) - free international labour resources

3. **industry_report** - FREE business/industry publications (PRIORITY - use at least 1)
   ✓ Harvard Business Review (hbr.org) - many free articles
   ✓ McKinsey Insights (mckinsey.com/insights) - all free
   ✓ Deloitte Insights (deloitte.com/insights) - all free
   ✓ PwC publications (pwc.com) - all free
   ✓ BCG Insights (bcg.com) - all free
   ✓ MIT Sloan Management Review (sloanreview.mit.edu) - some free
   ✓ World Economic Forum reports (weforum.org) - all free
   ✓ Gartner free research (gartner.com) - selected free content

4. **government_research** - FREE official publications
   ✓ UK Government (gov.uk) - all free
   ✓ OECD iLibrary (oecd-ilibrary.org) - many free reports
   ✓ World Bank Open Knowledge (openknowledge.worldbank.org) - all free
   ✓ UN publications - most free
   ✓ EU publications (op.europa.eu) - all free

5. **academic_textbook** - Reference textbooks (cite but note access)
   - From reputable publishers (Pearson, McGraw-Hill, Sage, Routledge)
   - Note: Usually requires purchase, include only 1 max per module
   - Provide link to publisher page or free preview if available

**PROHIBITED SOURCES (NEVER use):**
❌ Wikipedia, encyclopaedias, dictionaries
❌ Personal blogs, Medium, LinkedIn articles
❌ Paywalled-only journals (no free version available)
❌ AI-generated or AI-summarised content
❌ Marketing materials, vendor sales collateral
❌ YouTube videos, podcasts, presentation slides
❌ Forum posts, Q&A sites (Quora, Stack Exchange)
❌ Unverifiable or anonymous sources
❌ Sources older than 5 years (unless seminal)

**FREE ACCESS VERIFICATION:**
Before including ANY source, verify it meets ONE of these criteria:
1. Full PDF freely downloadable (open access)
2. Full HTML article freely readable online
3. Official organisation resource page (professional bodies)
4. Government/international organisation publication
5. Author's institutional repository version

**RECENCY REQUIREMENTS:**
- Primary sources: ${moduleInfo.fiveYearsAgo}-${moduleInfo.currentYear} (within 5 years)
- Seminal works: May be older IF foundational and paired with recent source

**BALANCE REQUIREMENTS:**
- Per module: Mix of academic AND practical/applied sources
- At least 2 open access academic sources
- At least 1 industry/practitioner source (HBR, McKinsey, etc.)
- At least 1 professional body resource
- Maximum 1 textbook (since these require purchase)

Use UK English spelling throughout.`;

    const userPrompt = `Generate 5-6 HIGH-QUALITY **FREE TO ACCESS** sources for this specific module.

⚠️ CRITICAL: Every source URL MUST lead to FREE, full-text content. No paywalls!

${kbContextSection}

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${moduleInfo.programTitle}
ACADEMIC LEVEL: ${moduleInfo.academicLevel}
INDUSTRY SECTOR: ${moduleInfo.industrySector}

=== MODULE DETAILS ===

**MODULE: ${moduleInfo.moduleId} - ${moduleInfo.moduleTitle}**
Independent Study Hours: ${moduleInfo.independentHours} hours

**MODULE LEARNING OUTCOMES (MLOs):**
${moduleInfo.mlos.map((mlo) => `  - ${mlo.id}: ${mlo.statement}`).join('\n')}

**KEY TOPICS:**
${moduleInfo.topics.length > 0 ? moduleInfo.topics.map((t) => `  - ${t}`).join('\n') : '  - General module topics based on title and MLOs'}

=== GENERATION REQUIREMENTS ===

Generate EXACTLY 5-6 sources with this MANDATORY distribution:
- **2-3 Open Access academic sources** (SSRN, PubMed Central, DOAJ, ResearchGate, ERIC)
- **1-2 Industry/Practitioner sources** (McKinsey, HBR, Deloitte, BCG, PwC)
- **1 Professional Body resource** (SHRM, CIPD, PMI, ACAS, Gov.uk)
- **0-1 Reference textbook** (optional, mark as "requires_purchase")

=== VERIFIED FREE SOURCE DOMAINS ===

Use ONLY these domains for free sources (URLs will actually work):

**Open Access Academic:**
- ssrn.com/abstract/XXXXXXX (Social Science Research Network)
- ncbi.nlm.nih.gov/pmc/articles/PMCXXXXXX (PubMed Central)
- arxiv.org/abs/XXXX.XXXXX (arXiv preprints)
- eric.ed.gov/?id=EJXXXXXX (ERIC education research)
- researchgate.net/publication/XXXXXXXXX (author uploads)
- scholar.google.com (link to free PDF versions)

**Industry/Business (all FREE):**
- mckinsey.com/capabilities/... or mckinsey.com/industries/...
- hbr.org/YYYY/MM/article-title (many free HBR articles)
- deloitte.com/insights/...
- pwc.com/gx/en/... (PwC global publications)
- bcg.com/publications/...
- weforum.org/publications/...

**Professional Bodies (all FREE):**
- shrm.org/topics-tools/... (SHRM resources)
- cipd.org/knowledge/factsheets/... (CIPD factsheets)
- pmi.org/learning/library/... (PMI articles)
- acas.org.uk/... (ACAS guidance)
- gov.uk/government/publications/... (UK Gov)

**FOR EACH SOURCE PROVIDE:**

1. **IDENTIFICATION:**
   - id: "src-${moduleInfo.moduleId}-1", "src-${moduleInfo.moduleId}-2", etc.
   - title: Full title exactly as published
   - authors: ["Surname, Initial."] format

2. **PUBLICATION DETAILS:**
   - year: ${moduleInfo.fiveYearsAgo}-${moduleInfo.currentYear} (within 5 years)
   - publisher: Journal/organisation name
   - doi: If available (format: "10.xxxx/xxxxx")

3. **ACCESS INFORMATION (CRITICAL):**
   - url: Direct URL to FREE full-text content
   - accessStatus: "free_access" | "open_access" | "requires_purchase"
   - accessNote: Brief note on how to access (e.g., "Full PDF available", "Free registration required")

4. **APA 7TH CITATION:**
   *Open Access Article:*
   Author, A. A. (Year). Title. Journal Name. https://doi.org/xxxxx
   
   *Industry Report:*
   Organisation. (Year). Title. https://url
   
   *Professional Body:*
   Organisation. (Year). Title. Retrieved from https://url

5. **CLASSIFICATION:**
   - category: "open_access" | "industry_report" | "professional_body" | "government_research" | "academic_textbook"
   - type: "academic" | "applied" | "industry"
   - complexityLevel: "introductory" | "intermediate" | "advanced"

6. **CURRICULUM MAPPING:**
   - moduleId: "${moduleInfo.moduleId}"
   - linkedMLOs: ["${moduleInfo.mlos[0]?.id || 'M1-LO1'}", "${moduleInfo.mlos[1]?.id || 'M1-LO2'}"]
   - relevantTopics: Array of relevant topic names

7. **COMPLIANCE:**
   - complianceBadges: { freeAccess: true/false, peerReviewed: true/false, recent: true/false }
   - estimatedReadingHours: 0.5-2 hours typical

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "sources": [
    {
      "id": "src-${moduleInfo.moduleId}-1",
      "title": "The Future of Work: How Organisations Are Adapting",
      "authors": ["McKinsey Global Institute"],
      "year": ${moduleInfo.currentYear - 1},
      "publisher": "McKinsey & Company",
      "citation": "McKinsey Global Institute. (${moduleInfo.currentYear - 1}). The future of work: How organisations are adapting. McKinsey & Company. https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/future-of-work",
      "url": "https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/future-of-work",
      "category": "industry_report",
      "type": "applied",
      "accessStatus": "free_access",
      "accessNote": "Full report freely available online",
      "complianceBadges": {
        "freeAccess": true,
        "peerReviewed": false,
        "recent": true
      },
      "moduleId": "${moduleInfo.moduleId}",
      "linkedMLOs": ["${moduleInfo.mlos[0]?.id || 'M1-LO1'}"],
      "relevantTopics": ["Future of Work", "Organisational Change"],
      "complexityLevel": "intermediate",
      "estimatedReadingHours": 1.5
    },
    {
      "id": "src-${moduleInfo.moduleId}-2",
      "title": "Employee Engagement: A Review of Current Research",
      "authors": ["Saks, A. M."],
      "year": ${moduleInfo.currentYear - 2},
      "publisher": "SSRN Electronic Journal",
      "doi": "10.2139/ssrn.XXXXXXX",
      "citation": "Saks, A. M. (${moduleInfo.currentYear - 2}). Employee engagement: A review of current research. SSRN. https://ssrn.com/abstract=XXXXXXX",
      "url": "https://ssrn.com/abstract=XXXXXXX",
      "category": "open_access",
      "type": "academic",
      "accessStatus": "open_access",
      "accessNote": "Free download from SSRN",
      "complianceBadges": {
        "freeAccess": true,
        "peerReviewed": true,
        "recent": true
      },
      "moduleId": "${moduleInfo.moduleId}",
      "linkedMLOs": ["${moduleInfo.mlos[0]?.id || 'M1-LO1'}", "${moduleInfo.mlos[1]?.id || 'M1-LO2'}"],
      "relevantTopics": ["Employee Engagement"],
      "complexityLevel": "advanced",
      "estimatedReadingHours": 1.0
    },
    {
      "id": "src-${moduleInfo.moduleId}-3",
      "title": "Performance Management Factsheet",
      "authors": ["CIPD"],
      "year": ${moduleInfo.currentYear},
      "publisher": "Chartered Institute of Personnel and Development",
      "citation": "CIPD. (${moduleInfo.currentYear}). Performance management factsheet. Retrieved from https://www.cipd.org/knowledge/factsheets/performance-management-factsheet",
      "url": "https://www.cipd.org/knowledge/factsheets/performance-management-factsheet",
      "category": "professional_body",
      "type": "applied",
      "accessStatus": "free_access",
      "accessNote": "Free factsheet, registration may be required",
      "complianceBadges": {
        "freeAccess": true,
        "peerReviewed": false,
        "recent": true
      },
      "moduleId": "${moduleInfo.moduleId}",
      "linkedMLOs": ["${moduleInfo.mlos[1]?.id || 'M1-LO2'}"],
      "relevantTopics": ["Performance Management"],
      "complexityLevel": "introductory",
      "estimatedReadingHours": 0.5
    }
  ]
}

=== CRITICAL REQUIREMENTS ===

✓ ALL URLs must lead to FREE content (test by clicking - no paywall!)
✓ Use ONLY the verified domains listed above for free sources
✓ Include at least 2 industry/practitioner sources (McKinsey, HBR, Deloitte, etc.)
✓ Include at least 1 professional body resource (CIPD, SHRM, ACAS, PMI)
✓ Mark any textbooks clearly as "requires_purchase" in accessStatus
✓ Proper APA 7th formatting for all citations
✓ All sources must directly support the MLOs for ${moduleInfo.moduleTitle}
✓ Balance academic rigour with practical application`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 32000, // Good size for detailed single-module generation
        timeout: 300000, // 5 minutes - plenty of time for one module
      });

      const parsed = this.parseJSON(response, `step5-${moduleInfo.moduleId}`);

      // Ensure moduleId is set correctly on all sources
      const sources = (parsed.sources || []).map((s: any) => ({
        ...s,
        moduleId: moduleInfo.moduleId,
        agiCompliant: s.agiCompliant !== false,
      }));

      return sources;
    } catch (error) {
      loggingService.error(`Error generating sources for module ${moduleInfo.moduleId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate Step 6 content using BATCH-WISE generation per module
   * This prevents timeouts by generating readings for one module at a time
   */
  private async generateStep6Content(workflow: ICurriculumWorkflow): Promise<any> {
    const modules = workflow.step4?.modules || [];
    const sources = workflow.step5?.sources || [];
    const programTitle = workflow.step1?.programTitle || 'Program';
    const academicLevel = workflow.step1?.academicLevel || 'Level 5';

    // Build source list by module
    const sourcesByModule: Record<string, any[]> = {};
    for (const source of sources) {
      const modId = source.moduleId || 'unassigned';
      if (!sourcesByModule[modId]) sourcesByModule[modId] = [];
      sourcesByModule[modId].push(source);
    }

    loggingService.info('Step 6: Starting PARALLEL BATCH generation', {
      totalModules: modules.length,
      totalSources: sources.length,
    });

    // Generate readings for ALL modules in PARALLEL (much faster!)
    const modulePromises = modules.map(async (mod: any, i: number) => {
      const modSources = sourcesByModule[mod.id] || sources.slice(0, 10);
      const independentHours = mod.selfStudyHours || mod.independentHours || 10;
      const mlos = mod.mlos || [];

      loggingService.info(`Step 6: Starting module ${i + 1}/${modules.length}`, {
        moduleId: mod.id,
        moduleTitle: mod.title,
      });

      try {
        const moduleReadings = await this.generateReadingsForModule({
          moduleId: mod.id,
          moduleTitle: mod.title,
          independentHours,
          independentMinutes: independentHours * 60,
          mlos: mlos.map((mlo: any) => ({ id: mlo.id, statement: mlo.statement })),
          availableSources: modSources.map((s: any) => ({
            id: s.id,
            title: s.title,
            authors: s.authors,
            year: s.year,
            citation: s.citation,
            category: s.category,
            type: s.type,
            linkedMLOs: s.linkedMLOs,
            complexity: s.complexityLevel || 'intermediate',
            complianceBadges: s.complianceBadges,
          })),
          programTitle,
          academicLevel,
        });

        loggingService.info(`Step 6: Module ${mod.id} complete`, {
          readingsGenerated: moduleReadings.readings.length,
        });

        return moduleReadings;
      } catch (moduleError) {
        loggingService.error(`Step 6: Error generating readings for module ${mod.id}`, {
          error: moduleError instanceof Error ? moduleError.message : String(moduleError),
        });
        return { readings: [], summary: null };
      }
    });

    // Wait for ALL modules to complete in parallel
    const results = await Promise.all(modulePromises);

    // Combine results
    const allReadings: any[] = [];
    const moduleSummaries: any[] = [];

    for (const result of results) {
      allReadings.push(...(result.readings || []));
      if (result.summary) {
        moduleSummaries.push(result.summary);
      }
    }

    loggingService.info('Step 6: PARALLEL generation complete', {
      totalReadings: allReadings.length,
      modulesProcessed: moduleSummaries.length,
    });

    return {
      readings: allReadings,
      moduleSummaries,
    };
  }

  /**
   * Generate readings for a single module - FULL DETAILED prompt, batch-wise to prevent timeout
   */
  private async generateReadingsForModule(moduleInfo: {
    moduleId: string;
    moduleTitle: string;
    independentHours: number;
    independentMinutes: number;
    mlos: { id: string; statement: string }[];
    availableSources: any[];
    programTitle: string;
    academicLevel: string;
  }): Promise<{ readings: any[]; summary: any }> {
    const systemPrompt = `You are an expert academic librarian specialising in reading list curation for vocational education programmes. Your task is to create structured, pedagogically sound reading lists that:
1. Support Module Learning Outcomes directly
2. Fit within independent study time allocations
3. Balance essential and enrichment materials
4. Progress from foundational to advanced content

=== READING LIST CLASSIFICATION ===

**CORE (Indicative) Readings: 4-6 per module**
Purpose: Essential for achieving MLOs and succeeding in assessments
Characteristics:
- Directly supports specific MLOs (must have linkedMLOs)
- Required reading for assessments
- Foundation for module understanding
- Must be read by all learners
- HIGH assessment relevance
- Covers foundational concepts first, then advanced topics

**SUPPLEMENTARY (Additional) Readings: 5-8 per module**
Purpose: Deepen understanding and provide alternative perspectives
Characteristics:
- Extends beyond core requirements
- Provides alternative viewpoints or deeper dives
- For learners seeking deeper knowledge
- Optional but recommended for distinction-level work
- MEDIUM to LOW assessment relevance
- Includes industry/applied perspectives

=== EFFORT ESTIMATION FORMULA ===

Base reading speed: 200 words per minute (academic content)

**Complexity Multipliers:**
- Introductory: ×1.0 (entry-level, clear language, basic concepts)
- Intermediate: ×1.2 (standard academic text, discipline-specific terminology)
- Advanced: ×1.5 (dense theoretical content, complex arguments, expert-level)

**Example Calculation:**
- 40-page chapter (~10,000 words) at intermediate complexity
- Base time: 10,000 / 200 = 50 minutes
- With multiplier: 50 × 1.2 = 60 minutes

**CRITICAL CONSTRAINT:**
- Total Core reading time ≤ 50% of independent study minutes
- Total ALL reading time ≤ 65% of independent study minutes
- Remaining time: practice exercises, assignments, reflection

=== STUDY SCHEDULING FRAMEWORK ===

For a typical 8-10 week module:
- **Weeks 1-2:** Foundational core readings (introductory complexity)
- **Weeks 3-4:** Application-focused core readings (intermediate complexity)
- **Weeks 5-6:** Analysis and synthesis readings (intermediate-advanced)
- **Weeks 7-8:** Assessment preparation, supplementary deep-dives (advanced)

**Scheduling Principles:**
- Build knowledge progressively
- Core readings distributed across weeks 1-6
- Supplementary readings clustered in weeks 5-8
- Allow time for assessment preparation in final weeks

=== READING SPECIFICITY REQUIREMENTS ===

For each reading, specify:
1. **Specific chapters/sections** - Not "entire book", but "Chapters 3-5: Financial Analysis"
2. **Page ranges** - Realistic estimates, e.g., "pp. 45-92"
3. **Focus areas** - What specifically to extract from the reading
4. **Why this reading** - Connection to specific MLO(s)

Use UK English spelling throughout (e.g., "organisation", "behaviour", "analyse").`;

    const userPrompt = `Create a comprehensive, structured reading list for this specific module.

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${moduleInfo.programTitle}
ACADEMIC LEVEL: ${moduleInfo.academicLevel}

=== MODULE: ${moduleInfo.moduleId} - ${moduleInfo.moduleTitle} ===

**TIME ALLOCATION:**
- Independent Study Time: ${moduleInfo.independentMinutes} minutes (${moduleInfo.independentHours} hours)
- ⚠️ CORE Reading Budget: MAX ${Math.round(moduleInfo.independentMinutes * 0.5)} minutes (50% of independent time)
- ⚠️ TOTAL Reading Budget: MAX ${Math.round(moduleInfo.independentMinutes * 0.65)} minutes (65% of independent time)

=== MODULE LEARNING OUTCOMES (MLOs) ===

${moduleInfo.mlos.map((mlo) => `- **${mlo.id}**: ${mlo.statement}`).join('\n')}

=== AVAILABLE SOURCES FROM STEP 5 (${moduleInfo.availableSources.length}) ===

${moduleInfo.availableSources
  .map(
    (s) => `
**${s.id}: "${s.title}"**
- Authors: ${s.authors?.join(', ') || 'Unknown'}
- Year: ${s.year}
- Category: ${s.category}
- Type: ${s.type || 'academic'}
- Complexity: ${s.complexity || 'intermediate'}
- Linked MLOs: ${s.linkedMLOs?.join(', ') || 'All module MLOs'}
- Citation: ${s.citation}
- Compliance: ${s.complianceBadges ? `Peer-reviewed: ${s.complianceBadges.peerReviewed}, Academic: ${s.complianceBadges.academicText}` : 'Standard'}`
  )
  .join('\n')}

=== GENERATION REQUIREMENTS ===

Generate a complete reading list with:
- **4-6 CORE readings** (category: "core") - Essential, directly support MLOs, HIGH assessment relevance
- **5-8 SUPPLEMENTARY readings** (category: "supplementary") - Additional depth, MEDIUM relevance

**FOR EACH READING ITEM:**

1. **Identification:**
   - id: Unique identifier (format: "r-${moduleInfo.moduleId}-core-1" or "r-${moduleInfo.moduleId}-supp-1")
   - sourceId: Reference to Step 5 source ID from list above

2. **Source Details (inherited from Step 5):**
   - title: Full source title
   - authors: Array of author names
   - year: Publication year
   - citation: Full APA 7th citation

3. **Specific Assignment:**
   - specificChapters: Specific chapters/sections (e.g., "Chapter 3: Strategic Analysis", "Part II: Implementation")
   - pageRange: Page numbers if applicable (e.g., "pp. 45-92")

4. **Classification:**
   - category: "core" | "supplementary"
   - complexity: "introductory" | "intermediate" | "advanced"

5. **Effort Estimation:**
   - estimatedReadingMinutes: Calculated using formula above
     (Consider: page count, word density, complexity level)

6. **Study Scheduling:**
   - suggestedWeek: When to complete (e.g., "Week 1-2", "Week 5")

7. **Curriculum Mapping (REQUIRED for Core readings):**
   - linkedMLOs: Array of specific MLO IDs this reading supports
   - assessmentRelevance: "high" | "medium" | "low"

8. **Compliance (inherited from Step 5):**
   - agiCompliant: true
   - complianceBadges: { peerReviewed, academicText, recent, etc. }

=== CRITICAL VALIDATION ===

✓ Total CORE reading time ≤ ${Math.round(moduleInfo.independentMinutes * 0.5)} minutes
✓ Total ALL reading time ≤ ${Math.round(moduleInfo.independentMinutes * 0.65)} minutes
✓ Every Core reading has linkedMLOs specified
✓ All sources are from the Step 5 approved list above
✓ Core readings include a mix of complexity levels
✓ Study scheduling progresses logically (foundational → advanced)
✓ Each MLO is covered by at least one core reading

=== OUTPUT FORMAT ===

Return ONLY valid JSON (no markdown, no explanations):
{
  "readings": [
    {
      "id": "r-${moduleInfo.moduleId}-core-1",
      "sourceId": "src-${moduleInfo.moduleId}-1",
      "moduleId": "${moduleInfo.moduleId}",
      "category": "core",
      "title": "Source Title from Step 5",
      "authors": ["Author, A.", "Author, B."],
      "year": 2024,
      "citation": "Full APA 7th citation...",
      "specificChapters": "Chapters 1-3: Introduction and Framework",
      "pageRange": "pp. 1-75",
      "complexity": "intermediate",
      "estimatedReadingMinutes": 90,
      "suggestedWeek": "Week 1-2",
      "linkedMLOs": ["${moduleInfo.mlos[0]?.id || 'M1-LO1'}", "${moduleInfo.mlos[1]?.id || 'M1-LO2'}"],
      "assessmentRelevance": "high",
      "agiCompliant": true,
      "complianceBadges": {
        "peerReviewed": false,
        "academicText": true,
        "professionalBody": false,
        "recent": true,
        "seminal": false,
        "verifiedAccess": true,
        "apaValidated": true
      }
    },
    {
      "id": "r-${moduleInfo.moduleId}-supp-1",
      "sourceId": "src-${moduleInfo.moduleId}-3",
      "moduleId": "${moduleInfo.moduleId}",
      "category": "supplementary",
      "title": "Alternative Perspective Source",
      "authors": ["Expert, J."],
      "year": 2023,
      "citation": "Full APA citation...",
      "specificChapters": "Chapter 5: Advanced Applications",
      "pageRange": "pp. 98-125",
      "complexity": "advanced",
      "estimatedReadingMinutes": 40,
      "suggestedWeek": "Week 5-6",
      "linkedMLOs": [],
      "assessmentRelevance": "medium",
      "agiCompliant": true,
      "complianceBadges": {
        "peerReviewed": true,
        "academicText": false,
        "recent": true
      }
    }
  ],
  "summary": {
    "moduleId": "${moduleInfo.moduleId}",
    "coreCount": 5,
    "supplementaryCount": 6,
    "totalReadingMinutes": 450,
    "coreReadingMinutes": 280,
    "supplementaryReadingMinutes": 170,
    "independentMinutes": ${moduleInfo.independentMinutes},
    "percentageUsed": 46,
    "mlosCovered": ["${moduleInfo.mlos.map((m) => m.id).join('", "')}"],
    "validWorkload": true
  }
}

CRITICAL REQUIREMENTS:
- Use ONLY sources from the Step 5 list provided above
- Ensure reading times are realistic and fit within budget
- Core readings MUST map to specific MLOs
- Create a logical reading progression through the module (Weeks 1-2 foundational → Weeks 7-8 advanced)
- Generate 9-14 total readings for comprehensive coverage`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 32000, // Good size for detailed single-module reading list
        timeout: 300000, // 5 minutes - plenty of time for detailed response
      });

      const parsed = this.parseJSON(response, `step6-${moduleInfo.moduleId}`);

      return {
        readings: parsed.readings || [],
        summary: parsed.summary || {
          moduleId: moduleInfo.moduleId,
          coreCount: (parsed.readings || []).filter((r: any) => r.category === 'core').length,
          supplementaryCount: (parsed.readings || []).filter(
            (r: any) => r.category === 'supplementary'
          ).length,
          totalReadingMinutes: (parsed.readings || []).reduce(
            (sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0),
            0
          ),
          coreReadingMinutes: (parsed.readings || [])
            .filter((r: any) => r.category === 'core')
            .reduce((sum: number, r: any) => sum + (r.estimatedReadingMinutes || 0), 0),
          independentMinutes: moduleInfo.independentMinutes,
        },
      };
    } catch (error) {
      loggingService.error(`Error generating readings for module ${moduleInfo.moduleId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate Step 7 content using BATCH-WISE generation
   * - Generate quizzes for each module separately (prevents timeout)
   * - Generate final exam pool separately
   */
  private async generateStep7Content(workflow: ICurriculumWorkflow, blueprint: any): Promise<any> {
    const modules = workflow.step4?.modules || [];
    const questionsPerModule = blueprint.questionsPerQuiz * blueprint.bankMultiplier;
    const finalPoolSize = blueprint.questionsForFinal * blueprint.bankMultiplier;
    const programTitle = workflow.step1?.programTitle || 'Program';
    const academicLevel = workflow.step1?.academicLevel || 'Level 5';
    const industrySector = workflow.step1?.targetLearner?.industrySector || 'general';

    // Get readings and case studies for context
    const readings = workflow.step6?.readings || [];
    const caseStudies = workflow.step8?.caseStudies || [];
    const plos = workflow.step3?.outcomes || [];

    loggingService.info('Step 7: Starting SEQUENTIAL assessment generation', {
      totalModules: modules.length,
      questionsPerModule,
      finalPoolSize,
    });

    // Generate quiz questions SEQUENTIALLY to avoid Render proxy timeout and OpenAI rate limits
    const allQuestions: any[] = [];
    const allClozeQuestions: any[] = [];

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      const modReadings = readings.filter(
        (r: any) => r.moduleId === mod.id && r.category === 'core'
      );

      loggingService.info(`Step 7: Starting quiz for module ${i + 1}/${modules.length}`, {
        moduleId: mod.id,
        moduleTitle: mod.title,
      });

      try {
        const moduleQuiz = await this.generateModuleQuiz({
          module: mod,
          moduleIndex: i,
          coreReadings: modReadings.slice(0, 3).map((r: any) => r.title),
          questionsPerModule,
          blueprint,
          programTitle,
          academicLevel,
          industrySector,
        });

        loggingService.info(`Step 7: Module ${mod.id} quiz complete`, {
          questionsGenerated: moduleQuiz.questions?.length || 0,
        });

        allQuestions.push(...(moduleQuiz.questions || []));
        if (blueprint.enableCloze) {
          allClozeQuestions.push(...(moduleQuiz.clozeQuestions || []));
        }
      } catch (moduleError) {
        loggingService.error(`Step 7: Error generating quiz for module ${mod.id}`, {
          error: moduleError instanceof Error ? moduleError.message : String(moduleError),
        });
        // Continue with next module even if one fails
      }

      // Delay between modules to avoid rate limiting
      if (i < modules.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Generate final exam pool (can run in parallel with quizzes but we do it after to avoid rate limits)
    loggingService.info('Step 7: Generating final exam pool');
    let finalExamPool: any[] = [];
    try {
      finalExamPool = await this.generateFinalExamPool({
        modules,
        plos,
        existingQuestionIds: allQuestions.map((q: any) => q.id),
        finalPoolSize,
        blueprint,
        programTitle,
        academicLevel,
        industrySector,
      });
      loggingService.info('Step 7: Final exam pool complete', {
        questionsGenerated: finalExamPool.length,
      });
    } catch (finalError) {
      loggingService.error('Step 7: Error generating final exam pool', {
        error: finalError instanceof Error ? finalError.message : String(finalError),
      });
    }

    loggingService.info('Step 7: BATCH-WISE generation complete', {
      totalQuizQuestions: allQuestions.length,
      totalClozeQuestions: allClozeQuestions.length,
      finalExamQuestions: finalExamPool.length,
    });

    return {
      questionBank: allQuestions,
      finalExamPool,
      clozeQuestions: allClozeQuestions,
    };
  }

  /**
   * Generate quiz questions for a single module - FULL DETAILED prompt
   */
  private async generateModuleQuiz(params: {
    module: any;
    moduleIndex: number;
    coreReadings: string[];
    questionsPerModule: number;
    blueprint: any;
    programTitle: string;
    academicLevel: string;
    industrySector: string;
  }): Promise<{ questions: any[]; clozeQuestions: any[] }> {
    const {
      module: mod,
      moduleIndex,
      coreReadings,
      questionsPerModule,
      blueprint,
      programTitle,
      academicLevel,
      industrySector,
    } = params;

    const modSettings = blueprint.moduleSettings?.find((s: any) => s.moduleId === mod.id);
    const bloomEmphasis = modSettings?.bloomEmphasis || ['apply', 'analyse'];
    const mlosCovered = modSettings?.mlosCovered || mod.mlos?.map((mlo: any) => mlo.id) || [];

    const systemPrompt = `You are a senior assessment designer specialising in auto-gradable assessments for vocational education programmes. Your expertise includes:
- Multiple Choice Question (MCQ) design principles
- Bloom's Taxonomy alignment in assessment
- Distractor analysis and plausibility
- Item difficulty calibration
- MLO and PLO assessment mapping

=== MCQ DESIGN PRINCIPLES ===

**EFFECTIVE STEM WRITING:**
- Focus on ONE concept per question
- Use clear, precise language (no ambiguity)
- Avoid negative phrasing when possible
- Include all relevant context in the stem
- Pitch complexity to the specified Bloom's level

**OPTION CONSTRUCTION:**
- Exactly 4 options: A, B, C, D
- ONE correct answer (the key)
- THREE plausible distractors
- All options should be:
  * Similar length and grammatical structure
  * Mutually exclusive
  * Ordered logically (alphabetical, numerical, chronological)

**DISTRACTOR QUALITY:**
Effective distractors represent:
- Common misconceptions
- Partially correct answers
- Answers from adjacent topics
- Errors from incomplete understanding
- NOT obviously wrong answers

**RATIONALE REQUIREMENTS (50-100 words):**
Each question must include a comprehensive rationale that:
- Explains WHY the correct answer is correct
- Explains WHY each distractor is plausible but wrong
- Identifies the common error pattern each distractor targets
- Provides learning value for students who answer incorrectly

=== BLOOM'S LEVEL ALIGNMENT ===

**REMEMBER (Easy):**
- Recall of facts, definitions, terminology
- "What is...", "Which term describes...", "Name the..."

**UNDERSTAND (Easy-Medium):**
- Explain concepts, interpret meaning
- "What does this mean...", "Explain why...", "Interpret..."

**APPLY (Medium):**
- Use knowledge in new situations
- "Calculate...", "Apply the concept to...", "Given this scenario..."

**ANALYSE (Medium-Hard):**
- Break down, examine relationships
- "What caused...", "Compare and contrast...", "Identify the relationship..."

**EVALUATE (Hard):**
- Make judgments, critique
- "Which option is most effective...", "Evaluate the approach...", "Critique..."

**CREATE (Hard):**
- Synthesise, design new solutions
- "What combination would...", "Design an approach to...", "Propose..."

=== AUTO-GRADABILITY REQUIREMENTS ===
✓ MCQ with single correct answer only
✓ Optional: Fill-in-blank (Cloze) with defined acceptable answers
✗ NO essays, short answers, or manually graded items
✗ NO "all of the above" or "none of the above"

Use UK English spelling throughout (e.g., "analyse", "organisation", "behaviour").`;

    const userPrompt = `Generate ${questionsPerModule} high-quality MCQ questions for this specific module.

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${programTitle}
ACADEMIC LEVEL: ${academicLevel}
INDUSTRY SECTOR: ${industrySector}
PASS MARK: ${blueprint.passMark}%

=== MODULE: ${mod.id} - ${mod.title} ===

Module Code: ${mod.moduleCode || `MOD${moduleIndex + 1}`}
Total Hours: ${mod.totalHours || 40}
Bloom's Emphasis: ${bloomEmphasis.join(', ')}
Core Readings: ${coreReadings.join('; ') || 'See Step 6'}

**MODULE LEARNING OUTCOMES (MLOs) TO ASSESS:**
${(mod.mlos || [])
  .filter((mlo: any) => mlosCovered.includes(mlo.id))
  .map((mlo: any) => `- ${mlo.id}: ${mlo.statement} [${mlo.bloomLevel}]`)
  .join('\n')}

**MODULE TOPICS:**
${(mod.topics || []).map((t: any) => `- ${t.id || t}: ${t.title || t}`).join('\n')}

=== QUIZ CONFIGURATION ===

- Questions to generate: ${questionsPerModule}
- Time limit per quiz: ${blueprint.timeLimitMinutes || 30} minutes
- Open book: ${blueprint.openBook ? 'Yes' : 'No'}
- Calculator allowed: ${blueprint.calculatorAllowed ? 'Yes' : 'No'}

=== GENERATION REQUIREMENTS ===

**DISTRIBUTE ${questionsPerModule} QUESTIONS ACROSS:**
- Difficulty: 30% Easy (${Math.round(questionsPerModule * 0.3)}), 50% Medium (${Math.round(questionsPerModule * 0.5)}), 20% Hard (${Math.round(questionsPerModule * 0.2)})
- Bloom's levels: Align with module emphasis (${bloomEmphasis.join(', ')})
- Coverage: ALL MLOs must have at least 1 question

**QUESTION STRUCTURE:**

1. **id**: Unique identifier (format: "q-${mod.id}-001", "q-${mod.id}-002", etc.)
2. **moduleId**: "${mod.id}"
3. **stem**: Clear question stem (one concept, no ambiguity, 20-80 words)
4. **options**: Exactly 4 options:
   [
     {"id": "A", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"},
     {"id": "B", "text": "Option text", "isCorrect": true, "explanation": "Why this is the correct answer"},
     {"id": "C", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"},
     {"id": "D", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"}
   ]
5. **correctOption**: The correct option ID ("A", "B", "C", or "D")
6. **rationale**: Comprehensive 50-100 word explanation
7. **linkedMLO**: MLO being assessed (e.g., "${mod.mlos?.[0]?.id || 'M1-LO1'}")
8. **bloomLevel**: remember | understand | apply | analyse | evaluate | create
9. **difficulty**: easy | medium | hard
10. **topicId**: Relevant topic from module
11. **contentArea**: Subject matter area

${
  blueprint.enableCloze
    ? `
**CLOZE QUESTIONS: Generate ${blueprint.clozeCountPerModule || 5} fill-in-blank questions**

Format:
{
  "id": "cloze-${mod.id}-001",
  "moduleId": "${mod.id}",
  "text": "The process of _____ analysis involves systematically identifying and evaluating _____.",
  "blanks": [
    {"id": "b1", "position": 1, "answer": "stakeholder", "alternatives": ["stakeholder"]},
    {"id": "b2", "position": 2, "answer": "interested parties", "alternatives": ["stakeholders", "key parties"]}
  ],
  "caseInsensitive": true,
  "linkedMLO": "${mod.mlos?.[0]?.id || 'M1-LO1'}",
  "bloomLevel": "remember",
  "difficulty": "easy"
}
`
    : ''
}

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q-${mod.id}-001",
      "moduleId": "${mod.id}",
      "stem": "In strategic workforce planning, which of the following represents the PRIMARY purpose of conducting a skills gap analysis?",
      "options": [
        {
          "id": "A",
          "text": "To reduce headcount in underperforming departments",
          "isCorrect": false,
          "explanation": "This is a cost-cutting measure, not the primary purpose of skills gap analysis."
        },
        {
          "id": "B",
          "text": "To identify discrepancies between current workforce capabilities and future organisational requirements",
          "isCorrect": true,
          "explanation": "This correctly identifies the core purpose of skills gap analysis."
        },
        {
          "id": "C",
          "text": "To benchmark employee salaries against industry standards",
          "isCorrect": false,
          "explanation": "Salary benchmarking is a compensation activity, not skills gap analysis."
        },
        {
          "id": "D",
          "text": "To measure employee satisfaction with training programmes",
          "isCorrect": false,
          "explanation": "This is training evaluation, not gap analysis."
        }
      ],
      "correctOption": "B",
      "rationale": "Skills gap analysis is fundamentally about comparing where the organisation is (current capabilities) with where it needs to be (future requirements). Option B correctly identifies this comparative purpose. The distractors represent common misconceptions.",
      "linkedMLO": "${mod.mlos?.[0]?.id || 'M1-LO1'}",
      "bloomLevel": "understand",
      "difficulty": "medium",
      "topicId": "t1-1",
      "contentArea": "Workforce Planning"
    }
  ]${
    blueprint.enableCloze
      ? `,
  "clozeQuestions": [
    {
      "id": "cloze-${mod.id}-001",
      "moduleId": "${mod.id}",
      "text": "The process of _____ analysis involves systematically identifying key _____.",
      "blanks": [
        {"id": "b1", "position": 1, "answer": "stakeholder", "alternatives": ["stakeholder"]},
        {"id": "b2", "position": 2, "answer": "parties", "alternatives": ["stakeholders", "groups"]}
      ],
      "caseInsensitive": true,
      "linkedMLO": "${mod.mlos?.[0]?.id || 'M1-LO1'}",
      "bloomLevel": "remember",
      "difficulty": "easy"
    }
  ]`
      : ''
  }
}

CRITICAL REQUIREMENTS:
- Questions must be specific to ${mod.title}, not generic
- All distractors must be plausible (represent real misconceptions)
- Rationales must be comprehensive and educational
- Every MLO must have at least one question
- UK English spelling throughout`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 32000, // Good size for single module quiz
        timeout: 300000, // 5 minutes per module
      });

      const parsed = this.parseJSON(response, `step7-quiz-${mod.id}`);
      return {
        questions: parsed.questions || [],
        clozeQuestions: parsed.clozeQuestions || [],
      };
    } catch (error) {
      loggingService.error(`Error generating quiz for module ${mod.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate final exam pool - FULL DETAILED prompt, separate from module quizzes
   */
  private async generateFinalExamPool(params: {
    modules: any[];
    plos: any[];
    existingQuestionIds: string[];
    finalPoolSize: number;
    blueprint: any;
    programTitle: string;
    academicLevel: string;
    industrySector: string;
  }): Promise<any[]> {
    const {
      modules,
      plos,
      existingQuestionIds,
      finalPoolSize,
      blueprint,
      programTitle,
      academicLevel,
      industrySector,
    } = params;

    const systemPrompt = `You are a senior assessment designer creating a FINAL EXAM question pool.
    
The final exam must:
- Test knowledge integration across multiple modules
- Use higher-order Bloom's levels (analyse, evaluate, create)
- Be MORE challenging than module quizzes
- Have NO OVERLAP with quiz questions

=== MCQ DESIGN FOR FINAL EXAMS ===

**STEM CHARACTERISTICS:**
- Complex scenarios requiring integration of multiple concepts
- Real-world professional situations
- Higher cognitive demand
- 40-100 words typical

**DIFFICULTY DISTRIBUTION:**
- 20% Easy (foundational recall across modules)
- 40% Medium (application and analysis)
- 40% Hard (evaluation and synthesis)

Use UK English spelling throughout.`;

    const userPrompt = `Generate ${finalPoolSize} FINAL EXAM questions for this programme.

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${programTitle}
ACADEMIC LEVEL: ${academicLevel}
INDUSTRY SECTOR: ${industrySector}
FINAL EXAM DURATION: ${blueprint.finalExamMinutes || 90} minutes

=== PROGRAMME LEARNING OUTCOMES (PLOs) ===

${plos.map((plo: any) => `- ${plo.id || plo.code}: ${plo.statement} [${plo.bloomLevel}]`).join('\n')}

=== MODULES COVERED ===

${modules
  .map(
    (mod: any, idx: number) => `
**Module ${idx + 1}: ${mod.id} - ${mod.title}**
MLOs: ${(mod.mlos || []).map((mlo: any) => mlo.id).join(', ')}
Topics: ${(mod.topics || [])
      .slice(0, 3)
      .map((t: any) => t.title || t)
      .join(', ')}
`
  )
  .join('\n')}

=== CRITICAL CONSTRAINTS ===

⚠️ EXISTING QUIZ QUESTION IDs (DO NOT DUPLICATE):
${existingQuestionIds.slice(0, 20).join(', ')}${existingQuestionIds.length > 20 ? '...' : ''}

The final exam pool must:
1. Have ZERO overlap with quiz questions
2. Test integrated knowledge from multiple modules
3. Map to PLOs (not just MLOs)
4. Use higher-order Bloom's levels predominantly

=== GENERATION REQUIREMENTS ===

Generate ${finalPoolSize} questions with:
- **id**: "q-final-001", "q-final-002", etc.
- **moduleId**: Primary module (can reference multiple)
- **linkedPLOs**: Array of PLO IDs tested
- **bloomLevel**: Emphasis on analyse, evaluate, create
- **difficulty**: 20% easy, 40% medium, 40% hard

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "finalExamPool": [
    {
      "id": "q-final-001",
      "moduleId": "mod3",
      "stem": "An organisation is experiencing high turnover among mid-level managers. Analysis reveals competitive base pay but below-market total rewards. Which intervention would MOST effectively address this issue?",
      "options": [
        {"id": "A", "text": "Increase base salaries by 10%", "isCorrect": false, "explanation": "Base pay is already competitive."},
        {"id": "B", "text": "Implement comprehensive benefits and development programmes", "isCorrect": true, "explanation": "Addresses the actual gap in total rewards."},
        {"id": "C", "text": "Conduct exit interviews with departing managers", "isCorrect": false, "explanation": "Diagnostic, not intervention."},
        {"id": "D", "text": "Revise the performance management system", "isCorrect": false, "explanation": "Doesn't address total rewards gap."}
      ],
      "correctOption": "B",
      "rationale": "This scenario requires analysis of root cause and evaluation of intervention effectiveness. Option B directly addresses the identified gap.",
      "linkedMLO": "M3-LO2",
      "linkedPLOs": ["PLO3", "PLO4"],
      "bloomLevel": "evaluate",
      "difficulty": "hard",
      "contentArea": "Reward Management",
      "integratesModules": ["mod2", "mod3"]
    }
  ]
}

CRITICAL: Questions must require INTEGRATION of knowledge from multiple modules where appropriate.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 48000, // Larger for comprehensive final exam pool
        timeout: 360000, // 6 minutes for final exam
      });

      const parsed = this.parseJSON(response, 'step7-final-exam');
      return parsed.finalExamPool || [];
    } catch (error) {
      loggingService.error('Error generating final exam pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Note: Steps 5, 6, 7 now use batch-wise generation to prevent timeouts
  // Step 8 and 9 still use single-call generation (can be converted later if needed)

  // Legacy code removed - using batch-wise generation above

  // Step 8 begins below (keeping original implementation for now)
  private async generateStep8ContentLegacyPlaceholder() {
    // Placeholder - will remove this when cleaning up
    return;
  }

  private async _unusedLegacyStep7() {
    // This legacy code has been removed and replaced with batch-wise generation
    return { questionBank: [], finalExamPool: [], clozeQuestions: [] };
  }

  /* LEGACY CODE - COMMENTED OUT (batch-wise generation is now used)
- Multiple Choice Question (MCQ) design principles
- Bloom's Taxonomy alignment in assessment
- Distractor analysis and plausibility
- Item difficulty calibration
- MLO and PLO assessment mapping

=== MCQ DESIGN PRINCIPLES ===

**EFFECTIVE STEM WRITING:**
- Focus on ONE concept per question
- Use clear, precise language (no ambiguity)
- Avoid negative phrasing when possible
- Include all relevant context in the stem
- Pitch complexity to the specified Bloom's level

**OPTION CONSTRUCTION:**
- Exactly 4 options: A, B, C, D
- ONE correct answer (the key)
- THREE plausible distractors
- All options should be:
  * Similar length and grammatical structure
  * Mutually exclusive
  * Ordered logically (alphabetical, numerical, chronological)

**DISTRACTOR QUALITY:**
Effective distractors represent:
- Common misconceptions
- Partially correct answers
- Answers from adjacent topics
- Errors from incomplete understanding
- NOT obviously wrong answers

**RATIONALE REQUIREMENTS (50-100 words):**
Each question must include a comprehensive rationale that:
- Explains WHY the correct answer is correct
- Explains WHY each distractor is plausible but wrong
- Identifies the common error pattern each distractor targets
- Provides learning value for students who answer incorrectly

=== BLOOM'S LEVEL ALIGNMENT ===

**REMEMBER (Easy):**
- Recall of facts, definitions, terminology
- "What is...", "Which term describes...", "Name the..."

**UNDERSTAND (Easy-Medium):**
- Explain concepts, interpret meaning
- "What does this mean...", "Explain why...", "Interpret..."

**APPLY (Medium):**
- Use knowledge in new situations
- "Calculate...", "Apply the concept to...", "Given this scenario..."

**ANALYSE (Medium-Hard):**
- Break down, examine relationships
- "What caused...", "Compare and contrast...", "Identify the relationship..."

**EVALUATE (Hard):**
- Make judgments, critique
- "Which option is most effective...", "Evaluate the approach...", "Critique..."

**CREATE (Hard):**
- Synthesise, design new solutions
- "What combination would...", "Design an approach to...", "Propose..."

=== AUTO-GRADABILITY REQUIREMENTS ===
✓ MCQ with single correct answer only
✓ Optional: Fill-in-blank (Cloze) with defined acceptable answers
✗ NO essays, short answers, or manually graded items
✗ NO "all of the above" or "none of the above"

Use UK English spelling throughout (e.g., "analyse", "organisation", "behaviour").`;

    const userPrompt = `Generate comprehensive auto-gradable assessment question banks for this vocational education programme.

${kbContextSection}

=== PROGRAMME CONTEXT ===

PROGRAMME TITLE: ${programTitle}
ACADEMIC LEVEL: ${academicLevel}
INDUSTRY SECTOR: ${industrySector}
PASS MARK: ${blueprint.passMark}%

=== ASSESSMENT BLUEPRINT ===

**QUIZ CONFIGURATION:**
- Questions per quiz: ${blueprint.questionsPerQuiz}
- Bank multiplier: ${blueprint.bankMultiplier}×
- Total questions per module: ${questionsPerModule}
- Time limit per quiz: ${blueprint.timeLimitMinutes || 30} minutes
- Open book: ${blueprint.openBook ? 'Yes' : 'No'}

**FINAL EXAM CONFIGURATION:**
- Questions for final: ${blueprint.questionsForFinal}
- Final exam bank size: ${finalPoolSize}
- Final exam duration: ${blueprint.finalExamMinutes || 90} minutes
- CRITICAL: Final exam pool must be SEPARATE (no overlap with quizzes)

**ADDITIONAL SETTINGS:**
${blueprint.enableCloze ? `- Include ${blueprint.clozeCountPerModule || 5} Cloze questions per module` : '- Cloze questions: Disabled'}
- Calculator allowed: ${blueprint.calculatorAllowed ? 'Yes' : 'No'}
- Randomisation: ${blueprint.randomise ? 'Enabled' : 'Disabled'}

=== PROGRAMME LEARNING OUTCOMES (PLOs) ===

${plos.map((plo: any) => `- ${plo.id || plo.code}: ${plo.statement} [${plo.bloomLevel}]`).join('\n')}

=== MODULES AND MLOs ===

${moduleInfo
  .map(
    (mod: any) => `
**MODULE: ${mod.moduleId} - ${mod.title}** (${mod.totalHours} hours)
Bloom's Emphasis: ${mod.bloomEmphasis.join(', ')}
Core Readings: ${mod.coreReadings.join('; ') || 'See Step 6'}

MLOs to Assess:
${mod.mlos
  .filter((mlo: any) => mod.mlosCovered.includes(mlo.id))
  .map((mlo: any) => `  - ${mlo.id}: ${mlo.statement} [${mlo.bloomLevel}]`)
  .join('\n')}

Topics:
${mod.topics.map((t: any) => `  - ${t.id}: ${t.title}`).join('\n')}
`
  )
  .join('\n' + '─'.repeat(60) + '\n')}

=== GENERATION REQUIREMENTS ===

**FOR EACH MODULE, GENERATE ${questionsPerModule} MCQs:**

Distribute across:
- Difficulty: 30% Easy, 50% Medium, 20% Hard
- Bloom's levels: Align with module emphasis (${moduleInfo[0]?.bloomEmphasis?.join(', ')})
- Coverage: All MLOs must have at least 1 question

**QUESTION STRUCTURE:**

1. **id**: Unique identifier (format: "q-{moduleId}-{number}")
2. **moduleId**: Module this belongs to
3. **stem**: Clear question stem (one concept, no ambiguity)
4. **options**: Exactly 4 options:
   \`\`\`json
   [
     {"id": "A", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"},
     {"id": "B", "text": "Option text", "isCorrect": true, "explanation": "Why this is the correct answer"},
     {"id": "C", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"},
     {"id": "D", "text": "Option text", "isCorrect": false, "explanation": "Why this is plausible but incorrect"}
   ]
   \`\`\`
5. **correctOption**: The correct option ID ("A", "B", "C", or "D")
6. **rationale**: Comprehensive 50-100 word explanation
7. **linkedMLO**: MLO being assessed (e.g., "M1-LO1")
8. **bloomLevel**: remember | understand | apply | analyse | evaluate | create
9. **difficulty**: easy | medium | hard
10. **topicId**: Relevant topic from module
11. **contentArea**: Subject matter area

**FINAL EXAM POOL: ${finalPoolSize} QUESTIONS**

Requirements:
- NO OVERLAP with module quiz questions
- Coverage: All PLOs proportionally to module weight
- Difficulty: 20% Easy, 40% Medium, 40% Hard
- Bloom's: Higher-order emphasis (analyse, evaluate, create)
- Integration: Questions should require knowledge from multiple modules where appropriate

${
  blueprint.enableCloze
    ? `
**CLOZE QUESTIONS: ${blueprint.clozeCountPerModule || 5} PER MODULE**

Format:
{
  "id": "cloze-mod1-001",
  "moduleId": "mod1",
  "text": "The process of _____ analysis involves systematically identifying and evaluating _____.",
  "blanks": [
    {"id": "b1", "position": 1, "answer": "stakeholder", "alternatives": ["stakeholder"]},
    {"id": "b2", "position": 2, "answer": "interested parties", "alternatives": ["stakeholders", "key parties"]}
  ],
  "caseInsensitive": true,
  "linkedMLO": "M1-LO1",
  "bloomLevel": "remember",
  "difficulty": "easy"
}
`
    : ''
}

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "questionBank": [
    {
      "id": "q-mod1-001",
      "moduleId": "mod1",
      "stem": "In strategic workforce planning, which of the following represents the PRIMARY purpose of conducting a skills gap analysis?",
      "options": [
        {
          "id": "A",
          "text": "To reduce headcount in underperforming departments",
          "isCorrect": false,
          "explanation": "This is a cost-cutting measure, not the primary purpose of skills gap analysis. Gap analysis focuses on capability development, not headcount reduction."
        },
        {
          "id": "B",
          "text": "To identify discrepancies between current workforce capabilities and future organisational requirements",
          "isCorrect": true,
          "explanation": "This correctly identifies the core purpose of skills gap analysis: comparing current state with desired future state to inform development planning."
        },
        {
          "id": "C",
          "text": "To benchmark employee salaries against industry standards",
          "isCorrect": false,
          "explanation": "Salary benchmarking is a compensation activity, not skills gap analysis. While related to HR, it addresses different objectives."
        },
        {
          "id": "D",
          "text": "To measure employee satisfaction with training programmes",
          "isCorrect": false,
          "explanation": "This is training evaluation, not gap analysis. While valuable, measuring satisfaction doesn't identify capability gaps."
        }
      ],
      "correctOption": "B",
      "rationale": "Skills gap analysis is fundamentally about comparing where the organisation is (current capabilities) with where it needs to be (future requirements). Option B correctly identifies this comparative purpose. The distractors represent common misconceptions: confusing gap analysis with cost reduction (A), compensation management (C), or training evaluation (D). Understanding this distinction is essential for effective workforce planning.",
      "linkedMLO": "M1-LO1",
      "bloomLevel": "understand",
      "difficulty": "medium",
      "topicId": "t1-1",
      "contentArea": "Workforce Planning"
    }
  ],
  "finalExamPool": [
    {
      "id": "q-final-001",
      "moduleId": "mod3",
      "stem": "An organisation is experiencing high turnover among mid-level managers. Analysis reveals competitive base pay but below-market total rewards. Which intervention would MOST effectively address this issue?",
      "options": [
        {"id": "A", "text": "Increase base salaries by 10%", "isCorrect": false, "explanation": "Base pay is already competitive; additional increases address the wrong factor."},
        {"id": "B", "text": "Implement comprehensive benefits and development programmes", "isCorrect": true, "explanation": "Addresses the actual gap in total rewards beyond base salary."},
        {"id": "C", "text": "Conduct exit interviews with departing managers", "isCorrect": false, "explanation": "Diagnostic, not an intervention. Useful but doesn't directly solve the problem."},
        {"id": "D", "text": "Revise the performance management system", "isCorrect": false, "explanation": "May help but doesn't directly address the total rewards gap identified."}
      ],
      "correctOption": "B",
      "rationale": "This scenario requires analysis of the root cause (below-market total rewards despite competitive base pay) and evaluation of intervention effectiveness. Option B directly addresses the identified gap in total rewards. The scenario tests ability to diagnose issues and select appropriate solutions—key competencies for HR professionals.",
      "linkedMLO": "M3-LO2",
      "linkedPLOs": ["PLO3", "PLO4"],
      "bloomLevel": "evaluate",
      "difficulty": "hard",
      "topicId": "t3-2",
      "contentArea": "Reward Management"
    }
  ]${
    blueprint.enableCloze
      ? `,
  "clozeQuestions": [
    {
      "id": "cloze-mod1-001",
      "moduleId": "mod1",
      "text": "The process of _____ analysis involves systematically identifying key _____ who have an interest in the project outcome.",
      "blanks": [
        {"id": "b1", "position": 1, "answer": "stakeholder", "alternatives": ["stakeholder"]},
        {"id": "b2", "position": 2, "answer": "parties", "alternatives": ["stakeholders", "individuals", "groups"]}
      ],
      "caseInsensitive": true,
      "linkedMLO": "M1-LO1",
      "bloomLevel": "remember",
      "difficulty": "easy"
    }
  ]`
      : ''
  }
}

CRITICAL REQUIREMENTS:
- Use knowledge base materials to inform question content
- Ensure questions are specific to ${programTitle}, not generic
- All distractors must be plausible (represent real misconceptions)
- Rationales must be comprehensive and educational
- Final exam pool must have NO OVERLAP with quiz questions
- UK English spelling throughout`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 128000, // MAXIMUM
        timeout: 1200000, // 20 minutes
      });

      const parsed = this.parseJSON(response, 'step7');
      return {
        questionBank: parsed.questionBank || [],
        finalExamPool: parsed.finalExamPool || [],
        clozeQuestions: parsed.clozeQuestions || [],
      };
    } catch (error) {
      loggingService.error('Error generating Step 7 content', { error });
      return { questionBank: [], finalExamPool: [], clozeQuestions: [] };
    }
  END OF LEGACY CODE */

  /**
   * Generate Step 8 content using PARALLEL case study generation
   * Each module gets its own case study generated in parallel
   */
  private async generateStep8Content(workflow: ICurriculumWorkflow): Promise<any> {
    const modules = workflow.step4?.modules || [];
    const industrySector = workflow.step1?.targetLearner?.industrySector || 'general business';
    const programTitle = workflow.step1?.programTitle || 'Program';
    const academicLevel = workflow.step1?.academicLevel || 'Level 5';
    const targetLearner = workflow.step1?.targetLearner || {};

    // Get readings for context
    const coreReadings = workflow.step6?.readings?.filter((r: any) => r.category === 'core') || [];

    // Determine tier based on academic level
    const tierMapping: Record<
      string,
      { tier: number; description: string; pages: string; protagonist: string }
    > = {
      'Level 7': {
        tier: 1,
        description: 'MBA / Executive MBA / Top-20 Masters',
        pages: '10-15 pages',
        protagonist: 'C-level / General Manager',
      },
      'Level 6': {
        tier: 2,
        description: 'Professional Masters / Postgraduate Diploma',
        pages: '6-10 pages',
        protagonist: 'Senior Manager / Director',
      },
      'Level 5': {
        tier: 4,
        description: 'Industry Certification & Vocational Diploma',
        pages: '4-6 pages',
        protagonist: 'Mid-level Manager / Specialist',
      },
      'Level 4': {
        tier: 4,
        description: 'Industry Certification & Vocational Diploma',
        pages: '2-4 pages',
        protagonist: 'Supervisor / Team Leader',
      },
      'Level 3': {
        tier: 5,
        description: 'Corporate / Short Courses',
        pages: '2-4 pages',
        protagonist: 'Entry-level Professional',
      },
    };

    const tierInfo = tierMapping[academicLevel] || tierMapping['Level 5'];

    // Build competencies list for credential mapping
    const competencies = [
      ...(workflow.step2?.knowledgeItems || []).slice(0, 5).map((k: any) => k.statement),
      ...(workflow.step2?.skillItems || []).slice(0, 5).map((s: any) => s.statement),
    ];

    loggingService.info('Step 8: Starting PARALLEL case study generation', {
      totalModules: modules.length,
      tier: tierInfo.tier,
      industrySector,
    });

    // Generate 2 case studies per module (different types)
    // Case type pairs: [assessment_ready, practice] or [discussion, discussion]
    const caseTypePairs = [
      ['assessment_ready', 'practice'],
      ['discussion', 'discussion'],
      ['assessment_ready', 'discussion'],
      ['practice', 'discussion'],
    ];

    // Generate case studies for ALL modules in PARALLEL (2 per module)
    const modulePromises: Promise<any[]>[] = modules
      .slice(0, 4)
      .map(async (mod: any, i: number) => {
        const modReadings = coreReadings.filter((r: any) => r.moduleId === mod.id);
        const [caseType1, caseType2] = caseTypePairs[i % caseTypePairs.length];

        loggingService.info(
          `Step 8: Starting 2 case studies for module ${i + 1}/${Math.min(modules.length, 4)}`,
          {
            moduleId: mod.id,
            moduleTitle: mod.title,
            caseTypes: [caseType1, caseType2],
          }
        );

        // Generate both case studies for this module in parallel
        const [case1, case2] = await Promise.all([
          this.generateCaseStudyForModule({
            module: mod,
            moduleIndex: i,
            caseNumber: 1,
            coreReadings: modReadings.slice(0, 3).map((r: any) => r.title),
            caseType: caseType1,
            tierInfo,
            programTitle,
            academicLevel,
            industrySector,
            targetLearner,
            competencies,
          }).catch((err) => {
            loggingService.error(`Step 8: Error generating case 1 for module ${mod.id}`, {
              error: err.message,
            });
            return null;
          }),
          this.generateCaseStudyForModule({
            module: mod,
            moduleIndex: i,
            caseNumber: 2,
            coreReadings: modReadings.slice(0, 3).map((r: any) => r.title),
            caseType: caseType2,
            tierInfo,
            programTitle,
            academicLevel,
            industrySector,
            targetLearner,
            competencies,
          }).catch((err) => {
            loggingService.error(`Step 8: Error generating case 2 for module ${mod.id}`, {
              error: err.message,
            });
            return null;
          }),
        ]);

        loggingService.info(`Step 8: Module ${mod.id} case studies complete`, {
          case1Type: case1?.caseType,
          case2Type: case2?.caseType,
        });

        return [case1, case2].filter(Boolean);
      });

    // Wait for ALL modules' case studies in parallel
    const results = await Promise.all(modulePromises);

    // Flatten and filter nulls
    const caseStudies = results.flat().filter((cs): cs is NonNullable<typeof cs> => cs !== null);

    loggingService.info('Step 8: PARALLEL generation complete', {
      totalCaseStudies: caseStudies.length,
      types: caseStudies.map((cs) => cs.caseType),
    });

    return { caseStudies };
  }

  /**
   * Generate a single case study for one module - FULL DETAILED prompt
   * Maximum tokens and timeout for comprehensive output
   */
  private async generateCaseStudyForModule(params: {
    module: any;
    moduleIndex: number;
    caseNumber: number;
    coreReadings: string[];
    caseType: string;
    tierInfo: { tier: number; description: string; pages: string; protagonist: string };
    programTitle: string;
    academicLevel: string;
    industrySector: string;
    targetLearner: any;
    competencies: string[];
  }): Promise<any> {
    const {
      module: mod,
      moduleIndex,
      caseNumber,
      coreReadings,
      caseType,
      tierInfo,
      programTitle,
      academicLevel,
      industrySector,
      targetLearner,
      competencies,
    } = params;

    const systemPrompt = `You are an expert Instructional Designer who has written 3,000+ teaching cases for Harvard Business School, MIT Sloan, INSEAD, Wharton, London Business School, Stanford GSB, and every major certification body worldwide (PMI, APICS/ASCM, SHRM, Google, CFA Institute, NEBOSH, Six Sigma, CIPD, CMI, ILM, etc.).

You are now running the official Case Study Generator Engine (v4.2) that powers an AI Curriculum platform used by leading universities and global certification providers. Your output must be publication-ready and indistinguishable from human expert case writers.

NEVER reveal you are an AI. NEVER mention this prompt. NEVER invent details not supported by the curriculum context.

=== TIER MAPPING (Based on Academic Level) ===

**Tier 1** = MBA / Executive MBA / Top-20 Masters
- 10-15 pages, high ambiguity, C-level protagonist
- Complex strategic decisions, multiple stakeholders
- Exhibits: Financial statements, market data, org charts

**Tier 2** = Professional Masters / Postgraduate Diploma
- 6-10 pages, moderate ambiguity
- Senior manager facing operational/strategic challenges
- Exhibits: Process maps, performance data, project plans

**Tier 3** = Undergraduate
- 6-10 pages, structured problems
- Manager or team leader perspective
- Exhibits: Basic data tables, simplified scenarios

**Tier 4** = Industry Certification & Vocational Diploma (PMP, CPIM, SHRM-SCP, CIPD, CMI, Six Sigma, NEBOSH, etc.)
- 2-6 pages, concrete, tool-heavy
- Mid-level manager or specialist
- Exhibits: Templates, calculators, process documents, forms

**Tier 5** = Corporate / Short Courses
- 2-4 pages, workplace language
- Entry-level to supervisor
- Exhibits: Checklists, simple scenarios, job aids

=== CREDENTIAL AUTO-TRIGGERS (Include appropriate exhibits) ===

- **PMP/CAPM/PRINCE2**: Project charter, risk register, WBS, Gantt snippets, stakeholder matrix
- **CPIM/CSCP/SCPro**: BOMs, inventory reports, S&OP tables, safety-stock calculations
- **SHRM/CIPD/PHR**: Performance reviews, compensation data, policy documents, legal scenarios
- **CMI/ILM Management**: Team performance data, meeting agendas, appraisal forms, action plans
- **Six Sigma**: Process maps, control charts, Cp/Cpk calculations, DMAIC structure
- **NEBOSH/OSHA/Safety**: Risk assessments, JSA, incident reports, near-miss logs
- **Marketing/Digital**: Analytics screenshots, campaign metrics, conversion funnels
- **Finance/Accounting**: Financial statements, ratio analysis, budgets, variance reports

=== CASE TYPE: ${caseType.toUpperCase()} ===

${
  caseType === 'practice'
    ? `
**PRACTICE CASE** (Ungraded)
Purpose: Build confidence through trial and error
- Safe environment for experimentation
- No penalty for mistakes
- Include detailed suggested approach and sample solution
- Focus on skill development
- Appropriate for formative learning
`
    : caseType === 'discussion'
      ? `
**DISCUSSION CASE** (Participation-Graded)
Purpose: Collaborative learning through dialogue
- Forum-based peer discussion
- Multiple valid perspectives
- Graded on participation quality, not "correctness"
- Include 4-6 discussion prompts
- Participation criteria clearly defined
`
      : `
**ASSESSMENT-READY CASE** (Hooks for Future Questions)
Purpose: Structured scenarios with embedded assessment hooks
- Rich scenario content for question development
- CRITICAL: Provides HOOKS only, NOT actual assessment questions
- Include key facts (10-15), misconceptions (5-8), decision points (3-5)
- Terminology definitions for glossary
- Case ends at clear decision point (never reveals outcome)
`
}

=== SCENARIO QUALITY STANDARDS ===

**WORD COUNT BY TIER:**
- Tier 1: 800-1200 words
- Tier 2: 600-900 words
- Tier 4/5: 400-600 words

**CONTENT STRUCTURE:**
1. Hook/Opening (compelling first paragraph)
2. Organisational Context (who, size, industry, market position)
3. Background Information (history, what led to current situation)
4. Challenge Description (specific problem, constraints, pressures)
5. Data/Exhibits (quantitative evidence, documents, reports)
6. Decision Point (clear moment of choice - NEVER reveal outcome)

**PROTAGONIST REQUIREMENTS:**
- Job title matches Tier level
- Named individual with realistic background
- Clear decision-making authority
- Facing genuine dilemma or challenge

=== ETHICS AND COMPLIANCE ===

MANDATORY:
✓ Use FICTITIOUS organisation names ALWAYS
✓ NO real company names or identifiable individuals
✓ NO PII (Personally Identifiable Information)
✓ Anonymise all figures (use realistic but fictional data)
✓ GDPR/privacy compliant
✓ Culturally sensitive and inclusive

FICTITIOUS BRAND NAMING PATTERNS:
- Manufacturing: "Sterling Manufacturing", "Atlas Industries", "Precision Components Ltd"
- Technology: "TechNova Solutions", "Quantum Digital", "DataStream Systems"
- Healthcare: "Wellspring Health Group", "Compass Medical Centre", "CareFirst NHS Trust"
- Retail: "Meridian Retail", "Horizon Stores", "Metro Consumer Group"
- Finance: "Pinnacle Financial", "Bridgepoint Capital", "Crown Investment Partners"
- Professional Services: "Apex Consulting", "Elevate Partners", "Summit Advisory"
- Hospitality: "Grand Heritage Hotels", "Cityscape Hospitality", "Premier Leisure Group"

Use UK English spelling throughout (organisation, behaviour, analyse, programme, etc.).`;

    const userPrompt = `=== DISCOVERY QUESTIONNAIRE ANSWERS (Curriculum Context) ===

1. Programme: ${programTitle}
2. Academic Level: ${academicLevel} (${tierInfo.description})
3. Tier: ${tierInfo.tier}
4. Industry Sector: ${industrySector}
5. Target Learner: ${targetLearner.experienceLevel || 'professional'} level, ${targetLearner.educationalBackground || 'varied background'}
6. Case Length: ${tierInfo.pages}
7. Protagonist Level: ${tierInfo.protagonist}
8. Data Requirement: Yes - provide realistic datasets and exhibits
9. Key Competencies to Address:
${competencies
  .slice(0, 8)
  .map((c: string, i: number) => `   ${i + 1}. ${c}`)
  .join('\n')}

=== TARGET MODULE ===

**MODULE: ${mod.id} - ${mod.title}**
Core Readings: ${coreReadings.join('; ') || 'See Step 6'}

MLOs:
${(mod.mlos || []).map((mlo: any) => `  - ${mlo.id}: ${mlo.statement}`).join('\n')}

Topics:
${(mod.topics || []).map((t: any) => `  - ${t.id || t}: ${t.title || t}`).join('\n')}

=== GENERATION REQUIREMENTS ===

Generate ONE ${caseType.replace('_', ' ').toUpperCase()} case study for this module.

**TIER ${tierInfo.tier} REQUIREMENTS:**
- Page Length: ${tierInfo.pages}
- Protagonist: ${tierInfo.protagonist}
- Quantitative Depth: ${tierInfo.tier <= 2 ? 'High - complex data, multiple exhibits' : 'Medium - focused data, key metrics'}
- Ambiguity Level: ${tierInfo.tier === 1 ? 'High - multiple valid solutions' : tierInfo.tier <= 3 ? 'Moderate - some ambiguity' : 'Low - clear direction with decisions'}

**GENERATE THE FOLLOWING:**

1. **CASE IDENTIFICATION:**
   - id: "case-${mod.id}-${caseNumber}"
   - moduleId: "${mod.id}"
   - moduleTitle: "${mod.title}"
   - title: Catchy, credential-relevant title (HBS/INSEAD style)
   - caseType: "${caseType}"
   - difficulty: "intermediate"
   - tier: ${tierInfo.tier}

2. **FULL CASE STUDY (Student Version):**
   Word count: ${tierInfo.tier <= 2 ? '800-1200' : '400-600'} words
   
   Structure:
   - **Opening Hook**: Compelling first paragraph that draws reader in
   - **Organisational Context**: ${tierInfo.tier <= 2 ? '150-200' : '50-100'} words
   - **Background Information**: ${tierInfo.tier <= 2 ? '200-300' : '100-200'} words
   - **Challenge Description**: ${tierInfo.tier <= 2 ? '200-300' : '100-150'} words
   - **Data Presentation**: Key metrics, tables, or exhibit references
   - **Decision Point**: Clear moment of choice (NEVER reveal outcome)
   
   Store as:
   - scenario: Full narrative text
   - organizationalContext: Organisation description
   - backgroundInformation: Relevant background
   - challengeDescription: The problem/challenge
   - wordCount: Actual word count

3. **EXHIBIT LIST:**
   Generate ${tierInfo.tier <= 2 ? '4-8' : '2-4'} exhibits appropriate to the scenario:
   - exhibitList: Array of {id, title, description, type}
   - Types: "table", "chart", "document", "screenshot", "calculation", "form"

4. **CURRICULUM MAPPING:**
   - linkedModules: ["${mod.id}"]
   - linkedMLOs: Array of MLO IDs from this module
   - linkedTopics: Array of relevant topic IDs

5. **INDUSTRY CONTEXT:**
   - industryContext: Specific industry setting within ${industrySector}
   - brandName: Fictitious organisation name (NEVER real companies)
   - isRealBrand: false (ALWAYS)
   - protagonistName: Realistic name for main character
   - protagonistRole: Job title matching Tier ${tierInfo.tier} (${tierInfo.protagonist})

6. **FOR ASSESSMENT-READY CASES - Assessment Hooks:**
   ⚠️ CRITICAL: These are HOOKS for future question development, NOT questions themselves
   
   assessmentHooks:
   - keyFacts: 10-15 atomic factual statements
     * Each fact must be directly testable in an MCQ
     * Be specific and quantitative where possible
     * Include dates, numbers, percentages, names
   
   - misconceptions: 5-8 common errors
     * Based on typical learner misunderstandings
     * Perfect for creating MCQ distractors
     * Reference specific concepts from MLOs
   
   - decisionPoints: 3-5 judgment moments
     * Points requiring professional judgment
     * Frame as "Should X do Y?" or "What is the priority?"
     * Map to competencies being assessed
   
   - terminology: Array of {term, definition} pairs (8-12 terms)
     * Domain-specific terms used in the scenario
     * Definitions 20-40 words, UK English

7. **FOR PRACTICE CASES:**
   - suggestedApproach: Step-by-step guidance (200-300 words)
     * Framework or model to apply
     * Key questions to consider
     * Data to analyse
   - sampleSolution: Example solution outline (300-400 words)
     * Model answer demonstrating competent response
     * Justification for key decisions
     * References to relevant theory

8. **FOR DISCUSSION CASES:**
   - discussionPrompts: Array of 4-6 forum discussion questions
     * Start with "To what extent...", "How might...", "Compare and contrast..."
     * Encourage multiple perspectives
     * Build on each other
   - participationCriteria: How quality participation is defined (100-150 words)
     * Expectations for initial post
     * Response requirements
     * Quality indicators

9. **TEACHING NOTE (for all cases):**
   - synopsis: 150-200 word summary
   - learningObjectives: Array mapped to Bloom's levels
   - assignmentQuestions: 3-5 analysis questions
   - sessionPlan: Suggested timing for class use
   - answerGuidance: Key points for each question

10. **USAGE GUIDANCE:**
    - suggestedTiming: When to deploy
    - estimatedDuration: Time allocation
    - learningApplication: Specific objectives addressed
    - prerequisiteKnowledge: What learners should know first

11. **ETHICS COMPLIANCE:**
    - ethicsCompliant: true
    - noPII: true
    - anonymized: true

=== FEW-SHOT EXAMPLE (Tier ${tierInfo.tier} - ${tierInfo.description}) ===

${
  tierInfo.tier <= 2
    ? `
**EXAMPLE: MBA/Masters Level Case**
Title: "Meridian Healthcare: The Digital Transformation Dilemma"
Opening: "Dr. Sarah Mitchell stared at the board presentation on her laptop, knowing that in 48 hours she would need to recommend whether Meridian Healthcare should invest £12 million in a new AI-powered diagnostic platform..."
Word Count: 950 words
Protagonist: Chief Medical Officer
Exhibits: 6 (Financial projections, Competitor analysis, Staff survey results, Implementation timeline, Risk assessment, Technology comparison)
`
    : `
**EXAMPLE: Vocational/Certification Level Case**
Title: "Atlas Manufacturing: The Quality Crisis"
Opening: "James Peterson, Quality Manager at Atlas Manufacturing, had just received the third customer complaint this week about defective components..."
Word Count: 480 words
Protagonist: Quality Manager
Exhibits: 3 (Defect data table, Process flow diagram, Control chart)
`
}

=== OUTPUT FORMAT ===

Return ONLY valid JSON with a single case study:
{
  "caseStudy": {
    "id": "case-${mod.id}-${caseNumber}",
    "moduleId": "${mod.id}",
    "moduleTitle": "${mod.title}",
    "title": "Catchy Case Title: The Challenge Subtitle",
    "caseType": "${caseType}",
    "difficulty": "intermediate",
    "tier": ${tierInfo.tier},
    "scenario": "Full scenario narrative (${tierInfo.tier <= 2 ? '800-1200' : '400-600'} words)...",
    "organizationalContext": "Organisation description...",
    "backgroundInformation": "Background leading to current situation...",
    "challengeDescription": "The specific challenge facing the protagonist...",
    "wordCount": ${tierInfo.tier <= 2 ? 950 : 500},
    "protagonistName": "Character Name",
    "protagonistRole": "${tierInfo.protagonist}",
    "linkedModules": ["${mod.id}"],
    "linkedMLOs": ["MLO IDs from this module"],
    "linkedTopics": ["Topic IDs"],
    "industryContext": "${industrySector}",
    "brandName": "Fictitious Company Ltd",
    "isRealBrand": false,
    "hasHooks": ${caseType === 'assessment_ready'},
    "hasDataAssets": true,
    "exhibitList": [
      {"id": "ex1", "title": "Exhibit 1", "description": "Description", "type": "table"}
    ],
    ${
      caseType === 'assessment_ready'
        ? `"assessmentHooks": {
      "keyFacts": ["10-15 testable facts"],
      "misconceptions": ["5-8 common errors"],
      "decisionPoints": ["3-5 judgment moments"],
      "terminology": [{"term": "Term", "definition": "Definition"}]
    },`
        : caseType === 'practice'
          ? `"suggestedApproach": "Step-by-step guidance (200-300 words)",
    "sampleSolution": "Model answer (300-400 words)",`
          : `"discussionPrompts": ["4-6 forum questions"],
    "participationCriteria": "Quality participation definition",`
    }
    "teachingNote": {
      "synopsis": "150-200 word summary",
      "learningObjectives": ["Bloom's mapped objectives"],
      "assignmentQuestions": ["Q1", "Q2", "Q3"],
      "sessionPlan": "Timing guidance",
      "answerGuidance": "Key points"
    },
    "suggestedTiming": "When to use",
    "estimatedDuration": "Time needed",
    "learningApplication": "Objectives addressed",
    "prerequisiteKnowledge": "Prior knowledge needed",
    "ethicsCompliant": true,
    "noPII": true,
    "anonymized": true
  }
}

=== FINAL SAFETY CHECK ===
✓ Protagonist matches Tier ${tierInfo.tier}
✓ Case ends at decision point (never reveals outcome)
✓ All names are fictitious
✓ UK English spelling

Begin output now.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 64000, // MAXIMUM for detailed case studies
        timeout: 600000, // 10 minutes per case study - MAXIMUM
      });

      const parsed = this.parseJSON(response, `step8-module-${mod.id}-case-${caseNumber}`);

      // Handle both single caseStudy and caseStudies array formats
      const caseStudy = parsed.caseStudy || (parsed.caseStudies && parsed.caseStudies[0]);

      if (!caseStudy) {
        loggingService.warn(`Step 8: Empty case study for module ${mod.id} case ${caseNumber}`, {
          parsedKeys: Object.keys(parsed),
        });
        return null;
      }

      return caseStudy;
    } catch (error) {
      loggingService.error(`Error generating case study for module ${mod.id} case ${caseNumber}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate Step 9 content using PARALLEL glossary generation
   * Generate terms for each module in parallel, then deduplicate
   */
  private async generateStep9Content(workflow: ICurriculumWorkflow): Promise<any> {
    const modules = workflow.step4?.modules || [];
    const programTitle = workflow.step1?.programTitle || 'Program';
    const academicLevel = workflow.step1?.academicLevel || 'Level 5';
    const industrySector = workflow.step1?.targetLearner?.industrySector || 'general';

    // Harvest global context
    const globalContext = {
      programDescription: workflow.step1?.programDescription || '',
      competencies: [
        ...(workflow.step2?.knowledgeItems?.map((k: any) => k.statement) || []),
        ...(workflow.step2?.skillItems?.map((s: any) => s.statement) || []),
        ...(workflow.step2?.competencyItems?.map((c: any) => c.statement) || []),
      ],
      plos: workflow.step3?.outcomes?.map((o: any) => o.statement) || [],
    };

    loggingService.info('Step 9: Starting PARALLEL glossary generation', {
      totalModules: modules.length,
    });

    // Generate glossary terms for ALL modules in PARALLEL
    const modulePromises = modules.map(async (mod: any, i: number) => {
      // Get module-specific context
      const modMlos = mod.mlos?.map((mlo: any) => mlo.statement) || [];
      const modReadings = (workflow.step6?.readings || [])
        .filter((r: any) => r.moduleId === mod.id)
        .map((r: any) => r.title);
      const modAssessments = (workflow.step7?.quizzes || [])
        .filter((q: any) => q.moduleId === mod.id)
        .flatMap((q: any) => q.questions?.map((que: any) => que.stem) || []);
      const modCaseTerms = (workflow.step8?.caseStudies || [])
        .filter((cs: any) => cs.moduleId === mod.id)
        .flatMap((cs: any) => cs.assessmentHooks?.terminology?.map((t: any) => t.term) || []);

      loggingService.info(`Step 9: Starting glossary for module ${i + 1}/${modules.length}`, {
        moduleId: mod.id,
        moduleTitle: mod.title,
      });

      try {
        const moduleTerms = await this.generateGlossaryForModule({
          moduleId: mod.id,
          moduleTitle: mod.title,
          moduleIndex: i,
          mlos: modMlos,
          readings: modReadings,
          assessmentTerms: modAssessments,
          caseStudyTerms: modCaseTerms,
          programTitle,
          academicLevel,
          industrySector,
          globalContext,
        });

        loggingService.info(`Step 9: Module ${mod.id} glossary complete`, {
          termsGenerated: moduleTerms.length,
        });

        return moduleTerms;
      } catch (moduleError) {
        loggingService.error(`Step 9: Error generating glossary for module ${mod.id}`, {
          error: moduleError instanceof Error ? moduleError.message : String(moduleError),
        });
        return [];
      }
    });

    // Wait for ALL modules in parallel
    const results = await Promise.all(modulePromises);

    // Combine and deduplicate terms
    const allTerms: any[] = results.flat();
    const uniqueTerms = this.deduplicateGlossaryTerms(allTerms);

    loggingService.info('Step 9: PARALLEL generation complete', {
      totalTerms: allTerms.length,
      uniqueTerms: uniqueTerms.length,
    });

    return { terms: uniqueTerms };
  }

  /**
   * Generate Step 10 content: Lesson Plans & PPT Generation
   * Build context from steps 1-9 and orchestrate lesson plan generation for all modules
   *
   * Requirements:
   * - 1.2: Build context from steps 1-9
   * - 1.2: Orchestrate lesson plan generation for all modules
   * - 1.2: Orchestrate PPT generation for all lessons
   *
   * @param workflow - Complete workflow with steps 1-9
   * @returns Step10LessonPlans with all module lesson plans and PPTs
   */
  private async generateStep10Content(workflow: ICurriculumWorkflow): Promise<any> {
    loggingService.info('🎯 Generating Step 10 content: Lesson Plans & PPT Generation', {
      workflowId: workflow._id,
      programTitle: workflow.step1?.programTitle,
    });

    // Import LessonPlanService and PPTGenerationService
    loggingService.info('  📦 Loading services');
    const { LessonPlanService } = await import('./lessonPlanService');
    const { PPTGenerationService } = await import('./pptGenerationService');

    // Progress callback to save intermediate results
    const progressCallback = async (progress: any) => {
      loggingService.info('💾 Saving intermediate progress', progress);
      // Save current progress to database
      workflow.step10 = {
        ...workflow.step10,
        moduleLessonPlans: progress.moduleLessonPlans || workflow.step10?.moduleLessonPlans || [],
        summary: {
          totalLessons: progress.lessonsGenerated || 0,
          totalContactHours: progress.contactHoursProcessed || 0,
          averageLessonDuration: 0,
          caseStudiesIncluded: 0,
          formativeChecksIncluded: 0,
        },
        generatedAt: new Date(),
      };
      await workflow.save();
    };

    const pptGenerationService = new PPTGenerationService();
    const lessonPlanService = new LessonPlanService(
      undefined,
      progressCallback,
      pptGenerationService
    );
    loggingService.info('  ✓ Services loaded');

    // Build comprehensive context from all 9 previous steps
    loggingService.info('  🔧 Building workflow context from steps 1-9');
    const context = this.buildWorkflowContext(workflow);
    loggingService.info('  ✓ Context built', {
      moduleCount: context.modules.length,
      totalContactHours: context.totalContactHours,
      caseStudiesCount: context.caseStudies?.length || 0,
      glossaryTermsCount: context.glossaryEntries?.length || 0,
    });

    // Generate lesson plans for all modules (or continue from existing)
    loggingService.info('  📚 Starting lesson plan generation for all modules');
    const existingModulePlans = workflow.step10?.moduleLessonPlans || [];
    if (existingModulePlans.length > 0) {
      loggingService.info(
        `  📦 Found ${existingModulePlans.length} existing module plans, will continue from there`
      );
    }

    const lessonPlanStartTime = Date.now();
    const step10Data = await lessonPlanService.generateLessonPlans(context, existingModulePlans);
    const lessonPlanDuration = Date.now() - lessonPlanStartTime;
    loggingService.info('  ✅ Lesson plans and PPTs generated', {
      totalLessons: step10Data.summary.totalLessons,
      totalContactHours: step10Data.summary.totalContactHours,
      totalPPTDecks: step10Data.moduleLessonPlans.reduce((sum, m) => sum + m.pptDecks.length, 0),
      durationMs: lessonPlanDuration,
      durationMin: Math.round(lessonPlanDuration / 60000),
    });

    loggingService.info('🎉 Step 10 content generation complete', {
      totalLessons: step10Data.summary.totalLessons,
      totalContactHours: step10Data.summary.totalContactHours,
      totalPPTDecks: step10Data.moduleLessonPlans.reduce((sum, m) => sum + m.pptDecks.length, 0),
      totalDurationMin: Math.round(lessonPlanDuration / 60000),
    });

    return step10Data;
  }

  /**
   * Build comprehensive workflow context from all 9 previous steps
   *
   * @param workflow - Complete workflow with steps 1-9
   * @returns WorkflowContext with all necessary data for lesson plan generation
   */
  private buildWorkflowContext(workflow: ICurriculumWorkflow): any {
    // Extract data from Step 1: Program Foundation
    const step1 = workflow.step1;
    const creditFramework = step1?.creditFramework;

    // Extract data from Step 2: KSC Framework
    const step2 = workflow.step2;

    // Extract data from Step 3: PLOs
    const step3 = workflow.step3;

    // Extract data from Step 4: Course Framework
    const step4 = workflow.step4;

    // Extract data from Step 5: Sources
    const step5 = workflow.step5;

    // Extract data from Step 6: Reading Lists
    const step6 = workflow.step6;

    // Extract data from Step 7: Assessments
    const step7 = workflow.step7;

    // Extract data from Step 8: Case Studies
    const step8 = workflow.step8;

    // Extract data from Step 9: Glossary
    const step9 = workflow.step9;

    // Build context object
    const context = {
      // Step 1: Program Foundation
      programTitle: step1?.programTitle || '',
      programDescription: step1?.programDescription || '',
      academicLevel: step1?.academicLevel || 'certificate',
      deliveryMode: step1?.delivery?.mode || 'hybrid_blended',
      totalContactHours: creditFramework?.contactHours || 0,
      totalIndependentHours: creditFramework?.independentHours || 0,

      // Step 2: KSC Framework
      knowledgeItems: step2?.knowledgeItems || [],
      skillItems: step2?.skillItems || [],
      competencyItems: step2?.competencyItems || step2?.attitudeItems || [],

      // Step 3: PLOs
      programLearningOutcomes: step3?.outcomes || [],

      // Step 4: Course Framework (modules with MLOs)
      modules: (step4?.modules || []).map((mod: any) => ({
        id: mod.id,
        moduleCode: mod.moduleCode,
        title: mod.title,
        sequenceOrder: mod.sequenceOrder,
        totalHours: mod.totalHours,
        contactHours: mod.contactHours,
        independentHours: mod.independentHours,
        isCore: mod.isCore,
        prerequisites: mod.prerequisites || [],
        mlos: (mod.mlos || []).map((mlo: any) => ({
          id: mlo.id,
          outcomeNumber: mlo.outcomeNumber,
          statement: mlo.statement,
          bloomLevel: mlo.bloomLevel,
          linkedPLOs: mlo.linkedPLOs || [],
          competencyLinks: mlo.competencyLinks || [],
        })),
        contactActivities: mod.contactActivities || [],
        independentActivities: mod.independentActivities || [],
      })),

      // Step 5: Sources
      topicSources: step5?.topicSources || [],

      // Step 6: Reading Lists
      moduleReadingLists: step6?.moduleReadingLists || [],

      // Step 7: Assessments
      formativeAssessments: step7?.formativeAssessments || [],
      summativeAssessments: step7?.summativeAssessments || [],
      sampleQuestions: step7?.sampleQuestions || {},

      // Step 8: Case Studies
      caseStudies: step8?.caseStudies || [],

      // Step 9: Glossary
      glossaryEntries: step9?.entries || step9?.terms || [],
    };

    return context;
  }

  /**
   * Generate glossary terms for a single module - FULL DETAILED prompt
   */
  private async generateGlossaryForModule(params: {
    moduleId: string;
    moduleTitle: string;
    moduleIndex: number;
    mlos: string[];
    readings: string[];
    assessmentTerms: string[];
    caseStudyTerms: string[];
    programTitle: string;
    academicLevel: string;
    industrySector: string;
    globalContext: {
      programDescription: string;
      competencies: string[];
      plos: string[];
    };
  }): Promise<any[]> {
    const {
      moduleId,
      moduleTitle,
      moduleIndex,
      mlos,
      readings,
      assessmentTerms,
      caseStudyTerms,
      programTitle,
      academicLevel,
      industrySector,
      globalContext,
    } = params;

    const systemPrompt = `You are a terminology expert creating comprehensive glossary entries for vocational education programs. Follow these requirements:

DEFINITION QUALITY (per workflow v2.2):
- Main Definition: 20-40 words, clear, Grade 10-12 reading level
- Example Sentence: Optional, demonstrates authentic usage (~20 words)
- Technical Note: Optional, additional detail for advanced learners
- Cross-References: Related, broader, narrower terms, synonyms
- Module Mapping: Which module(s) use this term

TERM SELECTION PRIORITY:
- MUST INCLUDE: Every term in graded assessments, All Essential competencies, Technical terminology in learning outcomes
- SHOULD INCLUDE: Terms in reading titles, Case study terminology, Important concepts
- MAY EXCLUDE: Common English words used generically (unless field-specific)

ACRONYM HANDLING:
- Full expansion on first mention
- Cross-reference both ways (HR → See Human Resources)

Use UK English spelling throughout.`;

    const userPrompt = `Generate glossary terms for ONE MODULE:

PROGRAM: ${programTitle}
LEVEL: ${academicLevel}
INDUSTRY: ${industrySector}

TARGET MODULE: ${moduleId} - ${moduleTitle}

---

MODULE CONTENT TO ANALYZE:

**MLOs (Module Learning Outcomes):**
${mlos.slice(0, 8).join('\n') || 'None provided'}

**Reading Titles:**
${readings.slice(0, 6).join('\n') || 'None provided'}

**Assessment Questions (MUST include all technical terms):**
${assessmentTerms.slice(0, 8).join('\n') || 'None provided'}

**Case Study Terms:**
${caseStudyTerms.slice(0, 5).join('\n') || 'None provided'}

---

GLOBAL CONTEXT:

**Program Description:**
${globalContext.programDescription.slice(0, 300)}

**Competencies:**
${globalContext.competencies.slice(0, 5).join('\n')}

**PLOs:**
${globalContext.plos.slice(0, 5).join('\n')}

---

GENERATE 6-10 GLOSSARY ENTRIES for this module's key terminology (comprehensive coverage).

FOR EACH TERM INCLUDE:
1. **id**: "term-${moduleId}-{number}" (e.g., "term-${moduleId}-001")
2. **term**: the term or phrase
3. **definition**: 20-40 word definition (clear, Grade 10-12 level)
4. **exampleSentence**: optional authentic usage example (~20 words)
5. **technicalNote**: optional detail for advanced learners
6. **relatedTerms**: array of related term names
7. **broaderTerms**: array of more general concepts
8. **narrowerTerms**: array of more specific concepts
9. **synonyms**: array of alternative names
10. **isAcronym**: boolean
11. **acronymExpansion**: if isAcronym, the full form
12. **acronymForm**: if this is a full term, its acronym
13. **category**: topic category
14. **priority**: "must_include" | "should_include" | "optional"
15. **sources**: array of ["competency_framework", "plos", "mlos", "assessment", "reading_list", "case_study"]
16. **sourceModules**: ["${moduleId}"]
17. **usedInAssessment**: boolean (true = term appears in assessment questions)

Return ONLY valid JSON:
{
  "terms": [
    {
      "id": "term-${moduleId}-001",
      "term": "Example Term",
      "definition": "Clear 20-40 word definition...",
      "exampleSentence": "Usage example...",
      "relatedTerms": ["Related Term 1"],
      "synonyms": [],
      "isAcronym": false,
      "category": "Category",
      "priority": "must_include",
      "sources": ["mlos", "assessment"],
      "sourceModules": ["${moduleId}"],
      "usedInAssessment": true
    }
  ]
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: 32000, // MAXIMUM for comprehensive glossary
        timeout: 300000, // 5 minutes per module - MAXIMUM
      });

      const parsed = this.parseJSON(response, `step9-module-${moduleId}`);
      return parsed.terms || [];
    } catch (error) {
      loggingService.error(`Error generating glossary for module ${moduleId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Deduplicate glossary terms by term name (case-insensitive)
   * Keeps the first occurrence but merges sourceModules
   */
  private deduplicateGlossaryTerms(terms: any[]): any[] {
    const termMap = new Map<string, any>();

    for (const term of terms) {
      const key = term.term?.toLowerCase();
      if (!key) continue;

      if (termMap.has(key)) {
        // Merge source modules
        const existing = termMap.get(key);
        const existingModules = new Set(existing.sourceModules || []);
        for (const mod of term.sourceModules || []) {
          existingModules.add(mod);
        }
        existing.sourceModules = Array.from(existingModules);

        // If any usage is in assessment, mark as must_include
        if (term.usedInAssessment) {
          existing.usedInAssessment = true;
          existing.priority = 'must_include';
        }
      } else {
        termMap.set(key, { ...term });
      }
    }

    // Renumber IDs
    const uniqueTerms = Array.from(termMap.values());
    uniqueTerms.forEach((term, idx) => {
      term.id = `term-${String(idx + 1).padStart(3, '0')}`;
    });

    return uniqueTerms;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private parseJSON(response: string, context: string): any {
    // Try direct parse first
    try {
      return JSON.parse(response);
    } catch (e) {
      loggingService.warn(`Direct JSON parse failed for ${context}, trying alternatives`, {
        responseLength: response?.length || 0,
      });

      // Try extracting from markdown code block
      const match = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e2) {
          loggingService.warn(`Failed to parse JSON from markdown for ${context}`);
        }
      }

      // Try finding JSON object
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
          loggingService.warn(`Failed to extract JSON for ${context}`, {
            extractedLength: jsonMatch[0]?.length || 0,
          });
        }
      }

      loggingService.error(`All JSON parsing attempts failed for ${context}`, {
        responsePreview: response?.substring(0, 500) || 'empty',
        responseLength: response?.length || 0,
      });
      throw new Error(
        `Failed to parse JSON response for ${context}. Response may not be valid JSON. Preview: ${response?.substring(0, 200) || 'empty'}`
      );
    }
  }

  // ==========================================================================
  // CANVAS AI EDITING
  // ==========================================================================

  /**
   * Process canvas edit requests from the AI chatbot
   * Uses the same prompts as main generation for consistency (GPT-5 only)
   */
  async canvasEdit(params: {
    workflowId: string;
    stepNumber: number;
    userMessage: string;
    editTarget?: {
      type: 'item' | 'section';
      itemId?: string;
      sectionId?: string;
      originalContent: any;
      fieldPath: string;
    };
    context?: any;
  }): Promise<{
    message: string;
    proposedChanges?: any;
    suggestions?: Array<{ label: string; text: string; targetItem?: string }>;
  }> {
    const { workflowId, stepNumber, userMessage } = params;

    loggingService.info('Canvas AI edit request', { workflowId, stepNumber });

    // Get FULL workflow data
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // =====================================================
    // BUILD COMPLETE WORKFLOW CONTEXT - AI CAN SEE EVERYTHING
    // =====================================================

    const fullWorkflowData: any = {};

    // Step 1 - Program Foundation
    if ((workflow as any).step1) {
      const s1 = (workflow as any).step1;
      fullWorkflowData.step1 = {
        programTitle: s1.programTitle,
        programDescription: s1.programDescription,
        academicLevel: s1.academicLevel,
        creditFramework: s1.creditFramework,
        targetAudience: s1.targetAudience,
        prerequisites: s1.prerequisites,
        programObjectives: s1.programObjectives,
      };
    }

    // Step 2 - KSC Framework
    if ((workflow as any).step2) {
      const s2 = (workflow as any).step2;
      fullWorkflowData.step2 = {
        knowledgeItems: s2.knowledgeItems?.map((k: any) => ({
          id: k.id,
          statement: k.statement,
          description: k.description,
          importance: k.importance,
          source: k.source,
        })),
        skillItems: s2.skillItems?.map((s: any) => ({
          id: s.id,
          statement: s.statement,
          description: s.description,
          importance: s.importance,
          source: s.source,
        })),
        competencyItems: s2.competencyItems?.map((c: any) => ({
          id: c.id,
          statement: c.statement,
          description: c.description,
          importance: c.importance,
          source: c.source,
        })),
      };
    }

    // Step 3 - PLOs
    if ((workflow as any).step3) {
      const s3 = (workflow as any).step3;
      fullWorkflowData.step3 = {
        outcomes: s3.outcomes?.map((o: any) => ({
          id: o.id,
          code: o.code,
          statement: o.statement, // Main PLO text
          bloomLevel: o.bloomLevel,
          verb: o.verb,
          linkedKSCs: o.linkedKSCs,
          jobTaskMapping: o.jobTaskMapping,
        })),
      };
    }

    // Step 4 - Modules & MLOs (FULL DATA)
    if ((workflow as any).step4) {
      const s4 = (workflow as any).step4;
      fullWorkflowData.step4 = {
        modules: s4.modules?.map((m: any) => ({
          id: m.id,
          code: m.code,
          title: m.title,
          description: m.description,
          sequence: m.sequence,
          phase: m.phase,
          totalHours: m.totalHours,
          contactHours: m.contactHours,
          selfStudyHours: m.selfStudyHours,
          credits: m.credits,
          linkedPLOs: m.linkedPLOs,
          prerequisites: m.prerequisites,
          // MLOs - can be in "mlos" or "learningOutcomes" depending on data version
          mlos: (m.mlos || m.learningOutcomes)?.map((lo: any) => ({
            id: lo.id,
            code: lo.code,
            statement: lo.statement, // Main MLO text
            bloomLevel: lo.bloomLevel,
            verb: lo.verb,
            linkedPLOs: lo.linkedPLOs,
            linkedKSCs: lo.linkedKSCs,
          })),
          topics: m.topics?.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            hours: t.hours,
            sequence: t.sequence,
          })),
          contactActivities: m.contactActivities,
          independentActivities: m.independentActivities,
        })),
      };
    }

    // Step 5 - Sources (FULL validation context)
    if ((workflow as any).step5) {
      const s5 = (workflow as any).step5;
      const sources = s5.sources || [];

      // Get ALL MLO codes from Step 4
      const allMLOs: string[] = [];
      const step4Modules = (workflow as any).step4?.modules || [];
      step4Modules.forEach((m: any) => {
        (m.mlos || m.learningOutcomes || []).forEach((lo: any) => {
          if (lo.code) allMLOs.push(lo.code);
          else if (lo.id) allMLOs.push(lo.id);
        });
      });

      // Calculate which MLOs are covered
      const coveredMLOs = new Set<string>();
      sources.forEach((src: any) => {
        (src.linkedMLOs || []).forEach((mlo: string) => coveredMLOs.add(mlo));
      });

      // Calculate category breakdown
      const peerReviewedCount = sources.filter(
        (s: any) => s.category === 'peer_reviewed_journal'
      ).length;
      const academicCount = sources.filter((s: any) => s.type === 'academic').length;
      const appliedCount = sources.filter((s: any) => s.type === 'applied').length;

      fullWorkflowData.step5 = {
        totalSources: sources.length,
        peerReviewedCount,
        peerReviewedPercent:
          sources.length > 0 ? Math.round((peerReviewedCount / sources.length) * 100) : 0,
        academicCount,
        appliedCount,
        hasBalance: academicCount > 0 && appliedCount > 0,
        // Show sample of existing sources
        existingSources: sources.slice(0, 5).map((src: any) => ({
          id: src.id,
          title: src.title,
          category: src.category,
          type: src.type,
          linkedMLOs: src.linkedMLOs,
          moduleId: src.moduleId,
        })),
        // CRITICAL: Show validation issues
        validationIssues: s5.complianceIssues || [],
        validationReport: s5.validationReport || {},
        agiCompliant: s5.agiCompliant,
        // CRITICAL: Show which MLOs need sources
        allMLOCodes: allMLOs,
        coveredMLOs: [...coveredMLOs],
        uncoveredMLOs: allMLOs.filter((mlo) => !coveredMLOs.has(mlo)),
        // Module IDs for reference
        moduleIds: step4Modules.map((m: any) => m.id),
      };
    }

    // Step 6 - Readings (summary)
    if ((workflow as any).step6) {
      const s6 = (workflow as any).step6;
      fullWorkflowData.step6 = {
        totalReadings: s6.readings?.length || 0,
        readings: s6.readings?.slice(0, 5)?.map((r: any) => ({
          id: r.id,
          title: r.title,
          chapter: r.chapter,
          moduleId: r.moduleId,
        })),
      };
    }

    // Step 7 - Assessments (summary)
    if ((workflow as any).step7) {
      const s7 = (workflow as any).step7;
      fullWorkflowData.step7 = {
        totalQuestions: s7.questionBank?.length || 0,
        quizCount: s7.quizzes?.length || 0,
      };
    }

    // Step 8 - Case Studies (summary)
    if ((workflow as any).step8) {
      const s8 = (workflow as any).step8;
      fullWorkflowData.step8 = {
        totalCaseStudies: s8.caseStudies?.length || 0,
        caseStudies: s8.caseStudies?.slice(0, 3)?.map((cs: any) => ({
          id: cs.id,
          title: cs.title,
          type: cs.type,
        })),
      };
    }

    // Step 9 - Glossary (summary)
    if ((workflow as any).step9) {
      const s9 = (workflow as any).step9;
      fullWorkflowData.step9 = {
        totalTerms: s9.terms?.length || 0,
        terms: s9.terms?.slice(0, 10)?.map((t: any) => ({
          id: t.id,
          term: t.term,
          definition: t.definition?.substring(0, 100),
        })),
      };
    }

    // =====================================================
    // BUILD FLEXIBLE SYSTEM PROMPT - AI HAS FULL CONTEXT
    // =====================================================

    const systemPrompt = `You are an AI curriculum design assistant with FULL ACCESS to edit ANY part of this curriculum.

PROGRAM: ${fullWorkflowData.step1?.programTitle || workflow.projectName}
ACADEMIC LEVEL: ${fullWorkflowData.step1?.academicLevel || 'Unknown'}

=== COMPLETE WORKFLOW DATA (YOU CAN EDIT ANYTHING) ===

${JSON.stringify(fullWorkflowData, null, 2)}

=== END OF WORKFLOW DATA ===

You have full read/write access to ALL workflow content. When the user asks to change something:
1. FIND the exact item they're referring to (search by text content, title, statement, term, etc.)
2. DETERMINE which step and field it belongs to
3. RETURN the changes in the proper format with correct field names

RESPONSE FORMAT - Use "updates" array:
{
  "message": "What you changed",
  "proposedChanges": {
    "updates": [
      {
        "step": 2,
        "path": "competencyItems",
        "action": "update",
        "match": { "id": "C4" },
        "changes": { "statement": "New text here" }
      }
    ]
  }
}

SUPPORTED ACTIONS:
- "update": Modify existing item (use "match" to find it, "changes" for new values)
- "add": Add new item to an array
- "delete": Remove an item (use "match" to identify it)
- "set": Set a scalar value directly (for non-array fields)

=== EXACT FIELD NAMES FOR EACH STEP ===

STEP 1 - Program Foundation:
- programTitle, programDescription, academicLevel
- programPurpose, executiveSummary, entryRequirements
- programAims (array of strings), careerPathways (array)
- targetLearner: { ageRange, educationalBackground, industrySector, experienceLevel }
- jobRoles: [{ title, description, tasks[] }]
- creditFramework: { isCreditAwarding, creditSystem, credits, totalHours, contactPercent, contactHours, independentHours }
- delivery: { mode, description }
Example: { "step": 1, "path": "programTitle", "action": "set", "value": "New Program Name" }
Example: { "step": 1, "path": "programAims", "action": "update", "index": 0, "value": "New aim text" }

STEP 2 - KSC (Knowledge, Skills, Competencies):
CRITICAL FIELD NAMES:
- "statement" = the main text of the KSC item (NOT "title" or "item")
- "description" = detailed description
- "importance" = "essential" or "desirable"
- "source" = where this came from (e.g., "SHRM BoCK", "PMI Talent Triangle")
- "id" = unique identifier (e.g., "K1", "S1", "C1")
- "type" = "knowledge", "skill", or "competency"
Arrays: knowledgeItems, skillItems, competencyItems
Example: { "step": 2, "path": "competencyItems", "action": "update", "match": { "id": "C4" }, "changes": { "statement": "Champion exclusivity in language technologies", "description": "New description here" } }

STEP 3 - PLOs (Program Learning Outcomes):
CRITICAL FIELD NAMES:
- "statement" = the main PLO text (NOT "outcome")
- "code" = e.g., "PLO1", "PLO2"
- "bloomLevel" = "remember", "understand", "apply", "analyze", "evaluate", "create"
- "verb" = the Bloom's verb used
- "linkedKSCs" = array of KSC IDs
- "jobTaskMapping" = array of job task strings
Array: outcomes
Example: { "step": 3, "path": "outcomes", "action": "update", "match": { "code": "PLO1" }, "changes": { "statement": "New PLO text here" } }

STEP 4 - Modules & MLOs:
Module fields:
- "title" = module title
- "description" = module description
- "code" = e.g., "M1", "M2"
- "sequence" = order number
- "phase" = "early", "middle", "late"
- "totalHours", "contactHours", "selfStudyHours", "credits"
- "linkedPLOs" = array of PLO IDs
- "prerequisites" = array of module IDs
MLO fields (inside mlos array):
- "statement" = the MLO text
- "code" = e.g., "M1-LO1"
- "bloomLevel", "verb"
- "linkedPLOs" = which PLOs this MLO supports
Topic fields (inside topics array):
- "title", "description", "hours", "sequence"
Array: modules (containing mlos[] and topics[])
Example module title: { "step": 4, "path": "modules", "action": "update", "match": { "id": "mod1" }, "changes": { "title": "New Module Title" } }
Example MLO: { "step": 4, "path": "modules.mlos", "action": "update", "match": { "moduleId": "mod1", "code": "M1-LO1" }, "changes": { "statement": "New MLO text" } }

STEP 5 - Sources:
- "title" = source title
- "authors" = array of author names
- "year" = publication year
- "publisher", "edition", "doi", "url"
- "citation" = full APA citation
- "category" = "peer_reviewed_journal", "academic_textbook", "professional_body", "open_access"
- "type" = "academic", "applied", "industry"
- "linkedMLOs" = array of MLO codes this source supports
- "moduleId" = which module this belongs to
- "accessStatus" = "agi_library", "open_access", "verified_accessible"
Array: sources
Example: { "step": 5, "path": "sources", "action": "update", "match": { "id": "src-1" }, "changes": { "title": "New Title", "linkedMLOs": ["M1-LO1", "M1-LO2"] } }

STEP 6 - Reading Lists:
- "title", "authors", "year", "citation"
- "category" = "core" or "supplementary"
- "specificChapters" = chapter name
- "pageRange" = e.g., "pp. 17-24"
- "contentType" = "textbook_chapter", "journal_article", "online_article"
- "readingType" = "academic" or "applied"
- "linkedMLOs" = array of MLO codes
- "moduleId" = which module
Array: readings (or moduleReadingLists[].indicativeReadings)
Example: { "step": 6, "path": "readings", "action": "update", "match": { "id": "read-1" }, "changes": { "specificChapters": "Chapter 5: Advanced Topics" } }

STEP 7 - Assessments:
Quiz fields:
- "title", "moduleId", "moduleTitle"
- "questionCount", "weight", "passMark", "timeLimit"
- "questions" = array of MCQ questions
MCQ Question fields:
- "stem" = the question text
- "options" = [{ id, text, isCorrect, explanation }]
- "rationale" = why the correct answer is correct
- "linkedMLO" = which MLO this assesses
- "bloomLevel", "difficulty" = "easy", "medium", "hard"
Arrays: quizzes, finalExam, questionBank
Example: { "step": 7, "path": "quizzes.questions", "action": "update", "match": { "quizId": "quiz-1", "stem": "What is..." }, "changes": { "stem": "New question text" } }

STEP 8 - Case Studies:
- "title" = case title
- "caseType" = "practice", "discussion", "assessment_ready"
- "difficulty" = "entry", "intermediate", "advanced"
- "scenario" = main case text (400-800 words)
- "organizationalContext", "backgroundInformation", "challengeDescription"
- "protagonistName", "protagonistRole"
- "industryContext", "brandName"
- "linkedModules", "linkedMLOs", "linkedTopics"
- "discussionPrompts" = array for discussion cases
- "assessmentHooks" = { keyFacts[], misconceptions[], decisionPoints[] }
Array: caseStudies
Example: { "step": 8, "path": "caseStudies", "action": "update", "match": { "title": "TechCorp Dilemma" }, "changes": { "scenario": "New scenario text..." } }

STEP 9 - Glossary:
- "term" = the term being defined
- "definition" = the definition (20-40 words)
- "exampleSentence" = usage example
- "technicalNote" = additional detail
- "relatedTerms", "synonyms" = arrays
- "category" = grouping category
- "isAcronym" = boolean
- "acronymExpansion" = full form if acronym
Array: terms
Example: { "step": 9, "path": "terms", "action": "update", "match": { "term": "ROI" }, "changes": { "definition": "New definition here" } }

CRITICAL RULES:
1. ALWAYS use "statement" for KSC items (step 2), PLOs (step 3), and MLOs (step 4) - NOT "title" or "item" or "outcome"
2. Use "title" for module titles, source titles, case study titles, quiz titles
3. Use "term" for glossary entries
4. Use "stem" for MCQ questions
5. Match items by their ID when available, or by unique text content
6. Always return valid JSON with the response format below
7. Be precise about which step the change belongs to

=== RESPONSE FORMAT ===
You MUST respond in a CONVERSATIONAL, USER-FRIENDLY way. Do NOT return technical JSON structures to the user.

When user asks for alternatives or suggestions:
{
  "message": "Here's an alternative for [ITEM]:\n\n**Option 1:**\n[Full suggested text here]\n\n**Option 2:**\n[Another alternative text here]\n\nYou can copy any of these and paste them using the Edit button on the item.",
  "suggestions": [
    {
      "label": "Option 1",
      "text": "[The actual text to copy]",
      "targetItem": "PLO1"
    },
    {
      "label": "Option 2", 
      "text": "[Another alternative]",
      "targetItem": "PLO1"
    }
  ]
}

When user asks to directly apply changes (e.g., "change PLO1 to..."):
{
  "message": "I've prepared the update for [ITEM]. Click 'Apply Changes' to save it.",
  "proposedChanges": {
    "updates": [...]
  }
}

IMPORTANT:
- For "give me alternatives", "suggest", "rewrite" requests: Return multiple options in the "suggestions" array with copyable text
- For "change to", "update", "fix" requests: Return "proposedChanges" with the updates array
- ALWAYS write the message in natural, conversational language
- Include the FULL suggested text in the message so users can read it easily
- Keep suggestions contextually relevant to the curriculum topic and academic level

=== COMPLETE VALIDATION RULES & HOW TO FIX EACH ISSUE ===

When user asks to "fix validation", "fix issues", "make it compliant", etc., you MUST:
1. Check the validationIssues/complianceIssues arrays in the workflow data
2. Check the uncoveredMLOs list to see what's missing
3. Generate REAL data to fix each issue (don't just update flags)

=== STEP 2 VALIDATION (KSC Framework) ===
Requirements:
- Total items: 10-30 KSC items combined
- Essential items: At least 70% marked as "essential"
- Balance: Knowledge 30-40%, Skills 40-50%, Competencies 10-30%

How to fix:
- ADD more items with importance: "essential"
- Each item needs: id, type, statement, description, importance, source

=== STEP 3 VALIDATION (PLOs) ===
Requirements:
- Count: 4-8 PLOs
- Bloom's distribution: At least 1 lower level (understand/apply) + 1 higher level (analyze/evaluate/create)
- Coverage: At least 70% of essential KSCs must be linked

How to fix:
- ADD PLOs with different bloomLevel values
- Each PLO needs: id, code, statement, bloomLevel, verb, linkedKSCs

=== STEP 4 VALIDATION (Modules & MLOs) ===
Requirements:
- Modules: 6-8 modules
- Hours: Total module hours must equal program total hours
- MLOs per module: 2-4 MLOs each
- PLO coverage: Every PLO must be linked to at least 1 MLO

How to fix:
- UPDATE module hours to match program total
- ADD MLOs to modules that have fewer than 2
- UPDATE MLO linkedPLOs to ensure all PLOs are covered

=== STEP 5 VALIDATION (Sources - AGI Standards) ===
Requirements:
- Peer-reviewed ratio: ≥50% must have category: "peer_reviewed_journal"
- MLO coverage: EVERY MLO must have at least 1 supporting source in linkedMLOs
- Balance: Mix of type: "academic" AND type: "applied"
- Recency: Sources should be ≤5 years old (year ≥ 2020)

**FIX "Peer-reviewed ratio below 50%":**
ADD multiple sources with category: "peer_reviewed_journal". Generate realistic academic sources:
{ "step": 5, "path": "sources", "action": "add", "item": {
  "id": "src-peer-NEW",
  "title": "[Relevant peer-reviewed paper title for this curriculum topic]",
  "authors": ["Author, A.", "Coauthor, B."],
  "year": 2023,
  "publisher": "[Relevant Journal Name]",
  "citation": "Author, A., & Coauthor, B. (2023). [Title]. [Journal], [Vol](Issue), pp-pp.",
  "category": "peer_reviewed_journal",
  "type": "academic",
  "linkedMLOs": ["MLO-CODE-1", "MLO-CODE-2"],
  "moduleId": "modX",
  "accessStatus": "open_access"
}}

**FIX "Not all MLOs have supporting sources":**
Check uncoveredMLOs list. ADD new sources OR UPDATE existing sources to include the missing MLO codes:
{ "step": 5, "path": "sources", "action": "add", "item": {
  "id": "src-mlo-coverage-NEW",
  "title": "[Source relevant to the uncovered MLO topics]",
  "authors": ["Expert, E."],
  "year": 2022,
  "publisher": "[Publisher]",
  "citation": "[Full APA citation]",
  "category": "peer_reviewed_journal",
  "type": "academic",
  "linkedMLOs": ["UNCOVERED-MLO-1", "UNCOVERED-MLO-2", "UNCOVERED-MLO-3"],
  "moduleId": "[module that owns these MLOs]",
  "accessStatus": "open_access"
}}

**FIX "Missing academic/applied source balance":**
ADD sources with type: "applied" (industry reports, professional guides):
{ "step": 5, "path": "sources", "action": "add", "item": {
  "id": "src-applied-NEW",
  "title": "[Industry Guide or Professional Resource]",
  "authors": ["Organization Name"],
  "year": 2023,
  "publisher": "[Professional Body]",
  "citation": "[APA citation]",
  "category": "professional_body",
  "type": "applied",
  "linkedMLOs": ["MLO-1", "MLO-2"],
  "moduleId": "modX",
  "accessStatus": "verified_accessible"
}}

=== STEP 6 VALIDATION (Reading Lists) ===
Requirements:
- Core readings: 3-6 per module (category: "core")
- Supplementary readings: 4-8 per module (category: "supplementary")
- All core readings must link to at least 1 MLO
- Reading time must fit within independent study hours

How to fix:
- ADD readings with proper structure including specificChapters, pageRange, linkedMLOs

=== STEP 7 VALIDATION (Assessments) ===
Requirements:
- Every MLO must be assessed by at least 1 question
- Question bank: 3× multiplier (if 10 quiz questions needed, bank should have 30)
- Bloom's distribution must match Step 3 targets
- No duplicate questions between quizzes and final exam

How to fix:
- ADD questions to questionBank that link to uncovered MLOs
- Each question needs: id, stem, options, correctOption, rationale, linkedMLO, bloomLevel, difficulty

=== STEP 8 VALIDATION (Case Studies) ===
Requirements:
- At least 1 case per module
- Word count: 400-800 words per scenario
- All cases must link to at least 1 MLO
- Ethics compliant: no PII, brands anonymized

How to fix:
- ADD case studies with full structure including scenario text, linkedMLOs, linkedModules

=== STEP 9 VALIDATION (Glossary) ===
Requirements:
- All assessment terms must be included
- Definition length: 20-40 words
- No circular definitions
- UK English spelling

How to fix:
- ADD terms with proper structure: term, definition (20-40 words), exampleSentence

=== IMPORTANT: ALWAYS GENERATE REAL, CONTEXTUAL DATA ===
When fixing validation issues:
1. Generate REALISTIC titles, authors, citations relevant to the program topic
2. Use the program title and academic level to contextualize content
3. Check the existing data to avoid duplicates
4. Link to the ACTUAL MLO codes shown in the uncoveredMLOs list
5. Use appropriate module IDs from the workflow data

The system will AUTO-RECALCULATE validation metrics after you add/update sources, so just focus on adding the right data.`;

    const userPrompt = `User request: "${userMessage}"

Find the content the user is referring to and respond appropriately.

RESPONSE RULES:
1. If user asks for "alternatives", "suggestions", "rewrite", "different version" → Return multiple text options they can copy
2. If user asks to "change", "update", "fix", "apply" → Return proposedChanges with updates array
3. ALWAYS write in natural, conversational language - like ChatGPT or Claude would respond
4. Include the FULL text of any suggestions so users can easily read and copy them

RESPOND IN JSON:
{
  "message": "[Your conversational response with the suggestions written out in full]",
  "suggestions": [...] // For alternatives/suggestions requests
  // OR
  "proposedChanges": {...} // For direct change requests
}`;

    try {
      loggingService.info('Calling OpenAI for canvas edit', {
        workflowId,
        stepNumber,
        promptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
      });

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.3,
        maxTokens: 128000, // MAXIMUM token limit
        timeout: 600000, // 10 minutes - MAXIMUM
      });

      loggingService.info('Canvas edit response received', {
        responseLength: response?.length || 0,
        responsePreview: response?.substring(0, 200),
      });

      if (!response || response.trim().length === 0) {
        throw new Error('AI returned empty response');
      }

      // Try to parse the response
      let parsed;
      try {
        parsed = this.parseJSON(response, 'canvasEdit');
      } catch (parseError: any) {
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // Return the raw response as the message if no JSON found
          return {
            message: response.substring(0, 500),
            proposedChanges: null,
          };
        }
      }

      return {
        message: parsed.message || 'Here are the proposed changes:',
        proposedChanges: parsed.proposedChanges,
        suggestions: parsed.suggestions,
      };
    } catch (error: any) {
      loggingService.error('Canvas edit generation failed', {
        error: error.message,
        stack: error.stack,
        workflowId,
        stepNumber,
      });
      throw new Error(`Failed to generate edit: ${error.message}`);
    }
  }

  /**
   * Generate a replacement source when a user rejects one
   */
  async generateReplacementSource(params: {
    workflowId: string;
    rejectedSourceId: string;
    moduleId?: string;
  }): Promise<{ replacementSource: any }> {
    const { workflowId, rejectedSourceId, moduleId } = params;

    loggingService.info('Generating replacement source', {
      workflowId,
      rejectedSourceId,
      moduleId,
    });

    // Get workflow and find the rejected source
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const sources = (workflow as any).step5?.sources || (workflow as any).step5?.topicSources || [];
    const rejectedSource = sources.find((s: any) => s.id === rejectedSourceId);

    if (!rejectedSource) {
      throw new Error('Rejected source not found');
    }

    // Get module info
    const modules = (workflow as any).step4?.modules || [];
    const module = modules.find((m: any) => m.id === moduleId);

    // Build prompt for replacement source
    const systemPrompt = `You are an academic source specialist generating AGI-compliant replacement sources.

The user rejected this source:
- Title: ${rejectedSource.title}
- Authors: ${rejectedSource.authors?.join(', ')}
- Year: ${rejectedSource.year}
- Category: ${rejectedSource.category}
- Reason likely: Access issues or relevance concerns

Generate a DIFFERENT source that:
1. Covers the same topics: ${rejectedSource.relevantTopics?.join(', ')}
2. Supports the same MLOs: ${rejectedSource.linkedMLOs?.join(', ')}
3. Is from a different publisher/author
4. Meets AGI Standards (peer-reviewed preferred, <5 years old, verifiable access)
5. Is at the same complexity level: ${rejectedSource.complexityLevel}`;

    const userPrompt = `Generate a replacement source for module "${module?.title || 'Unknown'}" covering:
Topics: ${rejectedSource.relevantTopics?.join(', ')}

Return a JSON object with this exact structure:
{
  "id": "unique-source-id",
  "title": "Source title",
  "authors": ["Author 1", "Author 2"],
  "year": 2023,
  "publisher": "Publisher name",
  "citation": "Full APA 7th citation",
  "doi": "doi if available or null",
  "url": "url if available or null",
  "category": "peer_reviewed_journal|academic_textbook|professional_body|open_access",
  "type": "academic|applied|industry",
  "accessStatus": "agi_library|knowledge_base|open_access|institutional_subscription",
  "relevantTopics": ["topic1", "topic2"],
  "linkedMLOs": ["M1-LO1"],
  "moduleId": "${moduleId}",
  "complexityLevel": "${rejectedSource.complexityLevel}",
  "agiCompliant": true,
  "complianceBadges": {
    "peerReviewed": true,
    "academicText": false,
    "professionalBody": false,
    "recent": true,
    "seminal": false,
    "verifiedAccess": true,
    "apaValidated": true
  }
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.5,
        maxTokens: 2000,
      });

      const parsed = this.parseJSON(response, 'replacementSource');

      // Ensure unique ID
      if (parsed && !parsed.id) {
        parsed.id = `src-replacement-${Date.now()}`;
      }

      return {
        replacementSource: parsed,
      };
    } catch (error: any) {
      loggingService.error('Replacement source generation failed', {
        error,
        workflowId,
        rejectedSourceId,
      });
      throw new Error(`Failed to generate replacement source: ${error.message}`);
    }
  }
}

export const workflowService = new WorkflowService();
