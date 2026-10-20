import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { getLocalStream, getScreenStream, createPeerConnection } from '../services/webrtc';

/**
 * The video mesh: local camera/mic, one RTCPeerConnection per remote
 * participant (keyed by socketId), and screen-share support.
 *
 * Initiator rule (avoids "glare" — both sides offering at once): whoever
 * is ALREADY in the room offers to whoever just joined. So on
 * `user-joined` we offer; on `offer` we answer. Every pair in the room
 * only ever has one side initiating, however many participants there are.
 *
 * Reconnect handling: when OUR OWN socket reconnects after a drop, the
 * server treats it as a fresh join under a NEW socket.id — every remote
 * peer gets a `user-left` for our old id (they clean up) and a
 * `user-joined` for our new one (they create a fresh peer + offer). But
 * OUR side's existing peer connections, still keyed by the REMOTE peers'
 * (unchanged) socketIds, are left pointing at dead RTCPeerConnections
 * from before the drop. So on every reconnect (not the first connect)
 * this hook proactively closes and clears every peer it's holding, so the
 * incoming fresh offers create brand new ones instead of hitting stale
 * connections that silently never recover.
 */
const useWebRTC = (roomId, enabled = true) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [mediaError, setMediaError] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peersRef = useRef(new Map()); // socketId -> peer object
  const localStreamPromiseRef = useRef(null);
  const cameraTrackRef = useRef(null); // kept aside while screen-sharing, to restore on stop
  const screenTrackRef = useRef(null);
  const hasConnectedOnceRef = useRef(false);

  useEffect(() => {
    if (!roomId || !enabled) return undefined;

    const socket = getSocket();
    let cancelled = false;

    const closeAllPeers = () => {
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      setRemoteStreams(new Map());
    };

    localStreamPromiseRef.current = getLocalStream()
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        setLocalStream(stream);
        return stream;
      })
      .catch((err) => {
        console.error('[webrtc] getUserMedia failed:', err.message);
        if (!cancelled) {
          setMediaError(
            err.name === 'NotAllowedError'
              ? "Camera/microphone access was denied. You can still see others, but they won't see or hear you."
              : 'Could not access your camera or microphone.'
          );
        }
        return null; // a peer with no local tracks can still receive
      });

    const getOrCreatePeer = async (socketId) => {
      const existing = peersRef.current.get(socketId);
      if (existing) return existing;

      const stream = await localStreamPromiseRef.current;
      const raceWinner = peersRef.current.get(socketId);
      if (raceWinner) return raceWinner;

      const peer = createPeerConnection({
        socketId,
        localStream: stream,
        onIceCandidate: (candidate) => socket.emit('ice-candidate', { to: socketId, candidate }),
        onTrack: (mediaStream) => setRemoteStreams((prev) => new Map(prev).set(socketId, mediaStream)),
      });

      peersRef.current.set(socketId, peer);
      return peer;
    };

    const removePeer = (socketId) => {
      const peer = peersRef.current.get(socketId);
      if (!peer) return;
      peer.close();
      peersRef.current.delete(socketId);
      setRemoteStreams((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    const handleConnect = () => {
      if (hasConnectedOnceRef.current) {
        console.log('[webrtc] socket reconnected — clearing stale peer connections');
        closeAllPeers();
      }
      hasConnectedOnceRef.current = true;
    };

    const handleUserJoined = async ({ participant } = {}) => {
      const targetId = participant?.socketId;
      if (!targetId) return;
      console.log(`[webrtc] user-joined ${targetId} — creating offer`);
      try {
        const peer = await getOrCreatePeer(targetId);
        const offer = await peer.createOffer();
        socket.emit('offer', { to: targetId, offer });
      } catch (err) {
        console.error('[webrtc] failed to create/send offer:', err.message);
      }
    };

    const handleOffer = async ({ from, offer } = {}) => {
      if (!from || !offer) return;
      console.log(`[webrtc] offer <- ${from} — creating answer`);
      try {
        const peer = await getOrCreatePeer(from);
        const answer = await peer.createAnswer(offer);
        socket.emit('answer', { to: from, answer });
      } catch (err) {
        console.error('[webrtc] failed to handle offer:', err.message);
      }
    };

    const handleAnswer = async ({ from, answer } = {}) => {
      if (!from || !answer) return;
      const peer = peersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.applyAnswer(answer);
      } catch (err) {
        console.error('[webrtc] failed to apply answer:', err.message);
      }
    };

    const handleIceCandidate = async ({ from, candidate } = {}) => {
      if (!from || !candidate) return;
      const peer = peersRef.current.get(from);
      if (!peer) return;
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error('[webrtc] failed to add ICE candidate:', err.message);
      }
    };

    const handleUserLeft = ({ socketId } = {}) => {
      if (!socketId) return;
      console.log(`[webrtc] user-left ${socketId} — closing peer connection`);
      removePeer(socketId);
    };

    socket.on('connect', handleConnect);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('user-joined', handleUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);

      closeAllPeers();
      localStreamPromiseRef.current?.then((stream) => stream?.getTracks().forEach((t) => t.stop()));
      setLocalStream(null);
    };
  }, [roomId, enabled]);

  /** Re-requests camera/mic and attaches tracks to every existing peer —
   * used by the "Retry" button after a permission denial. */
  const retryMedia = useCallback(async () => {
    try {
      const stream = await getLocalStream();
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      setLocalStream(stream);
      setMediaError('');
      localStreamPromiseRef.current = Promise.resolve(stream);

      // Existing peers negotiated with no tracks — attach now and
      // trigger a fresh offer so the other side actually receives them.
      const socket = getSocket();
      peersRef.current.forEach(async (peer, socketId) => {
        peer.addLocalStreamIfMissing(stream);
        const offer = await peer.createOffer();
        socket.emit('offer', { to: socketId, offer });
      });
    } catch (err) {
      setMediaError(
        err.name === 'NotAllowedError'
          ? 'Still denied — check your browser/OS camera & microphone permissions.'
          : 'Could not access your camera or microphone.'
      );
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await getScreenStream();
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      await Promise.all(Array.from(peersRef.current.values()).map((peer) => peer.replaceVideoTrack(screenTrack)));

      setLocalStream((prev) => {
        if (!prev) return prev;
        if (cameraTrackRef.current) prev.removeTrack(cameraTrackRef.current);
        prev.addTrack(screenTrack);
        return prev;
      });

      setIsScreenSharing(true);

      // Auto-revert if the user stops sharing from the browser's own
      // native "Stop sharing" control, not just our in-app button.
      screenTrack.onended = () => stopScreenShareRef.current?.();
    } catch (err) {
      console.error('[webrtc] screen share failed:', err.message);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) return;

    await Promise.all(Array.from(peersRef.current.values()).map((peer) => peer.replaceVideoTrack(cameraTrack)));

    setLocalStream((prev) => {
      if (!prev) return prev;
      if (screenTrackRef.current) prev.removeTrack(screenTrackRef.current);
      prev.addTrack(cameraTrack);
      return prev;
    });

    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    setIsScreenSharing(false);
  }, []);

  // stopScreenShare is defined after startScreenShare but referenced
  // inside it (for the native "Stop sharing" button) — a ref sidesteps
  // the ordering/closure issue without restructuring the two functions.
  const stopScreenShareRef = useRef(null);
  stopScreenShareRef.current = stopScreenShare;

  return {
    localStream,
    remoteStreams,
    mediaError,
    retryMedia,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
  };
};

export default useWebRTC;
