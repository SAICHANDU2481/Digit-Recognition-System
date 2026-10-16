import os
import sys
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load environment variables from backend/.env
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path)

from predict import DigitClassifier, DEFAULT_MODEL_PATH

app = Flask(__name__)

# Configure CORS
# In production, set ALLOWED_ORIGINS to your frontend domain(s), e.g. "https://your-frontend.vercel.app,http://localhost:5173"
# If unset or set to "*", all origins are permitted.
raw_origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
if raw_origins == "*" or not raw_origins:
    cors_origins = "*"
else:
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

CORS(
    app,
    resources={r"/api/*": {"origins": cors_origins}},
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"]
)

START_TIME = time.time()
METRICS_PATH = os.path.join(BASE_DIR, "outputs", "metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(BASE_DIR, "outputs", "confusion_matrix.png")

# Initialize and cache model at startup
classifier = DigitClassifier.get_instance(DEFAULT_MODEL_PATH)


# ==========================================
# 1. Health Endpoint
# ==========================================
@app.route("/api/health", methods=["GET"])
def health_check():
    """Returns backend server health, model status, and uptime."""
    uptime_seconds = round(time.time() - START_TIME, 2)
    model_loaded = classifier.is_loaded()
    model_file_exists = os.path.exists(DEFAULT_MODEL_PATH)
    metrics_file_exists = os.path.exists(METRICS_PATH)
    gemini_key_set = bool(os.getenv("GEMINI_API_KEY", "").strip())

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": uptime_seconds,
        "model_loaded": model_loaded,
        "model_file_exists": model_file_exists,
        "metrics_file_exists": metrics_file_exists,
        "gemini_configured": gemini_key_set,
        "version": "1.0.0"
    }), 200


# ==========================================
# 2. Canvas Predict Endpoint
# ==========================================
@app.route("/api/predict", methods=["POST"])
def predict_canvas():
    """
    Accepts base64 image data from the drawing canvas.
    Returns predicted digit, confidence, probabilities, and processed 28x28 image.
    """
    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'image' field in JSON request body."
        }), 400

    image_data = data["image"]
    result = classifier.predict_from_base64(image_data)

    status_code = 200 if result["success"] or result.get("is_blank") else 400
    return jsonify(result), status_code


# ==========================================
# 3. Webcam Predict Endpoint
# ==========================================
@app.route("/api/predict/webcam", methods=["POST"])
def predict_webcam():
    """
    Accepts base64 image frame from the webcam capture.
    Performs preprocessing, isolation of the digit, and inference.
    """
    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'image' field in JSON request body."
        }), 400

    image_data = data["image"]
    result = classifier.predict_from_base64(image_data, is_webcam=True)

    status_code = 200 if result["success"] or result.get("is_blank") else 400
    return jsonify(result), status_code


# ==========================================
# 4. Model Info & Metrics Endpoint
# ==========================================
@app.route("/api/model-info", methods=["GET"])
def get_model_info():
    """Returns actual CNN model metrics, parameters, test accuracy, and confusion matrix."""
    if not os.path.exists(METRICS_PATH):
        return jsonify({
            "success": False,
            "error": "Model metrics file not found. Model might still be training or needs to be trained.",
            "metrics": None
        }), 404

    try:
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)

        return jsonify({
            "success": True,
            "metrics": metrics_data
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to load metrics: {str(e)}"
        }), 500


@app.route("/api/confusion-matrix-image", methods=["GET"])
def get_confusion_matrix_image():
    """Serves the generated confusion matrix heatmap image."""
    if not os.path.exists(CONFUSION_MATRIX_PATH):
        return jsonify({"error": "Confusion matrix image not found."}), 404
    return send_file(CONFUSION_MATRIX_PATH, mimetype="image/png")


