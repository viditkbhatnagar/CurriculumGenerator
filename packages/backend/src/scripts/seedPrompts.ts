/**
 * Seed Script: Initial AGI-Compliant Course Prompts
 * Run this script to populate the database with initial course prompts including CHRP
 */

import { db } from '../db';
import { promptLibraryService } from '../services/promptLibraryService';
import { loggingService } from '../services/loggingService';

async function seedPrompts() {
  try {
    loggingService.info('Starting prompt seeding...');

    // Connect to database
    await db.connect();
    loggingService.info('Database connected');

    // Seed prompts
    await promptLibraryService.seedInitialPrompts();

    loggingService.info('✅ Prompt seeding completed successfully');

    // Disconnect
    await db.disconnect();
    process.exit(0);
  } catch (error) {
    loggingService.error('❌ Error seeding prompts', { error });
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedPrompts();
}

export { seedPrompts };
