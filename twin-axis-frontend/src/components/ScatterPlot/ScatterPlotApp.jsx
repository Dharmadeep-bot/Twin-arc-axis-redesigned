import { useState, useCallback, useEffect, useRef, memo } from 'react';
import Papa from 'papaparse';
import '../../ScopedMain.css';

// Import modular components
import ControlPanel from './ControlPanel';
import PairplotMatrix from './PairplotMatrix';
import TimeSeriesChart from './TimeSeriesChart';
import VisualizationTabs from './VisualizationTabs';
import DetailPanel from './DetailPanel';
import { MenuIcon, ChartIcon, ResizeIcon } from './Icons';
import { getNumericColumns, getTimestampColumn } from '../../utils/dataUtils';
import { debounce } from '../../utils/performanceUtils';

// Memoized resizable wrapper for optimal performance
const ResizablePlotWrapper = memo(function ResizablePlotWrapper({
  dataset,
  maxPoints,
  onCellClick,
  dimensions,
  onDimensionChange,
  containerResizeKey = 0
}) {
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [plotKey, setPlotKey] = useState(0);
  const prevContainerKeyRef = useRef(containerResizeKey);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startDimRef = useRef({ width: 0, height: 0 });

  // Debounced callback for when resize settles
  const debouncedSettle = useRef(
    debounce(() => {
      setShowSkeleton(false);
      setPlotKey(prev => prev + 1); // Trigger Plotly relayout
    }, 300)
  ).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => debouncedSettle.cancel();
  }, []);

  // Respond to external container resize (e.g., detail panel width change)
  useEffect(() => {
    if (prevContainerKeyRef.current !== containerResizeKey) {
      prevContainerKeyRef.current = containerResizeKey;
      // Trigger Plotly relayout when container space changes
      setPlotKey(prev => prev + 1);
    }
  }, [containerResizeKey]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    setIsResizing(true);
    setShowSkeleton(true); // Show skeleton immediately when resize starts
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startDimRef.current = {
      width: container.offsetWidth,
      height: container.offsetHeight
    };

    e.target.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isResizing) return;

    requestAnimationFrame(() => {
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      const newWidth = Math.max(400, Math.min(2000, startDimRef.current.width + deltaX));
      const newHeight = Math.max(400, Math.min(1500, startDimRef.current.height + deltaY));

      onDimensionChange(dataset.id, { width: newWidth, height: newHeight });
    });
  }, [isResizing, dataset.id, onDimensionChange]);

  const handlePointerUp = useCallback((e) => {
    setIsResizing(false);
    e.target.releasePointerCapture(e.pointerId);
    // Trigger debounced settle to hide skeleton and update plot
    debouncedSettle();
  }, [debouncedSettle]);

  // Generate skeleton grid based on selected columns
  const n = dataset.selectedColumns.length;

  return (
    <div
      ref={containerRef}
      className={`pairplot-resizable-container ${isResizing ? 'resizing' : ''}`}
      style={{
        width: dimensions.width,
        height: dimensions.height
      }}
    >
      {/* Dataset Header - now inside resizable container */}
      <div className="dataset-plot-header">
        <h3 className="dataset-plot-title">{dataset.name}</h3>
        <div className="dataset-plot-info">
          <span className="dataset-info-item">
            {dataset.selectedColumns.length} variables
          </span>
          <span className="dataset-info-item">
            {Math.min(dataset.data.length, maxPoints).toLocaleString()} points
          </span>
        </div>
      </div>

      {/* Pairplot Content - Show skeleton during resize, plot after */}
      <div className="pairplot-content">
        {showSkeleton ? (
          <div className="pairplot-skeleton">
            <div
              className="skeleton-grid"
              style={{
                gridTemplateColumns: `repeat(${n}, 1fr)`,
                gridTemplateRows: `repeat(${n}, 1fr)`
              }}
            >
              {Array.from({ length: n * n }).map((_, i) => (
                <div key={i} className="skeleton-cell">
                  <div className="skeleton-shimmer" />
                </div>
              ))}
            </div>
            <div className="skeleton-label">Resizing...</div>
          </div>
        ) : (
          <PairplotMatrix
            key={plotKey}
            data={dataset.data}
            selectedColumns={dataset.selectedColumns}
            maxPoints={maxPoints}
            onCellClick={onCellClick}
            isResizing={false}
          />
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="pairplot-resize-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <ResizeIcon />
      </div>
    </div>
  );
});

