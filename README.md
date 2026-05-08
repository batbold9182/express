# Rotation — Mobile UI Kit

A working visual recreation of the Rotation app: 5 core screens, real interactions where they help, glass everything.

## Run

Open `index.html`. Default view is **All screens** — five iPhones side-by-side. Switch to any single-phone tab (Home / Song / Review / Profile / Search) to interact.

## Screens

| File | Screen | Notes |
| --- | --- | --- |
| `HomeFeed.jsx` | Home feed | Filter chips, infinite-scroll feed of glass cards. Tap any card → song detail. |
| `SongDetail.jsx` | Song detail | Full-bleed blurred album art, hero score numeral with elite glow, distribution histogram, reviews. |
| `ReviewCreate.jsx` | Write a review | 10-pt slider with rainbow gradient track, 280-char composer, mood pills. |
| `Profile.jsx` | Profile | Identity block, stat row, top rated carousel, top genres bar chart, top artists list. |
| `Search.jsx` | Search | Glass search field, scope chips, recents, trending list with rank numerals. |

## Components (`components.jsx`)

`Score`, `Cover`, `Avatar`, `Mood`, `Eyebrow`, `TopBar`, `BottomNav`, `Icon`, `NavIcon`, `ActionRow`, `StreamingBadge` — all exported to `window` for cross-file use.

## Frame

`ios-frame.jsx` is the iOS 26-style device shell starter. The kit calls it with `dark`. Bottom nav lives inside the screen, drawn over content with backdrop-blur — not the iOS list pattern.

## Styling

`app.css` imports `../../colors_and_type.css` for design tokens. Don't define new colors locally; reach for `var(--neon-violet)` etc.
