/**
 * Diagnostic utility to analyze dataset variance
 * Helps identify constant/zero-variance columns that may indicate data quality issues
 */

export function analyzeDatasetVariance(data, columns) {
  if (!data || data.length === 0) return [];
  
  const analysis = [];
  
  for (const col of columns) {
    const values = data
      .map(row => parseFloat(row[col]))
      .filter(v => !isNaN(v) && isFinite(v));
    
    if (values.length === 0) {
      analysis.push({
        column: col,
        status: 'no_valid_data',
        min: null,
        max: null,
        range: null,
        variance: null,
        uniqueValues: 0
      });
      continue;
    }
    
    // Calculate min, max, and unique values
    let min = values[0];
    let max = values[0];
    const uniqueSet = new Set();
    
    for (const val of values) {
      if (val < min) min = val;
      if (val > max) max = val;
      uniqueSet.add(val);
    }
    
    const range = max - min;
    const uniqueValues = uniqueSet.size;
    
    // Calculate variance
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Determine status
    let status = 'normal';
    if (uniqueValues === 1) {
      status = 'constant'; // All values identical
    } else if (uniqueValues < 5) {
      status = 'very_low_variance'; // Very few unique values
    } else if (stdDev / Math.abs(mean) < 0.01 && mean !== 0) {
      status = 'low_variance'; // Coefficient of variation < 1%
    }
    
    analysis.push({
      column: col,
      status,
      min,
      max,
      range,
      variance,
      stdDev,
      mean,
      uniqueValues,
      coefficientOfVariation: mean !== 0 ? stdDev / Math.abs(mean) : null,
      dataPoints: values.length
    });
  }
  
  return analysis;
}

/**
 * Get a summary of problematic columns
 */
export function getVarianceWarnings(analysis) {
  const warnings = [];
  
  for (const item of analysis) {
    if (item.status === 'constant') {
      warnings.push({
        column: item.column,
        severity: 'high',
        message: `Constant value: ${item.min} (no variation in ${item.dataPoints} data points)`,
        recommendation: 'Check if sensor is stuck or data is filtered incorrectly'
      });
    } else if (item.status === 'very_low_variance') {
      warnings.push({
        column: item.column,
        severity: 'medium',
        message: `Only ${item.uniqueValues} unique values in ${item.dataPoints} data points`,
        recommendation: 'May indicate data quantization or limited sensor resolution'
      });
    } else if (item.status === 'low_variance') {
      warnings.push({
        column: item.column,
        severity: 'low',
        message: `Very low variance (CV: ${(item.coefficientOfVariation * 100).toFixed(2)}%)`,
        recommendation: 'Variable shows minimal variation in current dataset'
      });
    } else if (item.status === 'no_valid_data') {
      warnings.push({
        column: item.column,
        severity: 'high',
        message: 'No valid numeric data found',
        recommendation: 'Check data format and parsing'
      });
    }
  }
  
  return warnings;
}
