import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sun,
  Terminal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DevTestConsoleView } from './components/DevTestConsoleView';
import { DriversView } from './components/DriversView';
import { FaresZonesView } from './components/FaresZonesView';
import { OverviewView } from './components/OverviewView';
import { RidesPaymentsView } from './components/RidesPaymentsView';
import { SosBoardView } from './components/SosBoardView';
import { StatementsAuditView } from './components/StatementsAuditView';
import { backend, isSupabaseConfigured, type BackendMode } from './services/dillaBackend';

type NavTab = 'overview' | 'sos' | 'drivers' | 'rides' | 'fares' | 'statements' | 'dev';

const DEV_CONSOLE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_CONSOLE === 'true';

function getInitialTab(): NavTab {
  if (
    DEV_CONSOLE_ENABLED &&
    (window.location.pathname.endsWith('/dev') || window.location.hash === '#/dev')
  ) {
    return 'dev';
  }
  return 'overview';
}

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Operations Overview',
  sos: '24/7 Emergency SOS Board',
  drivers: 'Drivers & Approvals',
  rides: 'Rides & Payment Disputes',
  fares: 'Fares, Settings & Zones',
  statements: 'Weekly Statements & Audit',
  dev: 'Dev Console & Test Matrix',
};

function formatAddisClock(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

export function App() {
  const [db, setDb] = useState(() => backend.getSnapshot());
  const [mode, setMode] = useState<BackendMode>(() => backend.getMode());
  const [sbStatus, setSbStatus] = useState(() => backend.getSupabaseStatus());
  const [activeTab, setActiveTab] = useState<NavTab>(getInitialTab);
  const [inspectRideId, setInspectRideId] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [alarmMuted, setAlarmMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nowClock, setNowClock] = useState(() => formatAddisClock(new Date()));

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unsub = backend.subscribe(() => {
      setDb(backend.getSnapshot());
      setMode(backend.getMode());
      setSbStatus(backend.getSupabaseStatus());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowClock(formatAddisClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (mode !== 'supabase') return;
    let cancelled = false;
    setSyncing(true);
    setSyncError(null);
    backend
      .syncFromSupabase()
      .catch((err: unknown) => {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : 'Supabase sync failed');
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    const unsubRt = backend.subscribeSupabaseRealtime();
    return () => {
      cancelled = true;
      unsubRt();
    };
  }, [mode]);

  const openSosAlerts = db.sos_alerts.filter((s) => s.status === 'OPEN');
  const openDisputesCount = db.disputes.filter((d) => d.status === 'OPEN').length;
  const pendingDriversCount = db.drivers.filter((d) => d.approval === 'PENDING').length;

  const unlockAudio = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      setAudioUnlocked(true);
    } catch {
      // ignore audio errors
    }
  };

  useEffect(() => {
    if (openSosAlerts.length === 0 || alarmMuted) return;

    const playPulse = () => {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.setValueAtTime(980, now + 0.18);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } catch {
        // ignore audio errors
      }
    };

    const interval = setInterval(playPulse, 2600);
    return () => clearInterval(interval);
  }, [openSosAlerts.length, alarmMuted, audioUnlocked]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      await backend.signInSupabaseAdmin(authEmail, authPassword);
      setShowAuthModal(false);
      setAuthPassword('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    urgent?: boolean;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'sos',
      label: '24/7 SOS Board',
      icon: ShieldAlert,
      badge: openSosAlerts.length,
      urgent: openSosAlerts.length > 0,
    },
    { id: 'drivers', label: 'Drivers', icon: Bike, badge: pendingDriversCount },
    { id: 'rides', label: 'Rides & Disputes', icon: Receipt, badge: openDisputesCount },
    { id: 'fares', label: 'Fares & Zones', icon: MapPin },
    { id: 'statements', label: 'Statements & Audit', icon: FileText },
  ];

  if (DEV_CONSOLE_ENABLED) {
    navItems.push({ id: 'dev', label: 'Dev Test Console', icon: Terminal });
  }

  const navigateTo = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dilla Ride Admin
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            Contract v2.0 · Dilla, ET
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`w-full px-3.5 py-2.5 text-sm font-medium rounded-lg flex items-center justify-between gap-2.5 transition-colors ${
                active
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : item.urgent
                    ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-3 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 text-xs font-mono tabular-nums rounded ${
                    item.urgent
                      ? 'bg-red-600 text-white'
                      : active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Backend Source</span>
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => backend.setMode('sandbox')}
              className={`flex-1 py-1.5 text-xs font-mono rounded-md transition-colors ${
                mode === 'sandbox'
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              Sandbox
            </button>
            <button
              type="button"
              disabled={!isSupabaseConfigured}
              onClick={() => backend.setMode('supabase')}
              title={
                isSupabaseConfigured
                  ? `Connected to ${sbStatus.projectHost}`
                  : 'Set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to enable'
              }
              className={`flex-1 py-1.5 text-xs font-mono rounded-md transition-colors ${
                mode === 'supabase'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-45'
              }`}
            >
              Supabase
            </button>
          </div>

          {isSupabaseConfigured && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {sbStatus.projectHost}
              </div>
              {sbStatus.sessionEmail ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                    {sbStatus.sessionEmail}
                  </span>
                  <button
                    type="button"
                    onClick={() => backend.signOutSupabaseAdmin()}
                    title="Sign out"
                    className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setShowAuthModal(true);
                  }}
                  className="w-full py-1.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Admin Sign In</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">Natnael T. (ADMIN)</span>
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle theme"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      onClick={unlockAudio}
      className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Persistent SOS Alarm Banner whenever any alert is OPEN */}
        {openSosAlerts.length > 0 && (
          <div className="bg-red-600 text-white px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>
                ACTIVE EMERGENCY SOS ({openSosAlerts.length} unacknowledged) —{' '}
                {openSosAlerts[0].ride_snapshot?.passenger_name ||
                  openSosAlerts[0].ride_snapshot?.driver_name ||
                  openSosAlerts[0].raised_by}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  setAlarmMuted((m) => !m);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-red-700 hover:bg-red-800 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {alarmMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{alarmMuted ? 'Unmute Siren' : 'Mute Siren'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sos')}
                className="px-4 py-1.5 text-xs font-semibold bg-white text-red-700 hover:bg-red-50 rounded-md whitespace-nowrap"
              >
                Open SOS Board
              </button>
            </div>
          </div>
        )}

        {/* Top Utility Header */}
        <header className="h-14 px-6 lg:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="hidden sm:inline">Dilla Ride Operations</span>
            <span className="hidden sm:inline mx-1 text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold truncate">
              {TAB_TITLES[activeTab]}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {syncError && <span className="text-red-600 font-mono">{syncError}</span>}
            {mode === 'supabase' && (
              <button
                type="button"
                onClick={() => {
                  setSyncing(true);
                  backend.syncFromSupabase().finally(() => setSyncing(false));
                }}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            )}
            <span className="hidden sm:inline font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Addis {nowClock}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {mode === 'supabase' ? 'Live Supabase' : 'Contract Sandbox'}
            </span>
          </div>
        </header>

        {/* Supabase Diagnostics Strip when Live Supabase mode is active */}
        {mode === 'supabase' && (
          <div
            className={`px-6 lg:px-8 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
              sbStatus.missingTables.length > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {sbStatus.missingTables.length > 0 ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">
                {sbStatus.missingTables.length > 0
                  ? `Connected to ${sbStatus.projectHost} (${sbStatus.syncedTables.length}/13 tables synced; awaiting schema migration or RLS for: ${sbStatus.missingTables.slice(0, 4).join(', ')}${sbStatus.missingTables.length > 4 ? ` +${sbStatus.missingTables.length - 4} more` : ''})`
                  : `Connected to ${sbStatus.projectHost} — all ${sbStatus.syncedTables.length} Contract v2.0 tables synced.`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!sbStatus.sessionEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setShowAuthModal(true);
                  }}
                  className="px-2.5 py-1 font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 whitespace-nowrap"
                >
                  Admin Sign In
                </button>
              )}
              <button
                type="button"
                onClick={() => backend.setMode('sandbox')}
                className="px-2.5 py-1 font-medium bg-slate-900 text-white dark:bg-blue-600 rounded hover:opacity-90 whitespace-nowrap"
              >
                Use Contract Sandbox
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-6 lg:px-8 py-7 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              db={db}
              onNavigate={(t) => setActiveTab(t as NavTab)}
              onInspectRide={(rideId) => {
                setInspectRideId(rideId);
                setActiveTab('rides');
              }}
            />
          )}
          {activeTab === 'sos' && (
            <SosBoardView
              db={db}
              alarmMuted={alarmMuted}
              onToggleMute={() => setAlarmMuted((m) => !m)}
            />
          )}
          {activeTab === 'drivers' && <DriversView db={db} />}
          {activeTab === 'rides' && (
            <RidesPaymentsView
              db={db}
              initialSearch={inspectRideId}
              onConsumeInitialSearch={() => setInspectRideId(undefined)}
            />
          )}
          {activeTab === 'fares' && <FaresZonesView db={db} />}
          {activeTab === 'statements' && <StatementsAuditView db={db} />}
          {activeTab === 'dev' && DEV_CONSOLE_ENABLED && <DevTestConsoleView db={db} />}
        </main>
      </div>

      {/* Supabase Admin Sign-In Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleSignIn}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Supabase Admin Sign In
                </h2>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {sbStatus.projectHost}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                aria-label="Close modal"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                {authError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@dillaride.et"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authBusy}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50"
              >
                {authBusy ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
