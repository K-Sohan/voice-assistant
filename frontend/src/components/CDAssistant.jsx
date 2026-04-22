import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api       from '../services/api.js';
import gmailApi  from '../services/gmailApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { parseEmailFromSpeech } from '../services/api.js';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// ── Convert spoken words/digits to a numeric PIN string ───────────────────────
const parseSpokenPin = (text) => {
  const map = {
    zero:'0', one:'1', two:'2', three:'3', four:'4',
    five:'5', six:'6', seven:'7', eight:'8', nine:'9',
    oh:'0', to:'2', too:'2', for:'4', ate:'8',
  };
  return text
    .toLowerCase()
    .split(/[\s,.\-]+/)
    .map((w) => (map[w] !== undefined ? map[w] : w))
    .join('')
    .replace(/\D/g, '');
};

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODE = {
  IDLE:       'idle',
  WAKE:       'wake',
  SPEAKING:   'speaking',
  PIN:        'pin',
  ACTIVE:     'active',
  PROCESSING: 'processing',
};

const MODE_CONFIG = {
  idle:       { label: 'Click to activate CD',    ring: 'ring-dark-500',   orb: 'bg-dark-500',    pulse: false },
  wake:       { label: 'Listening for "CD"…',     ring: 'ring-blue-500',   orb: 'bg-blue-600',    pulse: true  },
  pin:        { label: 'Waiting for your PIN…',   ring: 'ring-yellow-400', orb: 'bg-yellow-500',  pulse: true  },
  speaking:   { label: 'CD is speaking…',         ring: 'ring-violet',     orb: 'bg-violet',      pulse: true  },
  active:     { label: 'Listening for command…',  ring: 'ring-green-400',  orb: 'bg-green-500',   pulse: true  },
  processing: { label: 'Processing…',             ring: 'ring-violet',     orb: 'bg-violet',      pulse: false },
};

