// src/app/api/mlAxiosInstance.ts
import axios from "axios";

/*
## To Run Forecast Model with Uvicorn ##

python -m venv venv   
venv\Scripts\activate   
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
*/

const mlAxiosInstance = axios.create({
  // Point to the ML environment variable, with a fallback just in case
  baseURL: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
  
  // ML models can sometimes take a few seconds to process, 
  // so a slightly longer timeout is a good safety measure!
  timeout: 30000, 
  
  headers: {
    "Content-Type": "application/json",
  },
});

// You can add interceptors here later if your Python API ever requires its own API keys!

export default mlAxiosInstance;