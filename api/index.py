import os
import io
import base64
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Roboflow Configuration
API_KEY = "KT6nlWTC4R2PTGWZ80Pa" 
WORKSPACE_NAME = "neura-global-3e6o8"
WORKFLOW_ID = "find-faucets"

@app.get("/api/health")
async def health_check():
    return {"status": "online", "message": "Backend is live and lightweight"}

@app.post("/api/detect")
async def detect_faucets(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        print(f"DEBUG: Read image {image.filename}, size {len(contents)}")
        
        # Convert image to base64
        base64_image = base64.b64encode(contents).decode("utf-8")
        
        # Verified Roboflow Workflow API Endpoint
        url = f"https://detect.roboflow.com/infer/workflows/{WORKSPACE_NAME}/{WORKFLOW_ID}"
        
        payload = {
            "api_key": API_KEY,
            "inputs": {
                "image": base64_image
            }
        }
        
        print(f"DEBUG: Calling Roboflow at {url}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            
            json_data = response.json()
            if response.status_code != 200:
                print(f"ROBOFLOW ERROR {response.status_code}: {json_data}")
                return {"error": True, "detail": json_data}
                
            print(f"DEBUG: Roboflow Success. JSON Structure: {list(json_data.keys())}")
            if "outputs" in json_data and len(json_data["outputs"]) > 0:
                print(f"DEBUG: First Output Keys: {list(json_data['outputs'][0].keys())}")
            return json_data

    except Exception as e:
        print(f"CRITICAL API ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
