import mongoose from "mongoose";


const reviewSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: ['track', 'album', 'artist'], default: 'track' },
  spotifyTrackId:  { type: String },
  spotifyAlbumId:  { type: String },
  spotifyArtistId: { type: String },
  trackName: { type: String, required: true },
  artistName: { type: String, required: true },
  albumArt: { type: String },
  score: { type: Number, min: 0, max: 10 },
  text: { type: String, maxlength: 280 },
  moods: { type: [String], validate: (v: string[]) => v.length <= 3 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:      { type: String, required: true, maxlength: 280 },
    likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
  }],
  shareToFeed: { type: Boolean },
  createdAt: { type: Date, default: Date.now }
})

export const Review = mongoose.model("Review", reviewSchema)