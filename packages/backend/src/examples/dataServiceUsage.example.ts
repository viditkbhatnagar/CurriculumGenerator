/**
 * Data Service Usage Examples
 * 
 * This file demonstrates how to use the data service layer
 * which works with both mock data and real MongoDB.
 */

import {
  initializeDataService,
  shutdownDataService,
  getModel,
  isUsingMockData,
  dataServiceHealthCheck,
} from '../data';

/**
 * Example 1: Initialize and check health
 */
async function example1_InitializeAndHealthCheck() {
  console.log('\n=== Example 1: Initialize and Health Check ===\n');

  // Initialize data service (will use mock or real DB based on USE_MOCK_DATA env var)
  await initializeDataService();

  // Check if using mock data
  console.log(`Using mock data: ${isUsingMockData()}`);

  // Health check
  const health = await dataServiceHealthCheck();
  console.log('Health check:', health);
}

/**
 * Example 2: Query programs
 */
async function example2_QueryPrograms() {
  console.log('\n=== Example 2: Query Programs ===\n');

  const Program = getModel('Program');

  // Find all programs
  const allPrograms = await Program.find();
  console.log(`Found ${allPrograms.length} programs`);

  // Find programs by status
  const draftPrograms = await Program.find({ status: 'draft' });
  console.log(`Found ${draftPrograms.length} draft programs`);

  // Find one program
  const program = await Program.findOne({ status: 'draft' });
  if (program) {
    console.log('Program:', {
      id: program._id,
      name: program.programName,
      level: program.qualificationLevel,
      status: program.status,
    });
  }
}

/**
 * Example 3: Create a new program
 */
async function example3_CreateProgram() {
  console.log('\n=== Example 3: Create Program ===\n');

  const Program = getModel('Program');
  const User = getModel('User');

  // Get a user to be the creator
  const user = await User.findOne({ role: 'administrator' });
  if (!user) {
    console.log('No admin user found');
    return;
  }

  // Create new program
  const newProgram = await Program.create({
    programName: 'Master of Data Science',
    qualificationLevel: 'Level 9',
    qualificationType: 'Master Degree',
    totalCredits: 180,
    industrySector: 'Information Technology',
    status: 'draft',
    createdBy: user._id,
  });

  console.log('Created program:', {
    id: newProgram._id,
    name: newProgram.programName,
    level: newProgram.qualificationLevel,
  });
}

/**
 * Example 4: Query with relationships
 */
async function example4_QueryWithRelationships() {
  console.log('\n=== Example 4: Query with Relationships ===\n');

  const Program = getModel('Program');
  const Module = getModel('Module');
  const LearningOutcome = getModel('LearningOutcome');

  // Get a program
  const program = await Program.findOne({ status: 'draft' });
  if (!program) {
    console.log('No program found');
    return;
  }

  console.log(`Program: ${program.programName}`);

  // Get modules for this program
  const modules = await Module.find({ programId: program._id });
  console.log(`  Modules: ${modules.length}`);

  // Get learning outcomes for each module
  for (const module of modules) {
    const outcomes = await LearningOutcome.find({ moduleId: module._id });
    console.log(`    ${module.moduleCode} - ${module.moduleTitle}: ${outcomes.length} outcomes`);
  }
}

/**
 * Example 5: Update a program
 */
async function example5_UpdateProgram() {
  console.log('\n=== Example 5: Update Program ===\n');

  const Program = getModel('Program');

  // Find a program
  const program = await Program.findOne({ status: 'draft' });
  if (!program) {
    console.log('No draft program found');
    return;
  }

  console.log('Before update:', {
    id: program._id,
    status: program.status,
  });

  // Update the program
  const updated = await Program.findByIdAndUpdate(
    program._id,
    { status: 'submitted' },
    { new: true }
  );

  console.log('After update:', {
    id: updated._id,
    status: updated.status,
  });
}

/**
 * Example 6: Query assessments by difficulty
 */
