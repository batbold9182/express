# Tunelog — Roadmap

## In Progress / Up Next

### 1. Notifications
**Backend:**
- `models/Notification.ts` — type, fromUserId, targetReviewId, read flag, createdAt
- Create notification on: like, comment, follow
- `GET /notifications/me` — fetch unread
- `POST /notifications/read` — mark all as read

**Frontend:**
- Badge on notification tab for unread count
- Notifications list screen (currently `notification.tsx` is empty)

---

### 2. Listening stats time range toggle
Backend already proxies `/me/top/tracks` and `/me/top/artists` with `?time_range=`. Frontend just needs the UI.

**Frontend (`me.tsx`):**
- Add 3 toggle pills: 4 weeks / 6 months / All time
- Pass `time_range=short_term|medium_term|long_term` to the API calls
- Re-fetch top artists + recalculate genre bars on toggle

---

### 3. Spotify response cache (backend)
Every artist/album page hits Spotify even for repeat visits. Artist metadata and discography almost never change.

**Backend:**
- In-memory `Map<url, { data, expiresAt }>` — same pattern as auth token cache
- TTLs: artist info 24h, album info 24h, discography 6h, `/me` endpoints 5min
- Skip cache for currently-playing (always real-time)
- Cuts Spotify API calls to near-zero for repeat page views

---

### 4. Review type label on cards
`ProfileReviewCard` shows the same layout for track, album, and artist reviews — no visual distinction. On a profile with mixed review types it's confusing.

**Frontend (`profile/ReviewCard.tsx`):**
- Small pill label: "Album" / "Artist" / "Track" based on `r.type`
- Tapping the card could navigate to the album or artist page

---

### 5. Error states + retry
Currently any failed load shows a blank screen with a spinner that never resolves, or silently empty sections. Users have no way to know something went wrong or retry.

**Frontend:**
- Artist/album page: show error message + "Try again" button if initial load fails
- Feed: show "Failed to load" with pull-to-refresh hint instead of empty list

---

### 6. Pre-emptive token refresh
Currently tokens only refresh on 401. `tokenExpiresAt` is stored in DB — we can refresh before expiry to avoid any failed requests.

**Frontend (`context/auth.tsx`):**
- On app load, check if `tokenExpiresAt` is within 5 minutes
- If so, call `/auth/refresh` proactively before making any API requests

---

## Nice to Have

### 7. "Reviewed" badge navigation
On album tracklist, tapping a "Reviewed" badge should open that review, not trigger a re-review alert.

### 8. Infinite scroll on profile reviews
Currently `GET /users/:id/reviews` returns all reviews at once. For prolific users this gets heavy.
- Add `?type=&offset=&limit=` to the endpoint
- Frontend loads 20 at a time with scroll-triggered loading (same pattern as artist discography)

### 9. Feed deduplication
If a user you follow posts 5 reviews in a row, they dominate the feed. Consider grouping consecutive reviews from the same user into a single card.

### 10. Artist page — navigate to artist from review cards
`ProfileReviewCard` shows artist name as plain text. Tapping it could navigate to the artist page.

### 11. Login screen cleanup
The email/password fields and "Sign in" / "Forgot password" / "Sign up" buttons in `login.tsx` are non-functional placeholders. Either wire them up or remove them to avoid confusing users.

### 12. Deploy
- Backend → Render (free tier, auto-sleep on inactivity)
- Switch `EXPO_PUBLIC_API_BASE` to the deployed URL
- Set `REDIRECT_URI` to the deployed callback URL in Spotify dashboard

---

## Known Limits (Spotify API)
- `/artists/{id}/top-tracks` — 403 for new/unreviewed apps, removed
- `/artists/{id}/related-artists` — same restriction
- Rate limits: ~1 req/sec per endpoint; auth and data APIs share quota
