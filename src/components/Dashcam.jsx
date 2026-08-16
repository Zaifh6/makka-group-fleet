import { useEffect, useRef, useState } from 'react';
import { clipFor, FOOTAGE_CREDIT } from '../data/footage.js';

/**
 * Vehicle camera feed.
 *
 * Real driving footage stands in for the MDVR stream, with the HUD an actual
 * unit burns into the frame overlaid on top: channel, timestamp, unit id, GPS
 * fix and speed. Playback rate follows the vehicle's reported speed and the
 * video freezes when it stops, so the picture always agrees with the telemetry.
 */

const CHANNEL_NAME = { front: 'CH1 Front', cabin: 'CH2 Cabin', rear: 'CH3 Rear' };

function useSpeedSyncedVideo(ref, speed, active) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!active || speed <= 0) {
      el.pause();
      return;
    }
    // Roughly map road speed to playback rate; clamp to what browsers allow.
    el.playbackRate = Math.max(0.25, Math.min(2.5, speed / 45));
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [ref, speed, active]);
}

function CamVideo({ src, speed, active, onError, className }) {
  const ref = useRef(null);
  useSpeedSyncedVideo(ref, speed, active);
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      onError={onError}
    />
  );
}

export default function Dashcam({ vehicle, frame, compact = false }) {
  const channels = vehicle.cameras;
  const [wanted, setWanted] = useState(channels[0]);
  const [failed, setFailed] = useState(false);

  const channel = channels.includes(wanted) ? wanted : channels[0];
  const offline = vehicle.serviceState === 'OFFLINE';
  const speed = frame ? frame.speed : 0;
  const src = clipFor(vehicle, channel);

  // A different vehicle means a different clip — give it a fresh chance to load.
  useEffect(() => setFailed(false), [vehicle.id, channel]);

  const stamp = frame
    ? new Date(frame.timestamp)
        .toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
        .replace(',', '')
    : '—';

  return (
    <div className="cam">
      <div className="cam__frame">
        {offline || failed || !frame ? (
          <div className="cam__offline">
            <strong style={{ fontSize: 14 }}>
              {offline ? 'NO SIGNAL' : failed ? 'STREAM UNAVAILABLE' : 'AWAITING FIX'}
            </strong>
            <span>
              {offline
                ? `${vehicle.id} device is offline`
                : failed
                ? 'Sample footage could not load — check your connection'
                : 'Waiting for first GPS fix'}
            </span>
          </div>
        ) : (
          <>
            <CamVideo
              className="cam__video"
              src={src}
              speed={speed}
              active
              onError={() => setFailed(true)}
            />
            <div className="cam__hud">
              <div className="cam__hudrow cam__hudrow--tl">
                <span className="cam__rec"><i />REC</span>
                <span>{CHANNEL_NAME[channel] || channel}</span>
              </div>
              <div className="cam__hudrow cam__hudrow--tr">{stamp}</div>
              <div className="cam__hudrow cam__hudrow--bl">
                <span>{vehicle.id}</span>
                <span style={{ opacity: 0.75 }}>
                  {frame.latitude.toFixed(4)}, {frame.longitude.toFixed(4)}
                </span>
              </div>
              <div className="cam__hudrow cam__hudrow--br">
                <span className="cam__speed">
                  {speed}
                  <small>km/h</small>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {!compact && channels.length > 1 && !offline && !failed && (
        <div className="cam__channels">
          {channels.map((ch) => (
            <button
              key={ch}
              className="chan"
              aria-pressed={ch === channel}
              onClick={() => setWanted(ch)}
              title={CHANNEL_NAME[ch]}
            >
              <CamVideo src={clipFor(vehicle, ch)} speed={speed} active={ch !== channel} />
              <span className="chan__tag">{ch}</span>
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <div className="row row--between">
          <span className="hint">
            {vehicle.device.mdvr
              ? `${vehicle.device.mdvr} · ${channels.length}-channel`
              : 'Single-channel tracker camera'}
          </span>
          <span className="hint">{FOOTAGE_CREDIT}</span>
        </div>
      )}
    </div>
  );
}
