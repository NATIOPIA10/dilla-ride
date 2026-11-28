import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import type { SandboxDatabase } from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import { downloadCsv, formatAddisTime, formatBirr } from '../utils/format';

interface StatementsAuditViewProps {
  db: SandboxDatabase;
}

export const StatementsAuditView: React.FC<StatementsAuditViewProps> = ({ db }) => {
  const [weekFilter, setWeekFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const weekIds = useMemo(() => {
    return Array.from(new Set(db.weekly_statements.map((s) => s.week_id))).sort().reverse();
  }, [db.weekly_statements]);

  const filteredStatements = useMemo(() => {
    return db.weekly_statements.filter((s) => weekFilter === 'ALL' || s.week_id === weekFilter);
  }, [db.weekly_statements, weekFilter]);

  const auditActions = useMemo(() => {
    return Array.from(new Set(db.audit_logs.map((a) => a.action))).sort();
  }, [db.audit_logs]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return db.audit_logs.filter((a) => {
      if (actionFilter !== 'ALL' && a.action !== actionFilter) return false;
      if (!q) return true;
      return (
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        JSON.stringify(a.after || {}).toLowerCase().includes(q)
      );
    });
  }, [db.audit_logs, actionFilter, logSearch]);

  const summary = useMemo(() => {
    const unpaidSantim = filteredStatements
      .filter((s) => s.status === 'UNPAID')
      .reduce((acc, s) => acc + s.commission_santim + s.adjustments_santim, 0);
    const paidSantim = filteredStatements
      .filter((s) => s.status === 'PAID')
      .reduce((acc, s) => acc + s.commission_santim + s.adjustments_santim, 0);
    const adjustmentsSantim = filteredStatements.reduce((acc, s) => acc + s.adjustments_santim, 0);
    return { unpaidSantim, paidSantim, adjustmentsSantim };
  }, [filteredStatements]);

  const handleExportStatementsCsv = () => {
    downloadCsv(
      `dilla-statements-${weekFilter.toLowerCase()}.csv`,
      ['Driver', 'Plate', 'Week ID', 'Rides', 'Total Fares (santim)', 'Commission (santim)', 'Adjustments (santim)', 'Net Due (santim)', 'Status', 'Paid At'],
      filteredStatements.map((st) => {
        const prof = db.profiles.find((p) => p.id === st.driver_id);
        const drv = db.drivers.find((d) => d.id === st.driver_id);
        return [
          prof?.name || st.driver_id,
          drv?.plate || '',
          st.week_id,
          st.ride_count,
          st.total_fares_santim,
          st.commission_santim,
          st.adjustments_santim,
          st.commission_santim + st.adjustments_santim,
          st.status,
          st.paid_at || '',
        ];
      })
    );
  };

  const handleExportLogsCsv = () => {
    downloadCsv(
      `dilla-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Actor Role', 'Actor ID', 'Action', 'Target', 'Before', 'After'],
      filteredLogs.map((log) => [
        log.created_at,
        log.actor_role,
        log.actor_id,
        log.action,
        log.target,
        JSON.stringify(log.before),
        JSON.stringify(log.after),
      ])
    );
  };

  const handleMarkPaid = async (driverId: string, weekId: string) => {
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await backend.markCommissionPaid({ driver_id: driverId, week_id: weekId });
      setNoticeMsg(`Statement ${weekId} marked PAID.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to mark commission paid.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Weekly Statements &amp; Audit Log
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monday–Sunday ISO weeks in Africa/Addis_Ababa. Every admin action records immutable before/after audit snapshots.
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

      {/* Settlement Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Unpaid Commission Due</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatBirr(summary.unpaidSantim)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Settled Commissions</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatBirr(summary.paidSantim)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Dispute Adjustments</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatBirr(summary.adjustmentsSantim)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Immutable Audit Events</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {db.audit_logs.length}
          </div>
        </div>
      </div>

      {/* Weekly Statements */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Driver Commission Statements (weekly_statements)
          </h2>
          <div className="flex items-center gap-2.5">
            <select
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">All Weeks</option>
              {weekIds.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportStatementsCsv}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5">Driver</th>
                <th className="px-5 py-3.5">Week (Addis Ababa)</th>
                <th className="px-5 py-3.5">Rides / Fares</th>
                <th className="px-5 py-3.5">Commission + Adj</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                    No statements for the selected week.
                  </td>
                </tr>
              ) : (
                filteredStatements.map((st) => {
                  const profile = db.profiles.find((p) => p.id === st.driver_id);
                  const driver = db.drivers.find((d) => d.id === st.driver_id);
                  const netCommission = st.commission_santim + st.adjustments_santim;
                  return (
                    <tr
                      key={`${st.driver_id}_${st.week_id}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {profile?.name || st.driver_id.slice(0, 8)}
                        </div>
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {driver?.plate || st.driver_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono tabular-nums">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{st.week_id}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatAddisTime(st.week_start_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono tabular-nums">
                        <div>{st.ride_count} rides</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatBirr(st.total_fares_santim)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono tabular-nums">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatBirr(netCommission)}
                        </div>
                        {st.adjustments_santim !== 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            Adj: {formatBirr(st.adjustments_santim)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold">
                        <span
                          className={
                            st.status === 'PAID'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {st.status}
                        </span>
                        {st.paid_at && (
                          <div className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatAddisTime(st.paid_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {st.status === 'UNPAID' ? (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(st.driver_id, st.week_id)}
                            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Paid</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Settled</span>
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

      {/* Audit Logs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Admin Audit Log (audit_logs)
          </h2>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search target, action, note"
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">All Actions</option>
              {auditActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportLogsCsv}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No audit log entries match the current filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const expanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="px-5 py-3.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(expanded ? null : log.id)}
                    className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {log.action}
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{log.target}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {formatAddisTime(log.created_at)}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                        <div className="text-slate-500 dark:text-slate-400 mb-1">before</div>
                        <pre className="text-slate-800 dark:text-slate-200">
                          {JSON.stringify(log.before, null, 2)}
                        </pre>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                        <div className="text-slate-500 dark:text-slate-400 mb-1">after</div>
                        <pre className="text-slate-800 dark:text-slate-200">
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
