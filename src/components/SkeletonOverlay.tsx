import { useEffect, useRef } from 'react';
import { Results, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface Props {
  results: Results | null;
  width: number;
  height: number;
  color?: string;
  lineWidth?: number;
}

export function SkeletonOverlay({ results, width, height, color = '#00F5FF', lineWidth = 2 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !results || !results.poseLandmarks) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    // Draw connections
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: color,
      lineWidth: lineWidth,
    });

    // Draw landmarks
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FFFFFF',
      lineWidth: 1,
      radius: 3,
    });

  }, [results, width, height, color, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      width={width}
      height={height}
    />
  );
}
