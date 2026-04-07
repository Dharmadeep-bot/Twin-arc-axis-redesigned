import { useState, useEffect, useCallback } from 'react';
import PlotCard from './PlotCard';
import { ChevronRightIcon } from './Icons';

function DetailPanel({ selectedCells, datasets, maxPoints, collapsed, panelWidth, onPanelWidthChange, onToggle, onRemoveCell }) {
  // Track theme changes
  const [themeVersion, setThemeVersion] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  
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
  
  // Handle resize start
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    const handleMouseMove = (e) => {
      // Calculate new width (dragging left increases width, right decreases)
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(400, Math.min(1200, startWidth + deltaX));
      onPanelWidthChange(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, onPanelWidthChange]);
  
  return (
    <>
      {/* Toggle button when panel is collapsed */}
      <button 
        className={`detail-panel-toggle ${collapsed ? 'visible' : ''}`}
        onClick={onToggle}
        title="Open detail panel"
      >
        <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
        <span className="detail-panel-badge">{selectedCells.length}</span>
      </button>

      <aside 
        className={`right-panel ${collapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: panelWidth }}
      >
        {/* Resize Handle */}
        <div 
          className="panel-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
        
        <div className="right-panel-header">
          <button 
            className="right-panel-close" 
            onClick={onToggle} 
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            <ChevronRightIcon />
          </button>
          <div className="right-panel-title">
            Selected Plots ({selectedCells.length})
          </div>
        </div>
        <div className="right-panel-content">
          {selectedCells.map((cell, index) => {
            const dataset = datasets.find(ds => ds.id === cell.datasetId);
            if (!dataset) return null;
            
            return (
              <PlotCard
                key={`${cell.datasetId}-${cell.row}-${cell.col}-${index}`}
                cell={cell}
                dataset={dataset}
                maxPoints={maxPoints}
                onRemove={onRemoveCell}
                themeVersion={themeVersion}
              />
            );
          })}
        </div>
      </aside>
    </>
  );
}

export default DetailPanel;
