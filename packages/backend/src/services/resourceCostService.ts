import { ResourceCostEvaluation, IResourceCostEvaluation } from '../models/ResourceCostEvaluation';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { loggingService } from './loggingService';
import { openaiService } from './openaiService';

interface PaidResource {
  name: string;
  type: 'journal' | 'database' | 'tool' | 'software' | 'book' | 'other';
  cost: number;
  currency: string;
  subscriptionType: 'one-time' | 'annual' | 'monthly' | 'per-student';
  source: string; // Which component this came from
  url?: string;
  description?: string;
}

interface AlternativeResource {
  originalResource: string;
  alternativeName: string;
  cost: number;
  currency: string;
  reasoning: string;
  quality: 'better' | 'similar' | 'acceptable';
  url?: string;
}

class ResourceCostService {
  /**
   * Start cost evaluation for a project
   */
  async startEvaluation(projectId: string): Promise<IResourceCostEvaluation> {
    try {
      loggingService.info('🔍 Starting cost evaluation', { projectId });

      // Get project and preliminary package
      const project = await CurriculumProject.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId });
      if (!prelimPackage) {
        throw new Error('Preliminary package not found');
      }

      // Check if evaluation already exists
      let costEval = await ResourceCostEvaluation.findOne({ projectId });
      if (costEval) {
        loggingService.info('Cost evaluation already exists, returning existing', { projectId });
        return costEval;
      }

      // Scan all components for paid resources
      const paidResources = await this.scanComponentsForPaidResources(prelimPackage);
      loggingService.info(`Found ${paidResources.length} paid resources`, { projectId });

      // Calculate total cost
      const totalCost = this.calculateTotalCost(paidResources);

      // Generate AI alternatives for expensive resources
      const alternatives = await this.generateAlternatives(paidResources);

      // Create cost evaluation record (with duplicate key handling)
      try {
        costEval = await ResourceCostEvaluation.create({
          projectId,
          preliminaryPackageId: prelimPackage._id,
          paidResources: paidResources.map((r) => ({
            resourceName: r.name,
            resourceType: r.type,
            cost: r.cost,
            currency: r.currency,
            subscriptionType: r.subscriptionType,
            identifiedIn: r.source,
            url: r.url,
            reasoning: r.description || 'Identified as paid resource',
          })),
          totalEstimatedCost: totalCost.total,
          currency: 'USD',
          costBreakdown: {
            journals: totalCost.journals,
            databases: totalCost.databases,
            tools: totalCost.tools,
            software: totalCost.software,
            other: totalCost.other,
          },
          aiSuggestedAlternatives: alternatives.map((a) => ({
            originalResource: a.originalResource,
            alternativeName: a.alternativeName,
            alternativeCost: a.cost,
            costSaving:
              paidResources.find((r) => r.name === a.originalResource)?.cost || 0 - a.cost,
            reasoning: a.reasoning,
            qualityComparison: a.quality,
            url: a.url,
          })),
          managementDecision: 'pending',
          evaluatedAt: new Date(),
        });
      } catch (createError: any) {
        // Handle duplicate key error (race condition)
        if (createError.code === 11000) {
          loggingService.warn(
            'Duplicate cost evaluation detected (race condition), fetching existing',
            {
              projectId,
            }
          );
          costEval = await ResourceCostEvaluation.findOne({ projectId });
          if (!costEval) {
            throw new Error('Cost evaluation creation failed and could not fetch existing record');
          }
          return costEval;
        }
        throw createError;
      }

      // Update project stage
      project.stageProgress.stage3_costEvaluation = 'in-progress';
      await project.save();

      loggingService.info('✅ Cost evaluation completed', {
        projectId,
        totalCost: totalCost.total,
        resourceCount: paidResources.length,
        alternativesCount: alternatives.length,
      });

