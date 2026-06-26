// src/app/api/mlAxiosInstance.ts
import axios from "axios";

const mlAxiosInstance = axios.create({
  // Point to the ML environment variable, with a fallback just in case
  baseURL: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
  
  // ML models can sometimes take a few seconds to process, 
  // so a slightly longer timeout is a good safety measure!
  timeout: 15000, 
  
  headers: {
    "Content-Type": "application/json",
  },
});

// You can add interceptors here later if your Python API ever requires its own API keys!

export default mlAxiosInstance;