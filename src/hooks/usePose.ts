import { useEffect, useState } from 'react';
import { Results } from '@mediapipe/pose';
import { getPoseInstance, runPoseTask } from '../lib/poseService';

export function usePose() {
  const [results, setResults] = useState<Results | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    
    getPoseInstance().then(() => {
      if (active) setIsLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const send = async (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => {
    return runPoseTask(async (pose) => {
      await new Promise<void>((resolve) => {
        const listener = (res: Results) => {
          setResults(res);
          resolve();
        };
        
        pose.onResults(listener);
        pose.send({ image: input }).catch((err) => {
          console.error("Pose send error:", err);
          resolve();
        });
      });
    });
  };

  return { results, send, isLoaded };
}
