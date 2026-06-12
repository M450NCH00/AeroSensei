# AI Agent Backend

Current architecture:

```text
User
  ↓
Frontend
  ↓ HTTP Request
Flask AI Agent (This Project)
  ↓
Ollama LLM (qwen3:0.6b)
  ↓
Response
  ↓
Frontend
```

---

# Installing Ollama

## Windows

Download from:

https://ollama.com/download

Install normally.

Verify installation:

```bash
ollama --version
```

---

## Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify:

```bash
ollama --version
```

---

## macOS

Download from:

https://ollama.com/download

Verify:

```bash
ollama --version
```

---

# Pulling a Model

```bash
ollama pull qwen3:0.6b
```

or

```bash
ollama pull qwen3:1.7b
```

# Starting Ollama

Start Ollama server:

```bash
ollama serve
```

Default endpoint:

```text
http://localhost:11434
```

Leave this terminal running.

---

# Setting Up Python Environment

Install dependencies:

```bash
pip install flask ollama
```

---

# Testing Ollama Connection

```bash
python test.py
```

# Running the Flask Server

Start:

```bash
python app.py
```

Expected output:

```text
Running on http://0.0.0.0:5001
```

Server endpoint:

```text
http://<IP_ADDRESS>:5001
```

---

# API Specification

## Ask Question

Endpoint:

```http
POST /ask
```

Request:

```json
{
  "question": "What is AI?"
}
```

Response:

```json
{
  "answer": "AI stands for Artificial Intelligence..."
}
```

---

# Frontend Integration Notes

CALL:

```javascript
fetch("http://<AI_AGENT_IP>:5001/ask", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        question: "<QUESTION>"
    })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

# Testing with curl

```bash
curl -X POST http://localhost:5001/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is AI?"}'
```
