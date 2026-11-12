export {
  CABIN_DECKS,
  HULL_INTERIOR_ZONES,
  SHIP_INTERIOR_STATIONS,
  INTERIOR_GRAB_RAILS,
  clampAstronautPosition,
  findNearestInteractiveStation,
  resolveCurrentDeck,
} from './kronoxInteriorSpatialModel.js';
import { buildKronoxInterior120M } from './kronoxInterior120M.js';

/**
 * Rebuilt high-detail, hull-conforming 120m 4-deck interior for KRONOX (`1 unit = 1 meter`).
 * Eliminates legacy overlapping rectangular shells and guarantees zero hull protrusion.
 */
export function buildFourDecksInterior3D() {
  return buildKronoxInterior120M();
}
