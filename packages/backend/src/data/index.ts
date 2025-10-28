/**
 * Data Layer
 * 
 * Exports unified data access interface
 */

export {
  initializeDataService,
  resetDataService,
  shutdownDataService,
  dataServiceHealthCheck,
  getModel,
  getDataMode,
  isUsingMockData,
  dataServiceConfig,
  Program,
  Module,
  LearningOutcome,
  KnowledgeBase,
  Assessment,
  SkillMapping,
  GenerationJob,
  User,
  AuditLog,
  FileUpload,
} from './dataService';

export { syntheticData, generateId, initializeSyntheticData, resetSyntheticData } from './syntheticData';
export { mockRepositories, getRepository } from './mockRepository';
