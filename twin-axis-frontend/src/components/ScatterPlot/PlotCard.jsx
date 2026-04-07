import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { 
  downsampleData, 
  extractPairedData, 
  extractColumnData, 
  computeKDE 
} from '../../utils/dataUtils';
import { XIcon, EditIcon, ChartIcon, ActivityIcon, MessageSquareIcon, ChevronDownIcon, ResizeIcon } from './Icons';
import KDEPlot from './KDEPlot';
import { useDebouncedResize } from '../../hooks/useResize';

const Plot = createPlotlyComponent(Plotly);

function PlotCard({ cell, dataset, maxPoints, onRemove, themeVersion }) {
  const { row, col } = cell;
  const xColName = dataset.selectedColumns[col];
  const yColName = dataset.selectedColumns[row];
  const isDiagonal = row === col;
  
  // Memoize sampled data so it doesn't change on theme re-renders
  const sampledData = useMemo(() => 
    downsampleData(dataset.data, maxPoints),
    [dataset.data, dataset.id, maxPoints]
  );
  
  // Note-taking state
  const [showNotes, setShowNotes] = useState(false);
  
  // Details dropdown state (closed by default)
  const [showDetails, setShowDetails] = useState(false);
  
  // KDE view state
  const [showKDE, setShowKDE] = useState(false);
  
  // Track when to trigger Plotly relayout (only after resize settles)
  const [plotKey, setPlotKey] = useState(0);
  
  // Use debounced resize hook for optimized performance with skeleton mode
  const {
    dimensions: cardDimensions,
    isResizing,
    isSettling,
    showSkeleton,
    handlers: resizeHandlers
  } = useDebouncedResize(
    { width: 350, height: 500 },
    {
      debounceDelay: 300,
      minDimensions: { width: 280, height: 350 },
      maxDimensions: { width: 800, height: 900 },
      useSkeleton: true, // Enable skeleton mode for better performance
      onResizeSettle: () => {
        // Increment key to trigger Plotly relayout after resize stops
        setPlotKey(prev => prev + 1);
      }
    }
  );
  
  const cardRef = useRef(null);
  
  // AI Chatbot state
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  
  const noteKey = `plot-note-${dataset.id}-${row}-${col}`;
  const [note, setNote] = useState(() => {
    return localStorage.getItem(noteKey) || '';
  });

  // Save note to localStorage whenever it changes
  useEffect(() => {
    if (note) {
      localStorage.setItem(noteKey, note);
    } else {
      localStorage.removeItem(noteKey);
    }
  }, [note, noteKey]);
  
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
      primary: style.getPropertyValue('--chart-primary').trim() || '#4361ee'
    };
  }, []);
  
  const chartColors = getChartColors();
  
  // Function to fetch AI insights
  const fetchAIInsights = async () => {
    if (!isDiagonal) {
      setIsLoadingAI(true);
      setAiError('');
      
      try {
        // Prepare data in the format expected by the backend
        const requestData = {
          x_column: xColName,
          y_column: yColName,
          x_name: xColName,
          y_name: yColName,
          data: dataset.data.map(row => ({
            timestamp: row.timestamp || new Date().toISOString(),
            [xColName]: row[xColName],
            [yColName]: row[yColName]
          }))
        };
        
        // Call the FastAPI backend
        const aiHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8000'
          : `http://${window.location.hostname}:8000`;
          
        const response = await fetch(`${aiHost}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setAiInsights(result.insights || 'No insights available.');
      } catch (error) {
        console.error('Error fetching AI insights:', error);
        const aiHostMsg = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8000'
          : `http://${window.location.hostname}:8000`;
        setAiError(`Failed to fetch AI insights. Make sure the backend server is running on ${aiHostMsg}`);
      } finally {
        setIsLoadingAI(false);
      }
    }
  };
  
  // Fetch AI insights when chatbot is toggled on
  useEffect(() => {
    if (showAIChatbot && !aiInsights && !isDiagonal) {
      fetchAIInsights();
    }
  }, [showAIChatbot]);
  
  // Format AI insights text for better display
  const formatInsights = (text) => {
    if (!text) return null;
    
    // Split by lines
    const lines = text.split('\n');
    const formatted = [];
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        formatted.push(<br key={`br-${index}`} />);
        return;
      }
      
      // Check for headings (lines starting with **#. or **)
      if (trimmed.match(/^\*\*\d+\./)) {
        // Numbered heading like **1. Something:**
        const content = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
        formatted.push(
          <h3 key={index} className="ai-heading">
            {content}
          </h3>
        );
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        // Bold heading
        const content = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
        formatted.push(
          <h4 key={index} className="ai-subheading">
            {content}
          </h4>
        );
      } else if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
        // Bullet point
        const content = trimmed.replace(/^\*\s*/, '');
        // Parse inline bold text
        const parts = content.split(/(\*\*.*?\*\*)/g);
        const formattedContent = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
          }
          return part;
        });
        
        formatted.push(
          <li key={index} className="ai-bullet">
            {formattedContent}
          </li>
        );
      } else {
        // Regular paragraph with inline formatting
        const parts = trimmed.split(/(\*\*.*?\*\*)/g);
        const formattedContent = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
          }
          return part;
        });
        
        formatted.push(
          <p key={index} className="ai-paragraph">
            {formattedContent}
          </p>
        );
      }
    });
    
    return formatted;
  };

  
  let detailTrace;
  let detailLayout;
  let pointCount = 0;
  
  if (isDiagonal) {
    // Use FULL dataset for KDE, not downsampled
    const colVals = extractColumnData(dataset.data, xColName);
    pointCount = colVals.length;
    
    // Adaptive resolution based on data size
    const dataSize = dataset.data.length;
    let kdeResolution;
    if (dataSize <= 1000) {
      kdeResolution = 512;
    } else if (dataSize <= 5000) {
      kdeResolution = 256;
    } else {
      kdeResolution = 128;
    }
    
    const kde = computeKDE(colVals, kdeResolution);
    
    detailTrace = [{
      type: 'scatter',
      mode: 'lines',
      x: kde.x,  // Variable values on X-axis
      y: kde.y,  // Density on Y-axis
      fill: 'tozeroy',
      fillcolor: chartColors.fill,
      line: { color: chartColors.line, width: 2 },
      hovertemplate: `${xColName}: %{x:.3f}<br>Density: %{y:.4f}<extra></extra>`
    }];
    
    detailLayout = {
      xaxis: { 
        title: xColName, 
        gridcolor: chartColors.grid, 
        color: chartColors.textColor
      },
      yaxis: { 
        title: 'Density', 
        gridcolor: chartColors.grid, 
        color: chartColors.textColor,
        rangemode: 'tozero' // Start from 0
      }
    };
  } else {
    const paired = extractPairedData(sampledData, xColName, yColName);
    pointCount = paired.x.length;
    
    detailTrace = [{
      type: 'scattergl',
      mode: 'markers',
      x: paired.x,
      y: paired.y,
      marker: {
        color: chartColors.marker,
        size: 6
      },
      hovertemplate: `${xColName}: %{x:.3f}<br>${yColName}: %{y:.3f}<extra></extra>`
    }];
    
    detailLayout = {
      xaxis: { title: xColName, gridcolor: chartColors.grid, color: chartColors.textColor },
      yaxis: { title: yColName, gridcolor: chartColors.grid, color: chartColors.textColor }
    };
  }

  // Calculate plot container height dynamically
  const plotContainerHeight = cardDimensions.height - 130;

  return (
    <div 
      ref={cardRef}
      className={`plot-card ${showNotes ? 'flipped' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ 
        width: cardDimensions.width, 
        height: cardDimensions.height,
        maxWidth: '100%' // Ensure card doesn't overflow container
      }}
    >
      <div className="plot-card-inner">
        {/* Front side - Plot */}
        <div className="plot-card-front">
          <div className="plot-card-header">
            <button 
              className="plot-card-close" 
              onClick={() => onRemove(cell)} 
              title="Remove this plot"
            >
              <XIcon />
            </button>
            <div className="plot-card-title">
              {isDiagonal ? 'Distribution' : 'Scatter Plot'} Detail
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isDiagonal && (
                <>
                  <button 
                    className={`plot-card-note-btn ${showKDE ? 'active' : ''}`}
                    onClick={() => { setShowKDE(!showKDE); setShowAIChatbot(false); }} 
                    title={showKDE ? "Hide KDE" : "Show KDE"}
                  >
                    <ActivityIcon />
                  </button>
                  <button 
                    className={`plot-card-note-btn ${showAIChatbot ? 'active' : ''}`}
                    onClick={() => { setShowAIChatbot(!showAIChatbot); setShowKDE(false); }} 
                    title={showAIChatbot ? "Hide AI Insights" : "Show AI Insights"}
                  >
                    <MessageSquareIcon />
                  </button>
                </>
              )}
              <button 
                className="plot-card-note-btn" 
                onClick={() => setShowNotes(true)} 
                title="Add notes"
              >
                <EditIcon />
                {note && <span className="note-indicator" />}
              </button>
            </div>
          </div>
          <div className="detail-info-dropdown">
            <button 
              className={`detail-info-toggle ${showDetails ? 'open' : ''}`}
              onClick={() => setShowDetails(!showDetails)}
            >
              <span>Plot Details</span>
              <ChevronDownIcon className={`chevron-icon ${showDetails ? 'rotated' : ''}`} />
            </button>
            {showDetails && (
              <div className="detail-info">
                <div className="detail-info-row">
                  <span className="detail-info-label">Dataset:</span>
                  <span className="detail-info-value" title={dataset.name}>{dataset.name}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">X-axis:</span>
                  <span className="detail-info-value" title={xColName}>{xColName}</span>
                </div>
                {!isDiagonal && (
                  <div className="detail-info-row">
                    <span className="detail-info-label">Y-axis:</span>
                    <span className="detail-info-value" title={yColName}>{yColName}</span>
                  </div>
                )}
                <div className="detail-info-row">
                  <span className="detail-info-label">Data points:</span>
                  <span className="detail-info-value">{pointCount.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
          <div className="detail-plot-container" style={{ height: plotContainerHeight }}>
            {showSkeleton ? (
              /* Skeleton placeholder during resize */
              <div className="plot-card-skeleton">
                <div className="plot-card-skeleton-content">
                  <div className="skeleton-shimmer" />
                </div>
                <div className="skeleton-label">Resizing...</div>
              </div>
            ) : !isDiagonal && showKDE ? (
              <KDEPlot
                dataset={dataset}
                xColName={xColName}
                yColName={yColName}
                themeColor={chartColors.primary}
              />
            ) : !isDiagonal && showAIChatbot ? (
              <div className="ai-insights-container">
                <div className="ai-insights-header">
                  <MessageSquareIcon />
                  <span>AI Insights</span>
                </div>
                {isLoadingAI ? (
                  <div className="ai-loading">
                    <div className="ai-loading-spinner"></div>
                    <p>Analyzing data and generating insights...</p>
                  </div>
                ) : aiError ? (
                  <div className="ai-error">
                    <p>{aiError}</p>
                    <button className="ai-retry-btn" onClick={fetchAIInsights}>Retry</button>
                  </div>
                ) : (
                  <div className="ai-insights-content">
                    {formatInsights(aiInsights)}
                  </div>
                )}
              </div>
            ) : (
              <Plot
                key={plotKey}
                data={detailTrace}
                layout={{
                  ...detailLayout,
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: chartColors.bg,
                  font: { color: chartColors.textColor, family: 'Inter, sans-serif', size: 11 },
                  margin: { t: 20, r: 20, b: 50, l: 60 },
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
            )}
          </div>
          {/* Corner Resize Handle - All directions */}
          <div 
            className={`plot-card-corner-resize ${isSettling ? 'settling' : ''}`}
            {...resizeHandlers}
            title="Drag to resize"
          >
            <ResizeIcon />
          </div>
        </div>

        {/* Back side - Notes */}
        <div className="plot-card-back">
          <div className="plot-card-header">
            <button 
              className="plot-card-close" 
              onClick={() => onRemove(cell)} 
              title="Remove this plot"
            >
              <XIcon />
            </button>
            <div className="plot-card-title">Notes</div>
            <button 
              className="plot-card-note-btn" 
              onClick={() => setShowNotes(false)} 
              title="Back to plot"
            >
              <ChartIcon />
            </button>
          </div>
          <div className="plot-notes-container">
            <textarea
              className="plot-notes-textarea"
              placeholder="Add your notes here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="plot-notes-info">
              <span className="plot-notes-label">
                {dataset.name} • {xColName}{!isDiagonal && ` vs ${yColName}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlotCard;
