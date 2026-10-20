const jwt = require('jsonwebtoken');
const Meeting = require('../models/Meeting');

// In-memory room map: roomId -> Map<socketId, participant>. This is live
// presence (who's actually connected right now), separate from the
// Meeting.participants array in Mongo (who has ever joined, for history).
const rooms = new Map();

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
};

const othersInRoom = (roomId, excludeSocketId) =>
  Array.from(getRoom(roomId).values()).filter((p) => p.socketId !== excludeSocketId);

// JWT auth for the socket handshake — same tokens as the REST API (email/
// password, Google, or guest all work identically here).
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, name, isGuest }
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};

const initMeetingSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (${socket.user.name})`);

    const removeFromCurrentRoom = () => {
      const { roomId } = socket;
      if (!roomId) return;
      const room = getRoom(roomId);
      room.delete(socket.id);
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      console.log(`[socket] ${socket.id} left room ${roomId}`);
      if (room.size === 0) rooms.delete(roomId);
      socket.leave(roomId);
      socket.roomId = null;
    };

    // Whoever is HOST is derived from Meeting.hostId in Mongo, never
    // trusted from the client payload.
    socket.on('join-room', async ({ roomId, userInfo } = {}) => {
      console.log(`[socket] join-room <- ${socket.id} room=${roomId}`);
      if (!roomId) return;

      try {
        const meeting = await Meeting.findOne({ roomId });
        if (!meeting || meeting.status === 'ended') {
          socket.emit('error-message', { message: 'This meeting is not available' });
          return;
        }

        // Re-joining the same room (e.g. reconnect) is a harmless resync,
        // not a duplicate join.
        if (socket.roomId === roomId) {
          socket.emit('existing-participants', { participants: othersInRoom(roomId, socket.id) });
          return;
        }
        if (socket.roomId) removeFromCurrentRoom();

        const participant = {
          socketId: socket.id,
          userId: socket.user.id,
          name: userInfo?.name || socket.user.name,
          isGuest: !!socket.user.isGuest,
          isHost: meeting.hostId === socket.user.id,
          // Starting mic/cam state comes from the client (what the user
          // picked in the lobby) — cosmetic status only, never trusted for
          // anything security-related like isHost above.
          muted: !!userInfo?.muted,
          videoOff: !!userInfo?.videoOff,
          handRaised: false,
        };

        getRoom(roomId).set(socket.id, participant);
        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit('existing-participants', { participants: othersInRoom(roomId, socket.id) });
        socket.to(roomId).emit('user-joined', { participant });
      } catch (err) {
        console.error('[socket] join-room error:', err.message);
        socket.emit('error-message', { message: 'Could not join the room' });
      }
    });

    // --- WebRTC signaling relay: dumb pass-through, swap 'to' for 'from' ---
    socket.on('offer', ({ to, offer } = {}) => {
      console.log(`[socket] offer <- ${socket.id} -> ${to}`);
      if (!to || !offer) return;
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer } = {}) => {
      console.log(`[socket] answer <- ${socket.id} -> ${to}`);
      if (!to || !answer) return;
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate } = {}) => {
      console.log(`[socket] ice-candidate <- ${socket.id} -> ${to}`);
      if (!to || !candidate) return;
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // --- Self-reported status (mic/cam toggle) broadcast to the room ---
    socket.on('update-status', ({ muted, videoOff } = {}) => {
      const { roomId } = socket;
      if (!roomId) return;
      const participant = getRoom(roomId).get(socket.id);
      if (!participant) return;
      if (typeof muted === 'boolean') participant.muted = muted;
      if (typeof videoOff === 'boolean') participant.videoOff = videoOff;
      io.to(roomId).emit('participant-updated', { participant });
    });

    // --- Raise / lower hand ---
    socket.on('raise-hand', () => {
      const { roomId } = socket;
      if (!roomId) return;
      const participant = getRoom(roomId).get(socket.id);
      if (!participant) return;
      participant.handRaised = true;
      io.to(roomId).emit('participant-updated', { participant });
    });

    socket.on('lower-hand', () => {
      const { roomId } = socket;
      if (!roomId) return;
      const participant = getRoom(roomId).get(socket.id);
      if (!participant) return;
      participant.handRaised = false;
      io.to(roomId).emit('participant-updated', { participant });
    });

    // --- Chat ---
    socket.on('send-message', ({ text } = {}) => {
      const { roomId } = socket;
      if (!roomId || !text?.trim()) return;
      const message = {
        id: `${socket.id}-${Date.now()}`,
        senderId: socket.id,
        senderName: socket.user.name,
        text: text.trim().slice(0, 2000),
        timestamp: Date.now(),
      };
      io.to(roomId).emit('receive-message', message);
    });

    // --- Host-only controls: verified against Mongo's hostId, not the
    // client's claim of being host ---
    const requireHost = async (callback) => {
      const { roomId } = socket;
      if (!roomId) return;
      const meeting = await Meeting.findOne({ roomId });
      if (!meeting || meeting.hostId !== socket.user.id) {
        socket.emit('error-message', { message: 'Only the host can do that' });
        return;
      }
      callback(meeting);
    };

    socket.on('mute-participant', ({ socketId } = {}) => {
      requireHost(() => {
        const participant = getRoom(socket.roomId).get(socketId);
        if (!participant) return;
        participant.muted = true;
        io.to(socket.roomId).emit('participant-updated', { participant });
        io.to(socketId).emit('force-mute');
      });
    });

    socket.on('mute-all', () => {
      requireHost(() => {
        const room = getRoom(socket.roomId);
        room.forEach((participant, sockId) => {
          if (sockId === socket.id || participant.muted) return;
          participant.muted = true;
          io.to(socket.roomId).emit('participant-updated', { participant });
          io.to(sockId).emit('force-mute');
        });
      });
    });

    socket.on('remove-participant', ({ socketId } = {}) => {
      requireHost(() => {
        io.to(socketId).emit('removed-from-meeting');
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          getRoom(socket.roomId).delete(socketId);
          io.to(socket.roomId).emit('user-left', { socketId });
          targetSocket.leave(socket.roomId);
          targetSocket.roomId = null;
        }
      });
    });

    socket.on('end-meeting-for-all', () => {
      requireHost(async (meeting) => {
        meeting.status = 'ended';
        await meeting.save();
        io.to(socket.roomId).emit('meeting-ended');
        rooms.delete(socket.roomId);
      });
    });

    socket.on('leave-room', removeFromCurrentRoom);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      removeFromCurrentRoom();
    });
  });
};

module.exports = initMeetingSocket;
