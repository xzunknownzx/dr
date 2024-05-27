const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userIds: [{ type: String, required: true }],
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
