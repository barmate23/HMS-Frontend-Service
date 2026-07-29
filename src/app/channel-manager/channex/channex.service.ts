import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

// ─── Standard HMS Response Envelope ──────────────────────────────────────────
export interface HmsResponse<T> {
  success: boolean;
  message: string;
  data: T;
  logId?: string;
  timestamp?: string;
}

// ─── Channex Config ────────────────────────────────────────────────────────────
export interface ChannexConfig {
  apiKey: string;
  propertyId: string;
  baseUrl: string;
  webhookUrl: string;
}

// ─── Endpoint 4: Master Sync ──────────────────────────────────────────────────
export interface MasterSyncData {
  hmsRoomTypesTotal: number;
  newRoomTypesCreatedInChannex: number;
  newRatePlansCreatedInChannex: number;
  ratesAndAvailabilityPushed: number;
  createdRoomTypeTitles: string[];
  createdRatePlanTitles: string[];
}

// ─── Endpoint 5: Availability Sync ───────────────────────────────────────────
export interface AvailabilitySummaryItem {
  roomType: string;
  totalHmsRooms: number;
  baseRate: number;
}

export interface AvailabilitySyncData {
  roomTypesSynced: number;
  ariUpdatesPushed: number;
  startDate: string;
  endDate: string;
  summary: AvailabilitySummaryItem[];
}

// ─── Endpoint 7: Feed Pull ───────────────────────────────────────────────────
export interface FeedPullData {
  totalFetched: number;
  processedCount: number;
  acknowledgedCount: number;
  bookingReferences: string[];
}

// ─── Endpoint 8: Acknowledge Revision ────────────────────────────────────────
export interface AckRevisionData {
  revisionId: string;
  acknowledged: boolean;
}

// ─── Endpoints 1/3: Webhook Booking Payload ──────────────────────────────────
export interface ChannexBookingPayload {
  booking_unique_id: string;
  status?: string;
  arrival_date?: string;
  departure_date?: string;
  count_of_nights?: number;
  count_of_rooms?: number;
  ota_name?: string;
  notes?: string;
  special_requests?: string;
  gst_percent?: number;
  customer?: {
    name: string;
    surname?: string;
    email?: string;
    phone?: string;
    mobile?: string;
  };
  occupancy?: {
    adults?: number;
    children?: number;
  };
  rooms?: Array<{
    title?: string;
    room_type?: string;
    room_type_name?: string;
    checkin_date?: string;
    checkout_date?: string;
  }>;
}

export interface BookingSyncData {
  reservationId: number;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  totalAmount: number;
  gstAmount: number;
  grandTotal: number;
  guestName: string;
  bookingReference: string;
  businessSource: string;
  marketSegment: string;
  bookings: Array<{
    bookingId: number;
    roomId: number;
    roomNumber: string;
    roomType: string;
    status: string;
  }>;
}

// ─── Endpoints 11/12/13: Channex Entities ────────────────────────────────────
export interface ChannexProperty {
  id: string;
  type: string;
  attributes: {
    title: string;
    currency: string;
    timezone: string;
    email: string;
    phone: string;
    country: string;
    city: string;
  };
}

export interface ChannexRoomType {
  id: string;
  type: string;
  attributes: {
    title: string;
    property_id: string;
    count_of_rooms: number;
    default_occupancy: number;
    occ_adults?: number;
    occ_children?: number;
    occ_infants?: number;
    currency?: string;
  };
}

export interface ChannexRatePlan {
  id: string;
  type: string;
  attributes: {
    title: string;
    property_id: string;
    room_type_id?: string;
    currency: string;
    sell_mode: string;
    options?: Array<{
      occupancy: number;
      is_primary: boolean;
      rate: string;
    }>;
  };
  relationships?: {
    room_type?: {
      data?: {
        id?: string;
        type?: string;
      };
    };
  };
}

export interface ChannexListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; limit: number };
}

// ─── Channel Management & Connection Interfaces ──────────────────────────────
export interface ChannexChannel {
  id: string;
  type: string;
  attributes: {
    title: string;
    channel_code: string;
    is_active: boolean;
    property_id: string;
    group_id?: string;
  };
}

export interface CreateChannelParams {
  channel?: string;
  channelCode: string;
  groupId?: string;
  title: string;
  propertyId: string;
  currency?: string;
  hotelId?: string;
  accessToken?: string;
  sendBookingNotificationEmail?: boolean;
  syncB2bRateType?: boolean;
  syncMybizRateType?: boolean;
  isActive?: boolean;
  apiKey?: string;
}

export interface TestConnectionData {
  connected: boolean;
  status: number;
  channexBaseUrl: string;
  propertyId: string;
  response?: {
    data?: {
      id?: string;
      type?: string;
      attributes?: {
        title?: string;
        currency?: string;
      };
    };
  };
}

// ─── Endpoint 9: Create Room Type ────────────────────────────────────────────
export interface CreateRoomTypeParams {
  title: string;
  countOfRooms?: number;
  capacity?: number;
  propertyId?: string;
  apiKey?: string;
}

