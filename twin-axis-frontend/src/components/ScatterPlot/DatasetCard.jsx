import { formatBytes } from '../../utils/dataUtils';
import { XIcon, CheckIcon, ColumnsIcon } from './Icons';

function DatasetCard({ dataset, onToggleColumn, onToggleAll, onRemove }) {
  return (
    <div className="dataset-card">
      <div className="dataset-header">
        <div className="dataset-info-compact">
          <div className="dataset-name">{dataset.name}</div>
          <div className="dataset-meta">
            {typeof dataset.fileInfo.size === 'number' ? formatBytes(dataset.fileInfo.size) : dataset.fileInfo.size} • {dataset.fileInfo.rows?.toLocaleString() || '0'} rows
          </div>
        </div>
        <button 
          className="dataset-remove-btn" 
          onClick={() => onRemove(dataset.id)}
          title="Remove dataset"
        >
          <XIcon />
        </button>
      </div>

      <div className="columns-section">
        <div className="columns-header">
          <span className="columns-title">
            <ColumnsIcon />
            Columns
          </span>
          <button 
            className="select-all-btn" 
            onClick={() => onToggleAll(dataset.id)}
          >
            {dataset.selectedColumns.length === dataset.columns.length ? 'None' : 'All'}
          </button>
        </div>
        <div className="columns-list">
          {dataset.columns.map(col => (
            <div
              key={col}
              className={`column-item ${dataset.selectedColumns.includes(col) ? 'selected' : ''}`}
              onClick={() => onToggleColumn(dataset.id, col)}
            >
              <div className="column-checkbox">
                <CheckIcon />
              </div>
              <span className="column-name" title={col}>{col}</span>
              <span className="column-type">num</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dataset-selection-info">
        {dataset.selectedColumns.length} column{dataset.selectedColumns.length !== 1 ? 's' : ''} selected
        {dataset.selectedColumns.length < 2 && ' (min 2 required)'}
      </div>
    </div>
  );
}

export default DatasetCard;
