import { useEffect, useRef } from 'react';

// COCO 17 keypoints connections
const POSE_CONNECTIONS = [
  [0, 1], [0, 2], [1, 3], [2, 4], [0, 5], [0, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
];

export function SkeletonOverlay({ keypoints, width, height, color = '#00F5FF', lineWidth = 2 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !keypoints || keypoints.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    POSE_CONNECTIONS.forEach(([i, j]) => {
      if (i < keypoints.length && j < keypoints.length) {
        const p1 = keypoints[i];
        const p2 = keypoints[j];
        if (p1.confidence > 0.5 && p2.confidence > 0.5) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    });

    // Draw landmarks
    ctx.fillStyle = '#FFFFFF';
    keypoints.forEach(point => {
      if (point.confidence > 0.5) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [keypoints, width, height, color, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      width={width}
      height={height}
    />
  );
}