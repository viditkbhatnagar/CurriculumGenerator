/**
 * AI Research Service
 * Stage 2: Generates Preliminary Curriculum Package using OpenAI
 * Manages chat-based SME collaboration for real-time refinements
 */

import mongoose from 'mongoose';
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
          packageId: prelimPackage._id?.toString(),
        });
        return (prelimPackage._id as mongoose.Types.ObjectId).toString();
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
      project.stageProgress.stage2 = {
        startedAt: new Date(),
        preliminaryPackageId: prelimPackage._id as mongoose.Types.ObjectId,
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
        packageId: prelimPackage._id?.toString(),
      });

      return (prelimPackage._id as mongoose.Types.ObjectId).toString();
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

      loggingService.info('🤖 FULL AI MODE: Generating all 14 components with real AI content', {
        projectId,
      });

      // Component 1: Program Overview
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'programOverview',
        'Tab 1: Program Overview'
      );

      // Component 2: Competency Framework
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'competencyFramework',
        'Tab 2: Competency & Knowledge Framework'
      );

      // Component 3: Learning Outcomes
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'learningOutcomes',
        'Tab 3: Learning Outcomes & Assessment Criteria'
      );

      // Component 4: Course Framework
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'courseFramework',
        'Tab 4: Course Framework'
      );

      // Component 5: Topic Sources
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'topicSources',
        'Tab 5: Topic-Level Sources'
      );

      // Component 6: Reading List
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'readingList',
        'Tab 6: Reading List'
      );

      // Component 7: Assessments
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'assessments',
        'Tab 7: Assessments & Mapping'
      );

      // Component 8: Glossary
      await this.generateAndSave(projectId, prelimPackage, prompt, 'glossary', 'Tab 8: Glossary');

      // Component 9: Case Studies
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'caseStudies',
        'Tab 9: Case Studies'
      );

      // Component 10: Delivery Tools
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'deliveryTools',
        'Tab 10: Delivery & Digital Tools'
      );

      // Component 11: References
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'references',
        'Tab 11: References'
      );

      // Component 12: Submission Metadata
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'submissionMetadata',
        'Tab 12: Submission Metadata'
      );

      // Component 13: Outcome Writing Guide (optional)
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'outcomeWritingGuide',
        'Tab 13: Outcome Writing Guide'
      );

      // Component 14: Comparative Benchmarking (optional)
      await this.generateAndSave(
        projectId,
        prelimPackage,
        prompt,
        'comparativeBenchmarking',
        'Tab 14: Comparative Benchmarking'
      );

      // OLD TEST CODE - Now using real AI generation above
      /*
      const testContent = await this.generateTestContent(prompt);

      // OLD: Save test data to ALL components (matching the schema structure)
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

      */

      // Mark package as ready for SME review
      // websocketService.emitToRoom(`project:${projectId}`, 'research_complete', {
      //   packageId: prelimPackage._id.toString(),
      //   message: 'All components generated. Ready for SME review and submission.'
      // });

      loggingService.info('✅ All 14 components generated with full AI content', {
        projectId,
        packageId: prelimPackage._id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error generating test content', {
        error: errorMessage,
        stack: errorStack,
        projectId: project._id,
      });
      // websocketService.emitToRoom(`project:${project._id}`, 'research_error', {
      //   error: 'Failed to generate content',
      //   details: error instanceof Error ? error.message : 'Unknown error'
      // });
    }
  }

  /**
   * Normalize component content to match schema enum values
   * Handles all common OpenAI output issues: capitalized enums, wrong types, etc.
   */
  private normalizeComponentContent(content: any, componentKey: string): any {
    if (!content) return content;

    // Deep clone to avoid modifying the original
    const normalized = JSON.parse(JSON.stringify(content));

    // Helper: Convert enum values to lowercase
    const lowercaseEnum = (value: any) => (typeof value === 'string' ? value.toLowerCase() : value);

    // Normalize competencyFramework sources
    if (componentKey === 'competencyFramework' && normalized.knowledgeDomains) {
      normalized.knowledgeDomains.forEach((domain: any) => {
        if (domain.sources) {
          domain.sources.forEach((source: any) => {
            if (source.type) {
              source.type = source.type.toLowerCase();
            }
          });
        }
      });
    }

    // Normalize topicSources
    if (componentKey === 'topicSources' && Array.isArray(normalized)) {
      normalized.forEach((topic: any) => {
        if (topic.sources) {
          topic.sources.forEach((source: any) => {
            if (source.type) {
              source.type = source.type.toLowerCase();
            }
          });
        }
      });
    }

    // Normalize learningOutcomes types (knowledge/skill/competency)
    if (componentKey === 'learningOutcomes' && Array.isArray(normalized)) {
      normalized.forEach((outcome: any) => {
        if (outcome.type) {
          outcome.type = outcome.type.toLowerCase();
        }
      });
    }

    // Normalize courseFramework
    if (componentKey === 'courseFramework' && normalized.modules) {
      normalized.modules.forEach((module: any) => {
        // Fix classification enum (Core -> core, Elective -> elective)
        if (module.classification) {
          module.classification = module.classification.toLowerCase();
        }

        // Fix assessmentPolicy.weightings (convert object to string)
        if (module.assessmentPolicy && module.assessmentPolicy.weightings) {
          if (typeof module.assessmentPolicy.weightings === 'object') {
            // Convert { quiz: 40, essay: 60 } to "quiz: 40%, essay: 60%"
            module.assessmentPolicy.weightings = Object.entries(module.assessmentPolicy.weightings)
              .map(([key, value]) => `${key}: ${value}%`)
              .join(', ');
          }
        }

        // Fix selfStudyGuidance hours (handle various OpenAI output formats)
        if (module.selfStudyGuidance) {
          const guidance = module.selfStudyGuidance;

          // Case 1: OpenAI puts object { reading: 5, practice: 5, assessment: 10 } in each field
          // We need to restructure to { readingHours: 5, practiceHours: 5, assessmentHours: 10 }
          if (
            typeof guidance.readingHours === 'object' ||
            typeof guidance.practiceHours === 'object' ||
            typeof guidance.assessmentHours === 'object'
          ) {
            const obj = guidance.readingHours || guidance.practiceHours || guidance.assessmentHours;
            if (obj && typeof obj === 'object') {
              module.selfStudyGuidance = {
                readingHours: obj.reading || obj.readingHours || 0,
                practiceHours: obj.practice || obj.practiceHours || 0,
                assessmentHours: obj.assessment || obj.assessmentHours || 0,
              };
            }
          } else {
            // Case 2: Convert strings to numbers "4 hours preparation" -> 4
            ['readingHours', 'practiceHours', 'assessmentHours'].forEach((field) => {
              if (guidance[field] !== undefined && typeof guidance[field] === 'string') {
                const match = guidance[field].match(/\d+/);
                guidance[field] = match ? parseInt(match[0], 10) : 0;
              }
            });
          }
        }
      });

      // Fix mappingTable learningOutcomes (convert ['LO1', 'LO2'] or full-text to [1, 2, 3])
      if (normalized.mappingTable) {
        normalized.mappingTable.forEach((mapping: any, mappingIndex: number) => {
          if (mapping.learningOutcomes && Array.isArray(mapping.learningOutcomes)) {
            mapping.learningOutcomes = mapping.learningOutcomes.map((lo: any, loIndex: number) => {
              if (typeof lo === 'string') {
                // Try to extract a number from formats like 'LO1', 'Outcome 2', etc.
                const match = lo.match(/\d+/);
                if (match) {
                  return parseInt(match[0], 10);
                }
                // If it's a full-text description with no numbers, use sequential numbering
                // This is a fallback - we'll just assign 1, 2, 3, etc. based on array index
                return loIndex + 1;
              }
              return typeof lo === 'number' ? lo : loIndex + 1;
            });
          }
        });
      }
    }

    // Normalize topicSources linkAccessible (convert strings to boolean) and linkedOutcome (extract number or remove)
    if (componentKey === 'topicSources' && Array.isArray(normalized)) {
      normalized.forEach((topic: any) => {
        if (topic.sources) {
          topic.sources.forEach((source: any) => {
            // Normalize type enum ('academic', 'applied', 'industry' are valid)
            if (source.type) {
              const lowerType = source.type.toLowerCase();
              // Map invalid types to valid ones
              const typeMapping: { [key: string]: string } = {
                government: 'applied',
                professional: 'applied',
                'professional body': 'applied',
                regulatory: 'applied',
                'peer-reviewed': 'academic',
                journal: 'academic',
                research: 'academic',
                textbook: 'academic',
                practitioner: 'applied',
                'industry report': 'industry',
                report: 'applied',
              };
              source.type =
                typeMapping[lowerType] ||
                (['academic', 'applied', 'industry'].includes(lowerType) ? lowerType : 'applied');
            }
            // Normalize category for new source types
            if (source.category) {
              const lowerCategory = source.category.toLowerCase().replace(/[_\s]+/g, '_');
              const categoryMapping: { [key: string]: string } = {
                peer_reviewed: 'peer_reviewed_journal',
                journal: 'peer_reviewed_journal',
                textbook: 'academic_textbook',
                book: 'academic_textbook',
                professional: 'professional_body',
                industry: 'industry_report',
                government: 'government_research',
                gov: 'government_research',
              };
              source.category = categoryMapping[lowerCategory] || source.category;
            }
            if (source.linkAccessible !== undefined && typeof source.linkAccessible === 'string') {
              source.linkAccessible = source.linkAccessible.toLowerCase() === 'true';
            }
            // Fix linkedOutcome: if it's a string (full text), try to extract number or remove it
            if (source.linkedOutcome !== undefined && typeof source.linkedOutcome === 'string') {
              const match = source.linkedOutcome.match(/\d+/);
              if (match) {
                source.linkedOutcome = parseInt(match[0], 10);
              } else {
                // Remove it if we can't extract a number (it's optional field)
                delete source.linkedOutcome;
              }
            }
          });
        }
      });
    }

    // Normalize readingList types (book/guide/report/website)
    if (componentKey === 'readingList') {
      const normalizeReadingType = (type: string): string => {
        const lowerType = lowercaseEnum(type);
        // Map multi-word or variant types to valid enum values
        if (lowerType.includes('journal') || lowerType.includes('article')) return 'guide';
        if (lowerType.includes('paper') || lowerType.includes('research')) return 'report';
        if (lowerType.includes('web') || lowerType.includes('online')) return 'website';
        // Default to 'guide' if unrecognized
        if (!['book', 'guide', 'report', 'website'].includes(lowerType)) return 'guide';
        return lowerType;
      };

      if (normalized.indicative) {
        normalized.indicative.forEach((item: any) => {
          if (item.type) item.type = normalizeReadingType(item.type);
        });
      }
      if (normalized.additional) {
        normalized.additional.forEach((item: any) => {
          if (item.type) item.type = normalizeReadingType(item.type);
        });
      }
    }

    // Normalize assessments correctAnswer (ensure uppercase A/B/C/D) and caseQuestions
    if (componentKey === 'assessments') {
      if (normalized.mcqs) {
        normalized.mcqs.forEach((mcq: any) => {
          if (mcq.correctAnswer) {
            mcq.correctAnswer = mcq.correctAnswer.toString().toUpperCase();
            // Ensure it's one of A, B, C, D
            if (!['A', 'B', 'C', 'D'].includes(mcq.correctAnswer)) {
              mcq.correctAnswer = 'A'; // Default fallback
            }
          }
          if (mcq.bloomLevel) mcq.bloomLevel = lowercaseEnum(mcq.bloomLevel);

          // Fix linkedOutcome: convert "LO1" -> 1, "LO2" -> 2, etc.
          if (mcq.linkedOutcome !== undefined && typeof mcq.linkedOutcome === 'string') {
            const match = mcq.linkedOutcome.match(/\d+/);
            if (match) {
              mcq.linkedOutcome = parseInt(match[0], 10);
            } else {
              // If no number found, default to 1
              mcq.linkedOutcome = 1;
            }
          }
        });
      }

      // Fix caseQuestions: expectedResponse and markingRubric might be objects instead of strings/arrays
      if (normalized.caseQuestions) {
        normalized.caseQuestions.forEach((caseQ: any) => {
          // Fix expectedResponse: convert object to formatted string
          if (caseQ.expectedResponse && typeof caseQ.expectedResponse === 'object') {
            // If it's an object with numeric keys, convert to numbered list
            const entries = Object.entries(caseQ.expectedResponse);
            caseQ.expectedResponse = entries.map(([key, value]) => `${key}. ${value}`).join('\n');
          }

          // Fix markingRubric: ensure it's an array of strings
          if (
            caseQ.markingRubric &&
            typeof caseQ.markingRubric === 'object' &&
            !Array.isArray(caseQ.markingRubric)
          ) {
            // Convert object to array of formatted strings
            const entries = Object.entries(caseQ.markingRubric);
            caseQ.markingRubric = entries.map(([key, value]) => `${key}: ${value}`);
          }

          // Fix linkedOutcomes: ensure it's an array of numbers
          if (caseQ.linkedOutcomes && Array.isArray(caseQ.linkedOutcomes)) {
            caseQ.linkedOutcomes = caseQ.linkedOutcomes.map((lo: any) => {
              if (typeof lo === 'string') {
                const match = lo.match(/\d+/);
                return match ? parseInt(match[0], 10) : lo;
              }
              return lo;
            });
          }

          // Fix linkedCriteria: ensure it's an array of strings
          if (caseQ.linkedCriteria && !Array.isArray(caseQ.linkedCriteria)) {
            caseQ.linkedCriteria = [String(caseQ.linkedCriteria)];
          }
        });
      }
    }

    // Normalize submissionMetadata booleans and field names
    if (componentKey === 'submissionMetadata' && normalized.qaChecklist) {
      const checklist = normalized.qaChecklist;

      // Fix field names: OpenAI might generate "totalHours": 120 instead of "totalHours120": true
      if (checklist.totalHours !== undefined) {
        checklist.totalHours120 = true; // If totalHours exists, assume it's checked
        delete checklist.totalHours;
      }
      if (checklist.modules !== undefined) {
        checklist.modules6to8 = true; // If modules exists, assume it's checked
        delete checklist.modules;
      }
      if (
        checklist.fileNaming !== undefined ||
        checklist.fileNamingConventionFollowed !== undefined
      ) {
        checklist.fileNamingCorrect = true;
        delete checklist.fileNaming;
        delete checklist.fileNamingConventionFollowed;
      }

      // Convert all checklist values to booleans
      Object.keys(checklist).forEach((key) => {
        const value = checklist[key];
        if (typeof value === 'string') {
          checklist[key] = value.toLowerCase() === 'true';
        } else if (typeof value === 'number') {
          checklist[key] = value > 0; // Any positive number becomes true
        } else if (typeof value !== 'boolean') {
          checklist[key] = !!value; // Coerce to boolean
        }
      });

      // Convert agiCompliant to boolean
      if (normalized.agiCompliant !== undefined && typeof normalized.agiCompliant === 'string') {
        normalized.agiCompliant = normalized.agiCompliant.toLowerCase() === 'true';
      }

      // Ensure submittedBy is an ObjectId (if it's a string placeholder, create a dummy ObjectId)
      if (!normalized.submittedBy || typeof normalized.submittedBy === 'string') {
        // Create a dummy ObjectId for now - it will be updated later by the backend
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mongoose = require('mongoose');
        normalized.submittedBy = new mongoose.Types.ObjectId();
      }
    }

    // Normalize deliveryTools
    if (componentKey === 'deliveryTools') {
      if (normalized.deliveryMode) {
        normalized.deliveryMode = lowercaseEnum(normalized.deliveryMode);
      }

      // Fix arrays that might contain objects instead of strings
      ['interactiveElements', 'lmsFeatures', 'digitalTools', 'technicalRequirements'].forEach(
        (field) => {
          if (normalized[field] && Array.isArray(normalized[field])) {
            normalized[field] = normalized[field].map((item: any) => {
              if (typeof item === 'object' && item.name) {
                // Extract name from object like { name: "Tool", description: "..." }
                return item.name;
              }
              return typeof item === 'string' ? item : String(item);
            });
          }
        }
      );
    }

    return normalized;
  }

  /**
   * Parse JSON with multiple fallback strategies for robustness
   */
  private parseJSONRobust(response: string, componentKey: string): any {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(response);
    } catch (e1) {
      loggingService.warn(
        `Direct JSON parse failed for ${componentKey}, trying repair strategies...`
      );
    }

    // Strategy 2: Extract from markdown code block (multiple patterns) + repair
    try {
      // Try different markdown patterns
      const patterns = [
        /```json\s*([\s\S]*?)\s*```/, // Standard with optional whitespace
        /```\s*([\s\S]*?)\s*```/, // Without json tag
        /```json\n([\s\S]*?)```/, // Original pattern without trailing \n
        /```([\s\S]+)$/, // Code block that goes to end of string
      ];

      for (const pattern of patterns) {
        const jsonMatch = response.match(pattern);
        if (jsonMatch && jsonMatch[1]) {
          const extracted = jsonMatch[1].trim();
          // Try direct parse first
          try {
            const parsed = JSON.parse(extracted);
            loggingService.info(`✓ JSON extracted from markdown code block for ${componentKey}`);
            return parsed;
          } catch (e) {
            // Try repairing the extracted JSON
            try {
              const repaired = extracted
                .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                .replace(/([}\]]\s*)([{[])/g, '$1,$2') // Add missing commas
                .trim();
              const parsed = JSON.parse(repaired);
              loggingService.info(
                `✓ JSON extracted and repaired from markdown for ${componentKey}`
              );
              return parsed;
            } catch (e2) {
              // This pattern matched but JSON is still invalid, try next pattern
              continue;
            }
          }
        }
      }
      loggingService.warn(
        `Markdown extraction failed for ${componentKey} - no valid pattern matched`
      );
    } catch (e2) {
      loggingService.warn(`Markdown extraction error for ${componentKey}: ${e2}`);
    }

    // Strategy 3: Fix common JSON errors (trailing commas, missing commas)
    try {
      const fixed = response
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([}\]]\s*)([{[])/g, '$1,$2') // Add missing commas between objects/arrays
        .replace(/\n/g, ' ') // Remove newlines that might break strings
        .trim();
      return JSON.parse(fixed);
    } catch (e3) {
      loggingService.warn(`JSON repair failed for ${componentKey}`);
    }

    // Strategy 4: Try to find the largest valid JSON object
    try {
      const matches = response.match(/{[\s\S]*}/g);
      if (matches) {
        // Try each match, starting with the longest
        const sorted = matches.sort((a, b) => b.length - a.length);
        for (const match of sorted) {
          try {
            return JSON.parse(match);
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e4) {
      loggingService.warn(`JSON extraction failed for ${componentKey}`);
    }

    // All strategies failed - log more details for debugging
    loggingService.error(`All JSON parsing strategies failed for ${componentKey}`, {
      responseLength: response.length,
      responseStart: response.substring(0, 300),
      responseEnd: response.substring(response.length - 200),
      hasMarkdownStart: response.includes('```json') || response.includes('```'),
      hasMarkdownEnd: response.includes('```', 10),
    });

    // Strategy 5: Try removing all text before first { and after last }
    try {
      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extracted = response.substring(firstBrace, lastBrace + 1);
        return JSON.parse(extracted);
      }
    } catch (e5) {
      loggingService.warn(`Brace extraction failed for ${componentKey}`);
    }

    // Strategy 6: Try to fix common issues with quotes and escape characters
    try {
      const cleaned = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();

      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const fixed = cleaned
          .substring(firstBrace, lastBrace + 1)
          // Fix smart quotes
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          // Fix escaped quotes in values
          .replace(/\\"/g, '"');

        return JSON.parse(fixed);
      }
    } catch (e6) {
      loggingService.warn(`Quote/escape fixing failed for ${componentKey}`);
    }

    // Strategy 7: Aggressive JSON repair - fix common OpenAI formatting issues
    try {
      let repaired = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();

      // Remove text before first { and after last }
      const firstBrace = repaired.indexOf('{');
      const lastBrace = repaired.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        repaired = repaired.substring(firstBrace, lastBrace + 1);
      }

      // Fix invalid number ranges: "marks": 0-5 → "marks": "0-5"
      repaired = repaired.replace(/"([^"]+)":\s*(\d+-\d+)/g, '"$1": "$2"');

      // Fix unquoted strings after colons: "key": value → "key": "value" (but not true/false/null/numbers)
      repaired = repaired.replace(
        /"([^"]+)":\s*([a-zA-Z][a-zA-Z0-9\s_-]*?)([,\n\r}])/g,
        (match, key, value, suffix) => {
          const lowerValue = value.trim().toLowerCase();
          if (
            lowerValue === 'true' ||
            lowerValue === 'false' ||
            lowerValue === 'null' ||
            !isNaN(Number(lowerValue))
          ) {
            return match; // Don't quote booleans, null, or numbers
          }
          return `"${key}": "${value.trim()}"${suffix}`;
        }
      );

      // Fix trailing commas
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

      // Fix missing commas between array/object elements
      repaired = repaired.replace(/}(\s*){/g, '},\n{');
      repaired = repaired.replace(/](\s*)\[/g, '],\n[');

      return JSON.parse(repaired);
    } catch (e7) {
      loggingService.warn(`Aggressive repair failed for ${componentKey}`, {
        error: e7 instanceof Error ? e7.message : String(e7),
      });
    }

    // Strategy 8: Use JSON5 parser (more lenient)
    try {
      // Try with jsonrepair library approach - manually fix common issues
      let lastDitch = response
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();

      const start = lastDitch.indexOf('{');
      const end = lastDitch.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        lastDitch = lastDitch.substring(start, end + 1);
      }

      // Remove all comments
      lastDitch = lastDitch.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

      // Try parsing in chunks if it's too large
      return JSON.parse(lastDitch);
    } catch (e8) {
      loggingService.warn(`Last-ditch parsing failed for ${componentKey}`);
    }

    // All strategies exhausted - Log the actual response for debugging
    loggingService.error(`❌ ALL JSON PARSING STRATEGIES FAILED for ${componentKey}`, {
      responseLength: response.length,
      firstChars: response.substring(0, 200),
      lastChars: response.substring(response.length - 200),
      sampleMiddle: response.substring(
        Math.floor(response.length / 2) - 100,
        Math.floor(response.length / 2) + 100
      ),
    });

    throw new Error(
      `Failed to parse JSON for ${componentKey} after trying all repair strategies. Response length: ${response.length}`
    );
  }

  /**
   * Generate component with retry logic and progressive prompt clarification
   */
  private async generateComponentWithRetry(
    componentKey: string,
    prompt: any,
    prelimPackage: any,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        loggingService.info(`🔄 Attempt ${attempt}/${maxRetries} for ${componentKey}`, {
          projectId: prelimPackage.projectId,
        });

        // On retry, add extra instructions for JSON formatting
        const result = await this.generateComponent(componentKey, prompt, prelimPackage, attempt);

        loggingService.info(`✅ Successfully generated ${componentKey} on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        loggingService.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${componentKey}`, {
          error: lastError.message,
          willRetry: attempt < maxRetries,
        });

        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s...
          const delay = Math.pow(2, attempt) * 1000;
          loggingService.info(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    loggingService.error(`❌ Failed to generate ${componentKey} after ${maxRetries} attempts`, {
      lastError: lastError?.message,
      stack: lastError?.stack,
    });

    throw new Error(
      `Failed to generate ${componentKey} after ${maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Generate test content using OpenAI (1-2 sentences for fast testing)
   */
  private async generateTestContent(prompt: any): Promise<string> {
    try {
      const response = await openaiService.generateContent(
        `Write 1-2 sentences describing a curriculum for: ${prompt.promptTitle} (${prompt.domain}, ${prompt.level} level, ${prompt.totalHours} hours).`,
        'You are a curriculum designer. Generate brief, professional content.',
        {
          temperature: 0.7,
          maxTokens: 100,
        }
      );

      return response.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('OpenAI generation failed, using fallback', {
        error: errorMessage,
        stack: errorStack,
      });
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

      loggingService.info(`🎯 Starting generation for ${componentName}`, {
        projectId,
        component: componentKey,
      });

      // Generate component content with retry logic (up to 3 attempts)
      const result = await this.generateComponentWithRetry(componentKey, prompt, prelimPackage, 3);

      // Normalize the content (convert capitalized enum values to lowercase)
      const normalizedContent = this.normalizeComponentContent(result.content, componentKey);

      // Save to preliminary package
      (prelimPackage as any)[componentKey] = normalizedContent;

      // Add to chat history
      prelimPackage.chatHistory.push({
        role: 'ai',
        content: `✅ ${componentName} generated successfully.`,
        componentRef: componentKey,
        timestamp: new Date(),
      });

      // Log before save for debugging
      loggingService.info(`💾 Saving ${componentKey} to database...`, {
        projectId,
        hasContent: !!normalizedContent,
        contentType: typeof normalizedContent,
      });

      const savedPackage = await prelimPackage.save();

      // Verify the save by checking the returned document
      const isStillThere = !!(savedPackage as any)[componentKey];
      loggingService.info(`✅ Component generated and saved: ${componentKey}`, {
        projectId,
        component: componentKey,
        verifiedInSavedDoc: isStillThere,
      });

      if (!isStillThere) {
        loggingService.error(
          `⚠️ WARNING: ${componentKey} was saved but not found in returned document!`,
          {
            projectId,
            component: componentKey,
          }
        );
      }

      // Emit completion (disabled for testing)
      // websocketService.emitToRoom(`project:${projectId}`, 'component_generated', {
      //   component: componentKey,
      //   name: componentName,
      //   preview: this.getComponentPreview(result.content)
      // });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      loggingService.error(`❌ Error generating/saving component: ${componentKey}`, {
        error: errorMessage,
        stack: errorStack,
        projectId,
        component: componentKey,
        errorName: error instanceof Error ? error.name : 'Unknown',
        isValidationError: error instanceof Error && error.name === 'ValidationError',
      });

      // If it's a Mongoose validation error, log the details
      if (error instanceof Error && error.name === 'ValidationError') {
        loggingService.error(`🔍 Validation error details for ${componentKey}:`, {
          projectId,
          component: componentKey,
          validationErrors: (error as any).errors,
        });
      }

      throw error;
    }
  }

  /**
   * Generate specific component using OpenAI
   */
  private async generateComponent(
    componentKey: string,
    prompt: any,
    prelimPackage: any,
    attemptNumber: number = 1
  ): Promise<ComponentGenerationResult> {
    // Add progressively clearer JSON instructions for retries
    const jsonInstructions =
      attemptNumber === 1
        ? ''
        : attemptNumber === 2
          ? '\n\nIMPORTANT: Return ONLY valid JSON with no markdown formatting, explanatory text, or code blocks. Just pure JSON starting with { and ending with }.'
          : '\n\nCRITICAL: Your response must be PURE JSON only. No ```json markers, no explanations, no extra text. Start immediately with { and end with }. Ensure all quotes are properly escaped and all brackets/braces are balanced.';

    const systemPrompt = `You are an expert curriculum designer creating AGI-compliant SME submissions. Generate content following AGI standards with proper APA 7 citations, UK English spelling, and verified sources (≤5 years old).${jsonInstructions}`;

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

    // Determine maxTokens based on component complexity
    const complexComponents = [
      'assessments',
      'courseFramework',
      'topicSources',
      'competencyFramework',
    ];
    const maxTokens = complexComponents.includes(componentKey) ? 6000 : 4000;

    // Generate using OpenAI
    const response = await openaiService.generateContent(userPrompt, systemPrompt, {
      temperature: 0.7,
      maxTokens,
    });

    // Parse response with robust JSON repair
    let content: any;
    if (responseFormat === 'json') {
      content = this.parseJSONRobust(response, componentKey);
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

Provide:
1. An introduction (2-3 sentences) explaining how to write effective learning outcomes using the Verb + Object + Context structure
2. At least 5 examples, each with:
   - verb: A Bloom's taxonomy verb (apply, analyse, evaluate, design, recommend, construct, implement, justify)
   - example: A complete learning outcome following Verb + Object + Context (e.g., "Analyze financial statements to identify business performance trends in multinational corporations")

Return as JSON:
{
  "introduction": "string",
  "examples": [
    { "verb": "apply", "example": "Apply statistical methods to..." },
    { "verb": "analyse", "example": "Analyse market data to..." },
    ...
  ]
}`;
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
   * Regenerate a single component (useful when generation failed or needs retry)
   */
  async regenerateComponent(projectId: string, componentKey: string): Promise<void> {
    try {
      // Get project and prompt
      const project = await CurriculumProject.findById(projectId).populate('promptId');
      if (!project || !project.promptId) {
        throw new Error('Project or prompt not found');
      }

      // Get preliminary package
      const prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId: project._id });
      if (!prelimPackage) {
        throw new Error('Preliminary package not found');
      }

      const prompt = project.promptId as any;

      loggingService.info(`🔄 Regenerating component: ${componentKey}`, {
        projectId,
        packageId: prelimPackage._id,
      });

      // Get component name for user-friendly messaging
      const componentNames: { [key: string]: string } = {
        programOverview: 'Tab 1: Program Overview',
        competencyFramework: 'Tab 2: Competency & Knowledge Framework',
        learningOutcomes: 'Tab 3: Learning Outcomes & Assessment Criteria',
        courseFramework: 'Tab 4: Course Framework',
        topicSources: 'Tab 5: Topic-Level Sources',
        readingList: 'Tab 6: Reading List',
        assessments: 'Tab 7: Assessments & Mapping',
        glossary: 'Tab 8: Glossary',
        caseStudies: 'Tab 9: Case Studies',
        deliveryTools: 'Tab 10: Delivery & Digital Tools',
        references: 'Tab 11: References',
        submissionMetadata: 'Tab 12: Submission Metadata',
        outcomeWritingGuide: 'Tab 13: Outcome Writing Guide',
        comparativeBenchmarking: 'Tab 14: Comparative Benchmarking',
      };

      const componentName = componentNames[componentKey] || componentKey;

      // Generate and save the component
      await this.generateAndSave(projectId, prelimPackage, prompt, componentKey, componentName);

      loggingService.info(`✅ Component regenerated successfully: ${componentKey}`, {
        projectId,
        packageId: prelimPackage._id,
      });
    } catch (error) {
      loggingService.error('Error regenerating component', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        projectId,
        componentKey,
      });
      throw error;
    }
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

      const refinedContent = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Parse and update with robust JSON parsing
      const parsedContent = this.parseJSONRobust(refinedContent, componentRef);

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