# ==========================================
# 5. Gemini AI Assistant Endpoint
# ==========================================
@app.route("/api/assistant", methods=["POST"])
def gemini_assistant():
    """
    Gemini AI Assistant for explaining predictions, providing handwriting improvement tips,
    and answering architecture / computer vision questions.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    data = request.get_json(silent=True) or {}
    user_prompt = data.get("prompt", "").strip()
    prediction_context = data.get("context", {})

    if not user_prompt:
        return jsonify({
            "success": False,
            "error": "Please provide a 'prompt' in the request."
        }), 400

    if not api_key:
        return jsonify({
            "success": False,
            "configured": False,
            "message": "Gemini API key is not configured in backend/.env. To enable the AI Assistant, add your GEMINI_API_KEY from Google AI Studio (https://aistudio.google.com/)."
        }), 200

    try:
        # Use official Google Gen AI SDK
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Build context-aware prompt
        system_instruction = (
            "You are an expert Machine Learning Engineer and Handwriting Recognition Specialist assisting users "
            "with a Convolutional Neural Network (CNN) trained on the MNIST handwritten digit dataset.\n"
            "Guidelines:\n"
            "1. Explain how the CNN processes images (filtering, convolutions, feature maps, edge detection, pooling, classification).\n"
            "2. When discussing predictions, explain based on observable visual characteristics and the model's output probabilities. "
            "Clearly clarify that model probabilities reflect statistical correlation from training and do not prove the exact internal reasoning chain.\n"
            "3. Offer actionable, practical tips to improve handwriting legibility for digits (e.g. distinguishing 1 vs 7, 0 vs 6, 3 vs 8, 4 vs 9).\n"
            "4. Keep explanations clear, encouraging, educational, and well-structured using markdown."
        )

        context_str = ""
        if prediction_context:
            digit = prediction_context.get("predicted_digit")
            confidence = prediction_context.get("confidence")
            probs = prediction_context.get("probabilities", {})
            sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:3]
            top_3_str = ", ".join([f"Digit {k}: {v*100:.1f}%" for k, v in sorted_probs])
            context_str = (
                f"\n[Current Prediction Context]:\n"
                f"- Predicted Digit: {digit}\n"
                f"- Primary Confidence: {confidence*100 if confidence is not None else 0:.1f}%\n"
                f"- Top Candidate Probabilities: {top_3_str}\n"
            )

        full_prompt = f"{context_str}\nUser Query: {user_prompt}"

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )

        reply_text = response.text if response and hasattr(response, "text") else "No response generated."

        return jsonify({
            "success": True,
            "configured": True,
            "reply": reply_text
        }), 200

    except Exception as e:
        error_msg = str(e)
        return jsonify({
            "success": False,
            "configured": True,
            "error": f"Gemini API request failed: {error_msg}"
        }), 500


# ==========================================
# 6. Educational Resources (Web Scraping)
# ==========================================
_RESOURCES_CACHE = None
_CACHE_TIMESTAMP = 0

@app.route("/api/resources", methods=["GET"])
def get_educational_resources():
    """
    Curated public educational resources regarding MNIST, CNN architectures,
    and handwritten digit recognition. Demonstrates web scraping with requests + BeautifulSoup
    with caching, error handling, and rate-limit compliance.
    """
    global _RESOURCES_CACHE, _CACHE_TIMESTAMP

    # Return cached resources if fetched within the last hour
    if _RESOURCES_CACHE and (time.time() - _CACHE_TIMESTAMP < 3600):
        return jsonify({"success": True, "cached": True, "resources": _RESOURCES_CACHE})

    resources = [
        {
            "title": "Gradient-Based Learning Applied to Document Recognition (LeNet-5)",
            "author": "Yann LeCun, Léon Bottou, Yoshua Bengio, Patrick Haffner",
            "url": "http://yann.lecun.com/exdb/publis/pdf/lecun-01a.pdf",
            "description": "The seminal 1998 paper introducing convolutional neural networks and the MNIST benchmark dataset.",
            "category": "Foundational Research"
        },
        {
            "title": "Keras Official Guide: The MNIST Classification Task",
            "author": "Keras Team",
            "url": "https://keras.io/examples/vision/mnist_convnet/",
            "description": "Standard simple ConvNet for MNIST reaching >99% test accuracy with Modern Keras 3.",
            "category": "Documentation & Code"
        },
        {
            "title": "Papers with Code: MNIST Benchmark Leaderboard",
            "author": "Papers with Code",
            "url": "https://paperswithcode.com/sota/image-classification-on-mnist",
            "description": "Comprehensive leaderboard tracking state-of-the-art architectures and evaluation on MNIST.",
            "category": "Benchmarks"
        },
        {
            "title": "3Blue1Brown: Neural Networks & Deep Learning Visual Series",
            "author": "Grant Sanderson (3Blue1Brown)",
            "url": "https://www.3blue1brown.com/topics/neural-networks",
            "description": "Intuitive visual explanations of multilayer perceptrons, gradient descent, and digit recognition.",
            "category": "Video Tutorials"
        }
    ]

    # Dynamically verify / supplement using requests and BeautifulSoup (with short timeout)
    try:
        import requests
        from bs4 import BeautifulSoup

        # Fetch page title from Wikipedia's MNIST entry respectfully
        headers = {"User-Agent": "HandwrittenDigitRecognitionSystem/1.0 (Educational research project)"}
        resp = requests.get("https://en.wikipedia.org/wiki/MNIST_database", headers=headers, timeout=4)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            wiki_heading = soup.find("h1", id="firstHeading")
            first_p = soup.find("p", class_=lambda c: c != "mw-empty-elt" if c else True)
            if wiki_heading and first_p:
                summary_text = first_p.get_text()[:250].strip() + "..."
                resources.insert(0, {
                    "title": f"Wikipedia: {wiki_heading.get_text().strip()}",
                    "author": "Wikipedia Contributors",
                    "url": "https://en.wikipedia.org/wiki/MNIST_database",
                    "description": summary_text,
                    "category": "Overview Article"
                })
    except Exception as scrape_err:
        # Fallback cleanly to curated resources without failing endpoint
        print(f"[Resources] Optional live scrape notice: {scrape_err}")

    _RESOURCES_CACHE = resources
    _CACHE_TIMESTAMP = time.time()

    return jsonify({
        "success": True,
        "cached": False,
        "resources": resources
    }), 200


# ==========================================
# Error Handlers
# ==========================================
@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "error": "Endpoint not found."}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({"success": False, "error": "Internal server error occurred."}), 500


if __name__ == "__main__":
    # Support standard cloud PORT (Render, Heroku, Cloud Run) or local FLASK_PORT
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", 5000)))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    debug = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1")
    print(f"[Backend] Starting Flask server on http://{host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)
