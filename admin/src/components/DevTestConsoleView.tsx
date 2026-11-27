import React, { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Copy, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { ContractError, type CancelReason } from '../contract/types';
import {
  DILLA_LANDMARKS,
  INITIAL_DEVICE_MATRIX,
  SECTION_13_SCENARIOS,
  type DeviceMatrixEntry,
  type SandboxDatabase,
} from '../data/seedDilla';
import { backend } from '../services/dillaBackend';
import { formatBirr, getDriverStatusLabel } from '../utils/format';

interface DevTestConsoleViewProps {
  db: SandboxDatabase;
}

type TestResultStatus = 'UNTESTED' | 'PASS' | 'FAIL';

export const DevTestConsoleView: React.FC<DevTestConsoleViewProps> = ({ db }) => {
  const [subTab, setSubTab] = useState<'CONSOLE' | 'MATRIX'>('CONSOLE');

  const passengers = db.profiles.filter((p) => p.role === 'PASSENGER');
  const drivers = db.profiles.filter((p) => p.role === 'DRIVER');
  const [selectedPassengerId, setSelectedPassengerId] = useState(
    passengers[1]?.id || passengers[0]?.id || ''
  );
  const [selectedDriverId, setSelectedDriverId] = useState(drivers[1]?.id || drivers[0]?.id || '');

  const [pickupIdx, setPickupIdx] = useState(2);
  const [destIdx, setDestIdx] = useState(4);
  const [estimateResult, setEstimateResult] = useState<ReturnType<typeof backend.devEstimateFare> | null>(
    null
  );
  const [lastEstimateFare, setLastEstimateFare] = useState<number>(0);

  const [locIdx, setLocIdx] = useState(2);
  const [pinInput, setPinInput] = useState('');
  const [cancelReason, setCancelReason] = useState<CancelReason>('PASSENGER_CHANGED_MIND');
  const [consoleLog, setConsoleLog] = useState<string[]>([
    'Dev Test Console ready. All calls execute against the Section 8 contract rules.',
  ]);

  const [phaseFilter, setPhaseFilter] = useState<number | 'ALL'>('ALL');
  const [scenarioResults, setScenarioResults] = useState<Record<string, TestResultStatus>>({});
  const [scenarioNotes, setScenarioNotes] = useState<Record<string, string>>({});
  const [deviceMatrix, setDeviceMatrix] = useState<DeviceMatrixEntry[]>(INITIAL_DEVICE_MATRIX);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const pushLog = (line: string) => {
    setConsoleLog((prev) =>
      [`[${new Date().toLocaleTimeString('en-GB')}] ${line}`, ...prev].slice(0, 25)
    );
  };

  const activePassenger = db.profiles.find((p) => p.id === selectedPassengerId);
  const activeDriverProfile = db.profiles.find((p) => p.id === selectedDriverId);
  const activeDriverRecord = db.drivers.find((d) => d.id === selectedDriverId);

  const passengerActiveRide =
    db.rides.find((r) => r.id === activePassenger?.active_ride_id) || null;
  const driverOffer =
    db.offers.find((o) => o.driver_id === selectedDriverId && o.status === 'OFFERED') || null;
  const driverActiveRide =
    db.rides.find((r) => r.id === activeDriverRecord?.current_ride_id) ||
    (activeDriverRecord?.payment_lock_ride_id
      ? db.rides.find((r) => r.id === activeDriverRecord.payment_lock_ride_id) || null
      : null);

  const activeRidePin = driverActiveRide
    ? db.ride_pins.find((p) => p.ride_id === driverActiveRide.id) || null
    : null;

  const runAction = (label: string, fn: () => unknown) => {
    try {
      const res = fn();
      pushLog(`OK ${label}: ${JSON.stringify(res)}`);
    } catch (err: unknown) {
      if (err instanceof ContractError) {
        pushLog(`ERR ${label}: ${err.error_code} ${JSON.stringify(err.details)}`);
      } else {
        pushLog(`ERR ${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const handleEstimate = () => {
    runAction('estimateFare', () => {
      const res = backend.devEstimateFare(DILLA_LANDMARKS[pickupIdx], DILLA_LANDMARKS[destIdx]);
      setEstimateResult(res);
      setLastEstimateFare(res.fare_santim);
      return res;
    });
  };

  const handleRequestRide = () => {
    const pickupLm = DILLA_LANDMARKS[pickupIdx];
    const destLm = DILLA_LANDMARKS[destIdx];
    runAction('requestRide', () =>
      backend.devRequestRide({
        passenger_id: selectedPassengerId,
        request_id: `dev-req-${Date.now()}`,
        pickup: { lat: pickupLm.lat, lng: pickupLm.lng, address: pickupLm.name },
        destination: { lat: destLm.lat, lng: destLm.lng, address: destLm.name },
        expected_fare_santim: lastEstimateFare || 2000,
      })
    );
  };

  const handleRunAutomatedChecks = async () => {
    const updates: Record<string, TestResultStatus> = {};
    const notes: Record<string, string> = {};

    const expectError = async (fn: () => unknown | Promise<unknown>, expectedCode: string) => {
      try {
        await fn();
        return { ok: false, msg: `Expected ${expectedCode} but succeeded` };
      } catch (err: unknown) {
        if (err instanceof ContractError && err.error_code === expectedCode) {
          return { ok: true, msg: `Verified ${expectedCode}` };
        }
        return {
          ok: false,
          msg: `Expected ${expectedCode}, got ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    };

    try {
      const shortEst = backend.devEstimateFare(
        { lat: 6.4095, lng: 38.3118 },
        { lat: 6.4097, lng: 38.312 }
      );
      const longEst = backend.devEstimateFare(
        { lat: 6.4168, lng: 38.3082 },
        { lat: 6.4046, lng: 38.3149 }
      );
      const t04Ok =
        shortEst.fare_santim === 2000 &&
        longEst.fare_santim % 100 === 0 &&
        longEst.fare_santim > 2000;
      updates.T04 = t04Ok ? 'PASS' : 'FAIL';
      notes.T04 = `Short=${shortEst.fare_santim}s, Long=${longEst.fare_santim}s`;

      const restrictedEst = backend.devEstimateFare(
        { lat: 6.419, lng: 38.306 },
        { lat: 6.4046, lng: 38.3149 }
      );
      const t22Ok =
        restrictedEst.pickup_issue?.code === 'IN_RESTRICTED_ZONE' &&
        restrictedEst.pickup_issue.suggested_meeting_points.length >= 1;
      updates.T22 = t22Ok ? 'PASS' : 'FAIL';
      notes.T22 = `Zone=${restrictedEst.pickup_issue?.zone_name}, Gates=${restrictedEst.pickup_issue?.suggested_meeting_points.length ?? 0}`;

      const roadEst = backend.devEstimateFare(
        { lat: 6.4095, lng: 38.3118 },
        { lat: 6.4072, lng: 38.309 }
      );
      updates.T23 = roadEst.destination_issue?.code === 'ON_BANNED_ROAD' ? 'PASS' : 'FAIL';
      notes.T23 = `Issue=${roadEst.destination_issue?.code || 'none'}`;

      const pendingDriver = backend.getSnapshot().drivers.find((d) => d.approval === 'PENDING');
      if (pendingDriver) {
        const res = await expectError(
          () => backend.devSetDriverReady(pendingDriver.id),
          'DRIVER_NOT_APPROVED'
        );
        updates.T03 = res.ok ? 'PASS' : 'FAIL';
        notes.T03 = res.msg;
      }

      const lockedDriver = backend.getSnapshot().drivers.find((d) => d.payment_lock_ride_id);
      if (lockedDriver) {
        const res = await expectError(
          () => backend.devSetDriverReady(lockedDriver.id),
          'PAYMENT_LOCKED'
        );
        updates.T13 = res.ok ? 'PASS' : 'FAIL';
        notes.T13 = res.msg;
      }

      const pass2 = backend
        .getSnapshot()
        .profiles.find((p) => p.role === 'PASSENGER' && !p.active_ride_id);
      if (pass2) {
        await backend.blockUser({ uid: pass2.id, blocked: true, reason: 'Automated T24 test' });
        const blkCheck = await expectError(
          () =>
            backend.devRequestRide({
              passenger_id: pass2.id,
              request_id: 't24-check',
              pickup: { lat: 6.4095, lng: 38.3118, address: 'Meskel Square' },
              destination: { lat: 6.4126, lng: 38.3176, address: 'Hospital' },
              expected_fare_santim: 3000,
            }),
          'USER_BLOCKED'
        );
        await backend.blockUser({
          uid: pass2.id,
          blocked: false,
          reason: 'Restore after T24 test',
        });
        updates.T24 = blkCheck.ok ? 'PASS' : 'FAIL';
        notes.T24 = blkCheck.msg;
      }

      const confirmGuard = await expectError(
        () =>
          backend.updateFareConfig({
            base_fare_santim: 1500,
            price_per_km_santim: 1500,
            minimum_fare_santim: 2000,
            no_show_wait_seconds: 120,
            commission_percent: 10,
            confirm: false,
          }),
        'CONFIRMATION_REQUIRED'
      );
      const minGuard = await expectError(
        () =>
          backend.updateFareConfig({
            base_fare_santim: 1000,
            price_per_km_santim: 1500,
            minimum_fare_santim: 1000,
            no_show_wait_seconds: 120,
            commission_percent: 10,
            confirm: true,
          }),
        'MINIMUM_FARE_TOO_LOW'
      );
      updates.T05 = confirmGuard.ok && minGuard.ok ? 'PASS' : 'FAIL';
      notes.T05 = `${confirmGuard.msg}; ${minGuard.msg}`;

      const openSos = backend.getSnapshot().sos_alerts.find((s) => s.status !== 'RESOLVED');
      if (openSos) {
        const noteCheck = await expectError(
          () => backend.resolveSos({ sos_id: openSos.id, outcome: 'SAFE', admin_note: '   ' }),
          'NOTE_REQUIRED'
        );
        updates.T35 = noteCheck.ok ? 'PASS' : 'FAIL';
        notes.T35 = noteCheck.msg;
      }

      const stalled = backend.getSnapshot().rides.find((r) => r.stalled);
      if (stalled) {
        const noteCheck = await expectError(
          () => backend.closeStalledRide({ ride_id: stalled.id, note: '' }),
          'NOTE_REQUIRED'
        );
        updates.T26 = noteCheck.ok ? 'PASS' : 'FAIL';
        notes.T26 = noteCheck.msg;
      }

      setScenarioResults((prev) => ({ ...prev, ...updates }));
      setScenarioNotes((prev) => ({ ...prev, ...notes }));
      pushLog(
        `Automated contract checks completed: ${Object.keys(updates).length} scenarios verified.`
      );
    } catch (err: unknown) {
      pushLog(`Automated suite error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filteredScenarios = useMemo(() => {
    return SECTION_13_SCENARIOS.filter((s) => phaseFilter === 'ALL' || s.phase === phaseFilter);
  }, [phaseFilter]);

  const generateReport = async () => {
    const passCount = SECTION_13_SCENARIOS.filter((s) => scenarioResults[s.id] === 'PASS').length;
    const failCount = SECTION_13_SCENARIOS.filter((s) => scenarioResults[s.id] === 'FAIL').length;
    const lines: string[] = [
      `# Dilla Ride Integration & Device Test Report`,
      `Generated: ${new Date().toISOString()}`,
      `Summary: ${passCount} PASS · ${failCount} FAIL · ${SECTION_13_SCENARIOS.length - passCount - failCount} UNTESTED`,
      ``,
      `## Section 13 Scenarios`,
      `| ID | Phase | Status | Scenario | Notes |`,
      `| --- | --- | --- | --- | --- |`,
      ...SECTION_13_SCENARIOS.map(
        (s) =>
          `| ${s.id} | P${s.phase} | ${scenarioResults[s.id] || 'UNTESTED'} | ${s.scenario} | ${scenarioNotes[s.id] || ''} |`
      ),
      ``,
      `## Android Device Matrix`,
      `| Model | OS | Owner | Bg Location | Battery Bypass | Silent Alarm | Full-Screen Offer |`,
      `| --- | --- | --- | --- | --- | --- | --- |`,
      ...deviceMatrix.map(
        (d) =>
          `| ${d.model} | ${d.androidVersion} | ${d.owner} | ${d.backgroundLocation} | ${d.batterySaverBypass} | ${d.silentModeAlarm} | ${d.fullScreenOfferAlert} |`
      ),
    ];
    const md = lines.join('\n');
    setReportMarkdown(md);
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(md);
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 2500);
      } catch {
        // clipboard may be blocked in sandboxed iframe; modal below still shows it
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dev Console (/dev) &amp; Section 13 Test Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulate passenger/driver contract calls, presence drops, SOS triggers, and track T01–T40 verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('CONSOLE')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'CONSOLE'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Flow Simulator
            </button>
            <button
              type="button"
              onClick={() => setSubTab('MATRIX')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                subTab === 'MATRIX'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              T01–T40 &amp; Devices
            </button>
          </div>
          <button
            type="button"
            onClick={() => backend.resetSandbox()}
            className="px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Seed Data</span>
          </button>
        </div>
      </div>

      {subTab === 'CONSOLE' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passenger Simulator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Act as Passenger
                </h2>
                <select
                  value={selectedPassengerId}
                  onChange={(e) => setSelectedPassengerId(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {passengers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Pickup Landmark
                  </label>
                  <select
                    value={pickupIdx}
                    onChange={(e) => setPickupIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {DILLA_LANDMARKS.map((lm, i) => (
                      <option key={lm.name} value={i}>
                        {lm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Destination Landmark
                  </label>
                  <select
                    value={destIdx}
                    onChange={(e) => setDestIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {DILLA_LANDMARKS.map((lm, i) => (
                      <option key={lm.name} value={i}>
                        {lm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleEstimate}
                  className="px-3.5 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  1. estimateFare
                </button>
                <button
                  type="button"
                  onClick={handleRequestRide}
                  className="px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg whitespace-nowrap"
                >
                  2. requestRide ({formatBirr(lastEstimateFare || 2000)})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction('passengerTriggerSos', () =>
                      backend.devTriggerSos(
                        selectedPassengerId,
                        passengerActiveRide?.id || null,
                        DILLA_LANDMARKS[pickupIdx]
                      )
                    )
                  }
                  className="px-3.5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Trigger SOS</span>
                </button>
              </div>

              {estimateResult && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono space-y-1">
                  <div>
                    Quoted: {formatBirr(estimateResult.fare_santim)} ({estimateResult.distance_meters}m, v
                    {estimateResult.fare_config_version})
                  </div>
                  {estimateResult.pickup_issue && (
                    <div className="text-amber-600 dark:text-amber-400">
                      Pickup issue: {estimateResult.pickup_issue.code} ({estimateResult.pickup_issue.zone_name})
                    </div>
                  )}
                  {estimateResult.destination_issue && (
                    <div className="text-amber-600 dark:text-amber-400">
                      Destination issue: {estimateResult.destination_issue.code} (
                      {estimateResult.destination_issue.zone_name})
                    </div>
                  )}
                </div>
              )}

              {passengerActiveRide && (
                <div className="p-3.5 border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg text-sm space-y-2.5">
                  <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Active Ride: {passengerActiveRide.status} ({passengerActiveRide.id.slice(0, 8)})
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value as CancelReason)}
                      className="px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                    >
                      <option value="PASSENGER_CHANGED_MIND">PASSENGER_CHANGED_MIND</option>
                      <option value="SAFETY">SAFETY</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        runAction('passengerCancelRide', () =>
                          backend.devCancelRide(
                            selectedPassengerId,
                            'PASSENGER',
                            passengerActiveRide.id,
                            cancelReason
                          )
                        )
                      }
                      className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded hover:bg-white"
                    >
                      Cancel Ride
                    </button>
                    {passengerActiveRide.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction('finishRideAsPassenger', () =>
                            backend.devCompleteRide(selectedPassengerId, 'PASSENGER', passengerActiveRide.id)
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded"
                      >
                        finishRideAsPassenger (T17)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Simulator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Act as Driver
                </h2>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {drivers.map((p) => {
                    const rec = db.drivers.find((d) => d.id === p.id);
                    const chip = rec ? getDriverStatusLabel(rec) : 'Offline';
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({chip} · {rec?.approval})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => runAction('setReady', () => backend.devSetDriverReady(selectedDriverId))}
                  className="px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg whitespace-nowrap"
                >
                  setReady
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction('togglePresence', () =>
                      backend.devToggleDriverPresence(
                        selectedDriverId,
                        !(activeDriverRecord?.connected ?? false)
                      )
                    )
                  }
                  className="px-3.5 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {activeDriverRecord?.connected ? 'Drop Connection (Offline)' : 'Reconnect Presence'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction('driverTriggerSos', () =>
                      backend.devTriggerSos(
                        selectedDriverId,
                        driverActiveRide?.id || null,
                        DILLA_LANDMARKS[locIdx]
                      )
                    )
                  }
                  className="px-3.5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg whitespace-nowrap"
                >
                  Driver SOS (T33)
                </button>
              </div>

              <div className="flex items-center gap-2.5 text-sm">
                <select
                  value={locIdx}
                  onChange={(e) => setLocIdx(Number(e.target.value))}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {DILLA_LANDMARKS.map((lm, i) => (
                    <option key={lm.name} value={i}>
                      {lm.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    runAction('setDriverLocation', () =>
                      backend.devSetDriverLocation(selectedDriverId, DILLA_LANDMARKS[locIdx])
                    )
                  }
                  className="px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Update GPS
                </button>
              </div>

              {driverOffer && (
                <div className="p-3.5 border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    Incoming Offer: ride {driverOffer.ride_id.slice(0, 8)} (
                    {driverOffer.distance_to_pickup_meters}m)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      runAction('acceptOffer', () =>
                        backend.devAcceptOffer(selectedDriverId, driverOffer.ride_id)
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded"
                  >
                    Accept Offer
                  </button>
                </div>
              )}

              {driverActiveRide && (
                <div className="p-3.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm space-y-2.5">
                  <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Driver Ride: {driverActiveRide.status} · {formatBirr(driverActiveRide.fare_santim)}
                    {activeRidePin
                      ? ` · PIN=${activeRidePin.pin} (fails ${activeRidePin.failed_attempts})`
                      : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {driverActiveRide.status === 'DRIVER_ACCEPTED' && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction('markArrived', () =>
                            backend.devMarkArrived(selectedDriverId, driverActiveRide.id)
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded"
                      >
                        markArrived
                      </button>
                    )}
                    {driverActiveRide.status === 'ARRIVED_AT_PICKUP' && (
                      <>
                        <input
                          type="text"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          placeholder="4-digit PIN"
                          className="w-32 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            runAction('startRide', () =>
                              backend.devStartRide(selectedDriverId, driverActiveRide.id, pinInput)
                            )
                          }
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded"
                        >
                          startRide
                        </button>
                      </>
                    )}
                    {driverActiveRide.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction('endRide', () =>
                            backend.devCompleteRide(selectedDriverId, 'DRIVER', driverActiveRide.id)
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded"
                      >
                        endRide
                      </button>
                    )}
                    {activeDriverRecord?.payment_lock_ride_id && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction('confirmCashReceived', () =>
                            backend.devConfirmCashReceived(
                              selectedDriverId,
                              activeDriverRecord.payment_lock_ride_id!
                            )
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded"
                      >
                        confirmCashReceived
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeDriverProfile?.active_sos_id && (
                <button
                  type="button"
                  onClick={() =>
                    runAction('markSosSafe', () =>
                      backend.devMarkSosSafe(activeDriverProfile.active_sos_id!)
                    )
                  }
                  className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg"
                >
                  User Tap &quot;I am safe&quot; on Active SOS
                </button>
              )}
            </div>
          </div>

          {/* Live Execution Log & Document Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-950 text-slate-100 border border-slate-800 rounded-xl p-5 space-y-2.5">
              <div className="text-sm font-semibold text-slate-300">Console Output</div>
              <div className="h-64 overflow-y-auto font-mono text-xs space-y-1.5">
                {consoleLog.map((line, i) => (
                  <div
                    key={i}
                    className={line.includes('ERR ') ? 'text-red-400' : 'text-emerald-300'}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live State Inspector (rides · offers · payments · sos_alerts)
              </div>
              <pre className="h-64 overflow-auto p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300">
                {JSON.stringify(
                  {
                    latest_ride: db.rides[0] || null,
                    latest_offer: db.offers[0] || null,
                    latest_payment: db.payments[0] || null,
                    open_sos: db.sos_alerts.filter((s) => s.status !== 'RESOLVED'),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['ALL', 1, 2, 3, 4, 5] as const).map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setPhaseFilter(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                    phaseFilter === p
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p === 'ALL' ? 'All Phases' : `Phase ${p}`}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRunAutomatedChecks}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                <span>Run Automated Contract Checks</span>
              </button>
              <button
                type="button"
                onClick={generateReport}
                className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedReport ? (
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedReport ? 'Copied Report' : 'Export Markdown Report'}</span>
              </button>
            </div>
          </div>

          {reportMarkdown && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Generated Markdown Test Report</span>
                <button
                  type="button"
                  onClick={() => setReportMarkdown(null)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
              <textarea
                readOnly
                value={reportMarkdown}
                rows={8}
                className="w-full p-3.5 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              />
            </div>
          )}

          {/* Section 13 Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Scenario</th>
                  <th className="px-5 py-3.5">Expected Result</th>
                  <th className="px-5 py-3.5">Owner</th>
                  <th className="px-5 py-3.5">Status &amp; Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredScenarios.map((sc) => {
                  const status = scenarioResults[sc.id] || 'UNTESTED';
                  return (
                    <tr key={sc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold whitespace-nowrap">
                        {sc.id} (P{sc.phase})
                      </td>
                      <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100">{sc.scenario}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{sc.expected}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {sc.owner}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={status}
                            onChange={(e) =>
                              setScenarioResults((prev) => ({
                                ...prev,
                                [sc.id]: e.target.value as TestResultStatus,
                              }))
                            }
                            className={`px-2.5 py-1 text-xs font-mono border rounded ${
                              status === 'PASS'
                                ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : status === 'FAIL'
                                  ? 'text-red-700 border-red-300 bg-red-50 dark:bg-red-950/40 dark:text-red-300'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'
                            }`}
                          >
                            <option value="UNTESTED">UNTESTED</option>
                            <option value="PASS">PASS</option>
                            <option value="FAIL">FAIL</option>
                          </select>
                          <input
                            type="text"
                            value={scenarioNotes[sc.id] || ''}
                            onChange={(e) =>
                              setScenarioNotes((prev) => ({ ...prev, [sc.id]: e.target.value }))
                            }
                            placeholder="Test note"
                            className="w-44 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Physical Android Device Test Matrix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Android Field Device Test Matrix (Dilla Budget Phones)
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Log physical hardware checks</span>
              </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3.5">Device Model</th>
                  <th className="px-5 py-3.5">Owner</th>
                  <th className="px-5 py-3.5">Background GPS</th>
                  <th className="px-5 py-3.5">Battery Saver Bypass</th>
                  <th className="px-5 py-3.5">Silent Mode Alarm</th>
                  <th className="px-5 py-3.5">Full-Screen Offer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {deviceMatrix.map((dev, idx) => (
                  <tr key={dev.model}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{dev.model}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{dev.androidVersion}</div>
                    </td>
                    <td className="px-5 py-4">{dev.owner}</td>
                    {(
                      [
                        'backgroundLocation',
                        'batterySaverBypass',
                        'silentModeAlarm',
                        'fullScreenOfferAlert',
                      ] as const
                    ).map((field) => (
                      <td key={field} className="px-5 py-4">
                        <select
                          value={dev[field]}
                          onChange={(e) => {
                            const val = e.target.value as TestResultStatus;
                            setDeviceMatrix((prev) =>
                              prev.map((d, i) => (i === idx ? { ...d, [field]: val } : d))
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded"
                        >
                          <option value="UNTESTED">UNTESTED</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
