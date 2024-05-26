const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: String, required: true }],
  connectionCode: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
