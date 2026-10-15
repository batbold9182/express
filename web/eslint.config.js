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
      // A fetch effect that sets state before the request goes out. Data fetching now goes through
      // TanStack Query (src/queries/), which has no such effect, so there are no violations left and
      // the rule is a hard error: a new one means data is being fetched the old way.
      'react-hooks/set-state-in-effect': 'error',
    },
  },
])
