import { create } from 'zustand';
export const useAuthStore = create(set => ({
  user: JSON.parse(localStorage.getItem('user')||'null'),
  accessToken: localStorage.getItem('accessToken') || null,
  
  setAuth: (user, token) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('accessToken', token); set({ user, accessToken: token }); },
  logout: () => { localStorage.removeItem('user'); localStorage.removeItem('accessToken'); set({ user: null, accessToken: null }); }
}));


