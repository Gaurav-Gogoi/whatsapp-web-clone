// scripts/read_payloads.js
// This script processes webhook payload JSON files and loads them into MongoDB.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, '../.env') });

// The MongoDB connection URI provided by the user


const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
}

// ----------------------------------------------------
// Mongoose Schema Definitions
// ----------------------------------------------------

// Define the schema for a single message
const MessageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String, required: false }, // Text is not always present (e.g., for media messages)
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

// Connect to MongoDB Atlas
async function connect() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (err) {
        console.error('Could not connect to MongoDB Atlas:', err);
        process.exit(1);
    }
}

// Extract message and status data from the nested webhook payload
function extractDataFromPayload(payload) {
    const data = [];
    try {
        const entryList = payload?.metaData?.entry || [];
        entryList.forEach(entry => {
            entry.changes?.forEach(change => {
                const value = change.value || {};
                const myNumber = value.metadata?.display_phone_number;

                // Process incoming / outgoing messages
                if (value.messages && Array.isArray(value.messages)) {
                    value.messages.forEach(msg => {
                        const isFromMe = msg.from === myNumber;
                        let conversationId = null;

                        if (isFromMe) {
                            // Correctly get the recipient's wa_id for outgoing messages
                            conversationId = value.contacts?.[0]?.wa_id;
                        } else {
                            // For incoming messages, the sender is in the `from` field
                            conversationId = msg.from;
                        }

                        if (conversationId) {
                            data.push({
                                type: "message",
                                conversationId: conversationId,
                                message_id: msg.id,
                                text: msg.text?.body || null,
                                timestamp: msg.timestamp ? parseInt(msg.timestamp) * 1000 : Date.now(),
                                name: value.contacts?.[0]?.profile?.name || null,
                                fromMe: isFromMe,
                            });
                        }
                    });
                }

                // Process status updates (delivered, read, etc.)
                if (value.statuses && Array.isArray(value.statuses)) {
                    value.statuses.forEach(stat => {
                        // Correctly get the recipient's wa_id from the contacts array
                        const conversationId = value.contacts?.[0]?.wa_id || stat.recipient_id;

                        if (conversationId) {
                            data.push({
                                type: "status",
                                conversationId: conversationId,
                                message_id: stat.id,
                                status: stat.status,
                                timestamp: stat.timestamp ? parseInt(stat.timestamp) * 1000 : Date.now(),
                            });
                        }
                    });
                }
            });
        });
    } catch (err) {
        console.error("Error extracting messages:", err.message);
    }
    return data;
}

// Main function to read payloads and seed the database
async function main() {
    try {
        await connect();
        const dir = path.join(__dirname, "..", "payloads");
        if (!fs.existsSync(dir)) {
            console.error("Payloads directory not found:", dir);
            process.exit(1);
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
        console.log(`Found ${files.length} JSON files to process.`);
        if (files.length === 0) {
            console.log('No JSON files found in payloads directory. Exiting.');
            return;
        }

        const conversationsMap = new Map();

        // 1. Process all files and build an in-memory map of conversations
        for (const f of files) {
            console.log(`Processing file: ${f}`);
            const filepath = path.join(dir, f);
            const raw = fs.readFileSync(filepath, "utf8");
            let payload;
            try {
                payload = JSON.parse(raw);
            } catch (e) {
                console.error(`Invalid JSON in file: ${filepath}`);
                continue;
            }
            
            const items = Array.isArray(payload) ? payload : [payload];
            for (const item of items) {
                const data = extractDataFromPayload(item);
                data.forEach(d => {
                    if (!conversationsMap.has(d.conversationId)) {
                        console.log(`- New conversation identified with WA ID: ${d.conversationId}`);
                        conversationsMap.set(d.conversationId, {
                            wa_id: d.conversationId,
                            name: d.name || 'Unknown User',
                            messages: [],
                            lastMessage: ''
                        });
                    }
                    
                    const conversation = conversationsMap.get(d.conversationId);
                    if (d.type === 'message') {
                        const messageExists = conversation.messages.some(msg => msg.id === d.message_id);
                        if (!messageExists) {
                            conversation.messages.push({
                                id: d.message_id,
                                text: d.text,
                                timestamp: d.timestamp,
                                status: 'sent',
                                fromMe: d.fromMe
                            });
                            conversation.lastMessage = d.text;
                            console.log(`  > Added message with ID ${d.message_id} to conversation ${d.conversationId}`);
                        }
                    } else if (d.type === 'status') {
                        const messageToUpdate = conversation.messages.find(msg => msg.id === d.message_id);
                        if (messageToUpdate) {
                            messageToUpdate.status = d.status;
                            console.log(`  > Updated status of message ${d.message_id} to '${d.status}'`);
                        }
                    }
                });
            }
        }
        
        // Sort messages within each conversation by timestamp
        conversationsMap.forEach(conv => {
            conv.messages.sort((a, b) => a.timestamp - b.timestamp);
        });
        
        console.log(`\nFinished processing all files. Found a total of ${conversationsMap.size} unique conversations.`);

        // 2. Save/Update conversations in the database
        for (const [wa_id, convData] of conversationsMap.entries()) {
            let conversation = await Conversation.findOne({ wa_id });
            if (conversation) {
                console.log(`Updating existing conversation with WA ID: ${wa_id}`);
                // Update existing conversation with new messages and statuses
                convData.messages.forEach(newMessage => {
                    const existingMessage = conversation.messages.find(msg => msg.id === newMessage.id);
                    if (!existingMessage) {
                        conversation.messages.push(newMessage);
                    } else {
                        existingMessage.status = newMessage.status;
                    }
                });
                conversation.messages.sort((a, b) => a.timestamp - b.timestamp);
                conversation.lastMessage = conversation.messages[conversation.messages.length - 1]?.text || '';
                await conversation.save();
            } else {
                console.log(`Creating new conversation with WA ID: ${wa_id}`);
                // Create new conversation
                const newConversation = new Conversation(convData);
                await newConversation.save();
            }
        }
        
        console.log("\nPayload processing complete. Database has been seeded.");
        process.exit(0);
    } catch (err) {
        console.error("An error occurred:", err);
        process.exit(1);
    }
}

main();