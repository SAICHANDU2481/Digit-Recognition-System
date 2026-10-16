import os
import sys
import json
import time
from datetime import datetime
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless plotting
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support, accuracy_score

# TensorFlow & Keras
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, callbacks

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
MODEL_PATH = os.path.join(MODELS_DIR, "mnist_cnn.keras")
METRICS_PATH = os.path.join(OUTPUTS_DIR, "metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
TRAINING_PLOT_PATH = os.path.join(OUTPUTS_DIR, "training_history.png")


def ensure_directories():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)


def load_and_preprocess_data():
    """Loads and normalizes MNIST dataset."""
    print("[1/5] Loading MNIST dataset from Keras...")
    (x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()

    print(f"      Train shape: {x_train.shape}, Test shape: {x_test.shape}")

    # Normalize to [0.0, 1.0]
    x_train = x_train.astype("float32") / 255.0
    x_test = x_test.astype("float32") / 255.0

    # Expand channel dimension: (N, 28, 28) -> (N, 28, 28, 1)
    x_train = np.expand_dims(x_train, axis=-1)
    x_test = np.expand_dims(x_test, axis=-1)

    return (x_train, y_train), (x_test, y_test)


def build_cnn_model():
    """
    Builds a robust Convolutional Neural Network with data augmentation layers,
    batch normalization, and dropout to ensure high generalization accuracy on
    both canvas and real webcam hand-drawings.
    """
    print("[2/5] Building CNN architecture...")
    model = models.Sequential([
        # Data Augmentation (applied only during training)
        layers.RandomRotation(0.08, input_shape=(28, 28, 1), name="random_rotation"),
        layers.RandomZoom(0.08, name="random_zoom"),
        layers.RandomTranslation(0.05, 0.05, name="random_translation"),

        # Conv Block 1
        layers.Conv2D(32, kernel_size=(3, 3), padding="same", activation="relu", name="conv1_1"),
        layers.BatchNormalization(name="bn1_1"),
        layers.Conv2D(32, kernel_size=(3, 3), padding="same", activation="relu", name="conv1_2"),
        layers.BatchNormalization(name="bn1_2"),
        layers.MaxPooling2D(pool_size=(2, 2), name="pool1"),
        layers.Dropout(0.25, name="dropout1"),

        # Conv Block 2
        layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu", name="conv2_1"),
        layers.BatchNormalization(name="bn2_1"),
        layers.Conv2D(64, kernel_size=(3, 3), padding="same", activation="relu", name="conv2_2"),
        layers.BatchNormalization(name="bn2_2"),
        layers.MaxPooling2D(pool_size=(2, 2), name="pool2"),
        layers.Dropout(0.25, name="dropout2"),

        # Fully Connected Classification Head
        layers.Flatten(name="flatten"),
        layers.Dense(128, activation="relu", name="dense1"),
        layers.BatchNormalization(name="bn_dense"),
        layers.Dropout(0.40, name="dropout_dense"),
        layers.Dense(10, activation="softmax", name="output_probabilities")
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    model.summary()
    return model


def train_cnn(model, x_train, y_train, x_test, y_test, epochs=7, batch_size=128):
    """Trains the CNN with early stopping and learning rate reduction."""
    print(f"[3/5] Training CNN for up to {epochs} epochs (batch size: {batch_size})...")

    lr_reducer = callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=2,
        min_lr=1e-5,
        verbose=1
    )

    checkpoint = callbacks.ModelCheckpoint(
        filepath=MODEL_PATH,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1
    )

    early_stop = callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=3,
        restore_best_weights=True,
        verbose=1
    )

    start_time = time.time()
    history = model.fit(
        x_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=(x_test, y_test),
        callbacks=[checkpoint, lr_reducer, early_stop],
        verbose=1
    )
    training_duration = time.time() - start_time
    print(f"      Training completed in {training_duration:.2f} seconds.")

    # Save final model explicitly if checkpoint didn't save latest
    if not os.path.exists(MODEL_PATH):
        model.save(MODEL_PATH)
        print(f"      Saved model to {MODEL_PATH}")

    return history, training_duration


def evaluate_and_generate_metrics(model, x_test, y_test, history, training_duration):
    """
    Evaluates test set performance, generates confusion matrix,
    calculates actual accuracy, precision, recall, F1, and saves metrics.json.
    """
    print("[4/5] Evaluating CNN on MNIST test set (10,000 images)...")

    # Evaluate loss and accuracy
    eval_results = model.evaluate(x_test, y_test, verbose=0)
    test_loss = float(eval_results[0])
    test_acc = float(eval_results[1])

    # Model predictions
    y_pred_probs = model.predict(x_test, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)

    # Scikit-learn metrics
    acc = float(accuracy_score(y_test, y_pred))
    prec_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(y_test, y_pred, average="macro")
    prec_weighted, recall_weighted, f1_weighted, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted")

    # Per-class metrics
    class_report = classification_report(y_test, y_pred, output_dict=True, digits=4)
    per_class_metrics = {}
    for i in range(10):
        cls_key = str(i)
        if cls_key in class_report:
            per_class_metrics[cls_key] = {
                "precision": round(float(class_report[cls_key]["precision"]), 4),
                "recall": round(float(class_report[cls_key]["recall"]), 4),
                "f1_score": round(float(class_report[cls_key]["f1-score"]), 4),
                "support": int(class_report[cls_key]["support"])
            }

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    cm_list = cm.tolist()

    # Parameter counts
    total_params = int(model.count_params())
    trainable_params = int(sum([tf.size(w).numpy() for w in model.trainable_weights]))

    metrics_data = {
        "model_name": "CNN_MNIST_Classifier",
        "timestamp": datetime.now().isoformat(),
        "training_duration_seconds": round(training_duration, 2),
        "total_parameters": total_params,
        "trainable_parameters": trainable_params,
        "test_dataset_size": len(y_test),
        "test_accuracy": round(acc, 4),
        "test_accuracy_percentage": round(acc * 100.0, 2),
        "test_loss": round(test_loss, 4),
        "macro_precision": round(float(prec_macro), 4),
        "macro_recall": round(float(recall_macro), 4),
        "macro_f1_score": round(float(f1_macro), 4),
        "weighted_precision": round(float(prec_weighted), 4),
        "weighted_recall": round(float(recall_weighted), 4),
        "weighted_f1_score": round(float(f1_weighted), 4),
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm_list,
        "history": {
            "loss": [round(float(v), 4) for v in history.history.get("loss", [])],
            "val_loss": [round(float(v), 4) for v in history.history.get("val_loss", [])],
            "accuracy": [round(float(v), 4) for v in history.history.get("accuracy", [])],
            "val_accuracy": [round(float(v), 4) for v in history.history.get("val_accuracy", [])]
        }
    }

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"      Saved metrics to {METRICS_PATH}")

    # Plot Confusion Matrix
    print("[5/5] Generating confusion matrix visualization...")
    plt.figure(figsize=(9, 8))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=[str(i) for i in range(10)],
        yticklabels=[str(i) for i in range(10)],
        cbar=True
    )
    plt.title(f"MNIST CNN Confusion Matrix (Test Accuracy: {acc*100:.2f}%)", fontsize=14, pad=15)
    plt.xlabel("Predicted Digit", fontsize=12)
    plt.ylabel("Actual Digit", fontsize=12)
    plt.tight_layout()
    plt.savefig(CONFUSION_MATRIX_PATH, dpi=180)
    plt.close()
    print(f"      Saved confusion matrix plot to {CONFUSION_MATRIX_PATH}")

    # Plot Training curves
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(history.history["accuracy"], label="Train Accuracy", marker="o")
    plt.plot(history.history["val_accuracy"], label="Val Accuracy", marker="s")
    plt.title("Model Accuracy per Epoch", fontsize=12)
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.subplot(1, 2, 2)
    plt.plot(history.history["loss"], label="Train Loss", marker="o")
    plt.plot(history.history["val_loss"], label="Val Loss", marker="s")
    plt.title("Model Loss per Epoch", fontsize=12)
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(TRAINING_PLOT_PATH, dpi=180)
    plt.close()
    print(f"      Saved training curve plot to {TRAINING_PLOT_PATH}")

    print("\n" + "="*50)
    print(f" TRAINING & EVALUATION REPORT")
    print(f" Test Accuracy : {acc * 100:.2f}%")
    print(f" Macro F1 Score: {f1_macro:.4f}")
    print(f" Macro Recall  : {recall_macro:.4f}")
    print(f" Saved Model   : {MODEL_PATH}")
    print("="*50 + "\n")

    return metrics_data


def main():
    ensure_directories()
    (x_train, y_train), (x_test, y_test) = load_and_preprocess_data()
    model = build_cnn_model()
    history, duration = train_cnn(model, x_train, y_train, x_test, y_test, epochs=7, batch_size=128)
    # Load best checkpoint
    best_model = keras.models.load_model(MODEL_PATH)
    evaluate_and_generate_metrics(best_model, x_test, y_test, history, duration)


if __name__ == "__main__":
    main()
