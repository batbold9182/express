import { Request } from 'express';

export function spotifyHeaders(req: Request) {
  return { Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` };
}
