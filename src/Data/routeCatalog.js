export const ROUTE_CATALOG = [
  {
    id: 'OSW09',
    shortName: '09',
    name: 'Price Chopper Shopper',
    color: '#F2A65A',
    category: 'Shopper service',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-9',
  },
  {
    id: 'OSW10',
    shortName: '10',
    name: 'SUNY Oswego Blue Route',
    color: '#78C7F0',
    category: 'SUNY Oswego campus',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-10',
  },
  {
    id: 'OSW11',
    shortName: '11',
    name: 'SUNY Oswego Green Route',
    color: '#70C99A',
    category: 'SUNY Oswego campus',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-11',
  },
  {
    id: 'OSW17',
    shortName: '17',
    name: 'Bridge Street',
    color: '#EC7B68',
    category: 'Oswego city',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-17',
  },
  {
    id: 'OSW18',
    shortName: '18',
    name: 'Sunrise West',
    color: '#E8C45B',
    category: 'Oswego city',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-18',
  },
  {
    id: 'OSW19',
    shortName: '19',
    name: 'Brandonwood East',
    color: '#B89BE8',
    category: 'Oswego city',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-19',
  },
  {
    id: 'OSW46',
    shortName: '46',
    name: 'Oswego – Syracuse',
    color: '#D98963',
    category: 'Regional service',
    scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-46',
  },
];

export const ROUTE_BY_ID = Object.fromEntries(
  ROUTE_CATALOG.map((route) => [route.id, route])
);

export const getRouteMeta = (routeId) =>
  ROUTE_BY_ID[String(routeId || '').toUpperCase()] || {
    id: String(routeId || '').toUpperCase(),
    shortName: String(routeId || '').replace(/^OSW/i, ''),
    name: 'Centro route',
    color: '#78C7F0',
    category: 'Oswego service',
    scheduleUrl: 'https://www.centro.org/routes-schedules',
  };

