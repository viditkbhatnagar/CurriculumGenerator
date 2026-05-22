const { join } = require('path');

/**
 * Puppeteer downloads Chromium during `npm install`. Its default cache
 * ($HOME/.cache/puppeteer) lives outside the project directory, and on
 * Render that path is not carried from the build into the runtime — so
 * `puppeteer.launch()` fails at runtime with "Could not find Chrome".
 *
 * Pointing the cache inside the project directory (which IS deployed to
 * the runtime) fixes it. Build and runtime both run from this package,
 * so __dirname resolves to the same absolute path in each.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
