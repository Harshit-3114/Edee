import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    // Portal isolation, enforced by the linter rather than by discipline.
    // A component belonging to one portal must never be imported by another.
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/student/*',
                '@/components/college/*',
                '@/components/coaching/*',
                '@/components/admin/*',
              ],
              message:
                'Cross-portal import. Anything two portals need belongs in components/ui.',
            },
          ],
        },
      ],
    },
  },
  {
    // Each portal may of course import its own components.
    files: [
      'app/student/**/*.tsx',
      'components/student/**/*.tsx',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['app/college/**/*.tsx', 'components/college/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['app/coaching/**/*.tsx', 'components/coaching/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['app/admin/**/*.tsx', 'components/admin/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The public college landing pages are a fifth surface: unauthenticated
    // and outside every portal. They may use college-domain display
    // components, but never another portal's components — those may assume a
    // signed-in user and a role claim that a visitor does not have.
    files: ['app/colleges/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/student/*',
                '@/components/coaching/*',
                '@/components/admin/*',
              ],
              message:
                'Cross-portal import into a public page. Anything the public surface needs belongs in components/ui or components/college.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
