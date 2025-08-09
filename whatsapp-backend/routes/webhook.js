const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

router.post('/process', async (req, res) => {
  const payload = req.body || {};
  try {
    if (payload.status || payload.type === 'status' || payload.event === 'status') {
      const metaId = payload.meta_msg_id || payload.message_id || payload.id;
      const status = payload.status || payload.type || payload.event;
      const msg = await Message.findOne({ $or: [{ meta_msg_id: metaId }, { message_id: metaId }] });
      if (msg) {
        msg.status = status;
        msg.statuses = msg.statuses || [];
        msg.statuses.push({ status, timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(), raw: payload });
        await msg.save();
        return res.json({ ok: true, updated: true, msg });
      } else {
        return res.status(404).json({ ok:false, message: 'Referenced message not found' });
      }
    } else {
      const doc = {
        message_id: payload.message_id || payload.id || payload.msg_id,
        meta_msg_id: payload.meta_msg_id,
        wa_id: payload.from || payload.wa_id || payload.to,
        from: payload.from,
        to: payload.to,
        name: payload.name || (payload.contact && payload.contact.name),
        text: payload.text || (payload.message && payload.message.text) || payload.body || null,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        status: payload.status || 'sent',
        raw_payload: payload
      };
      const m = new Message(doc);
      await m.save();
      return res.status(201).json({ ok:true, saved: m });
    }
  } catch(err) {
    console.error(err);
    res.status(500).json({ ok:false, error: 'server error' });
  }
});

module.exports = router;
