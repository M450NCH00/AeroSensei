// src/app/api/publicAxiosInstance.ts
import axios from "axios";

const publicAxiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081"}/api`,
  timeout: 30000, 
  headers: {
    "Content-Type": "application/json",
  },
  // Notice: We do NOT include withCredentials here because public 
  // endpoints shouldn't require or send session cookies.
});

export default publicAxiosInstance;