/*
 * TEMP one-off: set a local account's password directly, bypassing the reset-email flow.
 * Useful when the account's email isn't an inbox you control (e.g. a test@ address).
 *
 *   cd backend
 *   node set-password.js test@gmail.com "your-new-password"
 *
 * Delete this file when you're done — it is a dev utility, not part of the app.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node set-password.js <email> <newPassword>');
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters — same rule the API enforces.');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Raw collection, so this doesn't need the TypeScript model.
  const users = mongoose.connection.collection('users');
  const user = await users.findOne({ email });

  if (!user) {
    console.error(`No user found with email ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10); // cost 10, matching auth.ts
  await users.updateOne(
    { _id: user._id },
    // Clear any pending reset alongside it — those tokens are stale now anyway.
    { $set: { passwordHash }, $unset: { resetToken: '', resetExpires: '' } },
  );

  console.log(`Password set for ${email} (${user.displayName ?? 'no display name'}).`);
  console.log(`spotifyId: ${user.spotifyId}`);
  console.log('Sign in at /login with that email and the new password.');

  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
