# Real-Time Handwritten Digit Recognition System (DigitSense CNN)

A complete, production-ready full-stack machine learning web application that recognizes handwritten digits (0–9) in real time using a Deep Convolutional Neural Network (CNN) trained on the MNIST benchmark.

Featuring an interactive drawing canvas, live webcam digit scanner, LeCun-style aspect-ratio preserving preprocessing, confidence breakdown, per-class performance analytics with confusion matrix, and a Gemini AI Handwriting Assistant.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               React + Vite Frontend (Port 5173)         │
│  - Drawing Canvas (Mouse & Touch, Undo, Stroke size)   │
│  - Webcam Scanner (Target Reticle, Snapshot Capture)   │
│  - 10-Class Probability Bars, 28x28 Centered Preview   │
│  - Model Performance Analytics & Confusion Heatmap     │
│  - Gemini AI Handwriting Assistant Drawer              │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / Base64)
┌───────────────────────────▼────────────────────────────┐
│                Flask REST API (Port 5000)              │
│  - POST /api/predict (Canvas image base64)             │
│  - POST /api/predict/webcam (Camera frame base64)      │
│  - GET  /api/health (System status & uptime)           │
│  - GET  /api/model-info (Real test metrics & matrices) │
│  - GET  /api/confusion-matrix-image (Heatmap PNG)      │
│  - POST /api/assistant (Official Google Gen AI SDK)    │
│  - GET  /api/resources (Educational web scraping)      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│            Computer Vision & Deep Learning             │
│  - OpenCV Preprocessing (Grayscale, Crop, Invert)      │
│  - LeCun MNIST Normalization (20x20 in 28x28, COM shift│
│  - CNN (Conv2D, BatchNorm, Dropout, Data Augmentation) │
│  - Actual Test Accuracy: 99.29% on 10,000 test images  │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Digit_Recognition_System/
├── backend/
│   ├── app.py                     # Flask REST API server & CORS configuration
│   ├── wsgi.py                    # Production WSGI entrypoint (Gunicorn / Waitress)
│   ├── predict.py                 # OpenCV LeCun preprocessing & DigitClassifier singleton
│   ├── train_model.py             # CNN model architecture, training, and evaluation
│   ├── test_system.py             # End-to-end unit & integration test suite (9 tests)
│   ├── requirements.txt           # Production Python dependencies with Gunicorn & OpenCV headless
│   ├── .env.example               # Backend environment template (CORS, PORT, GEMINI)
│   ├── .env                       # Local backend secrets (git-ignored)
│   ├── models/
│   │   └── mnist_cnn.keras        # Trained Keras CNN model weights (~5.45MB, git-tracked)
│   └── outputs/
│       ├── metrics.json           # Actual test metrics (accuracy, F1, per-class stats)
│       ├── confusion_matrix.png   # Generated confusion matrix heatmap
│       └── training_history.png   # Loss and accuracy epoch curves
├── frontend/
│   ├── index.html                 # HTML5 document with Google Fonts & SEO meta tags
│   ├── vercel.json                # Vercel SPA routing rewrites & asset caching headers
│   ├── vite.config.js             # Vite configuration with API proxy to port 5000
│   ├── tailwind.config.js         # Tailwind CSS theme, dark mode, animations
│   ├── postcss.config.js          # PostCSS configuration
│   ├── package.json               # Frontend dependencies (React, Lucide, Confetti)
│   ├── .env.example               # Frontend environment template (VITE_API_BASE_URL)
│   ├── dist/                      # Production build bundle
│   └── src/
│       ├── main.jsx               # React entry point
│       ├── config.js              # Centralized API base URL helper & normalizer
│       ├── App.jsx                # Main dashboard coordinator
│       ├── index.css              # Glassmorphism, animations, scrollbars
│       └── components/
│           ├── Navbar.jsx         # Header, navigation tabs, live health badge
│           ├── CanvasDrawing.jsx  # Interactive canvas with mouse/touch & undo
│           ├── WebcamCapture.jsx  # Webcam stream with target reticle guide
│           ├── PredictionDisplay.jsx # Classified digit, probabilities, 28x28 preview
│           ├── PredictionHistory.jsx # Carousel of recent predictions
│           ├── ModelMetrics.jsx   # Confusion matrix heatmap & per-class table
│           ├── GeminiAssistant.jsx# AI assistant drawer powered by Gen AI SDK
│           └── EducationalResources.jsx # Educational resources & paper links
├── render.yaml                    # Render Blueprint IaC configuration
├── .gitignore                     # Git ignore rules protecting virtualenv & .env
└── README.md
```

---

## Prerequisites

* **Operating System**: Windows 10/11 (or macOS / Linux)
* **Python**: 3.10 – 3.12 (Installed on system)
* **Node.js**: v18.0+ or v20+ / v24+
* **npm**: 9.0+

---

## Quick Start (Windows PowerShell)

Open **Windows PowerShell** in the project root (`c:\Users\sys\Desktop\Digit_Recognition_System`):

### Step 1: Backend Setup & Virtual Environment

```powershell
# 1. Create a virtual environment with system packages enabled
python -m venv --system-site-packages backend\venv

# 2. Activate the virtual environment
.\backend\venv\Scripts\Activate.ps1

# 3. Install backend requirements
pip install -r backend\requirements.txt
```

> [!NOTE]
> If PowerShell displays an execution policy error on script activation, run:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

### Step 2: Configure Environment Variables

Create your `backend\.env` file (copied from `backend\.env.example`):

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`:
```ini
# Optional: Add your Google Gemini API key from https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here

# Flask Server Config
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
FLASK_DEBUG=True
```

### Step 3: Train the CNN Model (Already Trained with 99.29% Accuracy!)

The trained model (`backend/models/mnist_cnn.keras`) and its evaluation artifacts are already included. If you wish to retrain from scratch:

```powershell
backend\venv\Scripts\python.exe backend\train_model.py
```

This trains the CNN on MNIST with data augmentation, early stopping, and generates:
* `backend/models/mnist_cnn.keras`
* `backend/outputs/metrics.json`
* `backend/outputs/confusion_matrix.png`
* `backend/outputs/training_history.png`

### Step 4: Run the Backend Test Suite

Verify that all preprocessing and API endpoints pass:

```powershell
backend\venv\Scripts\python.exe backend\test_system.py
```

Expected output:
```
Ran 9 tests in 1.897s
OK
```

### Step 5: Start the Flask Backend Server

```powershell
backend\venv\Scripts\python.exe backend\app.py
```
* Server URL: `http://127.0.0.1:5000`
* Health Check: `http://127.0.0.1:5000/api/health`

### Step 6: Start the React Frontend Dashboard

In a **separate** PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```
* Frontend URL: `http://127.0.0.1:5173`

Open `http://127.0.0.1:5173` in your browser. You will see the **DigitSense CNN** dashboard with a live green indicator: `CNN Model Live`.

---

## Actual CNN Model Performance

Evaluated on the full **10,000-image MNIST test set**:

| Metric | Score |
| :--- | :--- |
| **Test Accuracy** | **99.29%** |
| **Macro Precision** | **99.28%** |
| **Macro Recall** | **99.31%** |
| **Macro F1-Score** | **0.9929** |
| **Test Loss** | **0.0204** |
| **Total Parameters** | 469,098 |
| **Trainable Parameters** | 468,458 |

### Per-Class Test Set Breakdown

| Digit | Precision | Recall | F1-Score | Support |
| :---: | :---: | :---: | :---: | :---: |
| **0** | 100.0% | 99.49% | 0.9974 | 980 |
| **1** | 99.64% | 98.24% | 0.9894 | 1,135 |
| **2** | 99.13% | 99.71% | 0.9942 | 1,032 |
| **3** | 99.31% | 99.50% | 0.9941 | 1,010 |
| **4** | 99.69% | 99.39% | 0.9954 | 982 |
| **5** | 98.78% | 99.55% | 0.9916 | 892 |
| **6** | 99.06% | 99.37% | 0.9922 | 958 |
| **7** | 99.03% | 99.12% | 0.9908 | 1,028 |
| **8** | 98.78% | 99.69% | 0.9923 | 974 |
| **9** | 99.40% | 99.01% | 0.9921 | 1,009 |

---

## Image Preprocessing Pipeline (LeCun MNIST Protocol)

Raw images drawn on a canvas or snapped via webcam undergo a robust 8-stage transformation before entering the neural network:

1. **Alpha Channel Flattening**: Handles transparent PNG canvas data by blending onto solid background.
2. **Polarity Check & Auto-Invert**: Detects whether the background is bright (white paper) or dark (black canvas), inverting as needed so the digit is always bright (`~255`) on a dark background (`~0`), matching MNIST standard.
3. **Bilateral / Gaussian Denoising & Otsu Thresholding**: Cleans noise and isolates the foreground strokes.
4. **Blank Canvas Detection**: Analyzes pixel coverage and active bounding box dimensions; flags empty or faint inputs as `is_blank: true` without raising unhandled exceptions.
5. **Aspect-Ratio Preserving Crop**: Extracts the minimal bounding box containing the digit with a 5% dynamic margin.
6. **20×20 Scaling**: Scales the cropped digit to fit within a 20×20 bounding box using `cv2.INTER_AREA`.
7. **Center-of-Mass Alignment**: Computes image spatial moments ($M_{10}/M_{00}$ and $M_{01}/M_{00}$) to shift the center of mass to $(13.5, 13.5)$ on the final 28×28 canvas using affine transformation.
8. **Normalization**: Converts pixel intensities to `float32` in $[0.0, 1.0]$ and reshapes to `(1, 28, 28, 1)`.

The frontend displays both the original image and the 28×28 processed input side-by-side so users can visually verify preprocessing quality.

---

## API Documentation

### 1. Health Status
`GET /api/health`
* **Response**:
  ```json
  {
    "status": "healthy",
    "model_loaded": true,
    "model_file_exists": true,
    "metrics_file_exists": true,
    "gemini_configured": true,
    "uptime_seconds": 124.5,
    "version": "1.0.0"
  }
  ```

### 2. Canvas Prediction
`POST /api/predict`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  { "image": "data:image/png;base64,iVBORw0KGgo..." }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "is_blank": false,
    "predicted_digit": 7,
    "confidence": 0.9984,
    "probabilities": {
      "0": 0.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0,
      "5": 0.0, "6": 0.0, "7": 0.9984, "8": 0.0001, "9": 0.0015
    },
    "processed_image": "data:image/png;base64,...",
    "duration_ms": 11.2,
    "error": null
  }
  ```

### 3. Webcam Prediction
`POST /api/predict/webcam`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  { "image": "data:image/jpeg;base64,..." }
  ```
