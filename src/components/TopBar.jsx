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
  { value: 1, label: '1×' },
  { value: 60, label: '60×' },
  { value: 300, label: '300×' },
];

export default function TopBar({ simTime, running, timeScale, onToggleRunning, onChangeScale }) {
  const [theme, setTheme] = useTheme();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">
          Makka <em>Fleet Control</em>
        </span>
        <span className="brand__sub">Telematics · Fuel · Cost analytics</span>
      </div>

      <div className="controls">
        <div className="control-group" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              className="btn"
              aria-pressed={timeScale === s.value}
              onClick={() => onChangeScale(s.value)}
              title={`Run the simulated clock at ${s.label} real time`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button className="btn btn--ghost" onClick={onToggleRunning}>
          <span className={running ? 'livedot' : 'livedot livedot--paused'} />
          {running ? 'Live feed' : 'Paused'}
        </button>

        <button
          className="btn btn--ghost"
          onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
          title="Switch colour theme"
        >
          {THEME_LABEL[theme]}
        </button>

        <div className="simclock">
          <span className="simclock__time">
            {simTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="simclock__date">
            {simTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} · PKT
          </span>
        </div>
      </div>
    </header>
  );
}
