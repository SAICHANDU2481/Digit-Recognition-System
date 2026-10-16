import os
import sys
import unittest
import base64
import numpy as np
import cv2

# Set path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from predict import DigitClassifier, preprocess_digit_image, decode_base64_image, encode_image_to_base64, DEFAULT_MODEL_PATH
from app import app


def create_synthetic_digit_base64(digit=7):
    """Generates a synthetic white-on-black image of a digit encoded as base64 PNG."""
    img = np.zeros((280, 280), dtype=np.uint8)
    # Draw a clean digit with cv2.putText
    cv2.putText(img, str(digit), (70, 210), cv2.FONT_HERSHEY_SIMPLEX, 6.0, 255, 18, cv2.LINE_AA)
    _, buffer = cv2.imencode(".png", img)
    return "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")


def create_blank_canvas_base64():
    """Generates an empty black canvas."""
    img = np.zeros((280, 280), dtype=np.uint8)
    _, buffer = cv2.imencode(".png", img)
    return "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")


class DigitRecognitionSystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n=== Running Backend & ML Pipeline Test Suite ===")
        cls.classifier = DigitClassifier.get_instance(DEFAULT_MODEL_PATH)
        cls.client = app.test_client()

    def test_01_model_loaded(self):
        """Test that the trained CNN model is loaded successfully."""
        self.assertTrue(self.classifier.is_loaded(), "CNN model failed to load.")
        self.assertIsNotNone(self.classifier.model, "Classifier model attribute is None.")

    def test_02_blank_image_detection(self):
        """Test that a blank canvas is detected as blank without crashing."""
        blank_b64 = create_blank_canvas_base64()
        result = self.classifier.predict_from_base64(blank_b64)
        self.assertFalse(result["success"], "Blank canvas should return success=False.")
        self.assertTrue(result["is_blank"], "Blank canvas must set is_blank=True.")
        self.assertIn("error", result)

    def test_03_digit_prediction(self):
        """Test inference on a synthetic drawn digit."""
        digit_b64 = create_synthetic_digit_base64(7)
        result = self.classifier.predict_from_base64(digit_b64)
        self.assertTrue(result["success"], f"Prediction failed: {result.get('error')}")
        self.assertFalse(result["is_blank"])
        self.assertIn("predicted_digit", result)
        self.assertIn("confidence", result)
        self.assertIn("probabilities", result)
        self.assertEqual(len(result["probabilities"]), 10, "Should have probabilities for all 10 digits.")
        self.assertTrue(0.0 <= result["confidence"] <= 1.0)
        self.assertIsNotNone(result["processed_image"], "Must return 28x28 processed preview.")

    def test_04_health_endpoint(self):
        """Test GET /api/health."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["model_loaded"])
        self.assertTrue(data["model_file_exists"])
        self.assertTrue(data["metrics_file_exists"])

    def test_05_model_info_endpoint(self):
        """Test GET /api/model-info."""
        res = self.client.get("/api/model-info")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        metrics = data["metrics"]
        self.assertGreaterEqual(metrics["test_accuracy"], 0.98, "Test accuracy should exceed 98%.")
        self.assertIn("confusion_matrix", metrics)
        self.assertIn("per_class_metrics", metrics)

    def test_06_predict_canvas_endpoint(self):
        """Test POST /api/predict with canvas image."""
        digit_b64 = create_synthetic_digit_base64(3)
        res = self.client.post("/api/predict", json={"image": digit_b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIsInstance(data["predicted_digit"], int)

    def test_07_predict_webcam_endpoint(self):
        """Test POST /api/predict/webcam with camera frame."""
        digit_b64 = create_synthetic_digit_base64(5)
        res = self.client.post("/api/predict/webcam", json={"image": digit_b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])

    def test_08_resources_endpoint(self):
        """Test GET /api/resources (educational scraping)."""
        res = self.client.get("/api/resources")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIsInstance(data["resources"], list)
        self.assertGreater(len(data["resources"]), 0)

    def test_09_gemini_assistant_endpoint_graceful_handling(self):
        """Test POST /api/assistant handling when key is unconfigured or configured."""
        res = self.client.post("/api/assistant", json={"prompt": "How does the CNN model work?"})
        # Should return 200 with structured status
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("configured", data)


if __name__ == "__main__":
    unittest.main()
