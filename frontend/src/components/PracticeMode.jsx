import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil,
  RotateCcw,
  Eraser,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Flame,
  Award,
  Trophy,
  RefreshCw,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Sliders,
  ChevronRight,
  Layers,
  HelpCircle,
  Check,
  Undo2
} from 'lucide-react';
import { getApiUrl } from '../config.js';

// Predefined commonly confused pairs for Mode B
const PRACTICE_CONFUSED_PAIRS = [
  { pair: [1, 7], label: '1 vs. 7', hint: 'Vertical linearity vs. sharp top crossbar' },
  { pair: [3, 8], label: '3 vs. 8', hint: 'Open left waist vs. dual sealed loops' },
  { pair: [4, 9], label: '4 vs. 9', hint: 'Orthogonal 90° corner vs. closed circular apex' },
  { pair: [5, 6], label: '5 vs. 6', hint: 'Detached flat top cap vs. continuous spiral' },
  { pair: [0, 6], label: '0 vs. 6', hint: 'Symmetric oval vs. prominent vertical ascender' },
  { pair: [2, 7], label: '2 vs. 7', hint: 'Firm horizontal base vs. diagonal descent' }
];

export default function PracticeMode({ onOpenTutor }) {
  // Practice configuration
  const [practiceMode, setPracticeMode] = useState('single'); // 'single' | 'confused' | 'challenge'
  const [targetDigit, setTargetDigit] = useState(7);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [challengeLength, setChallengeLength] = useState(10); // 5, 10, or 20
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeTargets, setChallengeTargets] = useState([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [sessionReview, setSessionReview] = useState([]);

  // Scoring & streak state
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Drawing canvas state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState([]);

  // Evaluation outcome state
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  // Clear canvas helper
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setHistory([]);
    setEvaluationResult(null);
    setErrorNotice(null);
  }, []);

  // Generate target digit when mode or pair changes
  const pickNewTarget = useCallback(() => {
    if (practiceMode === 'single') {
      let nextDigit;
      do {
        nextDigit = Math.floor(Math.random() * 10);
      } while (nextDigit === targetDigit);
      setTargetDigit(nextDigit);
    } else if (practiceMode === 'confused') {
      const activePair = PRACTICE_CONFUSED_PAIRS[selectedPairIndex].pair;
      const chosen = activePair[Math.floor(Math.random() * activePair.length)];
      setTargetDigit(chosen);
    }
    clearCanvas();
  }, [practiceMode, selectedPairIndex, targetDigit, clearCanvas]);

  // Start / restart mixed challenge session
  const startChallengeSession = useCallback((length = challengeLength) => {
    const targets = Array.from({ length }, () => Math.floor(Math.random() * 10));
    setChallengeTargets(targets);
    setChallengeIndex(0);
    setTargetDigit(targets[0]);
    setIsSessionComplete(false);
    setSessionReview([]);
    setScore(0);
    setStreak(0);
    setAttemptsCount(0);
    setCorrectCount(0);
    clearCanvas();
  }, [challengeLength, clearCanvas]);

  // Initial load
  useEffect(() => {
    if (practiceMode === 'challenge') {
      startChallengeSession();
    } else {
      pickNewTarget();
    }
  }, [practiceMode, selectedPairIndex]);

  // Undo stroke
  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const newHistory = [...history];
    const prevState = newHistory.pop();
    setHistory(newHistory);
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
    } else {
      clearCanvas();
    }
  };

  // Canvas drawing coordinate helpers
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

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-10), currentImg]);

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = isEraser ? '#000000' : '#ffffff';

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const drawMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = (e) => {
    if (!isDrawing) return;
    e && e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  // Submit attempt for evaluation
  const handleSubmitAttempt = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isEvaluating) return;

    if (!hasDrawn) {
      setErrorNotice('Canvas is empty. Draw a digit before submitting.');
      return;
    }

    setIsEvaluating(true);
    setErrorNotice(null);

    const base64Data = canvas.toDataURL('image/png');

    try {
      const res = await fetch(getApiUrl('/api/practice/evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          target_digit: targetDigit
        })
      });

      const data = await res.json();

      if (res.ok) {
        setEvaluationResult(data);

        if (data.is_blank) {
          setErrorNotice('Blank drawing detected. No score awarded.');
          return;
        }

        const isCorrect = data.is_correct === true;
        setAttemptsCount(prev => prev + 1);

        if (isCorrect) {
          const newStreak = streak + 1;
          const pointsEarned = 100 + (newStreak * 15);
          setScore(prev => prev + pointsEarned);
          setStreak(newStreak);
          setBestStreak(prev => Math.max(prev, newStreak));
          setCorrectCount(prev => prev + 1);
        } else {
          setStreak(0);
        }

        // Record into session review if in Challenge mode
        if (practiceMode === 'challenge') {
          const reviewItem = {
            target: targetDigit,
            predicted: data.predicted_digit,
            confidence: data.confidence,
            outcome: data.outcome,
            isCorrect: isCorrect,
            preview: data.processed_image
          };
          setSessionReview(prev => [...prev, reviewItem]);
        }
      } else {
        setErrorNotice(data.error || 'Evaluation failed. Please try again.');
      }
    } catch (err) {
      setErrorNotice('Network error: Unable to reach the evaluation server.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Advance to next target in Challenge or practice
  const handleNextTarget = () => {
    if (practiceMode === 'challenge') {
      const nextIdx = challengeIndex + 1;
      if (nextIdx >= challengeTargets.length) {
        setIsSessionComplete(true);
      } else {
        setChallengeIndex(nextIdx);
        setTargetDigit(challengeTargets[nextIdx]);
        clearCanvas();
      }
    } else {
      pickNewTarget();
    }
  };

  // Pair metadata helper for Mode B
  const activePairObj = PRACTICE_CONFUSED_PAIRS[selectedPairIndex];
  const pairedDigit = activePairObj.pair.find(d => d !== targetDigit);

  return (
    <div className="space-y-6">
      {/* Practice Header & Mode Switcher */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/20">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Interactive Practice Mode</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-brand-500/10 text-brand-300 border border-brand-500/30">
                  CNN Evaluator
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Train your handwriting against our verified CNN model with real-time confidence feedback
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setPracticeMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              practiceMode === 'single'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Single Digit
          </button>
          <button
            onClick={() => setPracticeMode('confused')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              practiceMode === 'confused'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Confused Pairs
          </button>
          <button
            onClick={() => setPracticeMode('challenge')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              practiceMode === 'challenge'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mixed Challenge
          </button>
        </div>
      </div>

      {/* Main Practice Layout */}
      {!isSessionComplete ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Drawing Workspace */}
          <div className="lg:col-span-6 glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
            {/* Target Display Header */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-indigo-400 block mb-0.5">
                  Target To Draw
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-indigo-300 to-purple-300">
                    Digit {targetDigit}
                  </span>
                  {practiceMode === 'confused' && (
                    <span className="text-xs text-amber-300 font-medium">
                      (Avoid {pairedDigit})
                    </span>
                  )}
                </div>
              </div>

              {/* Mode-Specific Indicators */}
              <div className="text-right">
                {practiceMode === 'challenge' ? (
                  <div>
                    <span className="text-xs font-mono text-slate-300 font-bold">
                      {challengeIndex + 1} / {challengeTargets.length}
                    </span>
                    <p className="text-[10px] text-slate-500">Progress</p>
                  </div>
                ) : (
                  <button
                    onClick={pickNewTarget}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    title="Change Target Digit"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>New Target</span>
                  </button>
                )}
              </div>
            </div>

            {/* Confused Pairs Selector (Mode B only) */}
            {practiceMode === 'confused' && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Select Confused Pair:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRACTICE_CONFUSED_PAIRS.map((item, idx) => (
                    <button
                      key={item.label}
                      onClick={() => setSelectedPairIndex(idx)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all text-center ${
                        selectedPairIndex === idx
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                          : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Drawing Canvas Container */}
            <div className="flex flex-col items-center">
              <div className="relative border-2 border-indigo-500/40 rounded-2xl p-1 bg-black shadow-2xl">
                <canvas
                  ref={canvasRef}
                  width={280}
                  height={280}
                  onMouseDown={startDraw}
                  onMouseMove={drawMove}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={drawMove}
                  onTouchEnd={stopDraw}
                  className="rounded-xl cursor-crosshair touch-none bg-black block"
                  style={{ width: '280px', height: '280px' }}
                />
              </div>

              {/* Canvas Controls Toolbar */}
              <div className="w-full max-w-[280px] flex items-center justify-between mt-3 text-xs">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setIsEraser(false)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      !isEraser
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="Pen"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEraser(true)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isEraser
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="Eraser"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white disabled:opacity-40 transition-colors"
                    title="Undo stroke"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 font-mono">Size</span>
                  <input
                    type="range"
                    min="14"
                    max="28"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-16 accent-brand-500 cursor-pointer"
                  />
                  <button
                    onClick={clearCanvas}
                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-rose-400 transition-colors"
                    title="Clear Canvas"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Error / Blank Notice */}
            {errorNotice && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleSubmitAttempt}
                disabled={isEvaluating}
                className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50"
              >
                {isEvaluating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating Stroke...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Submit Drawing</span>
                  </>
                )}
              </button>

              {evaluationResult && (
                <button
                  onClick={handleNextTarget}
                  className="flex items-center space-x-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Score, Feedback & Tutor Integration */}
          <div className="lg:col-span-6 space-y-4">
            {/* Session Stats Banner */}
            <div className="grid grid-cols-4 gap-3">
              <div className="glass-panel p-3 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center space-x-1 text-brand-400 mb-0.5">
                  <Award className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Score</span>
                </div>
                <span className="text-xl font-mono font-black text-white">{score}</span>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Streak</span>
                </div>
                <span className="text-xl font-mono font-black text-amber-300">{streak}</span>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center space-x-1 text-indigo-400 mb-0.5">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Best</span>
                </div>
                <span className="text-xl font-mono font-black text-indigo-200">{bestStreak}</span>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Accuracy</span>
                </div>
                <span className="text-xl font-mono font-black text-emerald-300">
                  {attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Evaluation Result Feedback Card */}
            {evaluationResult && (
              <div
                className={`glass-panel p-5 rounded-2xl border transition-all space-y-4 ${
                  evaluationResult.outcome === 'correct'
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : evaluationResult.outcome === 'uncertain'
                    ? 'border-amber-500/40 bg-amber-950/20'
                    : 'border-rose-500/40 bg-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    {evaluationResult.outcome === 'correct' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : evaluationResult.outcome === 'uncertain' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-white">
                      {evaluationResult.outcome === 'correct'
                        ? 'Target Matched!'
                        : evaluationResult.outcome === 'uncertain'
                        ? 'Borderline / Uncertain Prediction'
                        : 'Misclassified Attempt'}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      evaluationResult.status === 'accepted_prediction'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {evaluationResult.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Target</span>
                    <span className="text-lg font-mono font-bold text-white">{evaluationResult.target_digit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">CNN Prediction</span>
                    <span className="text-lg font-mono font-bold text-indigo-300">
                      {evaluationResult.predicted_digit !== null ? evaluationResult.predicted_digit : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Confidence</span>
                    <span className="text-lg font-mono font-bold text-emerald-300">
                      {(evaluationResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {evaluationResult.feedback}
                </p>

                {/* Top alternative candidate if ambiguous */}
                {evaluationResult.top_candidates && evaluationResult.top_candidates.length > 1 && (
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-semibold text-slate-300">Runner-Up Alternative:</span>
                    <span className="font-mono text-indigo-300">
                      Digit {evaluationResult.top_candidates[1].digit} ({(evaluationResult.top_candidates[1].confidence * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}

                {/* Tutor Advice Button */}
                {onOpenTutor && (
                  <button
                    onClick={() => {
                      onOpenTutor({
                        predicted_digit: evaluationResult.predicted_digit,
                        comparison_digit: evaluationResult.target_digit,
                        confidence: evaluationResult.confidence,
                        probabilities: evaluationResult.probabilities
                      });
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all shadow-sm"
                  >
                    <GraduationCap className="w-4 h-4 text-indigo-400" />
                    <span>Consult Handwriting Tutor for Stroke Rules</span>
                  </button>
                )}
              </div>
            )}

            {/* Educational Disclaimer */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start space-x-2.5">
              <HelpCircle className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200">How Scoring & Recognition Work: </span>
                Our CNN classifies digits using statistical pattern matching against the MNIST benchmark. An accepted classification requires confidence $\ge$ 75% and margin $\ge$ 15%.
                <span className="block text-slate-500 mt-1">
                  Note: High model confidence reflects resemblance to MNIST digits; it does not claim to objectively rate artistic handwriting aesthetics.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Session Completion Summary (Challenge Mode) */
        <div className="glass-panel rounded-2xl p-8 border border-indigo-500/40 text-center max-w-2xl mx-auto shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-amber-500/20">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">Challenge Session Complete!</h3>
            <p className="text-xs text-slate-400 mt-1">
              You completed all {challengeTargets.length} target digits in this practice run.
            </p>
          </div>

          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-500 block mb-1">Final Score</span>
              <span className="text-3xl font-mono font-black text-brand-400">{score}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Final Accuracy</span>
              <span className="text-3xl font-mono font-black text-emerald-400">
                {attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0}%
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Best Streak</span>
              <span className="text-3xl font-mono font-black text-amber-400">{bestStreak}</span>
            </div>
          </div>

          {/* Review Reel */}
          {sessionReview.length > 0 && (
            <div className="text-left space-y-2">
              <span className="text-xs font-semibold text-slate-300">Attempt Breakdown:</span>
              <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                {sessionReview.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-center text-xs ${
                      item.isCorrect
                        ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                    }`}
                  >
                    <div className="font-mono font-bold">Target: {item.target}</div>
                    <div className="text-[10px] text-slate-400">Saw: {item.predicted}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Restart Actions */}
          <div className="flex items-center justify-center space-x-3 pt-4">
            <button
              onClick={() => startChallengeSession()}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restart Challenge</span>
            </button>
            <button
              onClick={() => {
                setPracticeMode('single');
                setIsSessionComplete(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
            >
              Switch to Free Practice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
