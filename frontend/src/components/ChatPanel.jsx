import { useState, useRef, useEffect } from 'react';

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatPanel = ({ messages, onSend, onClose, localSocketId }) => {
  const [text, setText] = useState('');
  const listEndRef = useRef(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900 sm:w-80">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">In-call messages</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400">No messages yet — say hi!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.senderId === localSocketId ? 'text-right' : ''}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {m.senderId === localSocketId ? 'You' : m.senderName} · {formatTime(m.timestamp)}
            </p>
            <p
              className={`mt-0.5 inline-block max-w-[85%] break-words rounded-lg px-3 py-1.5 text-sm ${
                m.senderId === localSocketId
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-800">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
