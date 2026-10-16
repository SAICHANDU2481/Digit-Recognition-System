import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import CanvasDrawing from './components/CanvasDrawing.jsx';
import WebcamCapture from './components/WebcamCapture.jsx';
import PredictionDisplay from './components/PredictionDisplay.jsx';
import MultiDigitDisplay from './components/MultiDigitDisplay.jsx';
import ExplainabilityViewer from './components/ExplainabilityViewer.jsx';
import PredictionHistory from './components/PredictionHistory.jsx';
import ModelMetrics from './components/ModelMetrics.jsx';
import GeminiAssistant from './components/GeminiAssistant.jsx';
import EducationalResources from './components/EducationalResources.jsx';
import PracticeMode from './components/PracticeMode.jsx';
import { getApiUrl } from './config.js';
import { PenTool, Camera, Sparkles, HelpCircle, X, CheckCircle, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('recognize'); // 'recognize' | 'metrics' | 'resources'
  const [inputMode, setInputMode] = useState('canvas'); // 'canvas' | 'webcam'
  const [canvasMode, setCanvasMode] = useState('multi'); // 'single' | 'multi'
  const [selectedDigitIndex, setSelectedDigitIndex] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [autoPredict, setAutoPredict] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Grad-CAM Explainability State
  const [explanationData, setExplanationData] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState(null);

  // Poll backend health
  const checkHealth = async () => {
    try {
      const res = await fetch(getApiUrl('/api/health'));
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'offline', model_loaded: false });
      }
    } catch (e) {
      setBackendHealth({ status: 'offline', model_loaded: false });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Prediction Handler (Supports Single & Multi-digit Modes)
  const handlePredict = async (imageDataUrl, source, modeOverride) => {
    if (!imageDataUrl) return;

    const isMulti = modeOverride ? modeOverride === 'multi' : canvasMode === 'multi';
    setIsPredicting(true);
    setOriginalImage(imageDataUrl);
    setSelectedDigitIndex(null);
    setExplanationData(null);
    setExplainError(null);

    let endpoint = getApiUrl('/api/predict');
    if (isMulti) {
      endpoint = getApiUrl('/api/predict/multiple');
    } else if (source === 'webcam') {
      endpoint = getApiUrl('/api/predict/webcam');
    }

    try {
      const payload = isMulti
        ? { image: imageDataUrl, is_webcam: source === 'webcam', options: { confidence_threshold: 0.75, min_margin: 0.15 } }
        : { image: imageDataUrl };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setCurrentPrediction(data);

      if (isMulti) {
        if (data.success && data.detected_digit_count > 0) {
          const historyItem = {
            id: Date.now(),
            predicted_digit: data.recognized_text,
            isMulti: true,
            recognized_text: data.recognized_text,
            confidence: data.per_digit_predictions[0]?.confidence || 0.9,
            detected_digit_count: data.detected_digit_count,
            per_digit_predictions: data.per_digit_predictions,
            originalImage: imageDataUrl,
            source: source,
            timestamp: new Date().toLocaleTimeString()
          };
          setHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
        } else if (data.status === 'blank_input') {
          showToast('Blank canvas detected. Please draw one or more digits.');
        } else if (data.status === 'segmentation_failure') {
          showToast('Segmentation could not isolate digit strokes.');
        }
      } else {
        if (data.success && data.predicted_digit !== null) {
          const historyItem = {
            id: Date.now(),
            predicted_digit: data.predicted_digit,
            isMulti: false,
            confidence: data.confidence,
            probabilities: data.probabilities,
            originalImage: imageDataUrl,
            processed_image: data.processed_image,
            source: source,
            timestamp: new Date().toLocaleTimeString()
          };
          setHistory((prev) => [historyItem, ...prev.slice(0, 19)]);
        } else if (data.is_blank) {
          showToast('Blank canvas detected. Please draw a digit.');
        }
      }
    } catch (err) {
      console.error('Prediction request failed:', err);
      setCurrentPrediction({
        success: false,
        error: 'Unable to reach backend API. Ensure Flask server is running on port 5000.',
        is_blank: false
      });
      showToast('Connection error: Is backend server running?');
    } finally {
      setIsPredicting(false);
    }
  };

  // Grad-CAM Explainability Handler
  const handleExplain = async (imageOverride = null, targetDigit = null) => {
    const targetImage = imageOverride || originalImage;
    if (!targetImage) {
      showToast('Draw or capture a digit first before requesting an explanation.');
      return;
    }

    setIsExplaining(true);
    setExplainError(null);

    try {
      const payload = {
        image: targetImage,
        is_webcam: inputMode === 'webcam',
      };
      if (targetDigit !== null && targetDigit !== undefined) {
        payload.target_digit = targetDigit;
      }

      const res = await fetch(getApiUrl('/api/explain'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setExplanationData(data);
      } else if (data.is_blank) {
        setExplanationData(data);
        showToast('Blank drawing: cannot compute Grad-CAM for empty canvas.');
      } else {
        setExplainError(data.error || 'Failed to generate Grad-CAM explanation.');
      }
    } catch (err) {
      console.error('Explain request failed:', err);
      setExplainError('Unable to connect to /api/explain. Ensure Flask server is running on port 5000.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSelectHistoryItem = (item) => {
    setOriginalImage(item.originalImage);
    if (item.isMulti) {
      setCanvasMode('multi');
      setCurrentPrediction({
        success: true,
        status: 'accepted_prediction',
        recognized_text: item.recognized_text,
        detected_digit_count: item.detected_digit_count,
        per_digit_predictions: item.per_digit_predictions,
        duration_ms: 12.0
      });
    } else {
      setCanvasMode('single');
      setCurrentPrediction({
        success: true,
        predicted_digit: item.predicted_digit,
        confidence: item.confidence,
        probabilities: item.probabilities,
        processed_image: item.processed_image,
        duration_ms: item.duration_ms || 10.0
      });
    }
    setActiveTab('recognize');
  };

  const handleClearHistory = () => {
    setHistory([]);
    showToast('Prediction history cleared.');
  };

  const handleAskGemini = (predictionContext) => {
    setIsAssistantOpen(true);
  };

  const isMultiPrediction = currentPrediction && 'per_digit_predictions' in currentPrediction;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <Navbar
        backendHealth={backendHealth}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
            <Info className="w-4 h-4 text-brand-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Tab 1: Recognition Dashboard */}
        {activeTab === 'recognize' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Input Controller (Canvas or Webcam) */}
              <div className="lg:col-span-5 glass-panel rounded-2xl p-5 shadow-xl">
                {/* Input Mode Selector */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInputMode('canvas')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        inputMode === 'canvas'
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Drawing Canvas</span>
                    </button>

                    <button
                      onClick={() => setInputMode('webcam')}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        inputMode === 'webcam'
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Webcam Scanner</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                    {inputMode} • {canvasMode}
                  </span>
                </div>

                {/* Active Input Component */}
                {inputMode === 'canvas' ? (
                  <CanvasDrawing
                    onPredict={(dataUrl, src, mode) => handlePredict(dataUrl, src, mode)}
                    isPredicting={isPredicting}
                    autoPredict={autoPredict}
                    setAutoPredict={setAutoPredict}
                    mode={canvasMode}
                    setMode={setCanvasMode}
                    multiPredictions={currentPrediction?.per_digit_predictions}
                    selectedDigitIndex={selectedDigitIndex}
                    onSelectDigit={setSelectedDigitIndex}
                  />
                ) : (
                  <WebcamCapture
                    onPredict={(dataUrl) => handlePredict(dataUrl, 'webcam', canvasMode)}
                    isPredicting={isPredicting}
                  />
                )}
              </div>

              {/* Right Column: Prediction Results, Multi-Digit Breakdown & Grad-CAM Explainability */}
              <div className="lg:col-span-7 space-y-5">
                {isMultiPrediction || canvasMode === 'multi' ? (
                  <MultiDigitDisplay
                    prediction={currentPrediction}
                    selectedDigitIndex={selectedDigitIndex}
                    onSelectDigit={setSelectedDigitIndex}
                    onAskGemini={handleAskGemini}
                    onExplainCrop={(cropB64, digit) => handleExplain(cropB64, digit)}
                  />
                ) : (
                  <PredictionDisplay
                    prediction={currentPrediction}
                    originalImage={originalImage}
                    onAskGemini={handleAskGemini}
                    onExplain={() => handleExplain()}
                    isPredicting={isPredicting}
                  />
                )}

                {/* Grad-CAM Explainability Heatmap Panel */}
                {(explanationData || isExplaining || explainError) && (
                  <ExplainabilityViewer
                    explanation={explanationData}
                    isLoading={isExplaining}
                    error={explainError}
                    onClose={() => {
                      setExplanationData(null);
                      setExplainError(null);
                    }}
                    onExplainDigit={(target) => handleExplain(null, target)}
                    onAskTutor={() => setIsAssistantOpen(true)}
                  />
                )}
              </div>
            </div>

            {/* Prediction History Reel */}
            <PredictionHistory
              history={history}
              onSelectHistory={handleSelectHistoryItem}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

        {/* Tab 2: Interactive Practice Mode */}
        {activeTab === 'practice' && (
          <PracticeMode
            onOpenTutor={(tutorContext) => {
              if (tutorContext) {
                setCurrentPrediction(tutorContext);
              }
              setIsAssistantOpen(true);
            }}
          />
        )}

        {/* Tab 3: Model Performance & Metrics */}
        {activeTab === 'metrics' && <ModelMetrics />}

        {/* Tab 4: Educational Resources & Public References */}
        {activeTab === 'resources' && <EducationalResources />}
      </main>

      {/* Gemini AI Assistant & Handwriting Tutor Drawer */}
      <GeminiAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        activePrediction={currentPrediction}
        explanationData={explanationData}
      />

      {/* Help & Architecture Information Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-slate-700 shadow-2xl relative">
            <button
              onClick={() => setIsHelpOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <span>DigitVision AI — Multi-Digit Architecture</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              DigitVision AI features an OpenCV segmentation pipeline combined with a Deep Convolutional Neural Network trained on MNIST (60,000 training, 10,000 test) capable of isolating and classifying single digits and multi-digit sequences in real time.
            </p>

            <div className="space-y-3 text-xs text-slate-400 mb-6">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-1">Multi-Digit Segmentation Pipeline:</strong>
                1. Adaptive binarization & morphological closing.<br />
                2. Connected-component analysis & stroke grouping.<br />
                3. Touching-digit separation fallback via vertical projection profile valley detection.<br />
                4. Left-to-right sorting and individual LeCun 28×28 moment-centering.<br />
                5. Confidence-aware rejection policy with runner-up margin evaluation.
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-1">Gemini AI Assistant Integration:</strong>
                Official Google Gen AI SDK integration for handwriting legibility tips and convolutional neural network explanations.
              </div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        DigitVision AI &copy; {new Date().getFullYear()} &bull; Built with TensorFlow/Keras CNN, OpenCV, Flask & React Vite
      </footer>
    </div>
  );
}

