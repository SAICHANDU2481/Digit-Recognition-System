import os
import time
import base64
import io
import numpy as np
import cv2
from PIL import Image

try:
    import tensorflow as tf
    from tensorflow import keras
except ImportError:
    tf = None
    keras = None

DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "mnist_cnn.keras")


def decode_base64_image(image_data: str) -> np.ndarray:
    """
    Decodes a base64 encoded image string (with or without data URL scheme)
    into an OpenCV BGR/BGRA numpy array.
    """
    if not image_data:
        raise ValueError("Image data is empty.")

    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    img_bytes = base64.b64decode(image_data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

    if img is None:
        raise ValueError("Could not decode image from base64 data.")

    return img


def preprocess_digit_image(img: np.ndarray, is_webcam: bool = False):
    """
    Preprocesses an input image (from canvas or webcam) to match the MNIST format:
    - Grayscale conversion
    - Alpha channel flattening onto solid background if transparent
    - Camera/paper detection: adaptive thresholding and contour extraction for photos
    - Canvas drawing: standard thresholding with polarity auto-invert
    - Aspect ratio preserving resize to fit inside 20x20 box
    - Center on 28x28 canvas using center of mass (LeCun MNIST protocol)
    - Normalization to [0.0, 1.0]

    Returns:
        tensor: np.ndarray of shape (1, 28, 28, 1) float32 in [0, 1]
        processed_28x28_uint8: np.ndarray of shape (28, 28) uint8 in [0, 255]
        is_blank: bool
    """
    # 1. Handle Alpha channel (e.g. from transparent canvas)
    if len(img.shape) == 3 and img.shape[2] == 4:
        b, g, r, a = cv2.split(img)
        alpha_factor = a.astype(float) / 255.0
        gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
        if np.any(a > 0):
            white_bg = np.ones_like(gray, dtype=np.uint8) * 255
            blended = (gray * alpha_factor + white_bg * (1.0 - alpha_factor)).astype(np.uint8)
            gray = blended
    elif len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    h, w = gray.shape
    mean_val = float(np.mean(gray))

    # Determine if input is a real-world camera photo of paper or a clean digital canvas drawing
    # Camera photos of paper have light background (mean_val > 85) and/or is_webcam flag set
    is_paper_photo = is_webcam or mean_val > 85

    if is_paper_photo:
        # Camera / Paper Handwriting Pipeline
        # Denoise with Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Adaptive Gaussian thresholding extracts ink strokes regardless of uneven lighting / shadows
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 14
        )

        # Morphological dilation: thickens thin ballpoint / pencil strokes to match MNIST felt-tip pen thickness
        kernel = np.ones((3, 3), np.uint8)
        thresh = cv2.dilate(thresh, kernel, iterations=1)

        # Find external contours
        cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        center_x, center_y = w / 2.0, h / 2.0
        valid_boxes = []

        for c in cnts:
            area = cv2.contourArea(c)
            bx, by, bw, bh = cv2.boundingRect(c)

            # Exclude contours touching the image border (paper edges / camera frame borders)
            if bx <= 2 or by <= 2 or bx + bw >= w - 2 or by + bh >= h - 2:
                continue

            # Exclude tiny noise specks
            if area > 35 and (bw > 6 or bh > 6):
                dist = np.hypot((bx + bw / 2.0) - center_x, (by + bh / 2.0) - center_y)
                valid_boxes.append((area, dist, (bx, by, bw, bh)))

        if not valid_boxes:
            empty_canvas = np.zeros((28, 28), dtype=np.uint8)
            tensor = np.zeros((1, 28, 28, 1), dtype=np.float32)
            return tensor, empty_canvas, True

        # Sort by distance from center
        valid_boxes.sort(key=lambda item: item[1])
        primary = valid_boxes[0][2]
        px, py, pw, ph = primary

        # Group any multi-stroke components of the digit near the primary contour
        digit_boxes = [primary]
        for item in valid_boxes[1:]:
            bx, by, bw, bh = item[2]
            if (bx >= px - 65 and bx + bw <= px + pw + 65 and
                by >= py - 65 and by + bh <= py + ph + 65):
                digit_boxes.append((bx, by, bw, bh))

        min_x = min(b[0] for b in digit_boxes)
        min_y = min(b[1] for b in digit_boxes)
        max_x = max(b[0] + b[2] for b in digit_boxes)
        max_y = max(b[1] + b[3] for b in digit_boxes)

        pad = max(6, int(max(max_x - min_x, max_y - min_y) * 0.12))
        x1 = max(0, min_x - pad)
        y1 = max(0, min_y - pad)
        x2 = min(w, max_x + pad)
        y2 = min(h, max_y + pad)

        cropped = thresh[y1:y2, x1:x2]
    else:
        # Digital Canvas Drawing Pipeline (clean white stroke on dark background)
        border_pixels = np.concatenate([
            gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]
        ])
        if np.mean(border_pixels) > 127:
            gray_inv = cv2.bitwise_not(gray)
        else:
            gray_inv = gray.copy()

        blurred = cv2.GaussianBlur(gray_inv, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        coords = cv2.findNonZero(thresh)
        if coords is None or cv2.countNonZero(thresh) < 20:
            empty_canvas = np.zeros((28, 28), dtype=np.uint8)
            tensor = np.zeros((1, 28, 28, 1), dtype=np.float32)
            return tensor, empty_canvas, True

        x, y, bw, bh = cv2.boundingRect(coords)
        if bw < 3 or bh < 3:
            empty_canvas = np.zeros((28, 28), dtype=np.uint8)
            tensor = np.zeros((1, 28, 28, 1), dtype=np.float32)
            return tensor, empty_canvas, True

        pad = int(max(bw, bh) * 0.05)
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(w, x + bw + pad)
        y2 = min(h, y + bh + pad)
        cropped = gray_inv[y1:y2, x1:x2]

    # Fit cropped digit inside 20x20 box preserving aspect ratio
    ch, cw = cropped.shape
    if ch <= 0 or cw <= 0:
        empty_canvas = np.zeros((28, 28), dtype=np.uint8)
        tensor = np.zeros((1, 28, 28, 1), dtype=np.float32)
        return tensor, empty_canvas, True

    if ch > cw:
        scale = 20.0 / ch
        new_h = 20
        new_w = max(1, int(round(cw * scale)))
    else:
        scale = 20.0 / cw
        new_w = 20
        new_h = max(1, int(round(ch * scale)))

    resized_digit = cv2.resize(cropped, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Place in 28x28 black canvas
    canvas_28 = np.zeros((28, 28), dtype=np.uint8)
    start_y = (28 - new_h) // 2
    start_x = (28 - new_w) // 2
    canvas_28[start_y:start_y + new_h, start_x:start_x + new_w] = resized_digit

    # Shift center of mass to (13.5, 13.5) like MNIST standard
    moments = cv2.moments(canvas_28)
    if moments["m00"] > 0:
        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]
        shift_x = int(np.round(13.5 - cx))
        shift_y = int(np.round(13.5 - cy))
        shift_x = max(-4, min(4, shift_x))
        shift_y = max(-4, min(4, shift_y))
        M = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
        canvas_28 = cv2.warpAffine(canvas_28, M, (28, 28), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

    # Normalize to [0.0, 1.0]
    tensor = canvas_28.astype(np.float32) / 255.0
    tensor = np.expand_dims(tensor, axis=(0, -1))  # Shape: (1, 28, 28, 1)

    return tensor, canvas_28, False


def encode_image_to_base64(img_28x28: np.ndarray) -> str:
    """Encodes a 28x28 uint8 numpy array into a base64 PNG data URL."""
    # Scale up for crisp visualization in web UI (e.g. 140x140 using nearest neighbor)
    display_img = cv2.resize(img_28x28, (140, 140), interpolation=cv2.INTER_NEAREST)
    success, buffer = cv2.imencode(".png", display_img)
    if not success:
        return ""
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


class DigitClassifier:
    """
    Singleton wrapper for loading and caching the CNN model and executing predictions.
    """
    _instance = None

    def __init__(self, model_path: str = DEFAULT_MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_model()

    @classmethod
    def get_instance(cls, model_path: str = DEFAULT_MODEL_PATH):
        if cls._instance is None:
            cls._instance = cls(model_path)
        return cls._instance

    def load_model(self):
        """Loads the trained .keras CNN model once at startup."""
        if not os.path.exists(self.model_path):
            print(f"[DigitClassifier] Model file not found at {self.model_path}. Model will need to be trained.")
            self.model = None
            return

        try:
            print(f"[DigitClassifier] Loading model from {self.model_path}...")
            self.model = keras.models.load_model(self.model_path)
            # Warm up model with a dummy prediction
            dummy_input = np.zeros((1, 28, 28, 1), dtype=np.float32)
            self.model.predict(dummy_input, verbose=0)
            print("[DigitClassifier] Model loaded and warmed up successfully.")
        except Exception as e:
            print(f"[DigitClassifier] Error loading model: {e}")
            self.model = None

    def is_loaded(self) -> bool:
        return self.model is not None

    def predict_from_base64(self, base64_str: str, is_webcam: bool = False) -> dict:
        """
        Takes a base64 string, preprocesses it, runs model inference,
        and returns prediction metrics and processed image preview.
        """
        start_time = time.perf_counter()

        if self.model is None:
            # Check if model file has since been created
            self.load_model()
            if self.model is None:
                return {
                    "success": False,
                    "error": "CNN model has not been trained yet. Please run backend/train_model.py first.",
                    "is_blank": False,
                    "duration_ms": 0.0
                }

        try:
            img = decode_base64_image(base64_str)
        except Exception as e:
            return {
                "success": False,
                "error": f"Invalid image format: {str(e)}",
                "is_blank": False,
                "duration_ms": 0.0
            }

        tensor, processed_28, is_blank = preprocess_digit_image(img, is_webcam=is_webcam)
        processed_preview = encode_image_to_base64(processed_28)

        if is_blank:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "success": False,
                "is_blank": True,
                "error": "Blank or empty image detected. Please draw or capture a clear digit.",
                "predicted_digit": None,
                "confidence": 0.0,
                "probabilities": {str(i): 0.0 for i in range(10)},
                "processed_image": processed_preview,
                "duration_ms": round(duration_ms, 2)
            }

        # Predict
        preds = self.model.predict(tensor, verbose=0)[0]
        predicted_digit = int(np.argmax(preds))
        confidence = float(preds[predicted_digit])

        probabilities = {str(i): round(float(p), 4) for i, p in enumerate(preds)}
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        return {
            "success": True,
            "is_blank": False,
            "predicted_digit": predicted_digit,
            "confidence": round(confidence, 4),
            "probabilities": probabilities,
            "processed_image": processed_preview,
            "duration_ms": round(duration_ms, 2),
            "error": None
        }
