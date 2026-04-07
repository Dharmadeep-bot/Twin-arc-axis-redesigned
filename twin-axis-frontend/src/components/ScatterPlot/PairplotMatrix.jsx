import { useMemo, useCallback, useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { 
  downsampleData, 
  extractPairedData, 
  extractColumnData, 
  getColumnStats, 
  computeKDE
} from '../../utils/dataUtils';

const Plot = createPlotlyComponent(Plotly);

function PairplotMatrix({ data, selectedColumns, maxPoints, onCellClick, isResizing = false }) {
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
      textColor: style.getPropertyValue('--text-secondary').trim() || '#adb5bd'
    };
  }, []);

  const plotData = useMemo(() => {
    if (selectedColumns.length < 2) return { traces: [], layout: {} };

    // Downsample for scatter plots only, not for KDE
    const sampledData = downsampleData(data, maxPoints);
    const n = selectedColumns.length;
    const traces = [];
    const colors = getChartColors();
    
    const fillColor = colors.fill;
    const lineColor = colors.line;
    const markerColor = colors.marker;
    
    // For KDE (diagonal), use FULL data to preserve distribution
    const fullColumnData = {};
    const columnStats = {};
    const kdeData = {}; // Store KDE results for axis range calculation
    
    // Adaptive KDE resolution based on data size for performance
    const dataSize = data.length;
    let kdeResolution;
    if (dataSize <= 1000) {
      kdeResolution = 512; // High quality for small datasets
    } else if (dataSize <= 5000) {
      kdeResolution = 256; // Medium quality for medium datasets
    } else {
      kdeResolution = 128; // Lower quality for large datasets (still good visual)
    }
    
    for (const col of selectedColumns) {
      fullColumnData[col] = extractColumnData(data, col); // Use full data!
      columnStats[col] = getColumnStats(fullColumnData[col]);
      // Pre-compute KDE for diagonal cells with adaptive resolution
      const kde = computeKDE(fullColumnData[col], kdeResolution);
      kdeData[col] = kde;
    }
    
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const xColName = selectedColumns[col];
        const yColName = selectedColumns[row];
        const cellIdx = row * n + col + 1;
        const xAxisRef = cellIdx === 1 ? 'x' : `x${cellIdx}`;
        const yAxisRef = cellIdx === 1 ? 'y' : `y${cellIdx}`;
        
        if (row === col) {
          // Diagonal: KDE plot using FULL data
          const kde = kdeData[xColName]; // Use pre-computed KDE
          
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: kde.x,      // Variable values on X-axis
            y: kde.y,      // Density on Y-axis (matches seaborn)
            xaxis: xAxisRef,
            yaxis: yAxisRef,
            fill: 'tozeroy',  // Fill to zero on Y-axis
            fillcolor: fillColor,
            line: { color: lineColor, width: 1.5 },
            showlegend: false,
            name: xColName,
            hovertemplate: `${xColName}: %{x:.2f}<br>Density: %{y:.4f}<extra></extra>`,
            hoveron: 'points+fills'
          });
        } else {
          // Off-diagonal: Scatter plot using downsampled data
          const paired = extractPairedData(sampledData, xColName, yColName);
          
          traces.push({
            type: 'scattergl',
            mode: 'markers',
            x: paired.x,
            y: paired.y,
            xaxis: xAxisRef,
            yaxis: yAxisRef,
            marker: {
              color: markerColor,
              // Dynamic size based on density and grid size
              size: Math.max(1.5, (8 - n) * (maxPoints > 2000 ? 0.6 : 1))
            },
            showlegend: false,
            hovertemplate: `${xColName}: %{x:.2f}<br>${yColName}: %{y:.2f}<extra></extra>`
          });
        }
      }
    }

    const layout = {
      showlegend: false,
      paper_bgcolor: 'transparent',
      plot_bgcolor: colors.bg,
      font: { color: colors.textColor, family: 'Inter, sans-serif', size: 10 },
      margin: { t: 10, r: 10, b: 10, l: 10 },
      hovermode: 'closest'
    };

    const gap = 0.02;
    const leftMargin = 0.02;
    const bottomMargin = 0.02;
    const plotWidth = 1 - leftMargin - 0.02;
    const plotHeight = 1 - bottomMargin - 0.02;
    const cellWidth = (plotWidth - gap * (n - 1)) / n;
    const cellHeight = (plotHeight - gap * (n - 1)) / n;
    
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const cellIdx = row * n + col + 1;
        const xAxisName = cellIdx === 1 ? 'xaxis' : `xaxis${cellIdx}`;
        const yAxisName = cellIdx === 1 ? 'yaxis' : `yaxis${cellIdx}`;
        
        const xStart = leftMargin + col * (cellWidth + gap);
        const xEnd = xStart + cellWidth;
        const yEnd = 1 - bottomMargin - row * (cellHeight + gap);
        const yStart = yEnd - cellHeight;
        
        const xStats = columnStats[selectedColumns[col]];
        const yStats = columnStats[selectedColumns[row]];
        
        // X-axis uses data range (normal direction for all cells)
        layout[xAxisName] = {
          domain: [xStart, xEnd],
          range: [xStats.min, xStats.max], // Normal left-to-right
          showgrid: true,
          gridcolor: colors.grid,
          zeroline: false,
          showticklabels: false,
          anchor: cellIdx === 1 ? 'y' : `y${cellIdx}`
        };
        
        // Y-axis: use density range for diagonal, data range for off-diagonal
        if (row === col) {
          // Diagonal: Y-axis shows density (0 at bottom, max at top)
          const kde = kdeData[selectedColumns[row]];
          const maxDensity = Math.max(...kde.y);
          layout[yAxisName] = {
            domain: [yStart, yEnd],
            range: [0, maxDensity * 1.1], // 0 at bottom, max density at top
            showgrid: true,
            gridcolor: colors.grid,
            zeroline: true,
            showticklabels: false,
            anchor: cellIdx === 1 ? 'x' : `x${cellIdx}`,
            autorange: false
          };
        } else {
          // Off-diagonal: Y-axis shows data values
          layout[yAxisName] = {
            domain: [yStart, yEnd],
            range: [yStats.min, yStats.max],
            showgrid: true,
            gridcolor: colors.grid,
            zeroline: false,
            showticklabels: false,
            anchor: cellIdx === 1 ? 'x' : `x${cellIdx}`
          };
        }
      }
    }

    return { traces, layout, n };
  }, [selectedColumns, data, maxPoints, getChartColors, themeVersion]);

  // Handle native Plotly click events (more reliable than onClick prop)
  const attachClickHandler = useCallback((figure, graphDiv) => {
    if (graphDiv) {
      graphDiv.removeAllListeners('plotly_click');
      
      graphDiv.on('plotly_click', (eventData) => {
        if (eventData && eventData.points && eventData.points.length > 0) {
          const point = eventData.points[0];
          const traceIndex = point.curveNumber;
          const n = selectedColumns.length;
          const row = Math.floor(traceIndex / n);
          const col = traceIndex % n;
          
          const xLabel = selectedColumns[col];
          const yLabel = selectedColumns[row];
          
          console.log('=== Pairplot Cell Clicked ===');
          console.log('X-axis label:', xLabel);
          console.log('Y-axis label:', yLabel);
          console.log('Is diagonal:', row === col);
          console.log('=============================');
          
          onCellClick({ row, col });
        }
      });
    }
  }, [selectedColumns, onCellClick]);

  if (selectedColumns.length < 2) {
    return null;
  }

  return (
    <Plot
      data={plotData.traces}
      layout={{
        ...plotData.layout,
        autosize: true
      }}
      config={{
        displayModeBar: true,
        displaylogo: false,
        responsive: !isResizing, // Disable during resize for performance
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
      }}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler={!isResizing}
      onInitialized={(figure, graphDiv) => attachClickHandler(figure, graphDiv)}
      onUpdate={(figure, graphDiv) => attachClickHandler(figure, graphDiv)}
    />
  );
}

export default PairplotMatrix;
