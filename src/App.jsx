import { useMemo, useState, useCallback } from 'react';

import { VEHICLES } from './data/vehicles.js';
import { FUEL_LOGS } from './data/fuel.js';
import { MAINTENANCE } from './data/maintenance.js';

import { useFleetTelemetry } from './hooks/useFleetTelemetry.js';
import { standingAlerts, clipsFromEvents } from './sim/alerts.js';
import { zoneOccupancy } from './sim/geofence.js';
import {
  deriveFuelRows, fuelSummary, maintenanceStatus,
  vehicleEconomics, fleetTotals, ownershipComparison, performanceRanking,
} from './lib/metrics.js';

import TopBar from './components/TopBar.jsx';
import FleetOverview from './components/FleetOverview.jsx';
import FleetMap from './components/FleetMap.jsx';
import ZoneOccupancy from './components/ZoneOccupancy.jsx';
import VehicleRoster from './components/VehicleRoster.jsx';
import AlertStream from './components/AlertStream.jsx';
import VehicleDetail from './components/VehicleDetail.jsx';
import FleetEconomics from './components/FleetEconomics.jsx';
import { Panel, SEVERITY_COLOR } from './components/ui.jsx';

export default function App() {
  const [selectedId, setSelectedId] = useState(VEHICLES[0].id);
  const [fuelLogs, setFuelLogs] = useState(FUEL_LOGS);
  const [alertFilter, setAlertFilter] = useState('all');

  const {
    frames, framesById, eventLog, simTime,
    running, timeScale, toggleRunning, changeTimeScale,
  } = useFleetTelemetry(VEHICLES);

  const selectVehicle = useCallback((id) => setSelectedId(id), []);

  const addFillUp = useCallback((vehicleId, entry) => {
    setFuelLogs((prev) => ({
      ...prev,
      [vehicleId]: [...(prev[vehicleId] || []), entry].sort((a, b) => a.odo - b.odo),
    }));
  }, []);

  /* ---------------------------------------------------------- derived --- */

  const totals = useMemo(() => fleetTotals(VEHICLES, framesById), [framesById]);

  const occupancy = useMemo(() => zoneOccupancy(frames), [frames]);

  const standing = useMemo(
    () => standingAlerts({
      vehicles: VEHICLES,
      fuelLogs,
      maintenance: MAINTENANCE,
      framesById,
    }),
    [fuelLogs, framesById]
  );

  // Standing conditions sit above the live ticker: they stay true until
  // somebody acts on them, whereas events are already history.
  const allAlerts = useMemo(() => [...standing, ...eventLog], [standing, eventLog]);

  const alertCounts = useMemo(() => {
    const counts = {};
    for (const a of allAlerts) {
      if (a.severity === 'critical' || a.severity === 'serious') {
        counts[a.vehicleId] = (counts[a.vehicleId] || 0) + 1;
      }
    }
    return counts;
  }, [allAlerts]);

  const clips = useMemo(() => clipsFromEvents(eventLog, 40), [eventLog]);

  const comparison = useMemo(() => ownershipComparison(VEHICLES), []);
  const ranking = useMemo(() => performanceRanking(VEHICLES), []);

  /* ------------------------------------------- selected vehicle bundle --- */

  const selected = VEHICLES.find((v) => v.id === selectedId) || VEHICLES[0];
  const selectedFrame = framesById[selected.id];

  const selectedRows = useMemo(
    () => deriveFuelRows(fuelLogs[selected.id] || [], selected),
    [fuelLogs, selected]
  );
  const selectedSummary = useMemo(
    () => fuelSummary(selectedRows, selected),
    [selectedRows, selected]
  );
  const selectedSchedule = useMemo(
    () => maintenanceStatus(
      MAINTENANCE[selected.id]?.schedule || [],
      selectedFrame ? selectedFrame.odometer : selected.odometer
    ),
    [selected, selectedFrame]
  );
  const selectedEcon = useMemo(() => vehicleEconomics(selected), [selected]);
  const selectedClips = useMemo(
    () => clips.filter((c) => c.vehicleId === selected.id),
    [clips, selected]
  );
  const selectedAlerts = useMemo(
    () => allAlerts.filter((a) => a.vehicleId === selected.id),
    [allAlerts, selected]
  );

  /* ------------------------------------------------------------ render --- */

  return (
    <div className="app">
      <TopBar
        simTime={simTime}
        running={running}
        timeScale={timeScale}
        onToggleRunning={toggleRunning}
        onChangeScale={changeTimeScale}
      />

      <FleetOverview totals={totals} />

      <div className="layout">
        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Live fleet map</h2>
            <span className="panel__meta">
              Peshawar &amp; Mardan · {frames.length} units reporting
            </span>
          </header>

          <FleetMap
            vehicles={VEHICLES}
            frames={frames}
            framesById={framesById}
            selectedId={selectedId}
            onSelect={selectVehicle}
          />

          <div className="map-legend">
            {[
              ['good', 'Moving'],
              ['warning', 'Idling'],
              ['info', 'Stopped'],
              ['serious', 'In workshop'],
              ['neutral', 'Offline'],
            ].map(([sev, label]) => (
              <span className="map-legend__item" key={sev}>
                <i className="map-legend__dot" style={{ background: SEVERITY_COLOR[sev] }} />
                {label}
              </span>
            ))}
            <span className="map-legend__item">
              <i className="map-legend__line" style={{ background: 'var(--accent)' }} />
              Selected vehicle trail
            </span>
            <span className="map-legend__item">
              <i className="map-legend__line" style={{ background: 'var(--ink-3)', opacity: 0.5 }} />
              Assigned routes
            </span>
            <span className="map-legend__item faint">Click a marker to inspect</span>
          </div>

          <ZoneOccupancy occupancy={occupancy} onSelectVehicle={selectVehicle} />
        </section>

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Fleet roster</h2>
            <span className="panel__meta">{VEHICLES.length} vehicles</span>
          </header>
          <VehicleRoster
            vehicles={VEHICLES}
            framesById={framesById}
            selectedId={selectedId}
            onSelect={selectVehicle}
            alertCounts={alertCounts}
          />
        </section>
      </div>

      <div className="layout">
        <VehicleDetail
          vehicle={selected}
          frame={selectedFrame}
          fuelRows={selectedRows}
          fuelSummary={selectedSummary}
          schedule={selectedSchedule}
          history={MAINTENANCE[selected.id]?.history || []}
          econ={selectedEcon}
          clips={selectedClips}
          vehicleAlerts={selectedAlerts}
          onAddFillUp={addFillUp}
        />

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Alerts &amp; auto logs</h2>
            <span className="panel__meta">{allAlerts.length} open</span>
          </header>
          <AlertStream
            alerts={allAlerts}
            onSelectVehicle={selectVehicle}
            selectedId={selectedId}
            filter={alertFilter}
            onFilter={setAlertFilter}
          />
        </section>
      </div>

      <Panel
        title="Fleet economics"
        meta="Rolling 30 days · owned vs outsourced"
      >
        <FleetEconomics
          comparison={comparison}
          ranking={ranking}
          onSelectVehicle={selectVehicle}
          selectedId={selectedId}
        />
      </Panel>

      <footer className="faint" style={{ fontSize: 11, textAlign: 'center', paddingTop: 8 }}>
        Prototype · all telemetry is simulated client-side. Swap{' '}
        <code style={{ fontFamily: 'var(--mono)' }}>src/sim/telemetryFeed.js</code> for a
        WebSocket client to run against real devices.
      </footer>
    </div>
  );
}
