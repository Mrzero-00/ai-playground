// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output, served third-party modules and binary test fixtures are not ours to lint.
    ignores: ['dist/*', 'public/*', 'server/fixtures/*', '.expo/*'],
  },
]);
