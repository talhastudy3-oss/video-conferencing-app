import { useCallback, useEffect, useRef } from 'react';

const statusColor = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
  failed: 'bg-red-500',
};

/** One participant's tile. `videoRef` can be passed in by the parent
 * (needed for the recorder, which reads pixels straight off these video
 * elements) — otherwise the tile creates and manages its own. */
const VideoTile = ({
  stream,
  name,
  isLocal = false,
  isHost = false,
  videoOff = false,
  audioOff = false,
  handRaised = false,
  isSpeaking = false,
  connectionState = null,
  fill = false,
  videoRef: externalRef,
}) => {
  // Always keep our own ref to the <video> so srcObject can be set no matter
  // what the parent passes. `externalRef` is usually a CALLBACK ref (the
  // recorder needs the raw element), and a callback has no `.current` —
  // reading it directly would leave the stream unattached and the tile blank.
  const internalRef = useRef(null);
  const setVideoEl = useCallback(
    (el) => {
      internalRef.current = el;
      if (typeof externalRef === 'function') externalRef(el);
      else if (externalRef) externalRef.current = el;
    },
    [externalRef]
  );

  useEffect(() => {
    if (internalRef.current) internalRef.current.srcObject = stream || null;
  }, [stream]);

  const showAvatar = videoOff || !stream;
  const initial = (name || '?').charAt(0).toUpperCase();
  const dotColor = !isLocal && connectionState ? statusColor[connectionState] || 'bg-gray-400' : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gray-900 ring-1 transition ${
        fill ? 'h-full w-full' : 'aspect-video'
      } ${isSpeaking ? 'ring-2 ring-green-400' : 'ring-gray-800'}`}
    >
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${showAvatar ? 'hidden' : ''}`}
      />

      {showAvatar && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-xl font-semibold text-white">
            {initial}
          </div>
        </div>
      )}

      {!stream && !isLocal && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-xs text-gray-400">
          Connecting...
        </div>
      )}

      {handRaised && <span className="absolute right-2 top-2 text-lg">✋</span>}
      {dotColor && <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${dotColor}`} />}

      <span className="absolute bottom-2 left-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {name}
        {isLocal && ' (you)'}
        {isHost && ' · host'}
        {audioOff && ' · muted'}
      </span>
    </div>
  );
};

export default VideoTile;
