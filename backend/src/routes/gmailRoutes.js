const express  = require('express');
const router   = express.Router();
const { google } = require('googleapis');
const { protect } = require('../middleware/authMiddleware');
const Profile  = require('../models/Profile');

// ── OAuth2 client factory ─────────────────────────────────────────────────────
const makeOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_CALLBACK_URL
  );

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

// ── Helper: get authenticated Gmail client for a user ─────────────────────────
const getGmailClient = async (userId) => {
  const profile = await Profile.findOne({ user: userId });
  if (!profile?.gmailConnected) throw new Error('Gmail not connected');

  const auth = makeOAuth2Client();
  auth.setCredentials({
    access_token:  profile.gmailTokens.accessToken,
    refresh_token: profile.gmailTokens.refreshToken,
  });

  // Auto-refresh if token is expired
  if (
    profile.gmailTokens.tokenExpiry &&
    new Date() >= new Date(profile.gmailTokens.tokenExpiry)
  ) {
    const { credentials } = await auth.refreshAccessToken();
    await Profile.findOneAndUpdate(
      { user: userId },
      {
        'gmailTokens.accessToken':  credentials.access_token,
        'gmailTokens.tokenExpiry':  credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      }
    );
    auth.setCredentials(credentials);
  }

  return google.gmail({ version: 'v1', auth });
};

// ── Helper: decode base64url email body ───────────────────────────────────────
const decodeBody = (data) => {
  if (!data) return '';
  return Buffer.from(
    data.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf-8');
};

// ── Helper: extract plain text recursively from MIME parts ───────────────────
const extractPlainText = (payload) => {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return '';
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/connect  →  Start Gmail OAuth flow
// ─────────────────────────────────────────────────────────────────────────────
router.get('/connect', protect, (req, res) => {
  const auth = makeOAuth2Client();
  const url  = auth.generateAuthUrl({
    access_type: 'offline',
    scope:       GMAIL_SCOPES,
    prompt:      'consent',
    // ← pass userId in state instead of session — survives the redirect
    state:       req.user._id.toString(),
  });
  res.redirect(url);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/callback  →  Handle Google redirect after consent
// ─────────────────────────────────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent(error)}`
    );
  }

  // ← read userId from state param instead of session
  const userId = state;
  if (!userId) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent('Missing state. Please try again.')}`
    );
  }

  try {
    const auth = makeOAuth2Client();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    const gmail   = google.gmail({ version: 'v1', auth });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    const updatePayload = {
      gmailConnected:               true,
      'gmailTokens.accessToken':    tokens.access_token,
      'gmailTokens.connectedEmail': profile.data.emailAddress,
      'gmailTokens.tokenExpiry':    tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    };
    if (tokens.refresh_token) {
      updatePayload['gmailTokens.refreshToken'] = tokens.refresh_token;
    }

    await Profile.findOneAndUpdate({ user: userId }, updatePayload);

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?gmail_connected=true`);
  } catch (err) {
    console.error('Gmail callback error:', err);
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?gmail_error=${encodeURIComponent('Failed to connect Gmail. Please try again.')}`
    );
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    res.json({
      success:   true,
      connected: profile?.gmailConnected || false,
      email:     profile?.gmailTokens?.connectedEmail || null,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/inbox?limit=10
// ─────────────────────────────────────────────────────────────────────────────
router.get('/inbox', protect, async (req, res) => {
  try {
    const gmail      = await getGmailClient(req.user._id);
    const maxResults = Math.min(parseInt(req.query.limit) || 10, 20);

    const list = await gmail.users.messages.list({
      userId:     'me',
      labelIds:   ['INBOX'],
      maxResults,
    });

    const messages = list.data.messages || [];

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId:          'me',
          id:              msg.id,
          format:          'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = detail.data.payload?.headers || [];
        const get     = (name) => headers.find((h) => h.name === name)?.value || '';

        return {
          id:       msg.id,
          from:     get('From'),
          subject:  get('Subject') || '(No subject)',
          date:     get('Date'),
          snippet:  detail.data.snippet || '',
          isUnread: detail.data.labelIds?.includes('UNREAD') ?? false,
        };
      })
    );

    res.json({ success: true, emails });
  } catch (err) {
    if (err.message === 'Gmail not connected') {
      return res.status(400).json({ success: false, message: 'Gmail not connected.' });
    }
    console.error('Inbox error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch inbox.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/email/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/email/:id', protect, async (req, res) => {
  try {
    const gmail  = await getGmailClient(req.user._id);
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id:     req.params.id,
      format: 'full',
    });

    const headers = detail.data.payload?.headers || [];
    const get     = (name) => headers.find((h) => h.name === name)?.value || '';
    const body    = extractPlainText(detail.data.payload);

    // Mark as read
    await gmail.users.messages.modify({
      userId:      'me',
      id:          req.params.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    }).catch(() => {}); // Non-fatal

    res.json({
      success: true,
      email: {
        id:      req.params.id,
        from:    get('From'),
        to:      get('To'),
        subject: get('Subject') || '(No subject)',
        date:    get('Date'),
        body:    body.replace(/\s+/g, ' ').trim().substring(0, 1500),
        snippet: detail.data.snippet || '',
      },
    });
  } catch (err) {
    if (err.message === 'Gmail not connected') {
      return res.status(400).json({ success: false, message: 'Gmail not connected.' });
    }
    console.error('Get email error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch email.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/unread-count
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
  try {
    const gmail  = await getGmailClient(req.user._id);
    const result = await gmail.users.messages.list({
      userId:   'me',
      labelIds: ['INBOX', 'UNREAD'],
      maxResults: 1,
    });
    res.json({ success: true, count: result.data.resultSizeEstimate || 0 });
  } catch (err) {
    if (err.message === 'Gmail not connected') {
      return res.status(400).json({ success: false, message: 'Gmail not connected.' });
    }
    res.status(500).json({ success: false, message: 'Failed to get unread count.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail/send
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', protect, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'to, subject, and body are required.',
      });
    }

    const gmail   = await getGmailClient(req.user._id);
    const profile = await Profile.findOne({ user: req.user._id });
    const from    = profile.gmailTokens.connectedEmail;

    const raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    await gmail.users.messages.send({
      userId:      'me',
      requestBody: { raw: encoded },
    });

    res.json({ success: true, message: 'Email sent successfully.' });
  } catch (err) {
    if (err.message === 'Gmail not connected') {
      return res.status(400).json({ success: false, message: 'Gmail not connected.' });
    }
    console.error('Send email error:', err);
    res.status(500).json({ success: false, message: 'Failed to send email.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/gmail/disconnect
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/disconnect', protect, async (req, res) => {
  try {
    await Profile.findOneAndUpdate(
      { user: req.user._id },
      {
        gmailConnected:                false,
        'gmailTokens.accessToken':     null,
        'gmailTokens.refreshToken':    null,
        'gmailTokens.tokenExpiry':     null,
        'gmailTokens.connectedEmail':  null,
      }
    );
    res.json({ success: true, message: 'Gmail disconnected.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to disconnect Gmail.' });
  }
});

module.exports = router;