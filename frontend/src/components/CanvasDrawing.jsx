import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Play, Sparkles, Sliders, ToggleLeft, ToggleRight, Hash, Square } from 'lucide-react';
import BoundingBoxOverlay from './BoundingBoxOverlay.jsx';

export default function CanvasDrawing({
  onPredict,
  isPredicting,
  autoPredict = false,
  setAutoPredict,
  mode = 'single', // 'single' | 'multi'
  setMode = null,
  multiPredictions = null,
  selectedDigitIndex = null,
  onSelectDigit = null,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [canvasInverted, setCanvasInverted] = useState(false); // false = white on black, true = black on white
  const [history, setHistory] = useState([]);
  const debounceTimerRef = useRef(null);

  const canvasWidth = mode === 'multi' ? 440 : 280;
  const canvasHeight = mode === 'multi' ? 220 : 280;

  // Initialize canvas with smooth rendering
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = canvasInverted ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setHistory([]);
  }, [canvasInverted]);

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas, mode]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-10), imageData]);
  };

  const undoLastStroke = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const newHistory = [...history];
    const previousState = newHistory.pop();
    setHistory(newHistory);
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    } else {
      clearCanvas();
    }
  };

  // Coordinates helper for mouse & touch
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    saveCanvasState();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = canvasInverted ? '#000000' : '#ffffff';

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e && e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);

    // Auto predict trigger if enabled
    if (autoPredict && hasDrawn) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        handlePredict();
      }, 450);
    }
  };

  const handlePredict = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onPredict(dataUrl, 'canvas', mode);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePredict();
      } else if (e.key === 'c' || e.key === 'C') {
        clearCanvas();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastStroke();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasDrawn, history, mode]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Canvas Top Bar: Mode Selector & Brush Options */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-400">
        {/* Mode Selector */}
        {setMode && (
          <div className="flex items-center space-x-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setMode('single')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'single'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Square className="w-3 h-3" />
              <span>Single (280×280)</span>
            </button>

            <button
              onClick={() => setMode('multi')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                mode === 'multi'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hash className="w-3 h-3" />
              <span>Multi-Digit (440×220)</span>
            </button>
          </div>
        )}

        {/* Brush Size Controls */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] text-slate-500">Brush:</span>
          {[14, 20, 28].map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                brushSize === size
                  ? 'bg-brand-600 text-white border-brand-500 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={`Brush ${size}px`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: `${size / 3.5}px`, height: `${size / 3.5}px` }}
              />
            </button>
          ))}
        </div>

        {/* Invert & Auto-predict */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCanvasInverted(!canvasInverted)}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors text-slate-300 text-[11px]"
            title="Toggle between Black-on-White or White-on-Black drawing"
          >
            {canvasInverted ? 'Black/White' : 'White/Black'}
          </button>

          {setAutoPredict && (
            <button
              onClick={() => setAutoPredict(!autoPredict)}
              className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors text-[11px] ${
                autoPredict
                  ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
              }`}
              title="Automatically run prediction 450ms after drawing"
            >
              {autoPredict ? <ToggleRight className="w-3.5 h-3.5 text-brand-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Auto</span>
            </button>
          )}
        </div>
      </div>

      {/* Drawing Canvas Frame with Responsive Scaling */}
      <div className="relative group p-1.5 rounded-2xl bg-gradient-to-b from-slate-700/50 via-slate-800/30 to-slate-900/60 shadow-2xl border border-slate-700/60 max-w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="digit-canvas rounded-xl shadow-inner bg-black cursor-crosshair border border-slate-800 block"
          style={{
            width: `${canvasWidth}px`,
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: `${canvasWidth} / ${canvasHeight}`
          }}
        />

        {/* Bounding Box Overlay for Multi-Digit Mode */}
        {mode === 'multi' && multiPredictions && multiPredictions.length > 0 && (
          <BoundingBoxOverlay
            sourceDimensions={{ width: canvasWidth, height: canvasHeight }}
            predictions={multiPredictions}
            selectedDigitIndex={selectedDigitIndex}
            onSelectDigit={onSelectDigit}
          />
        )}

        {/* Center Guide Grid (in single digit mode) */}
        {mode === 'single' && (
          <div className="pointer-events-none absolute inset-2.5 flex items-center justify-center opacity-15">
            <div className="w-48 h-48 border border-dashed border-indigo-400 rounded-lg flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
            </div>
          </div>
        )}

        {/* Empty canvas hint */}
        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs select-none">
            <p className="font-medium text-slate-400">
              {mode === 'multi' ? 'Draw multiple digits (e.g. 5072)' : 'Draw a digit (0-9) here'}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">Mouse, trackpad, or stylus</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-[340px] grid grid-cols-3 gap-2 mt-4">
        <button
          onClick={clearCanvas}
          disabled={!hasDrawn && history.length === 0}
          className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 active:bg-slate-900 text-slate-300 text-xs font-medium border border-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Clear Canvas (Hotkey: C)"
        >
          <Eraser className="w-3.5 h-3.5 text-rose-400" />
          <span>Clear</span>
        </button>

        <button
          onClick={undoLastStroke}
          disabled={history.length === 0}
          className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 active:bg-slate-900 text-slate-300 text-xs font-medium border border-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo Stroke (Ctrl+Z)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Undo</span>
        </button>

        <button
          onClick={handlePredict}
          disabled={isPredicting || !hasDrawn}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:from-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Run DigitVision Inference (Hotkey: Enter)"
        >
          {isPredicting ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{mode === 'multi' ? 'Segment & Predict' : 'Predict'}</span>
        </button>
      </div>

      {/* Tips footer */}
      <p className="text-[11px] text-slate-500 mt-2 text-center">
        Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">Enter</kbd> to predict, <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">C</kbd> to clear
      </p>
    </div>
  );
}
