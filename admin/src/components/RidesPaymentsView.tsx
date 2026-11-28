import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Phone, Search, X, XCircle } from 'lucide-react';
import type { DisputeOutcome, RideStatus } from '../contract/types';
import type { SandboxDatabase } from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import {
  downloadCsv,
  formatAddisShortTime,
  formatAddisTime,
  formatBirr,
} from '../utils/format';

interface RidesPaymentsViewProps {
  db: SandboxDatabase;
  initialSearch?: string;
  onConsumeInitialSearch?: () => void;
}

const ACTIVE_STATUSES: RideStatus[] = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ACCEPTED',
  'ARRIVED_AT_PICKUP',
  'IN_PROGRESS',
];

export const RidesPaymentsView: React.FC<RidesPaymentsViewProps> = ({
  db,
  initialSearch,
  onConsumeInitialSearch,
}) => {
  const [rideFilter, setRideFilter] = useState<'ALL' | 'ACTIVE' | 'STALLED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(initialSearch || null);
  const [closingRideId, setClosingRideId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState('');

  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DisputeOutcome>('FULL_FARE_CONFIRMED');
  const [reducedFareBirr, setReducedFareBirr] = useState('50');
  const [disputeNote, setDisputeNote] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setSelectedRideId(initialSearch);
      setRideFilter('ALL');
      onConsumeInitialSearch?.();
    }
  }, [initialSearch, onConsumeInitialSearch]);

  const filteredRides = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.rides.filter((r) => {
      if (rideFilter === 'ACTIVE' && !ACTIVE_STATUSES.includes(r.status)) return false;
      if (rideFilter === 'STALLED' && !r.stalled) return false;
      if (rideFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;
      if (
        rideFilter === 'CANCELLED' &&
        !['CANCELLED', 'NO_DRIVER_FOUND', 'EXPIRED'].includes(r.status)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.pickup_address.toLowerCase().includes(q) ||
        r.destination_address.toLowerCase().includes(q) ||
        (r.driver_snapshot?.name || '').toLowerCase().includes(q) ||
        (r.passenger_snapshot?.name || '').toLowerCase().includes(q)
      );
    });
  }, [db.rides, rideFilter, search]);

  const selectedRide = useMemo(() => {
    if (!selectedRideId) return null;
    return db.rides.find((r) => r.id === selectedRideId) || null;
  }, [db.rides, selectedRideId]);

  const stalledCount = db.rides.filter((r) => r.stalled).length;
  const openDisputesCount = db.disputes.filter((d) => d.status === 'OPEN').length;

  const activeDispute = useMemo(() => {
    if (selectedDisputeId) {
      return db.disputes.find((d) => d.id === selectedDisputeId) || null;
    }
    return db.disputes.find((d) => d.status === 'OPEN') || db.disputes[0] || null;
  }, [db.disputes, selectedDisputeId]);

  const handleExportRidesCsv = () => {
    downloadCsv(
      `dilla-rides-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Ride ID', 'Status', 'Stalled', 'Pickup', 'Destination', 'Passenger', 'Driver', 'Distance (m)', 'Fare (santim)', 'Fare Version', 'Created'],
      filteredRides.map((r) => [
        r.id,
        r.status,
        r.stalled,
        r.pickup_address,
        r.destination_address,
        r.passenger_snapshot?.name || r.passenger_id,
        r.driver_snapshot?.name || '',
        r.distance_meters,
        r.fare_santim,
        r.fare_config_version,
        r.created_at,
      ])
    );
  };

  const handleExportPaymentsCsv = () => {
    downloadCsv(
      `dilla-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Ride ID', 'Week ID', 'Quoted (santim)', 'Confirmed (santim)', 'Commission (%)', 'Commission (santim)', 'Status', 'Updated'],
      db.payments.map((p) => [
        p.ride_id,
        p.week_id,
        p.fare_santim,
        p.confirmed_fare_santim,
        p.commission_percent,
        p.commission_santim,
        p.status,
        p.updated_at,
      ])
    );
  };

  const handleCloseStalled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingRideId) return;
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await backend.closeStalledRide({ ride_id: closingRideId, note: closeNote });
      setNoticeMsg(`Ride ${closingRideId.slice(0, 8)} closed and driver unlocked.`);
      setClosingRideId(null);
      setCloseNote('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to close stalled ride.');
    }
  };

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDispute) return;
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const confirmedSantim =
        outcome === 'REDUCED_FARE_CONFIRMED'
          ? Math.round(Number(reducedFareBirr) * 100)
          : undefined;
      await backend.resolveDispute({
        dispute_id: activeDispute.id,
        outcome,
        confirmed_fare_santim: confirmedSantim,
        admin_note: disputeNote,
      });
      setNoticeMsg(`Dispute resolved (${outcome}). Payment & weekly statement updated.`);
      setDisputeNote('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resolve dispute.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Rides, Stalled Queue &amp; Payment Disputes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Click any ride row to inspect its lifecycle timestamps, close stalled rides (&gt;{db.settings.stalled_ride_hours}h), and resolve fare disputes.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono tabular-nums">
          <span className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            Stalled: {stalledCount}
          </span>
          <span className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
            Open Disputes: {openDisputesCount}
          </span>
        </div>
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

      {/* Selected Ride Lifecycle Inspector */}
      {selectedRide && (() => {
        const pinRec = db.ride_pins.find((p) => p.ride_id === selectedRide.id);
        return (
          <div className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Ride {selectedRide.id} · {selectedRide.status}
                  {selectedRide.stalled ? ' · STALLED' : ''}
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedRide.pickup_address} -&gt; {selectedRide.destination_address}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRideId(null);
                  if (search === selectedRide.id) setSearch('');
                }}
                aria-label="Close ride inspector"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono tabular-nums border-t border-slate-200 dark:border-slate-800 pt-3.5">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Created</div>
                <div className="text-slate-900 dark:text-slate-100 mt-0.5">{formatAddisShortTime(selectedRide.created_at)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Accepted</div>
                <div className="text-slate-900 dark:text-slate-100 mt-0.5">{formatAddisShortTime(selectedRide.accepted_at)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Arrived</div>
                <div className="text-slate-900 dark:text-slate-100 mt-0.5">{formatAddisShortTime(selectedRide.arrived_at)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Started</div>
                <div className="text-slate-900 dark:text-slate-100 mt-0.5">{formatAddisShortTime(selectedRide.started_at)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">
                  {selectedRide.cancelled_at ? `Cancelled (${selectedRide.cancelled_by})` : 'Completed'}
                </div>
                <div className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatAddisShortTime(selectedRide.completed_at || selectedRide.cancelled_at)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="flex flex-wrap items-center gap-4 font-mono text-slate-600 dark:text-slate-300">
                <span>Fare: {formatBirr(selectedRide.fare_santim)} ({(selectedRide.distance_meters / 1000).toFixed(2)} km)</span>
                {pinRec && <span>PIN fails: {pinRec.failed_attempts}/{db.settings.max_pin_attempts}</span>}
                {selectedRide.contact && (
                  <>
                    <a href={`tel:${selectedRide.contact.passenger_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      Passenger: {selectedRide.contact.passenger_phone}
                    </a>
                    <a href={`tel:${selectedRide.contact.driver_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      Driver: {selectedRide.contact.driver_phone}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rides Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['ALL', 'ACTIVE', 'STALLED', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRideFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  rideFilter === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab}
                {tab === 'STALLED' && stalledCount > 0 ? ` (${stalledCount})` : ''}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ride ID, route, driver, passenger"
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={handleExportRidesCsv}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {closingRideId && (
          <form
            onSubmit={handleCloseStalled}
            className="px-5 py-3.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 flex flex-wrap items-center gap-3"
          >
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200 whitespace-nowrap">
              Close ride {closingRideId.slice(0, 8)}:
            </span>
            <input
              type="text"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="Required operator note explaining stalled closure"
              className="flex-1 min-w-52 px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-800 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                setClosingRideId(null);
                setCloseNote('');
              }}
              className="px-3.5 py-2 text-sm text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg whitespace-nowrap"
            >
              Confirm Close
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5">Ride &amp; Status</th>
                <th className="px-5 py-3.5">Route (Dilla)</th>
                <th className="px-5 py-3.5">Participants</th>
                <th className="px-5 py-3.5">Fare &amp; Distance</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                    No rides match the current filter.
                  </td>
                </tr>
              ) : (
                filteredRides.map((ride) => {
                  const canAdminClose = !['COMPLETED', 'CANCELLED', 'NO_DRIVER_FOUND', 'EXPIRED'].includes(
                    ride.status
                  );
                  const isSelected = selectedRideId === ride.id;
                  return (
                    <tr
                      key={ride.id}
                      onClick={() => setSelectedRideId(isSelected ? null : ride.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {ride.status}
                        </div>
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {ride.id.slice(0, 8)}
                          {ride.stalled ? (
                            <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                              STALLED
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {ride.pickup_address}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          -&gt; {ride.destination_address}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-900 dark:text-slate-100">
                          P: {ride.passenger_snapshot?.name || ride.passenger_id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          D: {ride.driver_snapshot?.name || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono tabular-nums">
                        <div className="text-slate-900 dark:text-slate-100 font-semibold">
                          {formatBirr(ride.fare_santim)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {(ride.distance_meters / 1000).toFixed(2)} km · v{ride.fare_config_version}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatAddisShortTime(ride.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {canAdminClose ? (
                          <button
                            type="button"
                            onClick={() => {
                              setClosingRideId(ride.id);
                              setCloseNote('');
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 whitespace-nowrap inline-flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Close Stalled</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disputes Queue & Payments Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Dispute Resolution Queue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Passenger and driver phone numbers are shown strictly for dispute mediation.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {db.disputes.length} total
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {db.disputes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No disputes recorded.</div>
            ) : (
              db.disputes.map((d) => {
                const selected = activeDispute?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDisputeId(d.id)}
                    className={`w-full px-4 py-3.5 text-left transition-colors ${
                      selected
                        ? 'bg-blue-50/70 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-mono font-semibold inline-flex items-center gap-1.5 ${
                          d.status === 'OPEN'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {d.status === 'OPEN' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>
                          {d.status} · {d.type}
                        </span>
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatAddisShortTime(d.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-800 dark:text-slate-200 mt-1.5">{d.reason}</div>
                    {d.reported_received_santim !== null && (
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                        Driver reported received: {formatBirr(d.reported_received_santim)}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {activeDispute && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Passenger Phone</div>
                  <a
                    href={`tel:${activeDispute.passenger_phone}`}
                    className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 mt-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{activeDispute.passenger_phone}</span>
                  </a>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Driver Phone</div>
                  <a
                    href={`tel:${activeDispute.driver_phone}`}
                    className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 mt-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{activeDispute.driver_phone}</span>
                  </a>
                </div>
              </div>

              {activeDispute.status === 'OPEN' ? (
                <form onSubmit={handleResolveDispute} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        Resolution Outcome
                      </label>
                      <select
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value as DisputeOutcome)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      >
                        <option value="FULL_FARE_CONFIRMED">FULL_FARE_CONFIRMED</option>
                        <option value="REDUCED_FARE_CONFIRMED">REDUCED_FARE_CONFIRMED</option>
                        <option value="DRIVER_AT_FAULT">DRIVER_AT_FAULT</option>
                      </select>
                    </div>
                    {outcome === 'REDUCED_FARE_CONFIRMED' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                          Confirmed Fare (birr)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={reducedFareBirr}
                          onChange={(e) => setReducedFareBirr(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={disputeNote}
                    onChange={(e) => setDisputeNote(e.target.value)}
                    placeholder="Required admin note summarizing phone call & decision"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg whitespace-nowrap"
                    >
                      Resolve Dispute
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm space-y-1">
                  <div>
                    Resolved as <span className="font-mono font-semibold">{activeDispute.outcome}</span> · Confirmed:{' '}
                    <span className="font-mono">{formatBirr(activeDispute.confirmed_fare_santim)}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Note: {activeDispute.admin_note} · {formatAddisTime(activeDispute.resolved_at)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payments Table */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Cash Payments Ledger
              </h2>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                {db.payments.length} records
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportPaymentsCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">Ride / Week</th>
                  <th className="px-5 py-3.5">Quoted -&gt; Confirmed</th>
                  <th className="px-5 py-3.5">Commission</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {db.payments.map((p) => (
                  <tr key={p.ride_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4 font-mono">
                      <div className="text-slate-900 dark:text-slate-100">{p.ride_id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.week_id}</div>
                    </td>
                    <td className="px-5 py-4 font-mono tabular-nums">
                      <div className="text-slate-900 dark:text-slate-100">
                        {formatBirr(p.fare_santim)} -&gt; {formatBirr(p.confirmed_fare_santim)}
                      </div>
                      {p.difference && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Diff: {formatBirr(p.difference.reported_received_santim)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatBirr(p.commission_santim)} ({p.commission_percent}%)
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
