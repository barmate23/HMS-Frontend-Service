import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

interface SuperMarketItem {
  name: string;
  code: string;
  planId: string;
  planDate: string;
  storeName: string;
  storeLine: string;
  issued: number;
  required: number;
  binCapacity: number;
  activeBinQty: number;
  status: 'REPLENISH' | 'NO REPLENISH';
}

@Component({
  selector: 'app-super-market',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './super-market.component.html',
  styleUrls: ['./super-market.component.css']
})
export class SuperMarketComponent {
  readonly items = signal<SuperMarketItem[]>([
    {
      name: 'Aluminium Housing Blank', code: 'RM-AL-1008',
      planId: 'PPE-PLAN-A-0622', planDate: '22 Jun 2026, 09:00 - 17:30',
      storeName: 'Line Store 01', storeLine: 'Line 01',
      issued: 0, required: 180, binCapacity: 240, activeBinQty: 64, status: 'NO REPLENISH'
    },
    {
      name: 'Rubber Seal 42mm', code: 'RM-SE-4582',
      planId: 'PPE-PLAN-A-0622', planDate: '22 Jun 2026, 09:00 - 17:30',
      storeName: 'Line Store 01', storeLine: 'Line 01',
      issued: 0, required: 180, binCapacity: 220, activeBinQty: 28, status: 'REPLENISH'
    },
    {
      name: 'Bracket Forging RH', code: 'RM-BR-2218',
      planId: 'PPE-PLAN-A-0622', planDate: '22 Jun 2026, 10:00 - 18:00',
      storeName: 'Line Store 02', storeLine: 'Line 02',
      issued: 0, required: 120, binCapacity: 180, activeBinQty: 52, status: 'NO REPLENISH'
    },
    {
      name: 'Fastener Kit M8', code: 'RM-FS-7781',
      planId: 'PPE-PLAN-A-0622', planDate: '22 Jun 2026, 08:30 - 16:30',
      storeName: 'Line Store 03', storeLine: 'Line 03',
      issued: 320, required: 320, binCapacity: 400, activeBinQty: 320, status: 'NO REPLENISH'
    }
  ]);
  
  progressWidth(issued: number, required: number): string {
    if (required === 0) return '0%';
    const pct = Math.min((issued / required) * 100, 100);
    return `${pct}%`;
  }
}
