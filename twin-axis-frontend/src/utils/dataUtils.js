// ============ UTILITY FUNCTIONS ============

export function getNumericColumns(data) {
  if (!data || data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  return columns.filter(col => {
    const sampleSize = Math.min(100, data.length);
    let numericCount = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const val = data[i][col];
      if (val !== null && val !== '' && val !== undefined && !isNaN(parseFloat(val))) {
        numericCount++;
      }
    }
    
    return numericCount / sampleSize > 0.8;
  });
}

/**
 * Auto-detect timestamp/datetime column from data
 * Looks for common timestamp column names and validates date format
 */
export function getTimestampColumn(data) {
  if (!data || data.length === 0) return null;
  
  const columns = Object.keys(data[0]);
  
  // Common timestamp column name patterns (case-insensitive)
  const timestampPatterns = [
    /^timestamp$/i,
    /^time$/i,
    /^datetime$/i,
    /^date$/i,
    /^created_at$/i,
    /^updated_at$/i,
    /^created$/i,
    /^modified$/i,
    /^time_?stamp$/i,
    /^date_?time$/i,
    /^ts$/i,
    /^dt$/i,
    /_timestamp$/i,
    /_time$/i,
    /_date$/i,
    /^epoch$/i,
    /^unix_?time$/i
  ];
  
  // First pass: check column names for common timestamp patterns
  for (const pattern of timestampPatterns) {
    for (const col of columns) {
      if (pattern.test(col)) {
        // Validate that this column has date-like values
        if (isLikelyTimestamp(data, col)) {
          return col;
        }
      }
    }
  }
  
  // Second pass: check all columns for date-like values
  for (const col of columns) {
    if (isLikelyTimestamp(data, col)) {
      return col;
    }
  }
  
  // Fallback: return first column (often index or time-ordered)
  return columns[0] || null;
}

/**
 * Check if a column contains timestamp-like values
 */
function isLikelyTimestamp(data, col) {
  const sampleSize = Math.min(20, data.length);
  let dateCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const val = data[i][col];
    if (val === null || val === undefined || val === '') continue;
    
    const strVal = String(val);
    
    // Check for ISO date format (2024-01-15 or 2024-01-15T10:30:00)
    if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
      dateCount++;
      continue;
    }
    
    // Check for US date format (01/15/2024 or 1/15/24)
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(strVal)) {
      dateCount++;
      continue;
    }
    
    // Check for European date format (15-01-2024 or 15.01.2024)
    if (/^\d{1,2}[-\.]\d{1,2}[-\.]\d{2,4}/.test(strVal)) {
      dateCount++;
      continue;
    }
    
    // Check for Unix timestamp (numeric, reasonable range for recent dates)
    const numVal = Number(val);
    if (!isNaN(numVal)) {
      // Unix seconds (2000-2100)
      if (numVal >= 946684800 && numVal <= 4102444800) {
        dateCount++;
        continue;
      }
      // Unix milliseconds
      if (numVal >= 946684800000 && numVal <= 4102444800000) {
        dateCount++;
        continue;
      }
    }
    
    // Try parsing as date
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1970 && parsed.getFullYear() <= 2100) {
      dateCount++;
    }
  }
  
  // If more than 60% of samples look like dates, it's likely a timestamp column
  return dateCount / sampleSize > 0.6;
}

/**
 * Stratified random sampling to preserve distribution
 * Divides data into bins and samples proportionally from each bin
 * This maintains the statistical properties of the original dataset
 */
export function downsampleData(data, maxPoints) {
  if (data.length <= maxPoints) return data;
  
  const numBins = Math.min(100, Math.ceil(maxPoints / 10)); // Use 100 bins or fewer
  const binSize = Math.ceil(data.length / numBins);
  const samplesPerBin = Math.max(1, Math.floor(maxPoints / numBins));
  
  const sampled = [];
  
  for (let binIndex = 0; binIndex < numBins; binIndex++) {
    const binStart = binIndex * binSize;
    const binEnd = Math.min((binIndex + 1) * binSize, data.length);
    const binData = data.slice(binStart, binEnd);
    
    if (binData.length === 0) continue;
    
    // Randomly sample from this bin
    const binSampleSize = Math.min(samplesPerBin, binData.length);
    const indices = new Set();
    
    while (indices.size < binSampleSize) {
      const randomIndex = Math.floor(Math.random() * binData.length);
      indices.add(randomIndex);
    }
    
    // Add sampled points from this bin
    indices.forEach(idx => sampled.push(binData[idx]));
  }
  
  // If we haven't reached maxPoints, add more random samples
  while (sampled.length < maxPoints && sampled.length < data.length) {
    const randomIndex = Math.floor(Math.random() * data.length);
    const randomPoint = data[randomIndex];
    
    // Avoid duplicates (simple check)
    if (!sampled.includes(randomPoint)) {
      sampled.push(randomPoint);
    }
  }
  
  return sampled.slice(0, maxPoints);
}

