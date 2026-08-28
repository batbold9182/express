import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    spotifyId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatarUrl: { type: String },
    // App session token. Never a Spotify token — see spotifyAccessToken below.
    accessToken: { type: String, required: true, index: true },
    refreshToken: { type: String, default: '' },
    tokenExpiresAt: { type: Date },

    // Personal Spotify credentials, kept separate from the app session above. Before this split
    // `accessToken` was both, so a Spotify token expiring after ~1h left the session half-dead:
    // DB-backed pages worked, live-Spotify features 502'd, and nothing self-healed.
    spotifyAccessToken: { type: String },
    spotifyTokenExpiresAt: { type: Date },
    // The actual Spotify user id. Sparse+unique so one Spotify identity maps to one account —
    // the constraint `spotifyId`'s unique index used to provide before it became a stable handle.
    realSpotifyId: { type: String, index: { unique: true, sparse: true } },
    passwordHash: { type: String },
    resetToken: { type: String },
    resetExpires: { type: Date },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

export const User = mongoose.model("User", userSchema)