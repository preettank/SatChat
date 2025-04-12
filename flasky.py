from flask import Flask, request
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
    # Get message from Twilio webhook
    user_msg = request.form.get("Body")
    sender_number = request.form.get("From")

    print(f"[{sender_number}] says: {user_msg}")

    # Call Gemini API
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_msg
        )
        reply_text = response.text
    except Exception as e:
        reply_text = "Oops! Something went wrong. Try again later."
        print(f"Gemini API error: {e}")
    
    # Create Twilio response
    twilio_resp = MessagingResponse()
    twilio_resp.message(reply_text)
    return str(twilio_resp), 200

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
