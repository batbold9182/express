import mongoose from "mongoose";

const RETRY_BASE_MS = 1000;    // 1s
const RETRY_MAX_MS  = 30_000;  // backoff caps here — retries forever, every 30s in steady state

export const connectDB = async (attempt = 1): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err);

    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);

    console.log(`⏳ Retrying in ${delay / 1000}s... (attempt ${attempt + 1})`);

    await new Promise((resolve) => setTimeout(resolve, delay));
    
    return connectDB(attempt + 1);
  }
};

// No app-level reconnect handler for drops after a successful connect: the MongoDB driver's own
// SDAM monitoring already redials automatically on transient network blips without app
// intervention (verified — a force-closed connection re-enters 'connecting' on its own). Adding
// a `connection.on('disconnected', connectDB)` listener here was tried and reverted — a *failed
// initial* connect also emits 'disconnected', so that listener fired on every failed attempt and
// raced a second, unthrottled retry chain against the one already backing off above.