* **Response**: Same schema as `/api/predict`.

### 4. Model Information & Metrics
`GET /api/model-info`
* Returns full evaluation metrics, confusion matrix 10×10 array, per-class metrics, parameter counts, and training loss/accuracy history.

### 5. Confusion Matrix Image
`GET /api/confusion-matrix-image`
* Serves the generated high-resolution Seaborn heatmap PNG.

### 6. Gemini AI Assistant
`POST /api/assistant`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "prompt": "Why was digit 7 classified with 99.8% confidence?",
    "context": {
      "predicted_digit": 7,
      "confidence": 0.9984,
      "probabilities": { "7": 0.9984, "9": 0.0015 }
    }
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "configured": true,
    "reply": "The model identified strong horizontal top-edge activations followed by an acute downward diagonal stroke..."
  }
  ```

### 7. Educational Resources (Web Scraping)
`GET /api/resources`
* Returns curated research references (LeNet-5, Keras ConvNet tutorial, Papers with Code leaderboard, 3Blue1Brown visual series, Wikipedia article extract) with cached scraping.

---

## Production Deployment Guide (Render + Vercel)

The system is architected for seamless cloud deployment:
* **Backend**: Hosted on **Render** (Python Web Service with Gunicorn WSGI).
* **Frontend**: Hosted on **Vercel** (Vite Single Page Application with Edge CDN).

```
┌───────────────────────────────┐           HTTPS API           ┌───────────────────────────────┐
│        Vercel (Frontend)      │ ────────────────────────────> │        Render (Backend)       │
│  - Vite React SPA Bundle      │    VITE_API_BASE_URL          │  - Gunicorn WSGI Server       │
│  - vercel.json SPA Rewrites   │                               │  - TensorFlow CNN in memory   │
│  - Edge CDN Worldwide         │ <──────────────────────────── │  - Gemini GenAI Proxy         │
└───────────────────────────────┘        CORS Authorized        └───────────────────────────────┘
```

---

### Phase 1: Push Code to GitHub

1. Initialize and commit your repository:
   ```bash
   git init
   git add .
   git commit -m "feat: complete production-ready handwritten digit recognition system"
   ```

2. Note on the Trained CNN Model:
   * The trained CNN model (`backend/models/mnist_cnn.keras`) is **5.45 MB**, well below GitHub's 100 MB hard limit and 50 MB warning threshold.
   * It is tracked by Git and will deploy directly to Render without external storage buckets or Git LFS.
   * Sensitive secrets (`.env`, `backend/.env`, `frontend/.env`) are protected by `.gitignore` and are **never** committed.

3. Push to your GitHub repository:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

---

### Phase 2: Deploy Backend to Render

You can deploy the backend using either Render Blueprints (IaC) or manually through the Render Dashboard.

#### Option A: 1-Click Render Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Blueprint**.
2. Connect your GitHub repository.
3. Render reads `render.yaml` automatically and configures the service:
   * **Name**: `digit-recognition-backend`
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   * **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120 wsgi:app`
4. In the **Environment Variables** prompt, enter your `GEMINI_API_KEY` (secret).
5. Click **Apply**.

