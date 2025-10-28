require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('📍 Cluster: cluster0.c8ul7to.mongodb.net');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('\n✅ Successfully connected to MongoDB Atlas!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('🔢 Port:', mongoose.connection.port);
    console.log('📝 Connection State:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected');
    
    // List existing databases
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    console.log('\n📚 Databases on this cluster:');
    databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Connection test complete!');
    console.log('\n🚀 Next step: Run migrations with: npm run migrate:up');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Check if username and password are correct');
    console.error('2. Verify IP address is whitelisted in Network Access');
    console.error('3. Ensure special characters in password are URL encoded');
    console.error('4. Check if the cluster is running (not paused)');
    process.exit(1);
  }
}

testConnection();
