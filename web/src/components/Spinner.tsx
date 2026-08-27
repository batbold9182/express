const BOX = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-8 h-8' } as const;

/** The app's loading spinner. Class order matches the markup it replaces. */
export function Spinner({ size = 'lg' }: { size?: keyof typeof BOX }) {
  return <div className={`${BOX[size]} border-2 border-violet/30 border-t-violet rounded-full animate-spin`} />;
}

/** Full-height centred spinner — the first-load state on the detail pages. */
export function PageSpinner() {
  return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
}
