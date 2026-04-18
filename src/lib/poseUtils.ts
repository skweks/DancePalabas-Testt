
export interface Point {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type Landmark = Point;

/**
 * Calculates cosine similarity between two 3D vectors
 */
export function cosineSimilarity(v1: Point, v2: Point): number {
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

/**
 * Creates a normalized vector from start and end points
 */
export function getVector(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return { x: dx / mag, y: dy / mag, z: dz / mag };
}

/**
 * Key landmark indices for comparison
 */
export const COMPARE_INDICES = {
  L_ARM: [11, 13, 15], // shoulder, elbow, wrist
  R_ARM: [12, 14, 16],
  L_LEG: [23, 25, 27], // hip, knee, ankle
  R_LEG: [24, 26, 28],
};

/**
 * Calculates a total similarity score between two sets of landmarks
 */
export function calculatePoseSimilarity(refLandmarks: Landmark[], userLandmarks: Landmark[]): number {
  if (!refLandmarks || !userLandmarks || refLandmarks.length < 33 || userLandmarks.length < 33) return 0;

  const pairs = [
    // [Shoulder, Elbow] -> Upper Arm
    [11, 13], [12, 14],
    // [Elbow, Wrist] -> Lower Arm
    [13, 15], [14, 16],
    // [Hip, Knee] -> Upper Leg
    [23, 25], [24, 26],
    // [Knee, Ankle] -> Lower Leg
    [25, 27], [26, 28],
    // [Shoulder, Hip] -> Torso
    [11, 23], [12, 24]
  ];

  let totalSim = 0;
  for (const pair of pairs) {
    const vRef = getVector(refLandmarks[pair[0]], refLandmarks[pair[1]]);
    const vUser = getVector(userLandmarks[pair[0]], userLandmarks[pair[1]]);
    totalSim += cosineSimilarity(vRef, vUser);
  }

  return (totalSim / pairs.length) * 100; // Return as percentage
}

/**
 * Formats landmarks for Gemini prompt
 */
export function landmarksToText(landmarks: Landmark[]): string {
  // We only send significant landmarks to keep the prompt small
  const focus = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  return focus.map(i => {
    const p = landmarks[i];
    return `Index ${i}: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}`;
  }).join('\n');
}
