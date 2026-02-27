import os
import io
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

@app.get("/health")
async def health_check():
    try:
        # Simple test to check if Roboflow SDK is responsive
        return {"status": "online", "message": "Backend is live and connected to Roboflow"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/detect")
async def detect_faucets(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        
        temp_file_path = f"temp_{image.filename}"
        with open(temp_file_path, "wb") as f:
            f.write(contents)
            
        result = client.run_workflow(
            workspace_name=WORKSPACE_NAME,
            workflow_id=WORKFLOW_ID,
            images={
                "image": temp_file_path
            },
            use_cache=True
        )
        
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        # Log summary for debugging without bloating logs
        if isinstance(result, list):
            print(f"Roboflow Success: {len(result)} results returned.")
        else:
            print("Roboflow Success: 1 result returned.")
            
        return result

    except Exception as e:
        print(f"DETECTION ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
