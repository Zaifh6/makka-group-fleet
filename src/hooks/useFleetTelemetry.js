import { useEffect, useMemo, useRef, useState } from 'react';
import { createTelemetryFeed } from '../sim/telemetryFeed.js';
import { toAlert } from '../sim/alerts.js';

const EVENT_LOG_LIMIT = 80;

/**
 * Subscribes the UI to the telemetry feed and keeps a rolling event log.
 *
 * The component tree never touches the simulator directly — it reads frames
 * and events from here, exactly as it would from a WebSocket client.
 */
export function useFleetTelemetry(vehicles) {
  const feed = useMemo(
    () => createTelemetryFeed({ vehicles, tickMs: 1000, timeScale: 60 }),
    [vehicles]
  );

  const [frames, setFrames] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [simTime, setSimTime] = useState(() => new Date());
  const [running, setRunning] = useState(true);
  const [timeScale, setTimeScale] = useState(60);
  const seq = useRef(0);

  useEffect(() => {
    const unsubscribe = feed.subscribe(({ frames: next, events, simTime: t }) => {
      setFrames(next);
      setSimTime(t);
      if (events.length) {
        const mapped = events.map((e) => toAlert(e, seq.current++));
        setEventLog((prev) => [...mapped.reverse(), ...prev].slice(0, EVENT_LOG_LIMIT));
      }
    });
    feed.start();
    return () => {
      unsubscribe();
      feed.stop();
    };
  }, [feed]);

  const framesById = useMemo(
    () => Object.fromEntries(frames.map((f) => [f.vehicle_id, f])),
    [frames]
  );

  function toggleRunning() {
    if (feed.isRunning()) {
      feed.stop();
      setRunning(false);
    } else {
      feed.start();
      setRunning(true);
    }
  }

  function changeTimeScale(next) {
    feed.setTimeScale(next);
    setTimeScale(next);
  }

  return {
    frames,
    framesById,
    eventLog,
    simTime,
    running,
    timeScale,
    toggleRunning,
    changeTimeScale,
  };
}
