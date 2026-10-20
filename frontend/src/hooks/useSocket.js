import { useEffect, useRef, useState, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';

/**
 * Owns the Socket.IO connection for one meeting room: connects, joins,
 * keeps a live participant roster, and surfaces meeting-ended/removed as
 * separate flags. Also handles reconnection: Socket.IO's Manager retries
 * automatically on a dropped connection, and this hook re-emits
 * `join-room` on every successful reconnect (the server treats a repeat
 * join as a harmless resync), so a brief network blip doesn't require the
 * user to do anything.
 */
const useSocket = (roomId, userInfo, { enabled = true } = {}) => {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [socketError, setSocketError] = useState('');
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [removed, setRemoved] = useState(false);

  const socketRef = useRef(null);
  const userInfoRef = useRef(userInfo);
  userInfoRef.current = userInfo;

  useEffect(() => {
    if (!roomId || !enabled) return undefined;

    const socket = connectSocket();
    socketRef.current = socket;

    const emitJoinRoom = () => {
      console.log(`[socket:client] emitting join-room for ${roomId}`);
      socket.emit('join-room', { roomId, userInfo: userInfoRef.current });
    };

    const handleConnect = () => {
      setConnected(true);
      setReconnecting(false);
      emitJoinRoom();
    };

    const handleDisconnect = (reason) => {
      setConnected(false);
      // 'io server disconnect' / 'io client disconnect' are deliberate
      // (we called disconnect() ourselves) — anything else is a real
      // network drop, which Socket.IO will auto-retry.
      if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
        setReconnecting(true);
      }
    };

    const handleExisting = ({ participants: existing } = {}) => setParticipants(existing || []);
    const handleUserJoined = ({ participant } = {}) => {
      if (!participant) return;
      setParticipants((prev) =>
        prev.some((p) => p.socketId === participant.socketId) ? prev : [...prev, participant]
      );
    };
    const handleUserLeft = ({ socketId } = {}) =>
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    const handleParticipantUpdated = ({ participant } = {}) => {
      if (!participant) return;
      setParticipants((prev) => prev.map((p) => (p.socketId === participant.socketId ? participant : p)));
    };
    const handleErrorMessage = ({ message } = {}) => setSocketError(message || 'A socket error occurred');
    const handleMeetingEnded = () => setMeetingEnded(true);
    const handleRemoved = () => setRemoved(true);
    const handleReconnectFailed = () =>
      setSocketError('Could not reconnect to the meeting. Check your connection and refresh.');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('existing-participants', handleExisting);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('participant-updated', handleParticipantUpdated);
    socket.on('error-message', handleErrorMessage);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('removed-from-meeting', handleRemoved);
    // Manager-level events (not custom backend events) — fire on the
    // underlying reconnection engine, not the socket itself.
    socket.io.on('reconnect_attempt', () => setReconnecting(true));
    socket.io.on('reconnect_failed', handleReconnectFailed);

    if (socket.connected) {
      setConnected(true);
      emitJoinRoom();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('existing-participants', handleExisting);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('participant-updated', handleParticipantUpdated);
      socket.off('error-message', handleErrorMessage);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('removed-from-meeting', handleRemoved);
      socket.io.off('reconnect_attempt');
      socket.io.off('reconnect_failed', handleReconnectFailed);

      console.log(`[socket:client] emitting leave-room for ${roomId}`);
      socket.emit('leave-room');
      disconnectSocket();
    };
  }, [roomId, enabled]);

  const emit = useCallback((event, payload) => {
    if (!socketRef.current) {
      console.warn(`[socket:client] tried to emit "${event}" before the socket was ready`);
      return;
    }
    socketRef.current.emit(event, payload);
  }, []);

  return { connected, reconnecting, participants, socketError, meetingEnded, removed, emit };
};

export default useSocket;
