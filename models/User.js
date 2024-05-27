const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  language: { type: String, required: true },
  connectedChatId: { type: String, default: null },
  connectionCode: { type: String, default: null },
  connectionCodeExpiry: { type: Date, default: null },
  telegramName: { type: String, required: true },
  dialect: { type: String, default: 'default' },
  location: { type: String, default: 'unknown' }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
