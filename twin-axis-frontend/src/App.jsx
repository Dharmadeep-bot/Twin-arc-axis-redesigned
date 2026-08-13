import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import ScatterPlotApp from './components/ScatterPlot/ScatterPlotApp';
import ScientificStudies from './components/ScientificStudies/ScientificStudies';
import CausalAnalysis from './components/CausalAnalysis/CausalAnalysis';

function Home({ isDarkMode }) {
  const Card = ({ to, title, icon, hoverColor }) => {
    const defaultBorder = isDarkMode ? '#334155' : '#e2e8f0';
    return (
      <Link 
        to={to} 
        style={{
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '40px', 
          borderRadius: '16px', 
          width: '280px', 
          height: '180px',
          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
          color: isDarkMode ? '#f8fafc' : '#0f172a',
          textDecoration: 'none', 
          boxShadow: isDarkMode ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.05)',
          border: `1px solid ${defaultBorder}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          fontWeight: '700', 
          fontSize: '1.3rem', 
          textAlign: 'center'
        }}
        onMouseEnter={(e) => { 
            e.currentTarget.style.transform = 'translateY(-8px)'; 
            e.currentTarget.style.borderColor = hoverColor;
            e.currentTarget.style.boxShadow = isDarkMode ? `0 15px 35px ${hoverColor}33` : `0 15px 35px ${hoverColor}33`;
        }}
        onMouseLeave={(e) => { 
            e.currentTarget.style.transform = 'translateY(0)'; 
            e.currentTarget.style.borderColor = defaultBorder;
            e.currentTarget.style.boxShadow = isDarkMode ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.05)';
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>{icon}</div>
        {title}
      </Link>
    );
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100%', 
      padding: '40px',
      background: isDarkMode 
        ? 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)' 
        : 'radial-gradient(circle at 50% 50%, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      <div style={{ marginBottom: '60px', textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '4rem', 
          margin: 0, 
          background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: '900',
          letterSpacing: '-1px'
        }}>
          TwinARC AXIS
        </h1>
        <p style={{ marginTop: '20px', fontSize: '1.25rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Select an application to launch
        </p>
      </div>

      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1000px' }}>
        <Card to="/scientific-studies" title="Scientific Studies" icon="🔬" hoverColor="#818cf8" />
        <Card to="/causal-analysis" title="Causal Engine" icon="⚡" hoverColor="#3b82f6" />
        <Card to="/scatter-plot" title="Scatter Plot Lab" icon="📈" hoverColor="#fbbf24" />
        <Card to="/wind-study" title="Wind Study" icon="💨" hoverColor="#38bdf8" />
      </div>
    </div>
  );
}

// Navigation Component
function Navigation({ isDarkMode, setIsDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimeout = useRef(null);

  const isActive = (path) => {
    if (path === '/scientific-studies') {
      return location.pathname === path || location.pathname === '/';
    }
    return location.pathname === path;
  };

  const navLinks = [];

  const handleLogoClick = (e) => {
    e.preventDefault();
    clickCount.current += 1;

    if (clickTimeout.current) clearTimeout(clickTimeout.current);

    // Wait 300ms after the LAST click to determine their intention
    clickTimeout.current = setTimeout(() => {
      const count = clickCount.current;
      clickCount.current = 0; // Reset for next time

      if (count === 1) {
        navigate('/');
      } else if (count === 2) {
        navigate('/causal-analysis');
      } else if (count === 3) {
        navigate('/scatter-plot');
      } else if (count === 4) {
        navigate('/wind-study');
      }
    }, 300); 
  };

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      background: isDarkMode ? '#0f172a' : '#ffffff',
      borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      zIndex: 9999,
      height: '64px',
      boxSizing: 'border-box',
    }}>

      {/* Logo */}
      <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center' }}>
        <a href="/" onClick={handleLogoClick} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer', userSelect: 'none' }}>
          <img
            src="/logo.png"
            alt="TwinARC"
            style={{ height: '130px', width: 'auto', borderRadius: '4px' }}
          />
        </a>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {navLinks.map(({ path, label }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              style={{
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: active ? '600' : '400',
                color: active
                  ? (isDarkMode ? '#f1f5f9' : '#0f172a')
                  : (isDarkMode ? '#64748b' : '#6b7280'),
                background: active
                  ? (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6')
                  : 'transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        style={{
          marginLeft: '16px',
          background: 'none',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
          borderRadius: '8px',
          width: '34px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isDarkMode ? '#94a3b8' : '#6b7280',
          transition: 'all 0.15s ease',
        }}
        title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
      >
        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}

function App({ isDarkMode, setIsDarkMode }) {
  return (
    <Router>
      <div className={`main-app-shell ${isDarkMode ? 'dark-theme' : 'light-theme'}`} style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff'
      }}>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <AppContent isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        </div>
      </div>
    </Router>
  );
}

function Main() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  return <App isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
}

function AppContent({ isDarkMode, setIsDarkMode }) {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      <div style={{ display: (currentPath === '/' || currentPath === '/scientific-studies' || currentPath === '/wind-study') ? 'block' : 'none', height: '100%' }}>
        <ScientificStudies isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
      </div>
      <div style={{ display: currentPath === '/scatter-plot' ? 'block' : 'none', height: '100%' }}>
        <ScatterPlotApp isDarkMode={isDarkMode} />
      </div>
      <div style={{ display: currentPath === '/causal-analysis' ? 'block' : 'none', height: '100%' }}>
        <CausalAnalysis isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
      </div>
    </>
  );
}
export default Main;
