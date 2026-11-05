// src/app/api/axiosInstance.ts
import axios from "axios";

const axiosInstance = axios.create({
  // Default to a same-origin relative base ("/api") so the browser calls
  // whichever host served the page (localhost, EC2 DNS, IP, or a future domain)
  // via the nginx reverse proxy — no hardcoded host, no cross-origin/CORS.
  // Override with NEXT_PUBLIC_API_URL only to point at a different origin.
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ""}/api`,
  withCredentials: true, // Crucial for passing HttpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// Endpoints where a 401 means "bad credentials" / "no session" — NOT an expired
// token. These must never trigger the silent-refresh-then-redirect flow, or a
// failed login would reload the page instead of surfacing the error message.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/refresh", "/auth/logout"];

// Global interceptor for automated silent token refreshing
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) =>
      originalRequest?.url?.includes(path)
    );

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Automatically hits your friend's refresh route using the base URL
        await axios.post(
          `${axiosInstance.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;