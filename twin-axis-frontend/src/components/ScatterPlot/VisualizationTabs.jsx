import { memo } from 'react';

const VisualizationTabs = memo(function VisualizationTabs({ 
  activeTab, 
  onTabChange,
  tabs = [
    { id: 'pairplot', label: 'Pairplot', icon: 'grid' },
    { id: 'timeseries', label: 'Time Series', icon: 'chart' }
  ]
}) {
  return (
    <div className="visualization-tabs">
      <div className="visualization-tabs-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`visualization-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon === 'grid' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            )}
            {tab.icon === 'chart' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M7 16l4-4 4 2 5-6" />
              </svg>
            )}
            <span>{tab.label}</span>
            {activeTab === tab.id && <div className="tab-indicator" />}
          </button>
        ))}
      </div>
    </div>
  );
});

export default VisualizationTabs;
