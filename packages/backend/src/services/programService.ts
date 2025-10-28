import mongoose from 'mongoose';
import { Program, IProgram } from '../models/Program';
import { Module, IModule } from '../models/Module';
import { LearningOutcome, ILearningOutcome } from '../models/LearningOutcome';
import { Assessment, IAssessment } from '../models/Assessment';
import { KnowledgeBase } from '../models/KnowledgeBase';
import { db } from '../db';
import { ParsedProgramData } from '../types/excel';

export interface ProgramCreateResult {
  programId: string;
  message: string;
  stats: {
    modulesCreated: number;
    learningOutcomesCreated: number;
    assessmentsCreated: number;
  };
}

export class ProgramService {
  /**
   * Create a new program
   */
  async createProgram(data: {
    program_name: string;
    qualification_level: string;
    qualification_type: string;
    total_credits: number;
    industry_sector: string;
    created_by?: string;
  }): Promise<IProgram> {
    // Use dev user ID if no created_by provided
    const devUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId for dev mode
    
    const program = new Program({
      programName: data.program_name,
      qualificationLevel: data.qualification_level,
      qualificationType: data.qualification_type,
      totalCredits: data.total_credits,
      industrySector: data.industry_sector,
      status: 'draft',
      createdBy: data.created_by ? new mongoose.Types.ObjectId(data.created_by) : new mongoose.Types.ObjectId(devUserId),
    });

    await program.save();
    return program;
  }

