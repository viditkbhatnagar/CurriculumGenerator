/**
 * Clean Migration Script: Drop old collections and create fresh
 * WARNING: This will delete all data in the new workflow collections!
 */

import { db } from '../db';
import { loggingService } from '../services/loggingService';
import mongoose from 'mongoose';

async function cleanMigration() {
  try {
    console.log('🧹 Starting CLEAN migration (will drop existing collections)...\n');

    // Connect to database
    await db.connect();
    loggingService.info('✅ Database connected');

    const dbConnection = mongoose.connection.db;

    // Collections to drop
    const newCollections = [
      'course_prompts',
      'curriculum_projects',
      'preliminary_curriculum_packages',
      'resource_cost_evaluations',
      'full_curriculum_packages',
      'curriculum_reviews',
      // Also drop the exact names from models
      'courseprompts',
      'curriculumprojects',
      'preliminarycurriculumpackages',
      'resourcecostevaluations',
      'fullcurriculumpackages',
      'curriculumreviews',
    ];

    // Get existing collections
    const collections = await dbConnection.listCollections().toArray();
    const existingNames = collections.map((c) => c.name);

    // Drop collections if they exist
    console.log('\n📦 Dropping existing collections...');
    for (const collectionName of newCollections) {
      if (existingNames.includes(collectionName)) {
        await dbConnection.dropCollection(collectionName);
        console.log(`   ❌ Dropped: ${collectionName}`);
      }
    }

    console.log('\n✅ Old collections dropped\n');
    console.log('🔄 Now importing models to create fresh collections...\n');

    // Import models (this will trigger schema creation)
    const { CoursePrompt } = await import('../models/CoursePrompt');
    const { CurriculumProject } = await import('../models/CurriculumProject');
    const { PreliminaryCurriculumPackage } = await import('../models/PreliminaryCurriculumPackage');
    const { ResourceCostEvaluation } = await import('../models/ResourceCostEvaluation');
    const { FullCurriculumPackage } = await import('../models/FullCurriculumPackage');
    const { CurriculumReview } = await import('../models/CurriculumReview');

    // Create collections
    console.log('📦 Creating fresh collections...');
    await dbConnection.createCollection('course_prompts');
    console.log('   ✅ course_prompts');

    await dbConnection.createCollection('curriculumprojects');
    console.log('   ✅ curriculumprojects');

    await dbConnection.createCollection('preliminarycurriculumpackages');
    console.log('   ✅ preliminarycurriculumpackages');

    await dbConnection.createCollection('resourcecostevaluations');
    console.log('   ✅ resourcecostevaluations');

    await dbConnection.createCollection('fullcurriculumpackages');
    console.log('   ✅ fullcurriculumpackages');

    await dbConnection.createCollection('curriculumreviews');
    console.log('   ✅ curriculumreviews');

    // Create indexes
    console.log('\n🔧 Creating indexes...');
    await CoursePrompt.createIndexes();
    console.log('   ✅ CoursePrompt indexes');

    await CurriculumProject.createIndexes();
    console.log('   ✅ CurriculumProject indexes');

    await PreliminaryCurriculumPackage.createIndexes();
    console.log('   ✅ PreliminaryCurriculumPackage indexes');

    await ResourceCostEvaluation.createIndexes();
    console.log('   ✅ ResourceCostEvaluation indexes');

    await FullCurriculumPackage.createIndexes();
    console.log('   ✅ FullCurriculumPackage indexes');

    await CurriculumReview.createIndexes();
    console.log('   ✅ CurriculumReview indexes');

    // Verify
    console.log('\n🔍 Verifying collections...');
    const updatedCollections = await dbConnection.listCollections().toArray();
    const updatedNames = updatedCollections.map((c) => c.name);

    const requiredCollections = [
      'course_prompts',
      'curriculumprojects',
      'preliminarycurriculumpackages',
      'resourcecostevaluations',
      'fullcurriculumpackages',
      'curriculumreviews',
    ];

    for (const collectionName of requiredCollections) {
      if (updatedNames.includes(collectionName)) {
        const count = await dbConnection.collection(collectionName).countDocuments();
        const indexes = await dbConnection.collection(collectionName).indexes();
        console.log(`   ✅ ${collectionName}: ${count} documents, ${indexes.length} indexes`);
      }
    }

    console.log('\n🎉 Clean migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Run: npm run seed:prompts');
    console.log('   2. Start server: npm run dev');
    console.log('   3. Navigate to: http://localhost:3000/prompts\n');

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    loggingService.error('Clean migration failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  cleanMigration();
}

export { cleanMigration };
