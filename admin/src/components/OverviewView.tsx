import React from 'react';
import type { SandboxDatabase } from '../data/seedDilla';
import { formatAddisShortTime, formatBirr, getDriverStatusLabel } from '../utils/format';
import { DillaMapCanvas } from './DillaMapCanvas';

interface OverviewViewProps {
  db: SandboxDatabase;
  onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ db, onNavigate }) => {
  const readyCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'Ready').length;
  const onRideCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'On ride').length;
  const noSignalCount = db.drivers.filter((d) => getDriverStatusLabel(d) === 'No signal').length;
  const activeRides = db.rides.filter((r) =>
    ['REQUESTED', 'SEARCHING', 'DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS'].includes(r.status)
  );
  const openDisputes = db.disputes.filter((d) => d.status === 'OPEN').length;
  const openSos = db.sos_alerts.filter((s) => s.status !== 'RESOLVED').length;

  const totalCompletedSantim = db.payments.reduce((acc, p) => acc + p.confirmed_fare_santim, 0);
  const totalCommissionSantim = db.payments.reduce((acc, p) => acc + p.commission_santim, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Dilla Operations Overview
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Live fleet availability, active rides, and daily totals (Africa/Addis_Ababa)
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Online Drivers</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {readyCount + onRideCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {readyCount} Ready · {onRideCount} On ride · {noSignalCount} No signal
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Rides</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {activeRides.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {db.rides.filter((r) => r.stalled).length} stalled · {db.rides.length} total
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Today&apos;s Fares &amp; Commission
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatBirr(totalCompletedSantim)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Commission: {formatBirr(totalCommissionSantim)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Queues Requiring Action
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {openSos + openDisputes}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {openSos} SOS · {openDisputes} Disputes
          </div>
        </div>
      </div>

      {/* Live Map + Active Rides Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Live Fleet &amp; Restricted Zones Map
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('fares')}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
            heightClass="h-[400px]"
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
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
            {db.rides.slice(0, 6).map((ride) => (
              <div key={ride.id} className="px-5 py-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {ride.status}
                    {ride.stalled ? ' · STALLED' : ''}
                  </span>
                  <span className="text-sm font-mono font-medium tabular-nums text-slate-700 dark:text-slate-300">
                    {formatBirr(ride.fare_santim)}
                  </span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {ride.pickup_address} -&gt; {ride.destination_address}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {ride.driver_snapshot?.name || 'Unassigned'} · {formatAddisShortTime(ride.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
