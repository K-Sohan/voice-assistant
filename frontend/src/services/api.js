import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Attach JWT to every outgoing request ──────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('va_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Handle global 401 — token expired / invalid ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('va_token');
      localStorage.removeItem('va_user');
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const parseEmailFromSpeech = async (speech) => {
  const { data } = await api.post('/voice/parse-email', { speech });
  return data;
};

export default api;