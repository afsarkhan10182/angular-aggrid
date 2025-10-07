import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseService } from './base.service';
import { CsrfService } from './csrf.service';

export interface PartData {
  id: string; // UUID for unique row key
  part: string;
  supplier: string;
  color: string;
  feature: string;
  shortDesc: string;
  longDesc: string;
  startDate: string;
  endDate: string;
  qty: number;
  isExpired: boolean;
  isNew: boolean;
  isEdited: boolean;
  version: number;
  lastSaved: string; // ISO timestamp
  hasChanges: boolean;
  copyable: boolean;
  skus: SkuData[];
  SpecSheet?: string; // Only for SBOM view
  SpecSheetExtra?: string; // Only for SBOM view
}

export interface SkuData {
  skuId: string;
  value: string;
  isActive: boolean;
}

export interface SkuInfo {
  sku: string;
  product: string;
  manufacturer: string;
  color: string;
  size: string;
}

export interface ApiData {
  mbom: PartData[];
  productInfo: {
    productId: string;
    productName: string;
    skus: SkuInfo[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class DataService extends BaseService {
  private apiData: ApiData | null = null;

  constructor(http: HttpClient, csrfService: CsrfService) {
    super(http, csrfService);
  }

  loadData(): Observable<ApiData> {
    // Use full URL for production API
    let apiUrl = environment.useMockApi
      ? environment.dataApiPath
      : `${environment.serverHostUrl}${environment.dataApiPath}`;

    // In production, append bomId from JSP data attribute
    if (!environment.useMockApi) {
      const bomElement = document.getElementById('angular-root');
      const bomId = bomElement?.getAttribute('data-bomid');

      if (bomId) {
        apiUrl += `/${bomId}`;
        console.log('Using BOM ID:', bomId);
        console.log('Full API URL:', apiUrl);
      } else {
        console.warn('No BOM ID found in data-bomid attribute');
      }
    }

    return this.http.get<ApiData>(apiUrl).pipe(
      map((data) => {
        this.apiData = data;

        return data;
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      console.error('Error loading data from:', environment.dataApiPath);
      console.error('Full error:', error);
    }

    console.error('DataService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  getApiData(): ApiData | null {
    return this.apiData;
  }

  getSkuInfo(): SkuInfo[] {
    return this.apiData?.productInfo.skus || [];
  }

  getProductInfo() {
    return this.apiData?.productInfo;
  }

  // Transform backend data to grid format with SKU columns
  transformToGridData(parts: PartData[], isSbom: boolean = false): any[] {
    if (!this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    return parts.map((part) => {
      const row: any = {
        // Backend provides all fields directly
        id: part.id,
        part: part.part,
        supplier: part.supplier,
        color: part.color,
        feature: part.feature,
        shortDesc: part.shortDesc,
        longDesc: part.longDesc,
        startDate: part.startDate,
        endDate: part.endDate,
        qty: part.qty,
        isExpired: part.isExpired,
        isNew: part.isNew,
        isEdited: part.isEdited,
        version: part.version,
        lastSaved: part.lastSaved,
        hasChanges: part.hasChanges,
        copyable: part.copyable,
      };

      // Add SBOM-specific fields (only if provided by backend)
      if (isSbom) {
        row.SpecSheet = part.SpecSheet || '';
        row.SpecSheetExtra = part.SpecSheetExtra || '';
      }

      // Add SKU columns based on backend SKU data
      skuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        // Find matching SKU in backend data
        const matchingSku = part.skus.find((s) => s.skuId === sku.sku);
        row[fieldName] = matchingSku ? matchingSku.value : '';
      });

      return row;
    });
  }

  // Generate additional mock data to reach 1000 rows
  generateAdditionalData(
    baseParts: PartData[],
    targetCount: number = 1000,
    isSbom: boolean = false
  ): any[] {
    const additionalData = [];
    const baseSkuInfo = this.getSkuInfo();

    for (let i = baseParts.length; i < targetCount; i++) {
      const partNum = (5289555 + i).toString(); // Keep as string
      const supplierNum = i + 1; // Continue numbering beyond 20
      const colorNum = i + 1; // Continue numbering beyond 20

      // Generate feature based on pattern
      let feature = '';
      const featureIndex = i % 9;
      if (featureIndex < 3) {
        feature = 'Frame';
      } else if (featureIndex === 3) {
        feature = 'FrameHardware1';
      } else if (featureIndex === 4) {
        feature = 'FrameHardware2';
      } else if (featureIndex === 5) {
        feature = 'FrameHardware3';
      } else {
        const complianceNum = featureIndex - 5;
        feature = `Compliance Label${complianceNum}`;
      }

      const hasSkuData = Math.random() > 0.7;
      const dataRow: any = {
        part: partNum,
        supplier: `Supplier ${supplierNum}`,
        color: `Color ${colorNum}`,
        feature: feature,
        shortDesc: `Short description for ${partNum}`,
        longDesc: `Long description for part ${partNum} with feature ${feature}`,
        startDate: '08/18/2024',
        endDate: '08/18/2026',
        qty: Math.floor(Math.random() * 50) + 5,
      };

      // Add SBOM-specific fields
      if (isSbom) {
        // Random values: Y, N, or C for both fields
        const specSheetValues = ['Y', 'N', 'C'];
        dataRow.SpecSheet = specSheetValues[Math.floor(Math.random() * specSheetValues.length)];
        dataRow.SpecSheetExtra =
          specSheetValues[Math.floor(Math.random() * specSheetValues.length)];
      }

      // Add SKU columns for all 20 SKUs
      baseSkuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        // Randomly assign SKU data to some columns
        dataRow[fieldName] = hasSkuData && Math.random() > 0.7 ? partNum : '';
      });

      additionalData.push(dataRow);
    }

    return additionalData;
  }

  // Get SKU metadata for a specific part
  getSkuDataForPart(partRow: any): any[] {
    if (!partRow || !this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    return skuInfo
      .filter((sku) => partRow[`sku${sku.sku}`]) // only keep SKUs that have values
      .map((sku) => ({
        skuNumber: sku.sku,
        product: sku.product,
        manufacturer: sku.manufacturer,
        color: sku.color,
        size: sku.size,
        value: partRow[`sku${sku.sku}`],
        partNumber: partRow.part.toString(),
      }));
  }
}