// ─── Endpoint 10: Create Rate Plan ───────────────────────────────────────────
export interface CreateRatePlanParams {
  title: string;
  roomTypeId: string;
  rate?: number;
  currency?: string;
  propertyId?: string;
  apiKey?: string;
}

// ─── Endpoint 6: Manual ARI Push ─────────────────────────────────────────────
export interface AriPushParams {
  roomTypeId?: string;
  ratePlanId?: string;
  startDate: string;
  endDate: string;
  availability?: number;
  rate?: number;
  propertyId?: string;
  apiKey?: string;
}

// ─── Webhook Health Check ─────────────────────────────────────────────────────
export interface WebhookHealthData {
  status: string;
  message: string;
  timestamp: number;
}

// ─── Sync Log Entry (local UI state) ─────────────────────────────────────────
export interface ChannexSyncLog {
  id: string;
  action: string;
  timestamp: Date;
  success: boolean;
  message: string;
  details?: unknown;
}

const STORAGE_KEY = 'hms-channex-config';
const LOGS_KEY = 'hms-channex-logs';

@Injectable({ providedIn: 'root' })
export class ChannexService {
  private readonly base = '/api/frontOfficeService/v1';

  config = signal<ChannexConfig>(this.loadConfig());
  syncLogs = signal<ChannexSyncLog[]>(this.loadLogs());

  constructor(private readonly http: HttpClient) {}

