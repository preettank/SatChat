from flask import Flask, request, jsonify
from twilio.twiml.messaging_response import MessagingResponse
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Set your Gemini API Key
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@app.route("/", methods=["GET"])
def home():
    return "SatChat is live 🚀", 200

@app.route("/sms", methods=["POST"])
def sms_reply():
    data = request.get_json()

    print(data)
    incoming_msg = data.get("text", "")
    endpoint = data.get("endpoint", "")

    print(f"Incoming message: {incoming_msg}")

    if not incoming_msg or not endpoint:
        return jsonify({ "success": False, "error": "Missing text or endpoint" }), 400

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=incoming_msg
        )

        return jsonify({
            "success": True,
            "reply": response.text, 
            "to": endpoint
        })

    except Exception as e:
        return jsonify({ "success": False, "error": str(e) }), 500
    
@app.route("/test_gemini", methods=["GET"])
def test_gemini():
    prompt = request.args.get("q", "Say something cool about satellites")
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return {"response": response.text}, 200
    except Exception as e:
        return {"error": str(e)}, 500
    
if __name__ == "__main__":
    app.run(port=5000, debug=True)
