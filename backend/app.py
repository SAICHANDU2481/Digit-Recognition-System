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
# 4. Multi-Digit Predict Endpoint
# ==========================================
@app.route("/api/predict/multiple", methods=["POST"])
def predict_multiple():
    """
    Accepts base64 image data containing one or more handwritten digits.
    Segments candidate digit regions left-to-right, runs inference on each,
    and returns bounding boxes, per-digit confidence, warnings, and recognized text string.
    """
    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "status": "invalid_input",
            "error": "Missing 'image' field in JSON request body.",
            "recognized_text": "",
            "detected_digit_count": 0,
            "per_digit_predictions": []
        }), 400

    image_data = data["image"]
    options = data.get("options", {})
    confidence_threshold = float(options.get("confidence_threshold", 0.75))
    min_margin = float(options.get("min_margin", 0.15))
    is_webcam = bool(data.get("is_webcam", False))

    result = classifier.predict_multiple_from_base64(
        image_data,
        is_webcam=is_webcam,
        confidence_threshold=confidence_threshold,
        min_margin=min_margin
    )

    status_code = 200 if result["success"] or result.get("status") in ("blank_input", "segmentation_failure") else 400
    return jsonify(result), status_code


# ==========================================
# 5. Interactive Practice Mode Evaluation
# ==========================================
@app.route("/api/practice/evaluate", methods=["POST"])
def practice_evaluate():
    """
    Evaluates a user's practice drawing attempt against a target digit.
    Applies confidence policy:
    - correct: predicted == target AND status == 'accepted_prediction'
    - incorrect: predicted != target AND status == 'accepted_prediction'
    - uncertain: status == 'uncertain_prediction'
    - rejected: status == 'rejected_prediction'
    - blank: is_blank == True
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "Request body must be valid JSON."
        }), 400

    if "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'image' field in JSON request body."
        }), 400

    target = data.get("target_digit")
    if target is None:
        return jsonify({
            "success": False,
            "error": "Missing 'target_digit' field in JSON request body."
        }), 400

    try:
        target = int(target)
        if not (0 <= target <= 9):
            return jsonify({
                "success": False,
                "error": "target_digit must be an integer between 0 and 9."
            }), 400
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "target_digit must be an integer between 0 and 9."
        }), 400

    image_data = data["image"]
    result = classifier.predict_from_base64(image_data)

    if not result.get("success") or result.get("is_blank"):
        return jsonify({
            "success": False,
            "is_blank": True,
            "outcome": "blank",
            "message": "Blank or empty drawing detected. Please draw a digit before submitting.",
            "target_digit": target,
            "predicted_digit": None,
            "status": "blank_input"
        }), 200

    pred = result["predicted_digit"]
    status = result["status"]
    conf = result["confidence"]
    margin = result.get("margin", 0.0)

    is_correct = (pred == target and status == "accepted_prediction")
    if is_correct:
        outcome = "correct"
        feedback = f"Excellent! The CNN recognized digit {pred} with {conf*100:.1f}% confidence."
    elif status == "uncertain_prediction":
        outcome = "uncertain"
        feedback = f"Borderline / Uncertain: Model predicted digit {pred} ({conf*100:.1f}% confidence), but confidence did not meet the 75% threshold."
    elif status == "rejected_prediction":
        outcome = "rejected"
        feedback = f"Low Confidence / Rejected: Model confidence was low ({conf*100:.1f}%). Try drawing with cleaner, more decisive strokes."
    else:
        outcome = "incorrect"
        feedback = f"Misclassified: Target was digit {target}, but model classified this as digit {pred} ({conf*100:.1f}% confidence)."

    return jsonify({
        "success": True,
        "is_blank": False,
        "outcome": outcome,
        "is_correct": is_correct,
        "target_digit": target,
        "predicted_digit": pred,
        "confidence": conf,
        "margin": margin,
        "status": status,
        "top_candidates": result.get("top_candidates", []),
        "probabilities": result.get("probabilities", {}),
        "processed_image": result.get("processed_image"),
        "feedback": feedback
    }), 200


# ==========================================
# 6. Explainability (Grad-CAM) Endpoint
# ==========================================
@app.route("/api/explain", methods=["POST"])
def explain_prediction():
    """
    Computes Grad-CAM explainability heatmap for a handwritten digit.
    Highlights regions in the convolutional feature map influencing the CNN's score.
    Returns original processed crop, heatmap, and transparent overlay as base64 images.
    """
    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'image' field in JSON request body.",
            "prediction": None,
            "confidence": 0.0,
            "layer": None,
            "original_image": None,
            "heatmap": None,
            "overlay": None,
            "explanation_method": "Grad-CAM"
        }), 400

    image_data = data["image"]
    target_digit = data.get("target_digit")
    if target_digit is not None:
        try:
            target_digit = int(target_digit)
            if target_digit < 0 or target_digit > 9:
                return jsonify({
                    "success": False,
                    "error": "target_digit must be an integer between 0 and 9.",
                    "prediction": None,
                    "confidence": 0.0,
                    "layer": None,
                    "original_image": None,
                    "heatmap": None,
                    "overlay": None,
                    "explanation_method": "Grad-CAM"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "target_digit must be a valid integer between 0 and 9.",
                "prediction": None,
                "confidence": 0.0,
                "layer": None,
                "original_image": None,
                "heatmap": None,
                "overlay": None,
                "explanation_method": "Grad-CAM"
            }), 400

    is_webcam = bool(data.get("is_webcam", False))

    result = classifier.explain_from_base64(
        image_data,
        target_digit=target_digit,
        is_webcam=is_webcam
    )

    if result.get("is_blank"):
        return jsonify(result), 200
    elif not result["success"]:
        return jsonify(result), 400

    return jsonify(result), 200



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
# 5. Gemini AI Assistant & Handwriting Tutor
# ==========================================
@app.route("/api/assistant", methods=["POST"])
def gemini_assistant():
    """
    Intelligent Handwriting Tutor & Gemini AI Assistant.
    Provides pedagogical stroke advice, explains digit confusions (1 vs 7, 3 vs 8, 4 vs 9),
    integrates Grad-CAM and CNN confidence context, with resilient offline domain fallback.
    """
    from tutor import validate_tutor_request, call_gemini_tutor

    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "Request body must be valid JSON."
        }), 400

    # Validate and sanitize input payload
    is_valid, err_msg, cleaned = validate_tutor_request(data)
    if not is_valid:
        return jsonify({
            "success": False,
            "error": err_msg or "Invalid request parameters."
        }), 400

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    # Call Gemini tutor with graceful fallback
    tutor_res = call_gemini_tutor(
        api_key=api_key,
        prompt=cleaned["prompt"],
        predicted_digit=cleaned["predicted_digit"],
        comparison_digit=cleaned["comparison_digit"],
        confidence=cleaned["confidence"],
        probabilities=cleaned["probabilities"],
        layer=cleaned["layer"]
    )

    return jsonify(tutor_res), 200


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
