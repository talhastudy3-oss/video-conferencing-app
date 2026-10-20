import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { meetingsAPI } from '../services/api';

/**
 * Pre-join screen: validates the room, shows a local camera preview, lets
 * the user pick mic/cam on or off, then hands those choices to the room.
 * The preview stream is stopped before navigating — MeetingRoom requests
 * its own stream, and most systems only let one consumer hold the camera.
 */
const MeetingLobby = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [meetingError, setMeetingError] = useState('');
  const [checking, setChecking] = useState(true);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasStream, setHasStream] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [requestingMedia, setRequestingMedia] = useState(false);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const micOnRef = useRef(micOn);
  const camOnRef = useRef(camOn);
  micOnRef.current = micOn;
  camOnRef.current = camOn;

  // 1. Is this meeting real and still open? (404 = not found, 410 = ended)
  useEffect(() => {
    let cancelled = false;
    meetingsAPI
      .getByRoomId(roomId)
      .then(({ data }) => {
        if (!cancelled) setMeeting(data.meeting);
      })
      .catch((err) => {
        if (!cancelled) setMeetingError(err.response?.data?.message || 'Could not load this meeting.');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // 2. Camera/mic preview. Also used by the Retry button after a denial.
  const requestMedia = useCallback(async () => {
    setRequestingMedia(true);
    setMediaError('');
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = micOnRef.current;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = camOnRef.current;
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setHasStream(true);
    } catch (err) {
      setHasStream(false);
      setMediaError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone access was denied. Allow it in your browser settings, then press Retry.'
          : err.name === 'NotReadableError'
            ? 'Your camera is being used by another app or tab. Close it and press Retry.'
            : 'Could not access your camera or microphone.'
      );
    } finally {
      setRequestingMedia(false);
    }
  }, []);

  useEffect(() => {
    requestMedia();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [requestMedia]);

  const toggleMic = () => {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  };

  const toggleCam = () => {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  };

  const handleJoin = async () => {
    setJoinError('');
    setJoining(true);
    try {
      await meetingsAPI.join(roomId); // registers us as a participant; also re-checks the room is open
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      navigate(`/meeting/${roomId}`, { state: { micOn, camOn } });
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Could not join this meeting.');
      setJoining(false);
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Checking meeting...</p>
      </div>
    );
  }

  if (meetingError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{meetingError}</p>
        <Link to="/dashboard" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const showPreview = hasStream && camOn;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{meeting?.title}</h1>
        <p className="mb-4 font-mono text-xs text-gray-500 dark:text-gray-400">{roomId}</p>

        <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-gray-800">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full -scale-x-100 object-cover ${showPreview ? '' : 'hidden'}`}
          />
          {!showPreview && (
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-2xl font-semibold text-white">
                {(user?.name || '?').charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          {requestingMedia && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 text-sm text-gray-300">
              Requesting camera...
            </div>
          )}
        </div>

        {mediaError && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <span>{mediaError}</span>
            <button
              onClick={requestMedia}
              disabled={requestingMedia}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {requestingMedia ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={toggleMic}
            disabled={!hasStream}
            aria-pressed={micOn}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg text-white transition disabled:opacity-40 ${
              micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {micOn ? '🎤' : '🔇'}
          </button>
          <button
            onClick={toggleCam}
            disabled={!hasStream}
            aria-pressed={camOn}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg text-white transition disabled:opacity-40 ${
              camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {camOn ? '📷' : '🚫'}
          </button>
        </div>

        {joinError && <p className="mt-3 text-center text-sm text-red-500">{joinError}</p>}

        <div className="mt-6 flex gap-3">
          <Link
            to="/dashboard"
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Cancel
          </Link>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {joining ? 'Joining...' : 'Join now'}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          You can join even without a camera or microphone.
        </p>
      </div>
    </div>
  );
};

export default MeetingLobby;
