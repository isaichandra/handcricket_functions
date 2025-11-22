/**
 * ESLint configuration for Cloud Functions
 */
module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'single', {'allowTemplateLiterals': true}],
    'max-len': ['error', {'code': 120}],
  },
  overrides: [
    {
      files: ['*.js'],
      excludedFiles: '*.test.js',
    },
  ],
};

