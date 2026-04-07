import { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import { Sidebar } from './components/Sidebar';
import { Maximize2, Info } from 'lucide-react';
import _ from 'lodash';

// --- Types ---
type DataRow = Record<string, any>;

interface SegmentStats {
    count: number;
    mean: number;
    std: number;
    min: number;
    max: number;
}

// --- Helper: Simple 1D KDE for Marginals ---
function kernelDensityEstimator(kernel: any, X: number[]) {
    return function (V: number[]) {
        return X.map(x => V.reduce((sum, v) => sum + kernel(x - v), 0) / V.length);
    };
}
function kernelGaussian(u: number) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}
function silvermanBandwidth(data: number[]) {
    const n = data.length;
    if (n === 0) return 1;
    const mean = _.mean(data);
    const std = Math.sqrt(_.sum(data.map(x => (x - mean) ** 2)) / n);
    return 1.06 * std * Math.pow(n, -0.2);
}

function computeKDE(data: number[], points: number[]) {
    if (data.length < 2) return points.map(() => 0);
    // Optimization: sampling for large datasets during KDE
    const sampleSize = 1000;
    const sampledData = data.length > sampleSize ? _.sampleSize(data, sampleSize) : data;

    const bw = silvermanBandwidth(sampledData);
    const kde = kernelDensityEstimator(
        (u: number) => kernelGaussian(u / bw) / bw,
        points
    );
    return kde(sampledData);
}


