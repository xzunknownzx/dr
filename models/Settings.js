const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
});

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;
