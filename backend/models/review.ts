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
    parentId:  { type: mongoose.Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, default: Date.now },
  }],
  shareToFeed: { type: Boolean },
  createdAt: { type: Date, default: Date.now }
})

reviewSchema.index({ userId: 1 });
reviewSchema.index({ spotifyTrackId: 1 });
reviewSchema.index({ spotifyAlbumId: 1, type: 1 });
reviewSchema.index({ spotifyArtistId: 1, type: 1 });
reviewSchema.index({ userId: 1, spotifyTrackId: 1 });
reviewSchema.index({ userId: 1, spotifyAlbumId: 1, type: 1 });
reviewSchema.index({ userId: 1, spotifyArtistId: 1, type: 1 });
reviewSchema.index({ shareToFeed: 1, createdAt: -1 });

export const Review = mongoose.model("Review", reviewSchema)