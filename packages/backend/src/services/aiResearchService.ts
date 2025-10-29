/**
 * AI Research Service
 * Stage 2: Generates Preliminary Curriculum Package using OpenAI
 * Manages chat-based SME collaboration for real-time refinements
 */

import {
  PreliminaryCurriculumPackage,
  IPreliminaryCurriculumPackage,
} from '../models/PreliminaryCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { CoursePrompt } from '../models/CoursePrompt';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { websocketService } from './websocketService';

interface ComponentGenerationResult {
  content: any;
  sources?: string[];
  metadata?: any;
}

class AIResearchService {
  /**
   * Start AI research phase - generates preliminary curriculum package
   * This is Stage 2 of the workflow
   */
  async startResearch(projectId: string): Promise<string> {
    try {
      loggingService.info('🚀 Starting research for project', { projectId });

      const project = await CurriculumProject.findById(projectId).populate('promptId');

      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.promptId) {
        throw new Error('Project has no associated prompt');
      }

      const prompt = project.promptId as any;
      loggingService.info('📋 Prompt loaded', {
        promptId: prompt._id,
        promptTitle: prompt.promptTitle,
      });

      // Check if preliminary package already exists
      let prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId: project._id });

      if (prelimPackage) {
        loggingService.info('✅ Preliminary package already exists, returning existing', {
          projectId,
          packageId: prelimPackage._id,
        });
        return prelimPackage._id.toString();
      }

      loggingService.info('📦 Creating new preliminary package', { projectId });

      // Create preliminary package document
      prelimPackage = new PreliminaryCurriculumPackage({
        projectId: project._id,
        chatHistory: [
          {
            role: 'ai',
            content: `Starting AI research for ${prompt.promptTitle}. I will generate all 14 components of the AGI SME Submission. You can review and refine each section as we go.`,
            componentRef: 'initialization',
            timestamp: new Date(),
          },
        ],
      });

      await prelimPackage.save();
      loggingService.info('✅ Preliminary package saved', { packageId: prelimPackage._id });

      // Update project stage progress
      project.stageProgress = project.stageProgress || {};
      project.stageProgress.stage2_aiResearch = {
        status: 'in_progress',
        startedAt: new Date(),
        preliminaryPackageId: prelimPackage._id,
        chatMessageCount: 1,
        refinementCount: 0,
      };
      project.currentStage = 2;
      project.status = 'research';
      await project.save();

      // Emit WebSocket event (disabled for testing)
      // websocketService.emitToRoom(`project:${projectId}`, 'research_started', {
      //   packageId: prelimPackage._id.toString(),
      //   message: 'AI research phase initiated'
      // });

      // Generate components in background (async - don't await)
      loggingService.info('🤖 Starting background component generation', { projectId });
      this.generateAllComponents(project, prelimPackage, prompt).catch((err) => {
        loggingService.error('❌ Background generation failed', { error: err, projectId });
      });

      loggingService.info('✅ AI research started successfully', {
        projectId,
        packageId: prelimPackage._id,
      });

      return prelimPackage._id.toString();
    } catch (error: any) {
      loggingService.error('❌ Error starting AI research', {
        error: error.message || error,
        stack: error.stack,
        projectId,
      });
      throw error;
    }
  }

  /**
   * [TESTING MODE] Generate simplified test content
   * TODO: Expand to full 14 components after testing
   */
  private async generateAllComponents(
    project: any,
    prelimPackage: any,
    prompt: any
  ): Promise<void> {
    try {
      const projectId = project._id.toString();

      loggingService.info('🧪 TESTING MODE: Generating simplified content', { projectId });

      // Generate ONE simple test component using OpenAI
      const testContent = await this.generateTestContent(prompt);

      // Save test data to ALL components (matching the schema structure)
      prelimPackage.programOverview = {
        programTitle: prompt.promptTitle,
        aim: testContent,
      };
      prelimPackage.competencyFramework = {
        knowledgeDomains: [
          {
            domain: 'Test Domain',
            coreSkills: ['Skill 1'],
            workplaceApplications: [],
            sources: [],
          },
        ],
      };
      prelimPackage.learningOutcomes = [
        {
          outcomeNumber: 1,
          outcome: testContent,
        },
      ];
      prelimPackage.courseFramework = {
        modules: [{ moduleCode: 'TEST101', title: 'Test Module', hours: 20 }],
      };
      prelimPackage.topicSources = [
        {
          topic: 'Test Topic',
          sources: [],
        },
      ];
      prelimPackage.readingList = {
        indicative: [{ citation: 'Test Reading', type: 'book', synopsis: testContent }],
        additional: [{ citation: 'Additional Reading', type: 'guide', synopsis: testContent }],
      };
      prelimPackage.assessments = {
        mcqs: [
          {
            stem: 'Test Question',
            correctAnswer: 'A',
            options: { A: 'Test', B: 'Test', C: 'Test', D: 'Test' },
          },
        ],
        caseQuestions: [{ prompt: testContent, expectedResponse: 'Test response' }],
      };
      prelimPackage.glossary = [
        {
          term: 'Test Term',
          definition: testContent,
        },
      ];
      prelimPackage.caseStudies = [
        {
          caseNumber: 1,
          title: 'Test Case',
          description: testContent,
        },
      ];
      prelimPackage.deliveryTools = {
        deliveryMode: 'self-study',
        interactiveElements: [],
      };
      prelimPackage.references = [testContent]; // Array of strings
      prelimPackage.submissionMetadata = {
        authorName: '[To be filled]',
        submissionDate: new Date(),
      };
      prelimPackage.outcomeWritingGuide = {
        introduction: testContent,
        examples: [
          {
            verb: 'Apply',
            example: testContent,
          },
        ],
      };
      prelimPackage.comparativeBenchmarking = {
        certifications: [],
      };

      prelimPackage.chatHistory.push({
        role: 'ai',
        content: `✅ TEST MODE: Generated curriculum for ${prompt.promptTitle}`,
        componentRef: 'testing',
        timestamp: new Date(),
      });

      await prelimPackage.save();

      // Mark package as ready
      // websocketService.emitToRoom(`project:${projectId}`, 'research_complete', {
      //   packageId: prelimPackage._id.toString(),
      //   message: '✅ Test generation complete!'
      // });

      loggingService.info('✅ Test content generated', { projectId, packageId: prelimPackage._id });
    } catch (error) {
      loggingService.error('Error generating test content', { error, projectId: project._id });
      // websocketService.emitToRoom(`project:${project._id}`, 'research_error', {
      //   error: 'Failed to generate content',
      //   details: error instanceof Error ? error.message : 'Unknown error'
      // });
    }
  }

  /**
   * Generate test content using OpenAI (1-2 sentences for fast testing)
   */
  private async generateTestContent(prompt: any): Promise<string> {
    try {
      const response = await openaiService.generateContent({
        systemPrompt: 'You are a curriculum designer. Generate brief, professional content.',
        userPrompt: `Write 1-2 sentences describing a curriculum for: ${prompt.promptTitle} (${prompt.domain}, ${prompt.level} level, ${prompt.totalHours} hours).`,
        temperature: 0.7,
        maxTokens: 100,
      });

      return response.trim();
    } catch (error) {
      loggingService.error('OpenAI generation failed, using fallback', { error });
      return `This is a comprehensive ${prompt.totalHours}-hour ${prompt.level} curriculum for ${prompt.promptTitle} in ${prompt.domain}.`;
    }
  }

  /**
   * Generate single component and save to package
   */
  private async generateAndSave(
    projectId: string,
    prelimPackage: any,
    prompt: any,
    componentKey: string,
    componentName: string
  ): Promise<void> {
    try {
      // Emit progress (disabled for testing)
      // websocketService.emitToRoom(`project:${projectId}`, 'component_generation_started', {
      //   component: componentKey,
      //   name: componentName
      // });

      // Generate component content
      const result = await this.generateComponent(componentKey, prompt, prelimPackage);

      // Save to preliminary package
      (prelimPackage as any)[componentKey] = result.content;

      // Add to chat history
      prelimPackage.chatHistory.push({
        role: 'ai',
        content: `✅ ${componentName} generated successfully.`,
        componentRef: componentKey,
        timestamp: new Date(),
      });

      await prelimPackage.save();

      // Emit completion (disabled for testing)
      // websocketService.emitToRoom(`project:${projectId}`, 'component_generated', {
      //   component: componentKey,
      //   name: componentName,
      //   preview: this.getComponentPreview(result.content)
      // });

      loggingService.info('Component generated', { projectId, component: componentKey });
    } catch (error) {
      loggingService.error('Error generating component', {
        error,
        projectId,
        component: componentKey,
      });
      throw error;
    }
  }

  /**
   * Generate specific component using OpenAI
   */
  private async generateComponent(
    componentKey: string,
    prompt: any,
    prelimPackage: any
  ): Promise<ComponentGenerationResult> {
    const systemPrompt = `You are an expert curriculum designer creating AGI-compliant SME submissions. Generate content following AGI standards with proper APA 7 citations, UK English spelling, and verified sources (≤5 years old).`;

    let userPrompt = '';
    let responseFormat: 'json' | 'text' = 'json';

    switch (componentKey) {
      case 'programOverview':
        userPrompt = this.getPromptForProgramOverview(prompt);
        break;
      case 'competencyFramework':
        userPrompt = this.getPromptForCompetencyFramework(prompt);
        break;
      case 'learningOutcomes':
        userPrompt = this.getPromptForLearningOutcomes(prompt, prelimPackage);
        break;
      case 'courseFramework':
        userPrompt = this.getPromptForCourseFramework(prompt, prelimPackage);
        break;
      case 'topicSources':
        userPrompt = this.getPromptForTopicSources(prompt, prelimPackage);
        break;
      case 'readingList':
        userPrompt = this.getPromptForReadingList(prompt, prelimPackage);
        break;
      case 'assessments':
        userPrompt = this.getPromptForAssessments(prompt, prelimPackage);
        break;
      case 'glossary':
        userPrompt = this.getPromptForGlossary(prompt, prelimPackage);
        break;
      case 'caseStudies':
        userPrompt = this.getPromptForCaseStudies(prompt, prelimPackage);
        break;
      case 'deliveryTools':
        userPrompt = this.getPromptForDeliveryTools(prompt);
        break;
      case 'references':
        userPrompt = this.getPromptForReferences(prelimPackage);
        responseFormat = 'text';
        break;
      case 'submissionMetadata':
        userPrompt = this.getPromptForSubmissionMetadata(prompt);
        break;
      case 'outcomeWritingGuide':
        userPrompt = this.getPromptForOutcomeGuide(prompt);
        break;
      case 'comparativeBenchmarking':
        userPrompt = this.getPromptForBenchmarking(prompt);
        break;
      default:
        throw new Error(`Unknown component: ${componentKey}`);
    }

    // Generate using OpenAI
    const response = await openaiService.generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Parse response
    let content: any;
    if (responseFormat === 'json') {
      try {
        content = JSON.parse(response);
      } catch (e) {
        // If JSON parsing fails, try to extract JSON from markdown
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          content = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse JSON response');
        }
      }
    } else {
      content = response;
    }

    return { content };
  }

  /**
   * Prompt generators for each component
   */
  private getPromptForProgramOverview(prompt: any): string {
    return `Generate a Program Overview for ${prompt.promptTitle} - a ${prompt.totalHours}-hour ${prompt.level} course in ${prompt.domain}.

Include:
- Program title
- Aim (2-3 sentences)
- Qualification type: ${prompt.agiTemplate?.programOverview?.qualificationType || 'Certification Preparation'}
- Industry need (3-4 evidence-based bullet points with recent statistics/trends)
- Target audience: ${prompt.agiTemplate?.programOverview?.targetAudience || 'professionals seeking certification'}
- Entry requirements
- Duration: 120 hours self-study
- Career outcomes (3-6 specific job roles)
- Benchmarking vs 2-3 comparable certifications (table format)
- 15 ECTS justification

Return as JSON with fields: programTitle, aim, qualificationType, industryNeed (array), targetAudience, entryRequirements, duration, careerOutcomes (array), benchmarking (array of objects), ectsJustification.`;
  }

  private getPromptForCompetencyFramework(prompt: any): string {
    const domainCount = prompt.agiTemplate?.competencyFramework?.knowledgeDomains?.length || 6;
    return `Generate a Competency Framework for ${prompt.promptTitle} in ${prompt.domain}.

Identify ${domainCount} knowledge domains. For each domain include:
- Domain name
- 3-5 core skills
- 2-3 workplace applications
- 2-3 credible sources (≤5 years, indicate if academic or industry, with APA 7 citations)

Return as JSON: { knowledgeDomains: [{ domain, coreSkills[], workplaceApplications[], sources[{ citation, type, url, publicationDate }] }] }`;
  }

  private getPromptForLearningOutcomes(prompt: any, prelimPackage: any): string {
    const competencyDomains =
      prelimPackage.competencyFramework?.knowledgeDomains?.map((d: any) => d.domain).join(', ') ||
      'the defined domains';

    return `Generate 5-8 Learning Outcomes for ${prompt.promptTitle}.

Use structure: Verb + Object + Context
Approved verbs: apply, analyse, evaluate, design, recommend, construct, implement, justify

For each outcome:
- Outcome statement (measurable)
- 2-4 Assessment Criteria (observable, active verbs)
- Type: knowledge, skill, or competency
- Bloom's taxonomy level
- Map to competency domains: ${competencyDomains}
- Map to modules (will be defined in next step, use module codes like ${prompt.agiTemplate?.courseFramework?.moduleCodeFormat || 'MOD101, MOD102'}, etc.)

Return as JSON array: [{ outcomeNumber, outcome, assessmentCriteria[], type, bloomLevel, mappedDomains[], mappedModules[] }]`;
  }

  private getPromptForCourseFramework(prompt: any, prelimPackage: any): string {
    const outcomeCount = prelimPackage.learningOutcomes?.length || 6;
    const moduleCodeFormat = prompt.agiTemplate?.courseFramework?.moduleCodeFormat || 'MOD###';

    return `Generate a Course Framework for ${prompt.promptTitle} - 120 hours total, 6-8 modules.

For each module:
- Module code (format: ${moduleCodeFormat}, e.g., ${moduleCodeFormat.replace('###', '101')}, ${moduleCodeFormat.replace('###', '102')})
- Title
- Aim (1 sentence)
- Hours (distribute 120 hours across modules, mark as core or elective)
- Objectives (3-6, align to the ${outcomeCount} learning outcomes)
- Key topics (bulleted)
- Indicative content
- Assessment types
- Assessment policy (weightings, pass threshold, reassessment)
- Self-study guidance (reading, practice, assessment hours breakdown)

Also include mapping table showing which modules map to which learning outcomes and competency domains.

Return as JSON: { modules: [{moduleCode, title, aim, hours, classification, objectives[], keyTopics[], indicativeContent[], assessmentTypes[], assessmentPolicy{}, selfStudyGuidance{}}], mappingTable: [{moduleCode, learningOutcomes[], competencyDomains[]}] }`;
  }

  private getPromptForTopicSources(prompt: any, prelimPackage: any): string {
    const topics =
      prelimPackage.courseFramework?.modules?.flatMap((m: any) => m.keyTopics || []).slice(0, 10) ||
      [];

    return `Generate Topic-Level Sources for ${prompt.promptTitle}.

For each of these topics: ${topics.join(', ')}

Provide 2-3 verified sources (≥1 academic, ≥1 industry):
- Full APA 7 citation
- URL or DOI
- Mark link as accessible (assume true)
- Verification date (today)
- One-sentence explanation linking to topic and learning outcome

Return as JSON array: [{ topic, moduleCode, sources[{ citation, type, url, doi, linkAccessible, verificationDate, explanation, linkedOutcome }] }]`;
  }

  private getPromptForReadingList(prompt: any, prelimPackage: any): string {
    return `Generate Indicative & Additional Reading Lists for ${prompt.promptTitle}.

Indicative readings (required): 5-8 items
Additional readings (supplementary): 5-8 items

For each:
- Full APA 7 citation
- Type: book, guide, report, or website
- Synopsis (1-2 sentences)
- Estimated reading time
- URL if available

Return as JSON: { indicative: [{ citation, type, synopsis, estimatedReadingTime, url }], additional: [...] }`;
  }

  private getPromptForAssessments(prompt: any, prelimPackage: any): string {
    const modules = prelimPackage.courseFramework?.modules || [];
    const moduleCount = modules.length;

    return `Generate Assessments for ${prompt.promptTitle} - ${moduleCount} modules.

For each module generate:
1. 5-10 MCQs:
   - Stem (question)
   - 4 options (A, B, C, D)
   - Correct answer
   - Rationale (1-2 sentences with source)
   - Link to learning outcome number
   - Link to assessment criterion
   - Bloom's level (application, analysis, or evaluation)

2. 1-2 Case Questions:
   - Prompt (150-300 words, realistic scenario)
   - Expected response outline
   - Marking rubric (bands with marks and descriptors)
   - Linked outcomes and criteria

Return as JSON: { mcqs: [{moduleCode, questionNumber, stem, options{A,B,C,D}, correctAnswer, rationale, linkedOutcome, linkedCriterion, bloomLevel}], caseQuestions: [{moduleCode, caseNumber, prompt, expectedResponse, markingRubric[], linkedOutcomes[], linkedCriteria[]}] }`;
  }

  private getPromptForGlossary(prompt: any, prelimPackage: any): string {
    return `Generate a Glossary of 30-50 key terms for ${prompt.promptTitle}.

For each term:
- Term name
- Definition (≤30 words)
- APA 7 citation (credible source)

Return as JSON array: [{ term, definition, citation }]`;
  }

  private getPromptForCaseStudies(prompt: any, prelimPackage: any): string {
    return `Generate 2-3 Case Studies for ${prompt.promptTitle}.

For each case:
- Title
- Organisation (real or anonymised)
- Description (150-300 words)
- 2-3 learning takeaways
- APA 7 citation with URL
- Year (≤5 years old)
- Module code it relates to

Return as JSON array: [{ caseNumber, title, organisation, description, learningTakeaways[], citation, url, year, moduleCode }]`;
  }

  private getPromptForDeliveryTools(prompt: any): string {
    return `Generate Delivery & Digital Tools specification for ${prompt.promptTitle}.

Include:
- Delivery mode (self-study)
- Interactive elements (simulations, quizzes, peer review, etc.)
- Required LMS features (SCORM/xAPI, progress tracking, timed assessments, etc.)
- Recommended digital tools
- Minimum technical requirements

Return as JSON: { deliveryMode, interactiveElements[], lmsFeatures[], digitalTools[], technicalRequirements[] }`;
  }

  private getPromptForReferences(prelimPackage: any): string {
    return `Compile a complete References list in APA 7 format from all sources cited in the preliminary curriculum package.

Extract all citations from:
- Competency Framework sources
- Topic-Level Sources
- Reading Lists
- Assessments
- Glossary
- Case Studies

Return as a single string with each reference on a new line, alphabetically sorted.`;
  }

  private getPromptForSubmissionMetadata(prompt: any): string {
    return `Generate Submission Metadata for ${prompt.promptTitle}.

Include:
- Author name: "[SME Name to be filled]"
- Professional credentials: "[To be filled by SME]"
- Organisation: "[Optional]"
- Submission date: today's date
- Conflict of interest: "None declared"
- QA checklist (all items checked):
  * All topics have 2-3 sources with ≥1 academic and ≥1 industry
  * Total hours = 120 and modules = 6-8
  * Learning outcomes measurable (verb+object+context)
  * Assessments mapped to outcomes and criteria
  * Glossary entries 30-50 with citations
  * File naming convention followed
- QA verification summary
- AGI compliant: true

Return as JSON: { authorName, professionalCredentials, organisation, submissionDate, conflictOfInterest, qaChecklist{}, qaVerificationSummary, agiCompliant }`;
  }

  private getPromptForOutcomeGuide(prompt: any): string {
    return `Generate an Outcome Writing Guide for ${prompt.promptTitle}.

Include:
- Templates for writing learning outcomes
- 5 example outcomes following Verb + Object + Context
- List of approved Bloom's taxonomy verbs: apply, analyse, evaluate, design, recommend, construct, implement, justify

Return as JSON: { templates[], exampleOutcomes[], approvedVerbs[] }`;
  }

  private getPromptForBenchmarking(prompt: any): string {
    return `Generate Comparative Benchmarking for ${prompt.promptTitle} in ${prompt.domain}.

Compare with 2-3 competitor certifications:
- Certification name
- Issuing body
- Level
- Key comparison points (what makes our program different/better)

Return as JSON array: [{ competitorCert, issuer, level, comparisonNotes }]`;
  }

  /**
   * Get preview of component for UI display
   */
  private getComponentPreview(content: any): string {
    if (typeof content === 'string') {
      return content.substring(0, 200) + '...';
    }

    if (Array.isArray(content)) {
      return `Generated ${content.length} items`;
    }

    if (typeof content === 'object') {
      const keys = Object.keys(content);
      return `Generated with fields: ${keys.join(', ')}`;
    }

    return 'Content generated';
  }

  /**
   * Process SME feedback and refine component
   */
  async processSMEFeedback(
    packageId: string,
    componentRef: string,
    feedback: string,
    userId: string
  ): Promise<any> {
    try {
      const prelimPackage = await PreliminaryCurriculumPackage.findById(packageId);

      if (!prelimPackage) {
        throw new Error('Package not found');
      }

      // Add SME feedback to chat
      prelimPackage.chatHistory.push({
        role: 'sme',
        content: feedback,
        componentRef,
        timestamp: new Date(),
      });

      // Get current component content
      const currentContent = (prelimPackage as any)[componentRef];

      // Generate refined content
      const systemPrompt = `You are refining curriculum content based on SME feedback. Maintain AGI standards and APA 7 citations.`;
      const userPrompt = `Original content: ${JSON.stringify(currentContent, null, 2)}

SME Feedback: ${feedback}

Generate the revised content incorporating the feedback. Return in the same JSON structure as the original.`;

      const refinedContent = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Parse and update
      let parsedContent;
      try {
        parsedContent = JSON.parse(refinedContent);
      } catch (e) {
        const jsonMatch = refinedContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse refined content');
        }
      }

      (prelimPackage as any)[componentRef] = parsedContent;

      // Add AI response to chat
      prelimPackage.chatHistory.push({
        role: 'ai',
        content: `✅ ${componentRef} updated based on your feedback.`,
        componentRef,
        timestamp: new Date(),
      });

      // Update project refinement count
      const project = await CurriculumProject.findById(prelimPackage.projectId);
      if (project && project.stageProgress.stage2) {
        project.stageProgress.stage2.refinementCount =
          (project.stageProgress.stage2.refinementCount || 0) + 1;
        await project.save();
      }

      await prelimPackage.save();

      // Emit WebSocket update (disabled for testing)
      // websocketService.emitToRoom(`project:${prelimPackage.projectId}`, 'component_refined', {
      //   component: componentRef,
      //   preview: this.getComponentPreview(parsedContent)
      // });

      loggingService.info('Component refined', { packageId, componentRef, userId });

      return {
        updatedComponent: parsedContent,
        chatHistory: prelimPackage.chatHistory.slice(-5),
      };
    } catch (error) {
      loggingService.error('Error processing SME feedback', { error, packageId, componentRef });
      throw error;
    }
  }

  /**
   * Submit preliminary package for approval (move to Stage 3)
   */
  async submitForApproval(packageId: string, userId: string): Promise<void> {
    try {
      const prelimPackage = await PreliminaryCurriculumPackage.findById(packageId);

      if (!prelimPackage) {
        throw new Error('Package not found');
      }

      // Mark as approved
      prelimPackage.approvedAt = new Date();
      prelimPackage.approvedBy = userId as any;

      if (!prelimPackage.submissionMetadata) {
        prelimPackage.submissionMetadata = {} as any;
      }
      prelimPackage.submissionMetadata.submittedBy = userId as any;
      prelimPackage.submissionMetadata.submissionDate = new Date();
      prelimPackage.submissionMetadata.agiCompliant = true;

      await prelimPackage.save();

      // Update project to Stage 3
      const project = await CurriculumProject.findById(prelimPackage.projectId);
      if (project) {
        await project.advanceStage();
      }

      // Emit WebSocket event (disabled for testing)
      // websocketService.emitToRoom(`project:${prelimPackage.projectId}`, 'package_submitted', {
      //   packageId: prelimPackage._id.toString(),
      //   nextStage: 'Resource Cost Evaluation'
      // });

      loggingService.info('Preliminary package submitted', { packageId, userId });
    } catch (error) {
      loggingService.error('Error submitting package', { error, packageId });
      throw error;
    }
  }

  /**
   * Get chat history for a package
   */
  async getChatHistory(packageId: string): Promise<any[]> {
    try {
      const prelimPackage =
        await PreliminaryCurriculumPackage.findById(packageId).select('chatHistory');

      if (!prelimPackage) {
        throw new Error('Package not found');
      }

      return prelimPackage.chatHistory || [];
    } catch (error) {
      loggingService.error('Error getting chat history', { error, packageId });
      throw error;
    }
  }
}

