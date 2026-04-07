import { useState } from 'react';
import { PaletteIcon } from './Icons';

const THEMES = [
  { id: 'light', name: 'Light', icon: '☀️' },
  { id: 'dark', name: 'Dark', icon: '🌙' }
];

function ThemeToggle({ currentTheme, onThemeChange }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleThemeSelect = (themeId) => {
    onThemeChange(themeId);
    setShowMenu(false);
  };

  const currentThemeData = THEMES.find(t => t.id === currentTheme) || THEMES[1];

  return (
    <div className="theme-toggle-container">
      <button 
        className="theme-toggle-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Change theme"
      >
        <span className="theme-toggle-icon">{currentThemeData.icon}</span>
      </button>
      
      {showMenu && (
        <>
          <div 
            className="theme-menu-overlay" 
            onClick={() => setShowMenu(false)}
          />
          <div className="theme-menu">
            <div className="theme-menu-header">Appearance</div>
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`theme-option ${currentTheme === t.id ? 'active' : ''}`}
                onClick={() => handleThemeSelect(t.id)}
              >
                <span className="theme-icon">{t.icon}</span>
                <span className="theme-name">{t.name}</span>
                {currentTheme === t.id && <span className="theme-check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ThemeToggle;
