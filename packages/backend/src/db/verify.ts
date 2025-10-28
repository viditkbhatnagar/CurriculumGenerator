import db from './index';
import { verifySchema, getDatabaseStats } from './utils';

async function verify() {
  console.log('🔍 Verifying database setup...\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const isHealthy = await db.healthCheck();
    if (isHealthy) {
      console.log('   ✅ Database connection successful\n');
    } else {
      console.log('   ❌ Database connection failed\n');
      process.exit(1);
    }

    // Verify schema
    console.log('2. Verifying database schema...');
    const schemaCheck = await verifySchema();
    if (schemaCheck.isValid) {
      console.log('   ✅ All required tables exist\n');
    } else {
      console.log('   ❌ Missing tables:', schemaCheck.missingTables.join(', '));
      console.log('   💡 Run migrations: npm run migrate:up\n');
      process.exit(1);
    }

    // Get database statistics
    console.log('3. Database statistics:');
    const stats = await getDatabaseStats();
    console.log(`   Total rows: ${stats.totalRows}\n`);
    
    console.log('   Table breakdown:');
    stats.tables.forEach((table) => {
      const padding = ' '.repeat(25 - table.name.length);
      console.log(`   - ${table.name}${padding}${table.rowCount} rows`);
    });

    console.log('\n✅ Database verification complete!');
    console.log('\n📝 Next steps:');
    console.log('   - Run migrations: npm run migrate:up');
    console.log('   - Seed database: npm run db:seed');
    console.log('   - Start backend: npm run dev');

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run verification if called directly
if (require.main === module) {
  verify()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Verification script failed:', error);
      process.exit(1);
    });
}

export default verify;
