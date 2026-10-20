import { io } from 'socket.io-client';

// Same-origin by default: connects through Vite's dev proxy (see
// vite.config.js's '/socket.io' rule). This is what makes opening the
// frontend from another device on the LAN — via this machine's IP
// instead of localhost — work with no extra config: window.location.origin
// is whatever host the page was actually loaded from, so the proxy always
// forwards to the backend on THIS machine.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket = null;

const getSocket = () => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
  });

  socket.onAny((event, ...args) => console.log(`[socket:client] <- ${event}`, ...args));
  socket.on('connect', () => console.log(`[socket:client] connected: ${socket.id}`));
  socket.on('disconnect', (reason) => console.log(`[socket:client] disconnected (${reason})`));
  socket.on('connect_error', (err) => console.error('[socket:client] connect_error:', err.message));

  return socket;
};

const connectSocket = () => {
  const token = localStorage.getItem('token');
  const s = getSocket();
  if (!token) {
    console.warn('[socket:client] no token — cannot authenticate socket');
    return s;
  }
  s.auth = { token };
  if (!s.connected) s.connect();
  return s;
};

const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export { getSocket, connectSocket, disconnectSocket };
