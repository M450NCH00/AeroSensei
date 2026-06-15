// src/app/api/axiosInstance.ts
import axios from "axios";

const axiosInstance = axios.create({
  // FIXED: Changed from REACT_APP_ to NEXT_PUBLIC_ so Next.js can read it
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081"}/api`,
  withCredentials: true, // Crucial for passing HttpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// Global interceptor for automated silent token refreshing
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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