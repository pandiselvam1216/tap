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
    try:
        contents = await image.read()
        
        # Use a more cross-platform way for temp files in serverless
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{image.filename}") as tmp:
            tmp.write(contents)
            temp_file_path = tmp.name
            
        try:
            result = client.run_workflow(
                workspace_name=WORKSPACE_NAME,
                workflow_id=WORKFLOW_ID,
                images={
                    "image": temp_file_path
                },
                use_cache=True
            )
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            
        return result

    except Exception as e:
        print(f"DETECTION ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# For local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
