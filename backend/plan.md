# Backend Plan

## Current State
- `server.ts` has all routes inline — auth, Spotify proxy, no structure
- `models/User.ts` is empty
- `routes.ts/authRoutes.ts` is empty
- MongoDB not yet confirmed connecting
- `refresh_token` from Spotify is discarded — tokens expire in 1 hour

---

## Phase 1 — Fix foundations (do first)

### 1.1 Confirm MongoDB connection [x] working
- Test the direct connection string in `.env`
- Add a log on successful connect so it's obvious

### 1.2 User model
File: `models/User.ts`
```ts
{
  spotifyId: string       // unique, from /me
  displayName: string
  email: string
  avatarUrl: string
  accessToken: string     // encrypted or plain for now
  refreshToken: string
  tokenExpiresAt: Date
  createdAt: Date
}
```

### 1.3 Token refresh
- On `/auth/callback`: save user + both tokens to MongoDB
- Add `POST /auth/refresh` — uses stored `refresh_token` to get a new `access_token`
- Frontend should call refresh when a 401 is returned

---

## Phase 2 — Structure the backend

### 2.1 Split into route files
```
backend/
  routes/
    auth.ts       ← /auth/login, /auth/callback, /auth/refresh
    spotify.ts    ← /me, /me/top/artists, /me/top/tracks, /search
    reviews.ts    ← POST /reviews, GET /reviews/:id, GET /feed
    users.ts      ← GET /users/:id, POST /users/:id/follow
  models/
    User.ts
    Review.ts
  middleware/
    auth.ts       ← verify token middleware
  server.ts       ← just mounts routes, no logic
```

### 2.2 Auth middleware
- Extract token from `Authorization: Bearer <token>` header
- Look up user in DB by token or verify it against Spotify `/me`
- Attach `req.user` for downstream routes

---

## Phase 3 — App-specific routes

### 3.1 Review model
File: `models/Review.ts`
```ts
{
  userId: ObjectId        // ref User
  spotifyTrackId: string
  spotifyAlbumId: string
  trackName: string
  artistName: string
  albumArt: string
  score: number           // 0.0 - 10.0
  text: string            // max 280 chars
  moods: string[]         // max 3
  shareToFeed: boolean
  createdAt: Date
}
```

### 3.2 Review routes
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/reviews` | Create a review (requires auth) |
| `GET` | `/reviews/:id` | Get a single review |
| `GET` | `/users/:id/reviews` | All reviews by a user |
| `DELETE` | `/reviews/:id` | Delete own review |

### 3.3 Feed routes
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/feed` | Reviews from people you follow (requires auth) |
| `POST` | `/users/:id/follow` | Follow a user |
| `DELETE` | `/users/:id/follow` | Unfollow a user |

### 3.4 Likes
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/reviews/:id/like` | Like a review |
| `DELETE` | `/reviews/:id/like` | Unlike a review |

---

## Phase 4 — Nice to have (later)

- Rate limiting (prevent Spotify API abuse)
- Pagination on `/feed` and `/users/:id/reviews`
- Cache Spotify track/album data in MongoDB so you don't re-fetch
- Deploy backend to Render alongside the existing app

---

## Priority order
1. Fix MongoDB connection
2. User model + save tokens on login
3. Token refresh endpoint
4. Split server.ts into route files
5. Review model + POST /reviews
6. GET /feed
7. Follow/unfollow
8. Likes