async function example6_QueryAssessments() {
  console.log('\n=== Example 6: Query Assessments ===\n');

  const Assessment = getModel('Assessment');

  // Count assessments by difficulty
  const easyCount = await Assessment.countDocuments({ difficulty: 'easy' });
  const mediumCount = await Assessment.countDocuments({ difficulty: 'medium' });
  const hardCount = await Assessment.countDocuments({ difficulty: 'hard' });

  console.log('Assessments by difficulty:');
  console.log(`  Easy: ${easyCount}`);
  console.log(`  Medium: ${mediumCount}`);
  console.log(`  Hard: ${hardCount}`);

  // Get all MCQ questions
  const mcqQuestions = await Assessment.find({ questionType: 'mcq' });
  console.log(`\nMCQ Questions: ${mcqQuestions.length}`);
  mcqQuestions.forEach((q: any) => {
    console.log(`  - ${q.questionText.substring(0, 50)}...`);
  });
}

/**
 * Example 7: Query knowledge base
 */
async function example7_QueryKnowledgeBase() {
  console.log('\n=== Example 7: Query Knowledge Base ===\n');

  const KnowledgeBase = getModel('KnowledgeBase');

  // Get all knowledge base entries
  const entries = await KnowledgeBase.find();
  console.log(`Total knowledge base entries: ${entries.length}`);

  // Get entries by domain
  const csDomain = await KnowledgeBase.find({ domain: 'Computer Science' });
  console.log(`Computer Science entries: ${csDomain.length}`);

  // Get high credibility entries
  const highCredibility = await KnowledgeBase.find({
    credibilityScore: { $gte: 90 },
  });
  console.log(`High credibility entries (≥90): ${highCredibility.length}`);

  // Show sample entry
  if (entries.length > 0) {
    const sample = entries[0];
    console.log('\nSample entry:');
    console.log(`  Content: ${sample.content.substring(0, 100)}...`);
    console.log(`  Domain: ${sample.domain}`);
    console.log(`  Credibility: ${sample.credibilityScore}`);
    console.log(`  Source: ${sample.sourceType}`);
  }
}

/**
 * Example 8: Query generation jobs
 */
async function example8_QueryGenerationJobs() {
  console.log('\n=== Example 8: Query Generation Jobs ===\n');

  const GenerationJob = getModel('GenerationJob');

  // Get all jobs
  const allJobs = await GenerationJob.find();
  console.log(`Total generation jobs: ${allJobs.length}`);

  // Get jobs by status
  const completed = await GenerationJob.find({ status: 'completed' });
  const processing = await GenerationJob.find({ status: 'processing' });
  const failed = await GenerationJob.find({ status: 'failed' });

  console.log('Jobs by status:');
  console.log(`  Completed: ${completed.length}`);
  console.log(`  Processing: ${processing.length}`);
  console.log(`  Failed: ${failed.length}`);

  // Show completed job details
  if (completed.length > 0) {
    const job = completed[0];
    console.log('\nCompleted job:');
    console.log(`  ID: ${job._id}`);
    console.log(`  Progress: ${job.progress}%`);
    console.log(`  Started: ${job.startedAt}`);
    console.log(`  Completed: ${job.completedAt}`);
    if (job.intermediateResults) {
      console.log('  Results:', job.intermediateResults);
    }
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_InitializeAndHealthCheck();
    await example2_QueryPrograms();
    await example3_CreateProgram();
    await example4_QueryWithRelationships();
    await example5_UpdateProgram();
    await example6_QueryAssessments();
    await example7_QueryKnowledgeBase();
    await example8_QueryGenerationJobs();
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    await shutdownDataService();
  }
}

// Run if called directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_InitializeAndHealthCheck,
  example2_QueryPrograms,
  example3_CreateProgram,
  example4_QueryWithRelationships,
  example5_UpdateProgram,
  example6_QueryAssessments,
  example7_QueryKnowledgeBase,
  example8_QueryGenerationJobs,
};
