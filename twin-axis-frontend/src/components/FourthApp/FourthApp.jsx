import React, { useState, useEffect, useCallback } from 'react';
import CausalGraphViewer from '../shared/CausalGraphViewer';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://axisapi1.dev.twinarcpro.eminds.ai/api';

// ─── File lists per version ───────────────────────────────────────────────────

const LCD_FILES_V3 = [
    'Consensus_Min2.xlsx',
    'Consensus_Min2_Transposed.xlsx',
    'Consensus_50.xlsx',
    'Consensus_50_Transposed.xlsx',
    'Simple_Average.xlsx',
    'Simple_Average_Transposed.xlsx',
    'Weighted_Average.xlsx',
    'Weighted_Average_Transposed.xlsx',
];

const LCD_FILES_V2 = [
    'Consensus_50Percent_Median.xlsx',
    'Consensus_50Percent_Median_Transposed.xlsx',
    'Consensus_Min2_Median.xlsx',
    'Consensus_Min2_Median_Transposed.xlsx',
];
const LCD_FILES_V1 = [
    'Consensus_GTE2.xlsx',
    'Simple_Average.xlsx',
    'Union_Median.xlsx',
    'Weighted_Average.xlsx',
    'Weighted_Average_Transposed.xlsx',
];

const FILE_LABELS = {
    // V3
    'Consensus_Min2.xlsx': 'Consensus (Min ≥ 2)',
    'Consensus_Min2_Transposed.xlsx': 'RCD (Min ≥ 2)',
    'Consensus_50.xlsx': 'Consensus (≥ 50%)',
    'Consensus_50_Transposed.xlsx': 'RCD (≥ 50%)',
    'Simple_Average.xlsx': 'Simple Average',
    'Simple_Average_Transposed.xlsx': 'RCD (Simple)',
    'Weighted_Average.xlsx': 'Weighted Average',
    'Weighted_Average_Transposed.xlsx': 'RCD (Weighted)',
    // V2
    'Consensus_50Percent_Median.xlsx': 'Consensus (GTE ≥ 50%)',
    'Consensus_50Percent_Median_Transposed.xlsx': 'RCD (50%)',
    'Consensus_Min2_Median.xlsx': 'Consensus (Min ≥ 2)',
    'Consensus_Min2_Median_Transposed.xlsx': 'RCD (Min ≥ 2)',
    // V1
    'Consensus_GTE2.xlsx': 'Consensus (GTE ≥ 2)',
    'Simple_Average.xlsx': 'Simple Average',
    'Union_Median.xlsx': 'Union Median',
    'Weighted_Average.xlsx': 'Weighted Average',
    'Weighted_Average_Transposed.xlsx': 'RCD (Weighted)',
};

const DATASET_TYPES = [
    { value: 'failure', label: 'Failure' },
    { value: 'non_failure', label: 'Non-Failure' },
];

const WINDOWS = ['early', 'mid', 'late'];

const NODE_MAPPING = {
  "1": "SlurryPDI",
  "2": "OxygenPDI",
  "3": "SlurrySPMMagFlow",
  "4": "CTSbased1ststagetemperature",
  "5": "Slurrypressure",
  "6": "OxygenFlowtoMixers",
  "7": "OxygenControlvalveSPPV"
};

const NODE_MAPPING_ARRAY = Object.entries(NODE_MAPPING).map(([id, name]) => ({ id, name }));

