/**
 * Content Generation Service Examples
 * Demonstrates how to use the content generation service for different content types
 */

import { Pool } from 'pg';
import { ContentGenerationService } from '../services/contentGenerationService';
import config from '../config';

// Initialize database connection
const db = new Pool({
  connectionString: config.database.url,
});

const contentGenService = new ContentGenerationService(db);

/**
 * Example 1: Generate Program Overview
 */
async function generateProgramOverview() {
  console.log('Generating Program Overview...\n');

  try {
    const result = await contentGenService.generateContent({
      templateName: 'program_overview',
      templateParams: {
        programName: 'Advanced Data Analytics Professional Certificate',
        qualificationLevel: 'Level 7',
        industryContext: 'Business Intelligence and Data Science',
        targetAudience: 'Mid-career professionals seeking to transition into data analytics roles',
      },
      retrievalQuery: 'data analytics business intelligence professional certification requirements industry trends',
      retrievalOptions: {
        maxSources: 8,
        minSimilarity: 0.75,
        domains: ['business-intelligence', 'data-science'],
      },
      llmOptions: {
        temperature: 0.7,
        maxTokens: 2500,
      },
    });

    console.log('Generated Content:');
    console.log(result.content);
    console.log('\n---\n');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Sources Used: ${result.usedSources.length}`);
    console.log(`Citations: ${result.citations.length}`);
  } catch (error) {
    console.error('Error generating program overview:', error);
  }
}

/**
 * Example 2: Generate Unit Content with Streaming
 */
async function generateUnitContentStreaming() {
  console.log('Generating Unit Content with Streaming...\n');

  try {
    const result = await contentGenService.generateContentStream(
      {
        templateName: 'unit_content',
        templateParams: {
          unitTitle: 'Introduction to Data Visualization',
          unitCode: 'DA101',
          moduleContext: 'Foundational data analytics skills',
          hours: 20,
          learningOutcomes: [
            'Analyze data sets to identify patterns and trends',
            'Create effective visualizations using industry-standard tools',
            'Evaluate visualization choices for different data types',
          ],
        },
        retrievalQuery: 'data visualization techniques tools best practices tableau power bi',
        retrievalOptions: {
          maxSources: 10,
          minSimilarity: 0.75,
        },
        llmOptions: {
          temperature: 0.7,
          maxTokens: 3000,
        },
      },
      (chunk) => {
        if (!chunk.done) {
          process.stdout.write(chunk.content);
        } else {
          console.log('\n\n[Streaming Complete]');
        }
      }
    );

    console.log('\n---\n');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Sources Used: ${result.usedSources.length}`);
  } catch (error) {
    console.error('Error generating unit content:', error);
  }
}

/**
 * Example 3: Generate Assessment Questions
 */
async function generateAssessmentQuestions() {
  console.log('Generating Assessment Questions...\n');

  try {
    const result = await contentGenService.generateContent({
      templateName: 'assessment',
      templateParams: {
        moduleTitle: 'Data Visualization Fundamentals',
        learningOutcomes: [
          { id: 'LO1', text: 'Analyze data sets to identify patterns and trends' },
          { id: 'LO2', text: 'Create effective visualizations using industry-standard tools' },
          { id: 'LO3', text: 'Evaluate visualization choices for different data types' },
        ],
        assessmentType: 'mcq',
        quantity: 5,
      },
      retrievalQuery: 'data visualization assessment questions best practices chart types',
      retrievalOptions: {
        maxSources: 6,
        minSimilarity: 0.75,
      },
      llmOptions: {
        temperature: 0.6,
        maxTokens: 2000,
      },
    });

    console.log('Generated Assessment Questions:');
    console.log(result.content);
    console.log('\n---\n');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('Error generating assessment questions:', error);
  }
}

/**
 * Example 4: Generate Skill Mappings (Structured Output)
 */
