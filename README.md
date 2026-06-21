# FLOW Setup & Execution

## Prerequisites
- Python 3.11+
- Node.js 18+

## Backend Setup
```bash
cd backend
pip install -r requirements.txt   # Note: Also requires pandas, scikit-learn, networkx, fastapi, uvicorn, pydantic
python train_binary.py
uvicorn main:app --port 8001   # frontend expects the API on port 8001
```

## Frontend Setup
```bash
cd frontend
npm install
npm run dev -- --port 5173
```

## Running the Web App
Open your browser and navigate to:
http://localhost:5173
