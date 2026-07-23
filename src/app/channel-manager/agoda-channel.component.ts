import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgodaChannelService, AgodaRoomMapping, AgodaSyncLog } from './agoda-channel.service';

@Component({
  selector: 'app-agoda-channel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './agoda-channel.component.html',
  styleUrls: ['./agoda-channel.component.css']
})
export class AgodaChannelComponent {
  agodaService = inject(AgodaChannelService);

  activeTab = signal<'mappings' | 'simulator' | 'config' | 'logs'>('mappings');
  isPushing = signal(false);
  isSimulatingBooking = signal(false);
  selectedLog = signal<AgodaSyncLog | null>(null);

  // Edit Mapping Modal State
  editingMapping = signal<AgodaRoomMapping | null>(null);

  // Inbound Booking Form State
  bookingForm = {
    guestName: 'Sarah Jenkins',
    hmsRoomTypeId: 'rt-deluxe',
    checkInDays: 2,
    stayNights: 3
  };

  openEditMapping(mapping: AgodaRoomMapping) {
    this.editingMapping.set({ ...mapping });
  }

  closeEditMapping() {
    this.editingMapping.set(null);
  }

  saveMapping() {
    const item = this.editingMapping();
    if (item) {
      this.agodaService.updateRoomMapping(item);
      this.closeEditMapping();
    }
  }

  async triggerPush(mappingId: string) {
    this.isPushing.set(true);
    await this.agodaService.pushAriToAgoda(mappingId);
    this.isPushing.set(false);
  }

  async triggerBulkPush() {
    this.isPushing.set(true);
    await this.agodaService.bulkPushAll();
    this.isPushing.set(false);
  }

  async triggerSimulatedBooking() {
    this.isSimulatingBooking.set(true);
    const log = await this.agodaService.simulateInboundBooking(
      this.bookingForm.guestName,
      this.bookingForm.hmsRoomTypeId,
      this.bookingForm.checkInDays,
      this.bookingForm.stayNights
    );
    this.isSimulatingBooking.set(false);
    this.selectedLog.set(log);
  }

  inspectLog(log: AgodaSyncLog) {
    this.selectedLog.set(log);
  }

  closeLogModal() {
    this.selectedLog.set(null);
  }

  toggleSyncActive() {
    const cfg = this.agodaService.config();
    this.agodaService.saveConfig({ ...cfg, isSyncActive: !cfg.isSyncActive });
  }
}
