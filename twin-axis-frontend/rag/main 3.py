from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import numpy as np
import scipy.stats
import json
import io
import PyPDF2
from rag import add_to_vectorstore, analyze_with_rag

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.post("/upload_pdf")
def upload_pdf(file: UploadFile):
    content = file.file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    add_to_vectorstore(text)
    return {"message": "PDF processed and added to knowledge base"}

class AnalyzeRequest(BaseModel):
    x_column: str
    y_column: str
    x_name: str
    y_name: str
    data: List[Dict[str, Any]]

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    df = pd.DataFrame(req.data)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    x = df[req.x_column]
    y = df[req.y_column]
    
    row_count = len(df)
    
    # Correlation (Pearson)
    corr, _ = scipy.stats.pearsonr(x, y)
    
    # Linear regression slope
    slope, intercept = np.polyfit(x, y, 1)
    
    # Trend
    if abs(corr) > 0.7:
        strength = "strong"
    elif abs(corr) > 0.3:
        strength = "moderate"
    else:
        strength = "weak"
    direction = "positive" if slope > 0 else "negative"
    trend = f"{strength} {direction} linear"
    
    # Distributions
    x_skew = scipy.stats.skew(x)
    y_skew = scipy.stats.skew(y)
    x_dist = "normal" if abs(x_skew) < 0.5 else ("left skewed" if x_skew < 0 else "right skewed")
    y_dist = "normal" if abs(y_skew) < 0.5 else ("left skewed" if y_skew < 0 else "right skewed")
    
    # Outliers (IQR on y)
    Q1 = y.quantile(0.25)
    Q3 = y.quantile(0.75)
    IQR = Q3 - Q1
    outliers = ((y < (Q1 - 1.5 * IQR)) | (y > (Q3 + 1.5 * IQR)))
    outliers_count = int(outliers.sum())
    
    # Anomaly ranges (dates of outliers)
    outlier_dates = df[outliers]['timestamp'].dt.strftime('%Y-%m-%d %H:%M').unique()
    anomaly_ranges = list(outlier_dates)
    
    # Daily summary
    df['date'] = df['timestamp'].dt.date
    daily = df.groupby('date').agg({req.x_column: ['mean', 'std'], req.y_column: ['mean', 'std']})
    daily_summary = {}
    overall_x_mean = x.mean()
    overall_y_std = y.std()
    for date, row in daily.iterrows():
        x_mean, x_std, y_mean, y_std = row
        x_desc = "high" if x_mean > overall_x_mean else "low"
        y_desc = "stable" if y_std < overall_y_std else "variable"
        daily_summary[str(date)] = f"{x_desc} {req.x_column.lower()}, {y_desc} {req.y_column.lower()}"
    
    result = {
        "x": req.x_name,
        "y": req.y_name,
        "row_count": row_count,
        "correlation": round(corr, 2),
        "trend": trend,
        "slope": round(slope, 2),
        "x_distribution": x_dist,
        "y_distribution": y_dist,
        "outliers_count": outliers_count,
        "anomaly_ranges": anomaly_ranges,
        "daily_summary": daily_summary
    }
    
    # Call RAG for insights
    query = f"""
You are an industrial data analyst AI.

The following JSON contains statistical analysis between two process variables
derived from user-uploaded production data.

Your task:
1. Explain the relationship between X and Y in simple business language
2. Highlight any anomalies or risks
3. Provide actionable recommendations for operations or monitoring
4. Keep the response concise and structured

JSON analysis:
{json.dumps(result)}
"""
    rag_insights = analyze_with_rag(query)
    result["rag_insights"] = rag_insights
    # print(rag_insights)
    return {"insights": rag_insights}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main 3:app", host="0.0.0.0", port=8000, reload=True)


{
  "x_column": "oxygen_po1",
  "y_column": "oxygen_flow",
  "x_name": "Oxygen PO1",
  "y_name": "Oxygen Flow to Mixers",
  "data": [
    {"timestamp": "2023-06-15 08:00:00", "oxygen_po1": 1.0, "oxygen_flow": 0.4},
    {"timestamp": "2023-06-15 09:00:00", "oxygen_po1": 1.1, "oxygen_flow": 0.5},
    {"timestamp": "2023-06-15 10:00:00", "oxygen_po1": 1.2, "oxygen_flow": 0.6},
    {"timestamp": "2023-06-15 11:00:00", "oxygen_po1": 1.3, "oxygen_flow": 0.7},
    {"timestamp": "2023-06-15 12:00:00", "oxygen_po1": 1.4, "oxygen_flow": 0.8},
    {"timestamp": "2023-06-15 13:00:00", "oxygen_po1": 1.5, "oxygen_flow": 0.9},
    {"timestamp": "2023-06-15 14:00:00", "oxygen_po1": 1.6, "oxygen_flow": 1.0},
    {"timestamp": "2023-06-15 15:00:00", "oxygen_po1": 1.7, "oxygen_flow": 1.1},
    {"timestamp": "2023-06-15 16:00:00", "oxygen_po1": 1.8, "oxygen_flow": 1.2},
    {"timestamp": "2023-06-15 17:00:00", "oxygen_po1": 1.9, "oxygen_flow": 1.3},
    {"timestamp": "2023-06-16 08:00:00", "oxygen_po1": 2.0, "oxygen_flow": 1.4},
    {"timestamp": "2023-06-16 09:00:00", "oxygen_po1": 2.1, "oxygen_flow": 1.5},
    {"timestamp": "2023-06-16 10:00:00", "oxygen_po1": 2.2, "oxygen_flow": 1.6},
    {"timestamp": "2023-06-16 11:00:00", "oxygen_po1": 2.3, "oxygen_flow": 1.7},
    {"timestamp": "2023-06-16 12:00:00", "oxygen_po1": 2.4, "oxygen_flow": 1.8},
    {"timestamp": "2023-06-16 13:00:00", "oxygen_po1": 2.5, "oxygen_flow": 1.9},
    {"timestamp": "2023-06-16 14:00:00", "oxygen_po1": 2.6, "oxygen_flow": 2.0},
    {"timestamp": "2023-06-16 15:00:00", "oxygen_po1": 2.7, "oxygen_flow": 2.1},
    {"timestamp": "2023-06-16 16:00:00", "oxygen_po1": 2.8, "oxygen_flow": 5.0},  
    {"timestamp": "2023-06-16 17:00:00", "oxygen_po1": 2.9, "oxygen_flow": 2.3}
  ]
}