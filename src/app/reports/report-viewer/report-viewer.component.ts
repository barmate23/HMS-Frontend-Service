import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ReportsService, AnalyticalReportData } from '../reports.service';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './report-viewer.component.html',
  styleUrls: ['./report-viewer.component.css']
})
export class ReportViewerComponent implements OnInit {
  reportId = signal<string>('');
  reportData = signal<AnalyticalReportData | null>(null);

  // Filter Bar state
  dateRange = signal<string>('today');
  fromDate = signal<string>('2026-08-01');
  toDate = signal<string>('2026-08-03');
  selectedProperty = signal<string>('all');
  selectedRoomType = signal<string>('all');

  // Cashier Settlement Audit specific filters
  selectedShift = signal<string>('all');
  selectedCashier = signal<string>('all');
  selectedPayMode = signal<string>('all');

  // Guest Manifest specific filter
  selectedManifest = signal<string>('all');

  tableSearch = signal<string>('');

  // Pagination & Sorting state
  sortKey = signal<string>('');
  sortAsc = signal<boolean>(true);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Export Feedback Notification
  notification = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public reportsService: ReportsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('reportId') || 'fo-occupancy-summary';
      this.reportId.set(id);
      this.loadReportData(id);
    });
  }

  getDateRangeValues(): { from?: string; to?: string } {
    const today = new Date();
    const range = this.dateRange();

    if (range === 'today') {
      const d = today.toISOString().split('T')[0];
      return { from: d, to: d };
    }

    if (range === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      return { from: d, to: d };
    }

    if (range === 'week') {
      const w = new Date(today);
      w.setDate(today.getDate() - today.getDay());
      return { from: w.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    }

    if (range === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: m.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    }

    if (range === 'custom') {
      return { from: this.fromDate(), to: this.toDate() };
    }

    return {};
  }

  loadReportData(id: string): void {
    const { from, to } = this.getDateRangeValues();
    this.reportsService.fetchAnalyticalReportData(id, from, to).subscribe(data => {
      this.reportData.set(data);
    });
  }

  onDateFilterChange(val: string): void {
    this.dateRange.set(val);
    if (val !== 'custom') {
      this.loadReportData(this.reportId());
    }
  }

  // Active date range text description
  activeDateRangeText = computed(() => {
    const range = this.dateRange();
    const { from, to } = this.getDateRangeValues();
    if (range === 'today') return `Today (${from || 'Active Date'})`;
    if (range === 'yesterday') return `Yesterday (${from || 'Active Date'})`;
    if (range === 'week') return `This Week (${from} to ${to})`;
    if (range === 'month') return `This Month (${from} to ${to})`;
    if (range === 'custom') {
      return `Custom Range: ${from || 'Start Date'} to ${to || 'End Date'}`;
    }
    return 'Active Date Window';
  });

  applyCustomRange(): void {
    const f = this.fromDate();
    const t = this.toDate();
    if (!f || !t) {
      this.showToast('Please select both From Date and To Date');
      return;
    }
    this.loadReportData(this.reportId());
    this.showToast(`Applied Custom Date Filter: ${f} to ${t}`);
  }

  // Filtered & Sorted Table Rows
  filteredRows = computed(() => {
    const data = this.reportData();
    if (!data) return [];

    let rows = [...data.rows];
    const query = this.tableSearch().toLowerCase().trim();

    // Specific filters for fo-occupancy-summary
    if (this.reportId() === 'fo-occupancy-summary') {
      const roomCatFilter = this.selectedRoomType();
      if (roomCatFilter !== 'all') {
        rows = rows.filter(r => r.roomCategory === roomCatFilter);
      }
    }

    // Specific filters for fo-cashier-settlement
    if (this.reportId() === 'fo-cashier-settlement') {
      const shift = this.selectedShift();
      const cashier = this.selectedCashier();
      const payMode = this.selectedPayMode();

      if (shift !== 'all') {
        rows = rows.filter(r => String(r.time).toLowerCase().includes(shift.toLowerCase()));
      }
      if (cashier !== 'all') {
        rows = rows.filter(r => r.cashier === cashier);
      }
      if (payMode !== 'all') {
        rows = rows.filter(r => r.payMode === payMode);
      }
    }

    // Specific filters for fo-guest-manifest
    if (this.reportId() === 'fo-guest-manifest') {
      const manifest = this.selectedManifest();
      if (manifest !== 'all') {
        rows = rows.filter(r => r.manifestCat === manifest);
      }
    }

    if (query) {
      rows = rows.filter(row =>
        Object.values(row).some(val =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(query)
        )
      );
    }

    const skey = this.sortKey();
    if (skey) {
      const asc = this.sortAsc();
      rows.sort((a, b) => {
        const valA = a[skey];
        const valB = b[skey];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return asc ? valA - valB : valB - valA;
        }
        return asc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  });

  paginatedRows = computed(() => {
    const rows = this.filteredRows();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return rows.slice(start, start + size);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredRows().length / this.pageSize()) || 1;
  });

  toggleSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortAsc.update(v => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  goBack(): void {
    this.router.navigate(['/reports']);
  }

  exportReport(type: 'excel' | 'print'): void {
    const title = this.reportData()?.title || 'Report';
    if (type === 'print') {
      window.print();
      return;
    }

    // Export to Excel (.xls format)
    const data = this.reportData();
    if (!data || !data.rows.length) {
      this.showToast('No data available to export');
      return;
    }

    const headers = data.columns.map(c => c.label).join(',');
    const csvRows = data.rows.map(row =>
      data.columns.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const content = [headers, ...csvRows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast(`Exported ${title} to Excel (.xls) successfully`);
  }

  private showToast(msg: string): void {
    this.notification.set(msg);
    setTimeout(() => this.notification.set(null), 3000);
  }

  getMaxChartVal(): number {
    const chart = this.reportData()?.chartData;
    if (!chart || !chart.datasets.length) return 100;
    const maxVal = Math.max(...chart.datasets.flatMap(d => d.data));
    return maxVal || 100;
  }
}
