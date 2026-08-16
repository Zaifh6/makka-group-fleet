import { useState } from 'react';
import Dashcam from './Dashcam.jsx';
import FuelPanel from './FuelPanel.jsx';
import MaintenancePanel from './MaintenancePanel.jsx';
import EconomicsPanel from './EconomicsPanel.jsx';
import { Badge, Stat, vehicleStatus, toneFor } from './ui.jsx';
import { int, num, durationMin } from '../lib/format.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'economics', label: 'Cost & value' },
  { key: 'video', label: 'Camera' },
];

function RawPayload({ frame }) {
  if (!frame) return null;
  const payload = {
    vehicle_id: frame.vehicle_id,
    latitude: frame.latitude,
    longitude: frame.longitude,
    speed: frame.speed,
    heading: frame.heading,
    ignition: frame.ignition,
    engine_status: frame.engine_status,
    odometer: frame.odometer,
    fuel_level: frame.fuel_level,
    timestamp: frame.timestamp,
  };
  return <pre className="json">{JSON.stringify(payload, null, 2)}</pre>;
}

export default function VehicleDetail({
  vehicle, frame, fuelRows, fuelSummary, schedule, history,
  econ, clips, vehicleAlerts, onAddFillUp,
}) {
  const [tab, setTab] = useState('overview');
  const status = vehicleStatus(vehicle, frame);
  const needsAction = vehicleAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'serious'
  );

  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 className="panel__title" style={{ fontFamily: 'var(--mono)' }}>{vehicle.id}</h2>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {vehicle.ownership === 'OUTSOURCED' && <Badge tone="info">Outsourced</Badge>}
          </div>
          <div className="panel__sub">
            {vehicle.make} {vehicle.model} {vehicle.year} · {vehicle.registration} ·{' '}
            {vehicle.driver.name}
          </div>
        </div>
        <span className="panel__meta">{frame ? frame.zoneName : '—'}</span>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            className="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'overview' && needsAction.length > 0 && (
              <span className="tab__count">{needsAction.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="panel__body">
        {tab === 'overview' && (
          <div className="stack">
            {needsAction.length > 0 && (
              <div
                style={{
                  background: 'var(--danger-soft)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 'var(--r)',
                  padding: '12px 14px',
                }}
              >
                <div className="row" style={{ marginBottom: 6 }}>
                  <Badge tone="danger" dot>Needs attention</Badge>
                </div>
                {needsAction.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong style={{ fontWeight: 600 }}>{a.title}</strong>
                    <span className="muted"> — {a.detail}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="stats">
              <Stat label="Speed" value={frame ? frame.speed : '—'} unit="km/h" size="lg" />
              <Stat
                label="Engine"
                value={frame ? (frame.ignition ? 'Running' : 'Off') : '—'}
                text
                tone={frame?.ignition ? 'ok' : 'neutral'}
              />
              <Stat label="Heading" value={frame ? `${frame.heading}° ${frame.headingLabel}` : '—'} />
              <Stat label="Odometer" value={int(frame ? frame.odometer : vehicle.odometer)} unit="km" />
              <Stat label="Driven today" value={frame ? num(frame.distanceToday, 1) : '—'} unit="km" />
              <Stat label="Fuel in tank" value={frame ? frame.fuel_level : '—'} unit="%" />
              <Stat label="Stops today" value={frame ? frame.stops : '—'} />
              <Stat label="Time stopped" value={frame ? durationMin(frame.idleMinutes) : '—'} text />
            </div>

            <div className="grid2">
              <div className="stack stack--tight">
                <span className="sectiontitle">Live camera</span>
                <Dashcam vehicle={vehicle} frame={frame} compact />
              </div>

              <div className="stack stack--tight">
                <span className="sectiontitle">Driver &amp; device</span>
                <div className="stats">
                  <Stat label="Driver" value={vehicle.driver.name} text />
                  <Stat label="Rating" value={num(vehicle.driver.rating, 1)} unit="/ 5" />
                  <Stat label="Phone" value={vehicle.driver.phone} />
                  <Stat label="Licence" value={vehicle.driver.licence} />
                  <Stat label="Home depot" value={vehicle.homeDepot} text />
                  <Stat label="Vehicle type" value={vehicle.type} text />
                  <Stat label="Tracker" value={vehicle.device.model} text />
                  <Stat label="Camera unit" value={vehicle.device.mdvr || 'None fitted'} text />
                </div>
              </div>
            </div>

            <div>
              <div className="sectionhead" style={{ marginBottom: 8 }}>
                <span className="sectiontitle">Latest device payload</span>
                <span className="hint">exactly what the tracker sends every few seconds</span>
              </div>
              <RawPayload frame={frame} />
            </div>
          </div>
        )}

        {tab === 'fuel' && (
          <FuelPanel
            vehicle={vehicle}
            rows={fuelRows}
            summary={fuelSummary}
            onAddFillUp={onAddFillUp}
          />
        )}

        {tab === 'maintenance' && (
          <MaintenancePanel
            schedule={schedule}
            history={history}
            odometer={frame ? frame.odometer : vehicle.odometer}
          />
        )}

        {tab === 'economics' && <EconomicsPanel vehicle={vehicle} econ={econ} />}

        {tab === 'video' && (
          <div className="stack">
            <Dashcam vehicle={vehicle} frame={frame} />

            <div className="divider" />

            <div className="sectionhead">
              <span className="sectiontitle">Saved incident clips</span>
              <span className="hint">
                {clips.length} clip{clips.length === 1 ? '' : 's'} ·{' '}
                {clips.reduce((s, c) => s + c.sizeMb, 0)} MB uploaded
              </span>
            </div>

            <p className="hint">
              Normal driving stays on the 128 GB recorder in the vehicle. Only the seconds
              around a flagged event get uploaded, which is what keeps video costs
              manageable across a full fleet.
            </p>

            {clips.length === 0 ? (
              <p className="empty">
                No incidents have triggered an upload for this vehicle yet.
              </p>
            ) : (
              <div>
                {clips.map((c) => (
                  <div className="clip" key={c.id}>
                    <span className="clip__thumb">{c.durationSec}s</span>
                    <span className="clip__body">
                      <div className="clip__title">{c.reason}</div>
                      <div className="clip__meta">
                        {new Date(c.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}{' '}
                        · {c.zoneName} · {c.channels.join(' + ')} · {c.sizeMb} MB
                      </div>
                    </span>
                    <Badge tone={toneFor(c.severity)}>Uploaded</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
