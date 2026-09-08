# Icons

Drop `.svg` files here and import them as inline-SVG components:

```tsx
import Bell from '../icons/bell.svg?react';

<Bell className="w-5 h-5 text-fg3" />          // sized + coloured by CSS
<Bell width={18} height={18} />                 // or explicit props
```

`vite-plugin-svgr` (wired in `vite.config.ts`) turns each file into a React component that
forwards every prop onto the `<svg>` and inherits `currentColor`.

## Source SVG requirements

For an icon to recolour with the theme, its `.svg` must:

- use **`currentColor`**, never a hex — `stroke="currentColor"` for outline icons,
  `fill="currentColor"` for solid ones
- have a `viewBox` (e.g. `viewBox="0 0 24 24"`)
- **not** set `width` / `height` on the root `<svg>` (let the call site size it)
- carry no `id`s that could collide when several icons render on one page (rare; SVGR
  mostly handles this, but avoid hand-authored `<linearGradient id="a">` etc.)

If a Figma export bakes in `fill="#000"` / fixed dimensions, a find-replace to `currentColor`
and deleting `width`/`height` is enough.

## The interface layer

`src/components/icons.tsx` re-exports these as named components with a `size` prop, so call
sites stay tidy (`<SettingsIcon size={18} />`). Add each new icon there once.
