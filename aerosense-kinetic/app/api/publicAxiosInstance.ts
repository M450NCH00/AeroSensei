// src/app/api/publicAxiosInstance.ts
import axios from "axios";

const publicAxiosInstance = axios.create({
  // Same-origin relative base ("/api") so the browser calls whichever host
  // served the page, through nginx — no hardcoded host, no cross-origin/CORS.
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || ""}/api`,
  timeout: 30000, 
  headers: {
    "Content-Type": "application/json",
  },
  // Notice: We do NOT include withCredentials here because public 
  // endpoints shouldn't require or send session cookies.
});

export default publicAxiosInstance;