import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import CanvasDrawing from './components/CanvasDrawing.jsx';
import WebcamCapture from './components/WebcamCapture.jsx';
import PredictionDisplay from './components/PredictionDisplay.jsx';
import PredictionHistory from './components/PredictionHistory.jsx';
import ModelMetrics from './components/ModelMetrics.jsx';
import GeminiAssistant from './components/GeminiAssistant.jsx';
import EducationalResources from './components/EducationalResources.jsx';
import { getApiUrl } from './config.js';
import { PenTool, Camera, Sparkles, HelpCircle, X, CheckCircle, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('recognize'); // 'recognize' | 'metrics' | 'resources'
  const [inputMode, setInputMode] = useState('canvas'); // 'canvas' | 'webcam'
  const [isPredicting, setIsPredicting] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [autoPredict, setAutoPredict] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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

  // Prediction Handler
  const handlePredict = async (imageDataUrl, source) => {
    if (!imageDataUrl) return;

    setIsPredicting(true);
    setOriginalImage(imageDataUrl);

    const endpoint = getApiUrl(source === 'webcam' ? '/api/predict/webcam' : '/api/predict');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl })
      });

      const data = await res.json();
      setCurrentPrediction(data);

      if (data.success && data.predicted_digit !== null) {
        const historyItem = {
          id: Date.now(),
          predicted_digit: data.predicted_digit,
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

  const handleSelectHistoryItem = (item) => {
    setOriginalImage(item.originalImage);
    setCurrentPrediction({
      success: true,
      predicted_digit: item.predicted_digit,
      confidence: item.confidence,
      probabilities: item.probabilities,
      processed_image: item.processed_image,
      duration_ms: item.duration_ms || 10.0
    });
    setActiveTab('recognize');
  };

  const handleClearHistory = () => {
    setHistory([]);
    showToast('Prediction history cleared.');
  };

  const handleAskGemini = (predictionContext) => {
    setIsAssistantOpen(true);
  };

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
                    {inputMode}
                  </span>
                </div>

                {/* Active Input Component */}
                {inputMode === 'canvas' ? (
                  <CanvasDrawing
                    onPredict={(dataUrl) => handlePredict(dataUrl, 'canvas')}
                    isPredicting={isPredicting}
                    autoPredict={autoPredict}
                    setAutoPredict={setAutoPredict}
                  />
                ) : (
                  <WebcamCapture
                    onPredict={(dataUrl) => handlePredict(dataUrl, 'webcam')}
                    isPredicting={isPredicting}
                  />
                )}
              </div>

              {/* Right Column: Prediction Results & Probabilities */}
              <div className="lg:col-span-7">
                <PredictionDisplay
                  prediction={currentPrediction}
                  originalImage={originalImage}
                  onAskGemini={handleAskGemini}
                  isPredicting={isPredicting}
                />
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

        {/* Tab 2: Model Performance & Metrics */}
        {activeTab === 'metrics' && <ModelMetrics />}

        {/* Tab 3: Educational Resources & Public References */}
        {activeTab === 'resources' && <EducationalResources />}
      </main>

      {/* Gemini AI Assistant Drawer */}
      <GeminiAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        activePrediction={currentPrediction}
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
              <span>Real-Time Handwritten Digit Recognition</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              This system uses a Deep Convolutional Neural Network (CNN) trained on the MNIST handwritten digit benchmark (60,000 training images, 10,000 test images) to classify digits 0 through 9 in real time with high accuracy.
            </p>

            <div className="space-y-3 text-xs text-slate-400 mb-6">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-1">Preprocessing Pipeline (LeCun Protocol):</strong>
                1. Grayscale & polarity normalization (digit is always bright on dark background).<br />
                2. Non-zero bounding box cropping preserving aspect ratio.<br />
                3. Scaling into a 20×20 box placed inside 28×28.<br />
                4. Shifting center of mass of pixel intensities to center (13.5, 13.5).
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-1">Gemini AI Assistant Integration:</strong>
                Powered by the official Google Gen AI SDK. Ask questions regarding handwriting tips, convolutional features, or probability distributions without exposing keys to the frontend.
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
        Handwritten Digit Recognition System &copy; {new Date().getFullYear()} &bull; Built with TensorFlow/Keras, OpenCV, Flask & React Vite
      </footer>
    </div>
  );
}
