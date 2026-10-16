import { useState, useRef, useCallback } from 'react';

export type RecorderStatus = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('IDLE');
  const [mimeType, setMimeType] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const stream = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setStatus('RECORDING');
      setErrorMessage('');
      audioChunks.current = [];
      
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' }; // fallback to default
        }
      }
      
      setMimeType(options.mimeType || 'default');
      
      mediaRecorder.current = new MediaRecorder(stream.current, options.mimeType ? options : undefined);
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      mediaRecorder.current.start();
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setStatus('ERROR');
      setErrorMessage(err.message || 'Failed to start recording. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback((): Promise<{ blob: Blob, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder.current) {
        reject(new Error('No active recorder'));
        return;
      }
      
      mediaRecorder.current.onstop = () => {
        const type = mediaRecorder.current?.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunks.current, { type });
        
        // Stop all tracks to release microphone
        stream.current?.getTracks().forEach(track => track.stop());
        
        setStatus('PROCESSING');
        resolve({ blob, mimeType: type });
      };
      
      mediaRecorder.current.stop();
    });
  }, [mimeType]);

  return {
    status,
    setStatus,
    mimeType,
    errorMessage,
    startRecording,
    stopRecording
  };
}
