/**
 * Synthetic Data Store
 * 
 * In-memory data store that mimics MongoDB models for development and testing.
 * This allows the app to function without a database connection.
 */

import { ObjectId } from 'mongodb';

// Helper to generate ObjectId-like strings
export const generateId = () => new ObjectId().toString();

// In-memory data stores
export const syntheticData = {
  programs: [] as any[],
  modules: [] as any[],
  learningOutcomes: [] as any[],
  knowledgeBase: [] as any[],
  assessments: [] as any[],
  skillMappings: [] as any[],
  generationJobs: [] as any[],
  users: [] as any[],
  auditLogs: [] as any[],
  fileUploads: [] as any[],
};

// Initialize with sample data
export function initializeSyntheticData() {
  // Clear existing data
  Object.keys(syntheticData).forEach(key => {
    (syntheticData as any)[key] = [];
  });

  // Create sample users
  const adminUser = {
    _id: generateId(),
    email: 'admin@example.com',
    role: 'administrator',
    authProviderId: 'auth0|admin123',
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      organization: 'Test University',
    },
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const smeUser = {
    _id: generateId(),
    email: 'sme@example.com',
    role: 'sme',
    authProviderId: 'auth0|sme123',
    profile: {
      firstName: 'Subject Matter',
      lastName: 'Expert',
      organization: 'Test University',
    },
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  syntheticData.users.push(adminUser, smeUser);

  // Create sample program
  const program = {
    _id: generateId(),
    programName: 'Bachelor of Computer Science',
    qualificationLevel: 'Level 8',
    qualificationType: 'Bachelor Degree',
    totalCredits: 120,
    industrySector: 'Information Technology',
    status: 'draft',
    createdBy: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  syntheticData.programs.push(program);

  // Create sample modules
  const modules = [
    {
      _id: generateId(),
      programId: program._id,
      moduleCode: 'CS101',
      moduleTitle: 'Introduction to Programming',
      hours: 120,
      moduleAim: 'Introduce fundamental programming concepts and problem-solving techniques',
      coreElective: 'core',
      sequenceOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      programId: program._id,
      moduleCode: 'CS102',
      moduleTitle: 'Data Structures and Algorithms',
      hours: 120,
      moduleAim: 'Teach essential data structures and algorithmic thinking',
      coreElective: 'core',
      sequenceOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      programId: program._id,
      moduleCode: 'CS201',
      moduleTitle: 'Web Development',
      hours: 90,
      moduleAim: 'Develop skills in modern web technologies',
      coreElective: 'elective',
      sequenceOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  syntheticData.modules.push(...modules);

  // Create sample learning outcomes
  const learningOutcomes = [
    {
      _id: generateId(),
      moduleId: modules[0]._id,
      outcomeText: 'Write basic programs using variables, loops, and conditionals',
      assessmentCriteria: [
        'Correctly use variables and data types',
        'Implement control flow structures',
        'Debug simple programs',
      ],
      knowledgeSkillCompetency: 'skill',
      bloomLevel: 'Apply',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      moduleId: modules[0]._id,
      outcomeText: 'Understand fundamental programming concepts',
      assessmentCriteria: [
        'Explain programming paradigms',
        'Describe algorithm complexity',
      ],
      knowledgeSkillCompetency: 'knowledge',
      bloomLevel: 'Understand',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      moduleId: modules[1]._id,
      outcomeText: 'Implement common data structures',
      assessmentCriteria: [
        'Create linked lists, stacks, and queues',
        'Implement tree and graph structures',
        'Analyze time and space complexity',
      ],
      knowledgeSkillCompetency: 'skill',
      bloomLevel: 'Apply',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  syntheticData.learningOutcomes.push(...learningOutcomes);

  // Create sample assessments
  const assessments = [
    {
      _id: generateId(),
      moduleId: modules[0]._id,
      questionType: 'mcq',
      questionText: 'What is the output of: print(5 + 3 * 2)?',
      options: ['10', '11', '16', '13'],
      correctAnswer: '11',
      explanation: 'Multiplication has higher precedence than addition, so 3*2=6, then 5+6=11',
      difficulty: 'easy',
      learningOutcomeId: learningOutcomes[0]._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      moduleId: modules[0]._id,
      questionType: 'essay',
      questionText: 'Explain the difference between compiled and interpreted languages',
      difficulty: 'medium',
      learningOutcomeId: learningOutcomes[1]._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      moduleId: modules[1]._id,
      questionType: 'practical',
      questionText: 'Implement a function to reverse a linked list',
      difficulty: 'hard',
      learningOutcomeId: learningOutcomes[2]._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  syntheticData.assessments.push(...assessments);

  // Create sample skill mapping
  const skillMapping = {
    _id: generateId(),
    programId: program._id,
    skillName: 'Problem Solving',
    domain: 'Computer Science',
    activities: [
      {
        name: 'Algorithm Design Workshop',
        description: 'Hands-on workshop for designing efficient algorithms',
        unitLink: modules[1]._id,
        durationHours: 20,
        assessmentType: 'Practical Assignment',
        resources: ['Algorithm textbook', 'Online coding platform'],
      },
    ],
    kpis: [
      {
        name: 'Problem Solving Speed',
        metric: 'Time to solve standard problems',
        threshold: '< 30 minutes',
      },
    ],
    linkedOutcomes: [learningOutcomes[2]._id],
    assessmentCriteria: ['Solve problems efficiently', 'Write clean code'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  syntheticData.skillMappings.push(skillMapping);

  // Create sample knowledge base entries
  const knowledgeBaseEntries = [
    {
      _id: generateId(),
      content: 'Python is a high-level, interpreted programming language known for its simplicity and readability. It supports multiple programming paradigms including procedural, object-oriented, and functional programming.',
      sourceUrl: 'https://docs.python.org',
      sourceType: 'url',
      publicationDate: new Date('2023-01-01'),
      domain: 'Computer Science',
      credibilityScore: 95,
      metadata: {
        title: 'Python Programming Language',
        author: 'Python Software Foundation',
        tags: ['python', 'programming', 'language'],
        chunkIndex: 0,
        totalChunks: 1,
      },
      embedding: Array(1536).fill(0).map(() => Math.random()), // Mock embedding
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: generateId(),
      content: 'Data structures are specialized formats for organizing, processing, and storing data. Common data structures include arrays, linked lists, stacks, queues, trees, and graphs. Each has specific use cases and performance characteristics.',
      sourceType: 'manual',
      domain: 'Computer Science',
      credibilityScore: 90,
      metadata: {
        title: 'Data Structures Overview',
        tags: ['data-structures', 'algorithms'],
        chunkIndex: 0,
        totalChunks: 1,
      },
      embedding: Array(1536).fill(0).map(() => Math.random()), // Mock embedding
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  syntheticData.knowledgeBase.push(...knowledgeBaseEntries);

  // Create sample generation job
  const generationJob = {
    _id: generateId(),
    programId: program._id,
    status: 'completed',
    progress: 100,
    startedAt: new Date(Date.now() - 300000), // 5 minutes ago
    completedAt: new Date(),
    intermediateResults: {
      modulesGenerated: 3,
      outcomesGenerated: 3,
      assessmentsGenerated: 3,
    },
    createdAt: new Date(Date.now() - 300000),
    updatedAt: new Date(),
  };

  syntheticData.generationJobs.push(generationJob);

  // Create sample file upload
  const fileUpload = {
    _id: generateId(),
    programId: program._id,
    filename: 'curriculum-template.pdf',
    originalName: 'Curriculum Template.pdf',
    mimeType: 'application/pdf',
    size: 1024000, // 1MB
    storagePath: '/uploads/curriculum-template.pdf',
    storageType: 'local',
    uploadedBy: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  syntheticData.fileUploads.push(fileUpload);

  // Create sample audit log
  const auditLog = {
    _id: generateId(),
    userId: adminUser._id,
    action: 'CREATE_PROGRAM',
    resourceType: 'Program',
    resourceId: program._id,
    details: {
      programName: program.programName,
      status: program.status,
    },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
  };

  syntheticData.auditLogs.push(auditLog);

  console.log('✅ Synthetic data initialized');
  console.log(`  Users: ${syntheticData.users.length}`);
  console.log(`  Programs: ${syntheticData.programs.length}`);
  console.log(`  Modules: ${syntheticData.modules.length}`);
  console.log(`  Learning Outcomes: ${syntheticData.learningOutcomes.length}`);
  console.log(`  Assessments: ${syntheticData.assessments.length}`);
  console.log(`  Knowledge Base: ${syntheticData.knowledgeBase.length}`);
  console.log(`  Skill Mappings: ${syntheticData.skillMappings.length}`);
  console.log(`  Generation Jobs: ${syntheticData.generationJobs.length}`);
  console.log(`  File Uploads: ${syntheticData.fileUploads.length}`);
  console.log(`  Audit Logs: ${syntheticData.auditLogs.length}`);
}

// Reset data to initial state
export function resetSyntheticData() {
  initializeSyntheticData();
}

// Export data for inspection
export function exportSyntheticData() {
  return JSON.parse(JSON.stringify(syntheticData));
}
