import React, { useMemo, useState } from 'react';
import { MapPin, Plus, RotateCcw, Undo2 } from 'lucide-react';
import type { LatLng, ZoneType } from '../contract/types';
import type { SandboxDatabase } from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import { formatAddisShortTime, formatBirr } from '../utils/format';
import { DillaMapCanvas } from './DillaMapCanvas';

interface FaresZonesViewProps {
  db: SandboxDatabase;
}

export const FaresZonesView: React.FC<FaresZonesViewProps> = ({ db }) => {
  const activeFare =
    db.fare_configs.find((f) => f.version === db.settings.active_fare_config_version) ||
    db.fare_configs[0];

  const [baseFareSantim, setBaseFareSantim] = useState(String(activeFare.base_fare_santim));
  const [pricePerKmSantim, setPricePerKmSantim] = useState(String(activeFare.price_per_km_santim));
  const [minFareSantim, setMinFareSantim] = useState(String(activeFare.minimum_fare_santim));
  const [noShowWaitSec, setNoShowWaitSec] = useState(String(activeFare.no_show_wait_seconds));
  const [commissionPct, setCommissionPct] = useState(String(activeFare.commission_percent));
  const [confirmFareStep, setConfirmFareStep] = useState(false);
  const [overrideLowMin, setOverrideLowMin] = useState(false);

  const [offerTimeout, setOfferTimeout] = useState(String(db.settings.offer_timeout_seconds));
  const [searchTimeout, setSearchTimeout] = useState(String(db.settings.search_timeout_seconds));
  const [maxPickupDist, setMaxPickupDist] = useState(String(db.settings.max_pickup_distance_meters));
  const [staleLocationSec, setStaleLocationSec] = useState(String(db.settings.stale_location_seconds));
  const [moveThreshold, setMoveThreshold] = useState(String(db.settings.move_threshold_meters));
  const [stalledHours, setStalledHours] = useState(String(db.settings.stalled_ride_hours));
  const [sosHoldSec, setSosHoldSec] = useState(String(db.settings.sos_hold_seconds));
  const [sosEscSec, setSosEscSec] = useState(String(db.settings.sos_escalation_seconds));
  const [longStopMin, setLongStopMin] = useState(String(db.settings.long_stop_minutes));
  const [disconnectMin, setDisconnectMin] = useState(String(db.settings.disconnect_alert_minutes));

  const [mapToolMode, setMapToolMode] = useState<'ZONE' | 'MEETING_POINT'>('ZONE');
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('AREA');
  const [bufferMeters, setBufferMeters] = useState('15');
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  const [mpName, setMpName] = useState('');
  const [mpZoneId, setMpZoneId] = useState(db.restricted_zones[0]?.id || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const fareSampleRows = useMemo(() => {
    const base = Math.max(0, Number(baseFareSantim) || 0);
    const perKm = Math.max(0, Number(pricePerKmSantim) || 0);
    const min = Math.max(0, Number(minFareSantim) || 0);
    const commPct = Math.max(0, Math.min(100, Number(commissionPct) || 0));

    return [1.5, 3, 5, 8].map((km) => {
      const raw = base + km * perKm;
      const clamped = Math.max(min, raw);
      const fareSantim = Math.ceil(clamped / 100) * 100;
      const commSantim = Math.round((fareSantim * commPct) / 100);
      return {
        km,
        fareSantim,
        commSantim,
        driverTakeSantim: fareSantim - commSantim,
      };
    });
  }, [baseFareSantim, pricePerKmSantim, minFareSantim, commissionPct]);

  const handleCreateFareVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const res = await backend.updateFareConfig({
        base_fare_santim: Number(baseFareSantim),
        price_per_km_santim: Number(pricePerKmSantim),
        minimum_fare_santim: Number(minFareSantim),
        no_show_wait_seconds: Number(noShowWaitSec),
        commission_percent: Number(commissionPct),
        confirm: confirmFareStep,
        override_validation: overrideLowMin,
      });
      setNoticeMsg(`Created immutable fare_configs version v${res.version} and activated it.`);
      setConfirmFareStep(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Fare update failed.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await backend.updateSettings({
        offer_timeout_seconds: Number(offerTimeout),
        search_timeout_seconds: Number(searchTimeout),
        max_pickup_distance_meters: Number(maxPickupDist),
        stale_location_seconds: Number(staleLocationSec),
        move_threshold_meters: Number(moveThreshold),
        stalled_ride_hours: Number(stalledHours),
        sos_hold_seconds: Number(sosHoldSec),
        sos_escalation_seconds: Number(sosEscSec),
        long_stop_minutes: Number(longStopMin),
        disconnect_alert_minutes: Number(disconnectMin),
      });
      setNoticeMsg('Operational settings updated.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const handleMapClick = (pt: LatLng) => {
    if (mapToolMode === 'MEETING_POINT') {
      setDraftPoints([pt]);
    } else {
      setDraftPoints((prev) => [...prev, pt]);
    }
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const res = await backend.saveRestrictedZone({
        name: zoneName,
        type: zoneType,
        points: draftPoints,
        buffer_meters: zoneType === 'ROAD' ? Number(bufferMeters) : null,
        active: true,
      });
      setNoticeMsg(`Saved restricted zone (${res.zone_id}).`);
      setZoneName('');
      setDraftPoints([]);
      setMpZoneId(res.zone_id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save zone.');
    }
  };

  const handleSaveMeetingPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    const pt = draftPoints[0];
    if (!pt) {
      setErrorMsg('INVALID_GEOMETRY');
      return;
    }
    try {
      const res = await backend.saveMeetingPoint({
        name: mpName,
        location: pt,
        zone_id: mpZoneId || db.restricted_zones[0]?.id || '',
        active: true,
      });
      setNoticeMsg(`Saved gate meeting point (${res.point_id.slice(0, 8)}).`);
      setMpName('');
      setDraftPoints([]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save meeting point.');
    }
  };

  const handleToggleZone = async (zoneId: string) => {
    const zone = db.restricted_zones.find((z) => z.id === zoneId);
    if (!zone) return;
    setErrorMsg(null);
    try {
      await backend.saveRestrictedZone({
        zone_id: zone.id,
        name: zone.name,
        type: zone.type,
        points: zone.points,
        buffer_meters: zone.buffer_meters,
        active: !zone.active,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to toggle zone.');
    }
  };

  const handleToggleMeetingPoint = async (pointId: string) => {
    const mp = db.meeting_points.find((m) => m.id === pointId);
    if (!mp) return;
    setErrorMsg(null);
    try {
      await backend.saveMeetingPoint({
        point_id: mp.id,
        name: mp.name,
        location: mp.location,
        zone_id: mp.zone_id,
        active: !mp.active,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to toggle meeting point.');
    }
  };

  const settingFields: Array<{
    label: string;
    hint: string;
    val: string;
    setter: (v: string) => void;
  }> = [
    { label: 'Offer timeout (s)', hint: 'Seconds driver has to accept an offer', val: offerTimeout, setter: setOfferTimeout },
    { label: 'Search timeout (s)', hint: 'Max seconds searching before NO_DRIVER_FOUND', val: searchTimeout, setter: setSearchTimeout },
    { label: 'Max pickup dist (m)', hint: 'Max straight-line radius to match drivers', val: maxPickupDist, setter: setMaxPickupDist },
    { label: 'Stale location (s)', hint: 'Seconds before driver GPS fix expires', val: staleLocationSec, setter: setStaleLocationSec },
    { label: 'Move threshold (m)', hint: 'Min movement to avoid long-stop trigger', val: moveThreshold, setter: setMoveThreshold },
    { label: 'Stalled ride (h)', hint: 'Hours active before ride flags stalled', val: stalledHours, setter: setStalledHours },
    { label: 'SOS hold (s)', hint: 'Button press duration to trigger SOS', val: sosHoldSec, setter: setSosHoldSec },
    { label: 'SOS escalation (s)', hint: 'Interval between backup SMS escalations', val: sosEscSec, setter: setSosEscSec },
    { label: 'Long stop alert (min)', hint: 'Minutes stationary before safety check', val: longStopMin, setter: setLongStopMin },
    { label: 'Disconnect alert (min)', hint: 'Offline driver threshold during active trip', val: disconnectMin, setter: setDisconnectMin },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Fares, Settings &amp; Restricted Zones Map
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Publish immutable fare versions (santim), tune dispatch/safety timers, and draw Dilla restricted zones and pickup gates.
        </p>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
          Error code: <span className="font-mono font-semibold">{errorMsg}</span>
        </div>
      )}
      {noticeMsg && (
        <div className="px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg">
          {noticeMsg}
        </div>
      )}

      {/* Restricted Zones & Meeting Points Map Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Dilla Map Editor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click the map to place{' '}
                {mapToolMode === 'ZONE'
                  ? zoneType === 'AREA'
                    ? 'polygon vertices (min 3)'
                    : 'road points (min 2)'
                  : '1 gate meeting point'}
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMapToolMode('ZONE');
                    setDraftPoints([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    mapToolMode === 'ZONE'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Draw Zone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapToolMode('MEETING_POINT');
                    setDraftPoints([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    mapToolMode === 'MEETING_POINT'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Place Gate
                </button>
              </div>
              {draftPoints.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setDraftPoints((prev) => prev.slice(0, -1))}
                    className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftPoints([])}
                    className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear ({draftPoints.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <DillaMapCanvas
            zones={db.restricted_zones}
            meetingPoints={db.meeting_points}
            draftPoints={draftPoints}
            onMapClick={handleMapClick}
            heightClass="h-[400px]"
          />

          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Draft coordinates:{' '}
            {draftPoints.length === 0
              ? 'none placed yet'
              : draftPoints.map((p) => `(${p.lat}, ${p.lng})`).join(' -> ')}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          {mapToolMode === 'ZONE' ? (
            <form
              onSubmit={handleSaveZone}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5"
            >
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Save Restricted Zone (saveRestrictedZone)
              </div>
              <input
                type="text"
                required
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Zone name (e.g. Dilla Stadium Grounds)"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value as ZoneType)}
                  className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="AREA">AREA (Polygon)</option>
                  <option value="ROAD">ROAD (Polyline)</option>
                </select>
                {zoneType === 'ROAD' && (
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={bufferMeters}
                    onChange={(e) => setBufferMeters(e.target.value)}
                    placeholder="Buffer meters (default 15)"
                    className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Save Zone ({draftPoints.length} pts)</span>
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSaveMeetingPoint}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5"
            >
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Save Gate Meeting Point (saveMeetingPoint)
              </div>
              <input
                type="text"
                required
                value={mpName}
                onChange={(e) => setMpName(e.target.value)}
                placeholder="Gate name (e.g. Science Block Gate)"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={mpZoneId}
                onChange={(e) => setMpZoneId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {db.restricted_zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.type})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-600 rounded-lg inline-flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>Save Meeting Point</span>
              </button>
            </form>
          )}

          {/* Active Zones & Meeting Points List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Configured Zones &amp; Gates
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {db.restricted_zones.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{z.name}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {z.type} · {z.points.length} pts
                      {z.buffer_meters ? ` · ${z.buffer_meters}m` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleZone(z.id)}
                    className={`px-2.5 py-1 text-xs font-mono border rounded whitespace-nowrap ${
                      z.active
                        ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                        : 'text-slate-500 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {z.active ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              ))}
              {db.meeting_points.map((mp) => (
                <div
                  key={mp.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Gate: {mp.name}
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {mp.location.lat.toFixed(4)}, {mp.location.lng.toFixed(4)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleMeetingPoint(mp.id)}
                    className={`px-2.5 py-1 text-xs font-mono border rounded whitespace-nowrap ${
                      mp.active
                        ? 'text-teal-700 border-teal-300 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900'
                        : 'text-slate-500 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {mp.active ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fare Versions & Operational Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Fare Rules (fare_configs)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active version:{' '}
              <span className="font-mono font-semibold">v{db.settings.active_fare_config_version}</span>. All amounts in santim (100 santim = 1 birr).
            </p>
          </div>

          <form onSubmit={handleCreateFareVersion} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Base Fare (santim)
                </label>
                <input
                  type="number"
                  value={baseFareSantim}
                  onChange={(e) => setBaseFareSantim(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-400">
                  {formatBirr(Number(baseFareSantim))}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Price / km (santim)
                </label>
                <input
                  type="number"
                  value={pricePerKmSantim}
                  onChange={(e) => setPricePerKmSantim(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-400">
                  {formatBirr(Number(pricePerKmSantim))}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Min Fare (santim)
                </label>
                <input
                  type="number"
                  value={minFareSantim}
                  onChange={(e) => setMinFareSantim(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <span className="text-xs font-mono text-slate-400">
                  {formatBirr(Number(minFareSantim))}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  No-show Wait (s)
                </label>
                <input
                  type="number"
                  value={noShowWaitSec}
                  onChange={(e) => setNoShowWaitSec(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Live Fare Simulator Preview */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Draft Fare Preview (Rounded to whole Birr)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                {fareSampleRows.map((row) => (
                  <div
                    key={row.km}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded"
                  >
                    <div className="text-slate-500 dark:text-slate-400">{row.km} km trip</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatBirr(row.fareSantim)}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Fee {formatBirr(row.commSantim)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1 text-sm">
              <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={confirmFareStep}
                  onChange={(e) => setConfirmFareStep(e.target.checked)}
                />
                <span>
                  I confirm publishing a new immutable fare version (CONFIRMATION_REQUIRED)
                </span>
              </label>
              {Number(minFareSantim) < 2000 && (
                <label className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={overrideLowMin}
                    onChange={(e) => setOverrideLowMin(e.target.checked)}
                  />
                  <span>Override 2000 santim (20 birr) minimum fare safety guard</span>
                </label>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg whitespace-nowrap"
              >
                Publish New Fare Version
              </button>
            </div>
          </form>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Immutable Version History
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {db.fare_configs.map((fc) => (
                <div
                  key={fc.version}
                  className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono tabular-nums"
                >
                  <span>
                    v{fc.version}{' '}
                    {fc.version === db.settings.active_fare_config_version ? '(ACTIVE)' : ''}
                  </span>
                  <span>
                    Base {formatBirr(fc.base_fare_santim)} · {formatBirr(fc.price_per_km_santim)}/km · Min{' '}
                    {formatBirr(fc.minimum_fare_santim)} · {fc.commission_percent}%
                  </span>
                  <span className="text-slate-400">{formatAddisShortTime(fc.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Form with Inline Field Hints */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              System Thresholds &amp; Safety Timers (settings)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Updates apply immediately to matching, GPS move thresholds, stalled checks, and SOS escalation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {settingFields.map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={field.val}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {field.hint}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Last updated: {formatAddisShortTime(db.settings.updated_at)}
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg whitespace-nowrap"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
