import VideoTile from './VideoTile';

/** Speaker view: one large tile for whoever's currently talking (falls
 * back to the local user if nobody is), with a filmstrip of everyone
 * else along the bottom. */
const SpeakerView = ({
  localUser,
  localStream,
  micOn,
  camOn,
  participants,
  remoteStreams,
  activeSpeakerId,
  speakingIds,
  registerTileRef,
}) => {
  const featuredRemote = participants.find((p) => p.socketId === activeSpeakerId);
  const featuringLocal = !featuredRemote;

  const filmstrip = featuringLocal
    ? participants
    : [{ isLocalPlaceholder: true }, ...participants.filter((p) => p.socketId !== activeSpeakerId)];

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="min-h-0 flex-1">
        {featuringLocal ? (
          <VideoTile
            stream={localStream}
            name={localUser?.name || 'You'}
            isLocal
            videoOff={!camOn}
            audioOff={!micOn}
            isSpeaking={speakingIds?.has('local')}
            fill
            videoRef={registerTileRef ? (el) => registerTileRef('local', el) : undefined}
          />
        ) : (
          <VideoTile
            stream={remoteStreams.get(featuredRemote.socketId)}
            name={featuredRemote.name}
            isHost={featuredRemote.isHost}
            audioOff={featuredRemote.muted}
            videoOff={featuredRemote.videoOff}
            handRaised={featuredRemote.handRaised}
            isSpeaking
            fill
            videoRef={registerTileRef ? (el) => registerTileRef(featuredRemote.socketId, el) : undefined}
          />
        )}
      </div>

      {filmstrip.length > 0 && (
        <div className="flex h-20 shrink-0 gap-2 overflow-x-auto">
          {filmstrip.map((p) =>
            p.isLocalPlaceholder ? (
              <div key="local" className="h-20 w-32 shrink-0">
                <VideoTile
                  stream={localStream}
                  name={localUser?.name || 'You'}
                  isLocal
                  videoOff={!camOn}
                  audioOff={!micOn}
                  isSpeaking={speakingIds?.has('local')}
                  fill
                  videoRef={registerTileRef ? (el) => registerTileRef('local-strip', el) : undefined}
                />
              </div>
            ) : (
              <div key={p.socketId} className="h-20 w-32 shrink-0">
                <VideoTile
                  stream={remoteStreams.get(p.socketId)}
                  name={p.name}
                  isHost={p.isHost}
                  audioOff={p.muted}
                  videoOff={p.videoOff}
                  handRaised={p.handRaised}
                  isSpeaking={speakingIds?.has(p.socketId)}
                  fill
                  videoRef={registerTileRef ? (el) => registerTileRef(`${p.socketId}-strip`, el) : undefined}
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default SpeakerView;
