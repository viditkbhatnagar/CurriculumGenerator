const mongoose = require('mongoose');

const uri =
  'mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority';

mongoose
  .connect(uri)
  .then(async () => {
    console.log('🔍 Deleting old preliminary packages...');

    const result = await mongoose.connection.db
      .collection('preliminarycurriculumpackages')
      .deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} preliminary packages`);
    console.log('🎯 Now create a FRESH project from the UI!');

    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
