from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import json
import os
import google.generativeai as genai
from typing import List, Dict
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"]
)

# Load YOLO model
model = YOLO('yolov8n-pose.pt')

# Configure Gemini
genai.configure(api_key="AIzaSyCgGihdlsVLWwsnAxg5M170RRD7YqfrFyg")
gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Sample videos
SAMPLE_VIDEOS = [
    {"name": "Basic Dance", "url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"},  # placeholder
    # Add real dance video URLs
]

# Global for keyframe detection
last_positions = None
threshold = 0.15

def is_significant_movement(current_keypoints):
    global last_positions
    if last_positions is None:
        last_positions = current_keypoints
        return True
    
    movement = 0
    # YOLO pose indices: 9,10 wrists, 15,16 ankles
    for i in [9, 10, 15, 16]:
        if i < len(current_keypoints) and i < len(last_positions):
            dist = np.linalg.norm(np.array(current_keypoints[i][:2]) - np.array(last_positions[i][:2]))
            movement += dist
    
    if movement > threshold:
        last_positions = current_keypoints
        return True
    return False

def extract_keypoints(results):
    keypoints = []
    if results and len(results) > 0:
        result = results[0]
        if hasattr(result, 'keypoints') and result.keypoints is not None:
            kpts = result.keypoints.xy.cpu().numpy()
            confs = result.keypoints.conf.cpu().numpy()
            for i, (x, y) in enumerate(kpts[0]):
                keypoints.append({
                    'x': float(x),
                    'y': float(y),
                    'confidence': float(confs[0][i])
                })
    return keypoints

@app.get("/")
def read_root():
    return {"message": "StepSync AI backend"}

@app.get("/samples")
def get_samples():
    return {"videos": SAMPLE_VIDEOS}

@app.post("/process_video")
async def process_video(file: UploadFile = File(...)):
    # Save uploaded video
    video_path = f"temp_{file.filename}"
    with open(video_path, "wb") as f:
        f.write(await file.read())
    
    # Process video
    cap = cv2.VideoCapture(video_path)
    keypoints_over_time = []
    frame_count = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1
        if frame_count % 30 == 0:  # every second at 30fps
            results = model.predict(frame, conf=0.5)
            keypoints = extract_keypoints(results)
            if keypoints:
                keypoints_over_time.append({
                    'frame': frame_count,
                    'keypoints': keypoints
                })
    
    cap.release()
    os.remove(video_path)
    
    return {"keypoints_sequence": keypoints_over_time}

@app.websocket("/ws/pose")
async def pose_websocket(websocket: WebSocket):
    await websocket.accept()
    global last_positions
    last_positions = None
    keyframes = []
    
    try:
        while True:
            data = await websocket.receive_text()
            # Expect base64 encoded frame
            frame_data = base64.b64decode(data)
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            results = model.predict(frame, conf=0.5)
            keypoints = extract_keypoints(results)
            
            if keypoints and is_significant_movement(keypoints):
                keyframes.append(keypoints)
            
            # Send back keypoints for skeleton overlay
            await websocket.send_text(json.dumps({'keypoints': keypoints}))
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # At end, generate instructions
        if keyframes:
            instructions = await generate_instructions(keyframes)
            await websocket.send_text(json.dumps({'instructions': instructions}))

async def generate_instructions(keyframes: List[List[Dict]]):
    # Prepare prompt
    prompt = "Based on these pose keypoints sequences from a dance, generate step-by-step instructions for the dance moves. Each step should describe the movement clearly.\n\n"
    for i, frame in enumerate(keyframes[:10]):  # limit to 10 keyframes
        prompt += f"Keyframe {i+1}: {json.dumps(frame)}\n"
    
    try:
        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating instructions: {str(e)}"

@app.post("/generate_instructions")
async def generate_instructions_endpoint(keyframes: List[List[Dict]]):
    return {"instructions": await generate_instructions(keyframes)}
