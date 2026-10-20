import { useState, useRef, useCallback } from 'react';
import { createCompositeRecorder } from '../services/recording';

/** Host-only local recording: composites every visible tile onto a canvas
 * plus mixed audio, and downloads a .webm when stopped. `getTiles` and
 * `getAudioStreams` are passed in from MeetingRoom, which has access to
 * the actual <video> elements and streams currently on screen. */
const useRecording = ({ getTiles, getAudioStreams }) => {
  const [isRecording, setIsRecording] = useState(false);
  const recorderServiceRef = useRef(null);

  const startRecording = useCallback(() => {
    if (!recorderServiceRef.current) recorderServiceRef.current = createCompositeRecorder();
    recorderServiceRef.current.start({ getTiles, getAudioStreams });
    setIsRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recorderServiceRef.current) return;
    const blob = await recorderServiceRef.current.stop();
    setIsRecording(false);
    if (blob) recorderServiceRef.current.downloadBlob(blob);
  }, []);

  return { isRecording, startRecording, stopRecording };
};

export default useRecording;
