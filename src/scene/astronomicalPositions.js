/** ICRS -> Galactic rotation (IAU), then the display plane used by the existing map. Distances below are cartographic. */
export const SOLAR_GALACTIC_ANCHOR = [24500, 0, -3500];
export function visualDistanceInMapUnits(distanceLy) {
  return (
    (distanceLy <= 25000 ? distanceLy * 3 : 75000 + Math.log10(distanceLy / 25000) * 20000) +
    Math.min(distanceLy, 25) * 997
  );
}
export function heliocentricMapPosition(target) {
  const ra = (target.ra * Math.PI) / 180,
    dec = (target.dec * Math.PI) / 180,
    x = Math.cos(dec) * Math.cos(ra),
    y = Math.cos(dec) * Math.sin(ra),
    z = Math.sin(dec),
    center = -0.0548755604 * x - 0.8734370902 * y - 0.4838350155 * z,
    longitude90 = 0.4941094279 * x - 0.44482963 * y + 0.7469822445 * z,
    north = -0.867666149 * x - 0.1980763734 * y + 0.4559837762 * z,
    distance = visualDistanceInMapUnits(target.distanceLy ?? 50000);
  const angle = Math.atan2(0.141, 0.989),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return [
    distance * (-c * center + s * longitude90),
    distance * north,
    distance * (s * center + c * longitude90),
  ];
}
