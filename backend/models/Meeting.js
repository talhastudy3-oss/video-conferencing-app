const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MeetingSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    // unique: true already creates the index — no separate index:true,
    // which would make Mongoose warn about a duplicate index on startup.
    unique: true,
  },
  hostId: { type: String, required: true },
  title: { type: String, required: true, trim: true, default: 'Untitled meeting' },
  scheduledTime: { type: Date, default: null },
  participants: { type: [ParticipantSchema], default: [] },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Meeting', MeetingSchema);
