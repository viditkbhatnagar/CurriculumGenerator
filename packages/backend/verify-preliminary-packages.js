#!/usr/bin/env node

/**
 * Verify data in preliminarycurriculumpackages collection
 *
 * Usage:
 *   node verify-preliminary-packages.js
 *   node verify-preliminary-packages.js --project-id <projectId>
 *   node verify-preliminary-packages.js --limit 10
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from environment or use default
const mongoUri =
  process.env.MONGODB_URI ||
  'mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority';

// Parse command line arguments
const args = process.argv.slice(2);
const projectIdArg = args.find((arg) => arg.startsWith('--project-id'));
const limitArg = args.find((arg) => arg.startsWith('--limit'));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) || 10 : 10;
const projectId = projectIdArg ? projectIdArg.split('=')[1] : null;

async function verifyPreliminaryPackages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📊 Database: curriculum_db`);
    console.log(`📦 Collection: preliminarycurriculumpackages\n`);

    await mongoose.connect(mongoUri);
    console.log('✅ Connected successfully!\n');

    const db = mongoose.connection.db;
    const collection = db.collection('preliminarycurriculumpackages');

    // Count total documents
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total documents: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('⚠️  No documents found in the collection.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // If projectId is provided, find specific document
    if (projectId) {
      console.log(`🔍 Looking for projectId: ${projectId}\n`);

      let query = {};
      if (mongoose.Types.ObjectId.isValid(projectId)) {
        query.projectId = new mongoose.Types.ObjectId(projectId);
      } else {
        query.projectId = projectId;
      }

      const doc = await collection.findOne(query);

      if (doc) {
        console.log('✅ Document found!\n');
        console.log('📝 Document details:');
        console.log(JSON.stringify(doc, null, 2));
      } else {
        console.log('❌ Document not found for the given projectId.\n');
      }
    } else {
      // Show sample documents
      console.log(`📋 Showing first ${limit} documents:\n`);

      const documents = await collection.find({}).limit(limit).sort({ createdAt: -1 }).toArray();

      if (documents.length === 0) {
        console.log('⚠️  No documents found.');
      } else {
        documents.forEach((doc, index) => {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`Document ${index + 1}:`);
          console.log(`${'='.repeat(80)}`);
          console.log(JSON.stringify(doc, null, 2));
        });
      }

      // Show summary statistics
      console.log(`\n${'='.repeat(80)}`);
      console.log('📊 Collection Statistics:');
      console.log(`${'='.repeat(80)}`);

      // Count by status
      const statusCounts = await collection
        .aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      if (statusCounts.length > 0) {
        console.log('\n📈 Documents by Status:');
        statusCounts.forEach((stat) => {
          console.log(`   ${stat._id || 'N/A'}: ${stat.count}`);
        });
      }

      // Count by submission metadata
      const agiCompliantCount = await collection.countDocuments({
        'submissionMetadata.agiCompliant': true,
      });

      console.log(`\n✅ AGI Compliant packages: ${agiCompliantCount}`);
      console.log(`\n❌ Non-AGI Compliant packages: ${totalCount - agiCompliantCount}`);

      // Show field statistics
      const sampleDoc = documents[0];
      if (sampleDoc) {
        console.log(`\n📋 Available Fields:`);
        console.log(`   - _id: ${sampleDoc._id}`);
        console.log(`   - projectId: ${sampleDoc.projectId || 'N/A'}`);
        console.log(`   - status: ${sampleDoc.status || 'N/A'}`);
        console.log(`   - createdAt: ${sampleDoc.createdAt || 'N/A'}`);
        console.log(`   - updatedAt: ${sampleDoc.updatedAt || 'N/A'}`);

        // Show which AGI components are present
        const agiComponents = [
          'programOverview',
          'learningOutcomes',
          'moduleSpecifications',
          'assessmentStrategy',
          'teachingMethods',
          'resourceRequirements',
          'qualityAssurance',
          'implementationTimeline',
          'riskAssessment',
          'stakeholderEngagement',
          'monitoringEvaluation',
          'sustainabilityPlan',
          'references',
          'outcomeWritingGuide',
        ];

        console.log(`\n🔍 AGI Components Present:`);
        agiComponents.forEach((component) => {
          const present = sampleDoc[component] !== undefined;
          console.log(`   ${present ? '✅' : '❌'} ${component}`);
        });
      }
    }

    await mongoose.disconnect();
    console.log(`\n✅ Verification complete!`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('\n💡 IP Whitelist Issue:');
      console.error('   - Check Network Access in MongoDB Atlas');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n💡 Authentication Issue:');
      console.error('   - Check username and password in MONGODB_URI');
    }

    process.exit(1);
  }
}

verifyPreliminaryPackages();
