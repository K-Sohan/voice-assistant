require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const session      = require('express-session');
const passport     = require('./config/passport');
const connectDB    = require('./config/database');

const authRoutes    = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const gmailRoutes   = require('./routes/gmailRoutes');   // ← NEW
const voiceRoutes   = require('./routes/voiceRoutes');   // ← NEW

const app  = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_dev_secret_change_in_prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 10 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth',    authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/gmail',   gmailRoutes);   // ← NEW
app.use('/api/voice',   voiceRoutes);                    // ← NEW

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Voice Assistant API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
});