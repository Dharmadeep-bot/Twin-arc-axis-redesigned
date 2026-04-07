import React, { useState, useEffect } from 'react';
import CausalGraphViewer from '../shared/CausalGraphViewer';
import { getBackendConfig } from '../../utils/sharedUtils';

const { API_HOST } = getBackendConfig();

const SixthApp = ({ isDarkMode }) => {
    const [options, setOptions] = useState({ gasifiers: [], buckets: [], lamdas: [] });
    const [selection, setSelection] = useState({ gasifier: '', bucket: '', lamda: '' });
    const [bMatrixData, setBMatrixData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch dropdown options on mount
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await fetch(`${API_HOST}/api/hyperparameter/options`);
                const data = await res.json();
                if (data.success) {
                    setOptions({
                        gasifiers: data.gasifiers || [],
                        buckets: data.buckets || [],
                        lamdas: data.lamdas || []
                    });
                    
                    // Set default selections if available
                    setSelection({
                        gasifier: data.gasifiers[0] || '',
                        bucket: data.buckets[0] || '',
                        lamda: data.lamdas[0] || ''
                    });
                }
            } catch (err) {
                console.error("Failed to fetch options", err);
            }
        };
        fetchOptions();
    }, []);

    // Fetch B-Matrix when selection completes
    useEffect(() => {
        const fetchGraph = async () => {
            if (!selection.gasifier || !selection.bucket || !selection.lamda) {
                return;
            }
            
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_HOST}/api/hyperparameter/b-matrix?gasifier=${selection.gasifier}&bucket=${selection.bucket}&lamda=${selection.lamda}`);
                const data = await res.json();
                
                if (data.success) {
                    setBMatrixData({
                        columns: data.columns,
                        data: data.data
                    });
                } else {
                    setBMatrixData(null);
                    setError(data.error || 'Failed to fetch graph data');
                }
            } catch (err) {
                setBMatrixData(null);
                setError('Network error');
                console.error("Graph fetch error", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, [selection]);

    const handleChange = (field, value) => {
        setSelection(prev => ({ ...prev, [field]: value }));
    };

    const dk = isDarkMode;

    return (
        <div className="flex flex-col h-full min-h-[calc(100vh-150px)]">
            {/* Controls Bar */}
            <div className={`flex gap-3 p-2 border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Gasifier</label>
                    <select
                        value={selection.gasifier}
                        onChange={(e) => handleChange('gasifier', e.target.value)}
                        className={`px-2 py-1 text-xs font-medium min-w-[140px] outline-none border transition-colors cursor-pointer ${dk ? 'bg-slate-900 border-slate-600 text-slate-200 hover:border-sky-400 focus:border-sky-400' : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-blue-500 focus:border-blue-500'}`}
                    >
                        {options.gasifiers.length === 0 && <option value="">No Gasifiers</option>}
                        {options.gasifiers.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Bucket</label>
                    <select
                        value={selection.bucket}
                        onChange={(e) => handleChange('bucket', e.target.value)}
                        className={`px-2 py-1 text-xs font-medium min-w-[140px] outline-none border transition-colors cursor-pointer ${dk ? 'bg-slate-900 border-slate-600 text-slate-200 hover:border-sky-400 focus:border-sky-400' : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-blue-500 focus:border-blue-500'}`}
                    >
                        {options.buckets.length === 0 && <option value="">No Buckets</option>}
                        {options.buckets.map(b => (
                            <option key={b} value={b}>
                                {b.replace('buc-', '').charAt(0).toUpperCase() + b.replace('buc-', '').slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Lambda</label>
                    <select
                        value={selection.lamda}
                        onChange={(e) => handleChange('lamda', e.target.value)}
                        className={`px-2 py-1 text-xs font-medium min-w-[140px] outline-none border transition-colors cursor-pointer ${dk ? 'bg-slate-900 border-slate-600 text-slate-200 hover:border-sky-400 focus:border-sky-400' : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-blue-500 focus:border-blue-500'}`}
                    >
                        {options.lamdas.length === 0 && <option value="">No Lambdas</option>}
                        {options.lamdas.map(l => (
                            <option key={l} value={l}>
                                λ {l.replace('lam', '')}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Graph Area */}
            <div className={`flex-1 shadow-md flex overflow-hidden relative min-h-[500px] border ${dk ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
                {loading && (
                    <div className={`w-full text-center p-5 text-base font-semibold ${dk ? 'text-slate-300' : 'text-slate-600'}`}>
                        Loading Graph...
                    </div>
                )}
                {error && (
                    <div className="w-full text-center p-5 text-base font-semibold text-red-500">
                        {error}
                    </div>
                )}
                {!loading && !error && bMatrixData && (
                    <div className="w-full h-full absolute inset-0 p-2.5">
                        <CausalGraphViewer 
                            bMatrixData={bMatrixData}
                            isDarkMode={isDarkMode}
                            gasifierName={selection.gasifier}
                            phase={selection.bucket}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SixthApp;
