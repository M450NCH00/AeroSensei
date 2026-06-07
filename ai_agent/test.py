from ollama import chat

response = chat(
    model='qwen3:0.6b',
    messages=[
        {
            'role':'user',
            'content':'What is the capital of France?'
        }
    ]
)

print(response['message']['content'])