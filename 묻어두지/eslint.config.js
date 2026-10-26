// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output, served third-party modules and binary test fixtures are not ours to lint.
    ignores: ['dist/*', 'public/*', 'server/fixtures/*', '.expo/*'],
  },
  {
    // 플랫폼별 파일(.native.tsx / .web.tsx)만 있는 모듈은 import 리졸버가 못 찾는다.
    rules: {
      'import/no-unresolved': ['error', { ignore: ['^@/screens/ar-(plant|find)$', '^@/components/capsule-atlas$'] }],
    },
  },
]);
