const mongoose = require('mongoose');

// Subdocument for individual messages
const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
  status: { type: String, required: true },
  fromMe: { type: Boolean, required: true },
  // Add other fields from your payload as needed
});

// Main Conversation model
const ConversationSchema = new mongoose.Schema({
  wa_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  lastMessage: { type: String, default: '' },
  messages: [MessageSchema], // An array of messages
});

module.exports = mongoose.model('Conversation', ConversationSchema);