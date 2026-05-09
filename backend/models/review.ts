import mongoose from "mongoose";


const reviewSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  spotifyTrackId: { type: String, required: true },
  spotifyAlbumId: { type: String, required: true },
  trackName: { type: String, required: true },
  artistName: { type: String, required: true },
  albumArt: { type: String },
  score: { type: Number, min: 0, max: 10 },
  text: { type: String, maxlength: 280 },
  moods: { type: [String], validate: (v: string[]) => v.length <= 3 },
  shareToFeed: { type: Boolean },
  createdAt: { type: Date, default: Date.now }
})

export const Review = mongoose.model("Review", reviewSchema)