export const aiResearchService = new AIResearchService();

/*
 * ==================================================================================
 * 🔧 FULL COMPONENT GENERATION - CURRENTLY DISABLED FOR TESTING
 * ==================================================================================
 *
 * To re-enable full 14-component generation:
 * 1. Replace the generateAllComponents() method above with this code:
 *
 * private async generateAllComponents(project: any, prelimPackage: any, prompt: any): Promise<void> {
 *   try {
 *     const projectId = project._id.toString();
 *
 *     // Component 1: Program Overview
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'programOverview',
 *       'Tab 1: Program Overview');
 *
 *     // Component 2: Competency Framework
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'competencyFramework',
 *       'Tab 2: Competency & Knowledge Framework');
 *
 *     // Component 3: Learning Outcomes
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'learningOutcomes',
 *       'Tab 3: Learning Outcomes & Assessment Criteria');
 *
 *     // Component 4: Course Framework
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'courseFramework',
 *       'Tab 4: Course Framework');
 *
 *     // Component 5: Topic Sources
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'topicSources',
 *       'Tab 5: Topic-Level Sources');
 *
 *     // Component 6: Reading List
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'readingList',
 *       'Tab 6: Reading List');
 *
 *     // Component 7: Assessments
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'assessments',
 *       'Tab 7: Assessments & Mapping');
 *
 *     // Component 8: Glossary
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'glossary',
 *       'Tab 8: Glossary');
 *
 *     // Component 9: Case Studies
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'caseStudies',
 *       'Tab 9: Case Studies');
 *
 *     // Component 10: Delivery Tools
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'deliveryTools',
 *       'Tab 10: Delivery & Digital Tools');
 *
 *     // Component 11: References
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'references',
 *       'Tab 11: References');
 *
 *     // Component 12: Submission Metadata
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'submissionMetadata',
 *       'Tab 12: Submission Metadata');
 *
 *     // Component 13: Outcome Writing Guide (optional)
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'outcomeWritingGuide',
 *       'Tab 13: Outcome Writing Guide');
 *
 *     // Component 14: Comparative Benchmarking (optional)
 *     await this.generateAndSave(projectId, prelimPackage, prompt, 'comparativeBenchmarking',
 *       'Tab 14: Comparative Benchmarking');
 *
 *     // Mark package as ready for submission
 *     websocketService.emitToRoom(`project:${projectId}`, 'research_complete', {
 *       packageId: prelimPackage._id.toString(),
 *       message: 'All components generated. Ready for SME review and submission.'
 *     });
 *
 *     loggingService.info('All components generated', { projectId, packageId: prelimPackage._id });
 *
 *   } catch (error) {
 *     loggingService.error('Error generating components', { error, projectId: project._id });
 *     websocketService.emitToRoom(`project:${project._id}`, 'research_error', {
 *       error: 'Failed to generate components',
 *       details: error instanceof Error ? error.message : 'Unknown error'
 *     });
 *   }
 * }
 *
 * 2. Remove or comment out the generateTestContent() method
 * 3. All the helper methods (generateAndSave, generateComponent, getPromptFor*) are still active
 *
 * ==================================================================================
 */