#### Option B: Manual Web Service Setup
1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   * **Name**: `digit-recognition-backend`
   * **Region**: Oregon (or your preferred region)
   * **Branch**: `main`
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   * **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120 wsgi:app`
   * **Instance Type**: Free or Starter
4. Expand **Advanced** > **Environment Variables** and add:
   | Key | Value | Notes |
   | --- | --- | --- |
   | `PYTHON_VERSION` | `3.12.10` | Enforces Python 3.12 |
   | `FLASK_DEBUG` | `False` | Disables debug mode in production |
   | `ALLOWED_ORIGINS` | `*` | Update to your Vercel URL after Phase 3 |
   | `TF_ENABLE_ONEDNN_OPTS` | `0` | Clean numerical stability logs |
   | `GEMINI_API_KEY` | `AIzaSy...` | Secret key from [Google AI Studio](https://aistudio.google.com/) |
5. Click **Create Web Service**.
6. When deployment finishes, copy your Render service URL (e.g., `https://digit-recognition-backend.onrender.com`).

#### Backend Verification
Test your deployed backend in your browser or curl:
```bash
curl https://<your-backend-name>.onrender.com/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_file_exists": true,
  "metrics_file_exists": true,
  "gemini_configured": true,
  "version": "1.0.0"
}
```

