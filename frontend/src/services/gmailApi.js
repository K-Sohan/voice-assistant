import api from './api.js';

const gmailApi = {
  getStatus: async () => {
    const { data } = await api.get('/gmail/status');
    return data;
  },

  getInbox: async (limit = 10) => {
    const { data } = await api.get(`/gmail/inbox?limit=${limit}`);
    return data;
  },

  getEmail: async (id) => {
    const { data } = await api.get(`/gmail/email/${id}`);
    return data;
  },

  getUnreadCount: async () => {
    const { data } = await api.get('/gmail/unread-count');
    return data;
  },

  sendEmail: async ({ to, subject, body }) => {
    const { data } = await api.post('/gmail/send', { to, subject, body });
    return data;
  },

  disconnect: async () => {
    const { data } = await api.delete('/gmail/disconnect');
    return data;
  },

  replyEmail: async ({ to, subject, body, messageId, threadId }) => {
    const { data } = await api.post('/gmail/reply', { to, subject, body, messageId, threadId });
    return data;
  },

  searchEmails: async (query) => {
    const { data } = await api.get(`/gmail/search?q=${encodeURIComponent(query)}`);
    return data;
  },

  markAsRead: async (id) => {
    const { data } = await api.put(`/gmail/mark-read/${id}`);
    return data;
  },
  deleteEmail: async (id) => {
    const { data } = await api.delete(`/gmail/delete/${id}`);
    return data;
  },

};

export default gmailApi;