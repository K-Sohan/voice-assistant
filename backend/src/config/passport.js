const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const Profile = require('../models/Profile');

// ── Helper: auto-create profile on first login ─────────────────────────────
const ensureProfile = async (userId) => {
  const exists = await Profile.findOne({ user: userId });
  if (!exists) {
    await Profile.create({ user: userId });
  }
};

// ── Local Strategy (email + password) ────────────────────────────────────────
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        if (user.authProvider !== 'local') {
          return done(null, false, {
            message: `This email is registered via ${user.authProvider}. Please use that sign-in method.`,
          });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ── Google OAuth 2.0 Strategy ─────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Try to find user by their Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // 2. Check if email already exists under a different provider
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link Google ID to the existing account
            user.googleId = profile.id;
            user.authProvider = 'google';
            if (!user.avatar && profile.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
            }
            await user.save();
          } else {
            // Create a brand-new user
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              avatar: profile.photos?.[0]?.value || null,
              authProvider: 'google',
            });
          }
        }

        await ensureProfile(user._id);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ── Serialize / Deserialize (used by express-session for OAuth handshake) ────
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;