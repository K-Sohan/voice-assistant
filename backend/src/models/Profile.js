const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MessagingPlatformsSchema = new mongoose.Schema(
  {
    gmail:    { type: Boolean, default: false },
    outlook:  { type: Boolean, default: false },
    slack:    { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    teams:    { type: Boolean, default: false },
  },
  { _id: false }
);

// ── NEW: Gmail token sub-schema ───────────────────────────────────────────────
const GmailTokensSchema = new mongoose.Schema(
  {
    accessToken:    { type: String, default: null },
    refreshToken:   { type: String, default: null },
    tokenExpiry:    { type: Date,   default: null },
    connectedEmail: { type: String, default: null },
  },
  { _id: false }
);

const ProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    preferredLanguage: {
      type: String,
      default: 'en-US',
      trim: true,
    },
    voiceSpeed: {
      type: Number,
      default: 1.0,
      min: [0.5, 'Voice speed cannot be below 0.5'],
      max: [2.0, 'Voice speed cannot exceed 2.0'],
    },
    messagingPlatforms: {
      type: MessagingPlatformsSchema,
      default: () => ({}),
    },
    voicePinHash: {
      type: String,
      default: null,
    },
    voicePinSet: {
      type: Boolean,
      default: false,
    },
    // ── NEW ──────────────────────────────────────────────────────────────
    gmailTokens: {
      type: GmailTokensSchema,
      default: () => ({}),
    },
    gmailConnected: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ProfileSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

ProfileSchema.methods.setVoicePin = async function (pin) {
  const salt = await bcrypt.genSalt(12);
  this.voicePinHash = await bcrypt.hash(pin.toString(), salt);
  this.voicePinSet = true;
};

ProfileSchema.methods.verifyVoicePin = async function (pin) {
  if (!this.voicePinHash) return false;
  return bcrypt.compare(pin.toString(), this.voicePinHash);
};

ProfileSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.voicePinHash;
  // Never expose raw Gmail tokens to the client
  if (obj.gmailTokens) {
    obj.gmailTokens = { connectedEmail: obj.gmailTokens.connectedEmail };
  }
  return obj;
};

module.exports = mongoose.model('Profile', ProfileSchema);