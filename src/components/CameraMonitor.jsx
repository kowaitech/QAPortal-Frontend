
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const CameraMonitorInner = forwardRef(function CameraMonitorInner({ onError, onStateChange }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [ok, setOk] = useState(false);
  const [motionDetected, setMotionDetected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [motionCount, setMotionCount] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  useEffect(() => {
    let stream;
    let animationFrame;
    let lastImageData;
    
    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'user'
          }, 
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setOk(true);
          setRecording(true);
          setCameraEnabled(true);
          onStateChange && onStateChange({ cameraGranted: true });
          
          // Start motion detection
          startMotionDetection();
        }
      } catch (e) {
        setOk(false);
        setCameraEnabled(false);
        onError && onError(e);
        onStateChange && onStateChange({ cameraGranted: false });
      }
    }

    function startMotionDetection() {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      function detectMotion() {
        if (!videoRef.current || !canvas || !ctx) return;
        
        // Draw current video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (lastImageData) {
          const motion = compareFrames(lastImageData.data, currentImageData.data);
          if (motion > 0.1) { // Threshold for motion detection
            setMotionDetected(true);
            setMotionCount(prev => prev + 1);
            
            // Reset motion detection after 3 seconds
            setTimeout(() => setMotionDetected(false), 3000);
          }
        }
        
        lastImageData = currentImageData;
        animationFrame = requestAnimationFrame(detectMotion);
      }
      
      detectMotion();
    }

    function compareFrames(frame1, frame2) {
      let diff = 0;
      for (let i = 0; i < frame1.length; i += 4) {
        const r1 = frame1[i];
        const g1 = frame1[i + 1];
        const b1 = frame1[i + 2];
        
        const r2 = frame2[i];
        const g2 = frame2[i + 1];
        const b2 = frame2[i + 2];
        
        const pixelDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        diff += pixelDiff;
      }
      
      return diff / (frame1.length / 4) / 765; // Normalize to 0-1
    }

    init();
    
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  // Expose snapshot capture using the component's own video element
  useImperativeHandle(ref, () => ({
    async captureSnapshotAndDescriptor() {
      if (!videoRef.current) return { dataUrl: null, descriptor: null };
      const vw = videoRef.current.videoWidth || 640;
      const vh = videoRef.current.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, vw, vh);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      return { dataUrl, descriptor: null };
    }
  }), []);

  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">
          {ok ? '📹 Camera Monitoring Active' : '❌ Camera Access Required'}
        </div>
        <div className="flex items-center gap-2">
          {recording && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-red-600">Recording</span>
            </div>
          )}
          {motionDetected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-yellow-600">Motion Detected</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Motion Warning */}
      {motionDetected && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">Please remain still during the test!</span>
          </div>
        </div>
      )}
      {!cameraEnabled && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-lg">🚫</span>
            <span className="text-sm font-medium">Enable camera to continue test</span>
          </div>
        </div>
      )}
      {/* Face detection removed intentionally */}
      
      <div className="relative">
        <video 
          ref={videoRef} 
          className="w-full h-48 bg-black rounded" 
          autoPlay 
          muted 
          playsInline 
        />
        <canvas 
          ref={canvasRef} 
          width="640" 
          height="480" 
          className="hidden"
        />
        
        {/* Motion Detection Overlay */}
        {motionDetected && (
          <div className="absolute inset-0 bg-yellow-500 bg-opacity-20 border-2 border-yellow-500 rounded flex items-center justify-center">
            <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              ⚠️ Motion Detected
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-600 space-y-1">
        <div className="font-medium text-red-600">🚫 IMPORTANT: Do not move during the test!</div>
        <div>• Camera is actively monitoring your test session</div>
        <div>• Motion detection is enabled for test integrity</div>
        <div>• Recording will continue until test completion</div>
        {motionCount > 0 && (
          <div className="text-yellow-600 font-medium">
            Motion events detected: {motionCount}
          </div>
        )}
      </div>
    </div>
  );
});

export default CameraMonitorInner;