function App() {
    // Data State
    const [data, setData] = useState<DataRow[]>([]);
    const [filename, setFilename] = useState<string | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [numericCols, setNumericCols] = useState<string[]>([]);
    const [timeCol, setTimeCol] = useState<string>('');

    // Config State
    const [xCol, setXCol] = useState('');
    const [yCol, setYCol] = useState('');
    const [windowSize, setWindowSize] = useState(30);
    const [currentStep, setCurrentStep] = useState(0);

    const handleUpload = (file: File) => {
        setFilename(file.name);
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rawData = results.data as DataRow[];
                if (rawData.length === 0) return;

                const cols = Object.keys(rawData[0]);
                setColumns(cols);

                // Detect Numeric Columns
                const numCols = cols.filter(c => {
                    return typeof rawData[0][c] === 'number';
                });
                setNumericCols(numCols);

                // Detect Time Column
                const tCol = cols.find(c => c.toLowerCase().includes('time') || c.toLowerCase().includes('date')) || cols[0];
                setTimeCol(tCol);

                const sortedData = _.sortBy(rawData, [tCol]);
                setData(sortedData);

                // Set Defaults
                if (numCols.length >= 2) {
                    setXCol(numCols[0]);
                    setYCol(numCols[1]);
                }
                setWindowSize(5);
                setCurrentStep(sortedData.length - 1);
            }
        });
    };

    // --- Compute Segments ---
    const { segments, stats } = useMemo(() => {
        if (!data.length || !xCol || !yCol) {
            return { segments: { recent: [], mid: [], prev: [] }, stats: {} };
        }

        const recEnd = Math.floor(currentStep);
        const recStart = Math.max(0, recEnd - windowSize);
        const midEnd = recStart;
        const midStart = Math.max(0, midEnd - windowSize);
        // ACCUMULATION LOGIC: Previous always starts at 0
        const prevEnd = midStart;
        const prevStart = 0;

        // Slices
        const recent = data.slice(recStart, recEnd + 1);
        const mid = data.slice(midStart, midEnd);
        const prev = data.slice(prevStart, prevEnd);

        const calcStats = (arr: DataRow[]): SegmentStats => {
            if (!arr.length) return { count: 0, mean: 0, std: 0, min: 0, max: 0 };
            const vals = arr.map(d => d[xCol] as number).filter(v => typeof v === 'number');
            if (!vals.length) return { count: 0, mean: 0, std: 0, min: 0, max: 0 };
            const mean = _.mean(vals);
            return {
                count: vals.length,
                mean: mean,
                std: Math.sqrt(_.mean(vals.map(v => (v - mean) ** 2))),
                min: _.min(vals) || 0,
                max: _.max(vals) || 0
            };
        };

        return {
            segments: { recent, mid, prev },
            stats: {
                'Recent': calcStats(recent),
                'Mid': calcStats(mid),
                'Previous': calcStats(prev)
            }
        };
    }, [data, currentStep, windowSize, xCol, yCol]);

    // --- Generate Plot Data ---
    const plotData = useMemo(() => {
        if (!xCol || !yCol) return [];

        const traces: any[] = [];
        const colors = {
            'Previous': '#2ca02c', // Green
            'Mid': '#ff7f0e',      // Orange
            'Recent': '#00F0FF'    // Cyan
        };

        const segMap = [
            { name: 'Previous', data: segments.prev, color: colors['Previous'] },
            { name: 'Mid', data: segments.mid, color: colors['Mid'] },
            { name: 'Recent', data: segments.recent, color: colors['Recent'] }
        ];

        segMap.forEach(seg => {
            if (seg.data.length < 2 && seg.name !== 'Previous') return; // Allow previous to be sparse
            if (seg.name === 'Previous' && seg.data.length === 0) return;

            const x = seg.data.map(d => d[xCol]);
            const y = seg.data.map(d => d[yCol]);

            // 1. Scatter
            traces.push({
                x, y,
                mode: 'markers',
                name: seg.name,
                type: 'scatter',
                marker: { color: seg.color, size: 4, opacity: 0.7 },
                legendgroup: seg.name,
                showlegend: true, // Only show legend for the main scatter points
                xaxis: 'x', yaxis: 'y'
            });

            // 2. Contour (KDE 2D) - Hide for Previous if too large? 
            if (seg.data.length > 5 && seg.data.length < 5000) {
                traces.push({
                    x, y,
                    type: 'histogram2dcontour',
                    colorscale: [[0, 'rgba(0,0,0,0)'], [1, seg.color]],
                    showscale: false,
                    ncontours: 5,
                    contours: { coloring: 'lines' },
                    line: { width: 1, color: seg.color },
                    legendgroup: seg.name,
                    showlegend: false,
                    hoverinfo: 'skip',
                    xaxis: 'x', yaxis: 'y'
                });
            }

            // 3. X Density
            const xMin = _.min(x) || 0;
            const xMax = _.max(x) || 1;
            const xGrid = _.range(xMin, xMax, (xMax - xMin) / 30);
            const yDensity = computeKDE(x, xGrid);

            traces.push({
                x: xGrid,
                y: yDensity,
                mode: 'lines',
                line: { color: seg.color, width: 1 },
                fill: 'tozeroy',
                legendgroup: seg.name,
                showlegend: false,
                hoverinfo: 'skip',
                xaxis: 'x',
                yaxis: 'y2'
            });

            // 4. Y Density
            const yMin = _.min(y) || 0;
            const yMax = _.max(y) || 1;
            const yGrid = _.range(yMin, yMax, (yMax - yMin) / 30);
            const xDensity = computeKDE(y, yGrid);

            traces.push({
                x: xDensity,
                y: yGrid,
                mode: 'lines',
                line: { color: seg.color, width: 1 },
                fill: 'tozerox',
                legendgroup: seg.name,
                showlegend: false,
                hoverinfo: 'skip',
                orientation: 'h',
                xaxis: 'x2',
                yaxis: 'y'
            });
        });

        return traces;

    }, [segments, xCol, yCol]);

    const currentDateLabel = data[Math.floor(currentStep)] ? String(data[Math.floor(currentStep)][timeCol]) : "N/A";

    // Legend configuration added here
    const layout: any = {
        grid: { rows: 2, columns: 2, pattern: 'independent' },
        xaxis: { domain: [0, 0.82], title: xCol, gridcolor: '#1E293B' },
        yaxis: { domain: [0, 0.82], title: yCol, gridcolor: '#1E293B' },
        xaxis2: { domain: [0.83, 1], showgrid: false, showticklabels: false },
        yaxis2: { domain: [0.83, 1], showgrid: false, showticklabels: false },
        showlegend: true,
        legend: {
            x: 0,
            y: 1,
            xanchor: 'left',
            bgcolor: 'rgba(0,0,0,0.5)',
            font: { color: '#ffffff' }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#94A3B8' },
        autosize: true,
        hovermode: 'closest',
        margin: { l: 40, r: 10, t: 10, b: 40 },
    };


    return (
        <div className="flex h-screen bg-bg text-white font-sans overflow-hidden">
            <Sidebar
                onUpload={handleUpload}
                columns={columns}
                numericCols={numericCols}
                xCol={xCol} setXCol={setXCol}
                yCol={yCol} setYCol={setYCol}
                windowSize={windowSize} setWindowSize={setWindowSize}
                maxWindow={Math.floor(data.length / 2)}
                filename={filename}
            />

            <div className="flex-1 flex gap-4 p-4 min-w-0">
                <main className="flex-1 flex flex-col min-w-0 gap-4">
                    <header className="flex items-center justify-between glass-panel p-4 rounded-lg">
                        <div>
                            <h1 className="text-xl font-bold text-accent">Distribution Analysis</h1>
                            <p className="text-secondary text-xs">Visualize temporal shifts in data density</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-[10px] uppercase text-secondary mb-1">Current Timestamp</div>
                                <div className="font-mono text-accent text-lg leading-none">{currentDateLabel}</div>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 glass-panel rounded-lg p-2 relative flex flex-col min-h-0">
                        {data.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-secondary">
                                <Maximize2 size={48} className="mb-4 opacity-50" />
                                <p>Select a dataset to begin visualization</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col h-full relative">
                                <div className="flex-1 min-h-0">
                                    <Plot
                                        data={plotData}
                                        layout={layout}
                                        useResizeHandler={true}
                                        style={{ width: "100%", height: "100%" }}
                                        config={{ displayModeBar: false }}
                                    />
                                </div>

                                {/* Manual Slider Control */}
                                <div className="h-10 px-4 flex items-center gap-4 bg-surface/30 border-t border-border mt-2 rounded-b">
                                    <span className="text-xs text-secondary whitespace-nowrap">Time Scrub</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={data.length - 1}
                                        step={1}
                                        value={currentStep}
                                        onChange={(e) => setCurrentStep(Number(e.target.value))}
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                                    />
                                    <span className="text-xs font-mono text-accent w-12 text-right">
                                        {Math.floor((currentStep / (data.length - 1)) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                <aside className="w-80 flex flex-col gap-4">
                    <div className="glass-panel rounded-lg p-4">
                        <h3 className="text-secondary text-xs uppercase font-bold mb-4 flex items-center justify-between">
                            <span>Distribution Detail</span>
                            <Info size={14} />
                        </h3>

                        <div className="space-y-4">
                            {['Recent', 'Mid', 'Previous'].map(segName => {
                                const s = stats[segName as keyof typeof stats];
                                if (!s) return null;
                                const color = segName === 'Recent' ? 'text-accent' : segName === 'Mid' ? 'text-orange-500' : 'text-green-500';

                                return (
                                    <div key={segName} className="bg-surface/50 border border-border rounded p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-sm font-bold ${color}`}>{segName}</span>
                                            <span className="text-[10px] bg-dark px-2 py-0.5 rounded text-gray-400">{s.count} pts</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-secondary">Mean</span>
                                                <span className="font-mono text-gray-300">{s.mean.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-secondary">Std</span>
                                                <span className="font-mono text-gray-300">{s.std.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-secondary">Min</span>
                                                <span className="font-mono text-gray-300">{s.min.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-secondary">Max</span>
                                                <span className="font-mono text-gray-300">{s.max.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default App;
