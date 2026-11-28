import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, ShieldBan, ShieldCheck, X } from 'lucide-react';
import type { DriverApproval } from '../contract/types';
import type { SandboxDatabase } from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import {
  downloadCsv,
  formatAddisShortTime,
  formatBirr,
  getDriverStatusLabel,
} from '../utils/format';

interface DriversViewProps {
  db: SandboxDatabase;
}

type DriverFilter =
  | 'ALL'
  | 'READY'
  | 'ON_RIDE'
  | 'PAYMENT_PENDING'
  | 'NO_SIGNAL'
  | 'OFFLINE'
  | 'PENDING_APPROVAL';

export const DriversView: React.FC<DriversViewProps> = ({ db }) => {
  const [filter, setFilter] = useState<DriverFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+2519');
  const [loginId, setLoginId] = useState('');
  const [tempPass, setTempPass] = useState('');
  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('Bajaj Boxer 150');
  const [color, setColor] = useState('Red');

  const [blockTarget, setBlockTarget] = useState<{
    uid: string;
    name: string;
    currentlyBlocked: boolean;
  } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    let ready = 0;
    let onRide = 0;
    let payPending = 0;
    let noSignal = 0;
    let offline = 0;
    let pendingApproval = 0;
    for (const d of db.drivers) {
      const chip = getDriverStatusLabel(d);
      if (chip === 'Ready') ready += 1;
      else if (chip === 'On ride') onRide += 1;
      else if (chip === 'Payment pending') payPending += 1;
      else if (chip === 'No signal') noSignal += 1;
      else offline += 1;
      if (d.approval === 'PENDING') pendingApproval += 1;
    }
    return {
      ALL: db.drivers.length,
      READY: ready,
      ON_RIDE: onRide,
      PAYMENT_PENDING: payPending,
      NO_SIGNAL: noSignal,
      OFFLINE: offline,
      PENDING_APPROVAL: pendingApproval,
    };
  }, [db.drivers]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.drivers.filter((driver) => {
      const chip = getDriverStatusLabel(driver);
      if (filter === 'READY' && chip !== 'Ready') return false;
      if (filter === 'ON_RIDE' && chip !== 'On ride') return false;
      if (filter === 'PAYMENT_PENDING' && chip !== 'Payment pending') return false;
      if (filter === 'NO_SIGNAL' && chip !== 'No signal') return false;
      if (filter === 'OFFLINE' && chip !== 'Offline') return false;
      if (filter === 'PENDING_APPROVAL' && driver.approval !== 'PENDING') return false;

      if (!q) return true;
      const profile = db.profiles.find((p) => p.id === driver.id);
      return (
        (profile?.name || '').toLowerCase().includes(q) ||
        driver.login_id.toLowerCase().includes(q) ||
        (profile?.phone || '').toLowerCase().includes(q) ||
        driver.plate.toLowerCase().includes(q) ||
        driver.license_number.toLowerCase().includes(q)
      );
    });
  }, [db.drivers, db.profiles, filter, search]);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) return null;
    return db.drivers.find((d) => d.id === selectedDriverId) || null;
  }, [db.drivers, selectedDriverId]);

  const handleExportCsv = () => {
    downloadCsv(
      `dilla-drivers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Login ID', 'Phone', 'Plate', 'Model', 'Color', 'License', 'Status', 'Approval', 'Account', 'Rating', 'Last Seen'],
      filteredDrivers.map((d) => {
        const p = db.profiles.find((u) => u.id === d.id);
        return [
          p?.name || '',
          d.login_id,
          p?.phone || '',
          d.plate,
          d.model,
          d.color,
          d.license_number,
          getDriverStatusLabel(d),
          d.approval,
          p?.status || 'ACTIVE',
          d.rating_average.toFixed(2),
          d.last_seen_at || '',
        ];
      })
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const res = await backend.createDriver({
        name,
        phone,
        login_id: loginId,
        temporary_password: tempPass,
        license_number: license,
        motorcycle: { plate, model, color },
      });
      setNoticeMsg(`Driver created (${res.uid}). Approval is PENDING until approved.`);
      setShowCreate(false);
      setName('');
      setPhone('+2519');
      setLoginId('');
      setTempPass('');
      setLicense('');
      setPlate('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Create driver failed.');
    }
  };

  const handleApprove = async (uid: string, approval: DriverApproval) => {
    setErrorMsg(null);
    try {
      await backend.approveDriver({ uid, approval });
      setNoticeMsg(`Driver approval set to ${approval}.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Approval update failed.');
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTarget) return;
    setErrorMsg(null);
    try {
      await backend.blockUser({
        uid: blockTarget.uid,
        blocked: !blockTarget.currentlyBlocked,
        reason: blockReason,
      });
      setNoticeMsg(
        `${blockTarget.name} is now ${blockTarget.currentlyBlocked ? 'ACTIVE' : 'BLOCKED'}.`
      );
      setBlockTarget(null);
      setBlockReason('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Block update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Drivers &amp; Approvals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create accounts, approve documents, filter live presence states, or block accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{showCreate ? 'Close Form' : 'Create Driver'}</span>
          </button>
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

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            New Driver Account (createDriver)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2519XXXXXXXX"
              className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="login_id (e.g. drv_hana)"
              className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="password"
              required
              value={tempPass}
              onChange={(e) => setTempPass(e.target.value)}
              placeholder="Temporary password (min 6)"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="License number"
              className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Plate (e.g. 3-51200 SNNPR)"
              className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Motorcycle model"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <input
              type="text"
              required
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Color"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg"
            >
              Create Driver
            </button>
          </div>
        </form>
      )}

      {blockTarget && (
        <form
          onSubmit={handleBlockSubmit}
          className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl p-5 space-y-3"
        >
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {blockTarget.currentlyBlocked ? 'Unblock' : 'Block'} {blockTarget.name}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              required
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Required audit reason"
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => setBlockTarget(null)}
              className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg"
            >
              Confirm
            </button>
          </div>
        </form>
      )}

      {/* Driver Detail Panel */}
      {selectedDriver && (() => {
        const prof = db.profiles.find((p) => p.id === selectedDriver.id);
        const stmts = db.weekly_statements.filter((s) => s.driver_id === selectedDriver.id);
        const unpaidTotal = stmts
          .filter((s) => s.status === 'UNPAID')
          .reduce((sum, s) => sum + s.commission_santim + s.adjustments_santim, 0);
        const activeRide = db.rides.find((r) => r.id === selectedDriver.current_ride_id);
        return (
          <div className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {prof?.name || selectedDriver.login_id}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedDriver.login_id} · {prof?.phone} · License {selectedDriver.license_number}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriverId(null)}
                aria-label="Close driver panel"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs border-t border-slate-200 dark:border-slate-800 pt-4">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Motorcycle</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {selectedDriver.plate} · {selectedDriver.color} {selectedDriver.model}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Unpaid Commission</div>
                <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatBirr(unpaidTotal)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Current Ride / Lock</div>
                <div className="font-mono text-slate-900 dark:text-slate-100 mt-1">
                  {activeRide
                    ? `${activeRide.status} (${activeRide.id.slice(0, 8)})`
                    : selectedDriver.payment_lock_ride_id
                      ? `Pay Lock (${selectedDriver.payment_lock_ride_id.slice(0, 8)})`
                      : 'None'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Presence &amp; Last Ready</div>
                <div className="font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {selectedDriver.connected ? 'Socket Connected' : 'Disconnected'} · {formatAddisShortTime(selectedDriver.last_ready_at)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Roster Table with Filters + Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([
              ['ALL', 'All'],
              ['READY', 'Ready'],
              ['ON_RIDE', 'On ride'],
              ['PAYMENT_PENDING', 'Pay pending'],
              ['NO_SIGNAL', 'No signal'],
              ['OFFLINE', 'Offline'],
              ['PENDING_APPROVAL', 'Pending approval'],
            ] as Array<[DriverFilter, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap tabular-nums ${
                  filter === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, plate, phone, login ID"
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5">Driver</th>
                <th className="px-5 py-3.5">Motorcycle</th>
                <th className="px-5 py-3.5">Status Chip</th>
                <th className="px-5 py-3.5">Approval</th>
                <th className="px-5 py-3.5">Rating / Seen</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                    No drivers match this filter. Clear search or switch status tabs.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const profile = db.profiles.find((p) => p.id === driver.id);
                  const chip = getDriverStatusLabel(driver);
                  const chipColor =
                    chip === 'Ready'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
                      : chip === 'On ride'
                        ? 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
                        : chip === 'Payment pending'
                          ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900'
                          : chip === 'No signal'
                            ? 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900'
                            : 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

                  const isBlocked = profile?.status === 'BLOCKED';
                  const isSelected = selectedDriverId === driver.id;

                  return (
                    <tr
                      key={driver.id}
                      onClick={() => setSelectedDriverId(isSelected ? null : driver.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {profile?.name || driver.login_id}
                          {isBlocked && (
                            <span className="ml-2 text-xs font-mono text-red-600">BLOCKED</span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {driver.login_id} · {profile?.phone}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-slate-800 dark:text-slate-200">{driver.plate}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {driver.color} {driver.model} · Lic {driver.license_number}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 border rounded text-xs font-medium whitespace-nowrap ${chipColor}`}
                        >
                          {chip}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {driver.approval}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        <div>
                          {driver.rating_average.toFixed(2)} ({driver.rating_count})
                        </div>
                        <div className="mt-0.5">{formatAddisShortTime(driver.last_seen_at)}</div>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          {driver.approval !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(driver.id, 'APPROVED')}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md whitespace-nowrap inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                          {driver.approval === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(driver.id, 'REJECTED')}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 whitespace-nowrap"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setBlockTarget({
                                uid: driver.id,
                                name: profile?.name || driver.login_id,
                                currentlyBlocked: isBlocked,
                              })
                            }
                            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap inline-flex items-center gap-1.5"
                          >
                            <ShieldBan className="w-3.5 h-3.5" />
                            <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