function ScatterPlotApp({ isDarkMode }) {
  // Multiple datasets state - array of dataset objects
  // Each dataset has: { id, name, data, columns, selectedColumns, fileInfo }
  const [datasets, setDatasets] = useState([]);

  // Selection state
  const [selectedCells, setSelectedCells] = useState([]);

  // UI state
  const [maxPoints, setMaxPoints] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlot, setShowPlot] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [detailPanelCollapsed, setDetailPanelCollapsed] = useState(false);
  const [detailPanelWidth, setDetailPanelWidth] = useState(700);
  // Track plot dimensions per dataset for resizing
  const [plotDimensions, setPlotDimensions] = useState({});
  // Visualization mode: 'pairplot' or 'timeseries'
  const [visualizationTab, setVisualizationTab] = useState('pairplot');
  // Key to trigger pairplot relayout when container space changes
  const [containerResizeKey, setContainerResizeKey] = useState(0);
  // State for folder browser loading
  const [loadingFiles, setLoadingFiles] = useState([]);
  const [loadedFiles, setLoadedFiles] = useState([]);

  // Debounced container resize trigger when detail panel changes
  const debouncedContainerResize = useRef(
    debounce(() => {
      setContainerResizeKey(prev => prev + 1);
    }, 200)
  ).current;

  // Track detail panel size/collapse changes
  useEffect(() => {
    debouncedContainerResize();
  }, [detailPanelWidth, detailPanelCollapsed, selectedCells.length]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => debouncedContainerResize.cancel();
  }, []);

  // ============ FILE HANDLING ============

  const handleFileUpload = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please upload a valid CSV file');
      return;
    }

    setIsLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: true,
      complete: (results) => {
        const parsedData = results.data;
        const numericCols = getNumericColumns(parsedData);
        const timestampCol = getTimestampColumn(parsedData);

        const newDataset = {
          id: Date.now().toString(),
          name: file.name.replace('.csv', ''),
          data: parsedData,
          columns: numericCols,
          selectedColumns: numericCols.slice(0, Math.min(4, numericCols.length)),
          timestampColumn: timestampCol,
          fileInfo: {
            name: file.name,
            size: file.size,
            rows: parsedData.length,
            cols: Object.keys(parsedData[0] || {}).length
          }
        };

        setDatasets(prev => [...prev, newDataset]);
        setShowPlot(false);
        setSelectedCells([]);
        setIsLoading(false);
      },
      error: () => {
        alert('Error parsing CSV file');
        setIsLoading(false);
      }
    });
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((file) => {
    setIsDragOver(false);
    handleFileUpload(file);
  }, [handleFileUpload]);

  const handleClearFile = useCallback(() => {
    setDatasets([]);
    setShowPlot(false);
    setSelectedCells([]);
    setLoadedFiles([]); // Reset loaded files tracking
  }, []);

  const handleRemoveDataset = useCallback((datasetId) => {
    setDatasets(prev => prev.filter(ds => ds.id !== datasetId));
    setShowPlot(false);
    setSelectedCells([]);
    setLoadedFiles(prev => prev.filter(id => id !== datasetId)); // Remove from loaded
  }, []);

  // Handler for loading files from folder browser
  const handleFolderFileLoad = useCallback(async (file, content) => {
    // Mark file as loading
    setLoadingFiles(prev => [...prev, file.id]);

    try {
      // In the previous version, content was a function (importFn). 
      // Now it's the raw text content from the API.
      const csvContent = content;

      // Parse the CSV content
      return new Promise((resolve, reject) => {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            const parsedData = results.data;
            const numericCols = getNumericColumns(parsedData);
            const timestampCol = getTimestampColumn(parsedData);

            const newDataset = {
              id: file.id,
              name: file.name.replace('.csv', ''),
              data: parsedData,
              columns: numericCols,
              selectedColumns: numericCols.slice(0, Math.min(4, numericCols.length)),
              timestampColumn: timestampCol,
              fileInfo: {
                name: file.name,
                size: file.size,
                rows: parsedData.length,
                cols: Object.keys(parsedData[0] || {}).length,
                folder: file.folderName
              }
            };

            setDatasets(prev => [...prev, newDataset]);
            setShowPlot(false);
            setSelectedCells([]);

            // Mark file as loaded and remove from loading
            setLoadingFiles(prev => prev.filter(id => id !== file.id));
            setLoadedFiles(prev => [...prev, file.id]);

            resolve();
          },
          error: (err) => {
            console.error('Error parsing CSV:', err);
            setLoadingFiles(prev => prev.filter(id => id !== file.id));
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error('Error loading file:', error);
      setLoadingFiles(prev => prev.filter(id => id !== file.id));
      throw error;
    }
  }, []);

  // ============ COLUMN SELECTION ============

  const handleToggleColumn = useCallback((datasetId, col) => {
    setDatasets(prev => prev.map(ds => {
      if (ds.id === datasetId) {
        const newSelectedColumns = ds.selectedColumns.includes(col)
          ? ds.selectedColumns.filter(c => c !== col)
          : [...ds.selectedColumns, col];
        return { ...ds, selectedColumns: newSelectedColumns };
      }
      return ds;
    }));
    setShowPlot(false);
    setSelectedCells([]);
  }, []);

  const handleToggleAll = useCallback((datasetId) => {
    setDatasets(prev => prev.map(ds => {
      if (ds.id === datasetId) {
        const newSelectedColumns = ds.selectedColumns.length === ds.columns.length
          ? []
          : [...ds.columns];
        return { ...ds, selectedColumns: newSelectedColumns };
      }
      return ds;
    }));
    setShowPlot(false);
    setSelectedCells([]);
  }, []);

  // ============ PLOT GENERATION ============

  const handleMaxPointsChange = useCallback((value) => {
    setMaxPoints(value);
    setShowPlot(false);
    setSelectedCells([]);
  }, []);

  const handleGenerate = useCallback(() => {
    const hasValidDataset = datasets.some(ds => ds.selectedColumns.length >= 2);
    if (!hasValidDataset) {
      alert('Please select at least 2 columns in at least one dataset');
      return;
    }
    setIsLoading(true);
    setSelectedCells([]);
    requestAnimationFrame(() => {
      setShowPlot(true);
      setIsLoading(false);
    });
  }, [datasets]);

  const handleCellClick = useCallback((datasetId, cell) => {
    setSelectedCells(prev => {
      // Check if this cell is already selected for this dataset
      const existingIndex = prev.findIndex(
        c => c.row === cell.row && c.col === cell.col && c.datasetId === datasetId
      );

      // If already selected, don't add it again (user can use close button to remove)
      if (existingIndex !== -1) {
        return prev;
      }

      // Add the new cell with dataset info to the array
      return [...prev, { ...cell, datasetId }];
    });
  }, []);

  const handleRemoveCell = useCallback((cellToRemove) => {
    setSelectedCells(prev =>
      prev.filter(c => !(
        c.row === cellToRemove.row &&
        c.col === cellToRemove.col &&
        c.datasetId === cellToRemove.datasetId
      ))
    );
  }, []);

  // Handle plot dimension changes for resizable pairplots
  const handlePlotDimensionChange = useCallback((datasetId, dimensions) => {
    setPlotDimensions(prev => ({
      ...prev,
      [datasetId]: dimensions
    }));
  }, []);

  // ============ RENDER ============

  return (
    <div className="main-app-iso">
      <div className="app" data-theme={isDarkMode ? 'dark' : 'light'}>
        {/* Toggle button when sidebar is collapsed */}
        <button
          className={`sidebar-toggle ${sidebarCollapsed ? 'visible' : ''}`}
          onClick={() => setSidebarCollapsed(false)}
          title="Open sidebar"
        >
          <MenuIcon />
        </button>

        {/* Left Panel - Control Panel */}
        <ControlPanel
          datasets={datasets}
          maxPoints={maxPoints}
          isLoading={isLoading}
          isDragOver={isDragOver}
          sidebarCollapsed={sidebarCollapsed}
          loadingFiles={loadingFiles}
          loadedFiles={loadedFiles}
          onFileUpload={handleFileUpload}
          onFolderFileLoad={handleFolderFileLoad}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onToggleColumn={handleToggleColumn}
          onToggleAll={handleToggleAll}
          onClearFile={handleClearFile}
          onRemoveDataset={handleRemoveDataset}
          onMaxPointsChange={handleMaxPointsChange}
          onGenerate={handleGenerate}
          onCollapse={() => setSidebarCollapsed(true)}
        />

        {/* Main Content */}
        <div
          className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${selectedCells.length > 0 && !detailPanelCollapsed ? 'right-panel-open' : ''}`}
          style={{ marginRight: selectedCells.length > 0 && !detailPanelCollapsed ? detailPanelWidth : 0 }}
        >
          <main className="plot-container">
            {showPlot && datasets.some(ds => ds.selectedColumns.length >= 2) ? (
              <>
                <div className="plot-header">
                  <h2 className="plot-title">
                    {visualizationTab === 'pairplot' ? 'Pairplot Matrices' : 'Time Series Analysis'}
                  </h2>
                  <div className="plot-stats">
                    <div className="stat-item">
                      <div className="stat-value">{datasets.length}</div>
                      <div className="stat-label">Datasets</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{maxPoints.toLocaleString()}</div>
                      <div className="stat-label">Max Points</div>
                    </div>
                  </div>
                </div>

                {/* Visualization Tabs */}
                <VisualizationTabs
                  activeTab={visualizationTab}
                  onTabChange={setVisualizationTab}
                />

                {/* Pairplot View */}
                {visualizationTab === 'pairplot' && (
                  <div className="plot-wrapper-multi">
                    {isLoading && (
                      <div className="loading-overlay">
                        <div className="spinner" />
                        <span className="loading-text">Generating plots...</span>
                      </div>
                    )}
                    {datasets.map(dataset => {
                      if (dataset.selectedColumns.length < 2) return null;
                      // Get dimensions or use defaults
                      const dims = plotDimensions[dataset.id] || { width: '100%', height: 700 };
                      return (
                        <div key={dataset.id} className="dataset-plot-section">
                          <ResizablePlotWrapper
                            dataset={dataset}
                            maxPoints={maxPoints}
                            dimensions={dims}
                            onDimensionChange={handlePlotDimensionChange}
                            onCellClick={(cell) => {
                              handleCellClick(dataset.id, cell);
                              setDetailPanelCollapsed(false);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Time Series View */}
                {visualizationTab === 'timeseries' && (
                  <div className="timeseries-wrapper">
                    {isLoading && (
                      <div className="loading-overlay">
                        <div className="spinner" />
                        <span className="loading-text">Generating time series...</span>
                      </div>
                    )}
                    {datasets.map(dataset => {
                      if (dataset.selectedColumns.length < 1) return null;

                      return (
                        <div key={dataset.id} className="timeseries-dataset-section">
                          <div className="timeseries-dataset-header">
                            <h3 className="timeseries-dataset-title">{dataset.name}</h3>
                            <div className="timeseries-dataset-info">
                              <span className="timeseries-info-item">
                                {dataset.selectedColumns.length} variables
                              </span>
                              <span className="timeseries-info-item">
                                Timestamp: <strong>{dataset.timestampColumn || 'Index'}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="timeseries-charts-grid">
                            {dataset.selectedColumns.map(column => (
                              <TimeSeriesChart
                                key={`${dataset.id}-${column}`}
                                data={dataset.data}
                                column={column}
                                timestampColumn={dataset.timestampColumn}
                                maxPoints={maxPoints * 2}
                                height={220}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="plot-wrapper">
                <div className="empty-state">
                  <div className="empty-icon">
                    <ChartIcon />
                  </div>
                  <h3>No Plot Generated</h3>
                  <p>
                    {datasets.length === 0
                      ? 'Upload CSV files to get started'
                      : !datasets.some(ds => ds.selectedColumns.length >= 2)
                        ? 'Select at least 2 columns in a dataset to generate a pairplot'
                        : 'Click "Generate Pairplot" to visualize your data'}
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Right Panel - Detail View */}
        {selectedCells.length > 0 && (
          <DetailPanel
            selectedCells={selectedCells}
            datasets={datasets}
            maxPoints={maxPoints}
            collapsed={detailPanelCollapsed}
            panelWidth={detailPanelWidth}
            onPanelWidthChange={setDetailPanelWidth}
            onToggle={() => setDetailPanelCollapsed(!detailPanelCollapsed)}
            onRemoveCell={handleRemoveCell}
          />
        )}
      </div>
    </div>
  );
}

export default ScatterPlotApp;
