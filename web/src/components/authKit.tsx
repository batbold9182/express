import React from 'react';

/**
 * Pieces shared by the standalone auth pages (ForgotPassword, ResetPassword) and
 * the Feedback form.
 *
 * Login.tsx deliberately does NOT use these. Its own Field/Wordmark differ in ways
 * that are visible: Login's focus state adds a blue glow ring that these inputs
 * don't have, and its wordmark sizes with an inline clamp() rather than a fixed
 * 40px. Sharing them would change how Login looks.
 */

/** Two-layer radial wash sitting behind the auth card. */
export function AuthBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,255,255,0.14) 0%, transparent 55%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 80% 90%, rgba(224,104,92,0.10) 0%, transparent 60%)' }} />
    </div>
  );
}

/**
 * Gradient wordmark above the auth card.
 *
 * `text` is required and has no default on purpose: these pages currently render
 * "tunelog" while the rest of the app says "express". That inconsistency is real
 * and worth fixing, but it's a visible change — so it stays explicit at each call
 * site rather than being silently locked in by a default here.
 */
export function AuthWordmark({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <h1
        className="text-[40px] font-bold leading-none tracking-tight bg-clip-text text-transparent"
        style={{ backgroundImage: 'linear-gradient(90deg, #4FA3D1 0%, #FFFFFF 50%, #E0685C 100%)' }}
      >
        {text}
      </h1>
    </div>
  );
}

/** Text input with the imperative focus/blur border swap these pages use. */
export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
      style={{ background: 'rgba(0,0,0,0.35)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.10)' }}
      onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.6)')}
      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
    />
  );
}

/** Primary CTA with the blurred gradient halo that fades in on hover. */
export function GlowButton({ onClick, disabled = false, children }: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <div
        className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)' }}
      />
      <button
        onClick={onClick}
        disabled={disabled}
        className="relative w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
      >
        {children}
      </button>
    </div>
  );
}
