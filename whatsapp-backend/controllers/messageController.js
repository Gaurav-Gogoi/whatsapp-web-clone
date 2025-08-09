// Example of a correct controller file (e.g., controllers/conversation.controller.js)

const Conversation = require('../models/Conversation'); // Assuming you have a Conversation model file

// Fetches all conversations with their messages
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({});
        res.status(200).json(conversations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Fetches all messages for a specific conversation
exports.getMessagesByWaId = async (req, res) => {
    try {
        const { wa_id } = req.params;
        const conversation = await Conversation.findOne({ wa_id });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(200).json(conversation.messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Adds a new message to a conversation
exports.createMessage = async (req, res) => {
    try {
        const { wa_id, text, id, timestamp, fromMe, status } = req.body;
        let conversation = await Conversation.findOne({ wa_id });

        if (!conversation) {
            conversation = new Conversation({
                wa_id,
                name: 'New User', // Placeholder name
                messages: [],
                lastMessage: text
            });
        }

        conversation.messages.push({
            id: id || `msg-${Date.now()}`,
            text,
            timestamp: timestamp || Date.now(),
            status: status || 'sent',
            fromMe
        });
        conversation.lastMessage = text;

        await conversation.save();
        res.status(201).json(conversation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Updates the status of a specific message within a conversation
exports.updateMessageStatus = async (req, res) => {
    try {
        const { wa_id, message_id } = req.params;
        const { status } = req.body;

        const conversation = await Conversation.findOne({ wa_id });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messageToUpdate = conversation.messages.find(msg => msg.id === message_id);
        if (!messageToUpdate) {
            return res.status(404).json({ error: 'Message not found in conversation' });
        }

        messageToUpdate.status = status;
        await conversation.save();

        res.status(200).json(messageToUpdate);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};