import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
  Driver,
  DriverLocation,
  LatLng,
  MeetingPoint,
  Profile,
  RestrictedZone,
  Ride,
  SosAlert,
  SosTrackPoint,
} from '../contract/types';
import { DILLA_LANDMARKS } from '../data/seedDilla';
import { formatAddisShortTime, formatBirr, getDriverStatusLabel } from '../utils/format';

interface DillaMapCanvasProps {
  zones?: RestrictedZone[];
  meetingPoints?: MeetingPoint[];
  driverLocations?: DriverLocation[];
  drivers?: Driver[];
  profiles?: Profile[];
  rides?: Ride[];
  sosAlert?: SosAlert | null;
  sosTrack?: SosTrackPoint[];
  draftPoints?: LatLng[];
  onMapClick?: (pt: LatLng) => void;
  heightClass?: string;
}

type SelectedMapItem =
  | {
      kind: 'driver';
      title: string;
      subtitle: string;
      detail: string;
      status: string;
    }
  | {
      kind: 'gate';
      title: string;
      subtitle: string;
      detail: string;
      status: string;
    }
  | {
      kind: 'ride';
      title: string;
      subtitle: string;
      detail: string;
      status: string;
    };

const MIN_LAT = 6.401;
const MAX_LAT = 6.426;
const MIN_LNG = 38.300;
const MAX_LNG = 38.321;
const WIDTH = 820;
const HEIGHT = 460;

