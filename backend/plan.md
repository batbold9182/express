# Backend Plan

## Current State (as of 2026-05-10)
- ✅ MongoDB connecting via direct connection string
- ✅ `server.ts` split into route files
- ✅ `models/User.ts` — complete
- ✅ `models/review.ts` — complete (includes likes, comments)
- ✅ `routes.ts/auth.ts` — login, callback, refresh
- ✅ `routes.ts/spotify.ts` — /me, /me/top/artists, /me/top/tracks, /search
- ✅ `routes.ts/reviews.ts` — POST, GET, DELETE, PUT (edit), likes, comments
- ✅ `routes.ts/user.ts` — GET /users/:id, GET /users/:id/reviews, follow/unfollow, feed
- ✅ `middleware/auth.ts` — built and wired to protected routes
- ✅ Spotify Premium acquired — /me endpoint unblocked
- ✅ User saving to DB on login
- ✅ Feed route: GET /users/feed/me
- ✅ Follow/unfollow: POST/DELETE /users/:id/follow
- ✅ Review likes: POST/DELETE /reviews/:id/like
- ✅ Comment CRUD + likes
- ❌ Token refresh not wired on frontend yet
- ❌ Pagination on feed/reviews

---

## Phase 1 — Fix foundations ✅ DONE
- ✅ MongoDB connection confirmed working
- ✅ User model built
- ✅ Token refresh endpoint built (`POST /auth/refresh`)
- ✅ User saved to DB on `/auth/callback`

---

## Phase 2 — Structure the backend ✅ DONE
```
backend/
  routes.ts/
    auth.ts       ✅ /auth/login, /auth/callback, /auth/refresh
    spotify.ts    ✅ /me, /me/top/artists, /me/top/tracks, /search
    reviews.ts    ✅ POST /reviews, GET /reviews/:id, DELETE /reviews/:id, PUT (edit), likes, comments
    user.ts       ✅ GET /users/:id, GET /users/:id/reviews, follow/unfollow, feed
  middleware/
    auth.ts       ✅
  models/
    User.ts       ✅
    review.ts     ✅
  server.ts       ✅ just mounts routes
```

---

## Phase 3 — Auth middleware ✅ DONE

### 3.1 Build auth middleware ✅
File: `middleware/auth.ts`
- Extract token from `Authorization: Bearer <token>` header
- Call Spotify `/me` to verify token is valid
- Look up user in MongoDB by `spotifyId`
- Attach `req.user` for downstream routes
- Return 401 if token missing, invalid, or user not in DB

### 3.2 Wire middleware to protected routes ✅
- `POST /reviews` — auth required
- `DELETE /reviews/:id` — auth required (own review only)
- `GET /users/feed/me` — auth required
- `POST /users/:id/follow` — auth required
- `DELETE /users/:id/follow` — auth required
- `POST /reviews/:id/like` — auth required

---

## Phase 4 — App-specific routes ✅ DONE

### 4.1 Feed routes ✅
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users/feed/me` | Reviews from people you follow |
| `POST` | `/users/:id/follow` | Follow a user |
| `DELETE` | `/users/:id/follow` | Unfollow a user |

### 4.2 Likes ✅
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/reviews/:id/like` | Like a review |
| `DELETE` | `/reviews/:id/like` | Unlike a review |

### 4.3 Comments ✅
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/reviews/:id/comments` | Add a comment |
| `PUT` | `/reviews/:id/comments/:cid` | Edit own comment |
| `DELETE` | `/reviews/:id/comments/:cid` | Delete own comment |
| `POST` | `/reviews/:id/comments/:cid/like` | Like a comment |
| `DELETE` | `/reviews/:id/comments/:cid/like` | Unlike a comment |

---

## Phase 5 — Frontend wiring

### 5.1 Token refresh on 401 ❌ (do next cant wait 1 hour)
- Store `spotifyId` in AsyncStorage alongside `access_token`
- Update `lib/api.ts` to catch 401 responses
- Auto-call `POST /auth/refresh` with `spotifyId`
- Retry the original request with the new token
- If refresh fails → clear token → redirect to login

### 5.2 Post a review ✅
- Rate tab wired to `POST /reviews`
- On success → clear form → confirmation

### 5.3 Feed tab ✅
- Fetches `GET /users/feed/me` → renders ReviewCards
- Like button, comments, edit/delete for own posts
- Pull-to-refresh

---

## Phase 6 — Nice to have (later)
- Rate limiting (prevent Spotify API abuse)
- Pagination on `/users/feed/me` and `/users/:id/reviews`
- Cache Spotify track/album data in MongoDB
- Deploy backend to Render

---

## Priority order
1. ✅ MongoDB connection
2. ✅ User model + save tokens on login
3. ✅ Token refresh endpoint
4. ✅ Split server.ts into route files
5. ✅ Review model
6. ✅ Auth middleware
7. ✅ Wire Post button in Rate tab
8. ✅ Follow/unfollow + feed
9. ✅ Likes + comments
10. → Token refresh on frontend (auto-retry on 401)
11. → Pagination
