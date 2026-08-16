import { useEffect, useState } from 'react';

const THEMES = ['system', 'light', 'dark'];
const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mk-theme') || 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem('mk-theme', theme);
  }, [theme]);
  return [theme, setTheme];
}

const SPEEDS = [
  { value: 1, label: 'Real time' },
  { value: 60, label: '1 min/sec' },
  { value: 300, label: '5 min/sec' },
];

export default function TopBar({ simTime, running, timeScale, onToggleRunning, onChangeScale }) {
  const [theme, setTheme] = useTheme();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__logo" aria-hidden="true">MG</span>
        <span>
          <div className="brand__name">Makka Fleet Control</div>
          <div className="brand__sub">Live tracking · fuel · maintenance · cost</div>
        </span>
      </div>

      <div className="controls">
        <div className="segmented" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              className="btn"
              aria-pressed={timeScale === s.value}
              onClick={() => onChangeScale(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button className="btn btn--outline" onClick={onToggleRunning}>
          <span className={running ? 'pulse' : 'pulse pulse--off'} />
          {running ? 'Live' : 'Paused'}
        </button>

        <button
          className="btn btn--outline"
          onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
          title="Switch colour theme"
        >
          {THEME_LABEL[theme]}
        </button>

        <div className="clock">
          <div className="clock__time">
            {simTime.toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </div>
          <div className="clock__date">
            {simTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · PKT
          </div>
        </div>
      </div>
    </header>
  );
}
