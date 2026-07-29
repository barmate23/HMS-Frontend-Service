import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  ChannexService,
  ChannexConfig,
  ChannexBookingPayload,
  AriPushParams,
  MasterSyncData,
  AvailabilitySyncData,
  FeedPullData,
  ChannexProperty,
  ChannexRoomType,
  ChannexRatePlan,
  ChannexSyncLog,
  AckRevisionData,
  ChannexChannel,
  CreateChannelParams,
  TestConnectionData
} from './channex.service';

type TabId = 'overview' | 'master-sync' | 'channels' | 'config';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Component({
  selector: 'app-channex',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './channex.component.html',
  styleUrls: ['./channex.component.css']
})
export class ChannexComponent implements OnInit {
  cx = inject(ChannexService);

  // ─── Tab State ────────────────────────────────────────────────────────────
  activeTab = signal<TabId>('overview');

  tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: 'overview',    label: 'Overview',         icon: 'hub' },
    { id: 'master-sync', label: 'Master Sync',      icon: 'sync' },
    { id: 'channels',    label: 'Channels',         icon: 'travel_explore' },
    { id: 'config',      label: 'Property & Rates', icon: 'domain' }
  ];

  // ─── Loading Flags ────────────────────────────────────────────────────────
  loadingMasterSync   = signal(false);
  loadingAvailability = signal(false);
  loadingAriPush      = signal(false);
  loadingFeed         = signal(false);
  loadingAck          = signal(false);
  loadingManualSync   = signal(false);
  loadingWebhookCheck = signal(false);
  loadingProperties   = signal(false);
  loadingRoomTypes    = signal(false);
  loadingRatePlans    = signal(false);
  loadingChannels     = signal(false);
  loadingCreateChannel= signal(false);
  loadingTestConn     = signal(false);

  // ─── Response Data ────────────────────────────────────────────────────────
  masterSyncResult    = signal<MasterSyncData | null>(null);
  availabilityResult  = signal<AvailabilitySyncData | null>(null);
  feedResult          = signal<FeedPullData | null>(null);
  ackResult           = signal<AckRevisionData | null>(null);
  manualSyncResult    = signal<unknown | null>(null);
  webhookStatus       = signal<'ok' | 'error' | 'unknown'>('unknown');
  properties          = signal<ChannexProperty[]>([]);
  roomTypes           = signal<ChannexRoomType[]>([]);
  ratePlans           = signal<ChannexRatePlan[]>([]);
  channels            = signal<ChannexChannel[]>([]);
  testConnResult      = signal<TestConnectionData | null>(null);

  // ─── Toasts ───────────────────────────────────────────────────────────────
  toasts = signal<Toast[]>([]);

  // ─── Config Form ──────────────────────────────────────────────────────────
  configForm: ChannexConfig = { apiKey: '', propertyId: '', baseUrl: '', webhookUrl: '' };
  showApiKey = signal(false);
  webhookCopied = signal(false);

  // ─── Availability Form ────────────────────────────────────────────────────
  availForm = {
    startDate: this.todayStr(),
    endDate: this.addDays(30)
  };

  // ─── ARI Push Form ────────────────────────────────────────────────────────
  ariForm: AriPushParams = {
    roomTypeId: '',
    ratePlanId: '',
    startDate: this.todayStr(),
    endDate: this.addDays(30),
    availability: undefined,
    rate: undefined
  };

  // ─── Manual Booking Sync Form ─────────────────────────────────────────────
  bookingForm: ChannexBookingPayload = {
    booking_unique_id: '',
    status: 'new',
    arrival_date: this.addDays(7),
    departure_date: this.addDays(10),
    ota_name: 'Booking.com',
    gst_percent: 18,
    customer: { name: '', surname: '', email: '', phone: '' },
    occupancy: { adults: 2, children: 0 },
    rooms: [{ title: '' }]
  };

  // ─── Create Channel Form ──────────────────────────────────────────────────
  channelForm: CreateChannelParams = {
    channel: 'Make My Trip',
    channelCode: 'makemytrip',
    title: '',
    propertyId: '',
    groupId: '',
    currency: 'Auto',
    hotelId: '',
    accessToken: '',
    sendBookingNotificationEmail: false,
    syncB2bRateType: false,
    syncMybizRateType: false,
    isActive: true
  };

  channelProviders = [
    { code: 'makemytrip', name: 'Make My Trip', icon: 'travel_explore' },
    { code: 'booking_com', name: 'Booking.com', icon: 'hotel' },
    { code: 'agoda', name: 'Agoda', icon: 'beach_access' },
    { code: 'expedia', name: 'Expedia', icon: 'flight' },
    { code: 'airbnb', name: 'Airbnb', icon: 'home' },
    { code: 'yantra', name: 'Yantra Channel', icon: 'hub' }
  ];

  onChannelProviderChange(code: string): void {
    const p = this.channelProviders.find(x => x.code === code);
    if (p) {
      this.channelForm.channel = p.name;
      this.channelForm.channelCode = p.code;
    }
  }

  // ─── Acknowledge Form ─────────────────────────────────────────────────────
  ackRevisionId = signal('');

  // ─── Last sync timestamps (stored locally) ────────────────────────────────
  lastMasterSync    = signal<string | null>(localStorage.getItem('cx-last-master') || null);
  lastAvailSync     = signal<string | null>(localStorage.getItem('cx-last-avail') || null);
  lastFeedPull      = signal<string | null>(localStorage.getItem('cx-last-feed') || null);

  ngOnInit(): void {
    const cfg = this.cx.config();
    this.configForm = { ...cfg };
    this.channelForm.propertyId = cfg.propertyId;

    // Automatically pre-load properties, room types, rate plans, channels & test connection
    this.loadAllConfig(true);
    this.testConnection(true);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  setTab(id: TabId): void {
    this.activeTab.set(id);
    if (id === 'channels' && this.channels().length === 0) {
      this.loadChannels();
    }
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  private toast(type: Toast['type'], message: string): void {
    const t: Toast = { id: Math.random().toString(36).slice(2), type, message };
    this.toasts.update(ts => [...ts, t]);
    setTimeout(() => this.toasts.update(ts => ts.filter(x => x.id !== t.id)), 4500);
  }

  dismissToast(id: string): void {
    this.toasts.update(ts => ts.filter(t => t.id !== id));
  }

  copyWebhookUrl(): void {
    const url = this.cx.config().webhookUrl;
    navigator.clipboard.writeText(url).then(() => {
      this.webhookCopied.set(true);
      setTimeout(() => this.webhookCopied.set(false), 2000);
    });
  }

  formatDate(d: Date | string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }


  // ─── Config ───────────────────────────────────────────────────────────────
  saveConfig(): void {
    this.cx.saveConfig({ ...this.configForm });
    this.toast('success', 'Configuration saved to local storage');
  }

  // ─── Endpoint 2: Webhook health check ────────────────────────────────────
  checkWebhook(): void {
    this.loadingWebhookCheck.set(true);
    this.cx.checkWebhookHealth().subscribe({
      next: res => {
        this.webhookStatus.set(res.status === 'OK' ? 'ok' : 'error');
        this.toast('success', 'Webhook is reachable ✓');
        this.loadingWebhookCheck.set(false);
      },
      error: () => {
        this.webhookStatus.set('error');
        this.toast('error', 'Webhook health check failed');
        this.loadingWebhookCheck.set(false);
      }
    });
  }

  // ─── Endpoint 4: Master Sync ──────────────────────────────────────────────
  runMasterSync(): void {
    this.loadingMasterSync.set(true);
    this.masterSyncResult.set(null);
    this.cx.masterSync().subscribe({
      next: res => {
        if (res.success) {
          this.masterSyncResult.set(res.data);
          const ts = new Date().toISOString();
          this.lastMasterSync.set(ts);
          localStorage.setItem('cx-last-master', ts);
          this.cx.addLog({ action: 'Master Sync', success: true, message: res.message, details: res.data });
          this.toast('success', res.message);
          this.setTab('master-sync');
        } else {
          this.toast('error', res.message);
          this.cx.addLog({ action: 'Master Sync', success: false, message: res.message });
        }
        this.loadingMasterSync.set(false);
      },
      error: err => {
        this.toast('error', 'Master sync failed — check console');
        this.cx.addLog({ action: 'Master Sync', success: false, message: err?.message || 'Network error' });
        this.loadingMasterSync.set(false);
      }
    });
  }

  // ─── Endpoint 5: Availability Sync ───────────────────────────────────────
  runAvailabilitySync(): void {
    this.loadingAvailability.set(true);
    this.availabilityResult.set(null);
    this.cx.syncAvailability(this.availForm.startDate, this.availForm.endDate).subscribe({
      next: res => {
        if (res.success) {
          this.availabilityResult.set(res.data);
          const ts = new Date().toISOString();
          this.lastAvailSync.set(ts);
          localStorage.setItem('cx-last-avail', ts);
          this.cx.addLog({ action: 'Availability Sync', success: true, message: res.message, details: res.data });
          this.toast('success', res.message);
        } else {
          this.toast('error', res.message);
        }
        this.loadingAvailability.set(false);
      },
      error: err => {
        this.toast('error', 'Availability sync failed');
        this.loadingAvailability.set(false);
      }
    });
  }

  // ─── Endpoint 6: ARI Push ────────────────────────────────────────────────
  runAriPush(): void {
    this.loadingAriPush.set(true);
    this.cx.pushARI(this.ariForm).subscribe({
      next: res => {
        if ((res as any).success) {
          this.cx.addLog({ action: 'ARI Push', success: true, message: (res as any).message });
          this.toast('success', (res as any).message || 'ARI pushed successfully');
        } else {
          this.toast('error', (res as any).message || 'ARI push failed');
        }
        this.loadingAriPush.set(false);
      },
      error: () => {
        this.toast('error', 'ARI push failed');
        this.loadingAriPush.set(false);
      }
    });
  }

  // ─── Endpoint 7: Pull Feed ────────────────────────────────────────────────
  runPullFeed(): void {
    this.loadingFeed.set(true);
    this.feedResult.set(null);
    this.cx.pullFeed().subscribe({
      next: res => {
        if (res.success) {
          this.feedResult.set(res.data);
          const ts = new Date().toISOString();
          this.lastFeedPull.set(ts);
          localStorage.setItem('cx-last-feed', ts);
          this.cx.addLog({ action: 'Feed Pull', success: true, message: res.message, details: res.data });
          this.toast('success', res.message);
        } else {
          this.toast('error', res.message);
        }
        this.loadingFeed.set(false);
      },
      error: () => {
        this.toast('error', 'Feed pull failed');
        this.loadingFeed.set(false);
      }
    });
  }

  // ─── Endpoint 8: Acknowledge Revision ────────────────────────────────────
  runAckRevision(): void {
    const id = this.ackRevisionId().trim();
    if (!id) { this.toast('error', 'Please enter a revision UUID'); return; }
    this.loadingAck.set(true);
    this.ackResult.set(null);
    this.cx.ackRevision(id).subscribe({
      next: res => {
        if (res.success) {
          this.ackResult.set(res.data);
          this.cx.addLog({ action: 'Acknowledge Revision', success: true, message: res.message });
          this.toast('success', 'Revision acknowledged');
        } else {
          this.toast('error', res.message);
        }
        this.loadingAck.set(false);
      },
      error: () => {
        this.toast('error', 'Acknowledge failed');
        this.loadingAck.set(false);
      }
    });
  }

  // ─── Endpoint 3: Manual Booking Sync ─────────────────────────────────────
  runManualBookingSync(): void {
    this.loadingManualSync.set(true);
    this.manualSyncResult.set(null);
    this.cx.manualBookingSync(this.bookingForm).subscribe({
      next: res => {
        this.manualSyncResult.set(res);
        if (res.success) {
          this.cx.addLog({ action: 'Manual Booking Sync', success: true, message: res.message, details: res.data });
          this.toast('success', res.message);
        } else {
          this.toast('error', res.message);
        }
        this.loadingManualSync.set(false);
      },
      error: () => {
        this.toast('error', 'Manual booking sync failed');
        this.loadingManualSync.set(false);
      }
    });
  }

  // ─── Endpoint 11: Properties ──────────────────────────────────────────────
  loadProperties(silent = false): void {
    this.loadingProperties.set(true);
    this.cx.getProperties().subscribe({
      next: res => {
        this.properties.set(res.data || []);
        if (!silent) this.toast('info', `Loaded ${res.data?.length || 0} properties`);
        this.loadingProperties.set(false);
      },
      error: () => {
        if (!silent) this.toast('error', 'Failed to load properties');
        this.loadingProperties.set(false);
      }
    });
  }

  // ─── Endpoint 12: Room Types ──────────────────────────────────────────────
  loadRoomTypes(silent = false): void {
    this.loadingRoomTypes.set(true);
    this.cx.getRoomTypes(this.cx.config().propertyId).subscribe({
      next: res => {
        this.roomTypes.set(res.data || []);
        if (!silent) this.toast('info', `Loaded ${res.data?.length || 0} room types`);
        this.loadingRoomTypes.set(false);
      },
      error: () => {
        if (!silent) this.toast('error', 'Failed to load room types');
        this.loadingRoomTypes.set(false);
      }
    });
  }

  // ─── Endpoint 13: Rate Plans ──────────────────────────────────────────────
  loadRatePlans(silent = false): void {
    this.loadingRatePlans.set(true);
    if (this.roomTypes().length === 0) {
      this.loadRoomTypes(silent);
    }
    this.cx.getRatePlans(this.cx.config().propertyId).subscribe({
      next: res => {
        this.ratePlans.set(res.data || []);
        if (!silent) this.toast('info', `Loaded ${res.data?.length || 0} rate plans`);
        this.loadingRatePlans.set(false);
      },
      error: () => {
        if (!silent) this.toast('error', 'Failed to load rate plans');
        this.loadingRatePlans.set(false);
      }
    });
  }

  loadAllConfig(silent = false): void {
    this.loadProperties(silent);
    this.loadRoomTypes(silent);
    this.loadRatePlans(silent);
    this.loadChannels(silent);
  }

  // ─── Test Channex Connection API ──────────────────────────────────────────
  testConnection(silent = false): void {
    this.loadingTestConn.set(true);
    this.cx.testConnection().subscribe({
      next: (res) => {
        this.loadingTestConn.set(false);
        if (res && (res.success || res.data)) {
          this.testConnResult.set(res.data);
          if (!silent) this.toast('success', res.message || 'Channex connection test successful!');
          this.cx.addLog({ action: 'Test Connection', success: true, message: res.message || 'Connected to Channex API' });
        } else {
          if (!silent) this.toast('error', res?.message || 'Connection test failed');
          this.cx.addLog({ action: 'Test Connection', success: false, message: res?.message || 'Connection failed' });
        }
      },
      error: (err) => {
        this.loadingTestConn.set(false);
        const msg = err?.error?.message || 'Channex connection test failed. Please check API Key.';
        if (!silent) this.toast('error', msg);
        this.cx.addLog({ action: 'Test Connection', success: false, message: msg });
      }
    });
  }

  // ─── Fetch Property Channels API ──────────────────────────────────────────
  loadChannels(silent = false): void {
    this.loadingChannels.set(true);
    this.cx.getChannels().subscribe({
      next: (res) => {
        this.loadingChannels.set(false);
        let raw: ChannexChannel[] = [];
        if (Array.isArray(res)) {
          raw = res;
        } else if (res && Array.isArray(res.data)) {
          raw = res.data;
        } else if (res && res.data && Array.isArray(res.data.data)) {
          raw = res.data.data;
        }
        this.channels.set(raw);
        if (!silent) this.toast('info', `Loaded ${raw.length} property channels from Channex`);
      },
      error: (err) => {
        this.loadingChannels.set(false);
        if (!silent) this.toast('error', err?.error?.message || 'Failed to fetch property channels');
      }
    });
  }

  // ─── Create Channel API ──────────────────────────────────────────────────
  createChannel(): void {
    if (!this.channelForm.title?.trim()) {
      this.toast('error', 'Channel title is required');
      return;
    }
    this.loadingCreateChannel.set(true);
    this.cx.createChannel(this.channelForm).subscribe({
      next: (res) => {
        this.loadingCreateChannel.set(false);
        const msg = res?.message || 'Channel created in Channex successfully';
        this.toast('success', msg);
        this.cx.addLog({
          action: 'Create Channel',
          success: true,
          message: `${this.channelForm.title} (${this.channelForm.channelCode})`
        });
        this.channelForm.title = '';
        this.loadChannels();
      },
      error: (err) => {
        this.loadingCreateChannel.set(false);
        const msg = err?.error?.message || 'Failed to create channel in Channex';
        this.toast('error', msg);
        this.cx.addLog({ action: 'Create Channel', success: false, message: msg });
      }
    });
  }

  clearLogs(): void { this.cx.clearLogs(); }

  // Helper to extract room_type_id from rate plan
  getRatePlanRoomTypeId(rp: ChannexRatePlan): string {
    return rp.attributes?.room_type_id || rp.relationships?.room_type?.data?.id || '';
  }

  // Helper to get room type name/title for a rate plan or room type ID
  getRoomTypeTitle(target: string | ChannexRatePlan): string {
    if (typeof target === 'string') {
      return this.roomTypes().find(r => r.id === target)?.attributes.title || target;
    }
    const rp = target;
    const roomTypeId = this.getRatePlanRoomTypeId(rp);
    if (roomTypeId) {
      const match = this.roomTypes().find(r => r.id === roomTypeId);
      if (match) return match.attributes.title;
    }
    // Fallback: extract title inside parentheses e.g. "Standard Rate (delux)" => "Delux"
    const titleMatch = rp.attributes?.title?.match(/\(([^)]+)\)/);
    if (titleMatch && titleMatch[1]) {
      const parenthesized = titleMatch[1].trim();
      return parenthesized.charAt(0).toUpperCase() + parenthesized.slice(1);
    }
    return roomTypeId ? roomTypeId.slice(0, 8) + '…' : 'Standard';
  }

  // Safe accessor for manualSyncResult (avoids 'as any' in template)
  get manualSyncData(): { success: boolean; message: string; data?: { confirmationNumber?: string } } | null {
    return this.manualSyncResult() as { success: boolean; message: string; data?: { confirmationNumber?: string } } | null;
  }

  // Safe check for availability summary (avoids > operator in @if)
  get hasSummary(): boolean {
    const r = this.availabilityResult();
    return !!r && !!r.summary && r.summary.length > 0;
  }

  // Toggle API key visibility (avoids arrow fn in template)
  toggleShowApiKey(): void { this.showApiKey.update(v => !v); }
}

