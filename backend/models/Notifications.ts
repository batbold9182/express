import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:           { type: String, enum: ['like', 'comment', 'follow', 'reply'], required: true },
  entityId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  actors:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  actorCount:     { type: Number, default: 1 },
  read:           { type: Boolean, default: false },
  entitySnapshot: new mongoose.Schema({
    trackName:       { type: String },
    albumArt:        { type: String },
    spotifyTrackId:  { type: String },
    spotifyAlbumId:  { type: String },
    spotifyArtistId: { type: String },
    type:            { type: String },
  }, { _id: false }),
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// fast recipient feed query
notificationSchema.index({ recipientId: 1, updatedAt: -1 });
// auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);
