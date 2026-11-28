import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { SandboxDatabase } from '../data/seedDilla';
import { formatAddisShortTime, formatBirr, getDriverStatusLabel } from '../utils/format';
import { DillaMapCanvas } from './DillaMapCanvas';

interface OverviewViewProps {
  db: SandboxDatabase;
  onNavigate: (tab: string) => void;
  onInspectRide: (rideId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ db, onNavigate, onInspectRide }) => {
  const readyCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'Ready').length;
  const onRideCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'On ride').length;
  const paymentPendingCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'Payment pending').length;
  const noSignalCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'No signal').length;
  const offlineCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'Offline').length;
  const totalDrivers = Math.max(1, db.drivers.length);

  const activeRides = db.rides.filter((r) =>
    ['REQUESTED', 'SEARCHING', 'DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS'].includes(r.status)
  );
  const completedRidesCount = db.rides.filter((r) => r.status === 'COMPLETED').length;
  const stalledRidesCount = db.rides.filter((r) => r.stalled).length;
  const cancelledRidesCount = db.rides.filter((r) =>
    ['CANCELLED', 'NO_DRIVER_FOUND', 'EXPIRED'].includes(r.status)
  ).length;
  const totalRides = Math.max(1, db.rides.length);

  const openDisputes = db.disputes.filter((d) => d.status === 'OPEN').length;
  const openSos = db.sos_alerts.filter((s) => s.status !== 'RESOLVED').length;

  const totalCompletedSantim = db.payments.reduce((acc, p) => acc + p.confirmed_fare_santim, 0);
  const totalCommissionSantim = db.payments.reduce((acc, p) => acc + p.commission_santim, 0);
  const unpaidCommissionSantim = db.weekly_statements
    .filter((s) => s.status === 'UNPAID')
    .reduce((acc, s) => acc + s.commission_santim + s.adjustments_santim, 0);
  const paidCommissionSantim = db.weekly_statements
    .filter((s) => s.status === 'PAID')
    .reduce((acc, s) => acc + s.commission_santim + s.adjustments_santim, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Dilla Operations Overview
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Live fleet availability, active trip vectors, and daily settlement totals (Africa/Addis_Ababa)
        </p>
      </div>

      {/* KPI Strip (Clickable Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => onNavigate('drivers')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 space-y-1.5 transition-colors group"
        >
          <div className="flex items-center justify-between text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>Online Drivers</span>
            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {readyCount + onRideCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {readyCount} Ready · {onRideCount} On ride · {noSignalCount} No signal
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('rides')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 space-y-1.5 transition-colors group"
        >
          <div className="flex items-center justify-between text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>Active Rides</span>
            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {activeRides.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stalledRidesCount} stalled · {db.rides.length} total logged
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('statements')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 space-y-1.5 transition-colors group"
        >
          <div className="flex items-center justify-between text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>Today&apos;s Fares &amp; Commission</span>
            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatBirr(totalCompletedSantim)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Commission: {formatBirr(totalCommissionSantim)} · Unpaid: {formatBirr(unpaidCommissionSantim)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(openSos > 0 ? 'sos' : 'rides')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 space-y-1.5 transition-colors group"
        >
          <div className="flex items-center justify-between text-sm font-medium text-slate-500 dark:text-slate-400">
            <span>Queues Requiring Action</span>
            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div
            className={`text-3xl font-bold font-mono tabular-nums ${
              openSos > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {openSos + openDisputes}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {openSos} SOS · {openDisputes} Open Disputes
          </div>
        </button>
      </div>

      {/* Operational Distribution Bars (Real Fleet & Trip Data) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Fleet Availability Breakdown
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {db.drivers.length} registered drivers
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex">
            <div style={{ width: `${(readyCount / totalDrivers) * 100}%` }} className="bg-emerald-600" />
            <div style={{ width: `${(onRideCount / totalDrivers) * 100}%` }} className="bg-blue-600" />
            <div style={{ width: `${(paymentPendingCount / totalDrivers) * 100}%` }} className="bg-amber-500" />
            <div style={{ width: `${(noSignalCount / totalDrivers) * 100}%` }} className="bg-red-600" />
            <div style={{ width: `${(offlineCount / totalDrivers) * 100}%` }} className="bg-slate-400 dark:bg-slate-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
              <span>Ready {readyCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
              <span>On ride {onRideCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span>Pay lock {paymentPendingCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 shrink-0" />
              <span>No sig {noSignalCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 shrink-0" />
              <span>Offline {offlineCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ride Pipeline &amp; Weekly Settlement
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Settled: {formatBirr(paidCommissionSantim)}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex">
            <div style={{ width: `${(activeRides.length / totalRides) * 100}%` }} className="bg-blue-600" />
            <div style={{ width: `${(completedRidesCount / totalRides) * 100}%` }} className="bg-emerald-600" />
            <div style={{ width: `${(cancelledRidesCount / totalRides) * 100}%` }} className="bg-slate-400 dark:bg-slate-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
              <span>Active {activeRides.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
              <span>Completed {completedRidesCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span>Stalled {stalledRidesCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 shrink-0" />
              <span>Closed {cancelledRidesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Map + Active Rides Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Live Fleet &amp; Restricted Zones Map
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any driver dot, active route, or gate marker to inspect details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fares')}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Edit Zones
            </button>
          </div>
          <DillaMapCanvas
            zones={db.restricted_zones}
            meetingPoints={db.meeting_points}
            driverLocations={db.driver_locations}
            drivers={db.drivers}
            profiles={db.profiles}
            rides={db.rides}
            heightClass="h-[420px]"
          />
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent &amp; Active Rides
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('rides')}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
            {db.rides.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No rides recorded yet.
              </div>
            ) : (
              db.rides.slice(0, 6).map((ride) => (
                <button
                  key={ride.id}
                  type="button"
                  onClick={() => onInspectRide(ride.id)}
                  className="w-full text-left px-5 py-4 space-y-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {ride.status}
                      {ride.stalled ? ' · STALLED' : ''}
                    </span>
                    <span className="text-sm font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {formatBirr(ride.fare_santim)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {ride.pickup_address} -&gt; {ride.destination_address}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {ride.driver_snapshot?.name || 'Unassigned'} · {formatAddisShortTime(ride.created_at)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
