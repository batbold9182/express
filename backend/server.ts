import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes    from './routes.ts/auth';
import spotifyRoutes from './routes.ts/spotify';
import reviewRoutes  from './routes.ts/reviews';
import userRoutes    from './routes.ts/user';
import albumRoutes   from './routes.ts/albums';
import listRoutes    from './routes.ts/lists';
import artistRoutes  from './routes.ts/artists';
import trackRoutes        from './routes.ts/tracks';
import notificationRoutes from './routes.ts/notifications';
import feedbackRoutes    from './routes.ts/feedback';

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth',    authRoutes);
app.use('/',        spotifyRoutes);
app.use('/reviews', reviewRoutes);
app.use('/users',   userRoutes);
app.use('/albums',  albumRoutes);
app.use('/lists',   listRoutes);
app.use('/artists', artistRoutes);
app.use('/tracks',         trackRoutes);
app.use('/notifications', notificationRoutes);
app.use('/feedback',     feedbackRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
  console.log('total users: ', process.env.TOTAL_USERS);
});
