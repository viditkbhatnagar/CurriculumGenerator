const mongoose = require('mongoose');

// Simpler URI without custom timeouts
const uri =
  'mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority';

console.log('🔍 Testing with simpler connection string...\n');

mongoose
  .connect(uri)
  .then(() => {
    console.log('✅ SUCCESS! MongoDB connected!');
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log('✅ Database ping successful!');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ Error:', err.message);
    process.exit(1);
  });
