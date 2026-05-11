import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import authRoutes    from './routes.ts/auth';
import spotifyRoutes from './routes.ts/spotify';
import reviewRoutes  from './routes.ts/reviews';
import userRoutes    from './routes.ts/user';
import albumRoutes   from './routes.ts/albums';

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

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
