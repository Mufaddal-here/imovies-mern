import axios from 'axios';
import { createContext } from 'react';
import { toast } from 'react-toastify';
export const AuthCtx = createContext({});
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
api.interceptors.response.use(r => r, e => { toast.error(e.response?.data?.message || 'Network error'); return Promise.reject(e); });
export default api;
