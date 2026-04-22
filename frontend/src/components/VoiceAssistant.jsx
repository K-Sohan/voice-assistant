import React, { useState, useEffect, useRef } from 'react';

// ── Command dictionary ─────────────────────────────────────────────────────────
const COMMANDS = {
  hello: {
    icon: '👋',
    response: "Hello! I'm your VoiceAssist assistant. I'm listening and ready to help you manage your email and messages hands-free.",
  },
  test: {
    icon: '✅',
    response: 'Voice recognition is working perfectly. Speech-to-text pipeline is fully operational.',
  },
  status: {
    icon: '📊',
    response: 'System status: Voice engine ✅  |  Microphone ✅  |  Speech-to-text ✅  |  Email integration ⏳ (Part 2)  |  Messaging ⏳ (Part 3)',
  },
};

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function VoiceAssistant({ preferredLanguage = 'en-US' }) {
  const [isListening,      setIsListening]      = useState(false);
  const [transcript,       setTranscript]        = useState('');
  const [interim,          setInterim]           = useState('');
  const [response,         setResponse]          = useState(null);
  const [history,          setHistory]           = useState([]);
  const [error,            setError]             = useState('');
  const [permissionState,  setPermissionState]   = useState('unknown'); // 'unknown' | 'granted' | 'denied'
  const recognitionRef  = useRef(null);
  const historyEndRef   = useRef(null);
  const isSupported     = !!SpeechRecognitionAPI;

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Check mic permission state if available
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
      setPermissionState(result.state);
      result.onchange = () => setPermissionState(result.state);
    }).catch(() => {});
  }, []);

  // ── Match speech to a known command ────────────────────────────────────────
  const resolveCommand = (text) => {
    const lower = text.toLowerCase().trim();
    for (const [cmd, data] of Object.entries(COMMANDS)) {
      if (lower.includes(cmd)) return { matched: cmd, ...data };
    }
    return {
      matched: null,
      icon: '🤔',
      response: `I heard: "${text}". Try saying hello, test, or status.`,
    };
  };

  // ── Start listening ─────────────────────────────────────────────────────────
  const startListening = () => {
    if (!isSupported) {
      setError('Your browser does not support the Web Speech API. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    setError('');
    setTranscript('');
    setResponse(null);
    setInterim('');

    const recognition = new SpeechRecognitionAPI();
    recognition.lang              = preferredLanguage;
    recognition.continuous        = false;
    recognition.interimResults    = true;
    recognition.maxAlternatives   = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      setInterim(interimText);

      if (finalText) {
        const finalTrimmed = finalText.trim();
        setTranscript(finalTrimmed);
        setInterim('');
        const resolved = resolveCommand(finalTrimmed);
        setResponse(resolved);
        setHistory((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: finalTrimmed,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ...resolved,
          },
        ]);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setInterim('');
      const errorMap = {
        'not-allowed':     'Microphone access was denied. Click the lock icon in your browser address bar and allow microphone access.',
        'no-speech':       'No speech was detected. Please speak clearly after clicking the microphone.',
        'network':         'A network error occurred. Please check your internet connection.',
        'aborted':         'Listening was cancelled.',
        'audio-capture':   'No microphone was found. Please connect a microphone and try again.',
        'service-not-allowed': 'Speech recognition service is not allowed. Try using HTTPS or Chrome.',
      };
      setError(errorMap[event.error] || `Speech recognition error: ${event.error}`);
      if (event.error === 'not-allowed') setPermissionState('denied');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setError('Could not start speech recognition. Please try again.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const clearAll = () => {
    setHistory([]);
    setTranscript('');
    setResponse(null);
    setError('');
    setInterim('');
  };

  // ── Not supported message ───────────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div className="card border-warn/30 bg-warn/5">
        <div className="flex items-start gap-3">
          <span className="text-3xl mt-0.5">⚠️</span>
          <div>
            <h3 className="font-semibold text-white mb-1">Browser Not Supported</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The Web Speech API is not available in your browser. Please use{' '}
              <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer"
                className="text-violet-light underline">Google Chrome</a>{' '}
              or{' '}
              <a href="https://www.microsoft.com/edge" target="_blank" rel="noreferrer"
                className="text-violet-light underline">Microsoft Edge</a>{' '}
              for voice recognition to work.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">

      {/* ── Main Mic Panel ─────────────────────────────────────────────────── */}
      <div className="card flex flex-col items-center gap-6 py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-1">Voice Command Center</h2>
          <p className="text-gray-500 text-sm">
            Say{' '}
            {['hello', 'test', 'status'].map((cmd, i, arr) => (
              <span key={cmd}>
                <span className="font-mono text-violet-light bg-violet-dim px-1.5 py-0.5 rounded text-xs">
                  {cmd}
                </span>
                {i < arr.length - 1 && <span className="text-gray-600">, </span>}
              </span>
            ))}
          </p>
        </div>

        {/* Mic button */}
        <div className="relative">
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 scale-125" />
              <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse-ring opacity-10 scale-150" />
            </>
          )}
          <button
            onClick={isListening ? stopListening : startListening}
            title={isListening ? 'Stop listening' : 'Start voice recognition'}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-4xl
              transition-all duration-300 active:scale-95 shadow-2xl ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30 scale-110'
                : 'bg-violet hover:bg-violet-hover shadow-violet/30 hover:scale-105'
            }`}
          >
            {isListening ? '⏹' : '🎙️'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            isListening ? 'bg-red-400 animate-pulse' : 'bg-dark-400'
          }`} />
          <p className={`text-sm font-medium ${isListening ? 'text-red-400' : 'text-gray-500'}`}>
            {isListening ? 'Listening — speak now…' : 'Click microphone to begin'}
          </p>
        </div>

        {/* Interim display */}
        {interim && (
          <div className="w-full max-w-sm bg-dark-700 rounded-xl p-3 border border-dark-500 text-center">
            <p className="text-xs text-gray-500 mb-1">Detecting…</p>
            <p className="text-white italic text-sm">{interim}</p>
          </div>
        )}

        {/* Permission denied warning */}
        {permissionState === 'denied' && (
          <div className="w-full bg-red-950/40 border border-danger/30 rounded-xl p-3 text-center">
            <p className="text-danger text-sm font-medium mb-1">🔒 Microphone access denied</p>
            <p className="text-gray-400 text-xs">
              Click the lock icon in your browser address bar → Site settings → Microphone → Allow
            </p>
          </div>
        )}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-950/30 border border-danger/30 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="text-danger font-medium text-sm">Recognition Error</p>
            <p className="text-gray-400 text-sm mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError('')} className="ml-auto text-gray-600 hover:text-gray-300 text-lg">×</button>
        </div>
      )}

      {/* ── Latest Result ─────────────────────────────────────────────────── */}
      {(transcript || response) && (
        <div className="card space-y-4 animate-slide-up">
          {transcript && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2">
                You said
              </p>
              <div className="bg-dark-700 border border-dark-500 rounded-xl p-3">
                <p className="text-white text-sm">"{transcript}"</p>
              </div>
            </div>
          )}
          {response && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2">
                Assistant
              </p>
              <div className="bg-violet-dim border border-violet/20 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{response.icon}</span>
                <p className="text-gray-200 text-sm leading-relaxed">{response.response}</p>
              </div>
              {response.matched && (
                <p className="text-xs text-gray-600 mt-2 ml-1">
                  Matched command:{' '}
                  <span className="font-mono text-violet-light bg-violet-dim px-1.5 py-0.5 rounded">
                    {response.matched}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Session History ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Session History</h3>
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-red-950/30"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {[...history].reverse().map((item) => (
              <div key={item.id} className="flex gap-3 pb-3 border-b border-dark-600 last:border-0 last:pb-0">
                <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white text-sm font-medium truncate">"{item.text}"</p>
                    {item.matched && (
                      <span className="badge bg-violet-dim text-violet-light flex-shrink-0">
                        /{item.matched}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">{item.response}</p>
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0 font-mono">{item.time}</span>
              </div>
            ))}
            <div ref={historyEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}