import { useEffect, useRef, useState } from 'react';

const SPEAKING_THRESHOLD = 12;
const CHECK_INTERVAL_MS = 200;

/**
 * Basic active-speaker detection via the Web Audio API: an AnalyserNode
 * per stream, polled every 200ms, flags anyone whose average volume is
 * over a threshold as "speaking", and picks the single loudest as the
 * active speaker (for Speaker View to feature). 'local' is used as the
 * key for the local user's own stream.
 */
const useActiveSpeaker = (localStream, remoteStreams) => {
  const [speakingIds, setSpeakingIds] = useState(new Set());
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map()); // id -> { analyser, dataArray }

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const wanted = new Map();
    if (localStream) wanted.set('local', localStream);
    remoteStreams.forEach((stream, id) => wanted.set(id, stream));

    // Tear down analysers for streams no longer present.
    analysersRef.current.forEach((_, id) => {
      if (!wanted.has(id)) analysersRef.current.delete(id);
    });

    wanted.forEach((stream, id) => {
      if (analysersRef.current.has(id)) return;
      if (stream.getAudioTracks().length === 0) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysersRef.current.set(id, { analyser, dataArray: new Uint8Array(analyser.frequencyBinCount) });
      } catch (err) {
        console.warn('[active-speaker] could not analyse a stream:', err.message);
      }
    });
  }, [localStream, remoteStreams]);

  useEffect(() => {
    const interval = setInterval(() => {
      let loudestId = null;
      let loudestVolume = 0;
      const nowSpeaking = new Set();

      analysersRef.current.forEach(({ analyser, dataArray }, id) => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        if (average > SPEAKING_THRESHOLD) {
          nowSpeaking.add(id);
          if (average > loudestVolume) {
            loudestVolume = average;
            loudestId = id;
          }
        }
      });

      setSpeakingIds(nowSpeaking);
      setActiveSpeakerId(loudestId);
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { speakingIds, activeSpeakerId };
};

export default useActiveSpeaker;
