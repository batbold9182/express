export type ReviewUser = { _id: string; displayName: string; avatarUrl: string; spotifyId: string };
export type Comment = { _id: string; userId: ReviewUser; text: string; likes: string[]; createdAt: string };
export type FeedItem = {
  _id: string;
  userId: ReviewUser;
  type?: 'track' | 'album' | 'artist';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  trackName: string;
  artistName: string;
  albumArt: string;
  score: number;
  text: string;
  moods: string[];
  likes: string[];
  comments: Comment[];
  createdAt: string;
};
