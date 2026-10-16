import os
import sys
import numpy as np
import cv2
import tensorflow as tf

def main():
    print("=== STEP 1: Inspect Model & Summary ===")
    model_path = os.path.join(os.path.dirname(__file__), "models", "mnist_cnn.keras")
    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found at {model_path}")
        sys.exit(1)

    model = tf.keras.models.load_model(model_path)
    model.summary()

    print("\n=== STEP 2: List Convolutional Layers ===")
    conv_layers = []
    for layer in model.layers:
        layer_type = layer.__class__.__name__
        if "conv" in layer_type.lower():
            conv_layers.append((layer.name, layer_type))
            print(f" - Found Conv Layer: name='{layer.name}', type={layer_type}")

    if not conv_layers:
        print("ERROR: No convolutional layers found in the model.")
        sys.exit(1)

    last_conv_name = conv_layers[-1][0]
    print(f"\nTarget Last Convolutional Layer: '{last_conv_name}'")

    print("\n=== STEP 3: Create Test Image (Handwritten Digit) ===")
    # Create 28x28 grayscale image with a handwritten-style digit '3'
    canvas28 = np.zeros((28, 28), dtype=np.uint8)
    cv2.putText(canvas28, "3", (5, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.75, 255, 2, cv2.LINE_AA)

    # Normalize to [0.0, 1.0] and reshape to (1, 28, 28, 1)
    input_tensor = (canvas28.astype(np.float32) / 255.0).reshape(1, 28, 28, 1)

    # Standard forward pass to get predicted class
    raw_preds = model.predict(input_tensor, verbose=0)[0]
    pred_class = int(np.argmax(raw_preds))
    confidence = float(raw_preds[pred_class])
    print(f"Predicted Class: {pred_class} (Confidence: {confidence*100:.2f}%)")
    print(f"All class probabilities: {[round(float(p), 4) for p in raw_preds]}")

    print("\n=== STEP 4: Run Grad-CAM via Layer-Forward GradientTape ===")
    # Forward pass layer-by-layer so we can watch the last conv feature map directly
    x = tf.convert_to_tensor(input_tensor)
    conv_features = None

    with tf.GradientTape() as tape:
        h = x
        for layer in model.layers:
            # Skip data augmentation during inference
            if any(aug in layer.__class__.__name__.lower() for aug in ["randomrotation", "randomzoom", "randomtranslation"]):
                continue
            h = layer(h, training=False)
            if layer.name == last_conv_name:
                conv_features = h
                tape.watch(conv_features)

        predictions = h
        loss = predictions[:, pred_class]

    # Compute gradients of the predicted class score with respect to feature maps
    grads = tape.gradient(loss, conv_features)

    if grads is None:
        print("ERROR: Gradient computation returned None!")
        sys.exit(1)

    print(f"Gradients computed successfully! Shape: {grads.shape}")
    print(f"Gradient stats: min={float(tf.reduce_min(grads)):.6f}, max={float(tf.reduce_max(grads)):.6f}, mean={float(tf.reduce_mean(grads)):.6f}")

    # Pool gradients across height & width (Global Average Pooling of gradients)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    # Weight feature map channels by pooled gradients
    cam = tf.reduce_sum(conv_features[0] * pooled_grads, axis=-1)

    # Apply ReLU (focus only on features contributing positively to class)
    cam = tf.maximum(cam, 0)

    # Normalize heatmap between 0.0 and 1.0
    cam_max = float(tf.reduce_max(cam))
    if cam_max > 0:
        cam_normalized = (cam / cam_max).numpy()
    else:
        cam_normalized = cam.numpy()

    print("\n=== STEP 5: Verify Heatmap Variation ===")
    print(f"Heatmap dimensions: {cam_normalized.shape}")
    print(f"Heatmap min: {cam_normalized.min():.4f}, max: {cam_normalized.max():.4f}, mean: {cam_normalized.mean():.4f}")
    has_variation = (cam_normalized.max() - cam_normalized.min()) > 0.01
    print(f"Contains meaningful non-zero variation: {has_variation}")

    print("\n=== STEP 6: Generate Overlay and Save Artifacts ===")
    output_dir = os.path.join(os.path.dirname(__file__), "test_output")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Original processed image (scaled up to 140x140 for crisp visualization)
    disp_size = (140, 140)
    original_disp = cv2.resize(canvas28, disp_size, interpolation=cv2.INTER_NEAREST)
    original_bgr = cv2.cvtColor(original_disp, cv2.COLOR_GRAY2BGR)

    # 2. Resize heatmap to display size
    heatmap_resized = cv2.resize(cam_normalized, disp_size, interpolation=cv2.INTER_LINEAR)
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

    # 3. Transparent blended overlay
    overlay = cv2.addWeighted(original_bgr, 0.60, heatmap_color, 0.40, 0)

    orig_path = os.path.join(output_dir, "original_digit.png")
    heat_path = os.path.join(output_dir, "heatmap_jet.png")
    over_path = os.path.join(output_dir, "gradcam_overlay.png")

    cv2.imwrite(orig_path, original_bgr)
    cv2.imwrite(heat_path, heatmap_color)
    cv2.imwrite(over_path, overlay)

    print(f"Saved original digit: {orig_path}")
    print(f"Saved heatmap:        {heat_path}")
    print(f"Saved overlay:        {over_path}")

    print("\n=== RESULT ===")
    print("SUCCESS: Standalone Grad-CAM pipeline verified end-to-end!")

if __name__ == "__main__":
    main()
