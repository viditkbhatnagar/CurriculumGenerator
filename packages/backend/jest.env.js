// Tests must never reach live services.
//
// src/config/index.ts calls dotenv.config(), and the local .env points MONGODB_URI at the
// production Atlas cluster. Suites such as workflowStep10Routes.test.ts connect with
// process.env.MONGODB_URI and create and delete CurriculumWorkflow documents, so running them
// with the real value writes to production. dotenv never overwrites a variable that is already
// set, so pinning these before any test module loads keeps every suite local.
//
// To point a run at a specific test database or service, set the TEST_* variant explicitly.
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/curriculum_generator_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || '';
process.env.OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || 'sk-test-not-a-real-key';

// Storage and error tracking too. The local .env holds the production bucket's credentials, so
// a suite that reached the export cache, deck offload or source-file store would write to it.
// No suite does today; this keeps it that way. Blank values switch those services off.
process.env.S3_BUCKET = process.env.TEST_S3_BUCKET || '';
process.env.S3_ACCESS_KEY_ID = '';
process.env.S3_SECRET_ACCESS_KEY = '';
process.env.AWS_ACCESS_KEY_ID = '';
process.env.AWS_SECRET_ACCESS_KEY = '';
process.env.SENTRY_DSN = '';
