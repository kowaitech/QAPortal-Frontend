// // import axios from 'axios';
// // export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE, withCredentials: true });
// import axios from "axios";
// import { useAuthStore } from "./authStore";

// export const api = axios.create({
//   baseURL: import.meta.env.VITE_API_BASE,
// withCredentials: true,  // Needed if cookies/session are used

// });

// // Attach token automatically on every request
// api.interceptors.request.use(
//   (config) => {
//     const token = useAuthStore.getState().accessToken; // ✅ correct key
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );


import axios from "axios";
import { useAuthStore } from "./authStore";

// Determine base URL: use proxy in development, direct URL in production
const getBaseURL = () => {
  // If VITE_API_BASE is explicitly set, use it
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // In development, use the proxy path to avoid CORS
  if (import.meta.env.DEV) {
    return '/api';
  }
  // In production, use the full backend URL
  return 'https://qaportal-backend-iyjk.onrender.com';
};

// Create axios instance
export const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Needed for cookies/session
});

// Request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    // Get the token from Zustand store
    const token = useAuthStore.getState().accessToken;
    if (token) {
      // Add Authorization header
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: Response interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Optional: auto logout if token expired
      useAuthStore.getState().logout();
      // Optionally redirect to login page
    }
    return Promise.reject(error);
  }
);
