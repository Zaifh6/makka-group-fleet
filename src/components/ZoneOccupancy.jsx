import { ZONES } from '../data/geofences.js';

/** How many vehicles are inside each business area right now. */
export default function ZoneOccupancy({ occupancy, onSelectVehicle }) {
  return (
    <div className="zones">
      {ZONES.map((z) => {
        const ids = occupancy.counts[z.id] || [];
        return (
          <div
            key={z.id}
            className={ids.length ? 'zonecard zonecard--busy' : 'zonecard'}
            title={ids.length ? ids.join(', ') : 'No vehicles present'}
          >
            <span className="zonecard__region">{z.region}</span>
            <span className="zonecard__name">{z.name}</span>
            <span className="zonecard__count">{ids.length}</span>
            {ids.length > 0 ? (
              <button
                className="zonecard__ids"
                onClick={() => onSelectVehicle(ids[0])}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: 'var(--primary)', textAlign: 'left', fontWeight: 600,
                }}
              >
                {ids[0]}{ids.length > 1 ? ` +${ids.length - 1} more` : ''}
              </button>
            ) : (
              <span className="zonecard__ids">empty</span>
            )}
          </div>
        );
      })}

      <div className="zonecard">
        <span className="zonecard__region">Between areas</span>
        <span className="zonecard__name">In transit</span>
        <span className="zonecard__count">{occupancy.inTransit}</span>
        <span className="zonecard__ids">on the road</span>
      </div>
    </div>
  );
}
