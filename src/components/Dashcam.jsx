import { useEffect, useRef, useState } from 'react';

/**
 * Simulated MDVR video.
 *
 * There is no real camera on the other end of this pilot yet, so the footage
 * is drawn procedurally: a perspective road that scrolls at the vehicle's
 * actual reported speed, with the same HUD burn-in a real MDVR stamps into the
 * frame (channel, timestamp, unit id, GPS fix, speed). When the vehicle is
 * stopped the scene holds still; when the device is offline the channel shows
 * signal loss. Replacing this with an HLS/WebRTC stream is a drop-in swap.
 */

const CHANNEL_LABEL = { front: 'CH1 · Front', cabin: 'CH2 · Cabin', rear: 'CH3 · Rear' };

function drawRoad(ctx, w, h, { offset, channel, night }) {
  const horizon = h * 0.42;
  const rear = channel === 'rear';

  // sky / far ground
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  if (night) {
    sky.addColorStop(0, '#12161d');
    sky.addColorStop(1, '#2a2f38');
  } else {
    sky.addColorStop(0, '#8fa2b0');
    sky.addColorStop(1, '#cbd0cc');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  ctx.fillStyle = night ? '#1b1e22' : '#6f7264';
  ctx.fillRect(0, horizon, w, h - horizon);

  // road surface
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - w * 0.02, horizon);
  ctx.lineTo(w * 0.5 + w * 0.02, horizon);
  ctx.lineTo(w * 1.17, h);
  ctx.lineTo(-w * 0.17, h);
  ctx.closePath();
  ctx.fillStyle = night ? '#2b2b2e' : '#57565a';
  ctx.fill();

  const edgeX = (p, side) => w * 0.5 + side * (0.02 + 0.65 * p) * w;
  const yAt = (p) => horizon + (h - horizon) * p;

  // edge lines
  ctx.strokeStyle = night ? '#8d8a7e' : '#cfc9b4';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(edgeX(0, side), yAt(0));
    ctx.lineTo(edgeX(1, side), yAt(1));
    ctx.stroke();
  }

  // centre dashes marching out of the vanishing point
  const N = 14;
  ctx.fillStyle = night ? '#b6b09a' : '#e2dcc6';
  for (let i = 0; i < N; i++) {
    const z = ((i + offset) % N) / N;
    const p = Math.pow(rear ? z : 1 - z, 2.2);
    const y = yAt(p);
    const dw = 2 + 11 * p;
    const dh = 2 + 20 * p;
    if (y > horizon + 1) ctx.fillRect(w * 0.5 - dw / 2, y, dw, dh);
  }

  // roadside poles for a sense of travel
  ctx.fillStyle = night ? '#3a3a38' : '#4a4a44';
  for (let i = 0; i < 8; i++) {
    const z = ((i + offset * 0.5) % 8) / 8;
    const p = Math.pow(rear ? z : 1 - z, 2.2);
    if (p < 0.02) continue;
    const y = yAt(p);
    const ph = 60 * p;
    const pw = Math.max(1, 5 * p);
    ctx.fillRect(edgeX(p, -1) - pw * 3, y - ph, pw, ph);
    ctx.fillRect(edgeX(p, 1) + pw * 2, y - ph, pw, ph);
  }
}

function drawCabin(ctx, w, h, opts) {
  // windscreen shows the road; everything else is interior
  ctx.save();
  ctx.beginPath();
  ctx.rect(w * 0.06, 0, w * 0.88, h * 0.6);
  ctx.clip();
  drawRoad(ctx, w, h, { ...opts, channel: 'front' });
  ctx.restore();

  // dashboard
  ctx.fillStyle = '#23211d';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.quadraticCurveTo(w * 0.5, h * 0.52, w, h * 0.62);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // A-pillars
  ctx.fillStyle = '#191713';
  ctx.fillRect(0, 0, w * 0.06, h * 0.66);
  ctx.fillRect(w * 0.94, 0, w * 0.06, h * 0.66);

  // steering wheel
  ctx.strokeStyle = '#15130f';
  ctx.lineWidth = Math.max(4, w * 0.022);
  ctx.beginPath();
  ctx.arc(w * 0.34, h * 1.02, w * 0.19, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  // driver silhouette
  ctx.fillStyle = '#2e2a24';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.63, w * 0.075, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.24, h * 0.74, w * 0.2, h * 0.26);
}

function drawNoise(ctx, w, h, amount) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < amount; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
  ctx.restore();
}

function drawScanlines(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

function drawSignalLoss(ctx, w, h, t) {
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 400; i++) {
    const g = Math.random() * 90;
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  ctx.restore();
  // rolling tear bar
  const barY = ((t * 40) % (h + 40)) - 20;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, barY, w, 14);
}

