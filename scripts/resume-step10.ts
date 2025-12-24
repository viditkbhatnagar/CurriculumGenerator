/**
 * Resume Step 10 generation from where it left off
 * Usage: npx ts-node scripts/resume-step10.ts <workflowId>
 */

import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../packages/backend/src/models/CurriculumWorkflow';
import { workflowService } from '../packages/backend/src/services/workflowService';

const WORKFLOW_ID = process.argv[2] || '693fcaeb9460376df326dd2a';

async function resumeStep10() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://159.143.85.51:27017/curriculum_generator';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 3600000, // 1 hour socket timeout
      maxPoolSize: 10,
    });

    console.log('✅ Connected to MongoDB');

    // Get workflow
    const workflow = await CurriculumWorkflow.findById(WORKFLOW_ID);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    console.log(`📚 Workflow: ${workflow.projectName}`);
    console.log(`📊 Current Step 10 status:`);
    console.log(`   - Modules completed: ${workflow.step10?.moduleLessonPlans?.length || 0}/8`);
    console.log(`   - Total lessons: ${workflow.step10?.summary?.totalLessons || 0}`);
    console.log(`   - Contact hours: ${workflow.step10?.summary?.totalContactHours || 0}`);

    // Check if already complete
    if (workflow.step10?.moduleLessonPlans?.length >= 8) {
      console.log('✅ Step 10 already complete!');
      process.exit(0);
    }

    console.log('\n🚀 Resuming Step 10 generation...');
    console.log('⏱️  This will take 1-2 hours. Please be patient.\n');

    // Resume generation
    await workflowService.processStep10(WORKFLOW_ID);

    console.log('\n✅ Step 10 generation complete!');
    console.log('📥 You can now download the Word document with all 10 steps.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resumeStep10();
