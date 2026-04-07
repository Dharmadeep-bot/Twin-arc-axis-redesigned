import { useMemo, useState, useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { extractPairedData } from '../../utils/dataUtils';
import { PlayIcon, PauseIcon, RefreshCwIcon, ActivityIcon, MenuIcon, InfoIcon } from './Icons';

const Plot = createPlotlyComponent(Plotly);

// KDE Helper Functions (from reference App.jsx)
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function kernelGaussian(u) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}

function silvermanBandwidth(data) {
  const n = data.length;
  if (n === 0) return 1;
  
  const mean = data.reduce((sum, x) => sum + x, 0) / n;
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  
  return 1.06 * std * Math.pow(n, -0.2);
}

function kernelDensityEstimator(kernel, X) {
  return function (V) {
    return X.map(x => V.reduce((sum, v) => sum + kernel(x - v), 0) / V.length);
  };
}

function computeKDE(data, points) {
  if (data.length < 2) return points.map(() => 0);
  
  // Optimization: sampling for large datasets during KDE
  const sampleSize = 1000;
  // Create a copy before sorting to avoid mutating the original data
  const sampledData = data.length > sampleSize 
    ? [...data].sort(() => 0.5 - Math.random()).slice(0, sampleSize)
    : data;

  const bw = silvermanBandwidth(sampledData);
  const kde = kernelDensityEstimator(
    (u) => kernelGaussian(u / bw) / bw,
    points
  );
  return kde(sampledData);
}

