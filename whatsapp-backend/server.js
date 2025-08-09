// A Node.js/Express server to handle message data with MongoDB persistence.

// Import necessary libraries
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();


// Initialize the Express app
const app = express();
// Use port 4000 to match the URL in your React frontend code
// The MongoDB connection URI provided by the user

const port = process.env.PORT || 4000;

const MONGO_URI = process.env.MONGO_URI;
// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('Could not connect to MongoDB Atlas:', err));

// Middleware setup
app.use(cors()); // Enables cross-origin requests from your frontend
app.use(bodyParser.json()); // Parses incoming JSON requests

// ----------------------------------------------------
// Mongoose Schema Definitions
// ----------------------------------------------------

// Define the schema for a single message
const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
  status: { type: String, required: true },
  fromMe: { type: Boolean, required: true },
});

// Define the schema for a conversation
const ConversationSchema = new mongoose.Schema({
  wa_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  lastMessage: { type: String, default: '' },
  messages: [MessageSchema], // An array of messages
});

// Create the Mongoose model
const Conversation = mongoose.model('Conversation', ConversationSchema);

// ----------------------------------------------------
// API Endpoints
// ----------------------------------------------------

/**
 * GET /api/messages/conversations
 * Fetches all conversations from the MongoDB database.
 * This endpoint matches the fetch URL in your React frontend's useEffect hook.
 */
app.get('/api/messages/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find({});
    res.json(conversations);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

/**
 * POST /api/messages
 * Handles sending a new message from the frontend.
 * This endpoint matches the fetch URL in your React frontend's handleSendMessage function.
 */
app.post('/api/messages', async (req, res) => {
  const { wa_id, text } = req.body;
  if (!wa_id || !text) {
    return res.status(400).json({ error: 'Missing wa_id or text.' });
  }

  try {
    let conversation = await Conversation.findOne({ wa_id });
    
    // If conversation does not exist, create a new one
    if (!conversation) {
      conversation = new Conversation({
        wa_id,
        name: 'New User', // Placeholder name for a new user
        messages: [],
        lastMessage: '',
      });
      console.log(`Created new conversation for wa_id: ${wa_id}`);
    }

    const newId = `msg-${Date.now()}`;
    const timestamp = Date.now();
    
    // Add the new message to the conversation
    conversation.messages.push({
      id: newId,
      text: text,
      timestamp: timestamp,
      status: 'sent',
      fromMe: true,
    });
    conversation.lastMessage = text;

    // Save the updated conversation to the database
    await conversation.save();

    // Simulate webhook status updates asynchronously
    // This mimics how a real WhatsApp webhook would update message status.
    setTimeout(async () => {
      const deliveredConversation = await Conversation.findOne({ wa_id });
      if (deliveredConversation) {
        const messageToUpdate = deliveredConversation.messages.find(msg => msg.id === newId);
        if (messageToUpdate) {
          messageToUpdate.status = 'delivered';
          await deliveredConversation.save();
        }
      }
    }, 1000);

    setTimeout(async () => {
      const readConversation = await Conversation.findOne({ wa_id });
      if (readConversation) {
        const messageToUpdate = readConversation.messages.find(msg => msg.id === newId);
        if (messageToUpdate) {
          messageToUpdate.status = 'read';
          await readConversation.save();
        }
      }
    }, 3000);
    
    res.status(200).json({ message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
