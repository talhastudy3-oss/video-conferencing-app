import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { meetingsAPI } from '../services/api';
import { getSocket } from '../services/socket';
import useSocket from '../hooks/useSocket';
import useWebRTC from '../hooks/useWebRTC';
import useChat from '../hooks/useChat';
import useActiveSpeaker from '../hooks/useActiveSpeaker';
import useRecording from '../hooks/useRecording';
import VideoGrid from '../components/VideoGrid';
import SpeakerView from '../components/SpeakerView';
import ChatPanel from '../components/ChatPanel';
import ParticipantsPanel from '../components/ParticipantsPanel';

/** Round footer button; `badge` shows a small count in the corner. */
const ControlButton = ({ onClick, title, active = true, danger = false, disabled = false, badge = 0, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white transition disabled:opacity-40 ${
      danger || !active ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-800 hover:bg-gray-700'
    }`}
  >
    {children}
    {badge > 0 && (
      <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold">
        {badge > 9 ? '9+' : badge}
      </span>
    )}
  </button>
);

/**
 * The in-call screen.
 *  - useSocket()        who is here (roster, host flag, mic/cam/hand status)
 *  - useWebRTC()        camera/mic, the peer-to-peer mesh, screen sharing
 *  - useChat()          in-call messages over the same socket
 *  - useActiveSpeaker() who is talking (Web Audio API)
 *  - useRecording()     host-only local recording to a .webm download
 */
const MeetingRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Mic/cam choices made in the lobby (host path skips the lobby -> both on).
  const prefs = location.state || {};
  const [micOn, setMicOn] = useState(prefs.micOn ?? true);
  const [camOn, setCamOn] = useState(prefs.camOn ?? true);
  const [forceMuted, setForceMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'speaker'
  const [panel, setPanel] = useState(null); // null | 'chat' | 'participants'
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const micOnRef = useRef(micOn);
  const camOnRef = useRef(camOn);
  micOnRef.current = micOn;
  camOnRef.current = camOn;

  const isHost = !!(meeting && user && meeting.hostId === user.id);
  const ready = !!meeting; // socket + camera only start once the room is confirmed to exist

  // 1. Confirm the room exists and is open, and register as a participant.
  //    The server treats a repeat join as a no-op, so this is safe whether
  //    we came from the lobby or straight from "New Meeting".
  //    404 = no such meeting, 410 = already ended.
  useEffect(() => {
    let cancelled = false;
    meetingsAPI
      .join(roomId)
      .then(({ data }) => {
        if (!cancelled) setMeeting(data.meeting);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not join this meeting.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // 2. Live room: socket presence + WebRTC mesh.
  const userInfo = {
    userId: user?.id,
    name: user?.name,
    isGuest: !!user?.isGuest,
    muted: !micOn, // starting status, shown to everyone else on join
    videoOff: !camOn,
  };
  const { connected, reconnecting, participants, socketError, meetingEnded, removed, emit } = useSocket(
    roomId,
    userInfo,
    { enabled: ready }
  );
  const { localStream, remoteStreams, mediaError, retryMedia, isScreenSharing, startScreenShare, stopScreenShare } =
    useWebRTC(roomId, ready);
  const { messages, unreadCount, sendMessage } = useChat(roomId, { panelOpen: panel === 'chat' });
  const { speakingIds, activeSpeakerId } = useActiveSpeaker(localStream, remoteStreams);

  // --- Recording (host only). getTiles/getAudioStreams read from refs, not
  // closures, because useRecording captures them once at start but the
  // room keeps changing while it records. ---
  const tileRefs = useRef(new Map()); // tile id -> <video> element
  const participantsRef = useRef(participants);
  const localStreamRef = useRef(localStream);
  const remoteStreamsRef = useRef(remoteStreams);
  const userNameRef = useRef(user?.name);
  participantsRef.current = participants;
  localStreamRef.current = localStream;
  remoteStreamsRef.current = remoteStreams;
  userNameRef.current = user?.name;

  const registerTileRef = useCallback((id, el) => {
    if (el) tileRefs.current.set(id, el);
    else tileRefs.current.delete(id);
  }, []);

  const getTiles = () =>
    Array.from(tileRefs.current.entries()).map(([id, el]) => {
      const baseId = id.replace(/-strip$/, ''); // speaker-view filmstrip tiles
      const label =
        baseId === 'local'
          ? userNameRef.current || 'You'
          : participantsRef.current.find((p) => p.socketId === baseId)?.name || '';
      return { videoEl: el, label };
    });

  const getAudioStreams = () => [localStreamRef.current, ...remoteStreamsRef.current.values()].filter(Boolean);

  const { isRecording, startRecording, stopRecording } = useRecording({ getTiles, getAudioStreams });

  // Apply mic/cam state to the real tracks as soon as a stream exists
  // (including a fresh one after a permission Retry).
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = micOnRef.current;
    });
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = camOnRef.current;
    });
  }, [localStream]);

  // The host can force-mute us.
  useEffect(() => {
    const socket = getSocket();
    const handleForceMute = () => {
      localStream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      setMicOn(false);
      setForceMuted(true);
    };
    socket.on('force-mute', handleForceMute);
    return () => socket.off('force-mute', handleForceMute);
  }, [localStream]);

  // Host gets a toast when someone newly raises their hand.
  const raisedRef = useRef(new Set());
  useEffect(() => {
    if (isHost) {
      participants.forEach((p) => {
        if (p.handRaised && !raisedRef.current.has(p.socketId)) setToast(`${p.name} raised their hand ✋`);
      });
    }
    raisedRef.current = new Set(participants.filter((p) => p.handRaised).map((p) => p.socketId));
  }, [participants, isHost]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Leaving (or being kicked) mid-recording still saves the file. Camera
  // and peer connections are released by the hooks' own cleanup on unmount.
  const leaveTo = useCallback(
    async (state) => {
      if (isRecording) await stopRecording();
      navigate('/dashboard', state ? { replace: true, state } : undefined);
    },
    [isRecording, stopRecording, navigate]
  );

  useEffect(() => {
    if (meetingEnded) leaveTo({ notice: 'The meeting has ended' });
    else if (removed) leaveTo({ notice: 'You were removed from the meeting' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingEnded, removed]);

  // --- Controls ---
  const toggleMic = () => {
    if (!localStream) return;
    const next = !micOn;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
    if (next) setForceMuted(false);
    emit('update-status', { muted: !next });
  };

  const toggleCam = () => {
    if (!localStream) return;
    const next = !camOn;
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
    emit('update-status', { videoOff: !next });
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    emit(next ? 'raise-hand' : 'lower-hand');
  };

  const togglePanel = (name) => setPanel((current) => (current === name ? null : name));

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${roomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard needs a secure context; the room code is on screen regardless
    }
  };

  const handleEndForAll = () => {
    setEnding(true);
    emit('end-meeting-for-all'); // the 'meeting-ended' broadcast redirects everyone, us included
  };

  // --- Loading / error states ---
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
        <p className="text-gray-400">Connecting to meeting...</p>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-center">
        <p className="text-lg font-medium text-white">{error}</p>
        <Link to="/dashboard" className="text-sm font-medium text-brand-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const viewProps = {
    localUser: user,
    localStream,
    micOn,
    camOn,
    participants,
    remoteStreams,
    speakingIds,
    registerTileRef,
  };
  const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{meeting?.title}</h1>
          <p className="font-mono text-xs text-gray-500">{roomId}</p>
        </div>
        <button
          onClick={handleCopyLink}
          className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
        >
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
      </header>

      {/* Status banners */}
      {reconnecting && (
        <p className="bg-amber-600 px-4 py-1.5 text-center text-xs font-medium">Connection lost — reconnecting...</p>
      )}
      {ready && !connected && !reconnecting && !socketError && (
        <p className="bg-gray-800 px-4 py-1.5 text-center text-xs text-gray-300">Connecting to the room...</p>
      )}
      {socketError && <p className="bg-red-700 px-4 py-1.5 text-center text-xs">{socketError}</p>}
      {mediaError && (
        <div className="flex items-center justify-center gap-3 bg-amber-900/60 px-4 py-1.5 text-xs text-amber-100">
          <span>{mediaError}</span>
          <button onClick={retryMedia} className="rounded bg-amber-600 px-2 py-0.5 font-semibold hover:bg-amber-500">
            Retry
          </button>
        </div>
      )}
      {isScreenSharing && (
        <div className="flex items-center justify-center gap-3 bg-brand-700 px-4 py-1.5 text-xs font-medium">
          <span>You are presenting</span>
          <button onClick={stopScreenShare} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
            Stop sharing
          </button>
        </div>
      )}
      {forceMuted && <p className="bg-gray-800 px-4 py-1.5 text-center text-xs text-amber-300">The host muted your microphone</p>}
      {isRecording && (
        <p className="bg-red-700 px-4 py-1.5 text-center text-xs font-medium">● Recording — the file downloads when you stop</p>
      )}
      {toast && <p className="bg-gray-800 px-4 py-1.5 text-center text-xs text-white">{toast}</p>}

      <div className="relative flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4">
          {viewMode === 'gallery' ? (
            <div className="flex min-h-full items-center justify-center">
              <VideoGrid {...viewProps} />
            </div>
          ) : (
            <div className="h-full">
              <SpeakerView {...viewProps} activeSpeakerId={activeSpeakerId} />
            </div>
          )}
        </main>

        {panel && (
          <aside className="absolute inset-y-0 right-0 z-20 w-full shrink-0 shadow-xl sm:static sm:w-80">
            {panel === 'chat' ? (
              <ChatPanel
                messages={messages}
                onSend={sendMessage}
                onClose={() => setPanel(null)}
                localSocketId={getSocket().id}
              />
            ) : (
              <ParticipantsPanel
                localName={user?.name}
                localMuted={!micOn}
                localVideoOff={!camOn}
                localHandRaised={handRaised}
                isHost={isHost}
                participants={participants}
                onMute={(socketId) => emit('mute-participant', { socketId })}
                onRemove={(socketId) => emit('remove-participant', { socketId })}
                onMuteAll={() => emit('mute-all')}
                onClose={() => setPanel(null)}
              />
            )}
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-gray-800 px-3 py-3 sm:gap-3 sm:px-6">
        <ControlButton onClick={toggleMic} active={micOn} disabled={!localStream} title={micOn ? 'Mute microphone' : 'Unmute microphone'}>
          {micOn ? '🎤' : '🔇'}
        </ControlButton>
        <ControlButton
          onClick={toggleCam}
          active={camOn}
          disabled={!localStream || isScreenSharing}
          title={isScreenSharing ? 'Stop sharing to change camera' : camOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {camOn ? '📷' : '🚫'}
        </ControlButton>
        {canShareScreen && (
          <ControlButton
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={!localStream}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            🖥️
          </ControlButton>
        )}
        <ControlButton onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}>
          {handRaised ? '✋' : '🙋'}
        </ControlButton>
        <ControlButton
          onClick={() => setViewMode((v) => (v === 'gallery' ? 'speaker' : 'gallery'))}
          title={viewMode === 'gallery' ? 'Switch to speaker view' : 'Switch to gallery view'}
        >
          {viewMode === 'gallery' ? '🔲' : '🧑‍💼'}
        </ControlButton>
        <ControlButton onClick={() => togglePanel('participants')} title="Participants" badge={participants.length + 1}>
          👥
        </ControlButton>
        <ControlButton onClick={() => togglePanel('chat')} title="Chat" badge={unreadCount}>
          💬
        </ControlButton>
        {isHost && (
          <ControlButton
            onClick={isRecording ? stopRecording : startRecording}
            danger={isRecording}
            title={isRecording ? 'Stop recording' : 'Record meeting'}
          >
            {isRecording ? '⏹️' : '⏺️'}
          </ControlButton>
        )}

        <button
          onClick={() => leaveTo()}
          className="rounded-full bg-gray-800 px-5 py-2.5 text-sm font-semibold hover:bg-gray-700"
        >
          Leave
        </button>
        {isHost && (
          <button
            onClick={handleEndForAll}
            disabled={ending}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-500 disabled:opacity-60"
          >
            {ending ? 'Ending...' : 'End for all'}
          </button>
        )}
      </footer>
    </div>
  );
};

export default MeetingRoom;
