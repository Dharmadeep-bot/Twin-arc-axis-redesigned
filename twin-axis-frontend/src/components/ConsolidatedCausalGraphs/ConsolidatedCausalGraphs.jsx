import React, { useState, useEffect, memo, useRef } from 'react';
import CausalGraphViewer from '../shared/CausalGraphViewer';
import { getUnitForVariable, getBackendConfig } from '../../utils/sharedUtils';
import { Clock, Activity, Maximize, Minimize } from 'lucide-react';

const { API_HOST } = getBackendConfig();

// CausalGraphCell: Fetches B-matrix from /api/phase-studies/b-matrix (B_Matrices directory)
const CausalGraphCell = memo(({ gasifier, isDarkMode, studyWindow, hideFullScreenControl = false }) => {
    const [bMatrix, setBMatrix] = useState(null);
    const [nodeMapping, setNodeMapping] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!gasifier || !studyWindow) return;
        const fetchBMatrix = async () => {
            setLoading(true);
            setError(null);
            setBMatrix(null);
            try {
                const res = await fetch(`${API_HOST}/api/phase-studies/b-matrix?gasifier=${encodeURIComponent(gasifier)}&phase=${encodeURIComponent(studyWindow)}`);
                const data = await res.json();
                if (data.success) {
                    setBMatrix(data);
                    setNodeMapping(data.columns.map((col, idx) => ({
                        id: col,
                        name: col,
                        index: idx + 1,
                        unit: getUnitForVariable(col)
                    })));
                } else {
                    setError(data.error || 'No data found');
                }
            } catch (err) {
                console.error('Error fetching phase B-matrix:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBMatrix();
    }, [gasifier, studyWindow]);

    return (
        <div className="relative w-full h-full min-h-[300px] flex flex-col">
            {loading && !bMatrix && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 animate-spin" />
                    <span className="text-xs font-medium">Loading Graph...</span>
                </div>
            )}
            {error && !bMatrix && <span className="text-xs text-red-400 p-3 text-center">No data: {error}</span>}
            {bMatrix && (
                <div className={`mini-graph-container relative w-full h-full flex-1 ${loading ? 'opacity-60' : ''}`}>
                    {loading && (
                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-blue-500/90 text-white text-[9px] font-semibold px-2 py-0.5">
                            <Activity size={10} className="animate-spin" />
                            <span>Updating...</span>
                        </div>
                    )}
                    <CausalGraphViewer
                        bMatrixData={bMatrix}
                        nodeMapping={nodeMapping}
                        isDarkMode={isDarkMode}
                        hideFullScreenControl={hideFullScreenControl}
                        gasifierName={gasifier}
                        phase={studyWindow || 'progression'}
                    />
                </div>
            )}
        </div>
    );
});

