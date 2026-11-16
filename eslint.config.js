// Configuration ESLint (format "flat").
// - règles Expo recommandées
// - Prettier pour le formatage (les erreurs de formatage remontent comme erreurs ESLint)
// - `any` interdit sauf commentaire de justification explicite
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'supabase/functions/*',
      '.expo/*',
      'coverage/*',
      'src/lib/database.types.ts',
      'expo-env.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
