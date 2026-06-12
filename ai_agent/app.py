from flask import Flask, request, jsonify
from flask_cors import CORS
from ollama import chat
from knowledge_base import SYSTEM_PROMPT

app = Flask(__name__)
CORS(app)

@app.route('/ask', methods=['POST'])
def ask():

    data = request.json

    user_question = data["question"]

    response = chat(
        model='qwen3:0.6b',
        messages=[
            {
                'role': 'system',
                'content': SYSTEM_PROMPT
            },
            {
                'role': 'user',
                'content': user_question
            }
        ]
    )

    return jsonify({
        "answer": response['message']['content']
    })

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5001
    )