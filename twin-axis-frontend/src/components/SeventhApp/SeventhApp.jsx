import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import GanttChart from './GanttChart';

/**
 * SeventhApp — Self-contained Gantt Chart component.
 *
 * Reads and parses `sample_data.xlsx` from the public folder
 * entirely on the frontend using the SheetJS (xlsx) library.
 *
 * Props:
 *   - isDarkMode: boolean (from parent App shell)
 */
export default function SeventhApp({ isDarkMode }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadExcelFile = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/sample_data.xlsx');
            if (!response.ok) {
                throw new Error(`Failed to fetch sample_data.xlsx (HTTP ${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Use the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet);

            if (!rawData || rawData.length === 0) {
                throw new Error('The Excel file contains no data.');
            }

            // Auto-detect column names from the Excel headers
            // Scan ALL rows for keys since some columns may be sparse (not in every row)
            const colKeySet = new Set();
            rawData.forEach(row => Object.keys(row).forEach(k => colKeySet.add(k)));
            const colKeys = [...colKeySet];
            const findCol = (...aliases) =>
                colKeys.find(k => aliases.some(a => k.toLowerCase().trim() === a.toLowerCase()));

            const nameCol = findCol('Task Name', 'Gasiffer', 'Gasifier', 'Name', 'Task', 'Activity', 'Item');
            const startCol = findCol('Start', 'Start Date', 'Start_Date', 'Begin', 'From');
            const endCol = findCol('End', 'End Date', 'End_Date', 'Finish', 'To');
            const durCol = findCol('Duration', 'Days', 'Dur');
            const progCol = findCol('Progress', 'Complete', '% Complete', 'Percent');
            const levelCol = findCol('Level', 'Indent', 'Hierarchy', 'Depth');
            const rowCol = findCol('Row', '#', 'ID', 'Sr', 'No');

            // Early / Mid / Late phase columns (optional — rendered as sub-bars)
            const earlyStartCol = findCol('Early Start', 'Early_Start', 'EarlyStart', 'early_start', 'ES');
            const earlyEndCol = findCol('Early End', 'Early_End', 'EarlyEnd', 'early_end', 'EE', 'Early Finish');
            const midStartCol = findCol('Mid Start', 'Mid_Start', 'MidStart', 'mid_start', 'MS');
            const midEndCol = findCol('Mid End', 'Mid_End', 'MidEnd', 'mid_end', 'ME', 'Mid Finish');
            const lateStartCol = findCol('Late Start', 'Late_Start', 'LateStart', 'late_start', 'LS');
            const lateEndCol = findCol('Late End', 'Late_End', 'LateEnd', 'late_end', 'LE', 'Late Finish');

            // Parse rows into structured task objects
            const parsed = rawData.map((row, index) => {
                // Handle Excel date serial numbers or date strings
                let startDate = parseExcelDate(startCol ? row[startCol] : null);
                let endDate = parseExcelDate(endCol ? row[endCol] : null);

                // Build duration display text
                let duration = durCol ? row[durCol] : '';
                if (typeof duration === 'number') {
                    duration = `${duration} days`;
                }

                // Build phase sub-bars (Early / Mid / Late)
                const phases = [];
                if (earlyStartCol && earlyEndCol && row[earlyStartCol] != null && row[earlyEndCol] != null) {
                    phases.push({
                        key: 'early',
                        label: 'Early',
                        start: parseExcelDate(row[earlyStartCol]),
                        end: parseExcelDate(row[earlyEndCol]),
                    });
                }
                if (midStartCol && midEndCol && row[midStartCol] != null && row[midEndCol] != null) {
                    phases.push({
                        key: 'mid',
                        label: 'Mid',
                        start: parseExcelDate(row[midStartCol]),
                        end: parseExcelDate(row[midEndCol]),
                    });
                }
                if (lateStartCol && lateEndCol && row[lateStartCol] != null && row[lateEndCol] != null) {
                    phases.push({
                        key: 'late',
                        label: 'Late',
                        start: parseExcelDate(row[lateStartCol]),
                        end: parseExcelDate(row[lateEndCol]),
                    });
                }

                return {
                    row: rowCol ? row[rowCol] : index + 1,
                    name: nameCol ? row[nameCol] : `Task ${index + 1}`,
                    duration: duration || '',
                    start: startDate,
                    end: endDate,
                    progress: progCol && typeof row[progCol] === 'number' ? row[progCol] : 0,
                    level: levelCol && typeof row[levelCol] === 'number' ? row[levelCol] : 0,
                    phases,
                };
            });

            setTasks(parsed);
        } catch (err) {
            console.error('Error loading Excel file:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExcelFile();
    }, []);

    if (loading) {
        return (
            <div className={`w-full h-full flex flex-col shadow-md overflow-hidden ${isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`}>
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className={`w-10 h-10 border-[3px] animate-spin ${isDarkMode ? 'border-slate-700 border-t-sky-400' : 'border-slate-200 border-t-blue-600'}`} />
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading project data…</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`w-full h-full flex flex-col shadow-md overflow-hidden ${isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`}>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                    <div className="text-4xl">⚠️</div>
                    <div className="font-semibold text-base">Error loading data</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</div>
                    <button
                        onClick={loadExcelFile}
                        className={`mt-2 px-4 py-2 text-sm font-semibold transition-colors ${isDarkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full p-4 box-border min-h-[calc(100vh-150px)]">
            <GanttChart tasks={tasks} isDarkMode={isDarkMode} />
        </div>
    );
}

/**
 * Parse an Excel date value. Handles:
 *   - Excel serial date numbers
 *   - Date strings like "2/13/2014" or "2014-02-13"
 */
function parseExcelDate(value) {
    if (value == null) return new Date();

    // Excel serial number
    if (typeof value === 'number') {
        // Excel epoch: Jan 0, 1900 (with the 1900 leap year bug)
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + value * 86400000);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // String date
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }

    return new Date();
}
