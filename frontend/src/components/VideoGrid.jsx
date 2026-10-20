import VideoTile from './VideoTile';

const getGridColsClass = (count) => {
  if (count <= 1) return 'grid-cols-1 max-w-2xl';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-4xl';
  if (count <= 4) return 'grid-cols-2 max-w-4xl';
  if (count <= 6) return 'grid-cols-2 sm:grid-cols-3 max-w-5xl';
  if (count <= 9) return 'grid-cols-3 max-w-6xl';
  return 'grid-cols-3 sm:grid-cols-4 max-w-6xl';
};

/** Gallery view: one tile per participant (local + remote), joined by
 * socketId to the roster (names/host/hand) and the WebRTC streams. */
const VideoGrid = ({
  localUser,
  localStream,
  micOn,
  camOn,
  participants,
  remoteStreams,
  speakingIds,
  registerTileRef,
}) => {
  const tileCount = 1 + participants.length;

  return (
    <div className={`grid w-full gap-4 ${getGridColsClass(tileCount)}`}>
      <VideoTile
        stream={localStream}
        name={localUser?.name || 'You'}
        isLocal
        videoOff={!camOn}
        audioOff={!micOn}
        isSpeaking={speakingIds?.has('local')}
        videoRef={registerTileRef ? (el) => registerTileRef('local', el) : undefined}
      />

      {participants.map((p) => (
        <VideoTile
          key={p.socketId}
          stream={remoteStreams.get(p.socketId)}
          name={p.name}
          isHost={p.isHost}
          audioOff={p.muted}
          videoOff={p.videoOff}
          handRaised={p.handRaised}
          isSpeaking={speakingIds?.has(p.socketId)}
          connectionState={remoteStreams.get(p.socketId) ? 'connected' : 'connecting'}
          videoRef={registerTileRef ? (el) => registerTileRef(p.socketId, el) : undefined}
        />
      ))}
    </div>
  );
};

export default VideoGrid;
