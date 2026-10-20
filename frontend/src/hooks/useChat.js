import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';

/** Real-time chat over the same socket connection useSocket() already
 * joined the room on. Tracks unread count while the panel is closed. */
const useChat = (roomId, { panelOpen }) => {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  useEffect(() => {
    if (!roomId) return undefined;
    const socket = getSocket();

    const handleReceive = (message) => {
      setMessages((prev) => [...prev, message]);
      if (!panelOpenRef.current) setUnreadCount((prev) => prev + 1);
    };

    socket.on('receive-message', handleReceive);
    return () => socket.off('receive-message', handleReceive);
  }, [roomId]);

  useEffect(() => {
    if (panelOpen) setUnreadCount(0);
  }, [panelOpen]);

  const sendMessage = useCallback((text) => {
    if (!text?.trim()) return;
    getSocket().emit('send-message', { text: text.trim() });
  }, []);

  return { messages, unreadCount, sendMessage };
};

export default useChat;
