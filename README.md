# express

Rate music. Build your taste.

express is a social music review app where users rate tracks, albums, and artists (0–10), write short takes, tag moods, and share reviews to a social feed. Other users can follow, like, and comment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express 5, TypeScript |
| Database | MongoDB Atlas (Mongoose) |
| Mobile | React Native, Expo SDK 54, expo-router |
| Web | React + Vite + TypeScript, React Router v6, Tailwind CSS v4 |
| Auth | Spotify OAuth 2.0 + Email/password (bcrypt) |
| Music data | Spotify Web API + Client Credentials |
| Email | Nodemailer + Gmail |

---

## Monorepo Structure

```
express/
├── backend/        Express API
├── frontend/       React Native (Expo) mobile app
├── web/            React + Vite web app
└── shared/         @tunelog/shared — types, constants, utils (zero deps)
```

The `shared/` package is an npm workspace consumed by both `frontend/` and `web/` via the `@tunelog/shared` alias.

---

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB Atlas account (free M0 tier works)
- Spotify Developer app ([developer.spotify.com](https://developer.spotify.com))
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords) (for password reset emails)

---

## Environment Variables

### `backend/.env`

```env
PORT=3000
REDIRECT_URI=http://127.0.0.1:3000/auth/callback
CLIENT_ID=           # Spotify app client ID
CLIENT_SECRET=       # Spotify app client secret
MONGO_URI=           # MongoDB Atlas connection string
GMAIL_USER=          # Gmail address (e.g. yourapp@gmail.com)
GMAIL_PASS=          # Gmail App Password (not your account password)
ADMIN_EMAIL=         # Email address that can access GET /feedback
FRONTEND_WEB_BASE=http://localhost:5173
```

### `frontend/.env`

```env
EXPO_PUBLIC_API_BASE=http://127.0.0.1:3000
```

### `web/.env`

```env
VITE_API_BASE=http://localhost:3000
```

---

## Spotify App Setup

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app
2. Add `http://127.0.0.1:3000/auth/callback` as a Redirect URI
3. Copy the **Client ID** and **Client Secret** into `backend/.env`
4. In **User Management**, add any Spotify accounts that need to log in (Dev Mode cap: 25 users)

---

## Running Locally

```bash
# Install all workspace dependencies from the repo root
npm install

# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Web app
cd web && npm run dev
# Opens at http://localhost:5173

# Terminal 3 — Mobile (optional)
cd frontend && npx expo start --clear
# Press 'a' for Android emulator
```

---

## Auth

express supports two login methods:

**Spotify OAuth** — full experience including personal top artists and now-playing.

**Email / Password** — creates an account without Spotify. Music metadata is fetched using a shared app-level Client Credentials token so search, artist pages, and ratings all work. If the same email is later used to log in via Spotify, the accounts are merged automatically — no data loss.

Password reset is handled via email (Nodemailer + Gmail). Reset links expire in 15 minutes.

---

## Key Features

- Rate tracks, albums, and artists on a 0–10 scale
- Tag reviews with up to 3 moods (hype, nostalgic, sad, etc.)
- Share reviews to a social feed
- **For You** feed (trending) and **Following** feed (people you follow) as Home tabs
- Follow users and see their activity in your feed
- Like and comment on reviews (with threaded replies)
- Artist and album pages with community aggregate scores
- **Ranking leaderboard** — community avg scores per item, filters by Most Rated / Tracks / Albums / Artists
- **Discovery panel** — "Who to Follow" suggestions + top-scored reviews on Home (desktop)
- Notifications for likes, comments, replies, and follows
- In-app feedback reporting (bug / feature / other)
- Works without a Spotify account

---

## API Overview

All routes require `Authorization: Bearer <token>` unless noted.

| Prefix | Description |
|---|---|
| `POST /auth/register` | Email signup |
| `POST /auth/email-login` | Email login |
| `GET /auth/login` | Spotify OAuth redirect |
| `GET /auth/callback` | Spotify OAuth callback + account linking |
| `POST /auth/forgot-password` | Send password reset email |
| `POST /auth/reset-password` | Verify token and set new password |
| `GET /search?q=&type=` | Search Spotify (tracks, albums, artists, people) |
| `GET /artists/:id` | Artist metadata + community score |
| `GET /albums/:id` | Album metadata + community score |
| `GET /tracks/:id` | Track metadata + community score |
| `POST /reviews` | Post a review |
| `GET /reviews/trending` | Most liked reviews (last 7 days) |
| `GET /reviews/leaderboard?type=&limit=` | Aggregated leaderboard — avg score + review count per item. `type`: `most-rated \| track \| album \| artist` |
| `GET /reviews/top` | Highest scored reviews (score ≥ 7) |
| `GET /feed/me` | Feed from followed users |
| `GET /users/suggested?limit=` | Users to follow — excludes self + already following, sorted by follower count |
| `GET /notifications` | Paginated notifications |
| `POST /users/:id/follow` | Follow a user |
| `POST /feedback` | Submit feedback (bug / feature / other) |

See [`currentState.md`](currentState.md) for the full API reference.

---

## Physical Device / ngrok

Spotify OAuth requires HTTPS for non-localhost URIs. For testing on a physical device:

1. Run `ngrok http 3000` to get an HTTPS tunnel URL
2. Add `https://your-id.ngrok.io/auth/callback` to your Spotify app's Redirect URIs
3. Update `REDIRECT_URI` in `backend/.env` and `EXPO_PUBLIC_API_BASE` in `frontend/.env`

> ngrok URL changes on every restart — update all three places each session.

---

## Known Limits

- Spotify OAuth login: 25-user allowlist cap in Dev Mode (only affects users who sign in *with* Spotify — email users are unlimited)
- In-memory Spotify response cache clears on backend restart
- No push notifications in Expo Go — requires a dev build with `expo-notifications`
- Artist discography always returns Spotify's default page size (explicit `limit` rejected by Client Credentials)
- Auth middleware caches `req.user` for 4 minutes — stale data possible immediately after follow/unfollow
