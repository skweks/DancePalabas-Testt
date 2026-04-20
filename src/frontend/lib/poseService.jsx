import { Pose } from '@mediapipe/pose';

// Pin version to match package.json: 0.5.1675469404
const MP_POSE_VERSION = '0.5.1675469404';

let poseInstance = null;
let initializationPromise = null;
let processingQueue = Promise.resolve();

export async function getPoseInstance() {
  if (poseInstance) return poseInstance;
  
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve) => {
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_POSE_VERSION}/${file}`;
      },
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseInstance = pose;
    resolve(pose);
  });

  return initializationPromise;
}

/**
 * Ensures sequential execution of pose tasks to prevent WASM Module concurrency errors
 */
export async function runPoseTask(task) {
  const nextTask = processingQueue.then(async () => {
    const pose = await getPoseInstance();
    await task(pose);
  });
  
  processingQueue = nextTask.catch(() => {}); // Prevent queue from breaking on error
  return nextTask;
}