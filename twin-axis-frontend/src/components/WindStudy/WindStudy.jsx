import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Wind,
  ChevronDown, Loader2, AlertCircle
} from 'lucide-react';
import CausalGraphViewer from '../shared/CausalGraphViewer';
import { getBackendConfig } from '../../utils/sharedUtils';

const { API_HOST } = getBackendConfig();

function TurbineDropdown({ turbines, selected, onChange, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const current = turbines.find(t => t.folder === selected);
  const bdr = isDarkMode ? '#374151' : '#d1d5db';
  const bg  = isDarkMode ? '#1f2937' : '#ffffff';
  const txt = isDarkMode ? '#f3f4f6' : '#111827';
  const sub = isDarkMode ? '#6b7280' : '#9ca3af';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: bg,
          border: `1px solid ${bdr}`, borderRadius: 0,
          color: txt, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          minWidth: 150, letterSpacing: '0.02em'
        }}
      >
        <Wind size={13} color="#0ea5e9" />
        <span style={{ flex: 1, textAlign: 'left' }}>{current ? current.label : 'Select'}</span>
        <ChevronDown size={12} color={sub} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: bg, border: `1px solid ${bdr}`, borderTop: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
        }}>
          {turbines.map(t => (
            <button
              key={t.folder}
              onClick={() => { onChange(t.folder); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '8px 12px',
                textAlign: 'left',
                background: t.folder === selected ? (isDarkMode ? '#374151' : '#f3f4f6') : 'transparent',
                color: t.folder === selected ? '#0ea5e9' : txt,
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WindStudy({ isDarkMode }) {
  const [turbines, setTurbines]           = useState([]);
  const [selectedTurbine, setSelectedTurbine] = useState(null);
  const [segments, setSegments]           = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [frames, setFrames]               = useState([]);
  const [currentFrame, setCurrentFrame]   = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [fps, setFps]                     = useState(1);
  const [fadeOpacity, setFadeOpacity]     = useState(1);

  const intervalRef  = useRef(null);
  const fadeTimerRef = useRef(null);

  // Load turbines
  useEffect(() => {
    fetch(`${API_HOST}/api/wind/turbines`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.turbines.length > 0) {
          setTurbines(d.turbines);
          setSelectedTurbine(d.turbines[0].folder);
        }
      })
      .catch(() => setError('Backend unreachable'));
  }, []);

  // Load segments
  useEffect(() => {
    if (!selectedTurbine) return;
    setSegments([]); setSelectedSegment(null); setFrames([]); setCurrentFrame(0); setIsPlaying(false);
    fetch(`${API_HOST}/api/wind/segments?turbine=${encodeURIComponent(selectedTurbine)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.segments.length > 0) { setSegments(d.segments); setSelectedSegment(d.segments[0]); } });
  }, [selectedTurbine]);

  // Load all frames
  useEffect(() => {
    if (!selectedTurbine || !selectedSegment) return;
    setIsPlaying(false); clearInterval(intervalRef.current);
    setCurrentFrame(0); setFrames([]); setLoading(true); setError(null);
    fetch(`${API_HOST}/api/wind/all-windows-data?turbine=${encodeURIComponent(selectedTurbine)}&segment=${encodeURIComponent(selectedSegment)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setFrames(d.frames); else setError(d.error || 'Load failed'); })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [selectedTurbine, selectedSegment]);

  // Smooth frame step
  const stepFrame = useCallback((dir) => {
    setFadeOpacity(0.4);
    clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setCurrentFrame(p => Math.max(0, Math.min(frames.length - 1, p + dir)));
      setFadeOpacity(1);
    }, 70);
  }, [frames.length]);

  // Playback loop
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!isPlaying || frames.length === 0) return;
    intervalRef.current = setInterval(() => {
      setFadeOpacity(0.4);
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setCurrentFrame(p => {
          if (p >= frames.length - 1) { setIsPlaying(false); return p; }
          return p + 1;
        });
        setFadeOpacity(1);
      }, 70);
    }, 1000 / fps);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, fps, frames.length]);

  useEffect(() => () => { clearInterval(intervalRef.current); clearTimeout(fadeTimerRef.current); }, []);

  const currentData = frames[currentFrame] || null;
  const total       = frames.length;
  const winNum      = currentData?.window ? parseInt(currentData.window.replace('win', ''), 10) : 0;

  // ── theme ──────────────────────────────────────────────────────────────────
  const bg      = isDarkMode ? '#111827' : '#f9fafb';
  const surface = isDarkMode ? '#1f2937' : '#ffffff';
  const bdr     = isDarkMode ? '#374151' : '#e5e7eb';
  const txt     = isDarkMode ? '#f3f4f6' : '#111827';
  const muted   = isDarkMode ? '#9ca3af' : '#6b7280';
  const accent  = '#0ea5e9';

  const speeds = [{ v: 0.5, l: '0.5×' }, { v: 1, l: '1×' }, { v: 2, l: '2×' }, { v: 4, l: '4×' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, color: txt, fontFamily: 'Inter, ui-sans-serif, sans-serif' }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: surface, borderBottom: `1px solid ${bdr}`,
        flexShrink: 0, height: 32
      }}>

        {/* Brand strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', borderRight: `1px solid ${bdr}`, height: '100%',
          background: isDarkMode ? '#0f172a' : '#f1f5f9'
        }}>
          <Wind size={14} color={accent} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: txt }}>
            Wind<span style={{ color: accent }}>Study</span>
          </span>
        </div>

        {/* Turbine selector */}
        <div style={{ padding: '0 12px', borderRight: `1px solid ${bdr}`, height: '100%', display: 'flex', alignItems: 'center' }}>
          {turbines.length > 0 && (
            <TurbineDropdown turbines={turbines} selected={selectedTurbine} onChange={setSelectedTurbine} isDarkMode={isDarkMode} />
          )}
        </div>

        {/* Segment tabs */}
        {segments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', borderRight: `1px solid ${bdr}` }}>
            {segments.map(seg => (
              <button
                key={seg}
                onClick={() => setSelectedSegment(seg)}
                style={{
                  padding: '0 16px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: selectedSegment === seg ? accent : 'transparent',
                  color: selectedSegment === seg ? '#fff' : muted,
                  border: 'none', borderRight: `1px solid ${bdr}`,
                  cursor: 'pointer', transition: 'all 0.12s'
                }}
              >
                {seg}
              </button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Status readout */}
        {total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '0 16px', borderLeft: `1px solid ${bdr}`, height: '100%',
            fontSize: 11, fontWeight: 700, fontFamily: 'monospace'
          }}>
            <span style={{ color: muted, letterSpacing: '0.06em' }}>WIN</span>
            <span style={{ color: accent, fontSize: 13 }}>{String(winNum).padStart(3, '0')}</span>
            <span style={{ color: muted }}>·</span>
            <span style={{ color: muted }}>{currentFrame + 1}<span style={{ opacity: 0.5 }}> / {total}</span></span>
          </div>
        )}
      </div>

      {/* ── GRAPH CANVAS ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', background: bg }}>

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20,
            background: isDarkMode ? 'rgba(17,24,39,0.92)' : 'rgba(249,250,251,0.92)'
          }}>
            <Loader2 size={28} color={accent} style={{ animation: 'ws-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 11, color: muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Loading {selectedSegment ? `${selectedTurbine} · ${selectedSegment}` : '…'}
            </span>
            <style>{`@keyframes ws-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <AlertCircle size={32} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {!loading && !error && turbines.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.4 }}>
            <Wind size={40} color={muted} />
            <span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>No wind data found</span>
            <span style={{ fontSize: 11, color: muted }}>Place turbine folders in Wind B_Matrices/</span>
          </div>
        )}

        {currentData && (
          <div style={{ position: 'absolute', inset: 0, opacity: fadeOpacity, transition: 'opacity 0.07s linear' }}>
            <CausalGraphViewer
              bMatrixData={currentData}
              isDarkMode={isDarkMode}
              hideFullScreenControl={false}
              gasifierName={selectedTurbine || 'wind'}
              phase={currentData.window || 'win000'}
            />
          </div>
        )}
      </div>

      {/* ── TIMELINE BAR ── */}
      {total > 0 && (
        <div style={{
          flexShrink: 0, background: surface, borderTop: `1px solid ${bdr}`,
          padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8
        }}>

          {/* Progress track */}
          <div
            style={{ height: 4, background: isDarkMode ? '#374151' : '#e5e7eb', cursor: 'pointer', position: 'relative' }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setCurrentFrame(Math.round(((e.clientX - r.left) / r.width) * (total - 1)));
            }}
          >
            <div style={{
              height: '100%', width: `${total > 1 ? (currentFrame / (total - 1)) * 100 : 0}%`,
              background: accent, transition: isPlaying ? 'width 0.09s linear' : 'none'
            }} />
            {/* tick marks */}
            {Array.from({ length: total }, (_, i) => (
              <div key={i} style={{
                position: 'absolute', top: '50%', left: `${total > 1 ? (i / (total - 1)) * 100 : 0}%`,
                transform: 'translate(-50%, -50%)',
                width: i === currentFrame ? 8 : 3, height: i === currentFrame ? 8 : 3,
                background: i === currentFrame ? accent : (isDarkMode ? '#4b5563' : '#d1d5db'),
                transition: 'all 0.08s'
              }} />
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* Prev */}
            <CtrlBtn onClick={() => { setIsPlaying(false); stepFrame(-1); }} disabled={currentFrame === 0} isDarkMode={isDarkMode}>
              <SkipBack size={13} />
            </CtrlBtn>

            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 28,
                background: isPlaying ? accent : (isDarkMode ? '#374151' : '#e5e7eb'),
                color: isPlaying ? '#fff' : txt,
                border: 'none', cursor: 'pointer', fontWeight: 700, flexShrink: 0
              }}
            >
              {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            </button>

            {/* Next */}
            <CtrlBtn onClick={() => { setIsPlaying(false); stepFrame(1); }} disabled={currentFrame >= total - 1} isDarkMode={isDarkMode}>
              <SkipForward size={13} />
            </CtrlBtn>

            {/* Window label */}
            <span style={{ fontSize: 11, color: muted, fontWeight: 700, marginLeft: 8, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
              WIN {String(winNum).padStart(3, '0')}
            </span>

            <div style={{ flex: 1 }} />

            {/* Speed selector */}
            <span style={{ fontSize: 10, color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 4 }}>Speed</span>
            {speeds.map(s => (
              <button
                key={s.v}
                onClick={() => setFps(s.v)}
                style={{
                  padding: '3px 8px', fontSize: 11, fontWeight: 700,
                  background: fps === s.v ? accent : 'transparent',
                  color: fps === s.v ? '#fff' : muted,
                  border: `1px solid ${fps === s.v ? accent : bdr}`,
                  cursor: 'pointer', letterSpacing: '0.04em'
                }}
              >
                {s.l}
              </button>
            ))}

            <span style={{ fontSize: 11, color: muted, marginLeft: 12, fontFamily: 'monospace' }}>
              {currentFrame + 1}/{total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ onClick, disabled, isDarkMode, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
        background: 'transparent',
        color: disabled ? (isDarkMode ? '#4b5563' : '#d1d5db') : (isDarkMode ? '#9ca3af' : '#6b7280'),
        cursor: disabled ? 'default' : 'pointer', flexShrink: 0
      }}
    >
      {children}
    </button>
  );
}
