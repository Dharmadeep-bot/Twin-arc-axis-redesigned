# RAG Server - Industrial Data Analysis API

A FastAPI-based server that provides statistical analysis and RAG (Retrieval-Augmented Generation) insights for industrial process data.

## Features

- **PDF Upload & Knowledge Base**: Upload PDF documents to build a knowledge base for context-aware analysis
- **Statistical Analysis**: Analyze relationships between process variables with correlation, trend analysis, and outlier detection
- **RAG-Powered Insights**: Get AI-generated insights using Google Gemini with context from uploaded documents
- **Daily Summaries**: Automatic daily aggregation and summarization of process data

## Requirements

- Python 3.8+
- Google Gemini API Key

## Installation

### 1. Create Virtual Environment

```powershell
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
.\venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 4. Set Up Environment Variables

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_actual_api_key_here
```

**Note:** You can get a Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Running the Server

### Start the server:

```powershell
# Make sure virtual environment is activated
.\venv\Scripts\Activate.ps1

# Run the server
python "main 3.py"
```

The server will start on `http://localhost:8000`

### Alternative using uvicorn directly:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### 1. Upload PDF
**POST** `/upload_pdf`

Upload a PDF document to add to the knowledge base.

**Request:**
- Content-Type: `multipart/form-data`
- Body: PDF file

**Response:**
```json
{
  "message": "PDF processed and added to knowledge base"
}
```

### 2. Analyze Data
**POST** `/analyze`

Analyze the relationship between two process variables.

**Request Body:**
```json
{
  "x_column": "oxygen_po1",
  "y_column": "oxygen_flow",
  "x_name": "Oxygen PO1",
  "y_name": "Oxygen Flow to Mixers",
  "data": [
    {
      "timestamp": "2023-06-15 08:00:00",
      "oxygen_po1": 1.0,
      "oxygen_flow": 0.4
    },
    ...
  ]
}
```

**Response:**
```json
{
  "insights": "AI-generated analysis and recommendations..."
}
```

The analysis includes:
- Correlation coefficient
- Trend analysis (strength and direction)
- Distribution analysis
- Outlier detection
- Daily summaries
- RAG-powered insights and recommendations

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
mvp 3 rag server/
├── main 3.py           # FastAPI application with endpoints
├── rag.py              # RAG implementation with LangChain
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variables template
├── .env                # Your actual environment variables (create this)
└── venv/               # Virtual environment (created during setup)
```

## Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **Pandas & NumPy**: Data processing
- **SciPy**: Statistical analysis
- **PyPDF2**: PDF processing
- **LangChain**: RAG framework
- **FAISS**: Vector database
- **Sentence Transformers**: Text embeddings
- **Google Generative AI**: LLM for insights

## Troubleshooting

### Virtual Environment Activation Issues

If you get an execution policy error on Windows:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Missing Dependencies

If you encounter import errors, ensure all dependencies are installed:
```powershell
pip install -r requirements.txt --upgrade
```

### API Key Issues

Make sure your `.env` file exists and contains a valid Google API key:
```env
GOOGLE_API_KEY=your_actual_key_here
```

## Notes

- The server uses **FAISS** for vector storage (in-memory by default)
- Uploaded PDFs are processed and stored in the vector database for RAG queries
- The AI model used is **Gemini 2.5 Flash** with temperature 0.2 for consistent analysis
- Embeddings use **sentence-transformers/all-MiniLM-L6-v2** model

## Example Usage

See the example JSON at the bottom of `main 3.py` for a sample analysis request.

You can test the API using:
- **Swagger UI** at http://localhost:8000/docs
- **Postman** or any API client
- **curl** commands
- **Python requests** library

## License

This project is for demonstration purposes.
