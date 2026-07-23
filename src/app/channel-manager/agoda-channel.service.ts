import { Injectable, signal } from '@angular/core';

export interface AgodaConfig {
  hotelId: string;
  apiKey: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  isSyncActive: boolean;
  syncIntervalMinutes: number;
  autoApproveBookings: boolean;
  rateMarkupPercent: number;
}

export interface AgodaRoomMapping {
  id: string;
  hmsRoomTypeId: string;
  hmsRoomTypeName: string;
  hmsBaseRate: number;
  agodaRoomTypeId: string; // 64-bit integer string
  agodaRoomTypeName: string;
  agodaRatePlanId: string; // 64-bit integer string
  agodaRatePlanName: string;
  inventoryCount: number;
  stopSell: boolean;
  minStay: number;
  lastSyncedAt: string | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'ERROR';
}

export interface AgodaSyncLog {
  id: string;
  timestamp: string;
  direction: 'OUTBOUND_PUSH' | 'INBOUND_WEBHOOK';
  action: 'SET_ARI' | 'GET_ARI' | 'BOOKING_NOTIF' | 'PRECHECK';
  agodaBookingRef?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  statusCode: number;
  requestPayload: string;
  responsePayload: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgodaChannelService {
  // Global Config
  config = signal<AgodaConfig>({
    hotelId: '1984029',
    apiKey: 'agd_sndbx_key_8830192381',
    environment: 'SANDBOX',
    isSyncActive: true,
    syncIntervalMinutes: 15,
    autoApproveBookings: true,
    rateMarkupPercent: 0
  });

  // Mapped Rooms
  roomMappings = signal<AgodaRoomMapping[]>([
    {
      id: 'map-1',
      hmsRoomTypeId: 'rt-deluxe',
      hmsRoomTypeName: 'Deluxe Suite',
      hmsBaseRate: 4500,
      agodaRoomTypeId: '1029817',
      agodaRoomTypeName: 'Agoda Deluxe King Suite',
      agodaRatePlanId: '5019281',
      agodaRatePlanName: 'Agoda Best Available Rate (BAR)',
      inventoryCount: 8,
      stopSell: false,
      minStay: 1,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 12).toLocaleString(),
      syncStatus: 'SYNCED'
    },
    {
      id: 'map-2',
      hmsRoomTypeId: 'rt-superior',
      hmsRoomTypeName: 'Superior Double Room',
      hmsBaseRate: 3200,
      agodaRoomTypeId: '1029818',
      agodaRoomTypeName: 'Agoda Superior Twin Bed',
      agodaRatePlanId: '5019282',
      agodaRatePlanName: 'Agoda Non-Refundable Promo',
      inventoryCount: 12,
      stopSell: false,
      minStay: 1,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 45).toLocaleString(),
      syncStatus: 'SYNCED'
    },
    {
      id: 'map-3',
      hmsRoomTypeId: 'rt-executive',
      hmsRoomTypeName: 'Executive Ocean View',
      hmsBaseRate: 6500,
      agodaRoomTypeId: '1029819',
      agodaRoomTypeName: 'Agoda Executive Club Room',
      agodaRatePlanId: '5019283',
      agodaRatePlanName: 'Agoda Breakfast Included Package',
      inventoryCount: 4,
      stopSell: false,
      minStay: 2,
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 120).toLocaleString(),
      syncStatus: 'SYNCED'
    }
  ]);

  // Sync Log History
  syncLogs = signal<AgodaSyncLog[]>([
    {
      id: 'log-101',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleString(),
      direction: 'INBOUND_WEBHOOK',
      action: 'BOOKING_NOTIF',
      agodaBookingRef: 'AGD-98172641',
      status: 'SUCCESS',
      statusCode: 200,
      requestPayload: JSON.stringify({
        hotelId: "1984029",
        bookingId: "98172641",
        guestName: "Michael Chang",
        checkIn: "2026-07-25",
        checkOut: "2026-07-27",
        roomTypeId: "1029817",
        amountPaid: 9000,
        currency: "INR",
        status: "CONFIRMED"
      }, null, 2),
      responsePayload: JSON.stringify({
        status: "ACK",
        hmsReservationId: "RES-AGD-20260725-01",
        inventoryDeducted: 1,
        message: "Agoda reservation successfully ingested into HMS Front Office."
      }, null, 2)
    },
    {
      id: 'log-102',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleString(),
      direction: 'OUTBOUND_PUSH',
      action: 'SET_ARI',
      status: 'SUCCESS',
      statusCode: 200,
      requestPayload: JSON.stringify({
        hotelId: "1984029",
        roomTypeId: "1029817",
        ratePlanId: "5019281",
        dateRange: { start: "2026-07-23", end: "2026-08-23" },
        inventory: 8,
        rate: 4500,
        currency: "INR",
        restrictions: { stopSell: false, minStay: 1 }
      }, null, 2),
      responsePayload: JSON.stringify({
        status: "Success",
        itemStatus: [{ date: "2026-07-23", status: "OK" }],
        agodaTxId: "tx_agd_98231048"
      }, null, 2)
    }
  ]);

  saveConfig(newConfig: AgodaConfig) {
    this.config.set({ ...newConfig });
  }

  updateRoomMapping(updated: AgodaRoomMapping) {
    this.roomMappings.update(mappings => 
      mappings.map(m => m.id === updated.id ? { ...updated, lastSyncedAt: new Date().toLocaleString(), syncStatus: 'SYNCED' } : m)
    );
  }

  // Push ARI to Agoda Simulator
  pushAriToAgoda(mappingId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mapping = this.roomMappings().find(m => m.id === mappingId);
        if (!mapping) {
          resolve(false);
          return;
        }

        const effectiveRate = Math.round(mapping.hmsBaseRate * (1 + this.config().rateMarkupPercent / 100));

        const reqPayload = {
          hotelId: this.config().hotelId,
          apiKey: this.config().apiKey.substring(0, 8) + '***',
          action: "SetAriV2",
          propertyId: this.config().hotelId,
          roomTypeId: mapping.agodaRoomTypeId,
          ratePlanId: mapping.agodaRatePlanId,
          dailyRates: [
            {
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
              rate: effectiveRate,
              allotment: mapping.inventoryCount,
              closed: mapping.stopSell,
              minStay: mapping.minStay
            }
          ]
        };

        const resPayload = {
          status: "Success",
          agodaTransactionId: `agd_tx_${Math.floor(Math.random() * 899999 + 100000)}`,
          updatedRecords: 30,
          timestamp: new Date().toISOString()
        };

        // Add Log
        const newLog: AgodaSyncLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          direction: 'OUTBOUND_PUSH',
          action: 'SET_ARI',
          status: 'SUCCESS',
          statusCode: 200,
          requestPayload: JSON.stringify(reqPayload, null, 2),
          responsePayload: JSON.stringify(resPayload, null, 2)
        };

        this.syncLogs.update(logs => [newLog, ...logs]);

        // Update Mapping status
        this.roomMappings.update(mappings =>
          mappings.map(m => m.id === mappingId ? { ...m, lastSyncedAt: new Date().toLocaleString(), syncStatus: 'SYNCED' } : m)
        );

        resolve(true);
      }, 600);
    });
  }

  // Bulk Push All Mappings
  bulkPushAll(): Promise<number> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let count = 0;
        this.roomMappings().forEach(m => {
          this.pushAriToAgoda(m.id);
          count++;
        });
        resolve(count);
      }, 1000);
    });
  }

  // Simulate Inbound Agoda Webhook Booking
  simulateInboundBooking(guestName: string, hmsRoomTypeId: string, checkInDays: number, stayNights: number): Promise<AgodaSyncLog> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mapping = this.roomMappings().find(m => m.hmsRoomTypeId === hmsRoomTypeId) || this.roomMappings()[0];
        const agodaBookingId = `AGD-${Math.floor(Math.random() * 89999999 + 10000000)}`;

        const checkInDate = new Date(Date.now() + checkInDays * 86400000).toISOString().split('T')[0];
        const checkOutDate = new Date(Date.now() + (checkInDays + stayNights) * 86400000).toISOString().split('T')[0];
        const totalAmount = mapping.hmsBaseRate * stayNights;

        const webhookPayload = {
          event: "OTA_ResNotif",
          hotelId: this.config().hotelId,
          booking: {
            bookingId: agodaBookingId,
            status: "CONFIRMED",
            guest: {
              fullName: guestName,
              email: `${guestName.toLowerCase().replace(/\s+/g, '.')}@agoda-guest.com`,
              phone: "+91 98765 43210"
            },
            stayPeriod: {
              checkIn: checkInDate,
              checkOut: checkOutDate,
              nights: stayNights
            },
            roomDetails: {
              agodaRoomTypeId: mapping.agodaRoomTypeId,
              agodaRatePlanId: mapping.agodaRatePlanId,
              roomCount: 1,
              hmsMappedRoomType: mapping.hmsRoomTypeName
            },
            pricing: {
              totalAmount: totalAmount,
              currency: "INR",
              commissionPercent: 15
            }
          }
        };

        // Deduct 1 inventory count
        this.roomMappings.update(mappings =>
          mappings.map(m => m.id === mapping.id ? { ...m, inventoryCount: Math.max(0, m.inventoryCount - 1) } : m)
        );

        const hmsResId = `RES-${agodaBookingId}`;
        const ackResponse = {
          status: "ACK",
          hmsReservationId: hmsResId,
          message: `Booking ${agodaBookingId} successfully created for ${guestName}. Front Office & Gantt chart inventory updated.`
        };

        const newLog: AgodaSyncLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          direction: 'INBOUND_WEBHOOK',
          action: 'BOOKING_NOTIF',
          agodaBookingRef: agodaBookingId,
          status: 'SUCCESS',
          statusCode: 200,
          requestPayload: JSON.stringify(webhookPayload, null, 2),
          responsePayload: JSON.stringify(ackResponse, null, 2)
        };

        this.syncLogs.update(logs => [newLog, ...logs]);
        resolve(newLog);
      }, 700);
    });
  }
}
