const mongoose = require('mongoose');

const uri =
  'mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority&appName=Cluster0&serverSelectionTimeoutMS=10000&connectTimeoutMS=10000';

console.log('🔍 Testing MongoDB Atlas connection...');
console.log('📍 Cluster: cluster0.c8ul7to.mongodb.net');
console.log('⏱️  Timeout: 10 seconds\n');

mongoose
  .connect(uri)
  .then(() => {
    console.log('✅ SUCCESS! MongoDB Atlas is RUNNING and accessible!');
    console.log('   The cluster is NOT paused.');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ FAILED! Could not connect.');
    console.log('\n🔴 Error:', err.message);

    if (err.message.includes('IP') || err.message.includes('whitelist')) {
      console.log('\n💡 IP Whitelist Issue:');
      console.log('   - Go to: https://cloud.mongodb.com/');
      console.log('   - Network Access → Add IP: 0.0.0.0/0 (for testing)');
    } else if (err.message.includes('authentication failed')) {
      console.log('\n💡 Password Issue:');
      console.log('   - Check your database user password');
    } else if (err.reason?.type === 'ReplicaSetNoPrimary') {
      console.log('\n💡 CLUSTER IS LIKELY PAUSED!');
      console.log('   - Go to: https://cloud.mongodb.com/');
      console.log('   - Find "Cluster0" and click RESUME button');
      console.log('   - Wait 1-2 minutes for cluster to start');
    }

    process.exit(1);
  });

setTimeout(() => {
  console.log('\n⏱️  10 seconds passed - connection timed out');
  console.log('💡 This usually means the cluster is PAUSED or IP not whitelisted');
  process.exit(1);
}, 10000);
