import { ZONES } from '../data/geofences.js';

/** How many vehicles are in each business area right now. */
export default function ZoneOccupancy({ occupancy, onSelectVehicle }) {
  return (
    <div className="zonebar">
      {ZONES.map((z) => {
        const ids = occupancy.counts[z.id] || [];
        return (
          <div
            key={z.id}
            className={ids.length ? 'zonebar__cell' : 'zonebar__cell zonebar__cell--empty'}
            title={ids.length ? ids.join(', ') : 'No vehicles present'}
          >
            <span className="zonebar__region">{z.region}</span>
            <span className="zonebar__name">{z.name}</span>
            <span className="zonebar__count">{ids.length}</span>
            {ids.length > 0 && (
              <button
                onClick={() => onSelectVehicle(ids[0])}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 9.5, color: 'var(--accent)', textAlign: 'left',
                  fontFamily: 'var(--mono)',
                }}
              >
                {ids[0]}
                {ids.length > 1 ? ` +${ids.length - 1}` : ''}
              </button>
            )}
          </div>
        );
      })}
      <div className="zonebar__cell">
        <span className="zonebar__region">Between areas</span>
        <span className="zonebar__name">In transit</span>
        <span className="zonebar__count">{occupancy.inTransit}</span>
      </div>
    </div>
  );
}
