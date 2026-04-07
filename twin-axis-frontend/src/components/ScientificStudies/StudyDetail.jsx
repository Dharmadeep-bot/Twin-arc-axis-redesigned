import React, { useState, useEffect, memo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import CausalGraphViewer from '../shared/CausalGraphViewer';
import { getUnitForVariable, getBackendConfig } from '../../utils/sharedUtils';
import { Sun, Moon, ArrowLeft, LayoutPanelLeft, ChevronLeft, Plus, Clock, Zap, Activity, Maximize, Minimize, Trash, Network, Settings2 } from 'lucide-react';
import FourthApp from '../FourthApp/FourthApp';
import SixthApp from '../SixthApp/SixthApp';
import SeventhApp from '../SeventhApp/SeventhApp';
import ConsolidatedCausalGraphs, { CausalGraphCell } from '../ConsolidatedCausalGraphs/ConsolidatedCausalGraphs';
import StudyTimeline from './StudyTimeline';

const { API_HOST } = getBackendConfig();

// Component to show a vertical/horizontal grid of gathered insights for Study 3
const ConsolidatedNotesGrid = memo(({ gasifier }) => {
    const [notes, setNotes] = useState({
        p_overall: '',
        p_early: '',
        p_mid: '',
        p_late: '',
        c_early: '',
        c_mid: '',
        c_late: '',
        cons_notes: ''
    });

    useEffect(() => {
        if (!gasifier) return;

        setNotes({
            p_overall: '',
            p_early: '',
            p_mid: '',
            p_late: '',
            c_early: '',
            c_mid: '',
            c_late: '',
            cons_notes: ''
        });

        const fetchAllNotes = async () => {
            const contexts = [
                { key: 'p_overall', study: 1, phase: '' },
                { key: 'p_early', study: 1, phase: 'early' },
                { key: 'p_mid', study: 1, phase: 'mid' },
                { key: 'p_late', study: 1, phase: 'late' },
                { key: 'c_early', study: 2, phase: 'early' },
                { key: 'c_mid', study: 2, phase: 'mid' },
                { key: 'c_late', study: 2, phase: 'late' },
                { key: 'cons_notes', study: 3, phase: '' }
            ];

            for (const ctx of contexts) {
                try {
                    const res = await fetch(`${API_HOST}/api/dataset/${gasifier}/notes?studyId=${ctx.study}&phase=${ctx.phase}`);
                    const data = await res.json();
                    if (data.success) {
                        setNotes(prev => ({ ...prev, [ctx.key]: data.notes || '' }));
                    }
                } catch (e) {
                    console.error('Err fetching context notes:', e);
                }
            }
        };
        fetchAllNotes();
    }, [gasifier]);

    const handleSave = useCallback(async (key, val) => {
        setNotes(prev => ({ ...prev, [key]: val }));

        const ctxMap = [
            { key: 'p_overall', study: 1, phase: '' },
            { key: 'p_early', study: 1, phase: 'early' },
            { key: 'p_mid', study: 1, phase: 'mid' },
            { key: 'p_late', study: 1, phase: 'late' },
            { key: 'c_early', study: 2, phase: 'early' },
            { key: 'c_mid', study: 2, phase: 'mid' },
            { key: 'c_late', study: 2, phase: 'late' },
            { key: 'cons_notes', study: 3, phase: '' }
        ];

        const ctx = ctxMap.find(c => c.key === key);
        if (!ctx) return;

        try {
            await fetch(`${API_HOST}/api/dataset/${gasifier}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: val, studyId: ctx.study, phase: ctx.phase })
            });
        } catch (e) {
            console.error('Err saving contextual notes:', e);
        }
    }, [gasifier]);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Consolidated Analysis:</span>
                <textarea
                    className="w-full min-h-[100px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    value={notes.cons_notes}
                    placeholder="Final synthesis and conclusions across all phases..."
                    onChange={(e) => handleSave('cons_notes', e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Phase-Wise Insights Matrix:</span>
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800">
                            <th className="p-2 text-left font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600 w-[110px]">Study</th>
                            <th className="p-2 text-center font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600">Early</th>
                            <th className="p-2 text-center font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600">Mid</th>
                            <th className="p-2 text-center font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600">Late</th>
                            <th className="p-2 text-center font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-600">Overall</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="p-2 font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 whitespace-nowrap">Progression (S1)</td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.p_early}
                                    onChange={(e) => handleSave('p_early', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.p_mid}
                                    onChange={(e) => handleSave('p_mid', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.p_late}
                                    onChange={(e) => handleSave('p_late', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.p_overall}
                                    onChange={(e) => handleSave('p_overall', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className="p-2 font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 whitespace-nowrap">Comparison (S2)</td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.c_early}
                                    onChange={(e) => handleSave('c_early', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.c_mid}
                                    onChange={(e) => handleSave('c_mid', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-1 border border-slate-200 dark:border-slate-600">
                                <textarea
                                    className="w-full min-h-[60px] rounded border-0 bg-transparent p-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none resize-y"
                                    value={notes.c_late}
                                    onChange={(e) => handleSave('c_late', e.target.value)}
                                    placeholder="..."
                                />
                            </td>
                            <td className="p-2 border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-center text-slate-400 italic">N/A</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const StudyUnit = memo(({ row, gasifiers, onUpdate, onRemove, studyId, isDarkMode, layout, studyWindow }) => {
    const [localNotes, setLocalNotes] = useState(row.notes);
    const [isCollapsed, setIsCollapsed] = useState({ gasifier: false, insights: false });

    // Fetch notes when gasifier changes or studyWindow changes (for Study 2)
    useEffect(() => {
        const fetchNotes = async () => {
            if (!row.gasifier) return;
            try {
                const csvGasifier = row.gasifier.endsWith('.csv') ? row.gasifier : `${row.gasifier}.csv`;
                const apiPath = studyId === 2
                    ? `${API_HOST}/api/dataset/${csvGasifier}/notes?studyId=2&phase=${studyWindow}`
                    : `${API_HOST}/api/dataset/${csvGasifier}/notes?studyId=${studyId}`;

                const response = await fetch(apiPath);
                const data = await response.json();
                if (data.success && data.notes) {
                    setLocalNotes(data.notes);
                    onUpdate('notes', data.notes);
                } else {
                    setLocalNotes('');
                    onUpdate('notes', '');
                }
            } catch (err) {
                console.error('Error fetching notes:', err);
            }
        };
        fetchNotes();
    }, [row.gasifier, studyId, studyWindow]);

    // Update localNotes when it changes from outside
    useEffect(() => {
        setLocalNotes(row.notes);
    }, [row.notes]);

    // Save notes with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!row.gasifier || localNotes === row.notes) return;
            try {
                const csvGasifier = row.gasifier.endsWith('.csv') ? row.gasifier : `${row.gasifier}.csv`;
                await fetch(`${API_HOST}/api/dataset/${csvGasifier}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notes: localNotes,
                        studyId: studyId,
                        phase: studyId === 2 ? studyWindow : ''
                    })
                });
                onUpdate('notes', localNotes);
            } catch (err) {
                console.error('Error saving notes:', err);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [localNotes, row.gasifier, studyId, studyWindow]);

    const toggleCollapse = (panel) => {
        setIsCollapsed(prev => ({ ...prev, [panel]: !prev[panel] }));
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 450);
    };

    const dk = isDarkMode;

    const renderGasifierPanel = () => {
        if (layout === 'card' || layout === 'progression') return null; // Handled by sidebar for Study 1, 2, 3
        return (
            <div className={`shrink-0 flex flex-col border-r ${dk ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'} ${isCollapsed.gasifier ? 'w-10' : 'w-[180px]'} transition-all`}>
                <div className={`flex items-center gap-2 px-2 py-2 ${!isCollapsed.gasifier ? (dk ? 'border-b border-slate-700' : 'border-b border-slate-200') : ''}`}>
                    {!isCollapsed.gasifier && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">UNIT SELECTION</span>}
                    <button
                        className={`p-0.5 rounded transition-colors ${dk ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}
                        onClick={() => toggleCollapse('gasifier')}
                        title={isCollapsed.gasifier ? "Expand" : "Collapse"}
                    >
                        <ChevronLeft size={14} style={{ transform: isCollapsed.gasifier ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    {!isCollapsed.gasifier && (
                        <button className="ml-auto text-red-400 hover:text-red-500 opacity-70 text-sm" onClick={onRemove} title="Remove unit">×</button>
                    )}
                </div>
                {!isCollapsed.gasifier && (
                    <div className="p-3">
                        <select
                            value={row.gasifier}
                            onChange={(e) => onUpdate('gasifier', e.target.value)}
                            className={`w-full rounded-md border px-2 py-1 text-sm font-semibold outline-none ${dk ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                        >
                            {gasifiers.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
                        </select>
                    </div>
                )}
            </div>
        );
    };

    const renderInsightsPanel = () => null; // Removed as requested

    const graphLabelCls = `text-[10px] font-bold uppercase tracking-wider text-center py-1.5 shrink-0 ${dk ? 'text-slate-400 bg-slate-800/50 border-b border-slate-700' : 'text-slate-500 bg-slate-50 border-b border-slate-200'}`;

    if (layout === 'card') {
        return (
            <div className={`flex flex-1 overflow-hidden shadow-sm border ${dk ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                {renderGasifierPanel()}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className={graphLabelCls}>{studyWindow.toUpperCase()} PHASE</div>
                    <div className="flex-1 min-h-0">
                        <CausalGraphCell gasifier={row.gasifier} studyWindow={studyWindow} isDarkMode={isDarkMode} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-1 overflow-hidden shadow-sm border ${dk ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            {renderGasifierPanel()}
            <div className="flex-1 grid grid-cols-3 min-w-0">
                {['early', 'mid', 'late'].map(phase => (
                    <div key={phase} className={`flex flex-col ${phase !== 'late' ? (dk ? 'border-r border-slate-700' : 'border-r border-slate-200') : ''}`}>
                        <div className={graphLabelCls}>{phase.toUpperCase()}</div>
                        <div className="flex-1 min-h-0">
                            <CausalGraphCell gasifier={row.gasifier} studyWindow={phase} isDarkMode={isDarkMode} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});


// Stride options are now fetched dynamically from the backend

const StudyEight = memo(({ isDarkMode }) => {
    const [selectedStride, setSelectedStride] = useState(null);
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [bMatrix, setBMatrix] = useState(null);
    const [nodeMapping, setNodeMapping] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fetchingFolders, setFetchingFolders] = useState(false);
    const [fetchingFiles, setFetchingFiles] = useState(false);
    const [strideOptions, setStrideOptions] = useState([]);
    const [fetchingStrides, setFetchingStrides] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    // Fetch stride options on mount
    useEffect(() => {
        const fetchStrides = async () => {
            setFetchingStrides(true);
            try {
                const res = await fetch(`${API_HOST}/api/gasifier-bmatrix-studies/strides`);
                const data = await res.json();
                if (data.success) {
                    const formatted = data.strides.map(s => ({
                        value: s,
                        label: s === 'no_overlap' ? 'No Overlap' : `${s.toUpperCase()} Overlap`
                    }));
                    setStrideOptions(formatted);
                }
            } catch (e) {
                console.error('[StudyEight] Error fetching strides:', e);
            } finally {
                setFetchingStrides(false);
            }
        };
        fetchStrides();
    }, []);

    // Reset downstream selections when stride changes
    const handleStrideChange = (stride) => {
        setSelectedStride(stride || null);
        setFolders([]);
        setSelectedFolder(null);
        setFiles([]);
        setSelectedFile(null);
        setBMatrix(null);
    };

    // Reset downstream selections when gasifier changes
    const handleFolderChange = (folder) => {
        setSelectedFolder(folder || null);
        setFiles([]);
        setSelectedFile(null);
        setBMatrix(null);
    };

    // Fetch gasifier folders when stride changes
    useEffect(() => {
        if (!selectedStride) {
            setFolders([]);
            return;
        }
        const fetchFolders = async () => {
            console.log(`[StudyEight] Fetching folders for stride: ${selectedStride}`);
            setFetchingFolders(true);
            try {
                const res = await fetch(`${API_HOST}/api/gasifier-bmatrix-studies/folders?stride=${selectedStride}`);
                const data = await res.json();
                console.log(`[StudyEight] Folders response:`, data);
                if (data.success && data.folders?.length > 0) {
                    setFolders(data.folders);
                    // Auto-select G4R21 if available, otherwise fall back to the first folder
                    if (!selectedFolder) {
                        const preferred = data.folders.find(f => f.toLowerCase() === 'g4r21');
                        setSelectedFolder(preferred || data.folders[0]);
                    }
                } else {
                    setFolders([]);
                    setSelectedFolder(null);
                }
            } catch (e) {
                console.error('[StudyEight] Error fetching folders:', e);
                setFolders([]);
                setError(`Failed to connect to backend: ${e.message}`);
            } finally {
                setFetchingFolders(false);
            }
        };
        fetchFolders();
    }, [selectedStride]);

    // Fetch files when gasifier folder changes
    useEffect(() => {
        if (!selectedStride || !selectedFolder) {
            setFiles([]);
            setSelectedFile(null);
            return;
        }
        const fetchFiles = async () => {
            console.log(`[StudyEight] Fetching files for ${selectedStride}/${selectedFolder}`);
            setFetchingFiles(true);
            try {
                const res = await fetch(`${API_HOST}/api/gasifier-bmatrix-studies/files?stride=${selectedStride}&folder=${selectedFolder}`);
                const data = await res.json();
                console.log(`[StudyEight] Files response:`, data);
                if (data.success && data.files?.length > 0) {
                    setFiles(data.files);
                    // Auto-select the first file if none selected or if previously selected file is not in list
                    if (!selectedFile || !data.files.includes(selectedFile)) {
                        setSelectedFile(data.files[0]);
                    }
                } else {
                    setFiles([]);
                    setSelectedFile(null);
                }
            } catch (e) {
                console.error('[StudyEight] Error fetching files:', e);
                setFiles([]);
            } finally {
                setFetchingFiles(false);
            }
        };
        fetchFiles();
    }, [selectedStride, selectedFolder]);

    // Fetch B-matrix when file changes
    useEffect(() => {
        if (!selectedStride || !selectedFolder || !selectedFile) {
            setBMatrix(null);
            return;
        }
        const fetchData = async () => {
            console.log(`[StudyEight] Fetching matrix data: ${selectedStride}/${selectedFolder}/${selectedFile}`);
            setLoading(true);
            setError(null);
            try {
                const url = `${API_HOST}/api/gasifier-bmatrix-studies/b-matrix?stride=${selectedStride}&folder=${selectedFolder}&file=${selectedFile}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    setBMatrix(data);
                    setNodeMapping(data.columns.map((col, idx) => ({
                        id: col, name: col, index: idx + 1, unit: getUnitForVariable(col)
                    })));
                } else {
                    setError(data.error || 'Failed to load matrix data');
                }
            } catch (e) {
                setError(`Connection error: ${e.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedStride, selectedFolder, selectedFile]);

    const getDownloadName = () => {
        if (!selectedFile) return '';
        // ov0k__g3r25_buc1_BM_9__...
        const base = selectedFile
            .replace('.xlsx', '')
            .replace('.csv', '')
            .replace('_BM_', '_causal-graph_')
            .replace('_B_Matrix_', '_causal-graph_');
        const now = new Date();
        const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
        return `${base}_${selectedStride}_${timestamp}`;
    };

    const getFileLabel = (f) => {
        // ov0k__g3r25_buc1_BM_9__lam0.1-lmin5-lmax15.xlsx
        const clean = f.replace('.xlsx', '').replace('.csv', '');
        const segments = clean.split('__');
        if (segments.length < 2) return clean;

        const subSegments = segments[1].split('_');
        // subSegments might be ['g3r25', 'buc1', 'BM', '9']

        const bucket = subSegments.find(s => s.startsWith('buc'))?.replace('buc', 'Bucket ') || '';
        const bmIdx = subSegments.findIndex(s => s === 'BM');
        const bm = bmIdx !== -1 ? `BM ${subSegments[bmIdx + 1]}` : '';

        const paramsPart = segments[2] || '';
        const lam = paramsPart.split('-')[0]?.replace('lam', 'λ ') || '';

        return `${bucket}${bm ? ` (${bm})` : ''}${lam ? ` — ${lam}` : ''}`;
    };

    const dk = isDarkMode;
    const selectCls = `w-full h-8 border px-2 text-sm font-medium outline-none transition-colors ${dk ? 'bg-slate-900 border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 disabled:text-slate-400'}`;

    return (
        <div className="flex flex-col gap-4 pb-4 min-h-[calc(100vh-150px)]">
            {/* Timeline toggle button */}
            <div className="flex justify-end pr-1">
                <button
                    onClick={() => setShowTimeline(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                        showTimeline
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                            : (dk ? 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500' : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400')
                    }`}
                    title={showTimeline ? 'Hide Processing Chain Timeline' : 'Show Processing Chain Timeline'}
                >
                    <Clock size={13} />
                    {showTimeline ? 'HIDE TIMELINE' : 'SHOW TIMELINE'}
                </button>
            </div>

            {/* Collapsible Timeline — filtered to selected gasifier + stride */}
            {showTimeline && (
                <StudyTimeline
                    gasifierName={selectedFolder}
                    stride={selectedStride}
                    isDarkMode={isDarkMode}
                />
            )}

            <div className={`flex overflow-hidden shadow-sm border ${dk ? 'border-slate-700' : 'border-slate-200'}`} style={{ height: 'calc(100vh - 130px)', minHeight: '600px' }}>

                {/* Left panel — 3 cascading dropdowns */}
                <div className={`shrink-0 w-[280px] flex flex-col border-r ${dk ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b ${dk ? 'text-slate-400 border-slate-700 bg-slate-800' : 'text-slate-500 border-slate-200 bg-slate-50'}`}>UNIT INFO</div>
                    <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">

                        {/* 1. Stride */}
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Select Stride</label>
                            <select
                                value={selectedStride || ''}
                                onChange={(e) => handleStrideChange(e.target.value)}
                                className={selectCls}
                                disabled={fetchingStrides}
                            >
                                <option value="">{fetchingStrides ? 'Detecting Strides...' : '-- Choose Stride --'}</option>
                                {strideOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <span className="text-[10px] text-slate-500">Detected {strideOptions.length} available stride types.</span>
                        </div>

                        {/* 2. Gasifier (Always visible) */}
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2. Select Gasifier</label>
                            <select
                                value={selectedFolder || ''}
                                onChange={(e) => handleFolderChange(e.target.value)}
                                className={selectCls}
                                disabled={!selectedStride || fetchingFolders}
                            >
                                <option value="">
                                    {selectedStride
                                        ? (fetchingFolders ? 'Scanning...' : (folders.length > 0 ? '-- Choose Gasifier --' : 'No gasifiers found'))
                                        : '-- Select Stride First --'}
                                </option>
                                {folders.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            {selectedStride && !fetchingFolders && folders.length === 0 && <span className="text-[11px] text-red-400">No gasifiers found in this directory.</span>}
                        </div>

                        {/* 3. Bucket / B-Matrix (Always visible) */}
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">3. Select B-Matrix</label>
                            <select
                                value={selectedFile || ''}
                                onChange={(e) => setSelectedFile(e.target.value || null)}
                                className={selectCls}
                                disabled={!selectedFolder || fetchingFiles}
                            >
                                <option value="">
                                    {selectedFolder
                                        ? (fetchingFiles ? 'Scanning...' : (files.length > 0 ? '-- Choose Bucket --' : 'No buckets found'))
                                        : '-- Select Gasifier First --'}
                                </option>
                                {files.map(f => <option key={f} value={f}>{getFileLabel(f)}</option>)}
                            </select>
                            {selectedFolder && !fetchingFiles && files.length === 0 && <span className="text-[11px] text-red-400">No buckets (.xlsx) found.</span>}
                        </div>

                        {loading && (
                            <div className="flex items-center gap-2 text-blue-500 text-xs mt-2">
                                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 animate-spin" />
                                <span>Loading Graph Data...</span>
                            </div>
                        )}
                        {error && <span className="text-[11px] text-red-500 mt-1">Error: {error}</span>}
                    </div>
                </div>

                {/* Right — causal graph fills all remaining space */}
                <div className={`flex-1 min-w-0 flex flex-col ${dk ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <div className={`flex items-center justify-between px-4 py-2 shrink-0 border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                        <span className={`text-xs font-semibold ${dk ? 'text-slate-200' : 'text-slate-700'}`}>
                            {selectedFile
                                ? `${selectedFile.replace('.xlsx', '')} — ${strideOptions.find(s => s.value === selectedStride)?.label || ''}`
                                : 'CAUSAL GRAPH DISPLAY'}
                        </span>
                        {selectedFile && <Activity size={16} className="animate-pulse" color="#3b82f6" />}
                    </div>
                    <div className="flex-1 min-h-0">
                        {bMatrix ? (
                            <CausalGraphViewer
                                bMatrixData={bMatrix}
                                nodeMapping={nodeMapping}
                                isDarkMode={isDarkMode}
                                gasifierName={selectedFile ? selectedFile.replace('.xlsx', '') : 'unknown'}
                                phase={selectedStride || 'custom'}
                                customDownloadName={getDownloadName()}
                            />
                        ) : (
                            <div className={`flex flex-col items-center justify-center h-full gap-4 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                                <div className={`p-6 rounded-full ${dk ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Network size={64} strokeWidth={1} className={dk ? 'text-slate-500' : 'text-slate-400'} />
                                </div>
                                <div className="text-center">
                                    <h3 className={`text-xl font-semibold ${dk ? 'text-slate-300' : 'text-slate-600'}`}>Causal Analysis Portal</h3>
                                    <p className="mt-2 text-sm">Choose a Stride, Gasifier, and B-matrix to generate the graph.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
});



const StudyDetail = memo(forwardRef(({ studyId, onBack, isDarkMode, onSelectStudy }, ref) => {
    const [gasifiers, setGasifiers] = useState([]);
    const [rows, setRows] = useState([{ id: 1, gasifier: '', notes: '' }]);
    const [studyWindow, setStudyWindow] = useState('early'); // 'early', 'mid', 'late', 'all'
    const [overallSummary, setOverallSummary] = useState('');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [loading, setLoading] = useState(true);
    const [gasifierFilter, setGasifierFilter] = useState('all'); // filter by gasifier prefix e.g. 'g1', 'g3'
    const [sequence, setSequence] = useState([]);

    // gasifier prefix options derived from the gasifiers list (e.g. 'g1', 'g3', 'g4' ...)
    const gasifierPrefixes = [...new Set(gasifiers.map(g => g.match(/^g\d+/)?.[0]).filter(Boolean))].sort();

    useImperativeHandle(ref, () => ({
        handleAddRow: () => handleAddRow()
    }));

    useEffect(() => {
        const fetchGasifiers = async () => {
            try {
                // For Studies 1-4 use gasifiers from B_Matrices phase files
                const res = await fetch(`${API_HOST}/api/phase-studies/gasifiers`);
                const data = await res.json();
                if (data.success && data.gasifiers.length > 0) {
                    const names = data.gasifiers;
                    setGasifiers(names);
                    if (rows[0].gasifier === '' && names.length > 0) {
                        setRows([{ id: 1, gasifier: names[0], notes: '' }]);
                    }
                }
            } catch (err) {
                console.error('Error fetching gasifiers from B_Matrices:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGasifiers();
    }, []);

    useEffect(() => {
        const fetchSummary = async () => {
            if (gasifiers.length === 0) return;
            try {
                const response = await fetch(`${API_HOST}/api/dataset/scientific_studies/notes`);
                const data = await response.json();
                if (data.success && data.summary) {
                    setOverallSummary(data.summary);
                }
            } catch (err) {
                console.error('Error fetching summary:', err);
            }
        };
        fetchSummary();
    }, [gasifiers]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!overallSummary || overallSummary === 'No notes added yet.') return;
            try {
                await fetch(`${API_HOST}/api/dataset/scientific_studies/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ summary: overallSummary })
                });
            } catch (err) {
                console.error('Error saving summary:', err);
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [overallSummary]);

    const handleAddRow = () => {
        const newId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
        setRows([...rows, { id: newId, gasifier: gasifiers[0] || '', notes: '' }]);
    };

    const handleRemoveRow = (id) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const handleUpdateRow = (id, field, value) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleToggleGasifier = (name) => {
        const exists = rows.find(r => r.gasifier === name);
        if (exists) {
            setRows(rows.filter(r => r.gasifier !== name));
            setSequence(sequence.filter(s => s !== name));
        } else {
            const newId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
            setRows([...rows, { id: newId, gasifier: name, notes: '' }]);
            setSequence(prev => [...prev, name]);
        }
    };

    const handleMoveInSequence = (index, direction) => {
        const newSeq = [...sequence];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newSeq.length) return;
        [newSeq[index], newSeq[targetIndex]] = [newSeq[targetIndex], newSeq[index]];
        setSequence(newSeq);
    };

    const handleRemoveFromSequence = (name) => {
        setSequence(sequence.filter(s => s !== name));
        setRows(rows.filter(r => r.gasifier !== name));
    };

    // Filtered gasifiers for Study 4 selection dashboard
    const filteredGasifiers = gasifiers.filter(g =>
        gasifierFilter === 'all' || g.startsWith(gasifierFilter)
    );

    const handleSelectAllGasifiers = () => {
        const currentSelectedFiltered = filteredGasifiers.filter(name => rows.find(r => r.gasifier === name));

        if (currentSelectedFiltered.length === filteredGasifiers.length && filteredGasifiers.length > 0) {
            // Deselect all visible
            const namesToRemove = new Set(filteredGasifiers);
            setRows(rows.filter(r => !namesToRemove.has(r.gasifier)));
            setSequence(sequence.filter(s => !namesToRemove.has(s)));
        } else {
            // Select all visible
            const toAdd = filteredGasifiers.filter(name => !rows.find(r => r.gasifier === name));
            const newRows = [...rows];
            const newSeq = [...sequence];
            toAdd.forEach(g => {
                const newId = newRows.length > 0 ? Math.max(...newRows.map(r => r.id)) + 1 : 1;
                newRows.push({ id: newId, gasifier: g, notes: '' });
                newSeq.push(g);
            });
            setRows(newRows);
            setSequence(newSeq);
        }
    };

    const applyCriteriaSelection = () => {
        const toAdd = filteredGasifiers.filter(g => !rows.find(r => r.gasifier === g));
        if (toAdd.length > 0) {
            const newRows = [...rows];
            const newSeq = [...sequence];
            toAdd.forEach(g => {
                const newId = newRows.length > 0 ? Math.max(...newRows.map(r => r.id)) + 1 : 1;
                newRows.push({ id: newId, gasifier: g, notes: '' });
                newSeq.push(g);
            });
            setRows(newRows);
            setSequence(newSeq);
        }
    };

    const getStudyTitle = () => {
        switch (studyId) {
            case 1: return 'Phase Progression';
            case 2: return 'Phase-Wise Comparison';
            case 3: return 'Consolidated Analysis';
            case 4: return 'Consolidated Causal Graphs';
            case 5: return 'RCD Cluster Analysis';
            case 6: return 'Hyperparameter Tuning Experiment';
            case 7: return 'Gantt Chart';
            case 8: return 'Gasifier Causal Graph Analysis';
            default: return 'Analysis Detail';
        }
    };

    const dk = isDarkMode;

    if (loading) {
        return (
            <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full border-[3px] animate-spin ${dk ? 'border-slate-700 border-t-sky-400' : 'border-slate-200 border-t-blue-600'}`} />
                <p className="text-sm font-medium">Loading gasifier data...</p>
            </div>
        );
    }

    const selectedGasifierNames = rows.map(r => r.gasifier).filter(Boolean);

    // Study 5 renders FourthApp embedded inside the same header shell
    // Conditional returns for special studies
    if (Number(studyId) === 8) {
        return (
            <div className="h-full flex flex-col overflow-hidden min-h-[calc(100vh-150px)]">
                <StudyEight isDarkMode={isDarkMode} />
            </div>
        );
    }

    if (Number(studyId) === 5) {
        return (
            <div className="h-full flex flex-col overflow-hidden min-h-[calc(100vh-150px)]">
                <FourthApp isDarkMode={isDarkMode} />
            </div>
        );
    }

    if (Number(studyId) === 6) {
        return (
            <div className="h-full flex flex-col overflow-hidden min-h-[calc(100vh-150px)]">
                <SixthApp isDarkMode={isDarkMode} />
            </div>
        );
    }

    if (Number(studyId) === 7) {
        return (
            <div className="h-full flex flex-col overflow-hidden min-h-[calc(100vh-150px)]">
                <SeventhApp isDarkMode={isDarkMode} />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden min-h-[calc(100vh-150px)]">
            
            {/* Dedicated navbar for studies 1, 2, 3 */}
            {(studyId === 1 || studyId === 2 || studyId === 3) && (
                <div className={`flex items-center px-4 py-2 border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <button 
                        onClick={handleAddRow}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors active:scale-[0.98]"
                    >
                        <Plus size={14} />
                        <span>Add Comparison Unit</span>
                    </button>
                </div>
            )}

            {/* Sidebar Layout for Comparative Studies (1, 2, 3) */}
            {(studyId === 1 || studyId === 2 || studyId === 3) && (
              <div className="flex flex-1 min-h-0">
                <aside className={`shrink-0 w-[220px] flex flex-col border-r overflow-y-auto ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className={`border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Settings2 size={14} />
                      <span>{studyId === 2 ? 'PHASE SELECTION' : 'VIEW SETTINGS'}</span>
                    </div>
                    {studyId === 2 ? (
                      <div className="flex gap-1 px-3 pb-3">
                        {['early', 'mid', 'late'].map(p => (
                          <button 
                            key={p} 
                            className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              studyWindow === p
                                ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                : (dk ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                            }`}
                            onClick={() => setStudyWindow(p)}
                          >
                            {p.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 font-medium px-3 pb-3 italic">
                        {studyId === 1 ? 'Viewing Phase Progression across units' : 'Consolidated analysis view'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className={`flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Zap size={14} />
                      <span>COMPARISON UNITS ({rows.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
                      {rows.map((row, idx) => (
                        <div key={row.id} className={`p-2 ${dk ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${dk ? 'text-slate-500' : 'text-slate-400'}`}>UNIT {idx + 1}</span>
                            <button
                              className="text-red-400 hover:text-red-500 text-xs leading-none"
                              onClick={() => handleRemoveRow(row.id)}
                            >×</button>
                          </div>
                          <select
                            value={row.gasifier}
                            onChange={(e) => handleUpdateRow(row.id, 'gasifier', e.target.value)}
                            className={`w-full border px-2 py-1 text-xs font-semibold outline-none ${dk ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                          >
                            {gasifiers.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>

                <main className="flex-1 min-h-0">
                  <div className="flex flex-col h-full">
                    {rows.map((row) => (
                      <StudyUnit 
                        key={row.id} 
                        row={row} 
                        isDarkMode={isDarkMode} 
                        onUpdate={(field, val) => handleUpdateRow(row.id, field, val)}
                        onRemove={() => handleRemoveRow(row.id)}
                        layout={(studyId === 2 || studyId === 3) ? 'card' : 'progression'}
                        studyWindow={studyWindow}
                      />
                    ))}
                  </div>
                </main>
              </div>
            )}

            {/* Standalone Display for non-sidebar studies (4-8) */}
            {studyId > 3 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <main className={studyId === 4 ? "flex-1 min-h-0" : "flex-1 min-h-0 overflow-auto"}>
                  <div className={studyId === 4 ? "h-full flex flex-col" : "flex flex-col gap-4 p-4"}>
                      {studyId === 4 ? (
                          <ConsolidatedCausalGraphs
                              selectedGasifiers={[]}
                              sequence={sequence}
                              isDarkMode={isDarkMode}
                              phase={studyWindow}
                              playbackSpeed={playbackSpeed}
                              setPlaybackSpeed={setPlaybackSpeed}
                          />
                      ) : studyId === 8 ? (
                          <StudyEight isDarkMode={isDarkMode} />
                      ) : studyId === 5 ? (
                          <FourthApp isDarkMode={isDarkMode} />
                      ) : studyId === 6 ? (
                          <SixthApp isDarkMode={isDarkMode} />
                      ) : studyId === 7 ? (
                          <SeventhApp isDarkMode={isDarkMode} />
                      ) : (
                          rows.map((row) => (
                              <StudyUnit 
                                  key={row.id} 
                                  row={row} 
                                  isDarkMode={isDarkMode} 
                                  onUpdate={(field, val) => handleUpdateRow(row.id, field, val)}
                                  onRemove={() => handleRemoveRow(row.id)}
                                  layout={studyId === 2 ? 'card' : 'row'}
                                  studyWindow={studyWindow}
                              />
                          ))
                      )}
                  </div>
                </main>
              </div>
            )}
    </div>
  );
}));

export default StudyDetail;
