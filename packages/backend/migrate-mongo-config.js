// migrate-mongo configuration file
require('dotenv').config();

const config = {
  mongodb: {
    // MongoDB connection URL
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017',

    // Database name
    databaseName: process.env.MONGODB_DATABASE || 'curriculum_db',

    options: {
      maxPoolSize: 10,
    }
  },

  // The migrations dir can be an absolute path or relative to the current working directory
  migrationsDir: 'migrations/mongodb',

  // The mongodb collection where the applied changes are stored
  changelogCollectionName: 'changelog',

  // The file extension to create migrations and search for in migration dir
  migrationFileExtension: '.js',

  // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determine
  // if the file should be run. Requires that scripts are coded to be run multiple times.
  useFileHash: false,

  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs',
};

module.exports = config;
