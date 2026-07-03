// src/app/api/mlAxiosInstance.ts
import axios from "axios";

const mlAxiosInstance = axios.create({
  // Point to the ML environment variable, with a fallback just in case
  baseURL: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
  
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