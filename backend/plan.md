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

### 2. Error states + retry [x] done
Currently any failed load shows a blank screen with a spinner that never resolves, or silently empty sections. Users have no way to know something went wrong or retry.

**Frontend:**
- Artist/album page: show error message + "Try again" button if initial load fails
- Feed: show "Failed to load" with pull-to-refresh hint instead of empty list

---

### 6. Pre-emptive token refresh [x] done
Currently tokens only refresh on 401. `tokenExpiresAt` is stored in DB — we can refresh before expiry to avoid any failed requests.

**Frontend (`context/auth.tsx`):**
- On app load, check if `tokenExpiresAt` is within 5 minutes
- If so, call `/auth/refresh` proactively before making any API requests

---

## Nice to Have

### 4. "Reviewed" badge navigation [x] done 
On album tracklist, tapping a "Reviewed" badge should open that review, not trigger a re-review alert.

### 5. Infinite scroll on reviews [x] done
All review endpoints (`/tracks/:id/reviews`, `/albums/:id/reviews`, `/artists/:id/reviews`, `/users/:id/reviews`) now paginate with `?offset=&limit=`. Frontend uses `onScroll` threshold trigger on song, album, artist, profile, and me screens.

### 6. Feed deduplication 
If a user you follow posts 5 reviews in a row, they dominate the feed. Consider grouping consecutive reviews from the same user into a single card.

### 7. Artist page — navigate to artist from review cards
`ProfileReviewCard` shows artist name as plain text. Tapping it could navigate to the artist page.

### 8. Deploy
- Backend → Render (free tier, auto-sleep on inactivity)
- Switch `EXPO_PUBLIC_API_BASE` to the deployed URL
- Set `REDIRECT_URI` to the deployed callback URL in Spotify dashboard

---

## Known Limits (Spotify API)
- `/artists/{id}/top-tracks` — 403 for new/unreviewed apps, removed
- `/artists/{id}/related-artists` — same restriction
- Rate limits: ~1 req/sec per endpoint; auth and data APIs share quota
