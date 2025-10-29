const mongoose = require('mongoose');

const uri =
  'mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority';

mongoose
  .connect(uri)
  .then(async () => {
    console.log('🔍 Checking outcomeWritingGuide data...\n');

    const pkg = await mongoose.connection.db
      .collection('preliminarycurriculumpackages')
      .findOne({ projectId: new mongoose.Types.ObjectId('69025efbbefaebecacbe0613') });

    console.log('📦 Package found:', pkg ? 'YES' : 'NO');
    console.log('\n📝 Outcome Writing Guide:');
    console.log(JSON.stringify(pkg?.outcomeWritingGuide, null, 2));

    console.log('\n🔍 Type:', typeof pkg?.outcomeWritingGuide);
    console.log('🔍 Is Array?', Array.isArray(pkg?.outcomeWritingGuide));
    console.log('🔍 Has intro?', !!pkg?.outcomeWritingGuide?.introduction);
    console.log('🔍 Has examples?', Array.isArray(pkg?.outcomeWritingGuide?.examples));
    console.log('🔍 Examples length:', pkg?.outcomeWritingGuide?.examples?.length);

    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
