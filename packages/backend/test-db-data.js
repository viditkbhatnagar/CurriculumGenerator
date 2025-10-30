// Test MongoDB Data Storage
const { MongoClient } = require('mongodb');

async function testDatabase() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('curriculum_db');

    console.log('=== DATABASE OVERVIEW ===\n');

    // Count documents in each collection
    const collections = {
      Projects: 'curriculumprojects',
      'Preliminary Packages': 'preliminarycurriculumpackages',
      'Full Curriculum Packages': 'fullcurriculumpackages',
      'Cost Evaluations': 'resourcecostevaluations',
      'Analytics Metrics': 'analyticsmetrics',
      'Course Prompts': 'courseprompts',
      Users: 'users',
      'Knowledge Base': 'knowledgeBase',
    };

    for (const [name, collection] of Object.entries(collections)) {
      const count = await db.collection(collection).countDocuments();
      console.log(`${name}: ${count}`);
    }

    // Check projects by status
    console.log('\n=== PROJECTS BY STATUS ===\n');
    const projectsByStatus = await db
      .collection('curriculumprojects')
      .aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    if (projectsByStatus.length > 0) {
      projectsByStatus.forEach((item) => {
        console.log(`${item._id}: ${item.count}`);
      });
    } else {
      console.log('No projects found');
    }

    // Check analytics metrics by type
    console.log('\n=== ANALYTICS METRICS BY TYPE ===\n');
    const analyticsByType = await db
      .collection('analyticsmetrics')
      .aggregate([
        {
          $group: {
            _id: '$metricType',
            count: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            totalTokens: { $sum: '$tokensUsed' },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    if (analyticsByType.length > 0) {
      analyticsByType.forEach((item) => {
        console.log(`${item._id}:`);
        console.log(`  Records: ${item.count}`);
        if (item.totalCost) console.log(`  Total Cost: $${item.totalCost.toFixed(4)}`);
        if (item.totalTokens) console.log(`  Total Tokens: ${item.totalTokens}`);
      });
    } else {
      console.log('No analytics data found');
    }

    // Check recent projects
    console.log('\n=== RECENT PROJECTS ===\n');
    const recentProjects = await db
      .collection('curriculumprojects')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    if (recentProjects.length > 0) {
      recentProjects.forEach((project) => {
        console.log(`- ${project.projectName} (${project.courseCode})`);
        console.log(`  Status: ${project.status}, Stage: ${project.currentStage}`);
        console.log(`  Created: ${project.createdAt.toISOString()}`);
      });
    } else {
      console.log('No projects found');
    }

    // Check if we have course prompts
    console.log('\n=== AVAILABLE COURSE PROMPTS ===\n');
    const prompts = await db.collection('courseprompts').find({ status: 'active' }).toArray();

    if (prompts.length > 0) {
      prompts.forEach((prompt) => {
        console.log(`- ${prompt.promptTitle}`);
        console.log(`  Domain: ${prompt.domain}, Level: ${prompt.level}`);
      });
    } else {
      console.log('No active prompts found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testDatabase();
