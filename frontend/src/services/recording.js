// Records the meeting locally: draws every visible video tile onto one
// canvas (so the recording looks like what's on screen), mixes every
// stream's audio through the Web Audio API into one track, and feeds
// both into MediaRecorder. Entirely client-side — no upload, no server
// involvement; the file is offered as a browser download when stopped.

const FRAME_RATE = 24;

const createCompositeRecorder = () => {
  let canvas = null;
  let ctx = null;
  let drawInterval = null;
  let audioContext = null;
  let destination = null;
  let recorder = null;
  let chunks = [];

  const layoutGrid = (count, width, height) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    return { cols, rows, cellW: width / cols, cellH: height / rows };
  };

  /**
   * Starts recording. `getTiles` is called on every frame and must return
   * an array of { videoEl, label } for whatever's currently visible —
   * passing a function (not a snapshot) is what lets the composite follow
   * participants joining/leaving mid-recording.
   */
  const start = ({ getTiles, getAudioStreams, width = 1280, height = 720 }) => {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');

    drawInterval = setInterval(() => {
      const tiles = getTiles();
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);

      const { cols, cellW, cellH } = layoutGrid(tiles.length || 1, width, height);
      tiles.forEach((tile, i) => {
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;
        if (tile.videoEl && tile.videoEl.readyState >= 2) {
          ctx.drawImage(tile.videoEl, x, y, cellW, cellH);
        } else {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x, y, cellW, cellH);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x + 8, y + cellH - 28, ctx.measureText(tile.label || '').width + 16, 22);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText(tile.label || '', x + 16, y + cellH - 12);
      });
    }, 1000 / FRAME_RATE);

    // Mix every participant's audio into one track so the recording has
    // sound from everyone, not just the local mic.
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    destination = audioContext.createMediaStreamDestination();
    (getAudioStreams() || []).forEach((stream) => {
      if (stream.getAudioTracks().length === 0) return;
      try {
        audioContext.createMediaStreamSource(stream).connect(destination);
      } catch (err) {
        console.warn('[recording] could not mix an audio stream:', err.message);
      }
    });

    const canvasStream = canvas.captureStream(FRAME_RATE);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    chunks = [];
    recorder = new MediaRecorder(combined, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(1000);

    return recorder;
  };

  const stop = () =>
    new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        clearInterval(drawInterval);
        audioContext?.close().catch(() => {});
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      recorder.stop();
    });

  const downloadBlob = (blob, filename = `meeting-recording-${Date.now()}.webm`) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return { start, stop, downloadBlob };
};

export { createCompositeRecorder };
