import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src/api/schema.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',

      // nfr.md: every time shown to a human is rendered in the Venue's timezone,
      // never the browser's - a buyer in Da Nang looking at a Hanoi event must see
      // Hanoi's clock. These are the three ways to get the browser's by accident.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression > MemberExpression[property.name=/^toLocale(Date|Time)?String$/]",
          message:
            'Use formatInZone from ~/shared/format: times render in the Venue timezone, never the browser (nfr.md).',
        },
      ],
    },
  },
)
