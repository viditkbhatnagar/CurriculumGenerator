/**
 * Generate Step 10 in batches - one module at a time
 * This prevents timeouts and allows resuming from failures
 * Usage: npx ts-node scripts/generate-step10-batch.ts <workflowId>
 */

import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../packages/backend/src/models/CurriculumWorkflow.js';

const WORKFLOW_ID = process.argv[2] || '693fcaeb9460376df326dd2a';

async function generateStep10Batch() {
  try {
    // Connect to MongoDB with long timeouts
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://159.143.85.51:27017/curriculum_generator';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 7200000, // 2 hours
      maxPoolSize: 10,
    });

    console.log('✅ Connected to MongoDB\n');

    // Get workflow
    const workflow = await CurriculumWorkflow.findById(WORKFLOW_ID);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    console.log(`📚 Workflow: ${workflow.projectName}`);
    console.log(`📊 Current status:`);
    console.log(`   - Modules completed: ${workflow.step10?.moduleLessonPlans?.length || 0}/8`);
    console.log(`   - Total lessons: ${workflow.step10?.summary?.totalLessons || 0}`);
    console.log(`   - Contact hours: ${workflow.step10?.summary?.totalContactHours || 0}\n`);

    const completedModules = workflow.step10?.moduleLessonPlans?.length || 0;
    const totalModules = workflow.step4?.modules?.length || 8;

    if (completedModules >= totalModules) {
      console.log('✅ All modules already generated!');
      process.exit(0);
    }

    console.log(`🚀 Generating remaining ${totalModules - completedModules} modules...`);
    console.log(`⏱️  Estimated time: ${(totalModules - completedModules) * 15} minutes\n`);

    // Import services
    const { LessonPlanService } = await import(
      '../packages/backend/src/services/lessonPlanService.js'
    );
    const { workflowService } = await import('../packages/backend/src/services/workflowService.js');

    // Build context
    const context = (workflowService as any).buildWorkflowContext(workflow);

    // Generate remaining modules one by one
    for (let i = completedModules; i < totalModules; i++) {
      const module = context.modules[i];
      console.log(`\n📚 Processing module ${i + 1}/${totalModules}: ${module.title}`);
      console.log(`   Contact hours: ${module.contactHours}h`);

      const startTime = Date.now();

      try {
        // Generate lesson plans for this module only
        const lessonPlanService = new LessonPlanService();
        const moduleLessonPlan = await lessonPlanService.generateModuleLessonPlans(module, context);

        // Add to workflow
        if (!workflow.step10) {
          workflow.step10 = {
            moduleLessonPlans: [],
            validation: {
              allModulesHaveLessonPlans: false,
              allLessonDurationsValid: false,
              totalHoursMatch: false,
              allMLOsCovered: false,
              caseStudiesIntegrated: false,
              assessmentsIntegrated: false,
            },
            summary: {
              totalLessons: 0,
              totalContactHours: 0,
              averageLessonDuration: 0,
              caseStudiesIncluded: 0,
              formativeChecksIncluded: 0,
            },
            generatedAt: new Date(),
          };
        }

        workflow.step10!.moduleLessonPlans.push(moduleLessonPlan);

        // Update summary
        const allLessons = workflow.step10!.moduleLessonPlans.flatMap((m) => m.lessons);
        workflow.step10!.summary = {
          totalLessons: allLessons.length,
          totalContactHours: workflow.step10!.moduleLessonPlans.reduce(
            (sum, m) => sum + m.totalContactHours,
            0
          ),
          averageLessonDuration:
            allLessons.length > 0
              ? allLessons.reduce((sum, l) => sum + l.duration, 0) / allLessons.length
              : 0,
          caseStudiesIncluded: allLessons.filter((l) => l.caseStudyActivity).length,
          formativeChecksIncluded: allLessons.reduce(
            (sum, l) => sum + (l.formativeChecks?.length || 0),
            0
          ),
        };

        // Save to database
        workflow.markModified('step10');
        await workflow.save();

        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`   ✅ Module ${i + 1} complete (${duration}s)`);
        console.log(
          `   📊 Progress: ${workflow.step10!.moduleLessonPlans.length}/${totalModules} modules, ${workflow.step10!.summary.totalLessons} lessons, ${workflow.step10!.summary.totalContactHours}h`
        );
      } catch (error) {
        console.error(`   ❌ Error generating module ${i + 1}:`, error);
        console.log(`   💾 Progress saved. You can resume from module ${i + 1}`);
        process.exit(1);
      }
    }

    // Mark Step 10 as complete
    workflow.currentStep = 10;
    workflow.status = 'step10_complete';
    await workflow.save();

    console.log('\n✅ Step 10 generation complete!');
    console.log(`📊 Final stats:`);
    console.log(`   - Total modules: ${workflow.step10!.moduleLessonPlans.length}`);
    console.log(`   - Total lessons: ${workflow.step10!.summary.totalLessons}`);
    console.log(`   - Contact hours: ${workflow.step10!.summary.totalContactHours}h`);
    console.log('\n📥 You can now download the Word document with all 10 steps.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateStep10Batch();
