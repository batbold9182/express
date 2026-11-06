# native/ — the native mobile apps (planned)

**Status: not started. Created 2026-11-06 by decision of the project owner.** The mobile app used to be an Expo /
React Native app in [`frontend/`](../frontend) (frozen). It is replaced by two **separate native apps**, built by two
independent tracks:

| Folder | App | Default stack (a proposal, see `plan.md` → "Mobile: native apps") |
|---|---|---|
| [`ios/`](ios) | iPhone / iPad | Swift + SwiftUI |
| [`android/`](android) | Android phone | Kotlin + Jetpack Compose |

Both talk to the same backend (`backend/`, deployed on Render). The **contract between them is the HTTP API**
(`currentState.md` → "API Reference"), not shared code: Swift and Kotlin cannot import `@tunelog/shared`. The Expo app in
`frontend/` stays as the **reference implementation** (screens, behaviour, design) until both native apps have
caught up with it.

Nothing in this folder is an npm workspace and `npm test` does not touch it.

## What the native apps have to do

Read from the Expo app on 2026-11-06 (44 files, about 5,500 lines of TypeScript, Expo SDK 54, React Native 0.81, expo-router).

**Screens**
- Sign in — the Expo app has a single "Continue with Spotify" button; that login is being removed, so the native apps start with **email sign-in, register, forgot password and reset password** (all four endpoints exist already).
- Tabs: Home, Search, Rate (the centre button), Feed, Me.
- Pushed screens: Song, Album, Artist, Profile (and its follower / following list), Notifications, List detail, Create list.
- Shared pieces of the design: frosted-glass chrome, score badge, mood tags, avatar, cover, top bar with the notification bell (see `mcState.md` → "UI Design System").

**API the Expo app calls today** (all existing; shapes are in `currentState.md`)
- Auth: `POST /auth/refresh` (on a 401: retry once with a fresh token), and the four email endpoints above.
- Reviews: `GET /reviews/trending`, `GET /reviews/mine`, `GET /users/feed/me`, `POST /reviews`, `GET|PUT|DELETE /reviews/:id`, likes `POST|DELETE /reviews/:id/like`, comments `POST /reviews/:id/comments`, `PUT|DELETE /reviews/:id/comments/:commentId`, comment likes.
- Catalogue: `GET /search`, `GET /tracks/:id`, `GET /albums/:id`, `GET /artists/:id`, `GET /artists/:id/albums`, and `GET /tracks|albums|artists/:id/reviews`.
- People: `GET /users/:id`, `GET /users/search`, `GET /users/:id/reviews` (and `/counts`), followers and following lists, `POST|DELETE /users/:id/follow`, `GET /users/:id/lists`.
- Lists: `POST /lists`, `GET|PUT|DELETE /lists/:id`.
- Notifications: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all` (and `/:id/read`).
- Spotify, for a linked account only: `GET /me`, `GET /me/top/artists`, `GET /me/player/currently-playing`.

## Rules both apps follow

- **The session token is a secret.** Keep it in the iOS Keychain / Android Keystore-backed storage, never in plain preferences. Sessions last 30 days; call `POST /auth/refresh` while fewer than 7 days remain (the rule `plan.md` sets for the web as well; neither does it yet, and sessions only start expiring once the session work in `plan.md` is approved and built).
- **Old app versions stay in the world.** Unlike the web, an installed app cannot be updated by a deploy. Once a native app is released, the backend does not remove or rename a field it reads; changes are additive.
- **Never put secrets in the app** (no Spotify client secret, no API keys). Spotify is only ever reached through the backend.
- Spotify linking waits for the new signed-in link flow (`plan.md`, step 4); it needs a native-aware redirect, decided there.
- Push notifications need a device-token endpoint on the backend (APNs / FCM): new backend work, asked for when its time comes.

## Order of work (proposal)

1. **Sign in** (email), session storage, refresh. 2. **Home and Feed**, read-only. 3. **Search and the Song / Album / Artist pages.** 4. **Rating, likes, comments.** 5. **Profile, follow, lists.** 6. **Notifications** (polling first, push later). 7. **Spotify link, now playing, top artists** (after the link fix). 8. **Sharing.**

Each platform tracks its own progress against the Expo app; the lead keeps a parity checklist in `plan.md`.

## Practical constraints

- **iOS apps can only be built on a Mac with Xcode.** If the iOS developer is on Windows, a Mac, a cloud Mac or a macOS CI runner is needed. Open decision in `plan.md`.
- When the first project files land here, the build outputs (`Pods/`, `build/`, `.gradle/`, `xcuserdata/`, `DerivedData/`, `local.properties`) need entries in the root `.gitignore`.
