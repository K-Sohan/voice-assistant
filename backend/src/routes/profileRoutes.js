const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profile  →  Fetch authenticated user's profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    let profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await Profile.create({ user: req.user._id });
    }
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/profile  →  Update preferences
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', protect, async (req, res) => {
  try {
    const { name, preferredLanguage, voiceSpeed, messagingPlatforms } = req.body;

    let profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new Profile({ user: req.user._id });
    }

    if (preferredLanguage !== undefined) profile.preferredLanguage = preferredLanguage;
    if (voiceSpeed !== undefined) profile.voiceSpeed = Math.min(2.0, Math.max(0.5, Number(voiceSpeed)));
    if (messagingPlatforms !== undefined) profile.messagingPlatforms = messagingPlatforms;

    await profile.save();

    // Optionally update display name
    if (name && name.trim()) {
      await User.findByIdAndUpdate(req.user._id, { name: name.trim() });
    }

    res.json({ success: true, message: 'Profile updated successfully.', profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/set-pin  →  Hash and store a 4-6 digit Voice PIN
// ─────────────────────────────────────────────────────────────────────────────
router.post('/set-pin', protect, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4,6}$/.test(pin.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Voice PIN must be 4-6 numeric digits.',
      });
    }

    let profile = await Profile.findOne({ user: req.user._id });
    if (!profile) profile = new Profile({ user: req.user._id });

    await profile.setVoicePin(pin);
    await profile.save();

    res.json({ success: true, message: 'Voice PIN saved successfully.' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ success: false, message: 'Server error setting Voice PIN.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/verify-pin  →  Validate a supplied PIN (voice auth check)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-pin', protect, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required.' });
    }

    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile || !profile.voicePinSet) {
      return res.status(400).json({ success: false, message: 'No Voice PIN has been configured.' });
    }

    const valid = await profile.verifyVoicePin(pin);
    if (valid) {
      return res.json({ success: true, message: 'Voice PIN verified. Assistant activated.' });
    }
    return res.status(401).json({ success: false, message: 'Incorrect Voice PIN.' });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying Voice PIN.' });
  }
});

module.exports = router;