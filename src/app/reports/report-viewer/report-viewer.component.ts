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
  selectedProperty = signal<string>('all');
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
      const data = this.reportsService.getAnalyticalReportData(id);
      this.reportData.set(data);
    });
  }

  // Filtered & Sorted Table Rows
  filteredRows = computed(() => {
    const data = this.reportData();
    if (!data) return [];

    let rows = [...data.rows];
    const query = this.tableSearch().toLowerCase().trim();

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

  exportReport(type: 'excel' | 'pdf' | 'csv' | 'print'): void {
    const title = this.reportData()?.title || 'Report';
    this.showToast(`Exporting ${title} as ${type.toUpperCase()}...`);
    if (type === 'print') {
      window.print();
    }
  }

  private showToast(msg: string): void {
    this.notification.set(msg);
    setTimeout(() => this.notification.set(null), 3000);
  }

  // Max value calculation for SVG chart heights
  getMaxChartVal(): number {
    const chart = this.reportData()?.chartData;
    if (!chart || !chart.datasets.length) return 100;
    const maxVal = Math.max(...chart.datasets.flatMap(d => d.data));
    return maxVal || 100;
  }
}
