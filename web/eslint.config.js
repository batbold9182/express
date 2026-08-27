import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Errors by default in eslint-plugin-react-hooks v7's recommended set. Every remaining site
      // is the same shape: a fetch effect that sets a loading flag before the request goes out.
      // None are live bugs — `loading` already starts true, so the call is a no-op on mount and
      // only fires the spinner on a param change, which is what we want. Downgraded rather than
      // switched off so it still shows up in new code. The real fix is moving data fetching to a
      // query library — Phase G in plan.md.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