export function formatBytes(bytes) {
  const num = parseFloat(bytes);
  if (isNaN(num) || num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  if (i < 0) return num + ' B';
  return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function extractPairedData(data, xCol, yCol) {
  const xVals = [];
  const yVals = [];
  
  for (const row of data) {
    const x = parseFloat(row[xCol]);
    const y = parseFloat(row[yCol]);
    
    if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
      xVals.push(x);
      yVals.push(y);
    }
  }
  
  return { x: xVals, y: yVals };
}

export function extractColumnData(data, col) {
  return data
    .map(row => parseFloat(row[col]))
    .filter(v => !isNaN(v) && isFinite(v));
}

export function getColumnStats(values) {
  if (values.length === 0) return { min: 0, max: 1 };
  
  // Use iterative approach to avoid stack overflow with large arrays
  let min = values[0];
  let max = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  
  // Handle zero-variance (constant) variables
  if (min === max) {
    // For constant values, add ±5% padding based on absolute value
    // or ±0.5 if value is near zero
    const padding = Math.max(Math.abs(min) * 0.05, 0.5);
    return { min: min - padding, max: max + padding };
  }
  
  // Normal case: add 5% padding to range
  const padding = (max - min) * 0.05;
  return { min: min - padding, max: max + padding };
}

/**
 * Compute Kernel Density Estimation (KDE) using Gaussian kernel
 * Uses Silverman's rule for bandwidth selection (scipy default, used by seaborn)
 * Optimized with adaptive sampling for large datasets
 */
export function computeKDE(data, numPoints = 512) {
  if (data.length === 0) return { x: [], y: [] };
  
  const n = data.length;
  
  // Use iterative approach to avoid stack overflow with large arrays
  let min = data[0];
  let max = data[0];
  let sum = 0;
  
  for (let i = 0; i < n; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
    sum += data[i];
  }
  
  const range = max - min || 1;
  
  // Calculate statistics
  const mean = sum / n;
  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    varianceSum += (data[i] - mean) ** 2;
  }
  const variance = varianceSum / n;
  const std = Math.sqrt(variance);
  
  // Silverman's rule for bandwidth (scipy/seaborn default)
  const bandwidth = 1.059 * std * Math.pow(n, -0.2);
  
  // Extend range by 3 * bandwidth on each side (scipy default)
  const cut = 3 * bandwidth;
  const xMin = min - cut;
  const xMax = max + cut;
  const extendedRange = xMax - xMin;
  
  const xKDE = [];
  const yKDE = [];
  const step = extendedRange / (numPoints - 1);
  
  // For large datasets, use optimized binned approach
  if (n > 2000) {
    // Create bins for faster computation
    const numBins = Math.min(512, numPoints * 2);
    const binWidth = range / numBins;
    const bins = new Array(numBins).fill(0);
    
    // Bin the data
    for (const d of data) {
      const binIdx = Math.floor((d - min) / binWidth);
      if (binIdx >= 0 && binIdx < numBins) {
        bins[binIdx]++;
      }
    }
    
    // Compute KDE using binned data (much faster)
    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      xKDE.push(x);
      
      let density = 0;
      // Only compute for bins that have data
      for (let b = 0; b < numBins; b++) {
        if (bins[b] > 0) {
          const binCenter = min + (b + 0.5) * binWidth;
          const u = (x - binCenter) / bandwidth;
          density += bins[b] * Math.exp(-0.5 * u * u);
        }
      }
      
      density /= (n * bandwidth * Math.sqrt(2 * Math.PI));
      yKDE.push(density);
    }
  } else {
    // Direct computation for smaller datasets (more accurate)
    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      xKDE.push(x);
      
      let density = 0;
      for (const d of data) {
        const u = (x - d) / bandwidth;
        density += Math.exp(-0.5 * u * u);
      }
      
      density /= (n * bandwidth * Math.sqrt(2 * Math.PI));
      yKDE.push(density);
    }
  }
  
  return { x: xKDE, y: yKDE };
}

/**
 * Compute scaled KDE for pairplot diagonal
 * Scales the density to fit within the data range for visualization
 */
export function computeScaledKDE(data, dataMin, dataMax, numPoints = 512) {
  const kde = computeKDE(data, numPoints);
  if (kde.y.length === 0) return kde;
  
  const maxDensity = Math.max(...kde.y);
  const dataRange = dataMax - dataMin;
  
  // Scale density to fit in the plot (use 90% of range for better visualization)
  const scaledY = kde.y.map(y => dataMin + (y / maxDensity) * dataRange * 0.9);
  
  return { x: kde.x, y: scaledY };
}
