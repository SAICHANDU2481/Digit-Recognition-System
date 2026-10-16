import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Play, AlertCircle, Upload, CheckCircle2 } from 'lucide-react';

export default function WebcamCapture({ onPredict, isPredicting }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Stop active camera tracks safely
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsInitializing(false);
  }, [stream]);

  // Enumerate video devices
  const getCameraDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = deviceList.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Error enumerating cameras:', err);
    }
  };

  // Start webcam feed with progressive constraint fallbacks
  const startCamera = async (deviceId = null) => {
    setErrorMsg(null);
    setCapturedImage(null);
    setIsInitializing(true);

    // Stop existing stream first
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Your browser does not support webcam access via getUserMedia. Please use Chrome, Edge, or Firefox.'
        );
      }

      let mediaStream = null;
      const targetDevice = deviceId || selectedDeviceId;

      // 1. Try specific device or ideal constraints
      try {
        const constraints = {
          video: targetDevice
            ? { deviceId: { exact: targetDevice }, width: { ideal: 640 }, height: { ideal: 480 } }
            : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (idealErr) {
        console.warn('Ideal camera constraints failed, attempting fallback to generic video:', idealErr);
        // 2. Fallback to simplest generic video constraint
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      setStream(mediaStream);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => {
            console.warn('Video play interrupted:', playErr);
          });
          setIsCameraActive(true);
          setIsInitializing(false);
        };

        // Attempt immediate play as well
        videoRef.current.play().then(() => {
          setIsCameraActive(true);
          setIsInitializing(false);
        }).catch(() => {
          // Metadata handler will catch it
        });
      } else {
        setIsCameraActive(true);
        setIsInitializing(false);
      }

      // Re-enumerate devices now that permission is granted
      getCameraDevices();
    } catch (err) {
      console.error('Camera initialization error:', err);
      setIsCameraActive(false);
      setIsInitializing(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg(
          'Camera access was denied by your browser. Please click the camera/lock icon in your browser address bar and select "Allow", then click Retry.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg(
          'No camera was found on your system. You can connect a webcam, use the Drawing Canvas, or click "Upload Photo" below.'
        );
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMsg(
          'Your camera is currently in use by another app (e.g., Zoom, Teams, Skype, Discord). Please close other camera apps and click Retry.'
        );
      } else if (err.name === 'OverconstrainedError') {
        setErrorMsg('Camera does not support the requested resolution. Click Retry to use standard settings.');
      } else {
        setErrorMsg(`Camera error: ${err.message || err.name || 'Unable to access camera'}`);
      }
    }
  };

  // Sync stream to video element whenever stream changes or component mounts
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.warn);
    }
  }, [stream]);

  // Auto-start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Capture snapshot from video feed
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!video.videoWidth || !video.videoHeight) {
      alert('Camera is still initializing frames. Please wait a second and try again.');
      return;
    }

    // Focus directly on the area inside the green target reticle (~58% of center)
    // This cleanly excludes the room background, user's face, and clothing
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const reticleSize = minDim * 0.58;
    const startX = (video.videoWidth - reticleSize) / 2;
    const startY = (video.videoHeight - reticleSize) / 2;

    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');

    // Draw cropped center reticle area
    ctx.drawImage(video, startX, startY, reticleSize, reticleSize, 0, 0, 320, 320);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
  };

  // Retake snapshot and resume live camera feed
  const retakeSnapshot = () => {
    setCapturedImage(null);
    if (!isCameraActive && !stream) {
      startCamera();
    }
  };

  // Trigger digit prediction on captured photo
  const handlePredictCaptured = () => {
    if (!capturedImage) return;
    onPredict(capturedImage, 'webcam');
  };

  // Fallback: Handle photo file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 320, 320);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setCapturedImage(dataUrl);
        setErrorMsg(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hidden processing canvas & file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Camera Toolbar */}
      <div className="w-full max-w-[300px] flex items-center justify-between mb-3 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-brand-400" />
          <span className="font-medium text-slate-300">Webcam Scanner</span>
          {isCameraActive && !capturedImage && (
            <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          )}
        </div>

        {devices.length > 1 && isCameraActive && (
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              setSelectedDeviceId(e.target.value);
              startCamera(e.target.value);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-brand-500"
          >
            {devices.map((d, idx) => (
              <option key={d.deviceId || idx} value={d.deviceId}>
                {d.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Video Viewport / Capture Preview Container */}
      <div className="relative w-[280px] h-[280px] rounded-2xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-700/80 flex items-center justify-center">
        {/* The video element is ALWAYS mounted in the DOM to avoid ref detachment */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            isCameraActive && !capturedImage && !errorMsg ? 'block' : 'hidden'
          }`}
        />

        {/* Live Target Reticle Overlay */}
        {isCameraActive && !capturedImage && !errorMsg && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-40 h-40 border-2 border-dashed border-emerald-400/90 rounded-2xl relative shadow-[0_0_20px_rgba(52,211,153,0.35)]">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] text-emerald-300 font-mono whitespace-nowrap">
                Center Digit Here
              </span>
              {/* Corner target guides */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400 -mt-0.5 -ml-0.5" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400 -mt-0.5 -mr-0.5" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400 -mb-0.5 -ml-0.5" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400 -mb-0.5 -mr-0.5" />
            </div>
            <p className="text-[10px] text-slate-300 bg-slate-950/80 border border-slate-700/60 px-2 py-0.5 rounded-full mt-3">
              Hold white paper with dark digit
            </p>
          </div>
        )}

        {/* Captured Snapshot Preview */}
        {capturedImage && (
          <div className="relative w-full h-full animate-fadeIn">
            <img src={capturedImage} alt="Captured Digit" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-950/80 border border-slate-700 rounded text-[10px] text-brand-300 font-mono flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Snapshot Ready</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && !capturedImage && (
          <div className="p-4 text-center flex flex-col items-center max-w-[260px] animate-fadeIn">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-xs text-rose-300 font-semibold mb-1">Camera Notice</p>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{errorMsg}</p>
            <div className="flex flex-col space-y-2 w-full">
              <button
                onClick={() => startCamera()}
                className="w-full py-1.5 px-3 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo Instead</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading / Initializing State */}
        {isInitializing && !errorMsg && !capturedImage && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-300 font-medium">Starting Camera...</p>
            <p className="text-[11px] text-slate-500 mt-1">Please allow camera permission if prompted</p>
          </div>
        )}

        {/* Inactive Camera State (if stopped manually) */}
        {!isCameraActive && !isInitializing && !capturedImage && !errorMsg && (
          <div className="text-center p-6 flex flex-col items-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-400">
              <Camera className="w-6 h-6 text-brand-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">Webcam Scanner Ready</p>
            <p className="text-[11px] text-slate-500 mt-1 mb-4 max-w-[200px]">
              Recognize handwritten digits held up to your camera in real time.
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => startCamera()}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/30 transition-all hover:scale-105"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Start Camera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-all"
                title="Upload an image file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="w-full max-w-[280px] mt-4 flex items-center justify-center space-x-2">
        {isCameraActive && !capturedImage && (
          <>
            <button
              onClick={captureFrame}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Snapshot</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
              title="Upload photo instead"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={stopCamera}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Turn camera off"
            >
              <CameraOff className="w-4 h-4" />
            </button>
          </>
        )}

        {capturedImage && (
          <>
            <button
              onClick={retakeSnapshot}
              className="flex-1 flex items-center justify-center space-x-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retake</span>
            </button>

            <button
              onClick={handlePredictCaptured}
              disabled={isPredicting}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-40"
            >
              {isPredicting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Predict Digit</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
