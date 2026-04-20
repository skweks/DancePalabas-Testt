/**
 * Calculates cosine similarity between two 2D vectors
 */
export function cosineSimilarity(v1, v2) {
  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

/**
 * Creates a normalized vector from start and end points
 */
export function getVector(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  
  if (mag === 0) return { x: 0, y: 0 };
  return { x: dx / mag, y: dy / mag };
}

/**
 * Key landmark indices for COCO 17 keypoints
 */
export const COMPARE_INDICES = {
  L_ARM: [5, 7, 9], // shoulder, elbow, wrist
  R_ARM: [6, 8, 10],
  L_LEG: [11, 13, 15], // hip, knee, ankle
  R_LEG: [12, 14, 16],
};

/**
 * Calculates a total similarity score between two sets of keypoints
 */
export function calculatePoseSimilarity(refKeypoints, userKeypoints) {
  if (!refKeypoints || !userKeypoints || refKeypoints.length < 17 || userKeypoints.length < 17) return 0;

  const pairs = [
    // [Shoulder, Elbow] -> Upper Arm
    [5, 7], [6, 8],
    // [Elbow, Wrist] -> Lower Arm
    [7, 9], [8, 10],
    // [Hip, Knee] -> Upper Leg
    [11, 13], [12, 14],
    // [Knee, Ankle] -> Lower Leg
    [13, 15], [14, 16],
  ];

  let totalSimilarity = 0;
  let validPairs = 0;

  pairs.forEach(([startIdx, endIdx]) => {
    const refStart = refKeypoints[startIdx];
    const refEnd = refKeypoints[endIdx];
    const userStart = userKeypoints[startIdx];
    const userEnd = userKeypoints[endIdx];

    if (refStart && refEnd && userStart && userEnd &&
        refStart.confidence > 0.5 && refEnd.confidence > 0.5 &&
        userStart.confidence > 0.5 && userEnd.confidence > 0.5) {
      
      const refVector = getVector(refStart, refEnd);
      const userVector = getVector(userStart, userEnd);
      
      const similarity = cosineSimilarity(refVector, userVector);
      totalSimilarity += similarity;
      validPairs++;
    }
  });

  if (validPairs === 0) return 0;
  return Math.round((totalSimilarity / validPairs) * 100);
}

/**
 * Formats landmarks for Gemini prompt
 */
export function landmarksToText(landmarks) {
  // We only send significant landmarks to keep the prompt small
  const focus = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  return focus.map(i => {
    const p = landmarks[i];
    return `Index ${i}: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`;
  }).join('\n');
}