async function generateSkillMappings() {
  console.log('Generating Skill Mappings...\n');

  try {
    const result = await contentGenService.generateStructuredContent({
      templateName: 'skill_mapping',
      templateParams: {
        competencyDomain: 'Data Analysis',
        skills: [
          'Statistical Analysis',
          'Data Cleaning and Preparation',
          'Exploratory Data Analysis',
        ],
        learningOutcomes: [
          { id: 'LO1', text: 'Apply statistical methods to analyze data' },
          { id: 'LO2', text: 'Prepare and clean data for analysis' },
          { id: 'LO3', text: 'Conduct exploratory data analysis' },
        ],
      },
      retrievalQuery: 'data analysis skills statistical methods data preparation workplace applications',
      retrievalOptions: {
        maxSources: 8,
        minSimilarity: 0.75,
      },
      llmOptions: {
        temperature: 0.6,
        maxTokens: 2500,
      },
    });

    console.log('Generated Skill Mappings:');
    console.log(JSON.stringify(result.data, null, 2));
    console.log('\n---\n');
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Sources Used: ${result.sources.length}`);
  } catch (error) {
    console.error('Error generating skill mappings:', error);
  }
}

/**
 * Example 5: Generate with Fallback Strategy
 */
async function generateWithFallback() {
  console.log('Generating Content with Fallback Strategy...\n');

  try {
    const result = await contentGenService.generateWithFallback({
      templateName: 'unit_content',
      templateParams: {
        unitTitle: 'Advanced Machine Learning',
        unitCode: 'ML201',
        moduleContext: 'Advanced data science techniques',
        hours: 30,
        learningOutcomes: [
          'Implement machine learning algorithms',
          'Evaluate model performance',
        ],
      },
      retrievalQuery: 'machine learning algorithms model evaluation techniques',
      retrievalOptions: {
        maxSources: 10,
      },
      llmOptions: {
        temperature: 0.7,
        maxTokens: 3000,
      },
      useCache: true,
    });

    console.log('Generated Content:');
    console.log(result.content.substring(0, 500) + '...');
    console.log('\n---\n');
    console.log(`Cached: ${result.cached}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('Error generating content with fallback:', error);
  }
}

/**
 * Example 6: Fact-Check Generated Content
 */
async function factCheckExample() {
  console.log('Fact-Checking Generated Content...\n');

  const generatedContent = `
    Data visualization is a critical skill in modern data analytics.
    According to industry research, 80% of data professionals use visualization tools daily.
    Tableau and Power BI are the most popular tools in the market.
    Effective visualizations can reduce decision-making time by up to 50%.
  `;

  try {
    // First, retrieve relevant contexts
    const contexts = await contentGenService['ragEngine'].retrieveContext(
      'data visualization tools usage statistics',
      { maxSources: 5, minSimilarity: 0.75 }
    );

    // Perform fact-check
    const factCheckResult = await contentGenService.factCheck(
      generatedContent,
      contexts
    );

    console.log('Fact-Check Results:');
    console.log(`Overall Score: ${factCheckResult.overallScore.toFixed(1)}%`);
    console.log(`Is Accurate: ${factCheckResult.isAccurate}`);
    console.log(`Issues Found: ${factCheckResult.issues.length}`);

    if (factCheckResult.issues.length > 0) {
      console.log('\nIssues:');
      factCheckResult.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.claim}`);
        console.log(`   ${issue.issue}`);
      });
    }
  } catch (error) {
    console.error('Error fact-checking content:', error);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('=== Content Generation Service Examples ===\n');

  // Uncomment the examples you want to run:

  // await generateProgramOverview();
  // await generateUnitContentStreaming();
  // await generateAssessmentQuestions();
  // await generateSkillMappings();
  // await generateWithFallback();
  // await factCheckExample();

  console.log('\n=== Examples Complete ===');

  // Close connections
  await contentGenService.close();
  await db.end();
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  generateProgramOverview,
  generateUnitContentStreaming,
  generateAssessmentQuestions,
  generateSkillMappings,
  generateWithFallback,
  factCheckExample,
};

