import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { llmService } from './llmService';
import { embeddingService } from './embeddingService';
import { SkillMapping as SkillMappingModel } from '../models/SkillMapping';
import {
  SkillMapping,
  SkillMappingGenerationRequest,
  SkillMappingGenerationResult,
  LLMSkillMappingOutput,
  PracticalActivity,
  MeasurableKPI,
} from '../types/skillBook';
import { CompetencyDomain, Module, LearningOutcome } from '../types/excel';

/**
 * Skill Book Generator Service
 * Generates skill mappings with practical activities and KPIs
 * Implements Requirements 4.1, 4.2, 4.3, 4.4
 */

export class SkillBookGenerator {
  /**
   * Generate skill mappings from competency domains
   * Requirement 4.1: Identify skill labels from uploaded Competency Framework
   * Requirement 4.2: Create entries with skill name, domain, activities, KPIs, etc.
   */
  async generateSkillMappings(
    request: SkillMappingGenerationRequest
  ): Promise<SkillMappingGenerationResult> {
    try {
      console.log(`Generating skill mappings for program ${request.programId}`);

      // Extract all skills from competency domains
      const allSkills = this.extractSkillsFromDomains(request.competencyDomains);
      console.log(`Extracted ${allSkills.length} skills from competency framework`);

      // Generate skill mappings using LLM
      const skillMappings = await this.generateSkillMappingsWithLLM(
        allSkills,
        request.modules
      );

      // Validate that KPIs are measurable
      this.validateMeasurableKPIs(skillMappings);

      return {
        skillMappings,
        generatedAt: new Date(),
        programId: request.programId,
      };
    } catch (error) {
      console.error('Error generating skill mappings:', error);
      throw new Error(
        `Failed to generate skill mappings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract skills from competency domains
   * Requirement 4.1: Identify skill labels from the uploaded Competency Framework
   */
  private extractSkillsFromDomains(
    competencyDomains: CompetencyDomain[]
  ): Array<{ skill: string; domain: string; description: string }> {
    const skills: Array<{ skill: string; domain: string; description: string }> = [];

    for (const domain of competencyDomains) {
      for (const skill of domain.skills) {
        skills.push({
          skill,
          domain: domain.domain,
          description: domain.description,
        });
      }
    }

    return skills;
  }

  /**
   * Generate skill mappings using LLM with structured output
   * Requirement 4.2: Create entries containing skill name, domain, practical activities,
   * linked units, measurable KPIs, assessment criteria, and workplace applications
   * Requirement 4.3: Generate practical activities with names, descriptions, unit links,
   * duration, and assessment types
   * Requirement 4.4: Generate measurable KPIs with numeric thresholds or completion criteria
   */
  private async generateSkillMappingsWithLLM(
    skills: Array<{ skill: string; domain: string; description: string }>,
    modules: Module[]
  ): Promise<SkillMapping[]> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(skills, modules);

    try {
      // Use LLM with JSON mode for structured output
      const llmOutput = await llmService.generateStructuredOutput<LLMSkillMappingOutput>(
        userPrompt,
        systemPrompt,
        {
          temperature: 0.7,
          maxTokens: 4000,
        }
      );

      // Transform LLM output to SkillMapping objects with unique IDs
      const skillMappings: SkillMapping[] = llmOutput.skillMappings.map((mapping) => ({
        skillId: uuidv4(),
        skillName: mapping.skillName,
        domain: mapping.domain,
        activities: mapping.activities,
        kpis: mapping.kpis,
        linkedOutcomes: [], // Will be populated in linkToLearningOutcomes
        assessmentCriteria: mapping.assessmentCriteria,
        workplaceApplications: mapping.workplaceApplications,
      }));

      return skillMappings;
    } catch (error) {
      console.error('Error generating skill mappings with LLM:', error);
      throw new Error(
        `LLM skill mapping generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build system prompt for LLM skill mapping generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert curriculum designer specializing in competency-based education and skill mapping.

Your task is to generate comprehensive skill mappings that connect competencies to practical activities, measurable KPIs, and assessment criteria.

CRITICAL REQUIREMENTS:
1. Each skill MUST have at least 1 practical activity
2. Each KPI MUST be measurable with either:
   - A numeric threshold (e.g., "Complete 5 projects", "Achieve 85% accuracy")
   - Clear completion criteria (e.g., "Successfully demonstrate technique", "Pass peer review")
3. Activities must link to specific units from the course framework
4. Assessment types should be practical and relevant (e.g., "Practical Demonstration", "Portfolio Assessment", "Case Study Analysis")
5. Workplace applications should be realistic and industry-relevant

OUTPUT FORMAT:
You must respond with valid JSON in this exact structure:
{
  "skillMappings": [
    {
      "skillName": "string",
      "domain": "string",
      "activities": [
        {
          "name": "string",
          "description": "string",
          "unitLink": "string (module code or unit title)",
          "durationHours": number,
          "assessmentType": "string",
          "resources": ["string"]
        }
      ],
      "kpis": [
        {
          "name": "string",
          "description": "string",
          "measurementCriteria": "string",
          "threshold": number (optional),
          "unit": "string (optional, e.g., 'projects', 'percentage', 'hours')",
          "completionCriteria": "string (optional, use if no numeric threshold)"
        }
      ],
      "assessmentCriteria": ["string"],
      "workplaceApplications": ["string"]
    }
  ]
}

EXAMPLES OF GOOD SKILL MAPPINGS:

Example 1 - Data Analysis Skill:
{
  "skillName": "Data Analysis and Interpretation",
  "domain": "Technical Skills",
  "activities": [
    {
      "name": "Business Intelligence Dashboard Creation",
      "description": "Design and build interactive dashboards using real business data to identify trends and insights",
      "unitLink": "Module 3: Data Visualization",
      "durationHours": 8,
      "assessmentType": "Practical Project",
      "resources": ["Power BI", "Sample datasets", "Dashboard design guidelines"]
    }
  ],
  "kpis": [
    {
      "name": "Dashboard Completion Rate",
      "description": "Number of functional dashboards created with accurate data visualizations",
      "measurementCriteria": "Create and present dashboards that meet all specified requirements",
      "threshold": 3,
      "unit": "dashboards"
    },
    {
      "name": "Data Accuracy",
      "description": "Accuracy of data interpretation and insights",
      "measurementCriteria": "Achieve minimum accuracy in data analysis tasks",
      "threshold": 90,
      "unit": "percentage"
    }
  ],
  "assessmentCriteria": [
    "Dashboard includes all required visualizations",
    "Data is accurately represented",
    "Insights are clearly communicated",
    "Design follows best practices"
  ],
  "workplaceApplications": [
    "Creating executive dashboards for business decision-making",
    "Analyzing sales trends to inform marketing strategies",
    "Monitoring KPIs for operational efficiency"
  ]
}

Example 2 - Communication Skill:
{
  "skillName": "Professional Communication",
  "domain": "Soft Skills",
  "activities": [
    {
      "name": "Stakeholder Presentation",
      "description": "Prepare and deliver professional presentations to diverse stakeholders explaining technical concepts",
      "unitLink": "Module 5: Professional Practice",
      "durationHours": 4,
      "assessmentType": "Oral Presentation",
      "resources": ["Presentation templates", "Communication guidelines", "Feedback rubric"]
    }
  ],
  "kpis": [
    {
      "name": "Presentation Quality",
      "description": "Quality of stakeholder presentations",
      "measurementCriteria": "Deliver presentations that meet professional standards",
      "completionCriteria": "Pass peer and instructor evaluation with satisfactory rating"
    },
    {
      "name": "Audience Engagement",
      "description": "Ability to engage and communicate effectively with audience",
      "measurementCriteria": "Achieve minimum audience engagement score",
      "threshold": 80,
      "unit": "percentage"
    }
  ],
  "assessmentCriteria": [
    "Clear and structured presentation",
    "Appropriate use of visual aids",
    "Effective response to questions",
    "Professional delivery and demeanor"
  ],
  "workplaceApplications": [
    "Presenting project updates to management",
    "Explaining technical solutions to non-technical stakeholders",
    "Leading team meetings and workshops"
  ]
}

Remember: Every KPI MUST be measurable. Use numeric thresholds when possible, or clear completion criteria when numeric measurement isn't appropriate.`;
  }

  /**
   * Build user prompt with skills and modules context
   */
  private buildUserPrompt(
    skills: Array<{ skill: string; domain: string; description: string }>,
    modules: Module[]
  ): string {
    const skillsList = skills
      .map((s) => `- ${s.skill} (Domain: ${s.domain})`)
      .join('\n');

    const modulesList = modules
      .map((m) => {
        const units = m.units
          ? m.units.map((u) => `    - ${u.unitTitle} (${u.hours} hours)`).join('\n')
          : '    (No units specified)';
        return `- ${m.moduleCode}: ${m.moduleTitle} (${m.hours} hours)\n${units}`;
      })
      .join('\n');

    return `Generate comprehensive skill mappings for the following skills from a professional certification program.

SKILLS TO MAP:
${skillsList}

AVAILABLE MODULES AND UNITS:
${modulesList}

INSTRUCTIONS:
1. For each skill, create practical activities that link to relevant units
2. Generate measurable KPIs with numeric thresholds or clear completion criteria
3. Provide assessment criteria that can be objectively evaluated
4. Include realistic workplace applications
5. Ensure activities have appropriate duration (typically 2-8 hours)
6. Use assessment types like: Practical Project, Case Study Analysis, Portfolio Assessment, Practical Demonstration, Peer Review

Generate the skill mappings now in the required JSON format.`;
  }

  /**
   * Validate that all KPIs are measurable
   * Requirement 4.4: Generate measurable KPIs with specific numeric thresholds or completion criteria
   */
  private validateMeasurableKPIs(skillMappings: SkillMapping[]): void {
    for (const mapping of skillMappings) {
      for (const kpi of mapping.kpis) {
        const hasThreshold = kpi.threshold !== undefined && kpi.threshold !== null;
        const hasCompletionCriteria =
          kpi.completionCriteria !== undefined &&
          kpi.completionCriteria.trim().length > 0;

        if (!hasThreshold && !hasCompletionCriteria) {
          throw new Error(
            `KPI "${kpi.name}" for skill "${mapping.skillName}" is not measurable. ` +
              `It must have either a numeric threshold or completion criteria.`
          );
        }

        // Validate measurement criteria is present
        if (!kpi.measurementCriteria || kpi.measurementCriteria.trim().length === 0) {
          throw new Error(
            `KPI "${kpi.name}" for skill "${mapping.skillName}" is missing measurement criteria.`
          );
        }
      }

      // Validate each skill has at least one activity
      if (mapping.activities.length === 0) {
        throw new Error(
          `Skill "${mapping.skillName}" must have at least one practical activity.`
        );
      }
    }
  }

  /**
   * Link skills to learning outcomes using semantic similarity
   * Requirement 4.3: Link each skill to at least 1 activity and at least 2 learning outcomes
   */
  async linkToLearningOutcomes(
    skillMappings: SkillMapping[],
    learningOutcomes: Array<{ id: string; outcomeText: string; moduleId: string }>
  ): Promise<SkillMapping[]> {
    try {
      console.log(
        `Linking ${skillMappings.length} skills to ${learningOutcomes.length} learning outcomes`
      );

      // Generate embeddings for all skill descriptions
      const skillTexts = skillMappings.map(
        (skill) =>
          `${skill.skillName}: ${skill.activities.map((a) => a.description).join(' ')}`
      );

      // Generate embeddings for all learning outcomes
      const outcomeTexts = learningOutcomes.map((outcome) => outcome.outcomeText);

      // Generate embeddings in parallel
      const [skillEmbeddings, outcomeEmbeddings] = await Promise.all([
        this.generateEmbeddingsForTexts(skillTexts),
        this.generateEmbeddingsForTexts(outcomeTexts),
      ]);

      // Link each skill to the most similar learning outcomes
      const updatedSkillMappings = skillMappings.map((skill, skillIndex) => {
        const skillEmbedding = skillEmbeddings[skillIndex];

        // Calculate similarity scores with all outcomes
        const similarities = outcomeEmbeddings.map((outcomeEmbedding, outcomeIndex) => ({
          outcomeId: learningOutcomes[outcomeIndex].id,
          similarity: this.cosineSimilarity(skillEmbedding, outcomeEmbedding),
        }));

        // Sort by similarity and take top matches (minimum 2, maximum 5)
        const topMatches = similarities
          .sort((a, b) => b.similarity - a.similarity)
          .filter((match) => match.similarity > 0.7) // Only include reasonably similar outcomes
          .slice(0, 5)
          .map((match) => match.outcomeId);

        // Ensure at least 2 outcomes are linked (requirement 4.3)
        const linkedOutcomes =
          topMatches.length >= 2 ? topMatches : similarities.slice(0, 2).map((s) => s.outcomeId);

        return {
          ...skill,
          linkedOutcomes,
        };
      });

      // Validate that each skill has at least 2 linked outcomes
      this.validateSkillOutcomeLinks(updatedSkillMappings);

      console.log('Successfully linked skills to learning outcomes');
      return updatedSkillMappings;
    } catch (error) {
      console.error('Error linking skills to learning outcomes:', error);
      throw new Error(
        `Failed to link skills to learning outcomes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  private async generateEmbeddingsForTexts(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map((text) => embeddingService.generateQueryEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Validate that each skill has required links
   * Requirement 4.3: Ensure each skill links to at least 1 activity and 2 learning outcomes
   */
  private validateSkillOutcomeLinks(skillMappings: SkillMapping[]): void {
    for (const skill of skillMappings) {
      if (skill.activities.length < 1) {
        throw new Error(
          `Skill "${skill.skillName}" must have at least 1 practical activity.`
        );
      }

      if (skill.linkedOutcomes.length < 2) {
        throw new Error(
          `Skill "${skill.skillName}" must be linked to at least 2 learning outcomes. ` +
            `Currently linked to ${skill.linkedOutcomes.length}.`
        );
      }
    }
  }

  /**
   * Store skill mappings in database using MongoDB
   * Requirement 4.5: Store Skill Book entries in the database with unique skill identifiers
   */
  async storeSkillMappings(
    programId: string,
    skillMappings: SkillMapping[]
  ): Promise<void> {
    try {
      console.log(`Storing ${skillMappings.length} skill mappings for program ${programId}`);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        for (const skill of skillMappings) {
          const skillMapping = new SkillMappingModel({
            _id: skill.skillId || new mongoose.Types.ObjectId(),
            programId: new mongoose.Types.ObjectId(programId),
            skillName: skill.skillName,
            domain: skill.domain,
            activities: skill.activities,
            kpis: skill.kpis,
            linkedOutcomes: skill.linkedOutcomes.map(id => new mongoose.Types.ObjectId(id)),
            assessmentCriteria: skill.assessmentCriteria,
          });

          await skillMapping.save({ session });
        }

        await session.commitTransaction();
        console.log('Successfully stored skill mappings in MongoDB');
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error storing skill mappings:', error);
      throw new Error(
        `Failed to store skill mappings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve skill mappings from database
   */
  async getSkillMappings(programId: string): Promise<SkillMapping[]> {
    try {
      const skillMappings = await SkillMappingModel.find({ 
        programId: new mongoose.Types.ObjectId(programId) 
      })
      .sort({ domain: 1, skillName: 1 })
      .lean();

      return skillMappings.map((doc) => ({
        skillId: doc._id.toString(),
        skillName: doc.skillName,
        domain: doc.domain,
        activities: doc.activities,
        kpis: doc.kpis,
        linkedOutcomes: doc.linkedOutcomes.map(id => id.toString()),
        assessmentCriteria: doc.assessmentCriteria,
      }));
    } catch (error) {
      console.error('Error retrieving skill mappings:', error);
      throw new Error(
        `Failed to retrieve skill mappings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
export const skillBookGenerator = new SkillBookGenerator();
