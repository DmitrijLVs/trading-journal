import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  calculatePnl,
  calculatePnlPercent,
  formatDateTime,
  formatDuration,
} from './data/trade.model';
import { TradesStore } from './trades-store';

@Component({
  selector: 'app-trade-list',
  templateUrl: './trade-list.html',
  styleUrl: './trade-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeList {
  protected readonly store = inject(TradesStore);
  protected readonly pnl = calculatePnl;
  protected readonly pnlPercent = calculatePnlPercent;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatDuration = formatDuration;
  protected readonly Math = Math;
}
