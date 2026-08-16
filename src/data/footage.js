/**
 * Stand-in dashcam footage.
 *
 * Real driving clips from Pexels (free licence, hotlinking permitted, no key).
 * They stream straight from the CDN, so the demo needs a network connection —
 * `Dashcam.jsx` falls back to an offline card if a clip cannot load.
 *
 * When the real MDVR fleet is live, these URLs get replaced by signed HLS or
 * WebRTC stream URLs per vehicle channel; nothing else in the UI changes.
 */

const CDN = 'https://videos.pexels.com/video-files';

export const CLIPS = {
  roadDay:   `${CDN}/5921059/5921059-sd_640_360_30fps.mp4`,   // dash cam view of the road
  cityDay:   `${CDN}/4644521/4644521-sd_640_360_30fps.mp4`,   // dash cam footage, city driving
  ruralDay:  `${CDN}/11367262/11367262-sd_640_360_30fps.mp4`, // POV car driving on a road
  highwayNight: `${CDN}/15270404/15270404-sd_640_360_30fps.mp4`, // highway at night
};

export const FOOTAGE_CREDIT = 'Sample footage: Pexels (free licence)';

/**
 * Which clip a given vehicle/channel shows. Deterministic, so a vehicle always
 * looks like itself: city vehicles get city footage, long-haul gets highway.
 */
const BY_ROUTE = {
  'RT-PSH-CITY': 'cityDay',
  'RT-PSH-WEST': 'cityDay',
  'RT-PSH-RING': 'roadDay',
  'RT-PSH-MDN': 'roadDay',
  'RT-MDN-RURAL': 'ruralDay',
  'RT-LONGHAUL': 'highwayNight',
};

export function clipFor(vehicle, channel) {
  const base = BY_ROUTE[vehicle.routeId] || 'roadDay';
  if (channel === 'rear') return CLIPS.ruralDay;
  if (channel === 'cabin') return CLIPS.roadDay;
  return CLIPS[base];
}