      return costEval;
    } catch (error) {
      loggingService.error('Error in cost evaluation', { error, projectId });
      throw error;
    }
  }

  /**
   * Scan all 14 components for paid resources
   */
  private async scanComponentsForPaidResources(prelimPackage: any): Promise<PaidResource[]> {
    const paidResources: PaidResource[] = [];

    try {
      // 1. Scan Reading List for paid books/journals
      if (prelimPackage.readingList) {
        const { indicative = [], additional = [] } = prelimPackage.readingList;
        [...indicative, ...additional].forEach((item: any) => {
          if (this.isPaidResource(item.citation, item.type)) {
            paidResources.push({
              name: item.citation,
              type: item.type === 'book' ? 'book' : 'journal',
              cost: this.estimateCost(item.type),
              currency: 'USD',
              subscriptionType: 'one-time',
              source: 'Reading List',
              url: item.url,
              description: item.synopsis,
            });
          }
        });
      }

      // 2. Scan Topic Sources for paid journals/databases
      if (prelimPackage.topicSources && Array.isArray(prelimPackage.topicSources)) {
        prelimPackage.topicSources.forEach((topic: any) => {
          if (topic.sources && Array.isArray(topic.sources)) {
            topic.sources.forEach((source: any) => {
              if (this.isPaidResource(source.citation, 'academic')) {
                paidResources.push({
                  name: source.citation,
                  type: 'journal',
                  cost: this.estimateCost('academic'),
                  currency: 'USD',
                  subscriptionType: 'annual',
                  source: 'Topic Sources',
                  url: source.url,
                  description: source.explanation,
                });
              }
            });
          }
        });
      }

      // 3. Scan Delivery & Tools for paid software/tools
      if (prelimPackage.deliveryTools) {
        const { digitalTools = [], technicalRequirements = [] } = prelimPackage.deliveryTools;
        [...digitalTools, ...technicalRequirements].forEach((tool: string) => {
          if (this.isPaidTool(tool)) {
            paidResources.push({
              name: tool,
              type: 'tool',
              cost: this.estimateToolCost(tool),
              currency: 'USD',
              subscriptionType: 'per-student',
              source: 'Delivery & Tools',
              description: 'Digital tool or software license',
            });
          }
        });
      }

      // 4. Scan Case Studies for proprietary databases
      if (prelimPackage.caseStudies && Array.isArray(prelimPackage.caseStudies)) {
        prelimPackage.caseStudies.forEach((caseStudy: any) => {
          if (caseStudy.source && this.isPaidDatabase(caseStudy.source)) {
            paidResources.push({
              name: caseStudy.source,
              type: 'database',
              cost: this.estimateCost('database'),
              currency: 'USD',
              subscriptionType: 'annual',
              source: 'Case Studies',
              description: 'Case study database subscription',
            });
          }
        });
      }

      // Remove duplicates
      return this.deduplicateResources(paidResources);
    } catch (error) {
      loggingService.error('Error scanning components', { error });
      return paidResources;
    }
  }

  /**
   * Check if a resource is paid (not open access)
   */
  private isPaidResource(citation: string, type: string): boolean {
    const lowerCitation = citation.toLowerCase();

    // Known free resources
    const freeKeywords = [
      'open access',
      'arxiv',
      'plos',
      'frontiers',
      'mdpi',
      'wikipedia',
      'free',
      'creative commons',
    ];

    if (freeKeywords.some((keyword) => lowerCitation.includes(keyword))) {
      return false;
    }

    // Known paid publishers/journals
    const paidKeywords = [
      'elsevier',
      'springer',
      'wiley',
      'sage',
      'taylor & francis',
      'oxford',
      'cambridge',
      'jstor',
      'ieee',
      'harvard business review',
    ];

    return paidKeywords.some((keyword) => lowerCitation.includes(keyword));
  }

  /**
   * Check if a tool is paid
   */
  private isPaidTool(toolName: string): boolean {
    const lowerTool = toolName.toLowerCase();

    const paidTools = [
      'tableau',
      'power bi',
      'adobe',
      'microsoft',
      'sap',
      'oracle',
      'salesforce',
      'atlassian',
      'jira',
      'slack premium',
    ];

    return paidTools.some((tool) => lowerTool.includes(tool));
  }

  /**
   * Check if a database is paid
   */
  private isPaidDatabase(source: string): boolean {
    const lowerSource = source.toLowerCase();
    const paidDatabases = ['harvard business', 'kellogg', 'ivey', 'wharton', 'case centre'];
    return paidDatabases.some((db) => lowerSource.includes(db));
  }

  /**
   * Estimate cost based on resource type
   */
  private estimateCost(type: string): number {
    const costEstimates: Record<string, number> = {
      book: 50,
      journal: 500, // Annual subscription
      academic: 500,
      database: 2000,
      tool: 100, // Per student
      software: 500,
      other: 100,
    };

    return costEstimates[type] || 100;
  }

  /**
   * Estimate tool cost based on name
   */
  private estimateToolCost(toolName: string): number {
    const lowerTool = toolName.toLowerCase();

    if (lowerTool.includes('tableau') || lowerTool.includes('power bi')) return 70;
    if (lowerTool.includes('adobe')) return 50;
    if (lowerTool.includes('microsoft')) return 30;
    if (lowerTool.includes('sap') || lowerTool.includes('oracle')) return 200;

    return 50; // Default per-student cost
  }

  /**
   * Remove duplicate resources
   */
  private deduplicateResources(resources: PaidResource[]): PaidResource[] {
    const seen = new Set<string>();
    return resources.filter((resource) => {
      const key = `${resource.name}-${resource.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate total cost breakdown
   */
  private calculateTotalCost(resources: PaidResource[]) {
    const breakdown = {
      journals: 0,
      databases: 0,
      tools: 0,
      software: 0,
      other: 0,
      total: 0,
    };

    resources.forEach((resource) => {
      switch (resource.type) {
        case 'journal':
          breakdown.journals += resource.cost;
          break;
        case 'database':
          breakdown.databases += resource.cost;
          break;
        case 'tool':
          breakdown.tools += resource.cost;
          break;
        case 'software':
          breakdown.software += resource.cost;
          break;
        default:
          breakdown.other += resource.cost;
      }
    });

    breakdown.total =
      breakdown.journals +
      breakdown.databases +
      breakdown.tools +
      breakdown.software +
      breakdown.other;

    return breakdown;
  }

  /**
   * Generate AI-suggested alternatives for paid resources
   */
  private async generateAlternatives(
    paidResources: PaidResource[]
  ): Promise<AlternativeResource[]> {
    if (paidResources.length === 0) {
      return [];
    }

    try {
      const resourceList = paidResources
        .map((r, i) => `${i + 1}. ${r.name} (${r.type}) - $${r.cost}/${r.subscriptionType}`)
        .join('\n');

      const prompt = `You are an educational resource consultant. Analyze these paid resources and suggest free or cheaper alternatives that maintain educational quality.

Paid Resources:
${resourceList}

For each resource, suggest a free or lower-cost alternative. Return as JSON array:
[
  {
    "originalResource": "Resource name",
    "alternativeName": "Free alternative name",
    "cost": 0,
    "currency": "USD",
    "reasoning": "Why this alternative is suitable (1-2 sentences)",
    "quality": "similar" | "better" | "acceptable",
    "url": "Link to alternative (if applicable)"
  }
]

Focus on:
- Open access journals instead of paid journals
- Free tools (Google Suite, Canva) instead of paid software
- Open educational resources
- Creative Commons content
- University library resources`;

      const systemPrompt = `You are an expert in educational technology and open educational resources. Provide practical, accessible alternatives that maintain quality.`;

      const response = await openaiService.generateContent(prompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Parse JSON response with robust error handling
      let alternatives;
      try {
        // Try direct parse first
        alternatives = JSON.parse(response);
      } catch (e) {
        // Extract from markdown if wrapped
        const jsonMatch =
          response.match(/```json\s*\n([\s\S]*?)\n```/) ||
          response.match(/```\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          alternatives = JSON.parse(jsonMatch[1]);
        } else {
          // Try extracting content between first [ and last ]
          const firstBracket = response.indexOf('[');
          const lastBracket = response.lastIndexOf(']');
          if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            const extracted = response.substring(firstBracket, lastBracket + 1);
            alternatives = JSON.parse(extracted);
          } else {
            throw new Error('Could not extract JSON from response');
          }
        }
      }

      return Array.isArray(alternatives) ? alternatives : [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error generating alternatives', {
        error: errorMessage,
        stack: errorStack,
      });
      return [];
    }
  }

  /**
   * Approve cost evaluation (management decision)
   */
  async approveCostEvaluation(
    projectId: string,
    approvedBy: string,
    selectedAlternatives?: string[]
  ): Promise<IResourceCostEvaluation> {
    const costEval = await ResourceCostEvaluation.findOne({ projectId });
    if (!costEval) {
      throw new Error('Cost evaluation not found');
    }

    costEval.managementDecision = 'approved';
    costEval.approvedBy = approvedBy as any;
    costEval.approvedAt = new Date();
    costEval.selectedAlternatives = selectedAlternatives || [];

    await costEval.save();

    // Update project stage
    const project = await CurriculumProject.findById(projectId);
    if (project) {
      project.stageProgress.stage3_costEvaluation = 'completed';
      project.currentStage = 4;
      await project.save();
    }

    loggingService.info('✅ Cost evaluation approved', { projectId, approvedBy });

    return costEval;
  }

  /**
   * Reject cost evaluation (management decision)
   */
  async rejectCostEvaluation(
    projectId: string,
    rejectedBy: string,
    reason: string
  ): Promise<IResourceCostEvaluation> {
    const costEval = await ResourceCostEvaluation.findOne({ projectId });
    if (!costEval) {
      throw new Error('Cost evaluation not found');
    }

    costEval.managementDecision = 'rejected';
    costEval.rejectionReason = reason;
    costEval.rejectedBy = rejectedBy as any;
    costEval.rejectedAt = new Date();

    await costEval.save();

    loggingService.info('❌ Cost evaluation rejected', { projectId, rejectedBy, reason });

    return costEval;
  }

  /**
   * Get cost evaluation for a project
   */
  async getCostEvaluation(projectId: string): Promise<IResourceCostEvaluation | null> {
    return await ResourceCostEvaluation.findOne({ projectId });
  }
}

export const resourceCostService = new ResourceCostService();
