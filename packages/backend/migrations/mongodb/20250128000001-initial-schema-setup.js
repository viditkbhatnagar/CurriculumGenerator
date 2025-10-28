/**
 * Initial MongoDB Schema Setup Migration
 * Creates all collections with validation rules and indexes
 */

module.exports = {
  async up(db, client) {
    console.log('Creating MongoDB collections and indexes...');

    // Create Programs collection
    await db.createCollection('programs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['programName', 'qualificationLevel', 'qualificationType', 'totalCredits', 'status', 'createdBy'],
          properties: {
            programName: {
              bsonType: 'string',
              description: 'Program name is required'
            },
            qualificationLevel: {
              bsonType: 'string',
              description: 'Qualification level is required'
            },
            qualificationType: {
              bsonType: 'string',
              description: 'Qualification type is required'
            },
            totalCredits: {
              bsonType: 'number',
              minimum: 0,
              description: 'Total credits must be a positive number'
            },
            industrySector: {
              bsonType: 'string'
            },
            status: {
              enum: ['draft', 'submitted', 'under_review', 'approved', 'published'],
              description: 'Status must be one of the enum values'
            },
            createdBy: {
              bsonType: 'objectId',
              description: 'Created by user ID is required'
            }
          }
        }
      }
    });

    // Create indexes for programs
    await db.collection('programs').createIndexes([
      { key: { programName: 1 } },
      { key: { status: 1 } },
      { key: { createdBy: 1 } },
      { key: { createdBy: 1, status: 1 } },
      { key: { createdBy: 1, createdAt: -1 } }
    ]);

    // Create Modules collection
    await db.createCollection('modules', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['programId', 'moduleCode', 'moduleTitle', 'hours', 'coreElective', 'sequenceOrder'],
          properties: {
            programId: {
              bsonType: 'objectId',
              description: 'Program ID is required'
            },
            moduleCode: {
              bsonType: 'string',
              description: 'Module code is required'
            },
            moduleTitle: {
              bsonType: 'string',
              description: 'Module title is required'
            },
            hours: {
              bsonType: 'number',
              minimum: 0,
              description: 'Hours must be a positive number'
            },
            moduleAim: {
              bsonType: 'string'
            },
            coreElective: {
              enum: ['core', 'elective'],
              description: 'Must be either core or elective'
            },
            sequenceOrder: {
              bsonType: 'number',
              minimum: 0
            }
          }
        }
      }
    });

    // Create indexes for modules
    await db.collection('modules').createIndexes([
      { key: { programId: 1 } },
      { key: { programId: 1, sequenceOrder: 1 } },
      { key: { programId: 1, moduleCode: 1 }, unique: true }
    ]);

    // Create Learning Outcomes collection
    await db.createCollection('learningoutcomes', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['moduleId', 'outcomeText', 'knowledgeSkillCompetency', 'bloomLevel'],
          properties: {
            moduleId: {
              bsonType: 'objectId',
              description: 'Module ID is required'
            },
            outcomeText: {
              bsonType: 'string',
              description: 'Outcome text is required'
            },
            assessmentCriteria: {
              bsonType: 'array',
              items: {
                bsonType: 'string'
              }
            },
            knowledgeSkillCompetency: {
              enum: ['knowledge', 'skill', 'competency'],
              description: 'Must be knowledge, skill, or competency'
            },
            bloomLevel: {
              bsonType: 'string',
              description: 'Bloom level is required'
            }
          }
        }
      }
    });

    // Create indexes for learning outcomes
    await db.collection('learningoutcomes').createIndexes([
      { key: { moduleId: 1 } }
    ]);

    // Create Knowledge Base collection
    await db.createCollection('knowledgebases', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['content', 'sourceType', 'domain', 'credibilityScore', 'embedding'],
          properties: {
            content: {
              bsonType: 'string',
              description: 'Content is required'
            },
            sourceUrl: {
              bsonType: 'string'
            },
            sourceType: {
              enum: ['pdf', 'docx', 'url', 'manual'],
              description: 'Source type must be one of the enum values'
            },
            publicationDate: {
              bsonType: 'date'
            },
            domain: {
              bsonType: 'string',
              description: 'Domain is required'
            },
            credibilityScore: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Credibility score must be between 0 and 100'
            },
            embedding: {
              bsonType: 'array',
              description: 'Embedding vector is required'
            }
          }
        }
      }
    });

    // Create indexes for knowledge base
    await db.collection('knowledgebases').createIndexes([
      { key: { domain: 1 } },
      { key: { credibilityScore: -1 } },
      { key: { publicationDate: -1 } }
    ]);

    // Note: Vector search index must be created manually in MongoDB Atlas UI
    console.log('⚠️  Remember to create vector search index on knowledgebases.embedding in MongoDB Atlas');

    // Create Assessments collection
    await db.createCollection('assessments', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['moduleId', 'questionType', 'questionText', 'difficulty'],
          properties: {
            moduleId: {
              bsonType: 'objectId',
              description: 'Module ID is required'
            },
            questionType: {
              enum: ['mcq', 'case_study', 'essay', 'practical'],
              description: 'Question type must be one of the enum values'
            },
            questionText: {
              bsonType: 'string',
              description: 'Question text is required'
            },
            options: {
              bsonType: 'array',
              items: {
                bsonType: 'string'
              }
            },
            correctAnswer: {
              bsonType: 'string'
            },
            explanation: {
              bsonType: 'string'
            },
            difficulty: {
              enum: ['easy', 'medium', 'hard'],
              description: 'Difficulty must be easy, medium, or hard'
            },
            learningOutcomeId: {
              bsonType: 'objectId'
            }
          }
        }
      }
    });

    // Create indexes for assessments
    await db.collection('assessments').createIndexes([
      { key: { moduleId: 1 } },
      { key: { difficulty: 1 } }
    ]);

    // Create Skill Mappings collection
    await db.createCollection('skillmappings');
    await db.collection('skillmappings').createIndexes([
      { key: { programId: 1 } },
      { key: { domain: 1 } }
    ]);

    // Create Generation Jobs collection
    await db.createCollection('generationjobs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['programId', 'status', 'progress'],
          properties: {
            programId: {
              bsonType: 'objectId',
              description: 'Program ID is required'
            },
            status: {
              enum: ['queued', 'processing', 'completed', 'failed'],
              description: 'Status must be one of the enum values'
            },
            progress: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Progress must be between 0 and 100'
            }
          }
        }
      }
    });

    // Create indexes for generation jobs
    await db.collection('generationjobs').createIndexes([
      { key: { programId: 1 } },
      { key: { status: 1 } },
      { key: { programId: 1, status: 1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { createdAt: -1 } }
    ]);

    // Create Users collection
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email', 'role', 'authProviderId'],
          properties: {
            email: {
              bsonType: 'string',
              pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
              description: 'Valid email is required'
            },
            role: {
              enum: ['administrator', 'sme', 'student'],
              description: 'Role must be one of the enum values'
            },
            authProviderId: {
              bsonType: 'string',
              description: 'Auth provider ID is required'
            }
          }
        }
      }
    });

    // Create indexes for users
    await db.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { authProviderId: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { role: 1, createdAt: -1 } }
    ]);

    // Create Audit Logs collection
    await db.createCollection('auditlogs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['action'],
          properties: {
            userId: {
              bsonType: 'objectId'
            },
            action: {
              bsonType: 'string',
              description: 'Action is required'
            },
            resourceType: {
              bsonType: 'string'
            },
            resourceId: {
              bsonType: 'objectId'
            }
          }
        }
      }
    });

    // Create indexes for audit logs
    await db.collection('auditlogs').createIndexes([
      { key: { userId: 1 } },
      { key: { action: 1 } },
      { key: { createdAt: -1 } },
      // TTL index to auto-delete logs older than 90 days
      { key: { createdAt: 1 }, expireAfterSeconds: 7776000 }
    ]);

    // Create File Uploads collection
    await db.createCollection('fileuploads', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['filename', 'originalName', 'mimeType', 'size', 'storagePath', 'storageType', 'uploadedBy'],
          properties: {
            programId: {
              bsonType: 'objectId'
            },
            filename: {
              bsonType: 'string',
              description: 'Filename is required'
            },
            originalName: {
              bsonType: 'string',
              description: 'Original name is required'
            },
            mimeType: {
              bsonType: 'string',
              description: 'MIME type is required'
            },
            size: {
              bsonType: 'number',
              minimum: 0,
              description: 'Size must be a positive number'
            },
            storagePath: {
              bsonType: 'string',
              description: 'Storage path is required'
            },
            storageType: {
              enum: ['render_disk', 'cloudinary', 'local'],
              description: 'Storage type must be one of the enum values'
            },
            uploadedBy: {
              bsonType: 'objectId',
              description: 'Uploaded by user ID is required'
            }
          }
        }
      }
    });

    // Create indexes for file uploads
    await db.collection('fileuploads').createIndexes([
      { key: { programId: 1 } },
      { key: { uploadedBy: 1 } },
      // TTL index to auto-delete temporary files older than 7 days
      { key: { createdAt: 1 }, expireAfterSeconds: 604800 }
    ]);

    console.log('✅ All collections and indexes created successfully');
  },

  async down(db, client) {
    console.log('Dropping all collections...');

    const collections = [
      'programs',
      'modules',
      'learningoutcomes',
      'knowledgebases',
      'assessments',
      'skillmappings',
      'generationjobs',
      'users',
      'auditlogs',
      'fileuploads'
    ];

    for (const collection of collections) {
      await db.collection(collection).drop().catch(() => {
        console.log(`Collection ${collection} does not exist, skipping...`);
      });
    }

    console.log('✅ All collections dropped');
  }
};