const ConsolidatedCausalGraphs = memo(({ selectedGasifiers, sequence = [], isDarkMode, phase: initialPhase, playbackSpeed, setPlaybackSpeed }) => {
    // Each "frame" is { gasifier, phase }
    const [frames, setFrames] = useState([]);
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [phase, setPhase] = useState(initialPhase || 'early');
    const containerRef = useRef(null);
    const [isViewFullScreen, setIsViewFullScreen] = useState(false);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [availableGasifiers, setAvailableGasifiers] = useState([]);
    const [selectedGasifiersList, setSelectedGasifiersList] = useState(selectedGasifiers || []);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch all available gasifiers
    useEffect(() => {
        const fetchGasifiers = async () => {
            try {
                const res = await fetch(`${API_HOST}/api/phase-studies/gasifiers`);
                const data = await res.json();
                if (data.success && data.gasifiers) {
                    setAvailableGasifiers(data.gasifiers);
                }
            } catch (e) {
                console.error('Error fetching gasifiers:', e);
            }
        };
        fetchGasifiers();
    }, []);

    // Update selected gasifiers list when prop changes
    useEffect(() => {
        if (selectedGasifiers && selectedGasifiers.length > 0) {
            setSelectedGasifiersList(selectedGasifiers);
        }
    }, [selectedGasifiers]);

    const handleToggleFullScreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handler = () => setIsViewFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    useEffect(() => {
        setPhase(initialPhase);
    }, [initialPhase]);

    useEffect(() => {
        let timer;
        if (isPlaying && frames.length > 0) {
            timer = setInterval(() => {
                setCurrentFrameIdx(prev => (prev + 1) % frames.length);
            }, 1000 / playbackSpeed);
        }
        return () => clearInterval(timer);
    }, [isPlaying, frames, playbackSpeed]);

    // Build frames from selected gasifiers + phase selection
    useEffect(() => {
        const buildFrames = async () => {
            if (selectedGasifiersList.length === 0) {
                setFrames([]);
                return;
            }
            const targetGasifiers = sequence.length > 0 ? sequence : selectedGasifiersList;
            const phasesToUse = phase === 'all' ? ['early', 'mid', 'late'] : [phase];

            const newFrames = [];
            for (const gasifier of targetGasifiers) {
                // Verify which phases actually exist for this gasifier
                try {
                    const res = await fetch(`${API_HOST}/api/phase-studies/phases?gasifier=${encodeURIComponent(gasifier)}`);
                    const data = await res.json();
                    const availablePhases = data.success ? data.phases : phasesToUse;
                    for (const p of phasesToUse) {
                        if (availablePhases.includes(p)) {
                            newFrames.push({ gasifier, phase: p });
                        }
                    }
                } catch (e) {
                    // Fallback: add frames for all requested phases
                    for (const p of phasesToUse) {
                        newFrames.push({ gasifier, phase: p });
                    }
                }
            }

            setFrames(newFrames);
            setCurrentFrameIdx(0);
        };
        buildFrames();
    }, [selectedGasifiersList, sequence, phase]);

    const currentFrame = frames[currentFrameIdx] || {};
    const dk = isDarkMode;

    return (
        <div ref={containerRef} className={`flex flex-col h-full min-h-[calc(100vh-150px)] ${isViewFullScreen ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900' : ''}`}>
            {/* Toolbar - Ribbon-style extension */}
            <div className={`flex items-center justify-between px-4 py-2 shrink-0 border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {/* Left: Empty for sidebar */}
                <div />
                
                {/* Right: Playback Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Phase selector */}
                    <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-300'}`}>
                        {['early', 'mid', 'late', 'all'].map(p => (
                            <button
                                key={p}
                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    phase === p
                                        ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                        : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-500 hover:bg-slate-100')
                                }`}
                                onClick={() => setPhase(p)}
                            >
                                {p.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Speed controls */}
                    <div className={`flex items-center gap-1.5 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Clock size={14} />
                        <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-300'}`}>
                            {[0.25, 0.75, 1, 1.5, 2].map(speed => (
                                <button
                                    key={speed}
                                    className={`px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                        playbackSpeed === speed
                                            ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                            : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-500 hover:bg-slate-100')
                                    }`}
                                    onClick={() => setPlaybackSpeed(speed)}
                                >
                                    {speed === 1 ? '1x' : speed + 'x'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Play/Pause */}
                    <button
                        className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            isPlaying
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : (dk ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white')
                        }`}
                        onClick={() => setIsPlaying(!isPlaying)}
                    >
                        {isPlaying ? 'PAUSE' : 'PLAY'}
                    </button>

                    {/* Progress bar */}
                    <div className="flex flex-col gap-1">
                        <div
                            className="flex gap-px h-2.5 min-w-[200px] relative"
                            onMouseLeave={() => setHoverInfo(null)}
                        >
                            {frames.map((frame, idx) => (
                                <div
                                    key={`${frame.gasifier}-${frame.phase}-${idx}`}
                                    className={`flex-1 cursor-pointer transition-colors ${
                                        idx === currentFrameIdx
                                            ? 'bg-blue-500'
                                            : idx < currentFrameIdx
                                                ? (dk ? 'bg-slate-500' : 'bg-slate-300')
                                                : (dk ? 'bg-slate-700' : 'bg-slate-200')
                                    }`}
                                    onMouseEnter={() => setHoverInfo({ ...frame, index: idx })}
                                    onClick={() => setCurrentFrameIdx(idx)}
                                />
                            ))}
                            {hoverInfo && (
                                <div className={`absolute -top-16 left-1/2 -translate-x-1/2 z-20 px-3 py-2 shadow-lg text-[10px] whitespace-nowrap flex flex-col items-center gap-0.5 ${dk ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'}`}>
                                    <span className="font-bold">{hoverInfo.gasifier?.toUpperCase()}</span>
                                    <span className="text-blue-500 font-semibold">{hoverInfo.phase?.toUpperCase()} PHASE</span>
                                    <span className={dk ? 'text-slate-400' : 'text-slate-500'}>FRAME {hoverInfo.index + 1} / {frames.length}</span>
                                </div>
                            )}
                        </div>
                        <div className={`text-[10px] font-mono text-right ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                            {currentFrameIdx + 1} / {frames.length}
                        </div>
                    </div>

                    {/* Fullscreen */}
                    <button
                        className={`p-1.5 transition-colors ${dk ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                        onClick={handleToggleFullScreen}
                        title="Toggle Fullscreen"
                    >
                        {isViewFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                </div>
            </div>

            {/* Main Content Area with Sidebar */}
            <div className="flex flex-1 min-h-0">
                {/* Left Sidebar - Gasifier Selection & Sequence */}
                <div className={`shrink-0 w-[280px] flex flex-col border-r ${dk ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <div className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b ${dk ? 'text-slate-400 border-slate-700 bg-slate-800' : 'text-slate-500 border-slate-200 bg-slate-50'}`}>GASIFIERS & SEQUENCE</div>
                    <div className="flex flex-col gap-4 p-4 flex-1">
                        {/* Gasifier Selection */}
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Gasifiers</label>
                            <div className={`relative`} ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${dk ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                >
                                    <span>{selectedGasifiersList.length > 0 ? `${selectedGasifiersList.length} selected` : 'Select Gasifiers'}</span>
                                    <span>▼</span>
                                </button>
                                {isDropdownOpen && (
                                    <div className={`absolute top-full left-0 mt-1 w-full p-2 shadow-lg z-50 ${dk ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Select Gasifiers</span>
                                            {selectedGasifiersList.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedGasifiersList([])}
                                                    className="text-[10px] text-blue-500 hover:text-blue-600 font-semibold"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                        <div className="overflow-y-auto">
                                            {availableGasifiers.map(g => (
                                                <label key={g} className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${dk ? 'text-slate-200' : 'text-slate-700'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedGasifiersList.includes(g)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedGasifiersList([...selectedGasifiersList, g]);
                                                            } else {
                                                                setSelectedGasifiersList(selectedGasifiersList.filter(item => item !== g));
                                                            }
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <span className="text-xs">{g.toUpperCase()}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sequence Display */}
                        <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Playback Sequence</label>
                            <div className="flex flex-col gap-1">
                                {selectedGasifiersList.map((g, i) => (
                                    <div key={g} className={`flex items-center justify-between px-2 py-1 text-xs ${dk ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                        <span>{i + 1}. {g.toUpperCase()}</span>
                                        <button
                                            onClick={() => setSelectedGasifiersList(selectedGasifiersList.filter(item => item !== g))}
                                            className="text-red-400 hover:text-red-500"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {selectedGasifiersList.length === 0 && (
                                    <div className={`text-[10px] text-center py-2 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                                        No gasifiers selected
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right - Causal Graph Display */}
                <div className={`flex-1 min-w-0 flex flex-col ${dk ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <div className="flex-1 overflow-hidden">
                        {selectedGasifiersList.length > 0 ? (
                            <div className="w-full h-full flex flex-col">
                                {currentFrame.gasifier ? (
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
                                            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 ${dk ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                                <Activity size={12} />
                                                <span>NOW VIEWING: {currentFrame.gasifier?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-500/10 text-blue-500">
                                                {currentFrame.phase?.toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <CausalGraphCell
                                                gasifier={currentFrame.gasifier}
                                                studyWindow={currentFrame.phase}
                                                isDarkMode={isDarkMode}
                                                hideFullScreenControl={true}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
                                        <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 animate-spin" />
                                        <span className="text-xs">Generating timeline...</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={`flex-1 flex flex-col items-center justify-center gap-4 p-8 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                                <Clock size={48} strokeWidth={1} />
                                <h3 className="text-lg font-semibold">No Gasifiers Selected</h3>
                                <p className="text-sm max-w-md text-center">Please select one or more gasifiers from the sidebar to begin the sequential timelapse analysis.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ConsolidatedCausalGraphs;
export { CausalGraphCell };
