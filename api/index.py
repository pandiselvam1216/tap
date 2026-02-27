import os
import io
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from inference_sdk import InferenceHTTPClient
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

client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key=API_KEY
)

@app.get("/api/health")
async def health_check():
    try:
        return {"status": "online", "message": "Backend is live and connected to Roboflow"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/detect")
async def detect_faucets(image: UploadFile = File(...)):
    temp_file_path = None
    try:
        contents = await image.read()
        print(f"Received image: {image.filename}, size: {len(contents)} bytes")
        
        # Use /tmp for serverless environments
        suffix = os.path.splitext(image.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir="/tmp") as tmp:
            tmp.write(contents)
            temp_file_path = tmp.name
        
        print(f"Temporary file created at: {temp_file_path}")
            
        try:
            result = client.run_workflow(
                workspace_name=WORKSPACE_NAME,
                workflow_id=WORKFLOW_ID,
                images={
                    "image": temp_file_path
                },
                use_cache=True
            )
            print("Roboflow workflow execution successful")
            return result
        except Exception as sdk_err:
            print(f"Roboflow SDK Error: {str(sdk_err)}")
            raise HTTPException(status_code=502, detail=f"AI Model Error: {str(sdk_err)}")
            
    except Exception as e:
        print(f"CRITICAL API ERROR: {str(e)}")
        # Log the full traceback in a real production app
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
