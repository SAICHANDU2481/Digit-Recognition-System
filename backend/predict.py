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


def encode_bgr_to_base64(bgr_img: np.ndarray) -> str:
    """Encodes a BGR/RGB image into a base64 PNG data URL."""
    success, buffer = cv2.imencode(".png", bgr_img)
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

        # Calculate top candidates and margin
        sorted_indices = np.argsort(preds)[::-1]
        top_candidates = [
            {"digit": int(idx), "confidence": round(float(preds[idx]), 4)}
            for idx in sorted_indices[:3]
        ]
        runner_up_conf = float(preds[sorted_indices[1]]) if len(sorted_indices) > 1 else 0.0
        margin = round(confidence - runner_up_conf, 4)

        # Confidence policy
        if confidence >= 0.75 and margin >= 0.15:
            status = "accepted_prediction"
        elif confidence >= 0.50:
            status = "uncertain_prediction"
        else:
            status = "rejected_prediction"

        return {
            "success": True,
            "is_blank": False,
            "predicted_digit": predicted_digit,
            "confidence": round(confidence, 4),
            "margin": margin,
            "status": status,
            "top_candidates": top_candidates,
            "probabilities": probabilities,
            "processed_image": processed_preview,
            "duration_ms": round(duration_ms, 2),
            "error": None
        }

    def predict_multiple_from_base64(
        self,
        base64_str: str,
        is_webcam: bool = False,
        confidence_threshold: float = 0.75,
        min_margin: float = 0.15
    ) -> dict:
        """
        Multi-digit recognition pipeline.
        Segments multiple handwritten digits in a single image/canvas,
        runs CNN inference on each crop, sorts them left-to-right, and evaluates
        a confidence-aware rejection policy.
        """
        start_time = time.perf_counter()

        if self.model is None:
            self.load_model()
            if self.model is None:
                return {
                    "success": False,
                    "status": "segmentation_failure",
                    "error": "CNN model has not been trained yet. Please run backend/train_model.py first.",
                    "recognized_text": "",
                    "detected_digit_count": 0,
                    "per_digit_predictions": [],
                    "warnings": ["Model unavailable."],
                    "duration_ms": 0.0
                }

        try:
            img = decode_base64_image(base64_str)
        except Exception as e:
            return {
                "success": False,
                "status": "invalid_input",
                "error": f"Invalid image format: {str(e)}",
                "recognized_text": "",
                "detected_digit_count": 0,
                "per_digit_predictions": [],
                "warnings": ["Failed to decode base64 image data."],
                "duration_ms": 0.0
            }

        # Grayscale conversion
        if len(img.shape) == 3 and img.shape[2] == 4:
            b, g, r, a = cv2.split(img)
            alpha_factor = a.astype(float) / 255.0
            gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
            if np.any(a > 0):
                white_bg = np.ones_like(gray, dtype=np.uint8) * 255
                gray = (gray * alpha_factor + white_bg * (1.0 - alpha_factor)).astype(np.uint8)
        elif len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()

        h, w = gray.shape
        mean_val = float(np.mean(gray))
        is_paper = is_webcam or mean_val > 85
        warnings = []

        # 1. Binarization (Foreground = 255 bright ink, Background = 0 dark)
        if is_paper:
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 14
            )
            kernel = np.ones((2, 2), np.uint8)
            thresh = cv2.dilate(thresh, kernel, iterations=1)
        else:
            border_pixels = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
            if np.mean(border_pixels) > 127:
                gray_inv = cv2.bitwise_not(gray)
            else:
                gray_inv = gray.copy()
            blurred = cv2.GaussianBlur(gray_inv, (5, 5), 0)
            _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # 2. Blank Check
        non_zero = cv2.countNonZero(thresh)
        if non_zero < 25 or (non_zero / float(h * w)) < 0.0004:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "success": False,
                "status": "blank_input",
                "error": "Blank or empty image detected. Please draw or capture multiple digits.",
                "recognized_text": "",
                "detected_digit_count": 0,
                "per_digit_predictions": [],
                "warnings": ["Image is blank or contains no legible strokes."],
                "duration_ms": round(duration_ms, 2)
            }

        # 3. Connected Component Analysis
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=8)

        components = []
        for i in range(1, num_labels):
            x, y, cw, ch, area = stats[i]
            # Filter frame borders
            if is_paper and (x <= 1 or y <= 1 or x + cw >= w - 1 or y + ch >= h - 1):
                continue
            # Filter noise
            if area >= 30 and (cw >= 4 or ch >= 6):
                components.append({
                    "x": int(x),
                    "y": int(y),
                    "w": int(cw),
                    "h": int(ch),
                    "area": int(area),
                    "label": int(i)
                })

        if not components:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "success": False,
                "status": "segmentation_failure",
                "error": "No valid digit strokes could be isolated.",
                "recognized_text": "",
                "detected_digit_count": 0,
                "per_digit_predictions": [],
                "warnings": ["Connected-component analysis found no viable digit regions."],
                "duration_ms": round(duration_ms, 2)
            }

        # 4. Touching Digits Separation via Vertical Projection Profiles
        split_components = []
        for c in components:
            aspect = c["w"] / float(max(1, c["h"]))
            # If aspect ratio is significantly wider than typical digits (w/h > 1.15) and wide enough to contain multiple glyphs
            if aspect > 1.15 and c["w"] >= 28:
                comp_mask = (labels[c["y"]:c["y"] + c["h"], c["x"]:c["x"] + c["w"]] == c["label"]).astype(np.uint8)
                v_proj = np.sum(comp_mask, axis=0)

                search_start = int(c["w"] * 0.25)
                search_end = int(c["w"] * 0.75)
                if search_end > search_start:
                    sub_proj = v_proj[search_start:search_end]
                    min_idx = search_start + int(np.argmin(sub_proj))
                    min_val = float(v_proj[min_idx])
                    max_val = float(max(np.max(v_proj[:search_start]), np.max(v_proj[search_end:]), 1))

                    # If significant vertical valley (ligature < 60% of peak height)
                    if min_val <= 0.60 * max_val:
                        w1 = min_idx
                        w2 = c["w"] - min_idx
                        split_components.append({
                            "x": c["x"],
                            "y": c["y"],
                            "w": w1,
                            "h": c["h"],
                            "area": int(c["area"] * (w1 / float(c["w"])))
                        })
                        split_components.append({
                            "x": c["x"] + min_idx,
                            "y": c["y"],
                            "w": w2,
                            "h": c["h"],
                            "area": int(c["area"] * (w2 / float(c["w"])))
                        })
                        warnings.append(f"Touching digits detected at x={c['x'] + min_idx} and split using projection profile.")
                        continue
                    else:
                        warnings.append(f"Wide region at x={c['x']} (aspect {aspect:.2f}) could not be split cleanly; potential touching digits.")

            split_components.append(c)

        # 5. Multi-Stroke Glyph Grouping (e.g. top bar on 5, crossbars on 7)
        split_components.sort(key=lambda item: item["x"])
        grouped_boxes = []
        skip = set()

        for i, c1 in enumerate(split_components):
            if i in skip:
                continue
            cur_box = [c1["x"], c1["y"], c1["x"] + c1["w"], c1["y"] + c1["h"]]
            for j in range(i + 1, len(split_components)):
                if j in skip:
                    continue
                c2 = split_components[j]
                overlap_x = max(0, min(cur_box[2], c2["x"] + c2["w"]) - max(cur_box[0], c2["x"]))
                min_w = min(cur_box[2] - cur_box[0], c2["w"])
                dist_x = c2["x"] - cur_box[2]

                # If overlapping horizontally or closely adjacent with vertical alignment
                if min_w > 0 and (overlap_x / float(min_w) > 0.35 or (dist_x < 8 and c2["x"] <= cur_box[2])):
                    cur_box[0] = min(cur_box[0], c2["x"])
                    cur_box[1] = min(cur_box[1], c2["y"])
                    cur_box[2] = max(cur_box[2], c2["x"] + c2["w"])
                    cur_box[3] = max(cur_box[3], c2["y"] + c2["h"])
                    skip.add(j)

            grouped_boxes.append({
                "x": cur_box[0],
                "y": cur_box[1],
                "w": cur_box[2] - cur_box[0],
                "h": cur_box[3] - cur_box[1]
            })

        # 6. Sort Final Bounding Boxes Left-to-Right
        grouped_boxes.sort(key=lambda b: b["x"])

        # 7. CNN Inference & Confidence Evaluation for Each Segmented Digit
        per_digit_results = []
        recognized_digits = []
        has_uncertain = False
        has_rejected = False

        for idx, box in enumerate(grouped_boxes):
            bx, by, bw, bh = box["x"], box["y"], box["w"], box["h"]
            pad = max(4, int(max(bw, bh) * 0.12))
            x1 = max(0, bx - pad)
            y1 = max(0, by - pad)
            x2 = min(w, bx + bw + pad)
            y2 = min(h, by + bh + pad)

            crop = thresh[y1:y2, x1:x2]
            ch, cw = crop.shape
            if ch <= 0 or cw <= 0:
                continue

            # Scale to 20x20
            scale = 20.0 / max(ch, cw)
            new_w = max(1, int(round(cw * scale)))
            new_h = max(1, int(round(ch * scale)))
            resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)

            # Center on 28x28 canvas
            canvas28 = np.zeros((28, 28), dtype=np.uint8)
            sy = (28 - new_h) // 2
            sx = (28 - new_w) // 2
            canvas28[sy:sy + new_h, sx:sx + new_w] = resized

            # Center of mass moment alignment
            moments = cv2.moments(canvas28)
            if moments["m00"] > 0:
                cx = moments["m10"] / moments["m00"]
                cy = moments["m01"] / moments["m00"]
                shift_x = max(-4, min(4, int(round(13.5 - cx))))
                shift_y = max(-4, min(4, int(round(13.5 - cy))))
                M = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
                canvas28 = cv2.warpAffine(canvas28, M, (28, 28))

            tensor = (canvas28.astype(np.float32) / 255.0).reshape(1, 28, 28, 1)
            preds = self.model.predict(tensor, verbose=0)[0]
            pred_digit = int(np.argmax(preds))
            conf = float(preds[pred_digit])

            # Alternatives and margin
            sorted_probs = sorted(list(enumerate(preds)), key=lambda item: float(item[1]), reverse=True)
            second_digit = int(sorted_probs[1][0])
            second_conf = float(sorted_probs[1][1])
            margin = float(conf - second_conf)

            # Confidence-Aware Policy
            if conf >= confidence_threshold and margin >= min_margin:
                digit_status = "accepted"
            elif conf < 0.40 or margin < 0.06:
                digit_status = "rejected"
                has_rejected = True
                warnings.append(f"Digit at index {idx} rejected due to low confidence ({conf*100:.1f}%) or high ambiguity.")
            else:
                digit_status = "uncertain"
                has_uncertain = True
                warnings.append(f"Digit at index {idx} has borderline confidence ({conf*100:.1f}%), alternative digit {second_digit} ({second_conf*100:.1f}%).")

            crop_preview = encode_image_to_base64(canvas28)
            recognized_digits.append(str(pred_digit))

            per_digit_results.append({
                "index": int(idx),
                "predicted_digit": int(pred_digit),
                "confidence": float(round(conf, 4)),
                "margin": float(round(margin, 4)),
                "status": str(digit_status),
                "bounding_box": {"x": int(bx), "y": int(by), "w": int(bw), "h": int(bh)},
                "probabilities": {str(i): float(round(float(p), 4)) for i, p in enumerate(preds)},
                "top_alternatives": [
                    {"digit": int(d), "confidence": float(round(float(c), 4))}
                    for d, c in sorted_probs[:3]
                ],
                "preprocessed_crop": crop_preview
            })

        duration_ms = float((time.perf_counter() - start_time) * 1000.0)

        # Overall Status
        if has_rejected:
            overall_status = "uncertain_prediction"
        elif has_uncertain:
            overall_status = "uncertain_prediction"
        elif not per_digit_results:
            overall_status = "segmentation_failure"
        else:
            overall_status = "accepted_prediction"

        return {
            "success": True,
            "status": overall_status,
            "recognized_text": "".join(recognized_digits),
            "detected_digit_count": len(per_digit_results),
            "per_digit_predictions": per_digit_results,
            "source_dimensions": {"width": w, "height": h},
            "warnings": warnings,
            "duration_ms": round(duration_ms, 2),
            "error": None
        }

    def explain_from_base64(
        self,
        base64_str: str,
        target_digit: int = None,
        is_webcam: bool = False
    ) -> dict:
        """
        Generates a Grad-CAM explainability heatmap for the input digit image.
        Uses gradient tape through convolutional feature maps to highlight image
        regions most influential to the model's classification score.
        """
        start_time = time.perf_counter()

        if self.model is None:
            self.load_model()
            if self.model is None:
                return {
                    "success": False,
                    "is_blank": False,
                    "error": "CNN model has not been trained yet. Please run backend/train_model.py first.",
                    "prediction": None,
                    "confidence": 0.0,
                    "layer": None,
                    "original_image": None,
                    "heatmap": None,
                    "overlay": None,
                    "explanation_method": "Grad-CAM",
                    "duration_ms": 0.0
                }

        try:
            img = decode_base64_image(base64_str)
        except Exception as e:
            return {
                "success": False,
                "is_blank": False,
                "error": f"Invalid image format: {str(e)}",
                "prediction": None,
                "confidence": 0.0,
                "layer": None,
                "original_image": None,
                "heatmap": None,
                "overlay": None,
                "explanation_method": "Grad-CAM",
                "duration_ms": 0.0
            }

        tensor, processed_28, is_blank = preprocess_digit_image(img, is_webcam=is_webcam)
        orig_preview = encode_image_to_base64(processed_28)

        if is_blank:
            duration_ms = float((time.perf_counter() - start_time) * 1000.0)
            return {
                "success": False,
                "is_blank": True,
                "error": "Blank or empty image detected. Please draw or capture a clear digit to explain.",
                "prediction": None,
                "confidence": 0.0,
                "probabilities": {str(i): 0.0 for i in range(10)},
                "layer": None,
                "original_image": orig_preview,
                "heatmap": None,
                "overlay": None,
                "explanation_method": "Grad-CAM",
                "duration_ms": round(duration_ms, 2)
            }

        # Dynamically locate the final suitable Conv2D layer
        last_conv_name = None
        for layer in reversed(self.model.layers):
            if "conv" in layer.__class__.__name__.lower():
                last_conv_name = layer.name
                break

        if not last_conv_name:
            duration_ms = float((time.perf_counter() - start_time) * 1000.0)
            return {
                "success": False,
                "is_blank": False,
                "error": "Unsupported model architecture: No convolutional layer found for Grad-CAM.",
                "prediction": None,
                "confidence": 0.0,
                "layer": None,
                "original_image": orig_preview,
                "heatmap": None,
                "overlay": None,
                "explanation_method": "Grad-CAM",
                "duration_ms": round(duration_ms, 2)
            }

        # Model forward pass for classification
        raw_preds = self.model.predict(tensor, verbose=0)[0]
        pred_class = int(np.argmax(raw_preds))
        class_idx = pred_class if target_digit is None else int(target_digit)
        confidence = float(raw_preds[class_idx])
        probabilities = {str(i): float(round(float(p), 4)) for i, p in enumerate(raw_preds)}

        # Forward pass layer-by-layer with GradientTape recording
        input_tensor = tf.convert_to_tensor(tensor)
        conv_features = None

        with tf.GradientTape() as tape:
            h = input_tensor
            tape.watch(h)
            for layer in self.model.layers:
                layer_type = layer.__class__.__name__.lower()
                # Skip data augmentation during inference
                if any(aug in layer_type for aug in ["rotation", "zoom", "translation"]):
                    continue
                h = layer(h, training=False)
                if layer.name == last_conv_name:
                    conv_features = h

            predictions = h
            loss = predictions[:, class_idx]

        grads = tape.gradient(loss, conv_features)

        if grads is None:
            duration_ms = float((time.perf_counter() - start_time) * 1000.0)
            return {
                "success": False,
                "is_blank": False,
                "error": "Gradient computation failed for layer.",
                "prediction": pred_class,
                "confidence": round(confidence, 4),
                "layer": last_conv_name,
                "original_image": orig_preview,
                "heatmap": None,
                "overlay": None,
                "explanation_method": "Grad-CAM",
                "duration_ms": round(duration_ms, 2)
            }

        # Global average pooling of gradients
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

        # Channel-weighted sum of feature maps
        cam = tf.reduce_sum(conv_features[0] * pooled_grads, axis=-1)
        cam = tf.maximum(cam, 0)
        cam_max = float(tf.reduce_max(cam))

        if cam_max > 0:
            cam_norm = (cam / cam_max).numpy()
        else:
            cam_norm = cam.numpy()

        # Generate output images at 140x140 display resolution
        disp_size = (140, 140)
        original_disp = cv2.resize(processed_28, disp_size, interpolation=cv2.INTER_NEAREST)
        original_bgr = cv2.cvtColor(original_disp, cv2.COLOR_GRAY2BGR)

        heatmap_resized = cv2.resize(cam_norm, disp_size, interpolation=cv2.INTER_LINEAR)
        heatmap_uint8 = np.uint8(255 * heatmap_resized)
        heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

        overlay = cv2.addWeighted(original_bgr, 0.60, heatmap_color, 0.40, 0)

        duration_ms = float((time.perf_counter() - start_time) * 1000.0)

        return {
            "success": True,
            "is_blank": False,
            "prediction": pred_class,
            "confidence": float(round(confidence, 4)),
            "layer": str(last_conv_name),
            "original_image": encode_bgr_to_base64(original_bgr),
            "heatmap": encode_bgr_to_base64(heatmap_color),
            "overlay": encode_bgr_to_base64(overlay),
            "explanation_method": "Grad-CAM",
            "probabilities": probabilities,
            "duration_ms": float(round(duration_ms, 2)),
            "error": None
        }

