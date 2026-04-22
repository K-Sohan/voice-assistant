const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { protect } = require('../middleware/authMiddleware');

// ── Helper: sign a JWT ─────────────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Helper: ensure profile exists ─────────────────────────────────────────
const ensureProfile = async (userId) => {
  const exists = await Profile.findOne({ user: userId });
  if (!exists) await Profile.create({ user: userId });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are all required.',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with that email already exists.',
      });
    }

    const user = await User.create({ name, email, password, authProvider: 'local' });
    await ensureProfile(user._id);

    const token = signToken(user._id);
    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info?.message || 'Invalid credentials.',
      });
    }
    try {
      await ensureProfile(user._id);
      const token = signToken(user._id);
      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          authProvider: user.authProvider,
        },
      });
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google  →  Redirect to Google consent screen
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google/callback  →  Handle Google redirect
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent('Google sign-in failed. Please try again.')}`,
  }),
  (req, res) => {
    const token = signToken(req.user._id);
    // Redirect to frontend callback page with the JWT in the query string
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/microsoft  →  Structure ready; activated when Azure app is set up
// ─────────────────────────────────────────────────────────────────────────────
router.get('/microsoft', (req, res) => {
  const message = encodeURIComponent(
    'Microsoft OAuth is not yet configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to backend/.env to enable it.'
  );
  res.redirect(`${process.env.FRONTEND_URL}/login?error=${message}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/microsoft/callback  →  Placeholder for Azure redirect
// ─────────────────────────────────────────────────────────────────────────────
router.get('/microsoft/callback', (req, res) => {
  res.redirect(
    `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent('Microsoft OAuth callback not configured.')}`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  →  Return current authenticated user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      authProvider: req.user.authProvider,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', protect, (req, res) => {
  // JWTs are stateless — the client simply discards the token.
  res.json({ success: true, message: 'Logged out successfully.' });
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/voice-login  →  Identify user by email + verify Voice PIN
// ─────────────────────────────────────────────────────────────────────────────
router.post('/voice-login', async (req, res) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Email and PIN are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found with that email address.',
      });
    }

    const profile = await Profile.findOne({ user: user._id });
    if (!profile || !profile.voicePinSet) {
      return res.status(400).json({
        success: false,
        message: 'No Voice PIN configured for this account.',
      });
    }

    const valid = await profile.verifyVoicePin(pin);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect Voice PIN.',
      });
    }

    await ensureProfile(user._id);
    const token = signToken(user._id);
    return res.json({
      success: true,
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        avatar:       user.avatar,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error('Voice login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during voice login.',
    });
  }
});
module.exports = router;