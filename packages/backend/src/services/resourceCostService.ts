/**
 * Resource Cost Service
 * Stage 3: Evaluates paid resources, calculates costs, suggests alternatives
 * Routes to management for approval
 */

import { ResourceCostEvaluation, IResourceCostEvaluation } from '../models/ResourceCostEvaluation';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { websocketService } from './websocketService';

interface ExtractedResource {
  resourceName: string;
  resourceType: 'textbook' | 'software' | 'database' | 'tool' | 'license' | 'other';
  vendor?: string;
  justification: string;
  foundIn: string; // which component mentioned it
}

interface Alternative {
  name: string;
  cost: number;
  qualityMatch: number;
  limitations?: string;
  source: string;
}

class ResourceCostService {
  /**
   * Start resource cost evaluation for a project
   * This is Stage 3 of the workflow
   */
  async startEvaluation(projectId: string): Promise<string> {
    try {
      const project = await CurriculumProject.findById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Get preliminary package
      const prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId });

      if (!prelimPackage) {
        throw new Error('Preliminary package not found');
      }

      // Extract paid resources from preliminary package
      const extractedResources = await this.extractPaidResources(prelimPackage);

      // Get cost estimates and alternatives for each resource
      const resourcesWithCosts = await Promise.all(
        extractedResources.map((resource) => this.evaluateResource(resource))
      );

      // Calculate total cost
      const totalCost = resourcesWithCosts.reduce((sum, r) => sum + r.totalCost, 0);

      // Create evaluation document
      const evaluation = new ResourceCostEvaluation({
        projectId: project._id,
        preliminaryPackageId: prelimPackage._id,
        resources: resourcesWithCosts,
        totalEstimatedCost: totalCost,
        managementDecision: 'pending',
        instructionalPlanChanged: false,
        smeReApprovalStatus: 'not_required',
      });

      await evaluation.save();

      // Update project status
      await project.updateStageProgress({
        resourceEvaluationId: evaluation._id,
      });

      // Emit WebSocket event
      websocketService.emitToRoom(`project:${projectId}`, 'cost_evaluation_complete', {
        evaluationId: evaluation._id.toString(),
        totalCost,
        resourceCount: resourcesWithCosts.length,
        status: 'pending_management_approval',
      });

      loggingService.info('Resource cost evaluation created', {
        projectId,
        evaluationId: evaluation._id,
        totalCost,
      });

