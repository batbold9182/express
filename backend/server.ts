import dotenv from 'dotenv';
import { connectDB } from './config/db';
import app from './app';

dotenv.config();
connectDB();

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
