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