      return evaluation._id.toString();
    } catch (error) {
      loggingService.error('Error starting resource evaluation', { error, projectId });
      throw error;
    }
  }

  /**
   * Extract paid resources from preliminary curriculum package
   */
  private async extractPaidResources(prelimPackage: any): Promise<ExtractedResource[]> {
    try {
      const resources: ExtractedResource[] = [];

      // Analyze reading list
      if (prelimPackage.readingLists?.indicative) {
        for (const reading of prelimPackage.readingLists.indicative) {
          if (this.isPaidResource(reading.citation)) {
            resources.push({
              resourceName: this.extractResourceName(reading.citation),
              resourceType: 'textbook',
              justification: `Required reading: ${reading.synopsis}`,
              foundIn: 'Indicative Reading List',
            });
          }
        }
      }

      // Analyze delivery tools
      if (prelimPackage.deliveryTools?.digitalTools) {
        for (const tool of prelimPackage.deliveryTools.digitalTools) {
          if (this.isPaidTool(tool)) {
            resources.push({
              resourceName: tool,
              resourceType: 'software',
              justification: 'Required for course delivery',
              foundIn: 'Delivery & Digital Tools',
            });
          }
        }
      }

      // Analyze case studies for datasets/tools
      if (prelimPackage.caseStudies) {
        for (const caseStudy of prelimPackage.caseStudies) {
          const paidResources = this.extractPaidFromText(
            caseStudy.description || caseStudy.situationDescription
          );
          resources.push(...paidResources);
        }
      }

      // Use AI to find any other paid resources mentioned
      const aiExtracted = await this.aiExtractResources(prelimPackage);
      resources.push(...aiExtracted);

      // Deduplicate
      return this.deduplicateResources(resources);
    } catch (error) {
      loggingService.error('Error extracting paid resources', { error });
      return [];
    }
  }

  /**
   * Check if a citation refers to a paid resource
   */
  private isPaidResource(citation: string): boolean {
    const paidIndicators = [
      'published by',
      'textbook',
      'handbook',
      'manual',
      'guide to',
      'edition',
      'isbn',
      'wiley',
      'pearson',
      'springer',
      'elsevier',
      'cambridge',
      'oxford',
    ];

    const lowerCitation = citation.toLowerCase();
    return paidIndicators.some((indicator) => lowerCitation.includes(indicator));
  }

  /**
   * Check if a tool is paid
   */
  private isPaidTool(tool: string): boolean {
    const freePlatforms = [
      'open source',
      'free',
      'libre',
      'foss',
      'github',
      'google sheets',
      'google docs',
    ];
    const lowerTool = tool.toLowerCase();

    // If explicitly marked as free, skip
    if (freePlatforms.some((free) => lowerTool.includes(free))) {
      return false;
    }

    const paidTools = [
      'tableau',
      'power bi',
      'spss',
      'sas',
      'matlab',
      'workday',
      'sap',
      'oracle',
      'salesforce',
      'adobe',
      'microsoft 365',
      'zoom pro',
      'miro',
      'mural',
    ];

    return paidTools.some((paid) => lowerTool.includes(paid));
  }

  /**
   * Extract paid resources from text using pattern matching
   */
  private extractPaidFromText(text: string): ExtractedResource[] {
    const resources: ExtractedResource[] = [];

    // Pattern: "using [tool/software]"
    const toolPattern = /using\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    let match;

    while ((match = toolPattern.exec(text)) !== null) {
      const toolName = match[1];
      if (this.isPaidTool(toolName)) {
        resources.push({
          resourceName: toolName,
          resourceType: 'tool',
          justification: 'Mentioned in case study/content',
          foundIn: 'Case Study or Module Content',
        });
      }
    }

    return resources;
  }

  /**
   * Use AI to extract paid resources from package
   */
  private async aiExtractResources(prelimPackage: any): Promise<ExtractedResource[]> {
    try {
      const systemPrompt = `You are a curriculum resource analyst. Extract all paid resources (textbooks, software, databases, tools, licenses) mentioned in the curriculum package. Return only commercial/paid resources, not free or open-source ones.`;

      const userPrompt = `Analyze this curriculum package and identify ALL paid resources:

Reading Lists: ${JSON.stringify(prelimPackage.readingLists, null, 2)}
Delivery Tools: ${JSON.stringify(prelimPackage.deliveryTools, null, 2)}
Case Studies: ${JSON.stringify(prelimPackage.caseStudies?.slice(0, 3), null, 2)}

Return as JSON array: [{ resourceName: string, resourceType: "textbook"|"software"|"database"|"tool"|"license", vendor: string|null, justification: string }]`;

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      });

      const parsed = JSON.parse(response);
      return (parsed as any[]).map((r) => ({
        ...r,
        foundIn: 'AI Extraction',
      }));
    } catch (error) {
      loggingService.error('Error in AI resource extraction', { error });
      return [];
    }
  }

  /**
   * Deduplicate resources
   */
  private deduplicateResources(resources: ExtractedResource[]): ExtractedResource[] {
    const seen = new Set<string>();
    const unique: ExtractedResource[] = [];

    for (const resource of resources) {
      const key = `${resource.resourceName.toLowerCase()}_${resource.resourceType}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(resource);
      }
    }

    return unique;
  }

  /**
   * Extract resource name from citation
   */
  private extractResourceName(citation: string): string {
    // Extract title from APA citation (title comes after first period, before next period)
    const parts = citation.split('.');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return citation.substring(0, 100);
  }

  /**
   * Evaluate a single resource: get cost and alternatives
   */
  private async evaluateResource(resource: ExtractedResource): Promise<any> {
    try {
      // Get cost estimate using AI
      const costData = await this.getCostEstimate(resource);

      // Get alternatives using AI
      const alternatives = await this.getAlternatives(resource);

      return {
        resourceName: resource.resourceName,
        resourceType: resource.resourceType,
        vendor: resource.vendor || costData.vendor,
        costPerStudent: costData.costPerStudent,
        estimatedStudents: 100, // Default estimate
        totalCost: costData.costPerStudent * 100,
        isRecurring: costData.isRecurring,
        recurringPeriod: costData.recurringPeriod,
        justification: resource.justification,
        alternatives,
      };
    } catch (error) {
      loggingService.error('Error evaluating resource', { error, resource });

      // Return fallback data
      return {
        resourceName: resource.resourceName,
        resourceType: resource.resourceType,
        vendor: null,
        costPerStudent: 0,
        estimatedStudents: 100,
        totalCost: 0,
        isRecurring: false,
        justification: resource.justification,
        alternatives: [],
      };
    }
  }

  /**
   * Get cost estimate for a resource using AI
   */
  private async getCostEstimate(resource: ExtractedResource): Promise<any> {
    const systemPrompt = `You are a resource cost analyst. Provide realistic cost estimates for educational resources. Use 2024-2025 pricing data.`;

    const userPrompt = `Estimate the cost for this resource:
Resource: ${resource.resourceName}
Type: ${resource.resourceType}

Provide:
- Vendor name
- Cost per student (in USD)
- Is it recurring? (boolean)
- If recurring, period (monthly or annually)
- Brief pricing notes

Return as JSON: { vendor: string, costPerStudent: number, isRecurring: boolean, recurringPeriod?: "monthly"|"annually", pricingNotes: string }`;

    const response = await openaiService.generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 500,
    });

    try {
      return JSON.parse(response);
    } catch (e) {
      // Fallback
      return {
        vendor: 'Unknown',
        costPerStudent: 50,
        isRecurring: false,
        pricingNotes: 'Estimated cost',
      };
    }
  }

  /**
   * Get alternative resources using AI
   */
  private async getAlternatives(resource: ExtractedResource): Promise<Alternative[]> {
    const systemPrompt = `You are an educational resource advisor. Suggest free or lower-cost alternatives to commercial resources, including open-source options, open educational resources (OER), and free tools.`;

    const userPrompt = `Suggest 2-3 alternatives to this paid resource:
Resource: ${resource.resourceName}
Type: ${resource.resourceType}

For each alternative provide:
- Name
- Estimated cost per student (0 if free)
- Quality match percentage (0-100, compared to original)
- Limitations (if any)

Return as JSON array: [{ name: string, cost: number, qualityMatch: number, limitations?: string }]`;

    try {
      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 1000,
      });

      const alternatives = JSON.parse(response);
      return (alternatives as any[]).map((alt) => ({
        ...alt,
        source: 'AI Suggestion',
      }));
    } catch (error) {
      loggingService.error('Error getting alternatives', { error, resource });
      return [];
    }
  }

  /**
   * Management approves/rejects the cost evaluation
   * (Simplified - no management UI yet, auto-approve for now)
   */
  async processManagementDecision(
    evaluationId: string,
    decision: 'approved' | 'rejected',
    decidedBy: string,
    notes?: string,
    selectedAlternatives?: { resourceName: string; alternativeName: string }[]
  ): Promise<void> {
    try {
      const evaluation = await ResourceCostEvaluation.findById(evaluationId);

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      evaluation.managementDecision = decision;
      evaluation.decidedBy = decidedBy as any;
      evaluation.decidedAt = new Date();
      evaluation.decisionNotes = notes;

      if (decision === 'approved') {
        // Build final resources list
        const finalResources = [];

        for (const resource of evaluation.resources) {
          // Check if this resource was substituted
          const substitution = selectedAlternatives?.find(
            (s) => s.resourceName === resource.resourceName
          );

          if (substitution) {
            // Find the alternative
            const alternative = resource.alternatives.find(
              (a) => a.name === substitution.alternativeName
            );

            if (alternative) {
              finalResources.push({
                resourceName: alternative.name,
                cost: alternative.cost * resource.estimatedStudents,
                type: resource.resourceType,
                isAlternative: true,
              });

              // Mark if instructional plan might be affected
              if (alternative.qualityMatch < 90) {
                evaluation.instructionalPlanChanged = true;
                evaluation.smeReApprovalStatus = 'pending';
              }
            } else {
              // Keep original
              finalResources.push({
                resourceName: resource.resourceName,
                cost: resource.totalCost,
                type: resource.resourceType,
                isAlternative: false,
              });
            }
          } else {
            // Keep original
            finalResources.push({
              resourceName: resource.resourceName,
              cost: resource.totalCost,
              type: resource.resourceType,
              isAlternative: false,
            });
          }
        }

        evaluation.finalResources = finalResources;

        // Recalculate total
        evaluation.totalEstimatedCost = finalResources.reduce((sum, r) => sum + r.cost, 0);
      }

      await evaluation.save();

      // Update project status
      const project = await CurriculumProject.findById(evaluation.projectId);
      if (project && decision === 'approved') {
        // If SME re-approval is not needed, advance to stage 4
        if (evaluation.smeReApprovalStatus === 'not_required') {
          await project.advanceStage();
        }
      }

      // Emit WebSocket event
      websocketService.emitToRoom(`project:${evaluation.projectId}`, 'management_decision', {
        evaluationId: evaluation._id.toString(),
        decision,
        finalCost: evaluation.totalEstimatedCost,
        needsSmeReApproval: evaluation.smeReApprovalStatus === 'pending',
      });

      loggingService.info('Management decision processed', {
        evaluationId,
        decision,
        finalCost: evaluation.totalEstimatedCost,
      });
    } catch (error) {
      loggingService.error('Error processing management decision', { error, evaluationId });
      throw error;
    }
  }

  /**
   * Auto-approve evaluation (for now, until management UI is built)
   */
  async autoApprove(evaluationId: string): Promise<void> {
    await this.processManagementDecision(
      evaluationId,
      'approved',
      'system_auto_approve',
      'Auto-approved: Management UI not yet implemented'
    );
  }

  /**
   * SME re-approves after resource substitution
   */
  async smeReApproval(evaluationId: string, userId: string, approved: boolean): Promise<void> {
    try {
      const evaluation = await ResourceCostEvaluation.findById(evaluationId);

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      evaluation.smeReApprovalStatus = approved ? 'approved' : 'rejected';
      evaluation.smeReApprovedBy = userId as any;
      evaluation.smeReApprovedAt = new Date();

      await evaluation.save();

      // If approved, advance project to stage 4
      if (approved) {
        const project = await CurriculumProject.findById(evaluation.projectId);
        if (project) {
          await project.advanceStage();
        }
      }

      websocketService.emitToRoom(`project:${evaluation.projectId}`, 'sme_reapproval', {
        evaluationId,
        approved,
      });

      loggingService.info('SME re-approval processed', { evaluationId, approved, userId });
    } catch (error) {
      loggingService.error('Error processing SME re-approval', { error, evaluationId });
      throw error;
    }
  }

  /**
   * Get evaluation details
   */
  async getEvaluation(evaluationId: string): Promise<IResourceCostEvaluation | null> {
    try {
      return await ResourceCostEvaluation.findById(evaluationId)
        .populate('decidedBy', 'name email')
        .populate('smeReApprovedBy', 'name email');
    } catch (error) {
      loggingService.error('Error getting evaluation', { error, evaluationId });
      throw error;
    }
  }
}

export const resourceCostService = new ResourceCostService();
