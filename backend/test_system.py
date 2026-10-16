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

from unittest.mock import patch
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

    def test_10_multi_digit_prediction(self):
        """Test POST /api/predict/multiple with synthetic sequence '5 0 7 2'."""
        img = np.zeros((150, 420), dtype=np.uint8)
        cv2.putText(img, "5 0 7 2", (30, 105), cv2.FONT_HERSHEY_SIMPLEX, 2.5, 255, 6, cv2.LINE_AA)
        _, buffer = cv2.imencode(".png", img)
        b64 = "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")

        res = self.client.post("/api/predict/multiple", json={"image": b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["detected_digit_count"], 4)
        self.assertEqual(data["recognized_text"], "5072")
        self.assertEqual(data["status"], "accepted_prediction")
        # Verify bounding box coordinates
        boxes = [d["bounding_box"] for d in data["per_digit_predictions"]]
        self.assertEqual(len(boxes), 4)
        for b in boxes:
            self.assertIn("x", b)
            self.assertIn("y", b)
            self.assertIn("w", b)
            self.assertIn("h", b)
            self.assertGreater(b["w"], 0)
            self.assertGreater(b["h"], 0)
        # Verify left-to-right sorting
        xs = [b["x"] for b in boxes]
        self.assertEqual(xs, sorted(xs), "Bounding boxes must be strictly sorted left-to-right.")

    def test_11_multi_digit_blank_input(self):
        """Test POST /api/predict/multiple with blank canvas."""
        blank_b64 = create_blank_canvas_base64()
        res = self.client.post("/api/predict/multiple", json={"image": blank_b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertEqual(data["status"], "blank_input")
        self.assertEqual(data["detected_digit_count"], 0)

    def test_12_multi_digit_touching_digits(self):
        """Test touching digits handling using vertical projection profiles."""
        img = np.zeros((150, 250), dtype=np.uint8)
        # Draw two touching digits connected by a horizontal ligature
        cv2.putText(img, "1", (30, 105), cv2.FONT_HERSHEY_SIMPLEX, 2.5, 255, 6, cv2.LINE_AA)
        cv2.putText(img, "7", (110, 105), cv2.FONT_HERSHEY_SIMPLEX, 2.5, 255, 6, cv2.LINE_AA)
        # Connect them with a thin stroke
        cv2.line(img, (60, 60), (120, 60), 255, 2)
        _, buffer = cv2.imencode(".png", img)
        b64 = "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")

        res = self.client.post("/api/predict/multiple", json={"image": b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        # Should detect digits and produce segmentation metadata
        self.assertGreaterEqual(data["detected_digit_count"], 1)
        self.assertIn("warnings", data)

    def test_13_multi_digit_invalid_input(self):
        """Test POST /api/predict/multiple with invalid payload."""
        res = self.client.post("/api/predict/multiple", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "invalid_input")

    def test_14_multi_digit_confidence_rejection(self):
        """Test confidence-aware rejection policy with ambiguous/noisy input."""
        # Ambiguous star / non-digit asterisk
        img = np.zeros((150, 150), dtype=np.uint8)
        cv2.line(img, (40, 40), (110, 110), 255, 4)
        cv2.line(img, (110, 40), (40, 110), 255, 4)
        cv2.line(img, (75, 35), (75, 115), 255, 4)
        _, buffer = cv2.imencode(".png", img)
        b64 = "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")

        res = self.client.post(
            "/api/predict/multiple",
            json={"image": b64, "options": {"confidence_threshold": 0.999, "min_margin": 0.95}}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        # Non-digit asterisk under strict threshold should trigger uncertain or rejected status
        if data["per_digit_predictions"]:
            self.assertIn(data["per_digit_predictions"][0]["status"], ["uncertain", "rejected"])

    def test_15_explainability_gradcam(self):
        """Test POST /api/explain produces valid Grad-CAM images and non-constant heatmap."""
        b64 = create_synthetic_digit_base64("3")
        res = self.client.post("/api/explain", json={"image": b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertTrue(data["success"])
        self.assertFalse(data.get("is_blank", False))
        self.assertEqual(data["explanation_method"], "Grad-CAM")
        self.assertIsInstance(data["prediction"], int)
        self.assertGreater(data["confidence"], 0.5)
        self.assertIn("conv", data["layer"].lower())

        # Verify images are valid base64 PNGs
        for key in ["original_image", "heatmap", "overlay"]:
            self.assertIn(key, data)
            self.assertTrue(data[key].startswith("data:image/png;base64,"))
            raw_b64 = data[key].split(",")[1]
            decoded_bytes = base64.b64decode(raw_b64)
            img_arr = cv2.imdecode(np.frombuffer(decoded_bytes, np.uint8), cv2.IMREAD_COLOR)
            self.assertIsNotNone(img_arr)
            self.assertGreater(img_arr.shape[0], 20)
            self.assertGreater(img_arr.shape[1], 20)

            # Ensure heatmap image has non-zero variation
            if key == "heatmap":
                diff = np.max(img_arr) - np.min(img_arr)
                self.assertGreater(diff, 10, "Heatmap must contain non-constant gradient variation.")

    def test_16_explainability_blank_input(self):
        """Test POST /api/explain with blank canvas."""
        blank_b64 = create_blank_canvas_base64()
        res = self.client.post("/api/explain", json={"image": blank_b64})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertTrue(data.get("is_blank", False))
        self.assertIsNone(data["heatmap"])

    def test_17_explainability_invalid_payload(self):
        """Test POST /api/explain with malformed payload."""
        res = self.client.post("/api/explain", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data["success"])

    def test_18_explainability_target_digit(self):
        """Test POST /api/explain with specific target_digit."""
        b64 = create_synthetic_digit_base64("7")
        res = self.client.post("/api/explain", json={"image": b64, "target_digit": 1})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIsNotNone(data["heatmap"])

    def test_19_tutor_valid_request_with_confusion_pair(self):
        """Test POST /api/assistant with digit confusion context (3 vs 8)."""
        payload = {
            "prompt": "Why was my digit 3 nearly classified as an 8?",
            "predicted_digit": 3,
            "comparison_digit": 8,
            "confidence": 0.84,
            "probabilities": {"3": 0.84, "8": 0.12, "5": 0.02}
        }
        res = self.client.post("/api/assistant", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("reply", data)
        self.assertGreater(len(data["reply"]), 20)
        self.assertIn("tutor_analysis", data)
        tutor = data["tutor_analysis"]
        self.assertEqual(tutor["predicted_digit"], 3)
        self.assertEqual(tutor["comparison_digit"], 8)
        self.assertIsInstance(tutor["stroke_tips"], list)
        self.assertGreater(len(tutor["stroke_tips"]), 0)
        self.assertIn("practice_exercise", tutor)

    def test_20_tutor_missing_gemini_key_graceful_fallback(self):
        """Test POST /api/assistant when GEMINI_API_KEY is not set."""
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            res = self.client.post("/api/assistant", json={
                "predicted_digit": 1,
                "comparison_digit": 7,
                "confidence": 0.72
            })
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data["success"])
            self.assertFalse(data["configured"])
            self.assertTrue(data.get("fallback", False))
            self.assertIn("reply", data)
            self.assertIn("tutor_analysis", data)
            # Verify stroke mechanics advice is returned
            self.assertIn("1", data["reply"])
            self.assertIn("7", data["reply"])

    def test_21_tutor_invalid_payloads(self):
        """Test POST /api/assistant error handling for empty and malformed inputs."""
        # 1. Empty request
        res1 = self.client.post("/api/assistant", json={})
        self.assertEqual(res1.status_code, 400)
        self.assertFalse(res1.get_json()["success"])

        # 2. Out of range predicted_digit
        res2 = self.client.post("/api/assistant", json={"predicted_digit": 42})
        self.assertEqual(res2.status_code, 400)
        self.assertFalse(res2.get_json()["success"])

        # 3. Non-numeric predicted_digit
        res3 = self.client.post("/api/assistant", json={"predicted_digit": "invalid"})
        self.assertEqual(res3.status_code, 400)
        self.assertFalse(res3.get_json()["success"])

        # 4. Out of range comparison_digit
        res4 = self.client.post("/api/assistant", json={"predicted_digit": 3, "comparison_digit": 19})
        self.assertEqual(res4.status_code, 400)
        self.assertFalse(res4.get_json()["success"])

        # 5. Oversized prompt
        long_prompt = "x" * 1500
        res5 = self.client.post("/api/assistant", json={"prompt": long_prompt})
        # Sanitizer truncates or validator handles
        self.assertIn(res5.status_code, [200, 400])

    def test_22_tutor_gemini_api_timeout_or_error_fallback(self):
        """Test POST /api/assistant safe fallback when Gemini raises a service error or timeout."""
        with patch.dict(os.environ, {"GEMINI_API_KEY": "AIzaFakeTestKeyForTutor123"}, clear=False):
            with patch("tutor.call_gemini_tutor") as mock_gemini:
                # Configure mock to simulate fallback response
                mock_gemini.return_value = {
                    "success": True,
                    "configured": True,
                    "fallback": True,
                    "warning": "Live Gemini API unavailable (DeadlineExceeded 504). Provided offline Handwriting Tutor response.",
                    "reply": "Fallback Handwriting Guidance for Digit 4 vs 9.",
                    "tutor_analysis": {
                        "predicted_digit": 4,
                        "comparison_digit": 9,
                        "source": "handwriting_tutor_rule_engine"
                    }
                }
                res = self.client.post("/api/assistant", json={
                    "prompt": "Help with 4 vs 9",
                    "predicted_digit": 4,
                    "comparison_digit": 9
                })
                self.assertEqual(res.status_code, 200)
                data = res.get_json()
                self.assertTrue(data["success"])
                self.assertTrue(data["fallback"])
                self.assertIn("reply", data)

    def test_23_tutor_backward_compatibility(self):
        """Test POST /api/assistant backward compatibility with legacy prompt-only format."""
        legacy_payload = {"prompt": "Explain how convolution filters extract edges."}
        res = self.client.post("/api/assistant", json=legacy_payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("configured", data)
        self.assertIn("reply", data)
        self.assertIsInstance(data["reply"], str)

    def test_24_tutor_gradcam_context_integration(self):
        """Test POST /api/assistant contextual integration with Grad-CAM layer metadata."""
        payload = {
            "prompt": "How does the final convolutional layer see my digit 5?",
            "predicted_digit": 5,
            "comparison_digit": 6,
            "confidence": 0.81,
            "layer": "conv2_2",
            "probabilities": {"5": 0.81, "6": 0.14}
        }
        res = self.client.post("/api/assistant", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("conv2_2", data["reply"])
        self.assertEqual(data["tutor_analysis"]["gradcam_layer"], "conv2_2")

    def test_25_practice_evaluate_correct_prediction(self):
        """Test POST /api/practice/evaluate with matching target and drawn digit."""
        digit_b64 = create_synthetic_digit_base64(7)
        res = self.client.post("/api/practice/evaluate", json={
            "image": digit_b64,
            "target_digit": 7
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_correct"])
        self.assertEqual(data["outcome"], "correct")
        self.assertEqual(data["target_digit"], 7)
        self.assertEqual(data["predicted_digit"], 7)
        self.assertGreaterEqual(data["confidence"], 0.75)
        self.assertEqual(data["status"], "accepted_prediction")

    def test_26_practice_evaluate_incorrect_prediction(self):
        """Test POST /api/practice/evaluate when drawn digit does not match target."""
        digit_b64 = create_synthetic_digit_base64(3)
        res = self.client.post("/api/practice/evaluate", json={
            "image": digit_b64,
            "target_digit": 8
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertFalse(data["is_correct"])
        self.assertEqual(data["outcome"], "incorrect")
        self.assertEqual(data["target_digit"], 8)
        self.assertEqual(data["predicted_digit"], 3)
        self.assertIn("feedback", data)

    def test_27_practice_evaluate_blank_canvas(self):
        """Test POST /api/practice/evaluate with empty drawing."""
        blank_b64 = create_blank_canvas_base64()
        res = self.client.post("/api/practice/evaluate", json={
            "image": blank_b64,
            "target_digit": 4
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertTrue(data["is_blank"])
        self.assertEqual(data["outcome"], "blank")
        self.assertIsNone(data["predicted_digit"])

    def test_28_practice_evaluate_malformed_input(self):
        """Test POST /api/practice/evaluate validation for missing or invalid target."""
        # Missing target_digit
        digit_b64 = create_synthetic_digit_base64(2)
        res1 = self.client.post("/api/practice/evaluate", json={"image": digit_b64})
        self.assertEqual(res1.status_code, 400)

        # Invalid target_digit out of range
        res2 = self.client.post("/api/practice/evaluate", json={"image": digit_b64, "target_digit": 99})
        self.assertEqual(res2.status_code, 400)

        # Missing image
        res3 = self.client.post("/api/practice/evaluate", json={"target_digit": 2})
        self.assertEqual(res3.status_code, 400)

    def test_29_practice_evaluate_top_candidates(self):
        """Test POST /api/practice/evaluate returns top candidate alternatives and margins."""
        digit_b64 = create_synthetic_digit_base64(5)
        res = self.client.post("/api/practice/evaluate", json={
            "image": digit_b64,
            "target_digit": 5
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("top_candidates", data)
        self.assertIsInstance(data["top_candidates"], list)
        self.assertGreater(len(data["top_candidates"]), 0)
        self.assertIn("margin", data)
        self.assertIsInstance(data["margin"], float)

    def test_30_practice_evaluate_status_policy(self):
        """Test that evaluate endpoint reports accepted, uncertain, or rejected status."""
        digit_b64 = create_synthetic_digit_base64(0)
        res = self.client.post("/api/practice/evaluate", json={
            "image": digit_b64,
            "target_digit": 0
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn(data["status"], ["accepted_prediction", "uncertain_prediction", "rejected_prediction"])


if __name__ == "__main__":
    unittest.main()


