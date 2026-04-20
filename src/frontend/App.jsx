import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Play, Pause, Upload, Link as LinkIcon, 
  Camera, Zap, Share2, RefreshCw,
  Trophy, MessageSquare, Target
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';

import { SkeletonOverlay } from './components/SkeletonOverlay.jsx';
import { calculatePoseSimilarity } from './lib/poseUtils.jsx';
import { cn } from './lib/utils.jsx';

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [aiInstruction, setAiInstruction] = useState('Select a video to begin');
  const [aiTip, setAiTip] = useState('');
  const [mode, setMode] = useState('upload');
  const [referenceKeypoints, setReferenceKeypoints] = useState([]);
  const [refResults, setRefResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [sampleVideos, setSampleVideos] = useState([]);
  
  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  // Load samples
  useEffect(() => {
    fetch('http://localhost:8000/samples')
      .then(res => res.json())
      .then(data => setSampleVideos(data.videos));
  }, []);

  // WebSocket for pose detection
  useEffect(() => {
    if (mode === 'practice') {
      wsRef.current = new WebSocket('ws://localhost:8000/ws/pose');
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.keypoints) {
          // Handle user keypoints
          comparePoses(data.keypoints);
        }
        if (data.instructions) {
          setAiInstruction(data.instructions);
        }
      };
      wsRef.current.onopen = () => {
        startWebcam();
      };
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopWebcam();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopWebcam();
    };
  }, [mode]);

  const startWebcam = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      if (webcamRef.current) {
        webcamRef.current.srcObject = streamRef.current;
      }
      captureFrame();
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const captureFrame = () => {
    if (webcamRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = webcamRef.current.videoWidth;
      canvas.height = webcamRef.current.videoHeight;
      ctx.drawImage(webcamRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      wsRef.current.send(base64);
    }
    animationRef.current = requestAnimationFrame(captureFrame);
  };

  const comparePoses = (userKeypoints) => {
    setUserResults(userKeypoints);

    if (referenceKeypoints.length > 0 && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const fps = 30; // assume
      const frameIndex = Math.floor(currentTime * fps);
      const refKeypoints = referenceKeypoints.find(k => k.frame === frameIndex)?.keypoints || [];
      setRefResults(refKeypoints);

      if (refKeypoints.length > 0) {
        const score = calculatePoseSimilarity(refKeypoints, userKeypoints);
        setCurrentScore(score);
        setScoreHistory(prev => [...prev.slice(-30), { time: prev.length, score }]);
        if (score < 80) {
          setAiTip('Try to match the pose better.');
        } else {
          setAiTip('Good job!');
        }
      }
    }
  };

  const handleVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/process_video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setReferenceKeypoints(data.keypoints_sequence || []);
      setVideoUrl(URL.createObjectURL(file));
      setIsPlaying(true);
      setAiInstruction('Video uploaded. Ready to analyze.');
    } catch (err) {
      console.error('Video upload failed:', err);
      setAiInstruction('Upload failed. Is the backend server running on localhost:8000?');
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleCamera = () => {
    setMode(mode === 'upload' ? 'practice' : 'upload');
  };

  const shareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', videoUrl);
    navigator.clipboard.writeText(url.toString());
    alert('Shareable link copied to clipboard!');
  };

  const handleUrlInput = (val) => {
    if (val.trim().startsWith('http')) {
      setVideoUrl(val.trim());
      setIsPlaying(true);
      if (mode === 'upload') {
        toggleCamera();
      }
    }
  };

  const loadDemo = (url) => {
    setVideoUrl(url);
    setIsPlaying(true);
    if (mode === 'upload') {
      toggleCamera();
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-accent/30 flex flex-col">
      {/* Header */}
      <header className="h-[64px] border-b border-border-dim px-6 flex items-center justify-between bg-surface shrink-0">
        <div className="logo flex items-center gap-2 text-[18px] font-extrabold tracking-tight">
          STEPSYNC <span className="text-accent">AI</span>
        </div>

        <div className="hidden md:flex bg-bg border border-border-dim rounded-md px-4 py-2 w-[400px] justify-between items-center text-[13px] text-text-dim">
          <input 
            type="text"
            placeholder="Paste video URL to start..."
            className="bg-transparent border-none outline-none w-full text-text-main placeholder:text-text-dim/50"
            onChange={(e) => handleUrlInput(e.target.value)}
            onPaste={(e) => {
              const pastedText = e.clipboardData.getData('text');
              handleUrlInput(pastedText);
            }}
          />
          <span className="text-accent text-[10px] font-bold tracking-wider cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap ml-2">AUTO-SYNC</span>
        </div>

        <div className="flex gap-5 text-[13px] font-medium">
          <span className="cursor-pointer hover:text-white transition-colors" onClick={() => setVideoUrl('')}>Reset</span>
          <span className={cn("cursor-pointer transition-colors", mode === 'practice' ? "text-accent" : "hover:text-white")} onClick={toggleCamera}>Practice Mode</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[1px] bg-border-dim overflow-hidden">
        {/* Left: Video Area */}
        <section className="bg-bg relative p-6 flex items-center justify-center min-h-[400px]">
          <div className="w-full h-full bg-black rounded-xl relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-border-dim/20 flex items-center justify-center">
            {!videoUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-accent-dim flex items-center justify-center animate-pulse">
                  <Play className="text-accent fill-current" size={32} />
                </div>
                <div className="space-y-4 w-[360px]">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight">Paste Dance Video URL</h3>
                    <p className="text-[11px] text-text-dim uppercase tracking-widest font-semibold">Automatic Pose Extraction & Sync Analysis</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="https://example.com/dance.mp4" 
                    className="w-full bg-bg border border-border-dim rounded-md px-4 py-4 text-[13px] font-mono focus:outline-none focus:border-accent transition-all placeholder:text-text-dim/50 shadow-inner"
                    onChange={(e) => handleUrlInput(e.target.value)}
                  />
                  
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-text-dim uppercase tracking-[0.2em] font-bold">Quick Start Demos</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => loadDemo('https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4')}
                        className="bg-surface border border-border-dim hover:border-accent/40 py-2 rounded text-[10px] font-bold transition-all"
                      >
                        SHUFFLE DANCE
                      </button>
                      <button 
                        onClick={() => loadDemo('https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4')}
                        className="bg-surface border border-border-dim hover:border-accent/40 py-2 rounded text-[10px] font-bold transition-all"
                      >
                        HIP HOP SOLO
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-border-dim hover:border-accent/50 text-text-dim hover:text-accent py-4 rounded-xl cursor-pointer transition-all text-[11px] font-black uppercase tracking-[0.2em]">
                      <Upload size={16} />
                      <span>Upload Reference</span>
                      <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover opacity-80"
                  loop
                  muted
                  playsInline
                  onLoadedData={() => { if (isPlaying) videoRef.current?.play(); }}
                />
                <SkeletonOverlay 
                  keypoints={refResults} 
                  width={720} 
                  height={1280} 
                  color="var(--color-accent)"
                  lineWidth={2}
                />
                <div className="absolute top-5 left-5 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-md text-[11px] font-medium text-red-400 backdrop-blur-sm">
                  ⚠️ REAL-TIME POSE ANALYSIS ACTIVE
                </div>
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                  <button 
                    onClick={() => {
                      const next = !isPlaying;
                      setIsPlaying(next);
                      if (next) videoRef.current?.play();
                      else videoRef.current?.pause();
                    }}
                    className={cn(
                      "w-12 h-12 rounded-md flex items-center justify-center shadow-2xl transition-all active:scale-95",
                      isPlaying ? "bg-accent text-bg" : "bg-white text-bg"
                    )}
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button 
                    onClick={() => {
                      setVideoUrl('');
                      setIsPlaying(false);
                    }}
                    className="w-12 h-12 bg-surface border border-border-dim text-white rounded-md flex items-center justify-center shadow-2xl hover:bg-bg transition-all active:scale-95"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Right: Sidebar */}
        <aside className="sidebar bg-surface flex flex-col">
          {/* Similarity Panel */}
          <div className="p-5 border-b border-border-dim">
            <div className="text-[11px] uppercase tracking-[1.5px] font-semibold text-text-dim mb-2">Real-time Comparison</div>
            <div className="w-[140px] h-[140px] rounded-full border-[6px] border-border-dim border-t-accent mx-auto my-5 flex flex-col items-center justify-center relative group">
              <div className="text-[32px] font-bold font-mono group-hover:scale-110 transition-transform">
                {currentScore.toFixed(0)}%
              </div>
              <div className="absolute -bottom-5 text-[10px] text-text-dim font-medium tracking-wider">COSINE SIMILARITY</div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-8">
              <div className="bg-bg border border-border-dim p-3 rounded-md">
                <div className="text-[9px] text-text-dim uppercase font-semibold">Timing</div>
                <div className="text-[14px] font-semibold">Excellent</div>
              </div>
              <div className="bg-bg border border-border-dim p-3 rounded-md">
                <div className="text-[9px] text-text-dim uppercase font-semibold">Posture</div>
                <div className="text-[14px] font-semibold text-yellow-500">Needs Work</div>
              </div>
            </div>
          </div>

          {/* Instructions Panel */}
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-[1.5px] font-semibold text-text-dim mb-4">Instruction Sequence</div>
            <div className="space-y-3">
              <div className="bg-bg border border-accent rounded-lg p-3 flex items-center gap-3 bg-accent-dim/20">
                <div className="font-mono text-accent text-[12px] font-bold">01</div>
                <div className="flex-1">
                  <h4 className="text-[13px] font-bold leading-tight">Move Description</h4>
                  <p className="text-[11px] text-text-dim leading-tight mt-1">{aiInstruction}</p>
                </div>
              </div>
              
              {aiTip && (
                <div className="bg-bg border border-border-dim rounded-lg p-3 flex items-start gap-3">
                  <div className="p-1 px-1.5 bg-accent-dim rounded flex items-center justify-center text-[10px] font-bold text-accent">TIP</div>
                  <div className="flex-1">
                    <p className="text-[11px] text-text-dim leading-relaxed">{aiTip}</p>
                  </div>
                </div>
              )}

              {/* Sample Static items to match the design's "move list" look */}
              <div className="bg-bg border border-border-dim rounded-lg p-3 flex items-center gap-3 opacity-40">
                <div className="font-mono text-text-dim text-[12px]">02</div>
                <div className="flex-1">
                  <h4 className="text-[13px] font-bold leading-tight">Sync Refinement</h4>
                  <p className="text-[11px] text-text-dim leading-tight">Processing next sequence...</p>
                </div>
              </div>
            </div>
          </div>

          {/* User Preview Mini-Window if in practice mode */}
          {mode === 'practice' && (
            <div className="p-5 bg-bg border-t border-border-dim">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-border-dim">
                <video 
                  ref={webcamRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <SkeletonOverlay 
                  keypoints={userResults} 
                  width={340} 
                  height={190} 
                  color="var(--color-accent)"
                  lineWidth={1}
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(76,175,80,0.5)]" />
                  Live Preview
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-[64px] bg-surface border-t border-border-dim px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-text-dim font-medium uppercase tracking-wider">
          <div className="w-1.5 h-1.5 bg-[#4CAF50] rounded-full shadow-[0_0_8px_#4CAF50]" />
          MEDIAPIPE POSE ACTIVE • {mode === 'practice' ? '30 FPS' : 'IDLE'} • 33 LANDMARKS
        </div>

        <div className="flex gap-4 items-center">
          <button className="bg-border-dim hover:bg-border-dim/80 text-white text-[12px] font-semibold py-2 px-4 rounded transition-colors uppercase tracking-wide">REPLAY</button>
          <button className="bg-accent hover:opacity-90 text-bg text-[12px] font-bold py-2 px-5 rounded transition-all transform active:scale-95 uppercase tracking-wide">RECORD PRACTICE</button>
          <button onClick={shareLink} className="bg-border-dim hover:bg-border-dim/80 text-white text-[12px] font-semibold py-2 px-4 rounded transition-colors uppercase tracking-wide">SHARE</button>
        </div>

        <div className="font-mono text-[12px] text-text-dim tracking-tight">
          00:00 / 00:00
        </div>
      </footer>
    </div>
  );
}