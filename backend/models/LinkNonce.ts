import mongoose from 'mongoose';

// One outstanding "Connect Spotify" per user. The nonce itself goes to Spotify as `state`; only its SHA-256 is kept.
// A Mongo document, not a Map: Render restarts on every deploy and wakes from sleep, which would lose it.
export const LINK_NONCE_TTL_MS = 10 * 60 * 1000;

const linkNonceSchema = new mongoose.Schema({
  nonceHash: { type: String, required: true, unique: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Where the browser goes back to. Checked against the allowlist when stored, never taken from the callback.
  origin:    { type: String, required: true },
  // The TTL index only tidies up (Mongo's monitor can lag a minute or more): every query also checks createdAt.
  createdAt: { type: Date, default: Date.now, expires: LINK_NONCE_TTL_MS / 1000 },
});

export const LinkNonce = mongoose.model('LinkNonce', linkNonceSchema);
