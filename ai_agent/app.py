from flask import Flask, request, jsonify
from ollama import chat

app = Flask(__name__)

@app.route('/ask', methods=['POST'])
def ask():

    data = request.json

    user_question = data["question"]

    response = chat(
        model='qwen3:0.6b',
        messages=[
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