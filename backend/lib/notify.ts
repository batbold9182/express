import mongoose from 'mongoose';
import { Notification } from '../models/Notifications';

type NotifType = 'like' | 'comment' | 'follow' | 'reply';

export async function notify({
  type,
  recipientId,
  actorId,
  entityId,
  entitySnapshot,
}: {
  type: NotifType;
  recipientId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  entityId?: mongoose.Types.ObjectId;
  entitySnapshot?: { trackName?: string; albumArt?: string; spotifyTrackId?: string; spotifyAlbumId?: string; spotifyArtistId?: string; type?: string };
}) {
  if (recipientId.equals(actorId)) return;

  if (type === 'like') {
    // Aggregate likes on the same entity into one notification doc.
    // Keeps the 5 most recent actors, bumps actorCount, resets to unread.
    await Notification.findOneAndUpdate(
      { recipientId, type: 'like', entityId },
      {
        $set:        { updatedAt: new Date(), read: false, ...(entitySnapshot && { entitySnapshot }) },
        $setOnInsert: { createdAt: new Date() },
        $inc:        { actorCount: 1 },
        $push:       { actors: { $each: [actorId], $position: 0, $slice: 5 } },
      },
      { upsert: true }
    );
  } else {
    await Notification.create({
      recipientId,
      type,
      entityId,
      actors: [actorId],
      actorCount: 1,
      entitySnapshot,
    });
  }
}
