import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Sun, Moon,
  Workflow, GitCompare, BarChart3, Network, Layers, GanttChart
} from 'lucide-react';

const Ribbon = ({ 
  selectedStudyId, 
  onSelectStudy, 
  onAddComparisonUnit, 
  isDarkMode,
  setIsDarkMode
}) => {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimeout = useRef(null);

  const studies = [
    { id: 1, title: 'Phase Progression', icon: Workflow },
    { id: 2, title: 'Phase Comparison', icon: GitCompare },
    { id: 3, title: 'Consolidated Analysis', icon: BarChart3 },
    { id: 4, title: 'Consolidated Causal Graphs', icon: Network },
    { id: 5, title: 'RCD Cluster Analysis', icon: Layers },
    { id: 6, title: 'Hyperparam Tuning', icon: Network },
    { id: 7, title: 'Gantt Chart', icon: GanttChart },
    { id: 8, title: 'Causal Graph Analysis', icon: Network }
  ];

  const handleLogoClick = (e) => {
    e.preventDefault();
    clickCount.current += 1;
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => {
      const count = clickCount.current;
      clickCount.current = 0;
      if (count === 1) {
        onSelectStudy(null);
        navigate('/');
      } else if (count === 2) {
        navigate('/causal-analysis');
      } else if (count === 3) {
        navigate('/scatter-plot');
      }
    }, 300);
  };

  const activeStudy = studies.find(s => s.id === selectedStudyId);
  const dk = isDarkMode;

  return (
    <div className={`z-[1000] w-full border-b ${dk ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Single Row: Logo + Tab Strip + Actions */}
      <div className="flex items-center px-3 py-2 gap-4">
        <button 
          onClick={handleLogoClick}
          className={`flex items-center px-2 py-1 transition-colors group ${dk ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          title="Go to Home"
        >
          <span className="text-lg font-black tracking-tighter uppercase">
            <span className="text-blue-600 group-hover:text-blue-500 transition-colors">Twinarc</span>
            <span className={`ml-1 ${dk ? 'text-slate-300' : 'text-slate-700'}`}>Axis</span>
          </span>
        </button>

        {/* Tab strip */}
        <div className="flex items-center gap-0 overflow-x-auto">
          {studies.map(study => (
            <button
              key={study.id}
              onClick={() => onSelectStudy(study.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap border-b-2 ${
                selectedStudyId === study.id
                  ? `${dk ? 'text-white bg-slate-800' : 'text-blue-700 bg-blue-50'} border-blue-600`
                  : `border-transparent ${dk ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-gray-50'}`
              }`}
            >
              <study.icon size={12} />
              <span>{study.title}</span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Contextual Actions */}
        <div className="flex items-center gap-2">
          <div className={`w-px h-5 mx-1 ${dk ? 'bg-slate-700' : 'bg-gray-200'}`} />

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 transition-colors ${dk ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-slate-500 hover:text-slate-800'}`}
            title="Toggle Theme"
          >
            {dk ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-slate-500" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ribbon;
