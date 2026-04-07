import React, { useMemo, useState } from 'react';
import bucketMetadata from './bucket_metadata.json';
import './StudyTimeline.css';

const StudyTimeline = ({ gasifierName, stride, isDarkMode }) => {
  const [hoveredId, setHoveredId] = useState(null);

  const filteredMeta = useMemo(() => {
    if (!gasifierName && !stride) return bucketMetadata;
    return bucketMetadata.filter(b => {
      const gasifierMatch = gasifierName
        ? b.gasifier.toLowerCase() === gasifierName.toLowerCase()
        : true;
      const strideMatch = stride
        ? b.stride.toLowerCase() === stride.toLowerCase()
        : true;
      return gasifierMatch && strideMatch;
    });
  }, [gasifierName, stride]);

  const { totalDuration, minTime, maxTime, buckets } = useMemo(() => {
    if (filteredMeta.length === 0) {
      return { totalDuration: 0, minTime: 0, maxTime: 0, buckets: [] };
    }
    const list = filteredMeta.map(b => ({
      ...b,
      id: parseInt(b.bucket),
      startTime: new Date(b.start).getTime(),
      endTime: new Date(b.end).getTime()
    })).sort((a, b) => a.startTime - b.startTime);

    const times = list.flatMap(b => [b.startTime, b.endTime]);
    return {
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      totalDuration: Math.max(...times) - Math.min(...times),
      buckets: list
    };
  }, [filteredMeta]);

  const getPos = (time) => totalDuration === 0 ? 0 : ((time - minTime) / totalDuration) * 100;
  const getWidth = (duration) => totalDuration === 0 ? 0 : (duration / totalDuration) * 100;

  const currentBucket = useMemo(() => {
    return buckets.find(b => b.id === hoveredId);
  }, [hoveredId, buckets]);

  const pulseGroups = useMemo(() => {
    return buckets.map((b) => {
      const fullDuration = b.endTime - b.startTime;
      const pastWidth = 30;
      const coreWidth = 40;
      const futureWidth = 30;
      return {
        ...b,
        pastWidth,
        coreWidth,
        futureWidth,
        left: getPos(b.startTime),
        width: getWidth(fullDuration)
      };
    });
  }, [buckets, totalDuration, minTime]);

  if (buckets.length === 0) {
    return (
      <div className={`p-10 border mt-6 ${isDarkMode ? 'bg-[#1e1e1e] border-[#3e3e42] text-slate-300' : 'bg-white border-gray-200 text-slate-700'}`}>
        <div className="mb-12 text-center">
          <h3 className={`text-xs font-bold tracking-[0.15em] uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Processing Chain: 10k Window / 3k Synchronization
          </h3>
        </div>
        <div className={`text-center py-6 text-sm italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          No timeline data found for
          {gasifierName ? <strong> {gasifierName.toUpperCase()}</strong> : ' the selected gasifier'}
          {stride ? <> with stride <strong>{stride.toUpperCase()}</strong></> : ''}.
        </div>
      </div>
    );
  }

  return (
    <div className={`p-10 border mt-6 ${isDarkMode ? 'bg-[#1e1e1e] border-[#3e3e42] text-slate-300' : 'bg-white border-gray-200 text-slate-700'}`}>
      {/* Header */}
      <div className="mb-16 text-center">
        <h3 className={`text-xs font-bold tracking-[0.15em] uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {gasifierName ? `${gasifierName.toUpperCase()} ` : ''}
          Processing Chain: 10k Window / 3k Synchronization
          {stride ? <span className="ml-2 text-[0.6rem] font-medium opacity-70">[ {stride.toUpperCase()} STRIDE ]</span> : ''}
        </h3>
      </div>

      {/* Pulse Track */}
      <div className="relative h-[140px] my-10 mb-24 flex items-center">
        {pulseGroups.map((pulse, idx) => {
          const isActive = hoveredId === pulse.id;
          const isDimmed = hoveredId !== null && !isActive;

          return (
            <div
              key={pulse.id}
              className={`absolute h-[90px] flex transition-all duration-500 overflow-visible ${isActive ? 'z-[100] -translate-y-1' : ''} ${isDimmed ? 'opacity-10 blur-[1px] grayscale-[0.8]' : ''}`}
              style={{
                left: `${pulse.left}%`,
                width: `${pulse.width}%`,
                zIndex: isActive ? 100 : idx + 1
              }}
              onMouseEnter={() => setHoveredId(pulse.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Zone: Past (Inherited) */}
              <div
                className={`h-full relative flex items-center justify-center border border-dashed border-r-0 ${isDarkMode ? 'border-slate-600 bg-slate-800/30' : 'border-slate-300 bg-slate-100/50'}`}
                style={{
                  width: `${pulse.pastWidth}%`,
                  backgroundImage: isDarkMode
                    ? 'radial-gradient(rgba(100,116,139,0.3) 1px, transparent 1px)'
                    : 'radial-gradient(rgba(148,163,184,0.3) 1px, transparent 1px)',
                  backgroundSize: '8px 8px'
                }}
              >
                {/* Stride tag — visible on hover */}
                <div className={`absolute w-full text-center transition-all duration-300 ${isActive ? '-top-14 opacity-100' : '-top-10 opacity-0'}`}>
                  <span className={`px-3 py-1 text-[0.65rem] font-bold border ${isDarkMode ? 'bg-emerald-900 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    3k Inherited
                  </span>
                </div>
              </div>

              {/* Zone: Present (Core Window) */}
              <div
                className="h-full flex items-center justify-center bg-blue-600 text-white font-bold text-sm z-10 shadow-md"
                style={{
                  width: `${pulse.coreWidth}%`,
                  boxShadow: isActive ? '0 16px 32px rgba(37,99,235,0.4)' : '0 4px 12px rgba(37,99,235,0.2)'
                }}
              >
                B{pulse.id}
              </div>

              {/* Zone: Future (Handover) */}
              <div
                className={`h-full border border-dashed border-l-0 ${isDarkMode ? 'border-indigo-700' : 'border-indigo-300'}`}
                style={{
                  width: `${pulse.futureWidth}%`,
                  background: isDarkMode
                    ? 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.03) 100%)'
                    : 'linear-gradient(90deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.02) 100%)'
                }}
              />
            </div>
          );
        })}

        {/* Time Axis */}
        <div className={`absolute -bottom-14 left-0 right-0 flex justify-between items-center py-3 px-1 border-t ${isDarkMode ? 'border-[#3e3e42]' : 'border-gray-200'}`}>
          <div className={`text-[0.65rem] font-bold tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {new Date(minTime).toLocaleDateString()}
          </div>
          <span className={`text-[0.55rem] tracking-[0.2em] ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>SYNCHRONIZED DATA FLOW</span>
          <div className={`text-[0.65rem] font-bold tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {new Date(maxTime).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-10 mt-10">
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 border border-dashed ${isDarkMode ? 'bg-slate-800/30 border-slate-500' : 'bg-slate-100/50 border-slate-400'}`} />
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Inheritance (Past 3k)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-blue-600" />
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Core Window (Unique 4k)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 border border-dashed ${isDarkMode ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-300'}`} />
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Handover (Future 3k)</span>
        </div>
      </div>

      {/* Info Panel */}
      <div className={`mt-12 p-8 min-h-[160px] flex flex-col justify-center items-center text-center relative border ${isDarkMode ? 'bg-[#252526] border-[#3e3e42]' : 'bg-gray-50 border-gray-200'}`}>
        {!currentBucket ? (
          <div className={`text-sm leading-relaxed max-w-[600px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Hover over a bucket pulse to see how data is inherited, processed, and handed over across the 10k timeline.
          </div>
        ) : (
          <>
            <div className="absolute -top-4 bg-blue-600 text-white px-5 py-1.5 text-xs font-bold shadow-md">
              BUCKET {currentBucket.bucket} ANALYTICS
            </div>
            <div className={`text-lg font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {currentBucket.id === 1 ? 'Continuous Timeline Start' : 'Sequential Synchronization Block'}
            </div>
            <div className={`text-sm max-w-[600px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {currentBucket.id === 1
                ? "This 10k window establishes the study baseline. After its initial 7k independent processing, it hands over the final 3k of data to prime the next bucket."
                : `Bucket ${currentBucket.id} starts by inheriting 3k of context from the previous step. It then executes 4k of unique extraction and prepares 3k of state for the next bucket.`}
            </div>
            <div className="mt-4 font-bold text-blue-600 text-sm">
              {new Date(currentBucket.startTime).toLocaleDateString()} — {new Date(currentBucket.endTime).toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudyTimeline;