const getNodeName = (id) => {
    return NODE_MAPPING[id] || id;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDataEndpoint(analysisType, window, centralNode, datasetType, version) {
    const v = `&version=${encodeURIComponent(version)}`;
    if (analysisType === 'gcd') {
        return `${API_BASE}/fourthapp/gcd-data?window=${encodeURIComponent(window)}&central_node=${encodeURIComponent(centralNode)}&dataset_type=${encodeURIComponent(datasetType)}${v}`;
    }
    return `${API_BASE}/fourthapp/lcd-data?window=${encodeURIComponent(window)}&central_node=${encodeURIComponent(centralNode)}&dataset_type=${encodeURIComponent(datasetType)}${v}`;
}

function getAllCentralitiesEndpoint(analysisType, datasetType, version) {
    const v = `&version=${encodeURIComponent(version)}`;
    if (analysisType === 'gcd') return `${API_BASE}/fourthapp/gcd-all-centralities?dataset_type=${datasetType}${v}`;
    return `${API_BASE}/fourthapp/all-centralities?dataset_type=${datasetType}${v}`;
}

function getCentralityViewEndpoint(analysisType, centrality, dsType, version) {
    const v = `&version=${encodeURIComponent(version)}`;
    if (analysisType === 'gcd') {
        return `${API_BASE}/fourthapp/gcd-centrality-view?central_node=${encodeURIComponent(centrality)}&dataset_type=${encodeURIComponent(dsType)}&windows=early,mid,late${v}`;
    }
    return `${API_BASE}/fourthapp/centrality-view?central_node=${encodeURIComponent(centrality)}&dataset_type=${encodeURIComponent(dsType)}&windows=early,mid,late${v}`;
}

function getFilesEndpoint(analysisType, datasetType, version) {
    const v = `&version=${encodeURIComponent(version)}`;
    if (analysisType === 'gcd') return `${API_BASE}/fourthapp/gcd-files?dataset_type=${datasetType}${v}`;
    return `${API_BASE}/fourthapp/files?dataset_type=${datasetType}${v}`;
}

// ─── Centrality Window Card ────────────────────────────────────────────────────

const CentralityWindowCard = ({ window: win, windowData, selectedFile, isDarkMode, filterIncoming, selectedCentrality }) => {
    const available = windowData?.available;
    const dk = isDarkMode;

    if (!available) {
        return (
            <div className={`flex flex-col h-full min-h-[500px] ${dk ? 'bg-slate-800/35 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                <div className={`px-3 py-1.5 border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        win === 'early' ? 'text-green-500' :
                        win === 'mid' ? 'text-yellow-500' :
                        'text-red-500'
                    }`}>{win.toUpperCase()}</span>
                </div>
                <div className={`flex flex-col items-center justify-center gap-2 flex-1 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                    <div className="text-3xl opacity-45">🚫</div>
                    <p className="text-sm">Data not available</p>
                </div>
            </div>
        );
    }

    const fileData = windowData?.files?.[selectedFile];
    let bMatrixData = null;
    let hiddenNodes = [];

    if (fileData && !fileData.error) {
        bMatrixData = {
            columns: [...fileData.columns],
            data: fileData.data.map(row => ({ ...row }))
        };

        if (filterIncoming && selectedCentrality) {
            const norm = (s) => String(s).replace(/^central_/, '');
            let normalizedCentrality = norm(selectedCentrality);
            let validSources = new Set([normalizedCentrality]);
            
            bMatrixData.data.forEach((row, rowIndex) => {
                let target = row.Pixel || row.index;
                if (!target && rowIndex < bMatrixData.columns.length) target = bMatrixData.columns[rowIndex];
                
                if (norm(target) === normalizedCentrality) {
                    bMatrixData.columns.forEach(source => {
                        const weight = parseFloat(row[source]);
                        // Lowered threshold here to let CausalGraphViewer's dynamic slider handle filtering
                        if (Math.abs(weight) >= 0.01 && norm(target) !== norm(source)) {
                            validSources.add(norm(source));
                        }
                    });
                }
            });
            
            hiddenNodes = bMatrixData.columns.filter(c => !validSources.has(norm(c)));
            
            bMatrixData.data = bMatrixData.data.map((row, rowIndex) => {
                let target = row.Pixel || row.index;
                if (!target && rowIndex < bMatrixData.columns.length) target = bMatrixData.columns[rowIndex];
                
                if (norm(target) !== normalizedCentrality) {
                    const emptyRow = { ...row };
                    bMatrixData.columns.forEach(c => { emptyRow[c] = 0; });
                    return emptyRow;
                }
                return row;
            });
        }
    }

    return (
        <div className={`flex flex-col h-full min-h-[500px] border ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-3 py-1.5 border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    win === 'early' ? 'text-green-500' :
                    win === 'mid' ? 'text-yellow-500' :
                    'text-red-500'
                }`}>{win.toUpperCase()}</span>
            </div>
            {bMatrixData ? (
                <div className="flex-1">
                    <CausalGraphViewer
                        bMatrixData={bMatrixData}
                        nodeMapping={NODE_MAPPING_ARRAY}
                        isDarkMode={isDarkMode}
                        hideFullScreenControl={false}
                        hiddenNodes={hiddenNodes}
                    />
                </div>
            ) : (
                <div className={`flex flex-col items-center justify-center gap-2 flex-1 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                    <div className="text-3xl opacity-45">⚠️</div>
                    <p className="text-sm">{fileData?.error || 'No data for this file'}</p>
                </div>
            )}
        </div>
    );
};

// ─── Centrality Row (Independent Section) ───────────────────────────────────────

const CentralityRow = ({ datasetType, analysisType, version, isDarkMode }) => {
    const fileList = version === 'v3' ? LCD_FILES_V3 : (version === 'v1' ? LCD_FILES_V1 : LCD_FILES_V2);
    const defaultFile = fileList[0];

    const [centralities, setCentralities] = useState([]);
    const [selectedCentrality, setSelectedCentrality] = useState('');
    const [selectedFile, setSelectedFile] = useState(defaultFile);
    const [viewData, setViewData] = useState(null);
    const [loadingCentralities, setLoadingCentralities] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filterIncoming, setFilterIncoming] = useState(false);
    const dk = isDarkMode;

    // Reset when version or analysisType changes
    useEffect(() => {
        setSelectedCentrality('');
        setViewData(null);
        setError(null);
        setSelectedFile(fileList[0]);
    }, [version, analysisType]);

    // Fetch cross-window view data
    const fetchCvView = useCallback(async (centrality) => {
        if (!centrality) return;
        setLoading(true); setError(null); setViewData(null);
        try {
            const res = await fetch(getCentralityViewEndpoint(analysisType, centrality, datasetType, version));
            const data = await res.json();
            if (data.success) setViewData(data.windows);
            else setError(data.error || 'Failed to fetch centrality view');
        } catch (err) {
            setError(`Network error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [analysisType, datasetType, version]);

    // Fetch centralities list
    useEffect(() => {
        const fetchCentralities = async () => {
            setLoadingCentralities(true);
            setSelectedCentrality('');
            setViewData(null);
            try {
                const res = await fetch(getAllCentralitiesEndpoint(analysisType, datasetType, version));
                const data = await res.json();
                const cents = data.success ? (data.centralities || []) : [];
                setCentralities(cents);
                if (analysisType === 'gcd' && version !== 'v3') {
                    setSelectedCentrality('overall');
                    fetchCvView('overall');
                }
            } catch {
                setCentralities([]);
            } finally {
                setLoadingCentralities(false);
            }
        };
        fetchCentralities();
    }, [analysisType, datasetType, version, fetchCvView]);

    const handleCentralityChange = (e) => {
        const val = e.target.value;
        setSelectedCentrality(val);
        if (val) fetchCvView(val);
        else setViewData(null);
    };

    return (
        <div className={`flex flex-col border ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Row Header (Toolbar embedded in the row) */}
            <div className={`flex items-center gap-2 p-1.5 px-2.5 border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`}>
                <span className={`text-sm font-semibold whitespace-nowrap min-w-[250px] ${dk ? 'text-slate-200' : 'text-slate-700'}`}>
                    {analysisType === 'gcd'
                        ? (datasetType === 'failure' ? 'Global Causal Comparison (Failure)' : 'Global Causal Comparison (Non-Failure)')
                        : (datasetType === 'failure' ? 'RCD Cluster Comparison (Failure)' : 'RCD Cluster Comparison (Non-Failure)')}
                </span>
                <span className={`w-px h-5 shrink-0 ${dk ? 'bg-white/12' : 'bg-slate-200'}`} />

                {!(analysisType === 'gcd' && version !== 'v3') && (
                    <div className="flex items-center gap-2 shrink-0">
                        <label className={`text-[10px] font-bold uppercase tracking-wider opacity-55 flex items-center gap-1 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                            Centrality{loadingCentralities && <span className="inline-block w-2.5 h-2.5 border-2 border-sky-400/25 border-t-sky-400 animate-spin" />}
                        </label>
                        <select
                            value={selectedCentrality}
                            onChange={handleCentralityChange}
                            disabled={loadingCentralities || centralities.length === 0}
                            className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors min-w-[250px] ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 disabled:text-slate-400'}`}
                        >
                            <option value="">— Select —</option>
                            {centralities.map(c => (
                                <option key={c} value={c}>
                                    {getNodeName(c).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                    <label className={`text-[10px] font-bold uppercase tracking-wider opacity-55 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Aggregation</label>
                    <select
                        value={selectedFile}
                        onChange={(e) => setSelectedFile(e.target.value)}
                        className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors min-w-[250px] ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 disabled:text-slate-400'}`}
                    >
                        {fileList.map(f => (
                            <option key={f} value={f}>{FILE_LABELS[f] || f}</option>
                        ))}
                    </select>
                </div>

                {!(analysisType === 'gcd' && version !== 'v3') && (
                    <div className="flex items-center gap-2 pt-3 shrink-0">
                        <input
                            type="checkbox"
                            id={`cv-filter-${datasetType}-${version}`}
                            checked={filterIncoming}
                            onChange={(e) => setFilterIncoming(e.target.checked)}
                            className="cursor-pointer"
                        />
                        <label htmlFor={`cv-filter-${datasetType}-${version}`} className="m-0 cursor-pointer whitespace-nowrap text-xs">Show Only Incoming</label>
                    </div>
                )}
            </div>

            {/* Row Content */}
            <div className="flex-1 min-h-[400px] flex flex-col">
                {loading && (
                    <div className={`flex flex-col items-center justify-center gap-3 flex-1 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                        <div className={`w-8 h-8 border-[3px] animate-spin ${dk ? 'border-slate-700 border-t-sky-400' : 'border-slate-200 border-t-blue-600'}`} />
                        <p className="text-sm">Fetching data across all windows…</p>
                    </div>
                )}
                {error && <div className={`flex items-center gap-2 p-4 text-red-500 ${dk ? 'bg-red-500/10' : 'bg-red-50'}`}><span>⚠</span> {error}</div>}
                {!loading && !error && !viewData && !(analysisType === 'gcd' && version !== 'v3') && (
                    <div className={`flex-1 flex flex-col items-center justify-center gap-4 p-8 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                        <div className="text-5xl opacity-45">🌐</div>
                        <p className="text-sm text-center">Select a <strong>Centrality</strong> above to compare windows side-by-side.</p>
                    </div>
                )}
                {!loading && !error && viewData && (
                    <div className="flex-1 grid grid-cols-3 gap-2">
                        {WINDOWS.map(win => (
                            <CentralityWindowCard
                                key={win}
                                window={win}
                                windowData={viewData[win]}
                                selectedFile={selectedFile}
                                isDarkMode={isDarkMode}
                                filterIncoming={filterIncoming}
                                selectedCentrality={selectedCentrality}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Standard View ────────────────────────────────────────────────────────────

const StandardView = ({ 
    isDarkMode, 
    analysisType, 
    datasetType, 
    window, 
    centralNode,
    version,
}) => {
    const fileList = version === 'v3' ? LCD_FILES_V3 : (version === 'v1' ? LCD_FILES_V1 : LCD_FILES_V2);

    const [lcdData, setLcdData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(fileList[0]);

    const dk = isDarkMode;
    const label = analysisType === 'gcd' ? 'GCD' : 'LCD';

    useEffect(() => { setLcdData(null); setError(null); setSelectedFile(fileList[0]); }, [analysisType, version]);

    const fetchData = useCallback(async (window, centralNode, datasetType = 'failure') => {
        setLoading(true); setError(null); setLcdData(null);
        try {
            const res = await fetch(getDataEndpoint(analysisType, window, centralNode, datasetType, version));
            const data = await res.json();
            if (data.success) setLcdData(data.files);
            else setError(data.error || `Failed to fetch ${label} data`);
        } catch (err) {
            setError(`Network error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [analysisType, label, version]);

    useEffect(() => {
        if (window && (centralNode || (analysisType === 'gcd' && version !== 'v3'))) {
            fetchData(window, centralNode, datasetType);
        } else {
            setLcdData(null);
        }
    }, [window, centralNode, datasetType, fetchData, analysisType, version]);

    const fileData = lcdData ? lcdData[selectedFile] : null;
    const bMatrixData = fileData && !fileData.error
        ? { columns: fileData.columns, data: fileData.data }
        : null;

    return (
        <>
            {loading && (
                <div className={`flex flex-col items-center justify-center gap-3 py-12 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                    <div className={`w-8 h-8 border-[3px] animate-spin ${dk ? 'border-slate-700 border-t-sky-400' : 'border-slate-200 border-t-blue-600'}`} />
                    <p className="text-sm">Loading {label} cluster data…</p>
                </div>
            )}
            {error && <div className={`flex items-center gap-2 p-4 text-red-500 ${dk ? 'bg-red-500/10' : 'bg-red-50'}`}><span>⚠</span> {error}</div>}
            {!loading && !error && !lcdData && (
                <div className={`flex flex-col items-center justify-center gap-4 py-12 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                    <div className="text-5xl opacity-45">📊</div>
                    <p className="text-sm text-center">Select a <strong>Window</strong> {!(analysisType === 'gcd' && version !== 'v3') && "and "}<strong>Central Node</strong> above to load graphs.</p>
                </div>
            )}
            {!loading && !error && lcdData && (
                <div className="flex flex-col gap-4">
                    <div className={`shadow-sm border overflow-hidden ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`flex items-center justify-between px-4 py-2 border-b ${dk ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${dk ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>XLSX</span>
                            <select
                                className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none appearance-none bg-no-repeat bg-right-1.5 bg-center bg-[length:8px] transition-colors h-7 ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}
                                value={selectedFile}
                                onChange={(e) => setSelectedFile(e.target.value)}
                            >
                                {fileList.map((f) => (
                                    <option key={f} value={f}>{FILE_LABELS[f] || f}</option>
                                ))}
                            </select>
                        </div>
                        {bMatrixData ? (
                            <div className="p-4">
                                <CausalGraphViewer
                                    bMatrixData={bMatrixData}
                                    nodeMapping={NODE_MAPPING_ARRAY}
                                    isDarkMode={isDarkMode}
                                    hideFullScreenControl={false}
                                />
                            </div>
                        ) : (
                            <div className={`flex items-center gap-2 p-4 text-red-500 ${dk ? 'bg-red-500/10' : 'bg-red-50'}`}>
                                <span>⚠</span> {fileData?.error || 'No data available for this file'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Root Component ──────────────────────────────────────────────────────────

const ANALYSIS_TYPES = [
    { key: 'lcd', label: 'LCD' },
    { key: 'gcd', label: 'GCD' },
];

const VERSIONS = [
    { key: 'v1', label: 'V1' },
    { key: 'v2', label: 'V2' },
    { key: 'v3', label: 'V3' },
];

const FourthApp = ({ isDarkMode }) => {
    const [mode, setMode] = useState('standard');
    const [analysisType, setAnalysisType] = useState('lcd');
    const [version, setVersion] = useState('v2');
    const dk = isDarkMode;

    // Standard-view state lifted here so dropdowns live in the toolbar
    const [svDatasetType, setSvDatasetType] = useState('failure');
    const [svWindow, setSvWindow] = useState('');
    const [svCentralNode, setSvCentralNode] = useState('');
    const [svWindows, setSvWindows] = useState([]);
    const [svCentralNodesMap, setSvCentralNodesMap] = useState({});

    // Reset state when analysis type OR version changes
    useEffect(() => {
        setSvWindow('');
        setSvCentralNode('');
        setSvWindows([]);
        setSvCentralNodesMap({});
    }, [analysisType, version]);

    // Fetch standard options
    useEffect(() => {
        if (mode !== 'standard') return;

        const fetchOptions = async () => {
          try {
            const endpoint = getFilesEndpoint(analysisType, svDatasetType, version);
            const response = await fetch(endpoint);
            const data = await response.json();
            if (data.success) {
              setSvWindows(data.windows || []);
              setSvCentralNodesMap(data.central_nodes_map || {});
            }
          } catch (err) {
            console.error('Failed to fetch FourthApp options:', err);
          }
        };
        fetchOptions();
    }, [svDatasetType, analysisType, version, mode]);

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (newMode === 'standard' && svWindows.length === 0) {
            fetch(getFilesEndpoint(analysisType, svDatasetType, version))
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        setSvWindows(data.windows || []);
                        setSvCentralNodesMap(data.central_nodes_map || {});
                    }
                })
                .catch(err => console.error('Failed to fetch FourthApp options:', err));
        }
    };

    const handleVersionChange = (newVersion) => {
        if (newVersion === version) return;
        setVersion(newVersion);
        // Reset all selections when version changes
        setSvWindow('');
        setSvCentralNode('');
        setMode('standard');
    };

    const currentSvCentralNodes = svWindow ? (svCentralNodesMap[svWindow] || []) : [];

    return (
        <div className={`flex flex-col h-full min-h-[calc(100vh-150px)] ${dk ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            {/* ── Ribbon-style toolbar (full width, no gap from ribbon) ── */}
            <div className={`flex items-center gap-3 flex-wrap p-2 px-3 border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {/* Version Toggle */}
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Version</span>
                    <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-200'}`}>
                        {VERSIONS.map(vt => (
                            <button
                                key={vt.key}
                                className={`flex-1 px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    version === vt.key
                                        ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                        : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-50')
                                }`}
                                onClick={() => handleVersionChange(vt.key)}
                                title={vt.key === 'v1' ? 'V1 folders (GTE2 / Weighted etc.)' : (vt.key === 'v2' ? 'V2 folders (50% Median)' : 'V3 folders (Centrality-enabled GCD)')}
                            >
                                {vt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LCD / GCD Toggle */}
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Analysis Type</span>
                    <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-200'}`}>
                        {ANALYSIS_TYPES.map(at => (
                            <button
                                key={at.key}
                                className={`flex-1 px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    analysisType === at.key
                                        ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                        : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-50')
                                }`}
                                onClick={() => setAnalysisType(at.key)}
                            >
                                {at.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>View Mode</span>
                    <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-200'}`}>
                        <button
                            className={`px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                mode === 'standard'
                                    ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                    : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-50')
                            }`}
                            onClick={() => handleModeChange('standard')}
                        >
                            Standard
                        </button>
                        <button
                            className={`px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                                mode === 'centrality'
                                    ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                    : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-50')
                            }`}
                            onClick={() => handleModeChange('centrality')}
                        >
                            Centrality View
                        </button>
                    </div>
                </div>

                {/* Standard-view inline dropdowns (only when in standard mode) */}
                {mode === 'standard' && (
                    <>
                        <div className="flex items-center gap-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Dataset</label>
                            <select
                                value={svDatasetType}
                                onChange={(e) => {
                                    setSvDatasetType(e.target.value);
                                    setSvWindow('');
                                    setSvCentralNode('');
                                }}
                                className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 disabled:text-slate-400'}`}
                            >
                                {DATASET_TYPES.map(dt => (
                                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Window</label>
                            <select
                                value={svWindow}
                                onChange={(e) => {
                                    setSvWindow(e.target.value);
                                    setSvCentralNode('');
                                }}
                                disabled={svWindows.length === 0}
                                className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 disabled:text-slate-400'}`}
                            >
                                <option value="">— Select —</option>
                                {svWindows.map(w => (
                                    <option key={w} value={w}>
                                        {w.charAt(0).toUpperCase() + w.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!(analysisType === 'gcd' && version !== 'v3') && (
                            <div className="flex items-center gap-2">
                                <label className={`text-[10px] font-bold uppercase tracking-wider opacity-60 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Central Node</label>
                                <select
                                    value={svCentralNode}
                                    onChange={(e) => setSvCentralNode(e.target.value)}
                                    disabled={!svWindow}
                                    className={`px-2 py-1.5 text-xs font-medium cursor-pointer outline-none transition-colors ${dk ? 'bg-slate-900 border border-slate-600 text-slate-200 disabled:text-slate-500' : 'bg-white border border-slate-200 text-slate-700 disabled:text-slate-400'}`}
                                >
                                    <option value="">— Select —</option>
                                    {currentSvCentralNodes.map(node => (
                                        <option key={node} value={node}>
                                            {getNodeName(node).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Content ── */}
            {mode === 'standard' && (
                <StandardView 
                    isDarkMode={isDarkMode} 
                    analysisType={analysisType}
                    datasetType={svDatasetType}
                    window={svWindow}
                    centralNode={svCentralNode}
                    version={version}
                />
            )}
            {mode === 'centrality' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <CentralityRow
                        datasetType="failure"
                        analysisType={analysisType}
                        version={version}
                        isDarkMode={isDarkMode}
                    />
                    <CentralityRow
                        datasetType="non_failure"
                        analysisType={analysisType}
                        version={version}
                        isDarkMode={isDarkMode}
                    />
                </div>
            )}
        </div>
    );
};

export default FourthApp;
