#!/usr/bin/env npx tsx
/**
 * Knowledge Base Bulk Ingestion Script
 *
 * This script processes all PDF and DOCX documents from the Curriculum-Generator-KB
 * folder and ingests them into the MongoDB knowledge base for RAG-enhanced curriculum generation.
 *
 * Usage:
 *   npx tsx src/scripts/ingestKnowledgeBase.ts
 *   npx tsx src/scripts/ingestKnowledgeBase.ts --dry-run
 *   npx tsx src/scripts/ingestKnowledgeBase.ts --folder Accreditations
 *
 * The documents are used to enhance GPT-5's curriculum generation with domain-specific knowledge.
 */

import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import config from '../config';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { DocumentSource, SourceMetadata } from '../types/knowledgeBase';

// Domain mapping based on folder structure
const DOMAIN_MAPPING: Record<string, string> = {
  Accreditations: 'accreditation_standards',
  'Competency-Framework': 'competency_frameworks',
  'Curriculum-Design': 'curriculum_design',
  Standards: 'education_standards',
  'Subject Books': 'subject_knowledge',
  typeOfOutputs: 'output_templates',
  'UK-Diploma-Programs': 'uk_diploma_programs',
};

// Credibility scores based on source type
const CREDIBILITY_SCORES: Record<string, number> = {
  Accreditations: 95,
  'Competency-Framework': 90,
  'Curriculum-Design': 85,
  Standards: 95,
  'Subject Books': 80,
  typeOfOutputs: 75,
  'UK-Diploma-Programs': 90,
};

// Tags mapping based on folder
const TAGS_MAPPING: Record<string, string[]> = {
  Accreditations: ['accreditation', 'standards', 'quality-assurance', 'compliance'],
  'Competency-Framework': ['competencies', 'skills', 'framework', 'professional-development'],
  'Curriculum-Design': ['curriculum', 'instructional-design', 'learning-outcomes', 'pedagogy'],
  Standards: ['standards', 'quality', 'assessment', 'rubrics'],
  'Subject Books': ['reference', 'textbook', 'domain-knowledge'],
  typeOfOutputs: ['templates', 'examples', 'output-formats'],
  'UK-Diploma-Programs': ['uk-education', 'diploma', 'qualifications', 'nvq'],
};

interface IngestionStats {
  totalFiles: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalChunks: number;
  errors: Array<{ file: string; error: string }>;
}

async function getAllDocuments(rootDir: string, targetFolder?: string): Promise<string[]> {
  const documents: string[] = [];

  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.pdf' || ext === '.docx') {
          documents.push(fullPath);
        }
      }
    }
  }

  if (targetFolder) {
    const targetPath = path.join(rootDir, targetFolder);
    if (fs.existsSync(targetPath)) {
      scanDirectory(targetPath);
    } else {
      console.error(`Target folder not found: ${targetPath}`);
    }
  } else {
    scanDirectory(rootDir);
  }

  return documents;
}

function getMetadataFromPath(
  filePath: string,
  rootDir: string
): { folder: string; domain: string; credibility: number; tags: string[] } {
  const relativePath = path.relative(rootDir, filePath);
  const parts = relativePath.split(path.sep);
  const folder = parts[0];

  return {
    folder,
    domain: DOMAIN_MAPPING[folder] || 'general',
    credibility: CREDIBILITY_SCORES[folder] || 70,
    tags: TAGS_MAPPING[folder] || ['curriculum', 'education'],
  };
}

