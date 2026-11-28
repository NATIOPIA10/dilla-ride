import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ContractError,
  type CancelReason,
  type DisputeOutcome,
  type DriverApproval,
  type LatLng,
  type Settings,
  type SosOutcome,
  type ZoneType,
} from '../contract/types';
import { createSeedDatabase, type SandboxDatabase } from '../data/seedDilla';
import { getAddisIsoWeekId, haversineMeters, isValidE164 } from '../utils/format';

export type BackendMode = 'sandbox' | 'supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export interface SupabaseStatus {
  configured: boolean;
  projectHost: string;
  sessionEmail: string | null;
  sessionRole: string | null;
  lastSyncedAt: string | null;
  syncedTables: string[];
  missingTables: string[];
  authError: string | null;
}

function getProjectHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

let supabaseClient: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function pointInPolygon(pt: LatLng, poly: LatLng[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lat;
    const yi = poly[i].lng;
    const xj = poly[j].lat;
    const yj = poly[j].lng;
    const intersect =
      yi > pt.lng !== yj > pt.lng && pt.lat < ((xj - xi) * (pt.lng - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b.lat - a.lat;
  const dy = b.lng - a.lng;
  if (dx === 0 && dy === 0) return haversineMeters(p, a);
  const t = Math.max(0, Math.min(1, ((p.lat - a.lat) * dx + (p.lng - a.lng) * dy) / (dx * dx + dy * dy)));
  return haversineMeters(p, { lat: a.lat + t * dx, lng: a.lng + t * dy });
}

class DillaBackendService {
  private db: SandboxDatabase = createSeedDatabase();
  private listeners = new Set<() => void>();
  private mode: BackendMode = 'sandbox';
  private adminId = '11111111-1111-4111-8111-111111111101';
  private supabaseStatus: SupabaseStatus = {
    configured: isSupabaseConfigured,
    projectHost: getProjectHost(SUPABASE_URL),
    sessionEmail: null,
    sessionRole: null,
    lastSyncedAt: null,
    syncedTables: [],
    missingTables: [],
    authError: null,
  };

  constructor() {
    if (supabaseClient) {
      this.refreshSupabaseSession().catch(() => {});
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null;
        this.supabaseStatus = {
          ...this.supabaseStatus,
          sessionEmail: user?.email ?? user?.phone ?? null,
          sessionRole:
            (user?.app_metadata?.role as string | undefined) ||
            (user?.user_metadata?.role as string | undefined) ||
            (user ? 'AUTHENTICATED' : null),
          authError: null,
        };
        if (user?.id) {
          this.adminId = user.id;
        }
        this.emit();
      });
    }
  }

  getMode(): BackendMode {
    return this.mode;
  }

  getSupabaseStatus(): SupabaseStatus {
    return this.supabaseStatus;
  }

  setMode(next: BackendMode): void {
    if (next === 'supabase' && !supabaseClient) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.');
    }
    this.mode = next;
    this.emit();
  }

  getSnapshot(): SandboxDatabase {
    return this.db;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  resetSandbox(): void {
    this.db = createSeedDatabase();
    this.emit();
  }

  private emit(): void {
    // Clone top-level reference so React hooks detect updates cleanly
    this.db = { ...this.db };
    for (const fn of this.listeners) fn();
  }

  private logAudit(
    action: string,
    target: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ): void {
    this.db.audit_logs = [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actor_id: this.adminId,
        actor_role: 'ADMIN',
        action,
        target,
        before,
        after,
        created_at: new Date().toISOString(),
      },
      ...this.db.audit_logs,
    ];
  }

  async refreshSupabaseSession(): Promise<void> {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      this.supabaseStatus = { ...this.supabaseStatus, authError: error.message };
      this.emit();
      return;
    }
    const user = data.session?.user ?? null;
    this.supabaseStatus = {
      ...this.supabaseStatus,
      sessionEmail: user?.email ?? user?.phone ?? null,
      sessionRole:
        (user?.app_metadata?.role as string | undefined) ||
        (user?.user_metadata?.role as string | undefined) ||
        (user ? 'AUTHENTICATED' : null),
      authError: null,
    };
    if (user?.id) {
      this.adminId = user.id;
    }
    this.emit();
  }

  async signInSupabaseAdmin(email: string, password: string): Promise<void> {
    if (!supabaseClient) {
      throw new Error('Supabase client is not configured.');
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      this.supabaseStatus = { ...this.supabaseStatus, authError: error.message };
      this.emit();
      throw new Error(error.message);
    }
    const user = data.user;
    this.supabaseStatus = {
      ...this.supabaseStatus,
      sessionEmail: user?.email ?? null,
      sessionRole:
        (user?.app_metadata?.role as string | undefined) ||
        (user?.user_metadata?.role as string | undefined) ||
        'AUTHENTICATED',
      authError: null,
    };
    if (user?.id) {
      this.adminId = user.id;
    }
    this.emit();
    if (this.mode === 'supabase') {
      await this.syncFromSupabase();
    }
  }

  async signOutSupabaseAdmin(): Promise<void> {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    this.supabaseStatus = {
      ...this.supabaseStatus,
      sessionEmail: null,
      sessionRole: null,
      authError: null,
    };
    this.emit();
  }

  // Live Supabase synchronization with resilient table-by-table diagnostics
  async syncFromSupabase(): Promise<void> {
    if (!supabaseClient) return;
    await this.refreshSupabaseSession();

    const syncedTables: string[] = [];
    const missingTables: string[] = [];

    const checkRes = (name: string, error: { code?: string; message?: string } | null) => {
      if (!error) {
        syncedTables.push(name);
        return true;
      }
      if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        missingTables.push(name);
      } else {
        missingTables.push(`${name} (${error.code || 'RLS'})`);
      }
      return false;
    };

    // Support both Robel's `users` table (migration 2) and `profiles` alias
    const usersRes = await supabaseClient.from('users').select('*');
    const profilesFallback = usersRes.error ? await supabaseClient.from('profiles').select('*') : null;

    const [
      driversRes,
      ridesRes,
      paymentsRes,
      disputesRes,
      zonesRes,
      pointsRes,
      statementsRes,
      logsRes,
      faresRes,
      settingsRes,
      sosRes,
      trackRes,
    ] = await Promise.all([
      supabaseClient.from('drivers').select('*'),
      supabaseClient.from('rides').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('disputes').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('restricted_zones').select('*'),
      supabaseClient.from('meeting_points').select('*'),
      supabaseClient.from('weekly_statements').select('*').order('week_id', { ascending: false }),
      supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('fare_configs').select('*').order('version', { ascending: false }),
      supabaseClient.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabaseClient.from('sos_alerts').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('sos_track').select('*').order('at', { ascending: true }),
    ]);

    const activeUsersRes = !usersRes.error ? usersRes : profilesFallback || usersRes;
    if (checkRes(!usersRes.error ? 'users' : 'profiles', activeUsersRes.error) && activeUsersRes.data) {
      this.db.profiles = activeUsersRes.data;
    }

    if (checkRes('drivers', driversRes.error) && driversRes.data) {
      // Normalize Robel's `motorcycle` JSONB column onto flat `plate`/`model`/`color` fields if present
      this.db.drivers = driversRes.data.map((row: Record<string, unknown>) => {
        const moto = (row.motorcycle as { plate?: string; model?: string; color?: string } | undefined) || {};
        return {
          ...row,
          plate: (row.plate as string) || moto.plate || '',
          model: (row.model as string) || moto.model || '',
          color: (row.color as string) || moto.color || '',
        } as unknown as SandboxDatabase['drivers'][number];
      });
    }

    if (checkRes('rides', ridesRes.error) && ridesRes.data) this.db.rides = ridesRes.data;
    if (checkRes('payments', paymentsRes.error) && paymentsRes.data) this.db.payments = paymentsRes.data;
    if (checkRes('disputes', disputesRes.error) && disputesRes.data) this.db.disputes = disputesRes.data;
    if (checkRes('restricted_zones', zonesRes.error) && zonesRes.data) this.db.restricted_zones = zonesRes.data;
    if (checkRes('meeting_points', pointsRes.error) && pointsRes.data) this.db.meeting_points = pointsRes.data;
    if (checkRes('weekly_statements', statementsRes.error) && statementsRes.data) this.db.weekly_statements = statementsRes.data;
    if (checkRes('audit_logs', logsRes.error) && logsRes.data) this.db.audit_logs = logsRes.data;
    if (checkRes('fare_configs', faresRes.error) && faresRes.data) this.db.fare_configs = faresRes.data;
    if (checkRes('settings', settingsRes.error) && settingsRes.data) this.db.settings = settingsRes.data;
    if (checkRes('sos_alerts', sosRes.error) && sosRes.data) this.db.sos_alerts = sosRes.data;
    if (checkRes('sos_track', trackRes.error) && trackRes.data) this.db.sos_track = trackRes.data;

    this.supabaseStatus = {
      ...this.supabaseStatus,
      lastSyncedAt: new Date().toISOString(),
      syncedTables,
      missingTables,
    };
    this.emit();
  }

  subscribeSupabaseRealtime(): () => void {
    if (!supabaseClient || this.mode !== 'supabase') return () => {};
    const channel = supabaseClient
      .channel('dilla-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        this.syncFromSupabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        this.syncFromSupabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        this.syncFromSupabase().catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => {
        this.syncFromSupabase().catch(() => {});
      })
      .subscribe();

    return () => {
      supabaseClient?.removeChannel(channel);
    };
  }

  // =========================================================================
  // Section 8.4 Admin Functions (always go through RPC / Edge Functions)
  // =========================================================================

  async createDriver(input: {
    name: string;
    phone: string;
    login_id: string;
    temporary_password: string;
    license_number: string;
    motorcycle: { plate: string; model: string; color: string };
  }): Promise<{ uid: string }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.functions.invoke('create-driver', { body: input });
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    if (!input.name.trim()) throw new ContractError('NAME_REQUIRED');
    if (!isValidE164(input.phone)) throw new ContractError('INVALID_PHONE');
    if (!input.temporary_password || input.temporary_password.length < 6) {
      throw new ContractError('INVALID_VALUE', { field: 'temporary_password' });
    }
    if (this.db.profiles.some((p) => p.phone === input.phone.trim())) {
      throw new ContractError('PHONE_ALREADY_USED');
    }
    if (this.db.drivers.some((d) => d.login_id.toLowerCase() === input.login_id.trim().toLowerCase())) {
      throw new ContractError('LOGIN_ID_TAKEN');
    }

    const uid = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.profiles = [
      ...this.db.profiles,
      {
        id: uid,
        role: 'DRIVER',
        name: input.name.trim(),
        phone: input.phone.trim(),
        language: 'am',
        status: 'ACTIVE',
        fcm_token: null,
        active_ride_id: null,
        active_sos_id: null,
        emergency_contacts: null,
        created_at: now,
        updated_at: now,
      },
    ];

    this.db.drivers = [
      ...this.db.drivers,
      {
        id: uid,
        login_id: input.login_id.trim(),
        approval: 'PENDING',
        license_number: input.license_number.trim(),
        plate: input.motorcycle.plate.trim(),
        model: input.motorcycle.model.trim(),
        color: input.motorcycle.color.trim(),
        photo_url: null,
        availability: 'OFFLINE',
        wants_online: false,
        connected: false,
        last_seen_at: null,
        current_ride_id: null,
        payment_lock_ride_id: null,
        ready_reminder_sent_at: null,
        last_ready_at: null,
        rating_average: 0,
        rating_count: 0,
        created_at: now,
        updated_at: now,
      },
    ];

    this.logAudit('createDriver', `drivers/${uid}`, null, {
      login_id: input.login_id.trim(),
      plate: input.motorcycle.plate.trim(),
      approval: 'PENDING',
    });
    this.emit();
    return { uid };
  }

  async approveDriver(input: { uid: string; approval: DriverApproval }): Promise<{ approval: DriverApproval }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('approve_driver', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const idx = this.db.drivers.findIndex((d) => d.id === input.uid);
    if (idx === -1) throw new ContractError('NOT_A_DRIVER');
    const prev = this.db.drivers[idx];
    const updated = { ...prev, approval: input.approval, updated_at: new Date().toISOString() };
    this.db.drivers = this.db.drivers.map((d, i) => (i === idx ? updated : d));
    this.logAudit('approveDriver', `drivers/${input.uid}`, { approval: prev.approval }, { approval: input.approval });
    this.emit();
    return { approval: input.approval };
  }

  async blockUser(input: { uid: string; blocked: boolean; reason: string }): Promise<{ status: 'ACTIVE' | 'BLOCKED' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.functions.invoke('block-user', { body: input });
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const idx = this.db.profiles.findIndex((p) => p.id === input.uid);
    if (idx === -1) throw new ContractError('USER_NOT_FOUND');
    if (!input.reason.trim()) throw new ContractError('INVALID_REASON');
    const prev = this.db.profiles[idx];
    const nextStatus = input.blocked ? 'BLOCKED' : 'ACTIVE';
    this.db.profiles = this.db.profiles.map((p, i) =>
      i === idx ? { ...p, status: nextStatus, updated_at: new Date().toISOString() } : p
    );
    this.logAudit(
      'blockUser',
      `profiles/${input.uid}`,
      { status: prev.status },
      { status: nextStatus, reason: input.reason.trim() }
    );
    this.emit();
    return { status: nextStatus };
  }

  async updateFareConfig(input: {
    base_fare_santim: number;
    price_per_km_santim: number;
    minimum_fare_santim: number;
    no_show_wait_seconds: number;
    commission_percent: number;
    confirm: boolean;
    override_validation?: boolean;
  }): Promise<{ version: number }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('update_fare_config', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    if (!input.confirm) throw new ContractError('CONFIRMATION_REQUIRED');
    if (input.price_per_km_santim <= 0 || !Number.isFinite(input.price_per_km_santim)) {
      throw new ContractError('PRICE_PER_KM_INVALID');
    }
    if (input.minimum_fare_santim < 2000 && !input.override_validation) {
      throw new ContractError('MINIMUM_FARE_TOO_LOW', { minimum_default_santim: 2000 });
    }

    const nextVersion =
      this.db.fare_configs.reduce((max, f) => Math.max(max, f.version), 0) + 1;
    const now = new Date().toISOString();
    const newConfig = {
      version: nextVersion,
      base_fare_santim: Math.round(input.base_fare_santim),
      price_per_km_santim: Math.round(input.price_per_km_santim),
      minimum_fare_santim: Math.round(input.minimum_fare_santim),
      no_show_wait_seconds: Math.round(input.no_show_wait_seconds),
      commission_percent: input.commission_percent,
      created_by: this.adminId,
      created_at: now,
    };

    const prevVersion = this.db.settings.active_fare_config_version;
    this.db.fare_configs = [newConfig, ...this.db.fare_configs];
    this.db.settings = {
      ...this.db.settings,
      active_fare_config_version: nextVersion,
      updated_by: this.adminId,
      updated_at: now,
    };

    this.logAudit(
      'updateFareConfig',
      `fare_configs/${nextVersion}`,
      { active_fare_config_version: prevVersion },
      newConfig
    );
    this.emit();
    return { version: nextVersion };
  }

  async updateSettings(patch: Partial<Settings>): Promise<{ updated_at: string }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('update_settings', patch);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    if (patch.ops_phone_numbers) {
      for (const phone of patch.ops_phone_numbers) {
        if (!isValidE164(phone)) throw new ContractError('INVALID_PHONE', { phone });
      }
    }

    const prev = { ...this.db.settings };
    const now = new Date().toISOString();
    this.db.settings = {
      ...this.db.settings,
      ...patch,
      updated_by: this.adminId,
      updated_at: now,
    };

    this.logAudit('updateSettings', 'settings/1', prev as unknown as Record<string, unknown>, patch as Record<string, unknown>);
    this.emit();
    return { updated_at: now };
  }

  async saveRestrictedZone(input: {
    zone_id?: string;
    name: string;
    type: ZoneType;
    points: LatLng[];
    buffer_meters?: number | null;
    active: boolean;
  }): Promise<{ zone_id: string }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('save_restricted_zone', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    if (!input.name.trim()) throw new ContractError('NAME_REQUIRED');
    if (input.type === 'AREA' && input.points.length < 3) {
      throw new ContractError('INVALID_GEOMETRY', { required_points: 3 });
    }
    if (input.type === 'ROAD' && input.points.length < 2) {
      throw new ContractError('INVALID_GEOMETRY', { required_points: 2 });
    }

    const now = new Date().toISOString();
    const zoneId = input.zone_id || `z-${Date.now()}`;
    const existing = this.db.restricted_zones.find((z) => z.id === zoneId) || null;
    const nextZone = {
      id: zoneId,
      name: input.name.trim(),
      type: input.type,
      points: input.points,
      buffer_meters: input.type === 'ROAD' ? (input.buffer_meters ?? 15) : null,
      active: input.active,
      updated_by: this.adminId,
      updated_at: now,
    };

    this.db.restricted_zones = existing
      ? this.db.restricted_zones.map((z) => (z.id === zoneId ? nextZone : z))
      : [...this.db.restricted_zones, nextZone];

    this.logAudit(
      'saveRestrictedZone',
      `restricted_zones/${zoneId}`,
      existing as unknown as Record<string, unknown> | null,
      nextZone as unknown as Record<string, unknown>
    );
    this.emit();
    return { zone_id: zoneId };
  }

  async saveMeetingPoint(input: {
    point_id?: string;
    name: string;
    location: LatLng;
    zone_id: string;
    active: boolean;
  }): Promise<{ point_id: string }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('save_meeting_point', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    if (!this.db.restricted_zones.some((z) => z.id === input.zone_id)) {
      throw new ContractError('ZONE_NOT_FOUND');
    }
    if (!input.name.trim()) throw new ContractError('NAME_REQUIRED');

    const pointId = input.point_id || crypto.randomUUID();
    const existing = this.db.meeting_points.find((m) => m.id === pointId) || null;
    const nextPoint = {
      id: pointId,
      name: input.name.trim(),
      location: input.location,
      zone_id: input.zone_id,
      active: input.active,
    };

    this.db.meeting_points = existing
      ? this.db.meeting_points.map((m) => (m.id === pointId ? nextPoint : m))
      : [...this.db.meeting_points, nextPoint];

    this.logAudit(
      'saveMeetingPoint',
      `meeting_points/${pointId}`,
      existing as unknown as Record<string, unknown> | null,
      nextPoint as unknown as Record<string, unknown>
    );
    this.emit();
    return { point_id: pointId };
  }

  async resolveDispute(input: {
    dispute_id: string;
    outcome: DisputeOutcome;
    confirmed_fare_santim?: number;
    admin_note: string;
  }): Promise<{ status: 'RESOLVED' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('resolve_dispute', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const dIdx = this.db.disputes.findIndex((d) => d.id === input.dispute_id);
    if (dIdx === -1) throw new ContractError('DISPUTE_NOT_FOUND');
    const dispute = this.db.disputes[dIdx];
    if (dispute.status === 'RESOLVED') throw new ContractError('DISPUTE_ALREADY_RESOLVED');
    if (!input.admin_note.trim()) throw new ContractError('NOTE_REQUIRED');

    const pIdx = this.db.payments.findIndex((p) => p.ride_id === dispute.ride_id);
    if (pIdx === -1) throw new ContractError('RIDE_NOT_FOUND');
    const payment = this.db.payments[pIdx];

    let confirmedFare = payment.fare_santim;
    if (input.outcome === 'REDUCED_FARE_CONFIRMED') {
      if (
        typeof input.confirmed_fare_santim !== 'number' ||
        input.confirmed_fare_santim < 0 ||
        input.confirmed_fare_santim > payment.fare_santim
      ) {
        throw new ContractError('INVALID_AMOUNT');
      }
      confirmedFare = Math.round(input.confirmed_fare_santim);
    }

    const newCommission = Math.round((confirmedFare * payment.commission_percent) / 100);
    const commissionDelta = newCommission - payment.commission_santim;
    const fareDelta = confirmedFare - payment.confirmed_fare_santim;
    const now = new Date().toISOString();

    this.db.disputes = this.db.disputes.map((d, i) =>
      i === dIdx
        ? {
            ...d,
            status: 'RESOLVED',
            outcome: input.outcome,
            confirmed_fare_santim: confirmedFare,
            admin_note: input.admin_note.trim(),
            resolved_by: this.adminId,
            resolved_at: now,
          }
        : d
    );

    this.db.payments = this.db.payments.map((p, i) =>
      i === pIdx
        ? {
            ...p,
            confirmed_fare_santim: confirmedFare,
            commission_santim: newCommission,
            status: 'PAID',
            updated_at: now,
          }
        : p
    );

    // Update weekly statement or adjustments_santim if already paid
    const stIdx = this.db.weekly_statements.findIndex(
      (s) => s.driver_id === payment.driver_id && s.week_id === payment.week_id
    );
    if (stIdx !== -1) {
      const st = this.db.weekly_statements[stIdx];
      if (st.status === 'UNPAID') {
        this.db.weekly_statements = this.db.weekly_statements.map((s, i) =>
          i === stIdx
            ? {
                ...s,
                total_fares_santim: s.total_fares_santim + fareDelta,
                commission_santim: s.commission_santim + commissionDelta,
              }
            : s
        );
      } else if (commissionDelta !== 0) {
        const nextUnpaidIdx = this.db.weekly_statements.findIndex(
          (s) => s.driver_id === payment.driver_id && s.status === 'UNPAID'
        );
        if (nextUnpaidIdx !== -1) {
          this.db.weekly_statements = this.db.weekly_statements.map((s, i) =>
            i === nextUnpaidIdx
              ? { ...s, adjustments_santim: s.adjustments_santim + commissionDelta }
              : s
          );
        }
      }
    }

    this.logAudit(
      'resolveDispute',
      `disputes/${dispute.id}`,
      { status: dispute.status, confirmed_fare_santim: payment.confirmed_fare_santim },
      { status: 'RESOLVED', outcome: input.outcome, confirmed_fare_santim: confirmedFare, admin_note: input.admin_note.trim() }
    );
    this.emit();
    return { status: 'RESOLVED' };
  }

  async closeStalledRide(input: { ride_id: string; note: string }): Promise<{ status: 'CANCELLED' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('close_stalled_ride', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const rIdx = this.db.rides.findIndex((r) => r.id === input.ride_id);
    if (rIdx === -1) throw new ContractError('RIDE_NOT_FOUND');
    const ride = this.db.rides[rIdx];
    if (['COMPLETED', 'CANCELLED', 'NO_DRIVER_FOUND', 'EXPIRED'].includes(ride.status)) {
      throw new ContractError('INVALID_RIDE_STATE');
    }
    if (!input.note.trim()) throw new ContractError('NOTE_REQUIRED');

    const now = new Date().toISOString();
    this.db.rides = this.db.rides.map((r, i) =>
      i === rIdx
        ? {
            ...r,
            status: 'CANCELLED',
            cancelled_by: 'ADMIN',
            cancel_reason: 'OTHER',
            cancelled_at: now,
            stalled: false,
          }
        : r
    );

    if (ride.driver_id) {
      this.db.drivers = this.db.drivers.map((d) =>
        d.id === ride.driver_id
          ? {
              ...d,
              current_ride_id: null,
              availability: d.wants_online && d.connected ? 'READY' : 'OFFLINE',
              updated_at: now,
            }
          : d
      );
    }

    this.db.profiles = this.db.profiles.map((p) =>
      p.id === ride.passenger_id ? { ...p, active_ride_id: null, updated_at: now } : p
    );

    this.logAudit(
      'closeStalledRide',
      `rides/${ride.id}`,
      { status: ride.status, stalled: ride.stalled },
      { status: 'CANCELLED', note: input.note.trim() }
    );
    this.emit();
    return { status: 'CANCELLED' };
  }

  async markCommissionPaid(input: { driver_id: string; week_id: string }): Promise<{ status: 'PAID' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('mark_commission_paid', {
        statement_id: `${input.driver_id}_${input.week_id}`,
      });
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const idx = this.db.weekly_statements.findIndex(
      (s) => s.driver_id === input.driver_id && s.week_id === input.week_id
    );
    if (idx === -1) throw new ContractError('STATEMENT_NOT_FOUND');
    const st = this.db.weekly_statements[idx];
    if (st.status === 'PAID') throw new ContractError('STATEMENT_ALREADY_PAID');

    const now = new Date().toISOString();
    this.db.weekly_statements = this.db.weekly_statements.map((s, i) =>
      i === idx
        ? { ...s, status: 'PAID', paid_at: now, marked_paid_by: this.adminId }
        : s
    );

    this.logAudit(
      'markCommissionPaid',
      `weekly_statements/${input.driver_id}_${input.week_id}`,
      { status: 'UNPAID' },
      { status: 'PAID', paid_at: now }
    );
    this.emit();
    return { status: 'PAID' };
  }

  async acknowledgeSos(input: { sos_id: string }): Promise<{ status: 'ACKNOWLEDGED' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('acknowledge_sos', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const idx = this.db.sos_alerts.findIndex((s) => s.id === input.sos_id);
    if (idx === -1) throw new ContractError('SOS_NOT_FOUND');
    const alert = this.db.sos_alerts[idx];
    if (alert.status === 'RESOLVED') throw new ContractError('SOS_ALREADY_RESOLVED');

    const now = new Date().toISOString();
    this.db.sos_alerts = this.db.sos_alerts.map((s, i) =>
      i === idx
        ? {
            ...s,
            status: 'ACKNOWLEDGED',
            acknowledged_by: this.adminId,
            acknowledged_at: now,
          }
        : s
    );

    this.logAudit('acknowledgeSos', `sos_alerts/${alert.id}`, { status: alert.status }, { status: 'ACKNOWLEDGED' });
    this.emit();
    return { status: 'ACKNOWLEDGED' };
  }

  async resolveSos(input: {
    sos_id: string;
    outcome: SosOutcome;
    admin_note: string;
  }): Promise<{ status: 'RESOLVED' }> {
    if (this.mode === 'supabase' && supabaseClient) {
      const { data, error } = await supabaseClient.rpc('resolve_sos', input);
      if (error) throw new Error(error.message);
      await this.syncFromSupabase();
      return data;
    }

    const idx = this.db.sos_alerts.findIndex((s) => s.id === input.sos_id);
    if (idx === -1) throw new ContractError('SOS_NOT_FOUND');
    const alert = this.db.sos_alerts[idx];
    if (alert.status === 'RESOLVED') throw new ContractError('SOS_ALREADY_RESOLVED');
    if (!input.admin_note.trim()) throw new ContractError('NOTE_REQUIRED');

    const now = new Date().toISOString();
    this.db.sos_alerts = this.db.sos_alerts.map((s, i) =>
      i === idx
        ? {
            ...s,
            status: 'RESOLVED',
            outcome: input.outcome,
            admin_note: input.admin_note.trim(),
            resolved_by: this.adminId,
            resolved_at: now,
          }
        : s
    );

    if (alert.raised_by_user_id) {
      this.db.profiles = this.db.profiles.map((p) =>
        p.id === alert.raised_by_user_id ? { ...p, active_sos_id: null, updated_at: now } : p
      );
    }

    this.logAudit(
      'resolveSos',
      `sos_alerts/${alert.id}`,
      { status: alert.status },
      { status: 'RESOLVED', outcome: input.outcome, admin_note: input.admin_note.trim() }
    );
    this.emit();
    return { status: 'RESOLVED' };
  }

  // =========================================================================
  // Development-Only Test Console (/dev) — Passenger, Driver & SOS Simulation
  // =========================================================================

  devEstimateFare(pickup: LatLng, destination: LatLng) {
    const activeFare =
      this.db.fare_configs.find((f) => f.version === this.db.settings.active_fare_config_version) ||
      this.db.fare_configs[0];

    const distance_meters = Math.max(200, Math.round(haversineMeters(pickup, destination) * 1.25));
    const raw_santim =
      activeFare.base_fare_santim + (distance_meters / 1000) * activeFare.price_per_km_santim;
    const clamped = Math.max(activeFare.minimum_fare_santim, raw_santim);
    // Rounded up to whole birr (multiple of 100 santim)
    const fare_santim = Math.ceil(clamped / 100) * 100;

    const checkZone = (pt: LatLng) => {
      for (const z of this.db.restricted_zones) {
        if (!z.active) continue;
        if (z.type === 'AREA' && pointInPolygon(pt, z.points)) {
          const suggested = this.db.meeting_points
            .filter((m) => m.zone_id === z.id && m.active)
            .map((m) => ({
              id: m.id,
              name: m.name,
              location: m.location,
              distance_meters: haversineMeters(pt, m.location),
            }));
          return { code: 'IN_RESTRICTED_ZONE' as const, zone_name: z.name, suggested_meeting_points: suggested };
        }
        if (z.type === 'ROAD' && z.points.length >= 2) {
          const dist = distanceToSegmentMeters(pt, z.points[0], z.points[1]);
          if (dist <= (z.buffer_meters ?? 15)) {
            return { code: 'ON_BANNED_ROAD' as const, zone_name: z.name, suggested_meeting_points: [] };
          }
        }
      }
      return null;
    };

    return {
      distance_meters,
      fare_santim,
      fare_config_version: activeFare.version,
      pickup_issue: checkZone(pickup),
      destination_issue: checkZone(destination),
    };
  }

  devRequestRide(input: {
    passenger_id: string;
    request_id: string;
    pickup: LatLng & { address: string; meeting_point_id?: string | null };
    destination: LatLng & { address: string; meeting_point_id?: string | null };
    expected_fare_santim: number;
  }) {
    const existing = this.db.rides.find((r) => r.request_id === input.request_id);
    if (existing) {
      return { ride_id: existing.id, fare_santim: existing.fare_santim };
    }

    const passenger = this.db.profiles.find((p) => p.id === input.passenger_id);
    if (!passenger) throw new ContractError('USER_NOT_FOUND');
    if (passenger.status === 'BLOCKED') throw new ContractError('USER_BLOCKED');
    if (passenger.active_ride_id) throw new ContractError('ACTIVE_RIDE_EXISTS');

    const est = this.devEstimateFare(input.pickup, input.destination);
    if (est.pickup_issue) {
      throw new ContractError(
        est.pickup_issue.code === 'IN_RESTRICTED_ZONE'
          ? 'PICKUP_IN_RESTRICTED_ZONE'
          : 'PICKUP_ON_BANNED_ROAD',
        { suggested_meeting_points: est.pickup_issue.suggested_meeting_points }
      );
    }
    if (est.destination_issue) {
      throw new ContractError(
        est.destination_issue.code === 'IN_RESTRICTED_ZONE'
          ? 'DESTINATION_IN_RESTRICTED_ZONE'
          : 'DESTINATION_ON_BANNED_ROAD',
        { suggested_meeting_points: est.destination_issue.suggested_meeting_points }
      );
    }
    if (est.fare_santim !== input.expected_fare_santim) {
      throw new ContractError('FARE_CHANGED', { new_fare_santim: est.fare_santim });
    }

    const rideId = crypto.randomUUID();
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + this.db.settings.search_timeout_seconds * 1000).toISOString();

    // Find nearest READY driver
    const readyDrivers = this.db.drivers.filter((d) => {
      const p = this.db.profiles.find((u) => u.id === d.id);
      return d.availability === 'READY' && d.approval === 'APPROVED' && d.connected && p?.status === 'ACTIVE';
    });

    const sortedCandidates = readyDrivers
      .map((d) => {
        const loc = this.db.driver_locations.find((l) => l.driver_id === d.id)?.location || {
          lat: 6.4095,
          lng: 38.3118,
        };
        return { d, dist: haversineMeters(input.pickup, loc) };
      })
      .filter((x) => x.dist <= this.db.settings.max_pickup_distance_meters)
      .sort((a, b) => a.dist - b.dist);

    const firstCandidate = sortedCandidates[0];

    const newRide = {
      id: rideId,
      passenger_id: input.passenger_id,
      driver_id: null,
      status: firstCandidate ? ('SEARCHING' as const) : ('NO_DRIVER_FOUND' as const),
      pickup_location: { lat: input.pickup.lat, lng: input.pickup.lng },
      destination_location: { lat: input.destination.lat, lng: input.destination.lng },
      pickup_address: input.pickup.address,
      destination_address: input.destination.address,
      pickup_meeting_point_id: input.pickup.meeting_point_id ?? null,
      destination_meeting_point_id: input.destination.meeting_point_id ?? null,
      distance_meters: est.distance_meters,
      fare_santim: est.fare_santim,
      fare_config_version: est.fare_config_version,
      request_id: input.request_id,
      previous_ride_id: null,
      tried_driver_ids: firstCandidate ? [firstCandidate.d.id] : [],
      current_offer_driver_id: firstCandidate ? firstCandidate.d.id : null,
      search_deadline_at: deadline,
      driver_snapshot: null,
      passenger_snapshot: { name: passenger.name },
      contact: null,
      driver_connected: null,
      last_driver_location: null,
      no_show_available_at: null,
      created_at: now,
      accepted_at: null,
      arrived_at: null,
      started_at: null,
      completed_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancel_reason: null,
      completed_by: null,
      passenger_rating_of_driver: null,
      stalled: false,
      safety_check: null,
    };

    this.db.rides = [newRide, ...this.db.rides];
    if (firstCandidate) {
      this.db.offers = [
        {
          ride_id: rideId,
          driver_id: firstCandidate.d.id,
          status: 'OFFERED',
          distance_to_pickup_meters: firstCandidate.dist,
          offered_at: now,
          expires_at: new Date(Date.now() + this.db.settings.offer_timeout_seconds * 1000).toISOString(),
          responded_at: null,
        },
        ...this.db.offers,
      ];
      this.db.profiles = this.db.profiles.map((p) =>
        p.id === input.passenger_id ? { ...p, active_ride_id: rideId, updated_at: now } : p
      );
    }

    this.emit();
    return { ride_id: rideId, fare_santim: est.fare_santim };
  }

  devCancelRide(actorId: string, actorRole: 'PASSENGER' | 'DRIVER', rideId: string, reason: CancelReason) {
    const ride = this.db.rides.find((r) => r.id === rideId);
    if (!ride) throw new ContractError('RIDE_NOT_FOUND');
    if (actorRole === 'PASSENGER' && ride.passenger_id !== actorId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (actorRole === 'DRIVER' && ride.driver_id !== actorId) throw new ContractError('NOT_RIDE_PARTICIPANT');

    if (
      actorRole === 'PASSENGER' &&
      !['REQUESTED', 'SEARCHING', 'DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP'].includes(ride.status)
    ) {
      throw new ContractError('INVALID_RIDE_STATE');
    }
    if (actorRole === 'DRIVER' && !['DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP'].includes(ride.status)) {
      throw new ContractError('INVALID_RIDE_STATE');
    }
    if (actorRole === 'DRIVER' && reason === 'PASSENGER_NO_SHOW') {
      throw new ContractError('INVALID_REASON');
    }

    const now = new Date().toISOString();
    this.db.rides = this.db.rides.map((r) =>
      r.id === rideId
        ? { ...r, status: 'CANCELLED', cancelled_by: actorRole, cancel_reason: reason, cancelled_at: now }
        : r
    );
    this.db.offers = this.db.offers.map((o) =>
      o.ride_id === rideId && o.status === 'OFFERED' ? { ...o, status: 'CANCELLED', responded_at: now } : o
    );
    this.db.profiles = this.db.profiles.map((p) =>
      p.id === ride.passenger_id ? { ...p, active_ride_id: null, updated_at: now } : p
    );
    if (ride.driver_id) {
      this.db.drivers = this.db.drivers.map((d) =>
        d.id === ride.driver_id
          ? {
              ...d,
              current_ride_id: null,
              availability: d.wants_online && d.connected ? 'READY' : 'OFFLINE',
              updated_at: now,
            }
          : d
      );
    }
    this.emit();
    return { status: 'CANCELLED' };
  }

  devSetDriverReady(driverId: string) {
    const profile = this.db.profiles.find((p) => p.id === driverId);
    const driver = this.db.drivers.find((d) => d.id === driverId);
    if (!driver || !profile) throw new ContractError('NOT_A_DRIVER');
    if (driver.approval !== 'APPROVED') throw new ContractError('DRIVER_NOT_APPROVED');
    if (profile.status === 'BLOCKED') throw new ContractError('USER_BLOCKED');
    if (driver.payment_lock_ride_id) {
      throw new ContractError('PAYMENT_LOCKED', { ride_id: driver.payment_lock_ride_id });
    }
    if (driver.current_ride_id) throw new ContractError('ACTIVE_RIDE_EXISTS');

    const now = new Date().toISOString();
    this.db.drivers = this.db.drivers.map((d) =>
      d.id === driverId
        ? {
            ...d,
            availability: d.connected ? 'READY' : 'OFFLINE',
            wants_online: true,
            last_ready_at: now,
            updated_at: now,
          }
        : d
    );
    this.emit();
    return { availability: 'READY' };
  }

  devToggleDriverPresence(driverId: string, connected: boolean) {
    const driver = this.db.drivers.find((d) => d.id === driverId);
    if (!driver) throw new ContractError('NOT_A_DRIVER');
    const now = new Date().toISOString();
    let nextAvail = driver.availability;
    if (!connected && driver.availability === 'READY') nextAvail = 'OFFLINE';
    if (connected && driver.wants_online && driver.availability === 'OFFLINE' && !driver.payment_lock_ride_id) {
      nextAvail = 'READY';
    }
    this.db.drivers = this.db.drivers.map((d) =>
      d.id === driverId ? { ...d, connected, availability: nextAvail, last_seen_at: now, updated_at: now } : d
    );
    if (driver.current_ride_id) {
      const loc = this.db.driver_locations.find((l) => l.driver_id === driverId)?.location || {
        lat: 6.4095,
        lng: 38.3118,
      };
      this.db.rides = this.db.rides.map((r) =>
        r.id === driver.current_ride_id
          ? {
              ...r,
              driver_connected: connected,
              last_driver_location: !connected ? { ...loc, updated_at: now } : r.last_driver_location,
            }
          : r
      );
    }
    this.emit();
  }

  devSetDriverLocation(driverId: string, location: LatLng) {
    const now = new Date().toISOString();
    const exists = this.db.driver_locations.some((l) => l.driver_id === driverId);
    this.db.driver_locations = exists
      ? this.db.driver_locations.map((l) => (l.driver_id === driverId ? { ...l, location, updated_at: now } : l))
      : [...this.db.driver_locations, { driver_id: driverId, location, heading: 0, updated_at: now }];
    this.emit();
  }

  devAcceptOffer(driverId: string, rideId: string) {
    const driver = this.db.drivers.find((d) => d.id === driverId);
    const driverProfile = this.db.profiles.find((p) => p.id === driverId);
    const ride = this.db.rides.find((r) => r.id === rideId);
    if (!driver || !driverProfile) throw new ContractError('NOT_A_DRIVER');
    if (driver.availability !== 'READY') throw new ContractError('DRIVER_NOT_READY');
    if (!ride || ride.status !== 'SEARCHING') throw new ContractError('RIDE_NO_LONGER_AVAILABLE');
    const offer = this.db.offers.find((o) => o.ride_id === rideId && o.driver_id === driverId);
    if (!offer || offer.status !== 'OFFERED') throw new ContractError('OFFER_NOT_FOUND');

    const passengerProfile = this.db.profiles.find((p) => p.id === ride.passenger_id);
    const now = new Date().toISOString();
    const pin = String(Math.floor(1000 + Math.random() * 9000));

    this.db.offers = this.db.offers.map((o) =>
      o.ride_id === rideId && o.driver_id === driverId ? { ...o, status: 'ACCEPTED', responded_at: now } : o
    );
    this.db.ride_pins = [...this.db.ride_pins, { ride_id: rideId, pin, failed_attempts: 0 }];
    this.db.rides = this.db.rides.map((r) =>
      r.id === rideId
        ? {
            ...r,
            status: 'DRIVER_ACCEPTED',
            driver_id: driverId,
            accepted_at: now,
            driver_connected: driver.connected,
            driver_snapshot: {
              name: driverProfile.name,
              plate: driver.plate,
              model: driver.model,
              color: driver.color,
              rating_average: driver.rating_average,
              photo_url: driver.photo_url,
            },
            contact: {
              driver_phone: driverProfile.phone,
              passenger_phone: passengerProfile?.phone || '+251900000000',
            },
          }
        : r
    );
    this.db.drivers = this.db.drivers.map((d) =>
      d.id === driverId ? { ...d, availability: 'ON_RIDE', current_ride_id: rideId, updated_at: now } : d
    );
    this.emit();
    return { ride_id: rideId, pin };
  }

  devMarkArrived(driverId: string, rideId: string) {
    const ride = this.db.rides.find((r) => r.id === rideId);
    if (!ride) throw new ContractError('RIDE_NOT_FOUND');
    if (ride.driver_id !== driverId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (ride.status !== 'DRIVER_ACCEPTED') throw new ContractError('INVALID_RIDE_STATE');
    const now = new Date().toISOString();
    const fareCfg =
      this.db.fare_configs.find((f) => f.version === ride.fare_config_version) || this.db.fare_configs[0];
    const noShowAt = new Date(Date.now() + fareCfg.no_show_wait_seconds * 1000).toISOString();

    this.db.rides = this.db.rides.map((r) =>
      r.id === rideId ? { ...r, status: 'ARRIVED_AT_PICKUP', arrived_at: now, no_show_available_at: noShowAt } : r
    );
    this.emit();
    return { no_show_available_at: noShowAt };
  }

  devStartRide(driverId: string, rideId: string, pinInput: string) {
    const ride = this.db.rides.find((r) => r.id === rideId);
    if (!ride) throw new ContractError('RIDE_NOT_FOUND');
    if (ride.driver_id !== driverId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (ride.status !== 'ARRIVED_AT_PICKUP') throw new ContractError('INVALID_RIDE_STATE');
    const pinRec = this.db.ride_pins.find((p) => p.ride_id === rideId);
    if (!pinRec) throw new ContractError('RIDE_NOT_FOUND');
    if (pinRec.failed_attempts >= this.db.settings.max_pin_attempts) {
      throw new ContractError('PIN_ATTEMPTS_EXCEEDED');
    }
    if (pinInput.trim() !== pinRec.pin) {
      const nextFails = pinRec.failed_attempts + 1;
      this.db.ride_pins = this.db.ride_pins.map((p) =>
        p.ride_id === rideId ? { ...p, failed_attempts: nextFails } : p
      );
      this.emit();
      if (nextFails >= this.db.settings.max_pin_attempts) {
        throw new ContractError('PIN_ATTEMPTS_EXCEEDED');
      }
      throw new ContractError('PIN_INVALID', {
        attempts_left: this.db.settings.max_pin_attempts - nextFails,
      });
    }

    const now = new Date().toISOString();
    this.db.rides = this.db.rides.map((r) =>
      r.id === rideId ? { ...r, status: 'IN_PROGRESS', started_at: now } : r
    );
    this.emit();
    return { status: 'IN_PROGRESS' };
  }

  devCompleteRide(actorId: string, mode: 'DRIVER' | 'PASSENGER', rideId: string) {
    const ride = this.db.rides.find((r) => r.id === rideId);
    if (!ride) throw new ContractError('RIDE_NOT_FOUND');
    if (mode === 'DRIVER' && ride.driver_id !== actorId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (mode === 'PASSENGER' && ride.passenger_id !== actorId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (ride.status !== 'IN_PROGRESS') throw new ContractError('INVALID_RIDE_STATE');
    if (mode === 'PASSENGER' && ride.driver_connected !== false) {
      throw new ContractError('DRIVER_STILL_CONNECTED');
    }

    const now = new Date().toISOString();
    const fareCfg =
      this.db.fare_configs.find((f) => f.version === ride.fare_config_version) || this.db.fare_configs[0];
    const commission = Math.round((ride.fare_santim * fareCfg.commission_percent) / 100);
    const weekId = getAddisIsoWeekId(new Date());

    this.db.rides = this.db.rides.map((r) =>
      r.id === rideId ? { ...r, status: 'COMPLETED', completed_by: mode, completed_at: now } : r
    );

    if (ride.driver_id) {
      this.db.payments = [
        {
          ride_id: rideId,
          driver_id: ride.driver_id,
          passenger_id: ride.passenger_id,
          fare_santim: ride.fare_santim,
          confirmed_fare_santim: ride.fare_santim,
          status: 'PENDING_DRIVER_CONFIRMATION',
          commission_percent: fareCfg.commission_percent,
          commission_santim: commission,
          week_id: weekId,
          driver_confirmed_at: null,
          difference: null,
          dispute_id: null,
          created_at: now,
          updated_at: now,
        },
        ...this.db.payments,
      ];
      this.db.drivers = this.db.drivers.map((d) =>
        d.id === ride.driver_id
          ? { ...d, availability: 'PAYMENT_PENDING', payment_lock_ride_id: rideId, updated_at: now }
          : d
      );
    }

    this.db.profiles = this.db.profiles.map((p) =>
      p.id === ride.passenger_id ? { ...p, active_ride_id: null, updated_at: now } : p
    );
    this.emit();
    return { status: 'COMPLETED' };
  }

  devConfirmCashReceived(driverId: string, rideId: string) {
    const payment = this.db.payments.find((p) => p.ride_id === rideId);
    if (!payment) throw new ContractError('RIDE_NOT_FOUND');
    if (payment.driver_id !== driverId) throw new ContractError('NOT_RIDE_PARTICIPANT');
    if (payment.status === 'PAID') throw new ContractError('PAYMENT_ALREADY_CONFIRMED');

    const now = new Date().toISOString();
    const hasOpenDispute = this.db.disputes.some((d) => d.ride_id === rideId && d.status === 'OPEN');

    this.db.payments = this.db.payments.map((p) =>
      p.ride_id === rideId
        ? { ...p, status: hasOpenDispute ? 'DISPUTED' : 'PAID', driver_confirmed_at: now, updated_at: now }
        : p
    );

    const driver = this.db.drivers.find((d) => d.id === driverId);
    const nextAvail = driver && driver.wants_online && driver.connected ? 'READY' : 'OFFLINE';

    this.db.drivers = this.db.drivers.map((d) =>
      d.id === driverId
        ? { ...d, payment_lock_ride_id: null, current_ride_id: null, availability: nextAvail, updated_at: now }
        : d
    );
    this.emit();
    return { availability: nextAvail };
  }

  devTriggerSos(userId: string, rideId: string | null, location: LatLng) {
    const profile = this.db.profiles.find((p) => p.id === userId);
    if (!profile) throw new ContractError('USER_NOT_FOUND');
    if (profile.status === 'BLOCKED') throw new ContractError('USER_BLOCKED');

    const existingOpen = this.db.sos_alerts.find(
      (s) => s.raised_by_user_id === userId && s.status !== 'RESOLVED'
    );
    if (existingOpen) {
      throw new ContractError('SOS_ALREADY_OPEN', { sos_id: existingOpen.id });
    }

    const ride = rideId ? this.db.rides.find((r) => r.id === rideId) : null;
    if (rideId && !ride) throw new ContractError('RIDE_NOT_FOUND');

    const driverProf = ride?.driver_id ? this.db.profiles.find((p) => p.id === ride.driver_id) : null;
    const passengerProf = ride ? this.db.profiles.find((p) => p.id === ride.passenger_id) : null;
    const driverRec = ride?.driver_id ? this.db.drivers.find((d) => d.id === ride.driver_id) : null;

    const sosId = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.sos_alerts = [
      {
        id: sosId,
        request_id: crypto.randomUUID(),
        ride_id: rideId,
        raised_by_user_id: userId,
        raised_by: profile.role === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
        trigger: 'USER_BUTTON',
        status: 'OPEN',
        location,
        location_updated_at: now,
        ride_snapshot: ride
          ? {
              passenger_name: passengerProf?.name || null,
              passenger_phone: passengerProf?.phone || null,
              driver_name: driverProf?.name || null,
              driver_phone: driverProf?.phone || null,
              plate: driverRec?.plate || null,
              model: driverRec?.model || null,
              color: driverRec?.color || null,
              ride_status: ride.status,
              pickup_address: ride.pickup_address,
              destination_address: ride.destination_address,
            }
          : {
              passenger_name: null,
              passenger_phone: null,
              driver_name: profile.name,
              driver_phone: profile.phone,
              plate: this.db.drivers.find((d) => d.id === userId)?.plate || null,
              model: this.db.drivers.find((d) => d.id === userId)?.model || null,
              color: this.db.drivers.find((d) => d.id === userId)?.color || null,
              ride_status: null,
              pickup_address: null,
              destination_address: null,
            },
        contacts_notified_at: profile.emergency_contacts?.length ? now : null,
        ops_notified_at: now,
        escalated_at: null,
        escalation_count: 0,
        user_marked_safe_at: null,
        acknowledged_by: null,
        acknowledged_at: null,
        resolved_by: null,
        resolved_at: null,
        outcome: null,
        admin_note: null,
        created_at: now,
      },
      ...this.db.sos_alerts,
    ];

    this.db.sos_track = [
      ...this.db.sos_track,
      { id: `trk-${Date.now()}`, sos_id: sosId, location, at: now },
    ];
    this.db.profiles = this.db.profiles.map((p) =>
      p.id === userId ? { ...p, active_sos_id: sosId, updated_at: now } : p
    );
    this.emit();
    return { sos_id: sosId };
  }

  devMarkSosSafe(sosId: string) {
    const alert = this.db.sos_alerts.find((s) => s.id === sosId);
    if (!alert) throw new ContractError('SOS_NOT_FOUND');
    if (alert.status === 'RESOLVED') throw new ContractError('SOS_ALREADY_RESOLVED');
    const now = new Date().toISOString();
    this.db.sos_alerts = this.db.sos_alerts.map((s) =>
      s.id === sosId ? { ...s, user_marked_safe_at: now } : s
    );
    this.emit();
    return { ok: true };
  }
}

export const backend = new DillaBackendService();