  // ─── Config helpers ───────────────────────────────────────────────────────
  private loadConfig(): ChannexConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ChannexConfig;
    } catch { /* ignore */ }
    return {
      apiKey: '',
      propertyId: '3ac4f491-34c0-462e-95fd-acdf20006bdb',
      baseUrl: 'https://staging.channex.io/api/v1',
      webhookUrl: 'http://100.120.107.63:9001/api/frontOfficeService/v1/frontOffice/webhook/channex/booking'
    };
  }

  saveConfig(cfg: ChannexConfig): void {
    this.config.set(cfg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  private loadLogs(): ChannexSyncLog[] {
    try {
      const raw = localStorage.getItem(LOGS_KEY);
      if (raw) return JSON.parse(raw) as ChannexSyncLog[];
    } catch { /* ignore */ }
    return [];
  }

  addLog(log: Omit<ChannexSyncLog, 'id' | 'timestamp'>): ChannexSyncLog {
    const entry: ChannexSyncLog = {
      ...log,
      id: Math.random().toString(36).slice(2, 10).toUpperCase(),
      timestamp: new Date()
    };
    const updated = [entry, ...this.syncLogs()].slice(0, 50); // keep last 50
    this.syncLogs.set(updated);
    try { localStorage.setItem(LOGS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    return entry;
  }

  clearLogs(): void {
    this.syncLogs.set([]);
    localStorage.removeItem(LOGS_KEY);
  }

  private headers(apiKey?: string): HttpHeaders {
    const key = apiKey || this.config().apiKey;
    return key ? new HttpHeaders({ 'user-api-key': key }) : new HttpHeaders();
  }

  private params(obj: Record<string, string | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, v);
    }
    return p;
  }

  // ─── Endpoint 1: Webhook Receiver (POST — called by Channex, exposed for docs) ──
  receiveWebhookBooking(payload: ChannexBookingPayload): Observable<HmsResponse<BookingSyncData>> {
    return this.http.post<HmsResponse<BookingSyncData>>(
      `${this.base}/frontOffice/webhook/channex/booking`,
      payload
    );
  }

  // ─── Endpoint 2: Webhook Health Check ────────────────────────────────────
  checkWebhookHealth(): Observable<WebhookHealthData> {
    return this.http.get<WebhookHealthData>(
      `${this.base}/frontOffice/webhook/channex/booking`
    );
  }

  // ─── Endpoint 3: Manual Booking Sync ─────────────────────────────────────
  manualBookingSync(payload: ChannexBookingPayload): Observable<HmsResponse<BookingSyncData>> {
    return this.http.post<HmsResponse<BookingSyncData>>(
      `${this.base}/frontOffice/webhook/channex/sync`,
      payload
    );
  }

  // ─── Endpoint 4: Master Sync ──────────────────────────────────────────────
  masterSync(propertyId?: string, apiKey?: string): Observable<HmsResponse<MasterSyncData>> {
    const p = this.params({ propertyId, apiKey });
    return this.http.post<HmsResponse<MasterSyncData>>(
      `${this.base}/frontOffice/channex/master/sync`,
      {},
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 5: Availability Sync ───────────────────────────────────────
  syncAvailability(startDate?: string, endDate?: string, apiKey?: string): Observable<HmsResponse<AvailabilitySyncData>> {
    const p = this.params({ startDate, endDate, apiKey });
    return this.http.post<HmsResponse<AvailabilitySyncData>>(
      `${this.base}/frontOffice/channex/availability/sync`,
      {},
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 6: Manual ARI Push ─────────────────────────────────────────
  pushARI(params: AriPushParams): Observable<HmsResponse<unknown>> {
    const p = this.params({
      propertyId: params.propertyId,
      roomTypeId: params.roomTypeId,
      ratePlanId: params.ratePlanId,
      startDate: params.startDate,
      endDate: params.endDate,
      availability: params.availability?.toString(),
      rate: params.rate?.toString()
    });
    return this.http.post<HmsResponse<unknown>>(
      `${this.base}/frontOffice/channex/ari/push`,
      {},
      { headers: this.headers(params.apiKey), params: p }
    );
  }

  // ─── Endpoint 7: Pull Booking Revision Feed ──────────────────────────────
  pullFeed(apiKey?: string): Observable<HmsResponse<FeedPullData>> {
    const p = this.params({ apiKey });
    return this.http.post<HmsResponse<FeedPullData>>(
      `${this.base}/frontOffice/channex/feed/pull`,
      {},
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 8: Acknowledge Revision ────────────────────────────────────
  ackRevision(revisionId: string, apiKey?: string): Observable<HmsResponse<AckRevisionData>> {
    const p = this.params({ apiKey });
    return this.http.post<HmsResponse<AckRevisionData>>(
      `${this.base}/frontOffice/channex/ack/${revisionId}`,
      {},
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 9: Create Room Type ─────────────────────────────────────────
  createRoomType(params: CreateRoomTypeParams): Observable<HmsResponse<unknown>> {
    const p = this.params({
      title: params.title,
      countOfRooms: params.countOfRooms?.toString(),
      capacity: params.capacity?.toString(),
      propertyId: params.propertyId
    });
    return this.http.post<HmsResponse<unknown>>(
      `${this.base}/frontOffice/channex/room-type/create`,
      {},
      { headers: this.headers(params.apiKey), params: p }
    );
  }

  // ─── Endpoint 10: Create Rate Plan ───────────────────────────────────────
  createRatePlan(params: CreateRatePlanParams): Observable<HmsResponse<unknown>> {
    const p = this.params({
      title: params.title,
      roomTypeId: params.roomTypeId,
      rate: params.rate?.toString(),
      currency: params.currency,
      propertyId: params.propertyId
    });
    return this.http.post<HmsResponse<unknown>>(
      `${this.base}/frontOffice/channex/rate-plan/create`,
      {},
      { headers: this.headers(params.apiKey), params: p }
    );
  }

  // ─── Endpoint 11: Get Properties ──────────────────────────────────────────
  getProperties(apiKey?: string): Observable<ChannexListResponse<ChannexProperty>> {
    const p = this.params({ apiKey });
    return this.http.get<ChannexListResponse<ChannexProperty>>(
      `${this.base}/frontOffice/channex/properties`,
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 12: Get Room Types ──────────────────────────────────────────
  getRoomTypes(propertyId?: string, apiKey?: string): Observable<ChannexListResponse<ChannexRoomType>> {
    const p = this.params({ propertyId, apiKey });
    return this.http.get<ChannexListResponse<ChannexRoomType>>(
      `${this.base}/frontOffice/channex/room-types`,
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint 13: Get Rate Plans ──────────────────────────────────────────
  getRatePlans(propertyId?: string, apiKey?: string): Observable<ChannexListResponse<ChannexRatePlan>> {
    const p = this.params({ propertyId, apiKey });
    return this.http.get<ChannexListResponse<ChannexRatePlan>>(
      `${this.base}/frontOffice/channex/rate-plans`,
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint: Create Channel ───────────────────────────────────────────────
  createChannel(params: CreateChannelParams): Observable<HmsResponse<{ data: ChannexChannel }> | any> {
    const p = this.params({ apiKey: params.apiKey });
    return this.http.post<any>(
      '/api/v1/reservations/channex/channel/create',
      {
        title: params.title,
        channelCode: params.channelCode,
        propertyId: params.propertyId || this.config().propertyId,
        groupId: params.groupId,
        isActive: params.isActive ?? true
      },
      { headers: this.headers(params.apiKey), params: p }
    );
  }

  // ─── Endpoint: Fetch Property Channels ──────────────────────────────────────
  getChannels(propertyId?: string, apiKey?: string): Observable<any> {
    const p = this.params({ propertyId: propertyId || this.config().propertyId, apiKey });
    return this.http.get<any>(
      '/api/v1/reservations/channex/channels',
      { headers: this.headers(apiKey), params: p }
    );
  }

  // ─── Endpoint: Test Connection ─────────────────────────────────────────────
  testConnection(propertyId?: string, apiKey?: string): Observable<HmsResponse<TestConnectionData>> {
    const p = this.params({ propertyId: propertyId || this.config().propertyId, apiKey });
    return this.http.get<HmsResponse<TestConnectionData>>(
      '/api/v1/reservations/channex/test-connection',
      { headers: this.headers(apiKey), params: p }
    );
  }
}
