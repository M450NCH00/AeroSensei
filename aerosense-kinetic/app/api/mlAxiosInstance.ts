// src/app/api/mlAxiosInstance.ts
import axios from "axios";

const mlAxiosInstance = axios.create({
  // Default to the same-origin relative "/ml" path (proxied by nginx to the
  // forecast-model container). Override with NEXT_PUBLIC_ML_API_URL to point
  // at a different origin.
  baseURL: process.env.NEXT_PUBLIC_ML_API_URL || "/ml",
  
  // The /predict pipeline runs several sequential InfluxDB + Postgres queries
  // and an Open-Meteo weather call before the (fast) inference, so a cold
  // request can take well over 15s. Give it room so the browser doesn't abort
  // mid-flight (which shows up as an nginx 499 / "AI model failed to respond").
  timeout: 90000,
  
  headers: {
    "Content-Type": "application/json",
  },
});

// You can add interceptors here later if your Python API ever requires its own API keys!

export default mlAxiosInstance;