function extractTitleFromFilename(filename: string): string {
  // Remove extension and clean up
  const baseName = path.basename(filename, path.extname(filename));
  // Replace common separators with spaces
  return baseName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function ingestDocument(
  knowledgeBaseService: KnowledgeBaseService,
  filePath: string,
  rootDir: string,
  dryRun: boolean
): Promise<{ success: boolean; chunks?: number; error?: string }> {
  const { domain, credibility, tags } = getMetadataFromPath(filePath, rootDir);
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === '.pdf' ? 'pdf' : 'docx';

  const title = extractTitleFromFilename(filePath);

  console.log(`\n📄 Processing: ${path.relative(rootDir, filePath)}`);
  console.log(`   Domain: ${domain}, Credibility: ${credibility}`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would ingest ${type.toUpperCase()} document`);
    return { success: true, chunks: 0 };
  }

  try {
    // Read file content
    const content = fs.readFileSync(filePath);

    const metadata: SourceMetadata = {
      title,
      author: 'Curriculum Generator Knowledge Base',
      publicationDate: new Date(), // Use current date since we don't have actual publication dates
      domain,
      credibilityScore: credibility,
      tags,
      isFoundational: credibility >= 90, // Mark high-credibility sources as foundational
    };

    const source: DocumentSource = {
      type,
      content,
      metadata,
    };

    const result = await knowledgeBaseService.ingestDocument(source);

    if (result.success) {
      console.log(`   ✅ Success! Generated ${result.chunksProcessed} chunks`);
      return { success: true, chunks: result.chunksProcessed };
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const folderIndex = args.indexOf('--folder');
  const targetFolder = folderIndex !== -1 ? args[folderIndex + 1] : undefined;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   CURRICULUM GENERATOR - KNOWLEDGE BASE INGESTION');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`   Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '🚀 LIVE INGESTION'}`);
  console.log(`   Model: GPT-5 with text-embedding-3-large embeddings`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Determine knowledge base path
  const kbPath = path.resolve(__dirname, '../../../../Curriculum-Generator-KB');

  if (!fs.existsSync(kbPath)) {
    console.error(`❌ Knowledge base folder not found: ${kbPath}`);
    process.exit(1);
  }

  console.log(`📁 Knowledge Base Path: ${kbPath}`);
  if (targetFolder) {
    console.log(`📂 Target Folder: ${targetFolder}`);
  }

  // Get all documents
  const documents = await getAllDocuments(kbPath, targetFolder);
  console.log(`\n📚 Found ${documents.length} documents to process\n`);

  if (documents.length === 0) {
    console.log('No documents found. Exiting.');
    process.exit(0);
  }

  // Show document breakdown by folder
  const folderCounts: Record<string, number> = {};
  for (const doc of documents) {
    const { folder } = getMetadataFromPath(doc, kbPath);
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  }

  console.log('📊 Documents by folder:');
  for (const [folder, count] of Object.entries(folderCounts)) {
    console.log(`   ${folder}: ${count} documents`);
  }
  console.log('');

  // Initialize stats
  const stats: IngestionStats = {
    totalFiles: documents.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalChunks: 0,
    errors: [],
  };

  if (!dryRun) {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    try {
      await mongoose.connect(config.database.mongoUri);
      console.log('✅ Connected to MongoDB\n');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  // Initialize knowledge base service
  const knowledgeBaseService = new KnowledgeBaseService();

  // Process documents
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   PROCESSING DOCUMENTS');
  console.log('═══════════════════════════════════════════════════════════════════');

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`\n[${i + 1}/${documents.length}]`);

    const result = await ingestDocument(knowledgeBaseService, doc, kbPath, dryRun);
    stats.processed++;

    if (result.success) {
      stats.succeeded++;
      stats.totalChunks += result.chunks || 0;
    } else {
      stats.failed++;
      stats.errors.push({
        file: path.relative(kbPath, doc),
        error: result.error || 'Unknown error',
      });
    }

    // Add a small delay between documents to avoid rate limiting
    if (!dryRun && i < documents.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Print summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   INGESTION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`   Total Files:      ${stats.totalFiles}`);
  console.log(`   Processed:        ${stats.processed}`);
  console.log(`   ✅ Succeeded:     ${stats.succeeded}`);
  console.log(`   ❌ Failed:        ${stats.failed}`);
  console.log(`   📦 Total Chunks:  ${stats.totalChunks}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Failed Documents:');
    for (const error of stats.errors) {
      console.log(`   - ${error.file}: ${error.error}`);
    }
  }

  if (!dryRun) {
    // Get final stats from knowledge base
    try {
      const kbStats = await knowledgeBaseService.getStats();
      console.log('\n📊 Knowledge Base Stats:');
      console.log(`   Total Documents: ${kbStats.totalSources}`);
      console.log(`   Total Vectors:   ${kbStats.totalVectors}`);
      console.log(`   Avg Credibility: ${kbStats.averageCredibility}`);
      console.log('   Domain Distribution:');
      for (const [domain, count] of Object.entries(kbStats.domainDistribution)) {
        console.log(`      ${domain}: ${count}`);
      }
    } catch (error) {
      console.log('\n⚠️  Could not fetch knowledge base stats');
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }

  console.log('\n🎉 Ingestion complete!\n');

  if (dryRun) {
    console.log('💡 To perform actual ingestion, run without --dry-run flag:\n');
    console.log('   npx tsx src/scripts/ingestKnowledgeBase.ts\n');
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
