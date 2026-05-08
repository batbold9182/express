import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {connectDB} from './config/db';

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());


// Step 1 — redirect user to Spotify login
app.get('/auth/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI!,
    scope: 'user-read-private user-read-email user-top-read',
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// Step 2 — Spotify redirects back here with a code
app.get('/auth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) { res.status(400).json({ error: 'Missing code' }); return; }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.REDIRECT_URI!,
    client_id: process.env.CLIENT_ID!,
    client_secret: process.env.CLIENT_SECRET!,
  });

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tokens = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
    // TODO: save tokens to DB or session — for now redirect to frontend with token in query
    res.redirect(`http://localhost:8081/auth/success?access_token=${tokens.access_token}`);
  } catch (error) {
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

function spotifyHeaders(req: Request) {
  return { Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` };
}

async function spotifyGet(url: string, req: Request, res: Response) {
  try {
    const r = await fetch(url, { headers: spotifyHeaders(req) });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Spotify request failed' });
  }
}

app.get('/me', (req, res) => spotifyGet('https://api.spotify.com/v1/me', req, res));
app.get('/me/top/artists', (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/artists?limit=5&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
app.get('/me/top/tracks', (req, res) => spotifyGet(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${req.query.time_range ?? 'medium_term'}`, req, res));
app.get('/search', (req, res) => spotifyGet(`https://api.spotify.com/v1/search?q=${encodeURIComponent(req.query.q as string)}&type=${req.query.type ?? 'track,album,artist'}&limit=20`, req, res));

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
