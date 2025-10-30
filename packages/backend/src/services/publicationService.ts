/**
 * Publication Service
 * Stage 5: Final SME review, refinements, approval, and publication to LMS
 */

import { Types } from 'mongoose';
import { CurriculumReview, ICurriculumReview } from '../models/CurriculumReview';
import { FullCurriculumPackage } from '../models/FullCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { websocketService } from './websocketService';

class PublicationService {
  /**
   * Start final review process
   * This is Stage 5 of the workflow
   */
  async startReview(projectId: string, userId: string): Promise<string> {
    try {
      const project = await CurriculumProject.findById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Get full curriculum package
      const fullPackage = await FullCurriculumPackage.findOne({ projectId });

      if (!fullPackage) {
        throw new Error('Full curriculum package not found');
      }

      // Create review document
      // Handle dev-user string conversion to ObjectId for development mode
      let reviewedByObjectId;
      if (userId === 'dev-user') {
        reviewedByObjectId = new Types.ObjectId('507f1f77bcf86cd799439011'); // Mock user ObjectId
      } else {
        reviewedByObjectId = new Types.ObjectId(userId);
      }

      const review = new CurriculumReview({
        projectId: project._id,
        fullCurriculumId: fullPackage._id,
        reviewedBy: reviewedByObjectId,
        reviewStatus: 'in_review',
        refinements: [],
        publishedToLMS: false,
      });

      await review.save();

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${projectId}`, 'review_started', {
      // reviewId: review._id.toString(),
      // status: 'Awaiting SME final approval',
      // });

      loggingService.info('Final review started', {
        projectId,
        reviewId: review._id,
        userId,
      });

      return review._id.toString();
    } catch (error) {
      loggingService.error('Error starting review', { error, projectId });
      throw error;
    }
  }

  /**
   * Submit refinement request for specific material
   */
  async requestRefinement(
    reviewId: string,
    materialType:
      | 'module_plan'
      | 'case_study'
      | 'simulation'
      | 'assessment'
      | 'slide_deck'
      | 'rubric'
      | 'overall',
    materialId: string | undefined,
    requestedChange: string,
    userId: string
  ): Promise<void> {
    try {
      const review = await CurriculumReview.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      // Add refinement request
      review.refinements.push({
        materialType,
        materialId,
        requestedChange,
        status: 'pending',
      });

      review.reviewStatus = 'refinements_requested';
      await review.save();

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'refinement_requested', {
      // reviewId: review._id.toString(),
      // materialType,
      // materialId,
      // });

      loggingService.info('Refinement requested', {
        reviewId,
        materialType,
        materialId,
        userId,
      });

      // Process refinement in background
      this.processRefinement(review, review.refinements[review.refinements.length - 1]);
    } catch (error) {
      loggingService.error('Error requesting refinement', { error, reviewId });
      throw error;
    }
  }

  /**
   * Process a single refinement request using AI
   */
  private async processRefinement(review: any, refinement: any): Promise<void> {
    try {
      // Get the full curriculum package
      const fullPackage = await FullCurriculumPackage.findById(review.fullCurriculumId);

      if (!fullPackage) {
        throw new Error('Full package not found');
      }

      // Get the material to refine
      let material: any;
      let materialArray: any[];
      let materialIndex: number = -1;

      switch (refinement.materialType) {
        case 'module_plan':
          materialArray = fullPackage.modulePlans;
          materialIndex = materialArray.findIndex((m) => m.moduleCode === refinement.materialId);
          material = materialArray[materialIndex];
          break;
        case 'case_study':
          materialArray = fullPackage.caseStudies;
          materialIndex = materialArray.findIndex((cs) => cs.id === refinement.materialId);
          material = materialArray[materialIndex];
          break;
        case 'simulation':
          materialArray = fullPackage.simulations;
          materialIndex = materialArray.findIndex((sim) => sim.id === refinement.materialId);
          material = materialArray[materialIndex];
          break;
        case 'assessment':
          materialArray = fullPackage.assessmentBank;
          materialIndex = materialArray.findIndex((q) => q.questionId === refinement.materialId);
          material = materialArray[materialIndex];
          break;
        case 'slide_deck':
          materialArray = fullPackage.slideDecks;
          materialIndex = materialArray.findIndex((sd) => sd.moduleCode === refinement.materialId);
          material = materialArray[materialIndex];
          break;
        case 'rubric':
          materialArray = fullPackage.rubrics;
          materialIndex = materialArray.findIndex(
            (r) => r.assessmentType === refinement.materialId
          );
          material = materialArray[materialIndex];
          break;
        default:
          throw new Error(`Unknown material type: ${refinement.materialType}`);
      }

      if (!material) {
        throw new Error(`Material not found: ${refinement.materialType} ${refinement.materialId}`);
      }

      // Generate refined content
      const systemPrompt = `You are refining curriculum materials based on SME feedback. Maintain AGI standards, APA 7 citations, and structural integrity.`;

      const userPrompt = `Refine this ${refinement.materialType}:

Original content:
${JSON.stringify(material, null, 2)}

SME Refinement Request:
${refinement.requestedChange}

Generate the refined version maintaining the same JSON structure. Ensure all required fields are present and citations are maintained.`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Parse refined content
      let refinedContent;
      try {
        refinedContent = JSON.parse(response);
      } catch (e) {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          refinedContent = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse refined content');
        }
      }

      // Update the material in the full package
      (materialArray as any)[materialIndex] = refinedContent;
      await fullPackage.save();

      // Update refinement status
      refinement.status = 'applied';
      refinement.appliedAt = new Date();
      refinement.appliedBy = 'AI System';
      await review.save();

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'refinement_applied', {
      // reviewId: review._id.toString(),
      // materialType: refinement.materialType,
      // materialId: refinement.materialId,
      // });

      loggingService.info('Refinement applied', {
        reviewId: review._id,
        materialType: refinement.materialType,
        materialId: refinement.materialId,
      });
    } catch (error) {
      // Update refinement status to rejected
      refinement.status = 'rejected';
      await review.save();

      loggingService.error('Error processing refinement', {
        error,
        reviewId: review._id,
        materialType: refinement.materialType,
      });
    }
  }

  /**
   * SME approves the curriculum for publication
   */
  async smeApprove(
    reviewId: string,
    userId: string,
    ipAddress: string,
    digitalSignature?: string
  ): Promise<void> {
    try {
      const review = await CurriculumReview.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      // Record SME approval
      review.smeApproval = {
        userId: userId as any,
        timestamp: new Date(),
        ipAddress,
        digitalSignature,
      };
      review.reviewStatus = 'approved';

      await review.save();

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'sme_approved', {
      // reviewId: review._id.toString(),
      // status: 'Pending publication approval',
      // });

      loggingService.info('SME approved curriculum', {
        reviewId,
        userId,
        ipAddress,
      });
    } catch (error) {
      loggingService.error('Error in SME approval', { error, reviewId });
      throw error;
    }
  }

  /**
   * Admin/Management gives publication approval
   */
  async adminApprovePublication(reviewId: string, adminId: string, notes?: string): Promise<void> {
    try {
      const review = await CurriculumReview.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewStatus !== 'approved') {
        throw new Error('Curriculum must be SME-approved before publication');
      }

      // Record publication approval
      review.publicationApproval = {
        adminId: adminId as any,
        approvedAt: new Date(),
        notes,
      };

      await review.save();

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'publication_approved', {
      // reviewId: review._id.toString(),
      // status: 'Ready for LMS publication',
      // });

      loggingService.info('Publication approved', {
        reviewId,
        adminId,
      });
    } catch (error) {
      loggingService.error('Error in publication approval', { error, reviewId });
      throw error;
    }
  }

  /**
   * Publish curriculum to LMS
   * (Simplified - would integrate with actual LMS API)
   */
  async publishToLMS(
    reviewId: string,
    lmsConfig?: {
      lmsType: 'moodle' | 'canvas' | 'blackboard' | 'custom';
      courseId?: string;
      settings?: any;
    }
  ): Promise<void> {
    try {
      const review = await CurriculumReview.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      if (!review.publicationApproval) {
        throw new Error('Curriculum must be publication-approved before publishing');
      }

      // Get full package
      const fullPackage = await FullCurriculumPackage.findById(review.fullCurriculumId);

      if (!fullPackage) {
        throw new Error('Full package not found');
      }

      // In production, integrate with LMS API here
      // For now, simulate publication
      const lmsId = `lms_${Date.now()}`;
      const lmsCourseUrl = `https://lms.example.com/course/${lmsId}`;

      // Update review with LMS info
      review.publishedAt = new Date();
      review.publishedToLMS = true;
      review.lmsId = lmsId;
      review.lmsCourseUrl = lmsCourseUrl;

      await review.save();

      // Update project status to published
      const project = await CurriculumProject.findById(review.projectId);
      if (project) {
        project.status = 'published';
        project.completedAt = new Date();
        await project.save();
      }

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'published_to_lms', {
      // reviewId: review._id.toString(),
      // lmsId,
      // lmsCourseUrl,
      // status: 'Published successfully',
      // });

      loggingService.info('Curriculum published to LMS', {
        reviewId,
        lmsId,
        lmsCourseUrl,
      });
    } catch (error) {
      loggingService.error('Error publishing to LMS', { error, reviewId });
      throw error;
    }
  }

  /**
   * Get review status and details
   */
  async getReview(reviewId: string): Promise<ICurriculumReview | null> {
    try {
      return await CurriculumReview.findById(reviewId)
        .populate('reviewedBy', 'name email')
        .populate('smeApproval.userId', 'name email')
        .populate('publicationApproval.adminId', 'name email');
    } catch (error) {
      loggingService.error('Error getting review', { error, reviewId });
      throw error;
    }
  }

  /**
   * Get all refinements for a review
   */
  async getRefinements(reviewId: string): Promise<any[]> {
    try {
      const review = await CurriculumReview.findById(reviewId).select('refinements');

      if (!review) {
        throw new Error('Review not found');
      }

      return review.refinements || [];
    } catch (error) {
      loggingService.error('Error getting refinements', { error, reviewId });
      throw error;
    }
  }

  /**
   * Reject the curriculum (with reason)
   */
  async rejectCurriculum(reviewId: string, userId: string, reason: string): Promise<void> {
    try {
      const review = await CurriculumReview.findById(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      review.reviewStatus = 'rejected';
      review.rejectionReason = reason;
      review.rejectedBy = userId as any;
      review.rejectedAt = new Date();

      await review.save();

      // Update project status
      const project = await CurriculumProject.findById(review.projectId);
      if (project) {
        project.status = 'failed';
        await project.save();
      }

      // Emit WebSocket event
      // websocketService.emitToRoom(`project:${review.projectId}`, 'curriculum_rejected', {
      // reviewId: review._id.toString(),
      // reason,
      // });

      loggingService.info('Curriculum rejected', {
        reviewId,
        userId,
        reason,
      });
    } catch (error) {
      loggingService.error('Error rejecting curriculum', { error, reviewId });
      throw error;
    }
  }
}

export const publicationService = new PublicationService();
