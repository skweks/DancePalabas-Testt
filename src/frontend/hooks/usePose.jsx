import { useEffect, useRef, useState } from 'react';
import { getPoseInstance, runPoseTask } from '../lib/poseService.jsx';

export function usePose() {
  const [results, setResults] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastProcessTimeRef = useRef(0);
  const MIN_FRAME_INTERVAL = 500; // Process max 2 FPS to prevent lag and errors

  useEffect(() => {
    let active = true;
    
    getPoseInstance().then(() => {
      if (active) setIsLoaded(true);
    }).catch((err) => {
      console.error("Failed to load Pose model:", err);
    });

    return () => {
      active = false;
    };
  }, []);

  const send = async (input) => {
    try {
      const now = Date.now();
      
      // Throttle frame processing to prevent memory overflow
      if (now - lastProcessTimeRef.current < MIN_FRAME_INTERVAL) {
        return;
      }
      lastProcessTimeRef.current = now;

      // Check if input is ready
      if (input.readyState === undefined || input.readyState >= 2) {
        return runPoseTask(async (pose) => {
          await new Promise((resolve) => {
            const listener = (res) => {
              if (res && res.poseLandmarks) {
                setResults(res);
              }
              resolve();
            };
            
            pose.onResults(listener);
            pose.send({ image: input }).catch((err) => {
              console.error("Pose send error:", err);
              resolve();
            });
          });
        });
      }
    } catch (err) {
      console.error("Pose processing error:", err);
    }
  };

  return { results, send, isLoaded };
}