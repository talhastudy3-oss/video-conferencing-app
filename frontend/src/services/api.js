import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  guestLogin: (name) => api.post('/auth/guest', { name }),
  getMe: () => api.get('/auth/me'),
};

export const meetingsAPI = {
  create: (title) => api.post('/meetings/create', { title }),
  schedule: (title, scheduledTime) => api.post('/meetings/schedule', { title, scheduledTime }),
  getByRoomId: (roomId) => api.get(`/meetings/${roomId}`),
  join: (roomId) => api.post(`/meetings/${roomId}/join`),
  getHistory: () => api.get('/meetings/history'),
  end: (roomId) => api.delete(`/meetings/${roomId}`),
};

export default api;
