# AI Agent Backend 

Current architecture:

```text
User
  ↓
Frontend 
  ↓ HTTP Request
Flask AI Agent (This Project)
  ↓
Database 
  ↓
Ollama LLM
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
Activate venv:

### Windows

```bash
venv\Scripts\activate
```

### Linux/macOS

```bash
source venv/bin/activate
```

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
Running on http://0.0.0.0:5000
```

Server endpoint:

```text
http://<IP_ADDRESS>:5000
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
fetch("http://<AI_AGENT_IP>:5000/ask", {
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

# Database Integration Notes
