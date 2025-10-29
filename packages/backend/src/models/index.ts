// Export all Mongoose models

// Old workflow models (to be deprecated)
export { Program, IProgram } from './Program';
export { Module, IModule } from './Module';
export { LearningOutcome, ILearningOutcome } from './LearningOutcome';
export { Assessment, IAssessment } from './Assessment';
export { SkillMapping, ISkillMapping } from './SkillMapping';
export { GenerationJob, IGenerationJob } from './GenerationJob';

// Shared models
export { KnowledgeBase, IKnowledgeBase } from './KnowledgeBase';
export { User, IUser } from './User';
export { AuditLog, IAuditLog } from './AuditLog';
export { FileUpload, IFileUpload } from './FileUpload';

// New 5-stage workflow models
export { CoursePrompt, ICoursePrompt } from './CoursePrompt';
export { CurriculumProject, ICurriculumProject } from './CurriculumProject';
export {
  PreliminaryCurriculumPackage,
  IPreliminaryCurriculumPackage,
} from './PreliminaryCurriculumPackage';
export { ResourceCostEvaluation, IResourceCostEvaluation } from './ResourceCostEvaluation';
export { FullCurriculumPackage, IFullCurriculumPackage } from './FullCurriculumPackage';
export { CurriculumReview, ICurriculumReview } from './CurriculumReview';