---

### Phase 3: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New...** > **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click **Edit** and select `frontend` (crucial: ensure this is set to `frontend`).
   * **Build Command**: `npm run build` (auto-detected)
   * **Output Directory**: `dist` (auto-detected)
   * **Install Command**: `npm install` (auto-detected)
4. Under **Environment Variables**, add:
   | Key | Value | Example |
   | --- | --- | --- |
   | `VITE_API_BASE_URL` | Your Render Backend URL | `https://digit-recognition-backend.onrender.com` |
5. Click **Deploy**.
6. Vercel builds the bundle and serves it via Edge CDN with instant routing enabled by `frontend/vercel.json`.
7. Copy your deployed frontend URL (e.g., `https://digit-recognition-system.vercel.app`).

---

### Phase 4: Production CORS Lockdown

Once both services are deployed:
1. Go back to your [Render Dashboard](https://dashboard.render.com/) > Select `digit-recognition-backend` > **Environment**.
2. Update `ALLOWED_ORIGINS`:
   ```env
   ALLOWED_ORIGINS=https://<your-project>.vercel.app,http://localhost:5173
   ```
3. Click **Save Changes**. Render will automatically trigger a zero-downtime redeploy with strict origin validation enabled.

---

### Phase 5: Production Verification Checklist

| Step | Verification Check | Expected Result |
| --- | --- | --- |
| 1 | Navigate to `https://<your-project>.vercel.app` | UI loads instantly with dark glassmorphism theme |
| 2 | Check Navbar Status Badge | Displays green indicator: "Backend Online • CNN Model Active" |
| 3 | Draw digit 7 on Canvas & Click "Recognize Digit" | Digit 7 predicted with high confidence (>95%) and 28x28 centered preview shown |
| 4 | Switch to Webcam Tab | Camera stream renders with green digit alignment target reticle |
| 5 | Click Model Performance Tab | Test Accuracy displays 99.29% and Confusion Matrix heatmap renders |
| 6 | Open Gemini AI Assistant drawer | Asks a question and receives an AI handwriting explanation via Gemini 2.5 Flash |

---

## Troubleshooting & FAQ

### 1. `ImportError: DLL load failed while importing _pywrap_tensorflow_internal`
* Ensure the Microsoft Visual C++ 2015–2022 Redistributable (x64) is installed on your Windows machine.

### 2. Canvas predicts the wrong digit
* Draw the digit clearly in the center of the drawing area.
* Ensure standard digit shapes (e.g., crossbars on '7' or loops on '8').
* Check the **Processed 28×28** preview to see the exact input the neural network received.

### 3. Webcam camera access blocked
* Check your browser permissions and allow camera access for `http://127.0.0.1:5173`.
* Hold up a white paper with a dark, thick marker stroke inside the green target reticle box.

### 4. Gemini AI Assistant shows "Gemini API Key Required"
* Get a free API key at [Google AI Studio](https://aistudio.google.com/).
* Paste it into `backend/.env` under `GEMINI_API_KEY=AIzaSy...`.
* Restart the backend server (`python backend\app.py`).

---

## License & Credits

Developed with ❤️ using Python, TensorFlow/Keras, OpenCV, Flask, React, and Vite.
Based on the Yann LeCun MNIST database benchmark.
