import React, { useState, useRef, useCallback, useMemo } from 'react';

// ─── Color palette for task bars ───
const BAR_COLORS = ['red', 'green', 'blue', 'orange', 'purple', 'teal', 'pink', 'amber'];

// ─── Bar color styles for light/dark modes ───
const BAR_COLOR_STYLES = {
    red:    { light: { bg: '#fca5a5', border: '#ef4444' }, dark: { bg: '#991b1b', border: '#ef4444' } },
    green:  { light: { bg: '#86efac', border: '#22c55e' }, dark: { bg: '#166534', border: '#22c55e' } },
    blue:   { light: { bg: '#93c5fd', border: '#3b82f6' }, dark: { bg: '#1e3a8a', border: '#3b82f6' } },
    orange: { light: { bg: '#fdba74', border: '#f97316' }, dark: { bg: '#9a3412', border: '#f97316' } },
    purple: { light: { bg: '#c4b5fd', border: '#8b5cf6' }, dark: { bg: '#581c87', border: '#8b5cf6' } },
    teal:   { light: { bg: '#5eead4', border: '#14b8a6' }, dark: { bg: '#134e4a', border: '#14b8a6' } },
    pink:   { light: { bg: '#f9a8d4', border: '#ec4899' }, dark: { bg: '#831843', border: '#ec4899' } },
    amber:  { light: { bg: '#fcd34d', border: '#f59e0b' }, dark: { bg: '#78350f', border: '#f59e0b' } },
};

// ─── Phase sub-bar colors ───
const PHASE_COLORS = {
    early: { bg: '#22c55e', label: 'Early' },   // green
    mid: { bg: '#f59e0b', label: 'Mid' },      // amber/orange
    late: { bg: '#ef4444', label: 'Late' },      // red
};

// ─── Utility helpers ───
function daysBetween(a, b) {
    const msDay = 86400000;
    return Math.round((b - a) / msDay);
}

