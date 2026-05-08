import mongoose from "mongoose";

const MAX_RETRIES = 5;

export const connectDB = async (attempt = 1): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err);

    if (attempt >= MAX_RETRIES) {
      console.error("MongoDB connection failed after max retries. Running without DB.");
      return;
    }

    const delay = Math.pow(2, attempt - 1) * 1000;

    console.log(
      `⏳ Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    return connectDB(attempt + 1);
  }
};