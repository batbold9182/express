import mongoose from 'mongoose';

const listSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:  { type: String, required: true, maxlength: 80 },
  items:  [{
    rank:           { type: Number, required: true },
    spotifyTrackId: { type: String },
    spotifyAlbumId: { type: String },
    type:           { type: String, enum: ['track', 'album'], default: 'track' },
    trackName:      { type: String, required: true },
    artistName:     { type: String, required: true },
    albumArt:       { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const List = mongoose.model('List', listSchema);
