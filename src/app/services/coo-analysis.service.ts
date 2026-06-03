import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ColDef } from 'ag-grid-community';
import { environment } from '../../environments/environment';
import { ExcelExportColumn, UtilService } from './util.service';

export interface CooAnalysisOption {
  id: string;
  displayValue: string;
}

export type CooAnalysisOptionLike = CooAnalysisOption | string;

export interface CooAnalysisRow {
  [key: string]: unknown;
}

export interface CooAnalysisResponse {
  coo?: string;
  cooList?: CooAnalysisOptionLike[];
  bomRule?: string;
  bomRuleList?: CooAnalysisOptionLike[];
  effectiveDate?: string;
  columns?: Record<string, string>;
  instances?: CooAnalysisRow[];
  skuIds?: string;
  skuID?: string;
  bomType?: string;
}

export interface CooAnalysisFilters {
  bomRule?: string;
  coo?: string;
  asOf?: string;
}

export interface CooAnalysisViewModel {
  rows: CooAnalysisRow[];
  columnDefs: ColDef[];
  bomRuleOptions: CooAnalysisOptionLike[];
  cooOptions: CooAnalysisOptionLike[];
  selectedBomRule: string;
  selectedCoo: string;
  asOfDate: string;
}

export interface CooAnalysisLineExportData {
  rows: CooAnalysisRow[];
  columns: ExcelExportColumn[];
}

@Injectable({
  providedIn: 'root',
})
export class CooAnalysisService {
  constructor(
    private readonly http: HttpClient,
    private readonly utilService: UtilService,
  ) {}

  load(filters?: CooAnalysisFilters): Observable<CooAnalysisViewModel> {
    const urlWithQuery = this.buildUrlWithQuery(this.getSelectedSkuIds(), filters);
    return this.http.get<CooAnalysisResponse>(urlWithQuery).pipe(map((response) => this.toViewModel(response)));
  }

  loadLineDetails(skuId: string, filters?: CooAnalysisFilters): Observable<CooAnalysisLineExportData> {
    const urlWithQuery = this.buildUrlWithQuery(skuId, filters, this.getCooAnalysisExportApiUrl());
    return this.http.get<CooAnalysisResponse>(urlWithQuery).pipe(
      map((response) => ({
        rows: Array.isArray(response.instances) ? response.instances : [],
        columns: this.buildExportColumns(response.columns),
      }))
    );
  }

  getOptionValue(option: CooAnalysisOptionLike): string {
    return typeof option === 'string' ? option : String(option?.id ?? '');
  }

  getOptionLabel(option: CooAnalysisOptionLike): string {
    return typeof option === 'string' ? option : String(option?.displayValue ?? '');
  }

  private buildUrlWithQuery(
    skuIds: string,
    filters?: CooAnalysisFilters,
    apiUrl = this.getCooAnalysisApiUrl()
  ): string {
    const queryParams = new URLSearchParams();
    if (skuIds) {
      queryParams.set('skuID', skuIds);
    }
    if (filters?.bomRule) {
      queryParams.set('bomRule', filters.bomRule);
    }
    if (filters?.coo) {
      queryParams.set('cooAnalysis', filters.coo);
    }
    const effectiveDate = this.formatEffectiveDate(filters?.asOf);
    if (effectiveDate) {
      queryParams.set('effectiveDate', effectiveDate);
    }

    const queryString = queryParams.toString();
    return queryString ? apiUrl + '?' + queryString : apiUrl;
  }

  private getSelectedSkuIds(): string {
    return this.utilService.getJspDataAttribute('data-bomid') || '';
  }

  private getCooAnalysisApiUrl(): string {
    return environment.useMockApi
      ? environment.cooAnalysisApiPath
      : this.utilService.getServiceHostUrl() + environment.cooAnalysisApiPath;
  }

  private getCooAnalysisExportApiUrl(): string {
    return environment.useMockApi
      ? environment.cooAnalysisExportApiPath
      : this.utilService.getServiceHostUrl() + environment.cooAnalysisExportApiPath;
  }

  private toViewModel(response: CooAnalysisResponse): CooAnalysisViewModel {
    return {
      rows: Array.isArray(response.instances) ? response.instances : [],
      columnDefs: this.buildColumnDefs(response.columns),
      bomRuleOptions: Array.isArray(response.bomRuleList) ? response.bomRuleList : [],
      cooOptions: Array.isArray(response.cooList) ? response.cooList : [],
      selectedBomRule: response.bomRule ? String(response.bomRule) : '',
      selectedCoo: response.coo ? String(response.coo) : '',
      asOfDate: response.effectiveDate ? this.toDateInputValue(String(response.effectiveDate)) : '',
    };
  }

  private buildColumnDefs(columns?: Record<string, string>): ColDef[] {
    if (!columns || typeof columns !== 'object') {
      return [];
    }

    return Object.entries(columns).map(([field, headerName]) => {
      const header = String(headerName);
      const isLinesColumn = this.isLinesColumn(field, header);

      return {
        headerName: header,
        field,
        colId: field === 'sku' ? 'cooSku' : field,
        width: this.getColumnWidth(field, header),
        minWidth: this.getColumnWidth(field, header),
        cellClass: isLinesColumn ? 'coo-analysis-link-cell' : undefined,
        context: { isCooAnalysisLinesColumn: isLinesColumn },
      };
    });
  }

  private buildExportColumns(columns?: Record<string, string>): ExcelExportColumn[] {
    if (!columns || typeof columns !== 'object') {
      return [];
    }

    return Object.entries(columns).map(([field, headerName]) => ({
      field,
      headerName: String(headerName),
      width: Math.ceil(this.getColumnWidth(field, String(headerName)) / 10),
    }));
  }


  private isLinesColumn(field: string, headerName: string): boolean {
    const normalizedField = field.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const normalizedHeader = headerName.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return normalizedField === 'lines' || normalizedHeader === 'lines';
  }

  private getColumnWidth(field: string, headerName: string): number {
    const contentLength = Math.max(field.length, headerName.length);
    return Math.min(Math.max(contentLength * 12 + 36, 90), 320);
  }

  private formatEffectiveDate(value?: string): string {
    if (!value) {
      return '';
    }

    const inputDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (inputDateMatch) {
      return inputDateMatch[2] + '/' + inputDateMatch[3] + '/' + inputDateMatch[1];
    }

    return value;
  }

  private toDateInputValue(value: string): string {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return value;
    }

    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    return match[3] + '-' + month + '-' + day;
  }

}
