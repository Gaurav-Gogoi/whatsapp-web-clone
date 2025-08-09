const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/messageController');

router.post('/', ctrl.createMessage);
router.get('/conversations', ctrl.getConversations);
router.get('/:wa_id', ctrl.getMessagesByWaId);
router.put('/status/:id', ctrl.updateMessageStatus);

module.exports = router;
