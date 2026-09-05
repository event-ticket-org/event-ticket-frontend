import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .vite is the dev server's dependency cache. It only exists while `npm run dev` is
  // running, which is exactly when someone is most likely to lint.
  { ignores: ['dist', '.vite', 'src/api/schema.d.ts'] },
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

        // DESIGN.md's Don'ts, made checkable. Clearing the default palette in @theme
        // stops bg-slate-900 from generating anything, but a blurred shadow or a rounded
        // corner is a class that still works - so those are caught here instead.
        {
          selector:
            "Literal[value=/(?:^|[\\s'\"`])(?:shadow-(?:sm|md|lg|xl|2xl|inner)|backdrop-blur|bg-gradient-to-|bg-clip-text|animate-)/], TemplateElement[value.raw=/(?:^|[\\s'\"`])(?:shadow-(?:sm|md|lg|xl|2xl|inner)|backdrop-blur|bg-gradient-to-|bg-clip-text|animate-)/]",
          message:
            'DESIGN.md: no blurred shadows, no backdrop-blur, no gradients, no entrance animation. Shadows are solid offsets (shadow-raised/hover/lifted); the only motion is the 60ms press.',
        },
        {
          selector:
            "Literal[value=/(?:^|[\\s'\"`])rounded\\b(?!-full|-none)/], TemplateElement[value.raw=/(?:^|[\\s'\"`])rounded\\b(?!-full|-none)/]",
          message:
            'DESIGN.md: radius is 0. A rounded corner means "this depicts a physical object" - a seat glyph, a map element, a QR - and rounded-full is the only utility for it.',
        },
      ],
    },
  },
)
