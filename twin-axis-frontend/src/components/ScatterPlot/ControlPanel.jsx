import { useState } from 'react';
import { 
  FileIcon, 
  SparklesIcon,
  ChevronLeftIcon,
  SettingsIcon
} from './Icons';
import UploadZone from './UploadZone';
import DatasetCard from './DatasetCard';
import DataFolderBrowser from './DataFolderBrowser';

function ControlPanel({
  datasets,
  maxPoints,
  isLoading,
  isDragOver,
  sidebarCollapsed,
  loadingFiles,
  loadedFiles,
  onFileUpload,
  onFolderFileLoad,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleColumn,
  onToggleAll,
  onClearFile,
  onRemoveDataset,
  onMaxPointsChange,
  onGenerate,
  onCollapse
}) {
  const [activeTab, setActiveTab] = useState('browse');
  const hasValidDataset = datasets.some(ds => ds.selectedColumns.length >= 2);

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <SettingsIcon />
          Controls
        </div>
        <button 
          className="collapse-btn" 
          onClick={onCollapse}
          title="Collapse sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>
      <div className="sidebar-content">
        <div className="panel">
          <div className="control-tabs">
            <button 
              className={`control-tab ${activeTab === 'browse' ? 'active' : ''}`}
              onClick={() => setActiveTab('browse')}
            >
              Browse Datasets
            </button>
            <button 
              className={`control-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload Custom
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'browse' ? (
              <DataFolderBrowser
                onFileLoad={onFolderFileLoad}
                loadingFiles={loadingFiles || []}
                loadedFiles={loadedFiles || []}
              />
            ) : (
              <UploadZone
                isDragOver={isDragOver}
                hasDatasets={datasets.length > 0}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onFileSelect={onFileUpload}
              />
            )}
          </div>

          {/* Datasets List */}
          {datasets.length > 0 && (
            <>
              <div className="datasets-section">
                <div className="panel-title">
                  <FileIcon />
                  Datasets ({datasets.length})
                </div>
                {datasets.length > 1 && (
                  <button className="clear-all-btn" onClick={onClearFile} title="Remove all datasets">
                    Clear All
                  </button>
                )}
              </div>

              {datasets.map(dataset => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  onToggleColumn={onToggleColumn}
                  onToggleAll={onToggleAll}
                  onRemove={onRemoveDataset}
                />
              ))}

              {/* Settings Section */}
              <div className="settings-section">
                <div className="setting-row">
                  <span className="setting-label">Max Data Points</span>
                  <span className="setting-value">{maxPoints.toLocaleString()}</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="100"
                    max="10000"
                    step="200"
                    value={maxPoints}
                    onChange={(e) => onMaxPointsChange(parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Generate Button */}
              <button
                className="generate-btn"
                onClick={onGenerate}
                disabled={!hasValidDataset || isLoading}
              >
                <SparklesIcon />
                Generate Pairplots
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default ControlPanel;
