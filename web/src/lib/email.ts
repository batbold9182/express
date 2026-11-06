// The server trims and lowercases every email it is given (decision D16), and is the authority on
// that. The web does the same before sending, so what the user sees confirmed is what was stored.
// Pure (no imports), so the root Jest suite can load it.

export const normalizeEmail = (v: string): string => v.trim().toLowerCase();

/** Props for an email box: no auto-capitalised first letter, no autocorrect, the browser's email autofill. */
export const EMAIL_INPUT = {
  type: 'email',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'email',
} as const;
