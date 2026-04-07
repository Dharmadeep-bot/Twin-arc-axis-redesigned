import { useMemo, useCallback, useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

const Plot = createPlotlyComponent(Plotly);

function TimeSeriesChart({ 
  data, 
  column, 
  timestampColumn, 
  maxPoints = 5000,
  height = 280 
}) {
  // Track theme changes to trigger re-render
  const [themeVersion, setThemeVersion] = useState(0);
  
  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          setThemeVersion(prev => prev + 1);
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);
  
  // Get chart colors from CSS variables
  const getChartColors = useCallback(() => {
    // We must query the isolated container, not the global root, because our variables are scoped.
    const container = document.querySelector('.main-app-iso') || document.documentElement;
    const style = getComputedStyle(container);
    return {
      fill: style.getPropertyValue('--chart-fill').trim() || 'rgba(67, 97, 238, 0.2)',
      line: style.getPropertyValue('--chart-line').trim() || 'rgba(67, 97, 238, 0.8)',
      marker: style.getPropertyValue('--chart-marker').trim() || 'rgba(67, 97, 238, 0.6)',
      grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.06)',
      bg: style.getPropertyValue('--chart-bg').trim() || 'rgba(31, 41, 64, 0.5)',
      textColor: style.getPropertyValue('--text-secondary').trim() || '#adb5bd',
      mutedColor: style.getPropertyValue('--text-muted').trim() || '#6c757d'
    };
  }, []);

  const plotData = useMemo(() => {
    if (!data || data.length === 0 || !column || !timestampColumn) {
      return { traces: [], layout: {} };
    }

    const colors = getChartColors();
    const lineColor = colors.line;
    const fillColor = colors.fill;

    // First, extract and pair timestamp + value, filtering invalid entries
    const pairedData = [];
    for (const row of data) {
      const timestamp = row[timestampColumn];
      const value = parseFloat(row[column]);
      
      if (timestamp !== null && timestamp !== undefined && !isNaN(value) && isFinite(value)) {
        pairedData.push({ timestamp, value });
      }
    }
    
    // Sort by timestamp to ensure proper time order
    pairedData.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      // If dates are invalid, compare as strings
      if (isNaN(timeA) || isNaN(timeB)) {
        return String(a.timestamp).localeCompare(String(b.timestamp));
      }
      return timeA - timeB;
    });
    
    // Use full dataset (no downsampling) as requested
    const sampledData = pairedData;
    
    // Extract sorted x and y values
    const xValues = sampledData.map(d => d.timestamp);
    const yValues = sampledData.map(d => d.value);

    const traces = [{
      type: 'scatter', // Changed from scattergl to scatter to avoid WebGL context limits
      mode: 'lines',
      x: xValues,
      y: yValues,
      line: {
        color: lineColor,
        width: 1.5,
        shape: 'linear'
      },
      fill: 'tozeroy',
      fillcolor: fillColor,
      hovertemplate: `<b>${column}</b><br>Time: %{x}<br>Value: %{y:.4f}<extra></extra>`,
      showlegend: false
    }];

    const layout = {
      showlegend: false,
      paper_bgcolor: 'transparent',
      plot_bgcolor: colors.bg,
      font: { color: colors.textColor, family: 'Inter, sans-serif', size: 10 },
      margin: { t: 10, r: 20, b: 40, l: 60 },
      hovermode: 'x unified',
      xaxis: {
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        showticklabels: true,
        tickfont: { size: 9, color: colors.mutedColor },
        title: {
          text: '',
          font: { size: 10, color: colors.mutedColor }
        }
      },
      yaxis: {
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: true,
        zerolinecolor: colors.grid,
        showticklabels: true,
        tickfont: { size: 9, color: colors.mutedColor },
        title: {
          text: '',
          font: { size: 10, color: colors.mutedColor }
        }
      }
    };

    return { traces, layout };
  }, [data, column, timestampColumn, maxPoints, getChartColors, themeVersion]);

  if (!column || !timestampColumn || plotData.traces.length === 0) {
    return (
      <div className="timeseries-chart-empty">
        <span>No data available for {column}</span>
      </div>
    );
  }

  return (
    <div className="timeseries-chart" style={{ height }}>
      <div className="timeseries-chart-header">
        <h4 className="timeseries-chart-title">{column}</h4>
      </div>
      <div className="timeseries-chart-content">
        <Plot
          data={plotData.traces}
          layout={{
            ...plotData.layout,
            autosize: true
          }}
          config={{
            displayModeBar: true,
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>
    </div>
  );
}

export default TimeSeriesChart;
