import React from 'react';
import { BarChart3, GitCompare, Layers, Network, Workflow, ArrowRight, GanttChart } from 'lucide-react';

const StudyHome = ({ onSelectStudy, isDarkMode }) => {
    const studies = [
        {
            id: 1,
            title: 'Phase Progression',
            description: 'Track the causal evolution of a single unit through Early, Mid, and Late phases.',
            icon: Workflow,
            color: '#2563eb',
        },
        {
            id: 2,
            title: 'Phase-Wise Comparison',
            description: 'Compare multiple units side-by-side at a specific operational phase.',
            icon: GitCompare,
            color: '#0284c7',
        },
        {
            id: 3,
            title: 'Consolidated Analysis',
            description: 'A comprehensive view synthesizing temporal progression across the entire fleet.',
            icon: BarChart3,
            color: '#d97706',
        },
        {
            id: 4,
            title: 'Consolidated Causal Graphs',
            description: 'Visualize the dynamic evolution of causal structures through sequential analysis.',
            icon: Network,
            color: '#059669',
        },
        {
            id: 5,
            title: 'RCD Cluster Analysis',
            description: 'Explore centrality-wise RCD cluster causal graphs across failure and non-failure datasets.',
            icon: Layers,
            color: '#db2777',
        },
        {
            id: 6,
            title: 'Hyperparameter Tuning Experiment',
            description: 'Analyze causal graphs based on different hyperparameters (Gasifier, Bucket, and Lambda values).',
            icon: Network,
            color: '#7c3aed',
        },
        {
            id: 7,
            title: 'Gantt Chart',
            description: 'Visualize project timelines with task durations, phases, and dependencies across gasifier units.',
            icon: GanttChart,
            color: '#0d9488',
        },
        {
            id: 8,
            title: 'Gasifier Causal Graph Analysis',
            description: 'Explore causal graphs from indexed overlap studies across various units.',
            icon: Network,
            color: '#e11d48',
        }
    ];

    return (
        <div className="max-w-[1000px] mx-auto">
            {/* Header */}
            <div className="text-center mb-8 pt-6">
                <h1 className={`text-3xl font-bold tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Scientific Studies
                </h1>
                <p className={`text-sm max-w-[500px] mx-auto leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Select a perspective to explore causal relationships and performance insights.
                </p>
            </div>

            {/* Card Grid — enterprise rectangular cards */}
            <div className="grid grid-cols-3 gap-3">
                {studies.map((study) => {
                    const Icon = study.icon;
                    return (
                        <div
                            key={study.id}
                            className={`group cursor-pointer border p-5 flex flex-col gap-3 transition-colors duration-150 ${
                                isDarkMode
                                    ? 'bg-[#252526] border-[#3e3e42] hover:border-blue-600 hover:bg-[#2d2d30]'
                                    : 'bg-white border-gray-200 hover:border-blue-600 hover:bg-gray-50'
                            }`}
                            onClick={() => onSelectStudy(study.id)}
                        >
                            <div
                                className="w-9 h-9 flex items-center justify-center"
                                style={{ color: study.color }}
                            >
                                <Icon size={20} strokeWidth={1.8} />
                            </div>
                            <h3 className={`text-sm font-semibold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                {study.title}
                            </h3>
                            <p className={`text-xs leading-relaxed flex-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {study.description}
                            </p>
                            <span
                                className="text-xs font-semibold inline-flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity"
                                style={{ color: study.color }}
                            >
                                Explore <ArrowRight size={12} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudyHome;