function project(pt: LatLng): { x: number; y: number } {
  const x = ((pt.lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WIDTH;
  const y = HEIGHT - ((pt.lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * HEIGHT;
  return { x, y };
}

function unproject(x: number, y: number): LatLng {
  const lng = MIN_LNG + (x / WIDTH) * (MAX_LNG - MIN_LNG);
  const lat = MIN_LAT + ((HEIGHT - y) / HEIGHT) * (MAX_LAT - MIN_LAT);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

export const DillaMapCanvas: React.FC<DillaMapCanvasProps> = ({
  zones = [],
  meetingPoints = [],
  driverLocations = [],
  drivers = [],
  profiles = [],
  rides = [],
  sosAlert = null,
  sosTrack = [],
  draftPoints = [],
  onMapClick,
  heightClass = 'h-96',
}) => {
  const [showZones, setShowZones] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem | null>(null);

  const activeRides = rides.filter((r) =>
    ['REQUESTED', 'SEARCHING', 'DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS'].includes(r.status)
  );

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    onMapClick(unproject(x, y));
  };

  return (
    <div
      className={`relative w-full ${heightClass} bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden`}
    >
      {/* Layer Toggle Bar */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap items-center gap-1 bg-white/92 dark:bg-slate-900/92 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-md p-1 text-xs">
        {[
          { label: 'Drivers', active: showDrivers, toggle: () => setShowDrivers((v) => !v), visible: driverLocations.length > 0 },
          { label: 'Routes', active: showRoutes, toggle: () => setShowRoutes((v) => !v), visible: activeRides.length > 0 },
          { label: 'Zones', active: showZones, toggle: () => setShowZones((v) => !v), visible: zones.length > 0 },
          { label: 'Gates', active: showGates, toggle: () => setShowGates((v) => !v), visible: meetingPoints.length > 0 },
          { label: 'Landmarks', active: showLandmarks, toggle: () => setShowLandmarks((v) => !v), visible: true },
        ]
          .filter((l) => l.visible)
          .map((layer) => (
            <button
              key={layer.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                layer.toggle();
              }}
              className={`px-2 py-0.5 font-medium rounded transition-colors whitespace-nowrap ${
                layer.active
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {layer.label}
            </button>
          ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onClick={handleSvgClick}
        className={`w-full h-full ${onMapClick ? 'cursor-crosshair' : ''}`}
        role="img"
        aria-label="Dilla City Operational Map"
      >
        <g stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1">
          {[0.2, 0.4, 0.6, 0.8].map((r) => (
            <React.Fragment key={r}>
              <line x1={WIDTH * r} y1={0} x2={WIDTH * r} y2={HEIGHT} />
              <line x1={0} y1={HEIGHT * r} x2={WIDTH} y2={HEIGHT * r} />
            </React.Fragment>
          ))}
        </g>

        {/* Main Highway Spine */}
        <polyline
          points={[
            project({ lat: 6.425, lng: 38.3092 }),
            project({ lat: 6.4168, lng: 38.3082 }),
            project({ lat: 6.4095, lng: 38.3118 }),
            project({ lat: 6.4046, lng: 38.3149 }),
            project({ lat: 6.4015, lng: 38.3162 }),
          ]
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill="none"
          stroke="currentColor"
          className="text-slate-300 dark:text-slate-700"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Restricted Zones */}
        {showZones &&
          zones.map((z) => {
            if (!z.points.length) return null;
            const pts = z.points.map(project);
            const ptsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
            if (z.type === 'AREA') {
              return (
                <g key={z.id} opacity={z.active ? 1 : 0.4}>
                  <polygon
                    points={ptsStr}
                    fill="rgba(220, 38, 38, 0.14)"
                    stroke="#dc2626"
                    strokeWidth="2"
                    strokeDasharray={z.active ? undefined : '5 4'}
                  />
                  <text
                    x={pts[0].x + 8}
                    y={pts[0].y + 18}
                    fontSize="13"
                    fontWeight="600"
                    fill="#b91c1c"
                  >
                    {z.name}
                  </text>
                </g>
              );
            }
            return (
              <g key={z.id} opacity={z.active ? 1 : 0.4}>
                <polyline
                  points={ptsStr}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
                <text x={pts[0].x} y={pts[0].y - 10} fontSize="13" fontWeight="600" fill="#b45309">
                  {z.name}
                </text>
              </g>
            );
          })}

        {/* Active Ride Pickup -> Destination Vectors */}
        {showRoutes &&
          activeRides.map((ride) => {
            const p1 = project(ride.pickup_location);
            const p2 = project(ride.destination_location);
            const color = ride.stalled ? '#d97706' : '#2563eb';
            return (
              <g
                key={ride.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (onMapClick) return;
                  e.stopPropagation();
                  setSelectedItem({
                    kind: 'ride',
                    title: `${ride.pickup_address} -> ${ride.destination_address}`,
                    subtitle: `${ride.driver_snapshot?.name || 'Searching driver'} · ${formatBirr(ride.fare_santim)}`,
                    detail: `${(ride.distance_meters / 1000).toFixed(2)} km · ${ride.passenger_snapshot?.name || 'Passenger'}`,
                    status: ride.stalled ? `${ride.status} (STALLED)` : ride.status,
                  });
                }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeOpacity="0.85"
                />
                <circle cx={p1.x} cy={p1.y} r="4.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
                <rect x={p2.x - 4} y={p2.y - 4} width="8" height="8" rx="1" fill={color} stroke="#ffffff" strokeWidth="1.5" />
              </g>
            );
          })}

        {/* Draft Points */}
        {draftPoints.length > 0 && (
          <g>
            <polyline
              points={draftPoints
                .map((pt) => {
                  const p = project(pt);
                  return `${p.x},${p.y}`;
                })
                .join(' ')}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
            {draftPoints.map((pt, i) => {
              const p = project(pt);
              return <circle key={i} cx={p.x} cy={p.y} r="6" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />;
            })}
          </g>
        )}

        {/* Dilla Landmarks */}
        {showLandmarks &&
          DILLA_LANDMARKS.map((lm) => {
            const p = project(lm);
            return (
              <g key={lm.name}>
                <rect x={p.x - 3.5} y={p.y - 3.5} width="7" height="7" rx="1.5" fill="#64748b" />
                <text
                  x={p.x + 10}
                  y={p.y + 4}
                  fontSize="12"
                  className="fill-slate-600 dark:fill-slate-400"
                >
                  {lm.name}
                </text>
              </g>
            );
          })}

        {/* Meeting Point Gates */}
        {showGates &&
          meetingPoints.map((mp) => {
            const p = project(mp.location);
            return (
              <g
                key={mp.id}
                opacity={mp.active ? 1 : 0.45}
                className="cursor-pointer"
                onClick={(e) => {
                  if (onMapClick) return;
                  e.stopPropagation();
                  setSelectedItem({
                    kind: 'gate',
                    title: `Gate: ${mp.name}`,
                    subtitle: `${mp.location.lat.toFixed(5)}, ${mp.location.lng.toFixed(5)}`,
                    detail: `Zone ID: ${mp.zone_id}`,
                    status: mp.active ? 'ACTIVE' : 'DISABLED',
                  });
                }}
              >
                <circle cx={p.x} cy={p.y} r="7" fill="#0d9488" stroke="#ffffff" strokeWidth="2" />
                <text x={p.x + 11} y={p.y + 15} fontSize="12" fontWeight="600" fill="#0f766e">
                  Gate: {mp.name}
                </text>
              </g>
            );
          })}

        {/* Live Driver Markers */}
        {showDrivers &&
          driverLocations.map((dl) => {
            const driver = drivers.find((d) => d.id === dl.driver_id);
            const prof = profiles.find((p) => p.id === dl.driver_id);
            const status = driver ? getDriverStatusLabel(driver) : 'Offline';
            const color =
              status === 'Ready'
                ? '#16a34a'
                : status === 'On ride'
                  ? '#2563eb'
                  : status === 'No signal'
                    ? '#dc2626'
                    : '#64748b';
            const p = project(dl.location);
            return (
              <g
                key={dl.driver_id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (onMapClick) return;
                  e.stopPropagation();
                  setSelectedItem({
                    kind: 'driver',
                    title: prof?.name || driver?.login_id || 'Driver',
                    subtitle: `${driver?.plate || 'No plate'} · ${driver?.color || ''} ${driver?.model || ''}`,
                    detail: `Rating ${driver?.rating_average?.toFixed(2) || '0.00'} · Seen ${formatAddisShortTime(dl.updated_at)}`,
                    status,
                  });
                }}
              >
                <circle cx={p.x} cy={p.y} r="8" fill={color} stroke="#ffffff" strokeWidth="2" />
                <text x={p.x + 12} y={p.y + 4} fontSize="13" fontWeight="600" fill={color}>
                  {prof?.name.split(' ')[0] || 'Driver'} ({status})
                </text>
              </g>
            );
          })}

        {/* SOS Breadcrumb Trail */}
        {sosTrack.length > 1 && (
          <polyline
            points={sosTrack
              .map((t) => {
                const p = project(t.location);
                return `${p.x},${p.y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#dc2626"
            strokeWidth="3.5"
            strokeDasharray="5 4"
          />
        )}
        {sosTrack.map((t, i) => {
          const p = project(t.location);
          return <circle key={t.id || i} cx={p.x} cy={p.y} r="4" fill="#dc2626" />;
        })}
        {sosAlert && (
          <g>
            {(() => {
              const p = project(sosAlert.location);
              return (
                <>
                  <circle cx={p.x} cy={p.y} r="16" fill="rgba(220,38,38,0.22)" stroke="#dc2626" strokeWidth="1.5" />
                  <circle cx={p.x} cy={p.y} r="7.5" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                  <text x={p.x + 18} y={p.y + 5} fontSize="14" fontWeight="700" fill="#dc2626">
                    SOS ({sosAlert.status})
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Selected Map Inspector Card */}
      {selectedItem && (
        <div className="absolute bottom-2.5 left-2.5 z-10 max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedItem.title}</div>
              <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">{selectedItem.subtitle}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label="Close inspector"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            <span>{selectedItem.detail}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedItem.status}</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 text-xs font-mono tabular-nums bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300">
        Dilla 6.410°N, 38.311°E
      </div>
    </div>
  );
};