function KDEPlot({ dataset, xColName, yColName, themeColor }) {
  // View Mode: 'segments' or 'animation'
  const [viewMode, setViewMode] = useState('segments');
  
  // Toggle states for time segments
  const [showPrevious, setShowPrevious] = useState(true);
  const [showMid, setShowMid] = useState(true);
  const [showRecent, setShowRecent] = useState(true);

  // Animation States
  const [animationProgress, setAnimationProgress] = useState(0); // 0 to 100
  const [isPlaying, setIsPlaying] = useState(false);

  // Segment colors (Matched to reference image)
  const colors = {
    'Previous': '#22c55e', // Green
    'Mid': '#f97316',      // Orange
    'Recent': '#06b6d4'    // Cyan
  };

  const animationColor = '#8b5cf6'; // Violet for general animation

  // Animation Loop - Discrete 10 Steps
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setAnimationProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          // Increment by 10% per step
          return Math.min(prev + 10, 100);
        });
      }, 750); // 750ms per step for clear visualization
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (animationProgress >= 100) setAnimationProgress(0);
    setIsPlaying(p => !p);
  };

  const resetAnimation = () => {
    setIsPlaying(false);
    setAnimationProgress(0);
  };

  // Divide data into three time-based segments
  const segments = useMemo(() => {
    const totalRows = dataset.data.length;
    const segmentSize = Math.floor(totalRows / 3);
    
    return {
      prev: dataset.data.slice(0, segmentSize),
      mid: dataset.data.slice(segmentSize, segmentSize * 2),
      recent: dataset.data.slice(segmentSize * 2, totalRows)
    };
  }, [dataset.data]);

  // Generate Plot Data based on Mode
  const plotData = useMemo(() => {
    const traces = [];

    // --- SEGMENTS MODE ---
    if (viewMode === 'segments') {
      const segMap = [
        { name: 'Previous', data: segments.prev, color: colors['Previous'], show: showPrevious },
        { name: 'Mid', data: segments.mid, color: colors['Mid'], show: showMid },
        { name: 'Recent', data: segments.recent, color: colors['Recent'], show: showRecent }
      ];

      segMap.forEach(seg => {
        if (!seg.show || seg.data.length < 2) return;

        const paired = extractPairedData(seg.data, xColName, yColName);
        const { x, y } = paired;

        if (x.length < 2 || y.length < 2) return;

        // 1. Scatter
        traces.push({
          x, y,
          mode: 'markers',
          name: seg.name,
          type: 'scatter',
          marker: { color: seg.color, size: 4, opacity: 0.7 },
          legendgroup: seg.name,
          showlegend: false,
          xaxis: 'x',
          yaxis: 'y'
        });

        // 2. Contour
        if (x.length > 5 && x.length < 5000) {
          traces.push({
            x, y,
            type: 'histogram2dcontour',
            colorscale: [[0, 'rgba(0,0,0,0)'], [1, seg.color]],
            showscale: false,
            ncontours: 3,
            contours: { coloring: 'lines' },
            line: { width: 0.5, color: seg.color },
            legendgroup: seg.name,
            showlegend: false,
            hoverinfo: 'skip',
            xaxis: 'x',
            yaxis: 'y'
          });
        }

        // 3. Marginals
        addMarginalTraces(traces, x, y, seg.color, seg.name);
      });
    } 
    
    // --- ANIMATION MODE ---
    else {
      const totalPoints = dataset.data.length;
      const currentCount = Math.floor((animationProgress / 100) * totalPoints);
      const currentData = dataset.data.slice(0, Math.max(2, currentCount));
      
      const paired = extractPairedData(currentData, xColName, yColName);
      const { x, y } = paired;

      if (x.length >= 2) {
        // Scatter
        traces.push({
          x, y,
          mode: 'markers',
          name: 'Progression',
          type: 'scatter',
          marker: { color: animationColor, size: 4, opacity: 0.7 },
          xaxis: 'x',
          yaxis: 'y'
        });

        // Marginals (only if enough points)
        if (currentCount > 50) {
          addMarginalTraces(traces, x, y, animationColor, 'Progression');
        }
      }
    }

    return traces;
  }, [segments, xColName, yColName, showPrevious, showMid, showRecent, viewMode, animationProgress, dataset.data]);

  // Helper to add marginal traces
  function addMarginalTraces(traces, x, y, color, groupName) {
     const xMin = Math.min(...x);
     const xMax = Math.max(...x);
     const xRange = xMax - xMin || 1;
     
     const yMin = Math.min(...y);
     const yMax = Math.max(...y);
     const yRange = yMax - yMin || 1;

     const xGrid = Array.from({length: 30}, (_, i) => xMin + (xRange/30) * i);
     const yGrid = Array.from({length: 30}, (_, i) => yMin + (yRange/30) * i);

     const yDensity = computeKDE(x, xGrid);
     const xDensity = computeKDE(y, yGrid);

     traces.push({
       x: xGrid, y: yDensity,
       mode: 'lines',
       line: { color: color, width: 1 },
       fill: 'tozeroy',
       fillcolor: hexToRgba(color, 0.4),
       legendgroup: groupName,
       showlegend: false,
       hoverinfo: 'skip',
       xaxis: 'x',
       yaxis: 'y2'
     });

     traces.push({
       x: xDensity, y: yGrid,
       mode: 'lines',
       line: { color: color, width: 1 },
       fill: 'tozerox',
       fillcolor: hexToRgba(color, 0.4),
       legendgroup: groupName,
       showlegend: false,
       hoverinfo: 'skip',
       orientation: 'h',
       xaxis: 'x2',
       yaxis: 'y'
     });
  }

  // Styles
  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.06)';
  const textColor = style.getPropertyValue('--text-secondary').trim() || '#adb5bd';
  const bgColor = style.getPropertyValue('--chart-bg').trim() || 'rgba(31, 41, 64, 0.5)';

  const layout = {
    grid: { rows: 2, columns: 2, pattern: 'independent' },
    xaxis: { domain: [0, 0.82], title: xColName, gridcolor: gridColor, color: textColor },
    yaxis: { domain: [0, 0.82], title: yColName, gridcolor: gridColor, color: textColor },
    xaxis2: { domain: [0.83, 1], showgrid: false, showticklabels: false },
    yaxis2: { domain: [0.83, 1], showgrid: false, showticklabels: false },
    showlegend: false,
    paper_bgcolor: 'transparent',
    plot_bgcolor: bgColor,
    font: { color: textColor, family: 'Inter, sans-serif', size: 11 },
    autosize: true,
    hovermode: 'closest',
    margin: { l: 60, r: 10, t: 10, b: 70 }
  };

  const containerRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 340);
      }
    });
    
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Top Controls Bar */}
      <div className="kde-header-controls">
        <div className="kde-mode-tabs">
          <button 
            className={`kde-tab ${viewMode === 'segments' ? 'active' : ''}`}
            onClick={() => setViewMode('segments')}
            title="Segments"
          >
            <MenuIcon /> {!isCompact && 'Segments'}
          </button>
          <button 
            className={`kde-tab ${viewMode === 'animation' ? 'active' : ''}`}
            onClick={() => setViewMode('animation')}
            title="Animate"
          >
            <ActivityIcon /> {!isCompact && 'Animate'}
          </button>
        </div>

        {viewMode === 'segments' ? (
          <div className="kde-segment-controls">
            <button
              className={`kde-segment-btn ${showPrevious ? 'active' : ''}`}
              onClick={() => setShowPrevious(!showPrevious)}
              title="Previous"
              style={{
                borderColor: showPrevious ? colors.Previous : undefined,
                background: showPrevious ? `${colors.Previous}20` : undefined,
                color: showPrevious ? colors.Previous : undefined
              }}
            >
              {isCompact ? 'P' : 'Previous'}
            </button>
            <button
              className={`kde-segment-btn ${showMid ? 'active' : ''}`}
              onClick={() => setShowMid(!showMid)}
              title="Mid"
              style={{
                borderColor: showMid ? colors.Mid : undefined,
                background: showMid ? `${colors.Mid}20` : undefined,
                color: showMid ? colors.Mid : undefined
              }}
            >
              {isCompact ? 'M' : 'Mid'}
            </button>
            <button
              className={`kde-segment-btn ${showRecent ? 'active' : ''}`}
              onClick={() => setShowRecent(!showRecent)}
              title="Recent"
              style={{
                borderColor: showRecent ? colors.Recent : undefined,
                background: showRecent ? `${colors.Recent}20` : undefined,
                color: showRecent ? colors.Recent : undefined
              }}
            >
              {isCompact ? 'R' : 'Recent'}
            </button>
          </div>
        ) : (
          <div className="kde-anim-controls">
            <button className="icon-btn" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className="icon-btn" onClick={resetAnimation}>
              <RefreshCwIcon />
            </button>
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${animationProgress}%` }} 
              />
            </div>
            <span className="progress-text">{Math.round(animationProgress)}%</span>
          </div>
        )}
      </div>

      {/* Plot */}
      <div style={{ flex: 1, minHeight: 0, paddingBottom: '20px' }}>
        <Plot
          data={plotData}
          layout={layout}
          config={{
            displayModeBar: true,
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
}

export default KDEPlot;
