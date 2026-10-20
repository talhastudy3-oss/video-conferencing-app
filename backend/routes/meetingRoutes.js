const express = require('express');
const router = express.Router();

const {
  createMeeting,
  scheduleMeeting,
  getHistory,
  getMeetingByRoomId,
  joinMeeting,
  endMeeting,
} = require('../controllers/meetingController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // every meeting route requires auth, guests included

router.post('/create', createMeeting);
router.post('/schedule', scheduleMeeting);

// MUST come before '/:roomId' or Express matches "history" as a room code.
router.get('/history', getHistory);

router.get('/:roomId', getMeetingByRoomId);
router.post('/:roomId/join', joinMeeting);
router.delete('/:roomId', endMeeting);

module.exports = router;
