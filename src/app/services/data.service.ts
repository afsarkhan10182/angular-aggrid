import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface PartData {
  part: string;
  supplier: string;
  color: string;
  feature: string;
  startDate: string;
  endDate: string;
  qty: number;
  skus: string[];
}

export interface SkuInfo {
  sku: string;
  product: string;
  manufacturer: string;
  color: string;
  size: string;
}

export interface MockData {
  mbom: PartData[];
  productInfo: {
    productId: string;
    productName: string;
    skus: SkuInfo[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private mockData: MockData | null = null;

  constructor(private http: HttpClient) {}

  loadMockData(): Observable<MockData> {
    return this.http.get<MockData>('/mock.json').pipe(
      map(data => {
        this.mockData = data;
        return data;
      })
    );
  }

  getMockData(): MockData | null {
    return this.mockData;
  }

  getSkuInfo(): SkuInfo[] {
    return this.mockData?.productInfo.skus || [];
  }

  getProductInfo() {
    return this.mockData?.productInfo;
  }

  // Transform mock data to grid format with SKU columns
  transformToGridData(parts: PartData[]): any[] {
    if (!this.mockData) return [];

    const skuInfo = this.getSkuInfo();
    
    return parts.map(part => {
      const row: any = {
        part: parseInt(part.part),
        supplier: part.supplier,
        color: part.color,
        feature: part.feature,
        startDate: part.startDate,
        endDate: part.endDate,
        qty: part.qty
      };

      // Add SKU columns based on available SKUs
      skuInfo.forEach(sku => {
        const fieldName = `sku${sku.sku}`;
        row[fieldName] = part.skus.includes(sku.sku) ? part.part : '';
      });

      return row;
    });
  }

  // Generate additional mock data to reach 1000 rows
  generateAdditionalData(baseParts: PartData[], targetCount: number = 1000): any[] {
    const additionalData = [];
    const baseSkuInfo = this.getSkuInfo();
    
    for (let i = baseParts.length; i < targetCount; i++) {
      const partNum = 5289555 + i;
      const supplierNum = (i % 20) + 1;
      const colorNum = (i % 20) + 1;
      
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
        startDate: '08/18/2024',
        endDate: '08/18/2026',
        qty: Math.floor(Math.random() * 50) + 5
      };
      
      // Add SKU columns for all 20 SKUs
      baseSkuInfo.forEach(sku => {
        const fieldName = `sku${sku.sku}`;
        // Randomly assign SKU data to some columns
        dataRow[fieldName] = hasSkuData && Math.random() > 0.7 ? partNum.toString() : '';
      });
      
      additionalData.push(dataRow);
    }
    
    return additionalData;
  }

  // Get SKU metadata for a specific part
  getSkuDataForPart(partRow: any): any[] {
    if (!partRow || !this.mockData) return [];

    const skuInfo = this.getSkuInfo();
    
    return skuInfo
      .filter(sku => partRow[`sku${sku.sku}`]) // only keep SKUs that have values
      .map(sku => ({
        skuNumber: sku.sku,
        product: sku.product,
        manufacturer: sku.manufacturer,
        color: sku.color,
        size: sku.size,
        value: partRow[`sku${sku.sku}`],
        partNumber: partRow.part
      }));
  }
}
