import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../api';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

export function useVoiceInput() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  // Incremented each time a new transcript arrives so useEffect in consumers
  // always fires even when the transcript text is identical to the last one.
  const [resultCount, setResultCount] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  const startRecording = useCallback(async () => {
    setVoiceError('');
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        setVoiceState('processing');
        try {
          const text = await transcribeAudio(blob, mimeTypeRef.current);
          setTranscript(text);
          setResultCount((c) => c + 1);
          setVoiceState('done');
        } catch {
          setVoiceError('Failed to transcribe. Please try again.');
          setVoiceState('error');
        }
      };

      mediaRecorder.start();
      setVoiceState('recording');
    } catch {
      setVoiceError('Microphone access denied. Please allow microphone access.');
      setVoiceState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'done' || voiceState === 'error') {
      startRecording();
    } else if (voiceState === 'recording') {
      stopRecording();
    }
  }, [voiceState, startRecording, stopRecording]);

  return { voiceState, transcript, voiceError, toggle, resultCount };
}
