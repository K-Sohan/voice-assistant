const express     = require('express');
const router      = express.Router();
const { protect } = require('../middleware/authMiddleware');

// ── Smart email parser ────────────────────────────────────────────────────────
const parseEmailFromSpeech = (text) => {
  let s = text.toLowerCase().trim();

  // Number words → digits
  const numMap = {
    zero:'0', one:'1', two:'2', three:'3', four:'4',
    five:'5', six:'6', seven:'7', eight:'8', nine:'9', oh:'0',
  };
  s = s.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g,
    (m) => numMap[m]
  );

  // @ symbol
  s = s.replace(/\s+at the rate\s+/g, '@');
  s = s.replace(/\s+at\s+/g, '@');
  s = s.replace(/\s*@\s*/g, '@');

  // Dot
  s = s.replace(/\s+dot\s+/g, '.');
  s = s.replace(/\s+period\s+/g, '.');
  s = s.replace(/\s*\.\s*/g, '.');

  // Special chars
  s = s.replace(/\s+underscore\s+/g, '_');
  s = s.replace(/\s+under\s+score\s+/g, '_');
  s = s.replace(/\s+dash\s+/g, '-');
  s = s.replace(/\s+hyphen\s+/g, '-');
  s = s.replace(/\s+plus\s+/g, '+');

  // Remove spaces — keep local and domain separate
  if (s.includes('@')) {
    const atIndex = s.indexOf('@');
    const local   = s.slice(0, atIndex).replace(/\s+/g, '');
    const domain  = s.slice(atIndex + 1).replace(/\s+/g, '');
    s = `${local}@${domain}`;
  } else {
    s = s.replace(/\s+/g, '');
  }

  // Strip invalid characters
  s = s.replace(/[^a-z0-9@._+\-]/g, '');
  return s;
};

// ── Smart PIN parser ──────────────────────────────────────────────────────────
const parsePinFromSpeech = (text) => {
  const numMap = {
    zero:'0', one:'1', two:'2', three:'3', four:'4',
    five:'5', six:'6', seven:'7', eight:'8', nine:'9', oh:'0',
  };
  return text
    .toLowerCase()
    .replace(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g,
      (m) => numMap[m]
    )
    .replace(/\D/g, '');
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/parse-email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/parse-email', protect, (req, res) => {
  const { speech } = req.body;
  if (!speech) return res.status(400).json({ success: false });

  console.log('[parse-email] raw:', speech);
  const email = parseEmailFromSpeech(speech);
  console.log('[parse-email] result:', email);

  if (!email.includes('@') || !email.includes('.')) {
    return res.json({ success: false, email: null });
  }
  res.json({ success: true, email });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/parse-pin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/parse-pin', protect, (req, res) => {
  const { speech } = req.body;
  if (!speech) return res.status(400).json({ success: false });

  console.log('[parse-pin] raw:', speech);
  const pin = parsePinFromSpeech(speech);
  console.log('[parse-pin] result:', pin);

  if (!pin || pin.length < 4) {
    return res.json({ success: false, pin: null });
  }
  res.json({ success: true, pin });
});

module.exports = router;