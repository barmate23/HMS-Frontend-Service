import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonMaster, SetupService } from './setup.service';

type ModalMode = 'create' | 'edit';

interface CategoryOption {
  label: string;
  code: string;
  description: string;
}

@Component({
  selector: 'app-master-data-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './master-data-configuration.component.html',
  styleUrls: ['./master-data-configuration.component.css']
})
export class MasterDataConfigurationComponent {
  private readonly setup = inject(SetupService);

  readonly categories = signal<CategoryOption[]>([
    { label: 'Departments', code: 'DEPARTMENT', description: 'Operational departments used across users and workflows.' },
    { label: 'Outlet Types', code: 'OUTLET_TYPE', description: 'Restaurant, cafe, room service and other POS outlet types.' },
    { label: 'Shift Schedules', code: 'SHIFT_SCHEDULE', description: 'Named operating shift windows used by outlets and staff.' },
    { label: 'Table Statuses', code: 'TABLE_STATUS', description: 'Dining table lifecycle values.' },
    { label: 'Table Sections', code: 'TABLE_SECTION', description: 'Dining area sections and zones.' },
    { label: 'Food Categories', code: 'FOOD_CATEGORY', description: 'Primary POS menu categories.' },
    { label: 'Food Subcategories', code: 'FOOD_SUBCATEGORY', description: 'Secondary POS menu grouping.' },
    { label: 'Order Statuses', code: 'ORDER_STATUS', description: 'POS order workflow statuses.' },
    { label: 'Bill Statuses', code: 'BILL_STATUS', description: 'Billing lifecycle statuses.' },
    { label: 'Payment Modes', code: 'PAYMENT_MODE', description: 'Allowed bill settlement methods.' },
    { label: 'Void Reasons', code: 'VOID_REASON', description: 'Standard reasons for voids and reversals.' }
  ]);

  readonly activeCategory = signal('DEPARTMENT');
  readonly records = signal<CommonMaster[]>([]);
  readonly search = signal('');
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly modalMode = signal<ModalMode>('create');
  readonly currentRecord = signal<CommonMaster>(this.emptyRecord('DEPARTMENT'));
  readonly submitted = signal(false);

  readonly activeCategoryMeta = computed(() =>
    this.categories().find(category => category.code === this.activeCategory()) || {
      label: this.activeCategory(),
      code: this.activeCategory(),
      description: 'Custom master data category.'
    }
  );

  readonly filteredRecords = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.records()
      .filter(record => status === 'ALL' || (status === 'ACTIVE' ? record.isActive : !record.isActive))
      .filter(record => !query ||
        record.code.toLowerCase().includes(query) ||
        record.value.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query)
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  });

  readonly activeCount = computed(() => this.records().filter(record => record.isActive).length);
  readonly inactiveCount = computed(() => this.records().filter(record => !record.isActive).length);

  constructor() {
    this.loadRecords();
  }

  selectCategory(code: string): void {
    this.activeCategory.set(code);
    this.search.set('');
    this.statusFilter.set('ALL');
    this.loadRecords();
  }

  loadRecords(): void {
    const category = this.activeCategory();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.setup.getCommonMasters(category).subscribe({
      next: records => {
        this.records.set(records);
        this.isLoading.set(false);
      },
      error: error => {
        console.error('[Setup] Unable to load common masters', error);
        this.records.set([]);
        this.errorMessage.set(error?.error?.message || 'Unable to load master data records.');
        this.isLoading.set(false);
      }
    });
  }

  openCreate(): void {
    this.modalMode.set('create');
    this.currentRecord.set(this.emptyRecord(this.activeCategory()));
    this.submitted.set(false);
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEdit(record: CommonMaster): void {
    this.modalMode.set('edit');
    this.currentRecord.set({ ...record });
    this.submitted.set(false);
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.submitted.set(false);
    document.body.style.overflow = '';
  }

  saveRecord(): void {
    this.submitted.set(true);
    if (!this.isFormValid()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const record = this.normalizedRecord(this.currentRecord());
    const request$ = this.modalMode() === 'edit' && record.id
      ? this.setup.updateCommonMaster(record)
      : this.setup.createCommonMaster(record);

    request$.subscribe({
      next: saved => {
        this.records.update(records => {
          if (this.modalMode() === 'edit') return records.map(item => item.id === saved.id ? saved : item);
          return [saved, ...records];
        });
        this.successMessage.set(this.modalMode() === 'edit' ? 'Master data updated.' : 'Master data created.');
        this.isSaving.set(false);
        this.closeModal();
      },
      error: error => {
        console.error('[Setup] Save common master failed', error);
        this.errorMessage.set(error?.error?.message || 'Unable to save master data.');
        this.isSaving.set(false);
      }
    });
  }

  toggleActive(record: CommonMaster): void {
    this.setup.updateCommonMaster({ ...record, isActive: !record.isActive }).subscribe({
      next: saved => this.records.update(records => records.map(item => item.id === record.id ? saved : item)),
      error: error => this.errorMessage.set(error?.error?.message || 'Unable to update status.')
    });
  }

  deleteRecord(record: CommonMaster): void {
    if (!record.id || !confirm(`Delete "${record.value}" from ${record.category}?`)) return;

    this.setup.deleteCommonMaster(record.id).subscribe({
      next: () => {
        this.records.update(records => records.filter(item => item.id !== record.id));
        this.successMessage.set('Master data deleted.');
      },
      error: error => this.errorMessage.set(error?.error?.message || 'Unable to delete master data.')
    });
  }

  updateCurrent(field: keyof CommonMaster, value: string | boolean): void {
    this.currentRecord.update(record => ({ ...record, [field]: value }));
  }

  fieldError(field: 'category' | 'code' | 'value'): string {
    if (!this.submitted()) return '';
    const record = this.normalizedRecord(this.currentRecord());
    if (field === 'category' && !record.category) return 'Category is required.';
    if (field === 'code' && !record.code) return 'Code is required.';
    if (field === 'value' && !record.value) return 'Value is required.';
    if (field === 'code' && !/^[A-Z0-9_ -]{2,50}$/.test(record.code)) return 'Use 2-50 letters, numbers, spaces, hyphen or underscore.';
    return '';
  }

  private isFormValid(): boolean {
    return !this.fieldError('category') && !this.fieldError('code') && !this.fieldError('value');
  }

  private emptyRecord(category: string): CommonMaster {
    return {
      category,
      code: '',
      value: '',
      description: '',
      isActive: true
    };
  }

  private normalizedRecord(record: CommonMaster): CommonMaster {
    return {
      ...record,
      category: record.category.trim().toUpperCase(),
      code: record.code.trim().toUpperCase(),
      value: record.value.trim(),
      description: record.description.trim()
    };
  }
}