function formatDate(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

function addDays(date, days) {
    const r = new Date(date);
    r.setDate(r.getDate() + days);
    return r;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isWeekend(date) {
    const d = date.getDay();
    return d === 0 || d === 6;
}

// ─── Determine if a task has children (is a parent/summary task) ───
function buildHasChildrenMap(tasks) {
    const map = {};
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        // A task is a parent if the next task has a higher level
        if (i + 1 < tasks.length && tasks[i + 1].level > task.level) {
            map[i] = true;
        }
    }
    return map;
}

const ROW_H = 36;
const TASK_PANEL_W = 420;
const TASK_GRID_COLS = '2fr 80px 90px 90px';

export default function GanttChart({ tasks, isDarkMode }) {
    const [scale, setScale] = useState('day'); // 'day' or 'week'
    const [collapsed, setCollapsed] = useState({});
    const [tooltip, setTooltip] = useState(null);

    const taskListRef = useRef(null);
    const timelineBodyRef = useRef(null);
    const timelineHeaderRef = useRef(null);

    const dk = isDarkMode;
    const cellWidth = scale === 'day' ? 32 : 80;

    // ─── Compute date range ───
    const { minDate, maxDate, totalDays, dateColumns } = useMemo(() => {
        let min = Infinity, max = -Infinity;
        tasks.forEach(t => {
            if (t.start < min) min = t.start.getTime();
            if (t.end > max) max = t.end.getTime();
        });
        const minD = addDays(new Date(min), -2);
        const maxD = addDays(new Date(max), 3);
        minD.setHours(0, 0, 0, 0);
        maxD.setHours(0, 0, 0, 0);
        const total = daysBetween(minD, maxD) + 1;

        const cols = [];
        for (let i = 0; i < total; i++) {
            cols.push(addDays(minD, i));
        }
        return { minDate: minD, maxDate: maxD, totalDays: total, dateColumns: cols };
    }, [tasks]);

    // ─── Compute month spans for header ───
    const monthSpans = useMemo(() => {
        const spans = [];
        let currentMonth = -1, currentYear = -1, count = 0;
        dateColumns.forEach((d, i) => {
            const m = d.getMonth(), y = d.getFullYear();
            if (m !== currentMonth || y !== currentYear) {
                if (count > 0) {
                    spans.push({ label: `${MONTH_NAMES[currentMonth]} ${currentYear}`, count });
                }
                currentMonth = m;
                currentYear = y;
                count = 1;
            } else {
                count++;
            }
        });
        if (count > 0) {
            spans.push({ label: `${MONTH_NAMES[currentMonth]} ${currentYear}`, count });
        }
        return spans;
    }, [dateColumns]);

    // ─── Build visible tasks (respecting collapsed parents) ───
    const hasChildrenMap = useMemo(() => buildHasChildrenMap(tasks), [tasks]);

    const visibleTasks = useMemo(() => {
        const result = [];
        let skipBelow = Infinity;

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.level > skipBelow) continue;
            skipBelow = Infinity;

            result.push({ ...task, originalIndex: i });

            if (hasChildrenMap[i] && collapsed[i]) {
                skipBelow = task.level;
            }
        }
        return result;
    }, [tasks, collapsed, hasChildrenMap]);

    // ─── Sync vertical scroll between task list and timeline ───
    const syncScroll = useCallback((source) => {
        if (source === 'list' && taskListRef.current && timelineBodyRef.current) {
            timelineBodyRef.current.scrollTop = taskListRef.current.scrollTop;
        } else if (source === 'timeline' && timelineBodyRef.current && taskListRef.current) {
            taskListRef.current.scrollTop = timelineBodyRef.current.scrollTop;
        }
        // sync horizontal header
        if (timelineBodyRef.current && timelineHeaderRef.current) {
            timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
        }
    }, []);

    const toggleCollapse = (idx) => {
        setCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    // ─── Bar position calculator ───
    const getBarStyle = useCallback((task) => {
        const startOffset = daysBetween(minDate, task.start);
        const duration = daysBetween(task.start, task.end) + 1;
        return {
            left: startOffset * cellWidth,
            width: Math.max(duration * cellWidth - 2, 4),
        };
    }, [minDate, cellWidth]);

    // ─── Phase sub-bar position (relative to the main bar) ───
    const getPhaseStyle = useCallback((task, phase) => {
        const taskStart = task.start;
        const taskDuration = daysBetween(task.start, task.end) + 1;
        const phaseStartOffset = daysBetween(taskStart, phase.start);
        const phaseDuration = daysBetween(phase.start, phase.end) + 1;
        const leftPct = (phaseStartOffset / taskDuration) * 100;
        const widthPct = (phaseDuration / taskDuration) * 100;
        return {
            left: `${Math.max(0, leftPct)}%`,
            width: `${Math.min(widthPct, 100 - leftPct)}%`,
        };
    }, []);

    // ─── Assign colors to level-2 groups ───
    const taskColorMap = useMemo(() => {
        const map = {};
        let colorIdx = 0;
        let currentParentColor = BAR_COLORS[0];

        tasks.forEach((t, i) => {
            if (t.level === 2) {
                currentParentColor = BAR_COLORS[colorIdx % BAR_COLORS.length];
                colorIdx++;
                map[i] = currentParentColor;
            } else if (t.level === 3) {
                map[i] = currentParentColor;
            } else if (t.level <= 1) {
                // For flat data (no hierarchy), assign rotating colors
                map[i] = BAR_COLORS[colorIdx % BAR_COLORS.length];
                colorIdx++;
            }
        });
        return map;
    }, [tasks]);

    const handleBarHover = (e, task) => {
        setTooltip({
            x: e.clientX + 12,
            y: e.clientY - 10,
            task,
        });
    };

    const handleBarLeave = () => {
        setTooltip(null);
    };

    const totalWidth = totalDays * cellWidth;

    // Check if any tasks have phase data (Early/Mid/Late)
    const hasPhases = useMemo(() => tasks.some(t => t.phases && t.phases.length > 0), [tasks]);

    return (
        <div className={`w-full h-full flex flex-col shadow-lg overflow-hidden font-sans ${dk ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`}>
            {/* Toolbar */}
            <div className={`flex items-center justify-between px-5 py-3 shrink-0 border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`flex items-center gap-2.5 text-sm font-semibold ${dk ? 'text-slate-100' : 'text-slate-800'}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="9" y1="4" x2="9" y2="20" />
                    </svg>
                    Project Gantt Chart
                </div>
                {/* Phase color legend */}
                {hasPhases && (
                    <div className="flex items-center gap-4 text-xs font-medium">
                        {Object.entries(PHASE_COLORS).map(([key, { bg, label }]) => (
                            <div key={key} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 shrink-0" style={{ background: bg }} />
                                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className={`flex overflow-hidden border ${dk ? 'border-slate-600' : 'border-slate-300'}`}>
                    {['day', 'week'].map(s => (
                        <button
                            key={s}
                            onClick={() => setScale(s)}
                            className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                                scale === s
                                    ? (dk ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white')
                                    : (dk ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100')
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Container */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT: Task Panel */}
                <div
                    className={`shrink-0 flex flex-col border-r ${dk ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
                    style={{ width: TASK_PANEL_W }}
                >
                    <div
                        className={`grid text-[10px] font-bold uppercase tracking-wider shrink-0 border-b ${dk ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                        style={{ gridTemplateColumns: TASK_GRID_COLS, height: 54 }}
                    >
                        <div className="flex items-center px-3">Gasifier Name</div>
                        <div className="flex items-center justify-center">Duration</div>
                        <div className="flex items-center justify-center">Start</div>
                        <div className="flex items-center justify-center">End</div>
                    </div>
                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden"
                        ref={taskListRef}
                        onScroll={() => syncScroll('list')}
                    >
                        {visibleTasks.map((task) => {
                            const idx = task.originalIndex;
                            const indent = task.level * 16;
                            const isParent = hasChildrenMap[idx];
                            const isL1 = task.level <= 1;

                            return (
                                <div
                                    key={idx}
                                    className={`grid items-center border-b text-xs transition-colors ${
                                        dk
                                            ? `border-slate-800 ${isL1 ? 'bg-slate-800/50' : ''} hover:bg-slate-800`
                                            : `border-slate-100 ${isL1 ? 'bg-slate-50' : ''} hover:bg-blue-50/50`
                                    }`}
                                    style={{ gridTemplateColumns: TASK_GRID_COLS, height: ROW_H }}
                                >
                                    <div
                                        className={`flex items-center gap-1 overflow-hidden whitespace-nowrap ${isL1 ? 'font-bold' : 'font-normal'} ${dk ? 'text-slate-200' : 'text-slate-700'}`}
                                        style={{ paddingLeft: 8 + indent }}
                                        title={task.name}
                                    >
                                        {isParent && (
                                            <button
                                                onClick={() => toggleCollapse(idx)}
                                                className={`w-4 h-4 flex items-center justify-center text-[9px] shrink-0 transition-colors ${dk ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-700' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-200'}`}
                                            >
                                                {collapsed[idx] ? '▶' : '▼'}
                                            </button>
                                        )}
                                        <span className="overflow-hidden text-ellipsis">
                                            {task.name}
                                        </span>
                                    </div>
                                    <div className={`text-center text-[11px] ${dk ? 'text-slate-400' : 'text-slate-500'}`}>{task.duration}</div>
                                    <div className={`text-center text-[11px] tabular-nums ${dk ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(task.start)}</div>
                                    <div className={`text-center text-[11px] tabular-nums ${dk ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(task.end)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: Timeline Panel */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Timeline Header */}
                    <div className="shrink-0 overflow-hidden" ref={timelineHeaderRef}>
                        <div style={{ width: totalWidth }}>
                            {/* Month row */}
                            <div className={`flex border-b ${dk ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`} style={{ height: 28 }}>
                                {monthSpans.map((span, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-center text-[10px] font-bold uppercase tracking-wider border-r shrink-0 ${dk ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'}`}
                                        style={{ width: span.count * cellWidth }}
                                    >
                                        {span.label}
                                    </div>
                                ))}
                            </div>
                            {/* Day row */}
                            <div className={`flex border-b ${dk ? 'border-slate-700' : 'border-slate-200'}`} style={{ height: 26 }}>
                                {dateColumns.map((d, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-center text-[9px] font-medium border-r shrink-0 ${
                                            isWeekend(d)
                                                ? (dk ? 'bg-slate-800/80 text-slate-500 border-slate-700' : 'bg-amber-50 text-slate-400 border-slate-200')
                                                : (dk ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')
                                        }`}
                                        style={{ width: cellWidth }}
                                    >
                                        {scale === 'day'
                                            ? DAY_LABELS[d.getDay()]
                                            : (d.getDay() === 1 ? `${d.getDate()}` : '')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Timeline Body */}
                    <div
                        className="flex-1 overflow-auto"
                        ref={timelineBodyRef}
                        onScroll={() => syncScroll('timeline')}
                    >
                        <div style={{ width: totalWidth }}>
                            {visibleTasks.map((task) => {
                                const idx = task.originalIndex;
                                const barStyle = getBarStyle(task);
                                const isParent = hasChildrenMap[idx];
                                const color = taskColorMap[idx] || 'blue';
                                const cs = BAR_COLOR_STYLES[color]?.[dk ? 'dark' : 'light'] || BAR_COLOR_STYLES.blue[dk ? 'dark' : 'light'];

                                return (
                                    <div className="flex relative" key={idx} style={{ height: ROW_H }}>
                                        {/* Grid cells */}
                                        {dateColumns.map((d, ci) => (
                                            <div
                                                key={ci}
                                                className={`shrink-0 border-r border-b ${
                                                    isWeekend(d)
                                                        ? (dk ? 'bg-slate-800/40 border-slate-800' : 'bg-amber-50/50 border-slate-100')
                                                        : (dk ? 'border-slate-800' : 'border-slate-100')
                                                }`}
                                                style={{ width: cellWidth }}
                                            />
                                        ))}

                                        {/* Task bar */}
                                        <div
                                            className="absolute flex items-center cursor-pointer"
                                            style={{ left: barStyle.left, width: barStyle.width, top: 4, bottom: 4 }}
                                            onMouseEnter={(e) => handleBarHover(e, task)}
                                            onMouseMove={(e) => handleBarHover(e, task)}
                                            onMouseLeave={handleBarLeave}
                                        >
                                            {isParent ? (
                                                <div className={`w-full h-2.5 my-auto ${dk ? 'bg-slate-500' : 'bg-slate-400'}`} />
                                            ) : (
                                                <div
                                                    className="w-full h-full relative overflow-hidden"
                                                    style={{ background: cs.bg, border: `1px solid ${cs.border}` }}
                                                >
                                                    {/* Progress fill (shown when no phases) */}
                                                    {(!task.phases || task.phases.length === 0) && (
                                                        <div
                                                            className="absolute top-0 left-0 h-full opacity-40"
                                                            style={{ width: `${task.progress || 0}%`, background: cs.border }}
                                                        />
                                                    )}
                                                    {/* Phase colored segments inside the bar (Early / Mid / Late) */}
                                                    {task.phases && task.phases.length > 0 && task.phases.map(phase => {
                                                        const phaseColor = PHASE_COLORS[phase.key] || { bg: '#888' };
                                                        const taskDuration = daysBetween(task.start, task.end) + 1;
                                                        const startOffset = daysBetween(task.start, phase.start);
                                                        const phaseDuration = daysBetween(phase.start, phase.end) + 1;
                                                        const leftPct = Math.max(0, (startOffset / taskDuration) * 100);
                                                        const widthPct = Math.min((phaseDuration / taskDuration) * 100, 100 - leftPct);
                                                        return (
                                                            <div
                                                                key={phase.key}
                                                                className="absolute top-0 bottom-0"
                                                                style={{
                                                                    left: `${leftPct}%`,
                                                                    width: `${widthPct}%`,
                                                                    background: phaseColor.bg,
                                                                    zIndex: 2,
                                                                }}
                                                                title={`${phaseColor.label}: ${formatDate(phase.start)} – ${formatDate(phase.end)}`}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className={`fixed z-50 px-4 py-3 shadow-xl text-xs pointer-events-none min-w-[220px] border ${dk ? 'bg-slate-800 text-slate-200 border-slate-600' : 'bg-white text-slate-800 border-slate-200'}`}
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    <div className={`font-bold text-sm mb-2 pb-2 border-b ${dk ? 'text-slate-100 border-slate-600' : 'text-slate-900 border-slate-200'}`}>
                        {tooltip.task.name}
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className={dk ? 'text-slate-400' : 'text-slate-500'}>Start</span>
                        <span className="font-medium tabular-nums">{formatDate(tooltip.task.start)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className={dk ? 'text-slate-400' : 'text-slate-500'}>End</span>
                        <span className="font-medium tabular-nums">{formatDate(tooltip.task.end)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                        <span className={dk ? 'text-slate-400' : 'text-slate-500'}>Duration</span>
                        <span className="font-medium">{tooltip.task.duration}</span>
                    </div>
                    {tooltip.task.progress > 0 && (
                        <>
                            <div className="flex justify-between py-0.5">
                                <span className={dk ? 'text-slate-400' : 'text-slate-500'}>Progress</span>
                                <span className="font-medium">{tooltip.task.progress}%</span>
                            </div>
                            <div className={`mt-1 h-1.5 overflow-hidden ${dk ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                <div className="h-full bg-blue-500" style={{ width: `${tooltip.task.progress}%` }} />
                            </div>
                        </>
                    )}
                    {/* Phase details in tooltip */}
                    {tooltip.task.phases && tooltip.task.phases.length > 0 && (
                        <div className={`mt-2 pt-2 border-t ${dk ? 'border-slate-600' : 'border-slate-200'}`}>
                            {tooltip.task.phases.map(phase => {
                                const pc = PHASE_COLORS[phase.key] || { bg: '#888', label: phase.key };
                                return (
                                    <div key={phase.key} className="flex justify-between items-center py-0.5">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 inline-block shrink-0" style={{ background: pc.bg }} />
                                            {pc.label}
                                        </span>
                                        <span className="font-medium tabular-nums">{formatDate(phase.start)} – {formatDate(phase.end)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
