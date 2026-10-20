const Meeting = require('../models/Meeting');
const { generateUniqueRoomId } = require('../utils/generateRoomId');

const identity = (req) => ({
  id: req.user.isGuest ? req.user.id : String(req.userDoc._id),
  name: req.user.name,
});

// POST /api/meetings/create — instant meeting, live immediately
const createMeeting = async (req, res) => {
  try {
    const { title } = req.body;
    const { id, name } = identity(req);
    const roomId = await generateUniqueRoomId(Meeting);

    const meeting = await Meeting.create({
      roomId,
      hostId: id,
      title: title?.trim() || `${name}'s meeting`,
      status: 'live',
    });

    return res.status(201).json({ meeting });
  } catch (error) {
    console.error('createMeeting error:', error.message);
    return res.status(500).json({ message: 'Could not create meeting' });
  }
};

// POST /api/meetings/schedule — future meeting
const scheduleMeeting = async (req, res) => {
  try {
    const { title, scheduledTime } = req.body;
    if (!title || !scheduledTime) {
      return res.status(400).json({ message: 'Title and scheduledTime are required' });
    }

    const { id } = identity(req);
    const roomId = await generateUniqueRoomId(Meeting);

    const meeting = await Meeting.create({
      roomId,
      hostId: id,
      title: title.trim(),
      scheduledTime: new Date(scheduledTime),
      status: 'scheduled',
    });

    return res.status(201).json({ meeting });
  } catch (error) {
    console.error('scheduleMeeting error:', error.message);
    return res.status(500).json({ message: 'Could not schedule meeting' });
  }
};

// GET /api/meetings/history — MUST be registered before /:roomId in routes,
// otherwise Express matches "history" as a room code.
const getHistory = async (req, res) => {
  try {
    const { id } = identity(req);
    // Guests have no durable identity, so they have no history — this is
    // by design, not a bug.
    if (req.user.isGuest) return res.status(200).json({ meetings: [] });

    const meetings = await Meeting.find({
      $or: [{ hostId: id }, { 'participants.userId': id }],
    }).sort({ createdAt: -1 });

    return res.status(200).json({ meetings });
  } catch (error) {
    console.error('getHistory error:', error.message);
    return res.status(500).json({ message: 'Could not fetch meeting history' });
  }
};

// GET /api/meetings/:roomId — validate a room before joining
const getMeetingByRoomId = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.status(404).json({ message: 'No meeting found with that room code' });
    }
    if (meeting.status === 'ended') {
      return res.status(410).json({ message: 'This meeting has ended' });
    }
    return res.status(200).json({ meeting });
  } catch (error) {
    console.error('getMeetingByRoomId error:', error.message);
    return res.status(500).json({ message: 'Could not fetch meeting' });
  }
};

// POST /api/meetings/:roomId/join — register as a participant (idempotent)
const joinMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.status(404).json({ message: 'No meeting found with that room code' });
    }
    if (meeting.status === 'ended') {
      return res.status(410).json({ message: 'This meeting has ended' });
    }

    const { id, name } = identity(req);
    const alreadyIn = meeting.participants.some((p) => p.userId === id);
    if (!alreadyIn) {
      meeting.participants.push({ userId: id, name });
    }
    if (meeting.status === 'scheduled') meeting.status = 'live';
    await meeting.save();

    return res.status(200).json({ meeting });
  } catch (error) {
    console.error('joinMeeting error:', error.message);
    return res.status(500).json({ message: 'Could not join meeting' });
  }
};

// DELETE /api/meetings/:roomId — host ends the meeting
const endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.status(404).json({ message: 'No meeting found with that room code' });
    }

    const { id } = identity(req);
    if (meeting.hostId !== id) {
      return res.status(403).json({ message: 'Only the host can end this meeting' });
    }

    meeting.status = 'ended';
    await meeting.save();
    return res.status(200).json({ meeting });
  } catch (error) {
    console.error('endMeeting error:', error.message);
    return res.status(500).json({ message: 'Could not end meeting' });
  }
};

module.exports = {
  createMeeting,
  scheduleMeeting,
  getHistory,
  getMeetingByRoomId,
  joinMeeting,
  endMeeting,
};
