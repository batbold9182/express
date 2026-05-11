# Backend Plan

## Current State (as of 2026-05-10)
- ✅ MongoDB, Express, route structure
- ✅ Spotify OAuth + user saved to DB on login
- ✅ Auth middleware wired to all protected routes
- ✅ Reviews — POST, GET, DELETE, PUT, likes, comments
- ✅ Feed — GET /users/feed/me (followed users + own posts)
- ✅ Follow/unfollow — POST/DELETE /users/:id/follow
- ✅ Comment CRUD + likes
- ✅ "Play on Spotify" deep link in feed cards

---

## Up Next — Priority Order

### 1. Token refresh on 401 (do first — silent reliability bug) [x] done implemented
**Frontend:**
- Store `spotifyId` in AsyncStorage alongside `access_token`
- Update `lib/api.ts` to catch 401 responses
- Auto-call `POST /auth/refresh` with `spotifyId`
- Retry the original request with the new token
- If refresh fails → clear token → redirect to login

---

### 2. Profile page [x] done
**Frontend:**
- Me tab: show own reviews list below Spotify stats
- Add follower / following counts
- When viewing another user's profile: show Follow/Unfollow button

**Backend:**
- `GET /users/:id` already returns profile — add `followerCount`, `followingCount` to response
- `GET /users/:id/reviews` already exists

---

### 3. Search for users [x] done 
**Frontend:**
- Add "People" tab inside Search screen
- Debounced search against backend

**Backend:**
- `GET /users/search?q=` — search by displayName (case-insensitive regex on MongoDB)

---

### 4. Explore / Discover page [x] done
**Frontend:**
- New tab or section: trending reviews, top-rated tracks across all users
- Good for cold-start (no one to follow yet)

**Backend:**
- `GET /reviews/trending` — most liked reviews in last 7 days
- `GET /reviews/top` — highest scored tracks with >= N reviews

---

### 5. Notifications
**Frontend:**
- Badge on profile tab for unread count
- Notifications list screen

**Backend:**
- `models/Notification.ts` — type, from user, target review, read flag, createdAt
- Create notification on: like, comment, follow
- `GET /notifications/me` — fetch unread
- `POST /notifications/read` — mark as read

---

### 6. Review from album view [x]
**Frontend:**
- From search, tap an album → see full tracklist
- Tap any track → open rate modal pre-filled with that track

**Backend:**
- Proxy `GET /albums/:id/tracks` to Spotify API

---

### 7. Listening stats 
**Frontend:**
- Me tab: top tracks / artists over 4 weeks / 6 months / all time (time range toggle)

**Backend:**
- Already proxied via `/me/top/tracks` and `/me/top/artists`
- Add `?time_range=short_term|medium_term|long_term` param passthrough

---

### 8. Lists / Rankings [x] done
**Frontend:**
- "Create a list" — ordered list of tracks/albums with a title (e.g. "Top 10 of 2025")
- Shareable, shows on profile

**Backend:**
- `models/List.ts` — userId, title, items: [{ spotifyTrackId, trackName, artistName, albumArt, rank }]
- `POST /lists`, `GET /lists/:id`, `PUT /lists/:id`, `DELETE /lists/:id`
- `GET /users/:id/lists`

---

### 9. Album-level reviews [x] done
**Frontend:**
- Rate an album as a whole (not just individual tracks)
- From Search → tap album → Album detail screen showing:
  - Album art, title, artist, release year
  - Full tracklist (from Spotify API proxy)
  - "Rate this album" button → opens rate modal pre-filled with album info
  - Existing album-level reviews from other users (feed-style list)
- Album score: aggregate of all album-type reviews (average)
- Per-track scores shown inline if any track reviews exist
- Album review card looks similar to track card but shows album art + "Album review" label

**Backend:**
- Extend `Review` model:
  - Add `type: 'track' | 'album'` field (default `'track'` for backwards compat)
  - Add `spotifyAlbumId?: string` field
- New route: `GET /albums/:id` — proxy album metadata from Spotify
- New route: `GET /albums/:id/tracks` — proxy tracklist from Spotify
- New route: `GET /albums/:id/reviews` — fetch all reviews where `spotifyAlbumId === id`, compute avg score
- Existing `POST /reviews` already handles creation — just pass `type: 'album'` + `spotifyAlbumId`

---

### 10. "Now playing" live badge [x] done 
**Frontend:**
- Poll `/me/player` every 30s on profile screen
- Show "🎵 Listening now: Track — Artist" badge on profile

**Backend:**
- Proxy `GET /me/player/currently-playing` to Spotify

---

## Nice to have (later)
- Rate limiting (prevent Spotify API abuse)
- Pagination on feed and review lists
- Cache Spotify track/album data in MongoDB
- Deploy backend to Render
