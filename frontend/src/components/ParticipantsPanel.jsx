const StatusIcons = ({ muted, videoOff }) => (
  <span className="flex shrink-0 gap-1 text-sm">
    <span title={muted ? 'Muted' : 'Mic on'}>{muted ? '🔇' : '🎤'}</span>
    <span title={videoOff ? 'Camera off' : 'Camera on'}>{videoOff ? '🚫' : '📷'}</span>
  </span>
);

/**
 * Participants sidebar. Everyone sees the list with mic/camera status and
 * raised hands; only the host sees Mute / Remove / Mute all. The server
 * re-checks host status on every one of those events, so hiding the
 * buttons here is a convenience, not the security boundary.
 */
const ParticipantsPanel = ({
  localName,
  localMuted,
  localVideoOff,
  localHandRaised,
  isHost,
  participants,
  onMute,
  onRemove,
  onMuteAll,
  onClose,
}) => {
  const anyoneToMute = participants.some((p) => !p.muted);

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900 sm:w-80">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Participants ({participants.length + 1})
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          ✕
        </button>
      </div>

      {isHost && participants.length > 0 && (
        <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <button
            onClick={onMuteAll}
            disabled={!anyoneToMute}
            className="w-full rounded-lg bg-gray-100 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Mute all
          </button>
        </div>
      )}

      <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
        <li className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
            {localName || 'You'} (you){isHost && ' · host'}
            {localHandRaised && ' ✋'}
          </span>
          <StatusIcons muted={localMuted} videoOff={localVideoOff} />
        </li>

        {participants.map((p) => (
          <li key={p.socketId} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
                {p.name}
                {p.isHost && ' · host'}
                {p.handRaised && ' ✋'}
              </span>
              <StatusIcons muted={p.muted} videoOff={p.videoOff} />
            </div>

            {isHost && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onMute(p.socketId)}
                  disabled={p.muted}
                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Mute
                </button>
                <button
                  onClick={() => onRemove(p.socketId)}
                  className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantsPanel;