  /**
   * Store parsed Excel data into database using MongoDB transaction
   */
  async storeParsedData(
    data: ParsedProgramData,
    uploadId: string,
    userId?: string
  ): Promise<ProgramCreateResult> {
    return await db.transaction(async (session) => {
      // 1. Create program record
      const program = new Program({
        programName: data.programOverview.programName,
        qualificationLevel: data.programOverview.qualificationLevel,
        qualificationType: data.programOverview.qualificationType,
        totalCredits: data.programOverview.totalCredits,
        industrySector: data.programOverview.industrySector || 'general',
        status: 'draft',
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      await program.save({ session });
      const programId = program._id.toString();

      // 2. Update file upload with program_id
      const FileUpload = mongoose.model('FileUpload');
      await FileUpload.findByIdAndUpdate(
        uploadId,
        { programId: program._id },
        { session }
      );

      // 3. Create modules
      let modulesCreated = 0;
      const moduleIdMap = new Map<string, mongoose.Types.ObjectId>();

      for (const moduleData of data.courseFramework) {
        const module = new Module({
          programId: program._id,
          moduleCode: moduleData.moduleCode,
          moduleTitle: moduleData.moduleTitle,
          hours: moduleData.hours,
          moduleAim: moduleData.moduleAim || '',
          coreElective: moduleData.coreElective,
          sequenceOrder: moduleData.sequenceOrder,
        });

        await module.save({ session });
        moduleIdMap.set(moduleData.moduleCode, module._id);
        modulesCreated++;
      }

      // 4. Create learning outcomes
      let learningOutcomesCreated = 0;

      // Associate learning outcomes with the first module (or by moduleCode if available)
      const firstModuleId = moduleIdMap.values().next().value;

      if (firstModuleId && data.learningOutcomes.length > 0) {
        for (const outcomeData of data.learningOutcomes) {
          const moduleId = outcomeData.moduleCode 
            ? moduleIdMap.get(outcomeData.moduleCode) || firstModuleId
            : firstModuleId;

          const outcome = new LearningOutcome({
            moduleId,
            outcomeText: outcomeData.outcomeText,
            assessmentCriteria: outcomeData.assessmentCriteria || [],
            knowledgeSkillCompetency: outcomeData.knowledgeSkillCompetency,
            bloomLevel: outcomeData.bloomLevel,
          });

          await outcome.save({ session });
          learningOutcomesCreated++;
        }
      }

      // 5. Create assessments
      let assessmentsCreated = 0;

      for (const assessmentData of data.assessments) {
        const moduleId = moduleIdMap.get(assessmentData.moduleCode);
        if (!moduleId) {
          console.warn(`Module ${assessmentData.moduleCode} not found for assessment`);
          continue;
        }

        const assessment = new Assessment({
          moduleId,
          questionType: assessmentData.questionType,
          questionText: assessmentData.questionText,
          options: assessmentData.options || [],
          correctAnswer: assessmentData.correctAnswer || '',
          explanation: assessmentData.explanation || '',
          difficulty: assessmentData.difficulty,
        });

        await assessment.save({ session });
        assessmentsCreated++;
      }

      // 6. Store topic sources in knowledge base
      if (data.topicSources && data.topicSources.length > 0) {
        for (const source of data.topicSources) {
          const publicationDate = source.publicationDate 
            ? new Date(source.publicationDate) 
            : new Date();

          const kbEntry = new KnowledgeBase({
            content: source.topic,
            sourceUrl: source.sourceUrl || '',
            sourceType: source.sourceType || 'manual',
            publicationDate,
            domain: data.programOverview.industrySector || 'general',
            credibilityScore: source.credibilityScore || 50,
            metadata: {
              programId: program._id.toString(),
              topic: source.topic,
            },
            embedding: [], // Will be generated later by embedding service
          });

          await kbEntry.save({ session });
        }
      }

      return {
        programId,
        message: `Program "${data.programOverview.programName}" created successfully`,
        stats: {
          modulesCreated,
          learningOutcomesCreated,
          assessmentsCreated,
        },
      };
    });
  }

  /**
   * Get program by ID
   */
  async getProgramById(programId: string): Promise<IProgram | null> {
    try {
      const program = await Program.findById(programId);
      return program;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get program by ID (alias for consistency)
   */
  async getProgram(programId: string): Promise<IProgram | null> {
    return this.getProgramById(programId);
  }

  /**
   * Get program with all related data
   */
  async getProgramWithDetails(programId: string): Promise<any> {
    const program = await Program.findById(programId).lean();
    if (!program) {
      return null;
    }

    // Get modules ordered by sequence
    const modules = await Module.find({ programId: new mongoose.Types.ObjectId(programId) })
      .sort({ sequenceOrder: 1 })
      .lean();

    // Get learning outcomes and assessments for each module
    const modulesWithDetails = await Promise.all(
      modules.map(async (module) => {
        const [learningOutcomes, assessments] = await Promise.all([
          LearningOutcome.find({ moduleId: module._id }).lean(),
          Assessment.find({ moduleId: module._id }).lean(),
        ]);

        return {
          ...module,
          learningOutcomes,
          assessments,
        };
      })
    );

    return {
      ...program,
      modules: modulesWithDetails,
    };
  }

  /**
   * Update program status
   */
  async updateProgramStatus(
    programId: string,
    status: string
  ): Promise<void> {
    await Program.findByIdAndUpdate(
      programId,
      { status, updatedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Update program
   */
  async updateProgram(
    programId: string,
    updates: {
      program_name?: string;
      qualification_level?: string;
      qualification_type?: string;
      total_credits?: number;
      industry_sector?: string;
      status?: string;
    }
  ): Promise<IProgram | null> {
    const updateData: any = {};

    if (updates.program_name !== undefined) {
      updateData.programName = updates.program_name;
    }
    if (updates.qualification_level !== undefined) {
      updateData.qualificationLevel = updates.qualification_level;
    }
    if (updates.qualification_type !== undefined) {
      updateData.qualificationType = updates.qualification_type;
    }
    if (updates.total_credits !== undefined) {
      updateData.totalCredits = updates.total_credits;
    }
    if (updates.industry_sector !== undefined) {
      updateData.industrySector = updates.industry_sector;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (Object.keys(updateData).length === 0) {
      // No updates provided, return existing program
      return this.getProgramById(programId);
    }

    const program = await Program.findByIdAndUpdate(
      programId,
      updateData,
      { new: true }
    );

    return program;
  }

  /**
   * Delete program (cascade delete handled by middleware)
   */
  async deleteProgram(programId: string): Promise<void> {
    const programObjectId = new mongoose.Types.ObjectId(programId);
    
    // Delete related data first
    await Promise.all([
      Module.deleteMany({ programId: programObjectId }),
      LearningOutcome.deleteMany({ moduleId: { $in: await Module.find({ programId: programObjectId }).distinct('_id') } }),
      Assessment.deleteMany({ moduleId: { $in: await Module.find({ programId: programObjectId }).distinct('_id') } }),
    ]);

    // Delete program
    await Program.findByIdAndDelete(programId);
  }

  /**
   * List all programs
   */
  async listPrograms(filters?: {
    status?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<IProgram[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.createdBy) {
      query.createdBy = new mongoose.Types.ObjectId(filters.createdBy);
    }

    const programs = await Program.find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 100)
      .skip(filters?.offset || 0)
      .lean();

    return programs;
  }
}

export const programService = new ProgramService();
