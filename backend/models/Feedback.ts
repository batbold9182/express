import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  displayName: { type: String, required: true },
  email:       { type: String, required: true },
  type:        { type: String, enum: ['bug', 'feature', 'other'], required: true },
  text:        { type: String, required: true, maxlength: 1000 },
  createdAt:   { type: Date, default: Date.now },
});

export const Feedback = mongoose.model('Feedback', feedbackSchema);
