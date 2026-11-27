import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Phone, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import type { SosAlert, SosOutcome } from '../contract/types';
import type { SandboxDatabase } from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import { formatAddisTime, formatElapsedSince } from '../utils/format';
import { DillaMapCanvas } from './DillaMapCanvas';

interface SosBoardViewProps {
  db: SandboxDatabase;
  alarmMuted: boolean;
  onToggleMute: () => void;
}

export const SosBoardView: React.FC<SosBoardViewProps> = ({ db, alarmMuted, onToggleMute }) => {
  const [filter, setFilter] = useState<'ACTIVE' | 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ACTIVE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [outcome, setOutcome] = useState<SosOutcome>('SAFE');
  const [adminNote, setAdminNote] = useState('');
  const [opsInput, setOpsInput] = useState(db.settings.ops_phone_numbers.join(', '));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setOpsInput(db.settings.ops_phone_numbers.join(', '));
  }, [db.settings.ops_phone_numbers]);

  const filteredAlerts = useMemo(() => {
    return db.sos_alerts.filter((a) => {
      if (filter === 'ACTIVE') return a.status !== 'RESOLVED';
      if (filter === 'ALL') return true;
      return a.status === filter;
    });
  }, [db.sos_alerts, filter]);

  const selectedAlert: SosAlert | null = useMemo(() => {
    if (selectedId) {
      const found = db.sos_alerts.find((a) => a.id === selectedId);
      if (found) return found;
    }
    return filteredAlerts[0] || db.sos_alerts[0] || null;
  }, [db.sos_alerts, filteredAlerts, selectedId]);

  const selectedTrack = useMemo(() => {
    if (!selectedAlert) return [];
    return db.sos_track.filter((t) => t.sos_id === selectedAlert.id);
  }, [db.sos_track, selectedAlert]);

  const openCount = db.sos_alerts.filter((s) => s.status === 'OPEN').length;

  const handleAcknowledge = async (sosId: string) => {
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await backend.acknowledgeSos({ sos_id: sosId });
      setNoticeMsg('Alert acknowledged. Escalation stopped; call both parties before resolving.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Acknowledge failed.');
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      await backend.resolveSos({
        sos_id: selectedAlert.id,
        outcome,
        admin_note: adminNote,
      });
      setAdminNote('');
      setNoticeMsg('SOS alert resolved and recorded in audit_logs.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Resolve failed.');
    }
  };

  const handleSaveOpsPhones = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoticeMsg(null);
    const list = opsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await backend.updateSettings({ ops_phone_numbers: list });
      setNoticeMsg('Shift operations phone numbers updated.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update ops phones.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            24/7 Emergency SOS Board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Active alerts sound a repeating alarm until acknowledged. All times in Africa/Addis_Ababa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-2 whitespace-nowrap ${
              alarmMuted
                ? 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
                : openCount > 0
                  ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900'
            }`}
          >
            {alarmMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{alarmMuted ? 'Alarm Muted' : 'Alarm Active'}</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['ACTIVE', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Alert Queue + Shift Ops Phone Numbers */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                SOS Queue
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {filteredAlerts.length} alerts
              </span>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="p-10 text-center space-y-2.5">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  No alerts in this view
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Use the /dev Test Console to simulate an SOS trigger (T32/T33).
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAlerts.map((alert) => {
                  const active = selectedAlert?.id === alert.id;
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => setSelectedId(alert.id)}
                      className={`w-full px-5 py-4 text-left transition-colors ${
                        active
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-1.5 ${
                            alert.status === 'OPEN'
                              ? 'text-red-600 dark:text-red-400'
                              : alert.status === 'ACKNOWLEDGED'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>{alert.status}</span>
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatElapsedSince(alert.created_at, nowMs)}
                        </span>
                      </div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1.5">
                        {alert.ride_snapshot?.passenger_name || alert.ride_snapshot?.driver_name || 'Unknown Caller'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {alert.raised_by} · {alert.trigger}
                        {alert.user_marked_safe_at ? ' · Marked safe' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shift Operations Phones */}
          <form
            onSubmit={handleSaveOpsPhones}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5"
          >
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Operations Shift Phones
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Primary SMS recipient first; backup escalation every{' '}
                <span className="font-mono tabular-nums">{db.settings.sos_escalation_seconds}s</span>.
              </p>
            </div>
            <input
              type="text"
              value={opsInput}
              onChange={(e) => setOpsInput(e.target.value)}
              placeholder="+251911000001, +251911000002"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Update Shift Phones
            </button>
          </form>
        </div>

        {/* Right: Selected Alert Detail */}
        <div className="lg:col-span-8">
          {!selectedAlert ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-sm text-slate-500">
              Select an alert from the SOS queue to inspect location trail and contact details.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={`font-semibold ${
                        selectedAlert.status === 'OPEN'
                          ? 'text-red-600 dark:text-red-400'
                          : selectedAlert.status === 'ACKNOWLEDGED'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {selectedAlert.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Raised by {selectedAlert.raised_by}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{selectedAlert.trigger}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                    {selectedAlert.ride_snapshot?.pickup_address
                      ? `${selectedAlert.ride_snapshot.pickup_address} -> ${selectedAlert.ride_snapshot.destination_address}`
                      : 'Standalone Driver SOS (No Active Ride)'}
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1.5">
                    Created: {formatAddisTime(selectedAlert.created_at)} · Elapsed: {formatElapsedSince(selectedAlert.created_at, nowMs)}
                  </div>
                </div>

                {selectedAlert.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Acknowledge Alert
                  </button>
                )}
              </div>

              {selectedAlert.user_marked_safe_at && (
                <div className="px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    User tapped &quot;I am safe&quot; at {formatAddisTime(selectedAlert.user_marked_safe_at)}. Operator must still call and resolve manually.
                  </span>
                </div>
              )}

              {/* Map with trail */}
              <DillaMapCanvas
                zones={db.restricted_zones}
                meetingPoints={db.meeting_points}
                sosAlert={selectedAlert}
                sosTrack={selectedTrack}
                heightClass="h-80"
              />

              {/* Ride Snapshot & Tap-to-Call Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2.5">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Ride &amp; People Contacts
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedAlert.ride_snapshot?.passenger_phone && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          Passenger: {selectedAlert.ride_snapshot.passenger_name}
                        </span>
                        <a
                          href={`tel:${selectedAlert.ride_snapshot.passenger_phone}`}
                          className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{selectedAlert.ride_snapshot.passenger_phone}</span>
                        </a>
                      </div>
                    )}
                    {selectedAlert.ride_snapshot?.driver_phone && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          Driver: {selectedAlert.ride_snapshot.driver_name}
                        </span>
                        <a
                          href={`tel:${selectedAlert.ride_snapshot.driver_phone}`}
                          className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{selectedAlert.ride_snapshot.driver_phone}</span>
                        </a>
                      </div>
                    )}
                    {selectedAlert.ride_snapshot?.plate && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono pt-1">
                        Bike: {selectedAlert.ride_snapshot.plate} · {selectedAlert.ride_snapshot.color}{' '}
                        {selectedAlert.ride_snapshot.model}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2.5">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Dilla Emergency Numbers (Tap to Call)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    {Object.entries(db.settings.emergency_numbers).map(([label, num]) => (
                      <a
                        key={label}
                        href={`tel:${num}`}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <span className="capitalize text-slate-700 dark:text-slate-300 text-xs">
                          {label.replace('_', ' ')}
                        </span>
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {num}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resolve Form */}
              {selectedAlert.status !== 'RESOLVED' ? (
                <form
                  onSubmit={handleResolve}
                  className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3.5"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Resolve SOS Alert (Requires Operator Note)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as SosOutcome)}
                      className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    >
                      <option value="SAFE">SAFE</option>
                      <option value="POLICE_CONTACTED">POLICE_CONTACTED</option>
                      <option value="AMBULANCE_CONTACTED">AMBULANCE_CONTACTED</option>
                      <option value="FALSE_ALARM">FALSE_ALARM</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                    <input
                      type="text"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Required operator note (who you spoke with & action taken)"
                      className="sm:col-span-2 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Resolve SOS Alert
                    </button>
                  </div>
                </form>
              ) : (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                  <div>
                    Outcome: <span className="font-mono font-semibold">{selectedAlert.outcome}</span> · Resolved at{' '}
                    <span className="font-mono tabular-nums">{formatAddisTime(selectedAlert.resolved_at)}</span>
                  </div>
                  <div>Operator Note: {selectedAlert.admin_note}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
