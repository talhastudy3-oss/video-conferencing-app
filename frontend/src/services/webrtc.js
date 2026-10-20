// Google's public STUN server — lets a peer discover its own public
// IP/port for NAT traversal.
//
// *** PRODUCTION NOTE — TURN SERVER NEEDED ***
// STUN alone fails whenever both peers are behind a "symmetric"/strict
// NAT (common on corporate networks, some mobile carriers, and many
// public Wi-Fi setups) — a direct peer-to-peer path simply can't be
// found, and the call never connects. A TURN server relays media between
// peers as a fallback when a direct path fails. For production, run your
// own coturn server (https://github.com/coturn/coturn) or use a managed
// TURN provider, then add it here:
//   const ICE_SERVERS = [
//     { urls: 'stun:stun.l.google.com:19302' },
//     { urls: 'turn:your-turn-server.com:3478', username: '...', credential: '...' },
//   ];
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const getLocalStream = () => navigator.mediaDevices.getUserMedia({ video: true, audio: true });

const getScreenStream = () => navigator.mediaDevices.getDisplayMedia({ video: true });

/** Adds any of `stream`'s tracks not already attached — used when local
 * media becomes available (or permission is retried) after a peer
 * connection already exists. */
const addLocalStreamIfMissing = (pc, stream) => {
  if (!stream) return;
  const existingTracks = new Set(pc.getSenders().map((s) => s.track).filter(Boolean));
  stream.getTracks().forEach((track) => {
    if (!existingTracks.has(track)) pc.addTrack(track, stream);
  });
};

/** Swaps the outgoing video track without renegotiation — this is what
 * makes screen sharing work: the remote side just starts receiving
 * different frames on the same m-line. */
const replaceVideoTrack = async (pc, newTrack) => {
  const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
  if (sender) await sender.replaceTrack(newTrack);
};

/**
 * Wraps one RTCPeerConnection for one remote participant: local tracks
 * attached up front, remote tracks collected into a single MediaStream,
 * ICE candidates surfaced via callback, and candidates that arrive before
 * a remote description exists queued and flushed once it's set.
 */
const createPeerConnection = ({ socketId, localStream, onIceCandidate, onTrack, onConnectionStateChange }) => {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  const remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => {
      if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
    });
    onTrack?.(remoteStream);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate?.(event.candidate);
  };

  pc.onconnectionstatechange = () => {
    console.log(`[webrtc] peer ${socketId}: connection state -> ${pc.connectionState}`);
    onConnectionStateChange?.(pc.connectionState);
  };

  let remoteDescriptionSet = false;
  let queuedCandidates = [];

  const setRemoteDescriptionAndFlush = async (description) => {
    await pc.setRemoteDescription(new RTCSessionDescription(description));
    remoteDescriptionSet = true;
    for (const candidate of queuedCandidates) {
      // eslint-disable-next-line no-await-in-loop
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    queuedCandidates = [];
  };

  const createOffer = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  };

  const createAnswer = async (offer) => {
    await setRemoteDescriptionAndFlush(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  };

  const applyAnswer = async (answer) => {
    await setRemoteDescriptionAndFlush(answer);
  };

  const addIceCandidate = async (candidate) => {
    if (!candidate) return;
    if (remoteDescriptionSet) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      queuedCandidates.push(candidate);
    }
  };

  // Only the REMOTE stream's tracks get stopped here — local tracks are
  // shared across every peer connection in the mesh, so stopping them
  // here would kill our own camera/mic for every other participant too.
  const close = () => {
    pc.close();
    remoteStream.getTracks().forEach((track) => track.stop());
  };

  return {
    pc,
    createOffer,
    createAnswer,
    applyAnswer,
    addIceCandidate,
    close,
    addLocalStreamIfMissing: (stream) => addLocalStreamIfMissing(pc, stream),
    replaceVideoTrack: (track) => replaceVideoTrack(pc, track),
  };
};

export { ICE_SERVERS, getLocalStream, getScreenStream, createPeerConnection };
