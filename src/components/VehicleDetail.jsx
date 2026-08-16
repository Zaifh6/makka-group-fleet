import { useState } from 'react';
import Dashcam from './Dashcam.jsx';
import FuelPanel from './FuelPanel.jsx';
import MaintenancePanel from './MaintenancePanel.jsx';
import EconomicsPanel from './EconomicsPanel.jsx';
import { Chip, KV, vehicleStatus } from './ui.jsx';
import { int, num, durationMin } from '../lib/format.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'fuel', label: 'Fuel & efficiency' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'economics', label: 'Economics' },
  { key: 'video', label: 'Video & clips' },
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
  return (
    <pre
      className="n"
      style={{
        margin: 0,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--rule)',
        borderRadius: 3,
        padding: '10px 12px',
        fontSize: 11,
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export default function VehicleDetail({
  vehicle, frame, fuelRows, fuelSummary, schedule, history,
  econ, clips, vehicleAlerts, onAddFillUp,
}) {
  const [tab, setTab] = useState('overview');
  const status = vehicleStatus(vehicle, frame);
  const criticalCount = vehicleAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'serious'
  ).length;

  return (
    <section className="panel">
      <header className="panel__head">
        <div className="row" style={{ gap: 10 }}>
          <h2 className="panel__title">{vehicle.id}</h2>
          <Chip severity={status.severity}>{status.label}</Chip>
          {vehicle.ownership === 'OUTSOURCED' && <Chip severity="info">Outsourced</Chip>}
          <span className="panel__meta">
            {vehicle.registration} · {vehicle.make} {vehicle.model} · {vehicle.year}
          </span>
        </div>
        <span className="panel__meta">
          {frame ? `${frame.zoneName} · ${frame.region}` : '—'}
        </span>
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
            {t.key === 'overview' && criticalCount > 0 && (
              <span className="tab__badge">{criticalCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="panel__body">
        {tab === 'overview' && (
          <div className="stack">
            <div className="kv">
              <KV label="Speed" value={frame ? frame.speed : '—'} unit="km/h" size="lg" />
              <KV
                label="Ignition"
                value={frame ? (frame.ignition ? 'ON' : 'OFF') : '—'}
                mono
              />
              <KV label="Heading" value={frame ? `${frame.heading}° ${frame.headingLabel}` : '—'} />
              <KV label="Odometer" value={frame ? int(frame.odometer) : int(vehicle.odometer)} unit="km" />
              <KV label="Distance today" value={frame ? num(frame.distanceToday, 1) : '—'} unit="km" />
              <KV label="Fuel level" value={frame ? frame.fuel_level : '—'} unit="%" />
              <KV label="Stops today" value={frame ? frame.stops : '—'} />
              <KV label="Idle time" value={frame ? durationMin(frame.idleMinutes) : '—'} />
            </div>

            <div className="grid-2">
              <div>
                <div className="section-label">Live camera</div>
                <Dashcam vehicle={vehicle} frame={frame} />
              </div>

              <div className="stack">
                <div>
                  <div className="section-label">Assignment</div>
                  <div className="kv">
                    <KV label="Driver" value={vehicle.driver.name} mono={false} />
                    <KV label="Driver rating" value={num(vehicle.driver.rating, 1)} unit="/ 5" />
                    <KV label="Contact" value={vehicle.driver.phone} />
                    <KV label="Licence" value={vehicle.driver.licence} />
                    <KV label="Home depot" value={vehicle.homeDepot} mono={false} />
                    <KV label="Vehicle type" value={vehicle.type} mono={false} />
                  </div>
                </div>

                <div>
                  <div className="section-label">Tracking device</div>
                  <div className="kv">
                    <KV label="Model" value={vehicle.device.model} mono={false} />
                    <KV label="IMEI" value={vehicle.device.imei} />
                    <KV label="Firmware" value={vehicle.device.firmware} />
                    <KV label="MDVR" value={vehicle.device.mdvr || 'None fitted'} mono={false} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="section-label">Latest device payload</div>
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

            <div className="row row--between">
              <span className="section-label" style={{ marginBottom: 0 }}>
                Event clips uploaded to cloud
              </span>
              <span className="panel__meta">
                {clips.length} clip{clips.length === 1 ? '' : 's'} ·{' '}
                {clips.reduce((s, c) => s + c.sizeMb, 0)} MB
              </span>
            </div>

            <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
              Continuous footage stays on the in-vehicle 128 GB buffer. Only clips around a
              flagged event are pushed to cloud storage, which is what keeps video costs
              survivable across a full fleet.
            </p>

            {clips.length === 0 ? (
              <p className="empty">No events have triggered an upload for this vehicle yet.</p>
            ) : (
              <div className="clips">
                {clips.map((c) => (
                  <div className="clip" key={c.id}>
                    <span className="clip__thumb">{c.durationSec}s</span>
                    <span className="clip__body">
                      <span className="clip__title">{c.reason}</span>
                      <span className="clip__meta">
                        {new Date(c.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}{' '}
                        · {c.zoneName} · {c.channels.join(' + ')} · {c.sizeMb} MB
                      </span>
                    </span>
                    <Chip severity={c.severity}>{c.uploadState}</Chip>
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