export default function CDAssistant({
  preferredLanguage = 'en-US',
  voicePinSet       = false,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // ── Render state ────────────────────────────────────────────────────────────
  const [mode,           setMode]          = useState(MODE.IDLE);
  const [transcript,     setTranscript]    = useState('');
  const [cdResponse,     setCdResponse]    = useState('');
  const [log,            setLog]           = useState([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail,     setGmailEmail]    = useState('');
  const [error,          setError]         = useState('');

  // ── Refs — always current inside async callbacks ────────────────────────────
  const modeRef         = useRef(MODE.IDLE);
  const recognitionRef  = useRef(null);
  const convCtxRef      = useRef({ step: null, data: {} });
  const gmailRef        = useRef({ connected: false, email: '' });
  const logRef          = useRef([]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateMode = (m) => { modeRef.current = m; setMode(m); };

  const addLog = (type, text) => {
    const entry = {
      id:   Date.now() + Math.random(),
      type,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    logRef.current = [...logRef.current.slice(-24), entry];
    setLog([...logRef.current]);
  };
  const gmailConnectUrl = () => {
        const token = localStorage.getItem('va_token');
        return `/api/gmail/connect?token=${token}`;
    };

  // ── Load Gmail status ────────────────────────────────────────────────────────
  const loadGmailStatus = async () => {
    try {
      const data = await gmailApi.getStatus();
      gmailRef.current = { connected: data.connected, email: data.email || '' };
      setGmailConnected(data.connected);
      setGmailEmail(data.email || '');
    } catch { /* non-fatal */ }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadGmailStatus();
    // Warm up voices so they are ready when we first speak
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () =>
        window.speechSynthesis.getVoices()
      );
    }
    // Handle URL params from Gmail OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected')) {
      loadGmailStatus();
      window.history.replaceState({}, '', '/dashboard');
    }
    if (params.get('gmail_error')) {
      setError(decodeURIComponent(params.get('gmail_error')));
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // ── Text-to-Speech ───────────────────────────────────────────────────────────
  const speak = (text) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();

      // Wait for cancel to fully clear
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang   = 'en-US';
        u.rate   = 1.0;
        u.pitch  = 1.05;
        u.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const voice  =
          voices.find((v) => v.name.includes('Google') && v.lang === 'en-US') ||
          voices.find((v) => v.lang === 'en-US' && !v.localService)           ||
          voices.find((v) => v.lang.startsWith('en'));
        if (voice) u.voice = voice;

        setCdResponse(text); // only in CDAssistant, remove for Login

        // Estimate duration: ~80ms per word + 600ms buffer
        const wordCount      = text.trim().split(/\s+/).length;
        const estimatedMs    = wordCount * 80 + 600;
        let resolved         = false;

        const done = () => {
          if (!resolved) {
            resolved = true;
            // Extra buffer after speech ends before mic opens
            setTimeout(resolve, 1500);
          }
        };

        u.onend   = done;
        u.onerror = done;

        // Fallback: resolve after estimated duration regardless
        setTimeout(done, estimatedMs + 1000);

        window.speechSynthesis.speak(u);
      }, 500);
    });
  // ── Stop current recognition safely ─────────────────────────────────────────
  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  };

  // ── Single-shot listen (returns array of transcript alternatives) ────────────
  const listenOnce = (type = 'command', timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      if (!SpeechRecognitionAPI) { reject(new Error('not-supported')); return; }
      stopRecognition();

      const r = new SpeechRecognitionAPI();
      r.lang            = 'en-IN';
      r.continuous      = type === 'pin'; // ← continuous ONLY for PIN
      r.interimResults  = false;
      r.maxAlternatives = 5;

      recognitionRef.current = r;

      let done = false;
      const finish = (fn) => {
        if (!done) { done = true; clearTimeout(timer); clearTimeout(pinTimer); fn(); }
      };

      const timer = setTimeout(
        () => finish(() => {
          try { r.abort(); } catch { /* ignore */ }
          reject(new Error('timeout'));
        }),
        timeoutMs
      );

      // For PIN: collect for 5 seconds then resolve with what we have
      let pinTimer = null;
      let pinTranscript = '';

      r.onresult = (e) => {
        if (type === 'pin') {
          // Accumulate all results
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              pinTranscript += ' ' + e.results[i][0].transcript;
            }
          }
          // Reset the collection timer on each result
          clearTimeout(pinTimer);
          pinTimer = setTimeout(() => {
            finish(() => {
              try { r.abort(); } catch { /* ignore */ }
              resolve([pinTranscript.trim()]);
            });
          }, 2000); // wait 2s of silence after last digit
        } else {
          const alternatives = Array.from(e.results[0]).map((a) => a.transcript);
          finish(() => resolve(alternatives));
        }
      };

      r.onerror = (e) => {
        if (e.error === 'not-allowed') {
          updateMode(MODE.IDLE);
          setError('Microphone access denied. Please allow microphone access and try again.');
        }
        finish(() => reject(new Error(e.error)));
      };

      r.onend = () => {
        if (type === 'pin' && pinTranscript) {
          finish(() => resolve([pinTranscript.trim()]));
        } else {
          finish(() => reject(new Error('ended')));
        }
      };

      setTimeout(() => {
        try { r.start(); } catch (e) { finish(() => reject(e)); }
      }, 500);
    });
  // ── Continuous wake-word listener ────────────────────────────────────────────
  const startWakeListening = () => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    stopRecognition();
    updateMode(MODE.WAKE);
    addLog('system', 'Listening for wake word "CD"…');

    const startLoop = () => {
      if (modeRef.current !== MODE.WAKE) return;

      const r = new SpeechRecognitionAPI();
      r.lang            = 'en-US';
      r.continuous      = true;
      r.interimResults  = true;
      r.maxAlternatives = 1;
      recognitionRef.current = r;

      r.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        const text = last[0].transcript.toLowerCase().trim();

        const triggered =
          text.includes('cd')        ||
          text.includes('see dee')   ||
          text.includes('c d')       ||
          text.includes('c.d')       ||
          text.includes('c.d.');

        if (triggered) {
          try { r.abort(); } catch { /* ignore */ }
          handleWakeWord();
        }
      };

      r.onerror = (e) => {
        if (e.error === 'not-allowed') {
          updateMode(MODE.IDLE);
          setError(
            'Microphone access denied. Click the lock icon in your browser address bar and allow microphone access.'
          );
          return;
        }
        if (modeRef.current === MODE.WAKE) setTimeout(startLoop, 500);
      };

      r.onend = () => {
        if (modeRef.current === MODE.WAKE) setTimeout(startLoop, 300);
      };

      try { r.start(); } catch { /* ignore */ }
    };

    startLoop();
  };

  // ── Wake word handler ────────────────────────────────────────────────────────
  const handleWakeWord = async () => {
    stopRecognition();
    addLog('system', '🔔 Wake word detected!');

    if (!voicePinSet) {
      updateMode(MODE.SPEAKING);
      const msg = "Hello! I'm CD. How can I help you?";
      addLog('cd', msg); await speak(msg);
      await startCommandListening();
      return;
    }

    updateMode(MODE.SPEAKING);
    await speak("Please say your PIN.");
    await new Promise((r) => setTimeout(r, 800));
    updateMode(MODE.PIN);

    try {
      const alternatives = await listenOnce('pin', 18000);
      const raw = alternatives[0] || '';

      // Try all alternatives for PIN
      let pin = '';
      for (const alt of alternatives) {
        const { data } = await api.post('/voice/parse-pin', { speech: alt });
        if (data.success && data.pin) { pin = data.pin; break; }
      }

      if (!pin || pin.length < 4) {
        updateMode(MODE.SPEAKING);
        await speak("I couldn't understand that. Say my name and try again.");
        updateMode(MODE.WAKE); startWakeListening(); return;
      }

      updateMode(MODE.PROCESSING);
      const { data } = await api.post('/profile/verify-pin', { pin });

      if (data.success) {
        updateMode(MODE.SPEAKING);
        const msg = "PIN verified. Hello! How can I help you?";
        addLog('cd', msg); await speak(msg);
        await startCommandListening();
      } else {
        updateMode(MODE.SPEAKING);
        await speak("Incorrect PIN. Say my name to try again.");
        updateMode(MODE.WAKE); startWakeListening();
      }
    } catch {
      updateMode(MODE.SPEAKING);
      await speak("I didn't catch your PIN. Say my name to try again.");
      updateMode(MODE.WAKE); startWakeListening();
    }
  };

  // ── Active command loop ──────────────────────────────────────────────────────
  const startCommandListening = async () => {
    updateMode(MODE.ACTIVE);
    let silenceStreak = 0;

    while (true) {
      if (modeRef.current !== MODE.ACTIVE) break;

      try {
        const alternatives = await listenOnce('command', 15000);
        silenceStreak = 0;
        const text = alternatives[0] || '';
        setTranscript(text);
        addLog('user', text);
        updateMode(MODE.PROCESSING);
        await processCommand(text, alternatives);
        if (modeRef.current === MODE.WAKE || modeRef.current === MODE.IDLE) break;
        updateMode(MODE.ACTIVE);
      } catch (err) {
        if (modeRef.current === MODE.WAKE || modeRef.current === MODE.IDLE) break;
        if (err.message === 'timeout' || err.message === 'ended') {
          silenceStreak++;
          if (silenceStreak >= 2) {
            updateMode(MODE.SPEAKING);
            const msg = "I'm still here. Say a command or say goodbye to deactivate me.";
            addLog('cd', msg); await speak(msg);
            silenceStreak = 0;
            if (modeRef.current === MODE.SPEAKING) updateMode(MODE.ACTIVE);
          }
        }
      }
    }
  };

  // ── Command processor ────────────────────────────────────────────────────────
  const processCommand = async (text) => {
    const lower = text.toLowerCase().trim();
    updateMode(MODE.SPEAKING);

    // Delegate to conversation handler if mid-flow
    if (convCtxRef.current.step) {
      await handleConversationStep(lower);
      return;
    }

    // ── Greetings & chitchat ─────────────────────────────────────────────────
    if (/^(hello|hi|hey|hey there|hello there|hi there|howdy)$/.test(lower)) {
      const msg = "Hello! How can I help you today?";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/how are you|what'?s up|how'?s it going|how do you do/.test(lower)) {
      const msg = "I'm doing great and fully charged to assist you! What do you need?";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/who are you|introduce yourself|what are you|tell me about yourself/.test(lower)) {
      const msg =
        "I'm CD, short for Confi-Dence. Your personal hands-free voice assistant, " +
        "inspired by the spirit of perseverance — just like the Mars rover. " +
        "I'm here to help you manage emails and messages without lifting a finger.";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/what can you do|help me|your (features|capabilities|commands)|what do you (do|support)|how can you help/.test(lower)) {
      const msg =
        "I can read your inbox, compose and send emails, check unread messages, " +
        "navigate the app, and chat with you. Just speak naturally and I'll handle the rest!";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/good morning/.test(lower)) {
      const msg = "Good morning! Hope your day is off to a great start. How can I assist you?";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/good (evening|afternoon|night)/.test(lower)) {
      const h   = new Date().getHours();
      const tod = h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
      const msg = `Good ${tod}! How can I help you?`;
      addLog('cd', msg); await speak(msg); return;
    }
    if (/thank(s| you)|appreciate it/.test(lower)) {
      const msg = "You're most welcome! Is there anything else I can help with?";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/you'?re (great|amazing|awesome|the best|helpful|good)/.test(lower)) {
      const msg = "Thank you! That means a lot. I'm always here for you.";
      addLog('cd', msg); await speak(msg); return;
    }
    if (/what (time|day|date|is today|is the time)/.test(lower) || /^(what time is it|what'?s the date|what'?s today)$/.test(lower)) {
      const now = new Date();
      const msg = `It's ${now.toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })}.`;
      addLog('cd', msg); await speak(msg); return;
    }

    // ── Navigation ───────────────────────────────────────────────────────────
    if (/(open|go to|take me to) (profile|settings)/.test(lower)) {
      const msg = "Opening your profile.";
      addLog('cd', msg); await speak(msg); navigate('/profile'); return;
    }
    if (/(go to|open|take me to) (the )?dashboard/.test(lower)) {
      const msg = "Going to the dashboard.";
      addLog('cd', msg); await speak(msg); navigate('/dashboard'); return;
    }

    // ── Status ───────────────────────────────────────────────────────────────
    if (/^(status|system status)$|how is (the system|everything running)/.test(lower)) {
      const gTxt = gmailRef.current.connected
        ? `Gmail is connected as ${gmailRef.current.email}.`
        : 'Gmail is not connected.';
      const msg = `All systems operational. Voice engine is active. ${gTxt}`;
      addLog('cd', msg); await speak(msg); return;
    }

    // ── Gmail ────────────────────────────────────────────────────────────────
    if (/(read|check|open) (my )?(inbox|emails?)/.test(lower) ||
        /(what'?s in|what is in) (my )?(inbox|email)/.test(lower)) {
      await handleReadInbox(); return;
    }
    if (/(read|open) (my )?(latest|newest|most recent|first|top|last) (email|message)/.test(lower) ||
        /read (my )?(latest|newest) email/.test(lower)) {
      await handleReadLatestEmail(); return;
    }
    if (/(any |how many )?(unread|new) (emails?|messages?)/.test(lower) ||
        /do i have (any )?(new|unread) (emails?|messages?)/.test(lower)) {
      await handleUnreadCount(); return;
    }
    if (/(?:compose|write|send|draft) (?:an? )?(?:email|mail|message)/.test(lower)) {
      await handleStartCompose(); return;
  }

    // ── Connect Gmail ────────────────────────────────────────────────────────
    if (/connect (my |the )?(gmail|email)|link (my )?gmail/.test(lower)) {
      const msg = "Opening Gmail connection. Please complete the authorization in your browser.";
      addLog('cd', msg); await speak(msg);
      window.location.href = gmailConnectUrl();
      return;
    }

    // ── Logout ───────────────────────────────────────────────────────────────
    if (/log ?out|sign ?out|log me out|sign me out/.test(lower)) {
      const msg = "Signing you out. See you next time!";
      addLog('cd', msg);
      updateMode(MODE.SPEAKING);
      await speak(msg);
      stopRecognition();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      updateMode(MODE.IDLE);
      await logout();
      navigate('/login');
      return;
    }

    // ── Deactivate ───────────────────────────────────────────────────────────
    if (/^(goodbye|bye|good ?bye|sleep|deactivate|stop listening|that'?s all|stop|go to sleep)$/.test(lower)) {
      const msg = "Goodbye! Call my name whenever you need me.";
      addLog('cd', msg); await speak(msg);
      updateMode(MODE.WAKE);
      startWakeListening();
      return;
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    const msg = "I didn't quite catch that. Could you repeat, or ask me what I can do?";
    addLog('cd', msg); await speak(msg);
  };

  // ── Multi-step conversation (email compose flow) ──────────────────────────
  const handleConversationStep = async (text) => {
    const ctx = convCtxRef.current;
    updateMode(MODE.SPEAKING);

    // ── Escape commands — MUST be first ──────────────────────────────────────
    if (/^(cancel|stop|abort|never mind|forget it|goodbye|bye|sign ?out|log ?out|log me out|sign me out)$/.test(text.trim())) {
      convCtxRef.current = { step: null, data: {} };
      if (/log ?out|sign ?out|log me out|sign me out/.test(text)) {
        const msg = "Signing you out. See you next time!";
        addLog('cd', msg); await speak(msg);
        stopRecognition();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        updateMode(MODE.IDLE);
        await logout();
        navigate('/login');
      } else if (/goodbye|bye/.test(text)) {
        const msg = "Goodbye! Call my name whenever you need me.";
        addLog('cd', msg); await speak(msg);
        updateMode(MODE.WAKE); startWakeListening();
      } else {
        const msg = "Email cancelled. What else can I help you with?";
        addLog('cd', msg); await speak(msg);
      }
      return;
    }

    // ── rest of your code exactly as you have it ──────────────────────────────
    if (ctx.step === 'compose_to') {
  // ── Step A: get username ──────────────────────────────────────────────────
      updateMode(MODE.SPEAKING);
      const msg1 = "What is the recipient's username? That's the part before the at symbol.";
      addLog('cd', msg1); await speak(msg1);

      let username = '';
      try {
        const alts = await listenOnce('command', 15000);
        // Clean username — remove spaces, lowercase, keep valid chars
        username = (alts[0] || '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9._+\-]/g, '');
      } catch {
        updateMode(MODE.SPEAKING);
        const msg = "I couldn't catch that. Let's try the compose command again.";
        addLog('cd', msg); await speak(msg);
        convCtxRef.current = { step: null, data: {} };
        return;
      }

      if (!username) {
        updateMode(MODE.SPEAKING);
        const msg = "I didn't get a username. Let's try again.";
        addLog('cd', msg); await speak(msg);
        convCtxRef.current = { step: null, data: {} };
        return;
      }

      // ── Step B: get domain ────────────────────────────────────────────────────
      updateMode(MODE.SPEAKING);
      const msg2 = `Got it — ${username}. Now what is the domain? For example: gmail dot com, or yahoo dot com.`;
      addLog('cd', msg2); await speak(msg2);

      let domain = '';
      try {
        const alts = await listenOnce('command', 15000);
        const raw  = (alts[0] || '').toLowerCase().trim();

        // Parse spoken domain
        domain = raw
          .replace(/\s+dot\s+/g, '.')
          .replace(/\bdot\b/g, '.')
          .replace(/\s+period\s+/g, '.')
          .replace(/\s*\.\s*/g, '.')
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9.\-]/g, '');
      } catch {
        updateMode(MODE.SPEAKING);
        const msg = "I couldn't catch the domain. Let's try again.";
        addLog('cd', msg); await speak(msg);
        convCtxRef.current = { step: null, data: {} };
        return;
      }

      if (!domain || !domain.includes('.')) {
        updateMode(MODE.SPEAKING);
        const msg = "That doesn't look like a valid domain. Let's try the compose command again.";
        addLog('cd', msg); await speak(msg);
        convCtxRef.current = { step: null, data: {} };
        return;
      }

      // ── Step C: confirm full email ────────────────────────────────────────────
      const fullEmail  = `${username}@${domain}`;
      const spokenForm = `${username} at ${domain.replace(/\./g, ' dot ')}`;
      convCtxRef.current = { step: 'compose_to_confirm', data: { to: fullEmail } };

      updateMode(MODE.SPEAKING);
      const msg3 = `The email is ${spokenForm}. Is that correct? Say yes or no.`;
      addLog('cd', msg3); await speak(msg3);
    // ── Confirm recipient ─────────────────────────────────────────────────────
    } else if (ctx.step === 'compose_to_confirm') {
      if (/yes|yeah|yep|correct|right|sure|confirm|absolutely/.test(text)) {
        convCtxRef.current = { step: 'compose_subject', data: { ...ctx.data } };
        const msg = "Great! What is the subject of this email?";
        addLog('cd', msg); await speak(msg);
      } else {
        convCtxRef.current = { step: 'compose_to', data: {} };
        const msg = "No problem. Please say the recipient's full email address again.";
        addLog('cd', msg); await speak(msg);
      }

    // ── Subject ───────────────────────────────────────────────────────────────
    } else if (ctx.step === 'compose_subject') {
      convCtxRef.current = { step: 'compose_body', data: { ...ctx.data, subject: text } };
      const msg = "Got it. What would you like the message to say?";
      addLog('cd', msg); await speak(msg);

    // ── Body ──────────────────────────────────────────────────────────────────
    } else if (ctx.step === 'compose_body') {
      convCtxRef.current = { step: 'compose_confirm', data: { ...ctx.data, body: text } };
      const { to, subject } = convCtxRef.current.data;
      const toSpoken = to.replace('@', ' at ').replace(/\./g, ' dot ');
      const msg = `Ready to send. To: ${toSpoken}. Subject: ${subject}. Message: ${text}. Shall I send it? Say yes or no.`;
      addLog('cd', msg); await speak(msg);

    // ── Final send ────────────────────────────────────────────────────────────
    } else if (ctx.step === 'compose_confirm') {
      if (/yes|send|confirm|go ahead|do it|yep|yeah|sure|absolutely/.test(text)) {
        const { to, subject, body } = ctx.data;
        convCtxRef.current = { step: null, data: {} };
        updateMode(MODE.PROCESSING);
        try {
          await gmailApi.sendEmail({ to, subject, body });
          updateMode(MODE.SPEAKING);
          const msg = "Your email has been sent successfully!";
          addLog('cd', msg); await speak(msg);
        } catch {
          updateMode(MODE.SPEAKING);
          const msg = "Sorry, I couldn't send the email. Please check your Gmail connection and try again.";
          addLog('cd', msg); await speak(msg);
        }
      } else {
        convCtxRef.current = { step: null, data: {} };
        const msg = "Email cancelled. What else can I help you with?";
        addLog('cd', msg); await speak(msg);
      }
    }
  };
  // ── Gmail action handlers ────────────────────────────────────────────────────
  const handleReadInbox = async () => {
    if (!gmailRef.current.connected) {
      const msg = "Your Gmail is not connected. Say connect Gmail, or use the button below.";
      addLog('cd', msg); await speak(msg); return;
    }
    updateMode(MODE.PROCESSING);
    try {
      const { emails = [] } = await gmailApi.getInbox(5);
      if (emails.length === 0) {
        const msg = "Your inbox appears to be empty.";
        addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg); return;
      }
      const unread = emails.filter((e) => e.isUnread).length;
      let summary  = `You have ${emails.length} emails, ${unread} unread. `;
      emails.slice(0, 3).forEach((e, i) => {
        const from = e.from.replace(/<[^>]+>/g, '').trim() || e.from;
        summary += `${i + 1}: From ${from}. Subject: ${e.subject}. `;
      });
      if (emails.length > 3) summary += `And ${emails.length - 3} more.`;
      addLog('cd', summary); updateMode(MODE.SPEAKING); await speak(summary);
    } catch {
      const msg = "Sorry, I couldn't fetch your inbox. Please try again.";
      addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg);
    }
  };

  const handleReadLatestEmail = async () => {
    if (!gmailRef.current.connected) {
      const msg = "Your Gmail is not connected. Say connect Gmail to link it.";
      addLog('cd', msg); await speak(msg); return;
    }
    updateMode(MODE.PROCESSING);
    try {
      const { emails = [] } = await gmailApi.getInbox(1);
      if (emails.length === 0) {
        const msg = "Your inbox is empty.";
        addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg); return;
      }
      const { email } = await gmailApi.getEmail(emails[0].id);
      const from      = email.from.replace(/<[^>]+>/g, '').trim() || email.from;
      const body      = (email.body || email.snippet).replace(/\s+/g, ' ').trim().substring(0, 400);
      const msg       = `Latest email. From: ${from}. Subject: ${email.subject}. Message: ${body}`;
      addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg);
    } catch {
      const msg = "Sorry, I couldn't read the email. Please try again.";
      addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg);
    }
  };

  const handleUnreadCount = async () => {
    if (!gmailRef.current.connected) {
      const msg = "Your Gmail is not connected.";
      addLog('cd', msg); await speak(msg); return;
    }
    updateMode(MODE.PROCESSING);
    try {
      const { count } = await gmailApi.getUnreadCount();
      const msg = count === 0
        ? "You have no unread emails. Your inbox is all clear!"
        : `You have approximately ${count} unread ${count === 1 ? 'email' : 'emails'} in your inbox.`;
      addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg);
    } catch {
      const msg = "Sorry, I couldn't get your unread count. Please try again.";
      addLog('cd', msg); updateMode(MODE.SPEAKING); await speak(msg);
    }
  };

  const handleStartCompose = async () => {
    if (!gmailRef.current.connected) {
      const msg = "Your Gmail is not connected. Please connect Gmail first.";
      addLog('cd', msg); await speak(msg); return;
    }
    // Always ask for recipient — never try to parse it from the command
    convCtxRef.current = { step: 'compose_to', data: {} };
    const msg = "Sure! Who would you like to email? Please say their full email address.";
    addLog('cd', msg); await speak(msg);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!SpeechRecognitionAPI) {
    return (
      <div className="card border-warn/30 bg-warn/5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-white mb-1">Browser Not Supported</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The Web Speech API requires{' '}
              <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer"
                className="text-violet-light underline">Google Chrome</a>{' '}
              or{' '}
              <a href="https://www.microsoft.com/edge" target="_blank" rel="noreferrer"
                className="text-violet-light underline">Microsoft Edge</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.idle;

  return (
    <div className="space-y-4 animate-slide-up">

      {/* ── Main CD Panel ──────────────────────────────────────────────────── */}
      <div className="card flex flex-col items-center gap-6 py-8">

        {/* Orb */}
        <div className="relative flex items-center justify-center w-32 h-32">
          {cfg.pulse && (
            <>
              <span className={`absolute inset-0 rounded-full ${cfg.orb} opacity-10 animate-ping`} />
              <span className={`absolute w-28 h-28 rounded-full ${cfg.orb} opacity-10 animate-pulse`} />
            </>
          )}
          <div
            className={`relative w-24 h-24 rounded-full ${cfg.orb}
                        ring-4 ${cfg.ring} ring-offset-2 ring-offset-dark-800
                        flex items-center justify-center shadow-2xl
                        transition-all duration-500`}
          >
            <span className="text-white font-bold text-3xl tracking-tighter select-none">CD</span>
          </div>
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-white font-semibold">Confi-Dence</p>
          <p className="text-gray-500 text-sm mt-0.5">{cfg.label}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {mode === MODE.IDLE && (
            <button onClick={startWakeListening} className="btn-primary px-7">
              🎙️ Activate CD
            </button>
          )}
          {mode !== MODE.IDLE && (
            <button
              onClick={() => {
                stopRecognition();
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                convCtxRef.current = { step: null, data: {} };
                updateMode(MODE.IDLE);
              }}
              className="btn-secondary px-7"
            >
              ⏹ Deactivate
            </button>
          )}
        </div>

        {/* Hint */}
        {mode === MODE.IDLE && (
          <p className="text-gray-700 text-xs text-center max-w-xs leading-relaxed">
            CD passively listens for the wake word. Say{' '}
            <span className="font-mono text-violet-light">CD</span> to activate, then{' '}
            {voicePinSet && 'speak your PIN, then '}
            give a command.
          </p>
        )}
        {mode === MODE.WAKE && (
          <p className="text-gray-600 text-xs">
            Say <span className="font-mono text-violet-light">CD</span> to wake me up
          </p>
        )}
      </div>

      {/* ── Gmail Banner ───────────────────────────────────────────────────── */}
      {!gmailConnected ? (
        <div className="card border-warn/20 bg-warn/5 flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📧</span>
            <div>
              <p className="text-sm font-medium text-white">Gmail not connected</p>
              <p className="text-xs text-gray-500">Connect to enable email voice commands</p>
            </div>
          </div>
          <a href={gmailConnectUrl()} className="btn-primary text-xs px-4 py-2 flex-shrink-0">
            Connect Gmail
          </a>
        </div>
      ) : (
        <div className="card border-success/20 bg-success/5 flex items-center justify-between py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-success">✅</span>
            <p className="text-sm text-gray-300">
              Gmail connected as <span className="text-white font-medium">{gmailEmail}</span>
            </p>
          </div>
          <button
            onClick={async () => {
              await gmailApi.disconnect();
              gmailRef.current = { connected: false, email: '' };
              setGmailConnected(false);
              setGmailEmail('');
            }}
            className="text-xs text-gray-600 hover:text-danger transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-950/30 border border-danger/30 rounded-2xl p-3 flex items-start gap-2.5">
          <span>⚠️</span>
          <p className="text-danger text-sm flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-gray-600 hover:text-gray-300 text-lg">×</button>
        </div>
      )}

      {/* ── Last Interaction ───────────────────────────────────────────────── */}
      {(transcript || cdResponse) && (
        <div className="card space-y-3">
          {transcript && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1.5">You said</p>
              <div className="bg-dark-700 rounded-xl p-3 border border-dark-500">
                <p className="text-white text-sm">"{transcript}"</p>
              </div>
            </div>
          )}
          {cdResponse && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1.5">CD said</p>
              <div className="bg-violet-dim border border-violet/20 rounded-xl p-3">
                <p className="text-gray-200 text-sm leading-relaxed">{cdResponse}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Session Log ───────────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-sm">Session Log</h3>
            <button
              onClick={() => { logRef.current = []; setLog([]); }}
              className="text-xs text-gray-600 hover:text-danger transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {[...log].reverse().map((entry) => (
              <div key={entry.id} className="flex gap-2.5 items-start">
                <span className="text-xs flex-shrink-0 mt-0.5">
                  {entry.type === 'user' ? '🗣️' : entry.type === 'cd' ? '🤖' : '⚙️'}
                </span>
                <p className={`text-xs leading-relaxed flex-1 ${
                  entry.type === 'user'   ? 'text-gray-300'   :
                  entry.type === 'cd'     ? 'text-violet-light':
                  'text-gray-600'
                }`}>
                  {entry.text}
                </p>
                <span className="text-[10px] text-gray-700 flex-shrink-0 font-mono">
                  {entry.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}