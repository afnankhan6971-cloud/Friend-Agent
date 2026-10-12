import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceLanguageCode, ISpeechRecognition, VOICE_LANGUAGES } from '../types/speech';

interface UseSpeechRecognitionProps {
  getCurrentText: () => string;
  onTranscriptChange: (text: string) => void;
}

export function useSpeechRecognition({
  getCurrentText,
  onTranscriptChange
}: UseSpeechRecognitionProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<VoiceLanguageCode>(() => {
    const saved = localStorage.getItem('personal_agent_voice_lang') as VoiceLanguageCode;
    return VOICE_LANGUAGES.some(l => l.code === saved) ? saved : 'en-IN';
  });

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const preRecordingTextRef = useRef<string>('');
  const isCancellingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass);
  }, []);

  // Update language and persist
  const setLanguage = useCallback((newLang: VoiceLanguageCode) => {
    setLanguageState(newLang);
    localStorage.setItem('personal_agent_voice_lang', newLang);
    
    // If currently recording, update recognition language
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.lang = newLang;
      } catch (e) {
        console.warn('Could not update recognition language mid-session:', e);
      }
    }
  }, [isListening]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clean stop of recognition instance
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore errors during abort
      }
      recognitionRef.current = null;
    }
  }, []);

  // Stop recording normally (preserves current transcript in composer)
  const stopListening = useCallback(() => {
    isStoppingRef.current = true;
    isCancellingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        cleanupRecognition();
      }
    }
    setIsListening(false);
    setIsInitializing(false);
  }, [cleanupRecognition]);

  // Cancel recording (reverts composer to pre-recording text and discards audio transcript)
  const cancelListening = useCallback(() => {
    isCancellingRef.current = true;
    isStoppingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        cleanupRecognition();
      }
    }
    // Revert composer text to what was typed before recording started
    onTranscriptChange(preRecordingTextRef.current);
    setIsListening(false);
    setIsInitializing(false);
    clearError();
  }, [cleanupRecognition, onTranscriptChange, clearError]);

  // Start speech recognition
  const startListening = useCallback(() => {
    setError(null);
    isCancellingRef.current = false;
    isStoppingRef.current = false;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError('Voice recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    // Clean up any stale recognition session
    cleanupRecognition();

    try {
      const recognition: ISpeechRecognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      // Remember the text currently in the composer before speaking
      const currentComposerText = getCurrentText();
      preRecordingTextRef.current = currentComposerText;

      setIsInitializing(true);

      recognition.onstart = () => {
        setIsInitializing(false);
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        if (isCancellingRef.current) return;

        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript || '';
          if (result.isFinal) {
            sessionFinal += (sessionFinal ? ' ' : '') + transcript.trim();
          } else {
            sessionInterim += (sessionInterim ? ' ' : '') + transcript.trim();
          }
        }

        const base = preRecordingTextRef.current.trim();
        const speechPart = (sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')).trim();

        // Concatenate without unexpectedly overwriting user-typed text
        const combined = base ? (base + ' ' + speechPart) : speechPart;
        onTranscriptChange(combined);
      };

      recognition.onerror = (event) => {
        setIsInitializing(false);
        setIsListening(false);

        // Ignore aborted error caused by user stopping or cancelling
        if (event.error === 'aborted' || isCancellingRef.current || isStoppingRef.current) {
          return;
        }

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            setError('Microphone permission was denied. Please allow microphone access in your browser settings.');
            break;
          case 'no-speech':
            setError('No speech was detected. Please check your microphone and try again.');
            break;
          case 'audio-capture':
            setError('Microphone is unavailable or disconnected.');
            break;
          case 'network':
            setError('Speech service network error occurred.');
            break;
          default:
            setError(`Speech recognition error (${event.error}). Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsInitializing(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsInitializing(false);
      setIsListening(false);
      setError('Could not initialize microphone. Please check permissions.');
    }
  }, [language, getCurrentText, onTranscriptChange, cleanupRecognition]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupRecognition();
    };
  }, [cleanupRecognition]);

  return {
    isSupported,
    isListening,
    isInitializing,
    language,
    setLanguage,
    error,
    clearError,
    startListening,
    stopListening,
    cancelListening
  };
}
