import { useState, useEffect, memo } from 'react';
import { ChevronDownIcon } from './Icons';
import { getBackendConfig } from '../../utils/sharedUtils';

const { API_HOST } = getBackendConfig();

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="folder-loading-spinner" />
);

const DataFolderBrowser = memo(function DataFolderBrowser({
  onFileLoad,
  loadingFiles = [],
  loadedFiles = []
}) {
  const [dataFolders, setDataFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [browserLoading, setBrowserLoading] = useState(true);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const response = await fetch(`${API_HOST}/api/gasifier-datasets`);
        const data = await response.json();
        if (data.success) {
          setDataFolders(data.folders);
        }
      } catch (error) {
        console.error('Failed to fetch gasifier datasets:', error);
      } finally {
        setBrowserLoading(false);
      }
    };
    fetchFolders();
  }, []);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const isFileLoaded = (fileId) => loadedFiles.includes(fileId);
  const isFileLoading = (fileId) => loadingFiles.includes(fileId);

  const handleLoadSelected = async () => {
    if (selectedFiles.size === 0) return;

    // Get all selected files with their paths
    const filesToLoad = [];
    dataFolders.forEach(folder => {
      folder.files.forEach(file => {
        if (selectedFiles.has(file.id) && !isFileLoaded(file.id)) {
          filesToLoad.push({
            ...file,
            folderId: folder.id,
            folderName: folder.name
          });
        }
      });
    });

    // Load files sequentially
    for (const file of filesToLoad) {
      if (file.path) {
        try {
          const response = await fetch(`${API_HOST}${file.path}`);
          if (!response.ok) throw new Error('Failed to fetch file content');
          const text = await response.text();

          await onFileLoad(file, text);
        } catch (error) {
          console.error(`Failed to load ${file.name}:`, error);
        }
      }
    }

    // Clear selection after loading
    setSelectedFiles(new Set());
  };

  const selectedCount = selectedFiles.size;
  const loadableCount = Array.from(selectedFiles).filter(id => !isFileLoaded(id)).length;

  return (
    <div className="data-folder-browser">
      <div className="folder-browser-header">
        <span className="folder-browser-title">
          <FolderIcon />
          Gasifier Datasets
        </span>
      </div>

      <div className="folder-list">
        {browserLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            Loading datasets...
          </div>
        ) : dataFolders.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            No datasets found in output folder.
          </div>
        ) : (
          dataFolders.map(folder => (
            <div key={folder.id} className="folder-section">
              <button
                className={`folder-header ${expandedFolders[folder.id] ? 'expanded' : ''}`}
                onClick={() => toggleFolder(folder.id)}
              >
                <ChevronDownIcon className={`folder-chevron ${expandedFolders[folder.id] ? 'rotated' : ''}`} />
                <FolderIcon />
                <span className="folder-name">{folder.name}</span>
                <span className="folder-file-count">{folder.files.length} files</span>
              </button>

              {expandedFolders[folder.id] && (
                <div className="folder-files">
                  {folder.files.map(file => {
                    const isLoaded = isFileLoaded(file.id);
                    const isLoading = isFileLoading(file.id);
                    const isSelected = selectedFiles.has(file.id);

                    return (
                      <div
                        key={file.id}
                        className={`file-item ${isSelected ? 'selected' : ''} ${isLoaded ? 'loaded' : ''} ${isLoading ? 'loading' : ''}`}
                        onClick={() => !isLoaded && !isLoading && toggleFileSelection(file.id)}
                      >
                        <div className="file-checkbox">
                          {isLoading ? (
                            <LoadingSpinner />
                          ) : isLoaded ? (
                            <CheckIcon />
                          ) : isSelected ? (
                            <CheckIcon />
                          ) : null}
                        </div>
                        <FileIcon />
                        <div className="file-info">
                          <span className="file-label">{file.label}</span>
                          <span className="file-size">{file.size}</span>
                        </div>
                        {isLoaded && <span className="file-loaded-badge">Loaded</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedCount > 0 && (
        <div className="folder-browser-actions">
          <button
            className="load-selected-btn"
            onClick={handleLoadSelected}
            disabled={loadableCount === 0}
          >
            Load {loadableCount} Selected
          </button>
        </div>
      )}
    </div>
  );
});

export default DataFolderBrowser;
