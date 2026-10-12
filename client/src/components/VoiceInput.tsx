import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, X, AlertCircle, Globe, ChevronDown } from 'lucide-react';
import { VoiceLanguageCode, VOICE_LANGUAGES } from '../types/speech';

interface VoiceInputProps {
  isSupported: boolean;
  isListening: boolean;
  isInitializing: boolean;
  language: VoiceLanguageCode;
  onLanguageChange: (lang: VoiceLanguageCode) => void;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  disabled?: boolean;
  error: string | null;
  onClearError: () => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  isSupported,
  isListening,
  isInitializing,
  language,
  onLanguageChange,
  onStart,
  onStop,
  onCancel,
  disabled = false,
  error,
  onClearError,
}) => {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };

    if (langMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [langMenuOpen]);

  const currentLang = VOICE_LANGUAGES.find(l => l.code === language) || VOICE_LANGUAGES[0];

  return (
    <div className="relative flex items-center gap-1">
      {/* Non-intrusive floating error banner */}
      {error && (
        <div 
          role="alert"
          aria-live="polite"
          className="absolute bottom-full mb-3 right-0 max-w-xs md:max-w-sm z-30 p-2.5 px-3 bg-surface-1 text-foreground border border-red-400/40 rounded-xl shadow-lg flex items-start gap-2 text-xs backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <span className="flex-1 text-muted-foreground">{error}</span>
          <button
            onClick={onClearError}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Language Selector Popover / Button */}
      <div className="relative" ref={langMenuRef}>
        <button
          type="button"
          onClick={() => setLangMenuOpen(!langMenuOpen)}
          disabled={disabled || !isSupported}
          title={`Speech Language: ${currentLang.label}. Click to change.`}
          aria-label={`Select speech language. Currently ${currentLang.label}`}
          aria-haspopup="listbox"
          aria-expanded={langMenuOpen}
          className="h-10 px-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary dark:hover:text-foreground hover:bg-surface-2 rounded-xl transition border border-transparent hover:border-border disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Globe size={14} className="opacity-70" />
          <span className="font-mono text-[11px] uppercase tracking-wider">{currentLang.shortLabel}</span>
          <ChevronDown size={11} className={`opacity-60 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {langMenuOpen && (
          <div 
            role="listbox"
            aria-label="Speech recognition language options"
            className="absolute bottom-full mb-2 right-0 w-44 bg-surface-1 border border-border rounded-xl shadow-xl p-1 z-40 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50 mb-1">
              Voice Language
            </div>
            {VOICE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={lang.code === language}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setLangMenuOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  lang.code === language
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-foreground hover:bg-surface-2'
                }`}
              >
                <span>{lang.nativeLabel}</span>
                <span className={`text-[10px] font-mono opacity-80 ${lang.code === language ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  {lang.shortLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Controls: Idle vs Recording */}
      {!isListening ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled || !isSupported || isInitializing}
          title={
            !isSupported
              ? 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
              : isInitializing
              ? 'Initializing microphone...'
              : `Start speaking (${currentLang.label})`
          }
          aria-label={
            !isSupported
              ? 'Speech recognition not supported in this browser'
              : 'Start voice input'
          }
          className={`p-2.5 rounded-xl transition flex items-center justify-center ${
            !isSupported
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : isInitializing
              ? 'text-primary bg-surface-2 animate-pulse cursor-wait'
              : 'text-muted-foreground hover:text-primary dark:hover:text-foreground hover:bg-surface-2 active:scale-95'
          }`}
        >
          {isSupported ? (
            <Mic size={20} className={isInitializing ? 'animate-pulse' : ''} />
          ) : (
            <MicOff size={20} />
          )}
        </button>
      ) : (
        /* Active Recording State with Animated Indicator, Stop, and Cancel */
        <div className="flex items-center gap-1 bg-surface-2/90 border border-red-500/30 rounded-xl p-1 shadow-sm animate-in fade-in duration-200">
          {/* Pulsing Recording Indicator */}
          <div 
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400"
            title="Recording audio... Speak now"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[11px] hidden sm:inline">Listening...</span>
          </div>

          {/* Stop / Commit button */}
          <button
            type="button"
            onClick={onStop}
            title="Done speaking (keep recognized text in composer)"
            aria-label="Done speaking"
            className="p-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition active:scale-95 shadow-xs"
          >
            <Square size={14} className="fill-current" />
          </button>

          {/* Cancel / Discard button */}
          <button
            type="button"
            onClick={onCancel}
            title="Cancel recording (discard recognized speech)"
            aria-label="Cancel recording and discard speech"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-1 rounded-lg transition active:scale-95"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
