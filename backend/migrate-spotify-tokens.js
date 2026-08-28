/*
 * Phase C backfill — split the conflated accessToken into an app session token and Spotify
 * credentials.
 *
 *   cd backend
 *   node migrate-spotify-tokens.js          # dry run, prints what it would change
 *   node migrate-spotify-tokens.js --apply  # writes
 *
 * For every account with a refreshToken (i.e. Spotify is linked), the stored accessToken is a
 * Spotify token. It is COPIED into spotifyAccessToken and deliberately LEFT IN PLACE as the app
 * session token, so nobody is signed out by this migration. tokenExpiresAt is stretched to 30
 * days because it currently holds Spotify's ~1h expiry, which now means the app session.
 *
 * spotifyId is NOT rewritten. Accounts that signed in through Spotify already have the real id as
 * their public handle and links to those profiles are live — rewriting them to email:<uuid> would
 * break exactly the URLs this phase protects. Only future rotation stops. A mixed population of
 * handles is the correct end state.
 *
 * Idempotent: documents that already have spotifyAccessToken are skipped, so re-running is safe.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection('users');

  const candidates = await users.find({
    refreshToken: { $exists: true, $nin: [null, ''] },
    spotifyAccessToken: { $exists: false }, // already migrated -> skip
  }).toArray();

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${candidates.length} account(s) to migrate\n`);

  let migrated = 0;
  for (const u of candidates) {
    const isEmailHandle = typeof u.spotifyId === 'string' && u.spotifyId.startsWith('email:');
    const set = {
      spotifyAccessToken:    u.accessToken,
      spotifyTokenExpiresAt: u.tokenExpiresAt ?? new Date(0), // no expiry on record -> treat as expired
      tokenExpiresAt:        new Date(Date.now() + THIRTY_DAYS_MS),
      updatedAt:             new Date(),
    };
    // The real Spotify id currently lives in spotifyId for these accounts. Copy it across;
    // leave spotifyId itself alone so existing profile links keep resolving.
    if (!isEmailHandle) set.realSpotifyId = u.spotifyId;

    console.log(`  ${u.email}`);
    console.log(`    spotifyId      ${u.spotifyId}  (unchanged)`);
    console.log(`    realSpotifyId  ${set.realSpotifyId ?? '— (handle is email:*, no Spotify id to copy)'}`);
    console.log(`    accessToken    unchanged — session preserved`);

    if (APPLY) {
      await users.updateOne({ _id: u._id }, { $set: set });
      migrated++;
    }
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to commit these changes.\n');
  } else {
    console.log(`\n${migrated} account(s) migrated.\n`);
  }

  // Ensure the sparse unique index the model declares actually exists on the collection.
  if (APPLY) {
    try {
      await users.createIndex({ realSpotifyId: 1 }, { unique: true, sparse: true });
      console.log('realSpotifyId sparse unique index ensured.\n');
    } catch (e) {
      console.error('Could not create realSpotifyId index — check for duplicates:', e.message);
    }
  }

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
