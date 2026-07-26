import { ROUTE_CATALOG } from './routeCatalog';

// Kept as a compatibility export while the app migrates to live Centro stops.
export const busRoutes = ROUTE_CATALOG.map((route) => ({
  routeId: route.id,
  routeName: route.name,
  color: route.color,
  stops: [],
}));

export default busRoutes;
