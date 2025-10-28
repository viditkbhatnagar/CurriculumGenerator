#!/usr/bin/env ts-node

/**
 * MongoDB Index Creation Script
 * 
 * Creates all necessary indexes for optimal query performance
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

interface IndexDefinition {
  collection: string;
  name: string;
  keys: any;
  options?: any;
}

const indexes: IndexDefinition[] = [
  // Programs collection
  {
    collection: 'programs',
    name: 'programName_1',
    keys: { programName: 1 }
  },
  {
    collection: 'programs',
    name: 'status_1',
    keys: { status: 1 }
  },
  {
    collection: 'programs',
    name: 'createdBy_1',
    keys: { createdBy: 1 }
  },
  {
    collection: 'programs',
    name: 'createdAt_-1',
    keys: { createdAt: -1 }
  },
  {
    collection: 'programs',
    name: 'status_createdAt',
    keys: { status: 1, createdAt: -1 }
  },

  // Modules collection
  {
    collection: 'modules',
    name: 'programId_1',
    keys: { programId: 1 }
  },
  {
    collection: 'modules',
    name: 'moduleCode_1',
    keys: { moduleCode: 1 }
  },
  {
    collection: 'modules',
    name: 'programId_sequenceOrder',
    keys: { programId: 1, sequenceOrder: 1 }
  },

  // Learning Outcomes collection
  {
    collection: 'learningoutcomes',
    name: 'moduleId_1',
    keys: { moduleId: 1 }
  },
  {
    collection: 'learningoutcomes',
    name: 'knowledgeSkillCompetency_1',
    keys: { knowledgeSkillCompetency: 1 }
  },

  // Knowledge Base collection
  {
    collection: 'knowledgebases',
    name: 'domain_1',
    keys: { domain: 1 }
  },
  {
    collection: 'knowledgebases',
    name: 'sourceType_1',
    keys: { sourceType: 1 }
  },
  {
    collection: 'knowledgebases',
    name: 'credibilityScore_-1',
    keys: { credibilityScore: -1 }
  },
  {
    collection: 'knowledgebases',
    name: 'domain_credibilityScore',
    keys: { domain: 1, credibilityScore: -1 }
  },
  {
    collection: 'knowledgebases',
    name: 'publicationDate_-1',
    keys: { publicationDate: -1 }
  },
  {
    collection: 'knowledgebases',
    name: 'metadata.tags_1',
    keys: { 'metadata.tags': 1 }
  },

  // Assessments collection
  {
    collection: 'assessments',
    name: 'moduleId_1',
    keys: { moduleId: 1 }
  },
  {
    collection: 'assessments',
    name: 'questionType_1',
    keys: { questionType: 1 }
  },
  {
    collection: 'assessments',
    name: 'difficulty_1',
    keys: { difficulty: 1 }
  },
  {
    collection: 'assessments',
    name: 'learningOutcomeId_1',
    keys: { learningOutcomeId: 1 }
  },

  // Skill Mappings collection
  {
    collection: 'skillmappings',
    name: 'programId_1',
    keys: { programId: 1 }
  },
  {
    collection: 'skillmappings',
    name: 'domain_1',
    keys: { domain: 1 }
  },
  {
    collection: 'skillmappings',
    name: 'skillName_1',
    keys: { skillName: 1 }
  },

  // Generation Jobs collection
  {
    collection: 'generationjobs',
    name: 'programId_1',
    keys: { programId: 1 }
  },
  {
    collection: 'generationjobs',
    name: 'status_1',
    keys: { status: 1 }
  },
  {
    collection: 'generationjobs',
    name: 'createdAt_-1',
    keys: { createdAt: -1 }
  },
  {
    collection: 'generationjobs',
    name: 'status_createdAt',
    keys: { status: 1, createdAt: -1 }
  },

  // Users collection
  {
    collection: 'users',
    name: 'email_1',
    keys: { email: 1 },
    options: { unique: true }
  },
  {
    collection: 'users',
    name: 'authProviderId_1',
    keys: { authProviderId: 1 },
    options: { unique: true }
  },
  {
    collection: 'users',
    name: 'role_1',
    keys: { role: 1 }
  },

  // Audit Logs collection (with TTL)
  {
    collection: 'auditlogs',
    name: 'userId_1',
    keys: { userId: 1 }
  },
  {
    collection: 'auditlogs',
    name: 'action_1',
    keys: { action: 1 }
  },
  {
    collection: 'auditlogs',
    name: 'createdAt_1',
    keys: { createdAt: 1 }
  },
  {
    collection: 'auditlogs',
    name: 'createdAt_ttl',
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: 7776000 } // 90 days
  },

  // File Uploads collection (with TTL)
  {
    collection: 'fileuploads',
    name: 'programId_1',
    keys: { programId: 1 }
  },
  {
    collection: 'fileuploads',
    name: 'uploadedBy_1',
    keys: { uploadedBy: 1 }
  },
  {
    collection: 'fileuploads',
    name: 'createdAt_1',
    keys: { createdAt: 1 }
  },
  {
    collection: 'fileuploads',
    name: 'createdAt_ttl',
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: 604800 } // 7 days for temp files
  },
];

async function createIndexes() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔗 Connecting to MongoDB...\n');
    await mongoose.connect(mongoUri);
    console.log('✓ Connected successfully\n');

    const db = mongoose.connection.db;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    console.log('📝 Creating indexes...\n');

    for (const indexDef of indexes) {
      try {
        const collection = db.collection(indexDef.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.indexes();
        const indexExists = existingIndexes.some(
          (idx: any) => idx.name === indexDef.name
        );

        if (indexExists) {
          console.log(`⊘ ${indexDef.collection}.${indexDef.name} - already exists`);
          skipped++;
        } else {
          await collection.createIndex(indexDef.keys, {
            name: indexDef.name,
            ...indexDef.options
          });
          console.log(`✓ ${indexDef.collection}.${indexDef.name} - created`);
          created++;
        }
      } catch (error: any) {
        console.error(`✗ ${indexDef.collection}.${indexDef.name} - failed: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${indexes.length}\n`);

    if (failed === 0) {
      console.log('✅ All indexes created successfully!\n');
      console.log('Note: Vector search index must be created in Atlas Search UI');
      console.log('See MONGODB_ATLAS_SETUP.md for instructions\n');
    } else {
      console.log('⚠️  Some indexes failed to create. Check errors above.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

// Run the script
createIndexes().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
