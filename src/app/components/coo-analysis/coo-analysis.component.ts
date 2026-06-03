import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import {
  CooAnalysisOptionLike,
  CooAnalysisRow,
  CooAnalysisService,
} from '../../services/coo-analysis.service';
import { MSG_EXPORT_EXCEL_ERROR, MSG_EXPORT_EXCEL_SUCCESS } from '../../constants';
import { UtilService } from '../../services/util.service';

@Component({
  selector: 'app-coo-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './coo-analysis.component.html',
  styleUrls: ['./coo-analysis.component.css'],
})
export class CooAnalysisComponent implements OnInit, OnDestroy {
  @Input() isModal = false;
  @Output() loadFailed = new EventEmitter<unknown>();

  public isLoading = false;
  public isExporting = false;
  public exportMessage = '';
  public exportMessageType: 'info' | 'success' | 'error' = 'info';
  public rows: CooAnalysisRow[] = [];
  public columnDefs: ColDef[] = [];
  public bomRuleOptions: CooAnalysisOptionLike[] = [];
  public cooOptions: CooAnalysisOptionLike[] = [];
  public selectedBomRule = '';
  public selectedCoo = '';
  public asOfDate = '';
  public readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: false,
    suppressMovable: true,
  };
  public readonly gridContext = {
    onCooLinesClick: (row: CooAnalysisRow) => this.downloadLinesExcel(row),
  };

  private readonly subscriptions = new Subscription();
  private exportMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private exportPreparingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly cooAnalysisService: CooAnalysisService,
    private readonly utilService: UtilService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load(false);
  }

  ngOnDestroy(): void {
    this.clearExportPreparingTimeout();
    this.clearExportMessageTimeout();
    this.subscriptions.unsubscribe();
  }

  onFilterChange(): void {
    this.clearExportMessage();
    this.load(true);
  }

  openDatePicker(event: Event): void {
    const input = event.target as HTMLInputElement & { showPicker?: () => void };
    input.showPicker?.();
  }

  private load(useFilters: boolean): void {
    this.isLoading = true;
    const filters = useFilters
      ? {
          bomRule: this.selectedBomRule,
          coo: this.selectedCoo,
          asOf: this.asOfDate,
        }
      : undefined;

    const sub = this.cooAnalysisService.load(filters).subscribe({
      next: (viewModel) => {
        this.rows = viewModel.rows;
        this.columnDefs = this.withLinesDownloadRenderer(viewModel.columnDefs);
        this.bomRuleOptions = viewModel.bomRuleOptions;
        this.cooOptions = viewModel.cooOptions;
        this.selectedBomRule = viewModel.selectedBomRule;
        this.selectedCoo = viewModel.selectedCoo;
        this.asOfDate = viewModel.asOfDate;
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.loadFailed.emit(error);
      },
    });
    this.subscriptions.add(sub);
  }

  private withLinesDownloadRenderer(columnDefs: ColDef[]): ColDef[] {
    return columnDefs.map((columnDef) => {
      if (!this.isLinesColumn(columnDef)) {
        return columnDef;
      }

      return {
        ...columnDef,
        cellRenderer: this.renderLinesDownloadCell,
      };
    });
  }

  private isLinesColumn(columnDef: ColDef): boolean {
    return Boolean((columnDef.context as { isCooAnalysisLinesColumn?: boolean } | undefined)?.isCooAnalysisLinesColumn);
  }

  private renderLinesDownloadCell(params: ICellRendererParams): HTMLElement | string {
    const value = params.valueFormatted ?? params.value;
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'coo-analysis-lines-link';
    button.textContent = String(value);
    button.title = 'Download lines Excel';
    button.addEventListener('click', () => {
      params.context?.onCooLinesClick?.(params.data);
    });

    return button;
  }

  private downloadLinesExcel(row: CooAnalysisRow): void {
    if (this.isExporting) {
      return;
    }

    const skuId = this.getRowSkuId(row);
    if (!skuId) {
      this.setExportMessage('Unable to download Excel: SKU is missing.', 'error');
      return;
    }

    this.isExporting = true;
    this.clearExportMessage();
    this.schedulePreparingMessage();
    const sub = this.cooAnalysisService.loadLineDetails(skuId, this.getSelectedFilters()).subscribe({
      next: (exportData) => {
        this.utilService
          .exportRowsToExcel({
            rows: exportData.rows,
            columns: exportData.columns,
            fileName: this.getLinesExportFileName(this.getRowSku(row)),
            sheetName: 'COO Lines',
          })
          .then(() => {
            this.isExporting = false;
            this.clearExportPreparingTimeout();
            this.setExportMessage(MSG_EXPORT_EXCEL_SUCCESS, 'success');
          })
          .catch((error) => {
            this.isExporting = false;
            this.clearExportPreparingTimeout();
            this.setExportMessage(MSG_EXPORT_EXCEL_ERROR, 'error');
          });
      },
      error: (error) => {
        this.isExporting = false;
        this.clearExportPreparingTimeout();
        this.setExportMessage(MSG_EXPORT_EXCEL_ERROR, 'error');
      },
    });
    this.subscriptions.add(sub);
  }

  clearExportMessage(): void {
    this.exportMessage = '';
    this.clearExportPreparingTimeout();
    this.clearExportMessageTimeout();
  }

  private schedulePreparingMessage(): void {
    this.clearExportPreparingTimeout();
    this.exportPreparingTimeoutId = setTimeout(() => {
      if (this.isExporting) {
        this.setExportMessage('Preparing Excel download...', 'info', false);
      }
      this.exportPreparingTimeoutId = null;
    }, 500);
  }

  private setExportMessage(message: string, type: 'info' | 'success' | 'error', autoDismiss = true): void {
    this.clearExportMessageTimeout();
    this.exportMessage = message;
    this.exportMessageType = type;

    if (!autoDismiss) {
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.exportMessageTimeoutId = setTimeout(() => {
      this.exportMessage = '';
      this.exportMessageType = 'info';
      this.exportMessageTimeoutId = null;
      this.changeDetectorRef.detectChanges();
    }, 5000);
  }

  private clearExportMessageTimeout(): void {
    if (this.exportMessageTimeoutId) {
      clearTimeout(this.exportMessageTimeoutId);
      this.exportMessageTimeoutId = null;
    }
  }

  private clearExportPreparingTimeout(): void {
    if (this.exportPreparingTimeoutId) {
      clearTimeout(this.exportPreparingTimeoutId);
      this.exportPreparingTimeoutId = null;
    }
  }

  private getSelectedFilters(): { bomRule: string; coo: string; asOf: string } {
    return {
      bomRule: this.selectedBomRule,
      coo: this.selectedCoo,
      asOf: this.asOfDate,
    };
  }

  private getRowSkuId(row: CooAnalysisRow): string {
    const sku = row?.['skuId'] ?? row?.['skuID'] ?? row?.['sku'];
    return sku === null || sku === undefined ? '' : String(sku);
  }

  private getRowSku(row: CooAnalysisRow): string {
    const sku = row?.['sku'];
    return sku === null || sku === undefined ? '' : String(sku);
  }

  private getLinesExportFileName(sku: string): string {
    const safeSku = sku.replace(/[^a-zA-Z0-9_-]/g, '_');
    return 'COO_Analysis_' + safeSku + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
  }
}
