/**
 * Data Service
 * 
 * Unified interface for data access that can switch between:
 * - Synthetic/Mock data (for development/testing)
 * - Real MongoDB (for production)
 */

import config from '../config';
import { mockRepositories } from './mockRepository';
import { initializeSyntheticData, resetSyntheticData } from './syntheticData';

// Import real models (will be used when USE_MOCK_DATA=false)
import * as models from '../models';

// Determine if we should use mock data
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || process.env.USE_MOCK_DATA === '1';

/**
 * Data Service Configuration
 */
export const dataServiceConfig = {
  useMockData: USE_MOCK_DATA,
  initialized: false,
};

/**
 * Initialize data service
 */
export async function initializeDataService() {
  if (dataServiceConfig.initialized) {
    console.log('⚠️  Data service already initialized');
    return;
  }

  if (dataServiceConfig.useMockData) {
    console.log('🔧 Using MOCK DATA (synthetic in-memory data)');
    initializeSyntheticData();
  } else {
    console.log('🔌 Using REAL DATABASE (MongoDB)');
    const { mongodb } = await import('../db/mongodb');
    await mongodb.connect();
  }

  dataServiceConfig.initialized = true;
  console.log('✅ Data service initialized');
}

/**
 * Reset data service (useful for testing)
 */
export async function resetDataService() {
  if (dataServiceConfig.useMockData) {
    console.log('🔄 Resetting synthetic data...');
    resetSyntheticData();
  } else {
    console.log('⚠️  Cannot reset real database data');
  }
}

/**
 * Shutdown data service
 */
export async function shutdownDataService() {
  if (!dataServiceConfig.useMockData) {
    const { mongodb } = await import('../db/mongodb');
    await mongodb.disconnect();
  }
  dataServiceConfig.initialized = false;
  console.log('👋 Data service shut down');
}

/**
 * Get repository/model for a collection
 * Returns mock repository if USE_MOCK_DATA=true, otherwise returns Mongoose model
 */
export function getModel(modelName: string): any {
  if (dataServiceConfig.useMockData) {
    // Return mock repository
    const mockRepo = (mockRepositories as any)[modelName];
    if (!mockRepo) {
      throw new Error(`Mock repository not found for: ${modelName}`);
    }
    return mockRepo;
  } else {
    // Return real Mongoose model
    const model = (models as any)[modelName];
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }
    return model;
  }
}

/**
 * Convenience exports for all models
 */
export const Program = () => getModel('Program');
export const Module = () => getModel('Module');
export const LearningOutcome = () => getModel('LearningOutcome');
export const KnowledgeBase = () => getModel('KnowledgeBase');
export const Assessment = () => getModel('Assessment');
export const SkillMapping = () => getModel('SkillMapping');
export const GenerationJob = () => getModel('GenerationJob');
export const User = () => getModel('User');
export const AuditLog = () => getModel('AuditLog');
export const FileUpload = () => getModel('FileUpload');

/**
 * Health check for data service
 */
export async function dataServiceHealthCheck(): Promise<{
  healthy: boolean;
  mode: 'mock' | 'database';
  details?: any;
}> {
  if (dataServiceConfig.useMockData) {
    return {
      healthy: true,
      mode: 'mock',
      details: {
        message: 'Using synthetic in-memory data',
      },
    };
  } else {
    try {
      const { mongodb } = await import('../db/mongodb');
      const isHealthy = await mongodb.healthCheck();
      return {
        healthy: isHealthy,
        mode: 'database',
        details: mongodb.getStats(),
      };
    } catch (error) {
      return {
        healthy: false,
        mode: 'database',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

/**
 * Get current data mode
 */
export function getDataMode(): 'mock' | 'database' {
  return dataServiceConfig.useMockData ? 'mock' : 'database';
}

/**
 * Check if using mock data
 */
export function isUsingMockData(): boolean {
  return dataServiceConfig.useMockData;
}

export default {
  initialize: initializeDataService,
  reset: resetDataService,
  shutdown: shutdownDataService,
  healthCheck: dataServiceHealthCheck,
  getModel,
  getMode: getDataMode,
  isUsingMockData,
};