function drawHud(ctx, w, h, { label, timestamp, vehicleId, lat, lng, speed, recOn, parked }) {
  const pad = Math.max(6, w * 0.018);
  const fs = Math.max(8, Math.round(w * 0.026));
  ctx.font = `600 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textBaseline = 'top';

  // top scrim so text survives a bright sky
  const scrim = ctx.createLinearGradient(0, 0, 0, fs * 3);
  scrim.addColorStop(0, 'rgba(0,0,0,0.55)');
  scrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, fs * 3);

  const bottomScrim = ctx.createLinearGradient(0, h - fs * 3.4, 0, h);
  bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
  bottomScrim.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, h - fs * 3.4, w, fs * 3.4);

  ctx.fillStyle = '#f0e6d2';
  ctx.textAlign = 'left';
  ctx.fillText(label, pad + fs * 1.1, pad);

  if (recOn) {
    ctx.beginPath();
    ctx.arc(pad + fs * 0.4, pad + fs * 0.5, fs * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#d8402f';
    ctx.fill();
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f0e6d2';
  ctx.fillText(timestamp, w - pad, pad);

  ctx.textAlign = 'left';
  ctx.fillText(vehicleId, pad, h - pad - fs * 2.1);
  ctx.fillStyle = 'rgba(240,230,210,0.72)';
  ctx.fillText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, pad, h - pad - fs);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f0e6d2';
  const big = Math.round(fs * 1.9);
  ctx.font = `700 ${big}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(parked ? 'PARKED' : `${speed}`, w - pad, h - pad - big);
  if (!parked) {
    ctx.font = `600 ${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText('km/h', w - pad, h - pad - big - fs * 1.05);
  }
}

/** One canvas channel. Keeps its own rAF loop and reads live props via a ref. */
function CamCanvas({ channel, frame, vehicleId, offline, aspect = 0.5625, hud = true, className }) {
  const canvasRef = useRef(null);
  const propsRef = useRef({ channel, frame, vehicleId, offline, hud });
  propsRef.current = { channel, frame, vehicleId, offline, hud };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let offset = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      w = rect.width;
      h = Math.round(rect.width * aspect);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function loop(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { channel: ch, frame: f, vehicleId: vid, offline: off, hud: showHud } = propsRef.current;
      const ctx = canvas.getContext('2d');
      if (w && h) {
        if (off || !f) {
          drawSignalLoss(ctx, w, h, now / 1000);
          if (showHud) {
            ctx.font = `700 ${Math.max(9, w * 0.032)}px ui-monospace, Menlo, monospace`;
            ctx.fillStyle = '#c9c2b0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NO SIGNAL', w / 2, h / 2);
          }
        } else {
          const speed = f.speed || 0;
          if (!reduce) offset += dt * (speed / 14 + (speed > 0 ? 0.15 : 0));
          const scene = { offset, channel: ch, night: false };
          if (ch === 'cabin') drawCabin(ctx, w, h, scene);
          else drawRoad(ctx, w, h, scene);

          drawNoise(ctx, w, h, Math.round(w * 0.25));
          drawScanlines(ctx, w, h);

          if (showHud) {
            drawHud(ctx, w, h, {
              label: CHANNEL_LABEL[ch] || ch,
              timestamp: new Date(f.timestamp).toLocaleString('en-GB', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              }).replace(',', ''),
              vehicleId: vid,
              lat: f.latitude,
              lng: f.longitude,
              speed: f.speed,
              parked: f.parked || (!f.ignition && f.speed === 0),
              recOn: Math.floor(now / 600) % 2 === 0,
            });
          }
        }
      }
      raf = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [aspect]);

  return <canvas ref={canvasRef} className={className} />;
}

export default function Dashcam({ vehicle, frame }) {
  const channels = vehicle.cameras;
  const [active, setActive] = useState(channels[0]);
  const offline = vehicle.serviceState === 'OFFLINE' || !vehicle.device.mdvr && channels.length === 0;

  // A vehicle whose channel list shrank (different vehicle selected) needs
  // its active channel reset to something that exists.
  const activeChannel = channels.includes(active) ? active : channels[0];

  return (
    <div className="cams">
      <div className="cam-shell">
        <CamCanvas
          className="cam-canvas"
          channel={activeChannel}
          frame={frame}
          vehicleId={vehicle.id}
          offline={offline}
          aspect={0.5625}
        />
      </div>

      {channels.length > 1 && (
        <div className="cam-strip">
          {channels.map((ch) => (
            <button
              key={ch}
              className="cam-thumb"
              aria-pressed={ch === activeChannel}
              onClick={() => setActive(ch)}
              title={CHANNEL_LABEL[ch]}
            >
              <CamCanvas
                channel={ch}
                frame={frame}
                vehicleId={vehicle.id}
                offline={offline}
                aspect={0.58}
                hud={false}
              />
              <span className="cam-thumb__tag">{ch}</span>
            </button>
          ))}
        </div>
      )}

      <div className="row row--between">
        <span className="faint" style={{ fontSize: 11 }}>
          {vehicle.device.mdvr ? `${vehicle.device.mdvr} · ${channels.length}-channel` : 'Single-channel tracker camera'}
        </span>
        <span className="faint n" style={{ fontSize: 10.5 }}>
          local buffer 128 GB · uploads on event only
        </span>
      </div>
    </div>
  );
}
