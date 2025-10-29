/**
 * Migration Script: Create Collections for New 5-Stage Workflow
 * Run this to create indexes and initial setup for new workflow models
 */

import { db } from '../db';
import { CoursePrompt } from '../models/CoursePrompt';
import { CurriculumProject } from '../models/CurriculumProject';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { ResourceCostEvaluation } from '../models/ResourceCostEvaluation';
import { FullCurriculumPackage } from '../models/FullCurriculumPackage';
import { CurriculumReview } from '../models/CurriculumReview';
import { loggingService } from '../services/loggingService';
import mongoose from 'mongoose';

async function migrateToNewWorkflow() {
  try {
    loggingService.info('🚀 Starting migration to new 5-stage workflow...');

    // Connect to database
    await db.connect();
    loggingService.info('✅ Database connected');

    const dbConnection = mongoose.connection.db;

    // 1. Create collections if they don't exist
    loggingService.info('Creating collections...');

    const collections = await dbConnection.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    const newCollections = [
      'course_prompts',
      'curriculum_projects',
      'preliminary_curriculum_packages',
      'resource_cost_evaluations',
      'full_curriculum_packages',
      'curriculum_reviews',
    ];

    for (const collectionName of newCollections) {
      if (!collectionNames.includes(collectionName)) {
        await dbConnection.createCollection(collectionName);
        loggingService.info(`✅ Created collection: ${collectionName}`);
      } else {
        loggingService.info(`✓ Collection already exists: ${collectionName}`);
      }
    }

    // 2. Create indexes
    loggingService.info('Creating indexes...');

    await CoursePrompt.createIndexes();
    loggingService.info('✅ CoursePrompt indexes created');

    await CurriculumProject.createIndexes();
    loggingService.info('✅ CurriculumProject indexes created');

    await PreliminaryCurriculumPackage.createIndexes();
    loggingService.info('✅ PreliminaryCurriculumPackage indexes created');

    await ResourceCostEvaluation.createIndexes();
    loggingService.info('✅ ResourceCostEvaluation indexes created');

    await FullCurriculumPackage.createIndexes();
    loggingService.info('✅ FullCurriculumPackage indexes created');

    await CurriculumReview.createIndexes();
    loggingService.info('✅ CurriculumReview indexes created');

    // 3. Verify collections
    loggingService.info('Verifying collections...');
    const updatedCollections = await dbConnection.listCollections().toArray();
    const updatedCollectionNames = updatedCollections.map((c) => c.name);

    for (const collectionName of newCollections) {
      if (updatedCollectionNames.includes(collectionName)) {
        const stats = await dbConnection.collection(collectionName).stats();
        loggingService.info(
          `✓ ${collectionName}: ${stats.count} documents, ${stats.storageSize} bytes`
        );
      }
    }

    loggingService.info('🎉 Migration completed successfully!');
    loggingService.info('');
    loggingService.info('Next steps:');
    loggingService.info('1. Run seed script to populate initial prompts: npm run seed:prompts');
    loggingService.info('2. Start the server: npm run dev');
    loggingService.info('3. Access new API at: http://localhost:4000/api/v2');

    // Disconnect
    await db.disconnect();
    process.exit(0);
  } catch (error) {
    loggingService.error('❌ Migration failed', { error });
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  migrateToNewWorkflow();
}

export { migrateToNewWorkflow };
