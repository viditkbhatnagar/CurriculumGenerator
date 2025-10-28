/**
 * Skill Book Generator Example
 * 
 * This example demonstrates how to use the Skill Book Generator service
 * to generate skill mappings and link them to learning outcomes.
 * 
 * Requirements covered:
 * - 4.1: Extract competency domains from uploaded program data
 * - 4.2: Generate skill mappings with activities, KPIs, and assessment criteria
 * - 4.3: Link skills to learning outcomes using semantic similarity
 * - 4.4: Generate measurable KPIs
 * - 4.5: Store skill mappings in database
 */

import { skillBookGenerator } from '../services/skillBookGenerator';
import { CompetencyDomain, Module } from '../types/excel';

async function exampleSkillBookGeneration() {
  // Example 1: Generate skill mappings from competency framework
  console.log('=== Example 1: Generate Skill Mappings ===\n');

  const competencyDomains: CompetencyDomain[] = [
    {
      domain: 'Technical Skills',
      description: 'Core technical competencies for data analysis',
      skills: [
        'Data Analysis and Interpretation',
        'Statistical Methods Application',
        'Data Visualization',
      ],
    },
    {
      domain: 'Soft Skills',
      description: 'Professional and interpersonal competencies',
      skills: ['Professional Communication', 'Team Collaboration', 'Problem Solving'],
    },
  ];

  const modules: Module[] = [
    {
      moduleCode: 'MOD001',
      moduleTitle: 'Introduction to Data Analytics',
      hours: 40,
      coreElective: 'Core',
      sequenceOrder: 1,
      units: [
        {
          unitTitle: 'Data Analysis Fundamentals',
          hours: 10,
          learningOutcomes: ['outcome-1', 'outcome-2'],
        },
        {
          unitTitle: 'Statistical Methods',
          hours: 15,
          learningOutcomes: ['outcome-3', 'outcome-4'],
        },
        {
          unitTitle: 'Data Visualization Techniques',
          hours: 15,
          learningOutcomes: ['outcome-5', 'outcome-6'],
        },
      ],
    },
    {
      moduleCode: 'MOD002',
      moduleTitle: 'Professional Practice',
      hours: 20,
      coreElective: 'Core',
      sequenceOrder: 2,
      units: [
        {
          unitTitle: 'Communication Skills',
          hours: 10,
          learningOutcomes: ['outcome-7', 'outcome-8'],
        },
        {
          unitTitle: 'Teamwork and Collaboration',
          hours: 10,
          learningOutcomes: ['outcome-9', 'outcome-10'],
        },
      ],
    },
  ];

  try {
    // Generate skill mappings
    const result = await skillBookGenerator.generateSkillMappings({
      programId: 'program-123',
      competencyDomains,
      modules,
    });

    console.log(`Generated ${result.skillMappings.length} skill mappings`);
    console.log('\nSample Skill Mapping:');
    console.log(JSON.stringify(result.skillMappings[0], null, 2));
  } catch (error) {
    console.error('Error generating skill mappings:', error);
  }

  // Example 2: Link skills to learning outcomes
  console.log('\n\n=== Example 2: Link Skills to Learning Outcomes ===\n');

  const skillMappings = [
    {
      skillId: 'skill-1',
      skillName: 'Data Analysis and Interpretation',
      domain: 'Technical Skills',
      activities: [
        {
          name: 'Business Intelligence Dashboard Creation',
          description:
            'Design and build interactive dashboards using real business data to identify trends and insights',
          unitLink: 'MOD001: Data Visualization Techniques',
          durationHours: 8,
          assessmentType: 'Practical Project',
          resources: ['Power BI', 'Sample datasets', 'Dashboard design guidelines'],
        },
      ],
      kpis: [
        {
          name: 'Dashboard Completion Rate',
          description: 'Number of functional dashboards created',
          measurementCriteria: 'Create dashboards that meet all requirements',
          threshold: 3,
          unit: 'dashboards',
        },
      ],
      linkedOutcomes: [],
      assessmentCriteria: [
        'Dashboard includes all required visualizations',
        'Data is accurately represented',
      ],
    },
  ];

  const learningOutcomes = [
    {
      id: 'outcome-1',
      outcomeText: 'Analyze complex datasets to extract meaningful insights and trends',
      moduleId: 'MOD001',
    },
    {
      id: 'outcome-2',
      outcomeText: 'Apply statistical methods to interpret business data',
      moduleId: 'MOD001',
    },
    {
      id: 'outcome-5',
      outcomeText: 'Create effective data visualizations using industry-standard tools',
      moduleId: 'MOD001',
    },
    {
      id: 'outcome-6',
      outcomeText: 'Design interactive dashboards for business intelligence',
      moduleId: 'MOD001',
    },
  ];

  try {
    const linkedSkills = await skillBookGenerator.linkToLearningOutcomes(
      skillMappings,
      learningOutcomes
    );

    console.log('Successfully linked skills to learning outcomes');
    console.log(`\nSkill: ${linkedSkills[0].skillName}`);
    console.log(`Linked to ${linkedSkills[0].linkedOutcomes.length} learning outcomes:`);
    linkedSkills[0].linkedOutcomes.forEach((outcomeId) => {
      const outcome = learningOutcomes.find((o) => o.id === outcomeId);
      console.log(`  - ${outcomeId}: ${outcome?.outcomeText}`);
    });
  } catch (error) {
    console.error('Error linking skills to outcomes:', error);
  }

  // Example 3: Store skill mappings in database
  console.log('\n\n=== Example 3: Store Skill Mappings ===\n');

  try {
    // Note: This requires a database connection
    // await skillBookGenerator.storeSkillMappings('program-123', linkedSkills);
    console.log('Skill mappings would be stored in database with unique identifiers');
    console.log('Each skill mapping includes:');
    console.log('  - Unique skill ID (UUID)');
    console.log('  - Program ID reference');
    console.log('  - Skill name and domain');
    console.log('  - Practical activities (JSON)');
    console.log('  - Measurable KPIs (JSON)');
    console.log('  - Linked learning outcome IDs (array)');
    console.log('  - Assessment criteria (JSON)');
  } catch (error) {
    console.error('Error storing skill mappings:', error);
  }

  // Example 4: Retrieve skill mappings from database
  console.log('\n\n=== Example 4: Retrieve Skill Mappings ===\n');

  try {
    // Note: This requires a database connection
    // const retrievedSkills = await skillBookGenerator.getSkillMappings('program-123');
    console.log('Skill mappings can be retrieved by program ID');
    console.log('Results are ordered by domain and skill name');
  } catch (error) {
    console.error('Error retrieving skill mappings:', error);
  }
}

// Run the example
if (require.main === module) {
  exampleSkillBookGeneration()
    .then(() => {
      console.log('\n\nExample completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { exampleSkillBookGeneration };
