import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PartData {
  branchID: string;
  quantity: string;
  bomLinkFeature: string;
  bomLinkSpecSheetExtra: string;
  bomLinkPart: string;
  skus: SkuData[];
  color: string;
  part: string;
  bomLinkEndDate: string;
  section: string;
  partName: string;
  materialDescription: string;
  masterBranchID: string;
  material: string;
  bomLinkStartDate: string;
  supplier: string;
  flexBomLinkID: string;
  linkedBom: string;
  supplierDescription: string;
  bomLinkIncludeInSpecSheet: string;
  sortingNumber: string;
  colorDescription: string;
  materialcolorLongDescription: string;
  materialcolorShortDescription: string;
  materialSupplierComments: string;
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
  columns: { [key: string]: string }; // Dynamic column mapping
  productInfo: {
    productId: string;
    productName: string;
    skus: SkuInfo[];
  };
  bomPartInfo?: {
    bomName: string;
    modifyTimestamp: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiData: ApiData | null = null;

  constructor(private http: HttpClient) {}

  // Common method to get data attributes from JSP
  private getJspDataAttribute(attributeName: string): string | null {
    const angularRoot = document.getElementById('angular-root');
    return angularRoot?.getAttribute(attributeName) || null;
  }

  loadData(): Observable<ApiData> {
    // Use full URL for production API
    let apiUrl = environment.useMockApi
      ? environment.dataApiPath
      : `${environment.serverHostUrl}${environment.dataApiPath}`;

    // In production, append bomId from JSP data attribute
    if (!environment.useMockApi) {
      const bomId = this.getJspDataAttribute('data-bomid');

      if (bomId) {
        apiUrl += `/${bomId}`;
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

  /**
   * Search materials by query string
   * @param query Search query string
   * @returns Observable of material search results
   */
  searchMaterials(query: string): Observable<any[]> {
    // Use Material API endpoint
    let apiUrl = environment.useMockApi
      ? '/api/materials/search' // Mock endpoint
      : `${environment.serverHostUrl}/api/materials/search`;

    // Add query parameter
    const params = new URLSearchParams();
    params.set('q', query);

    return this.http.get<any[]>(`${apiUrl}?${params.toString()}`).pipe(
      map((data) => {
        // Transform API response to material options
        return data.map((material: any) => ({
          id: material.id || material.materialId,
          name: material.name || material.materialName,
          description: material.description || material.materialDescription,
          supplier: material.supplier || material.supplierName,
          color: material.color || material.colorName,
          feature: material.feature || material.featureName,
          startDate: material.startDate,
          endDate: material.endDate,
          qty: material.qty || material.quantity,
          // Add any other fields from your API response
          ...material,
        }));
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
    }

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

  getBomPartInfo() {
    return this.apiData?.bomPartInfo;
  }

  getDynamicColumns(): { [key: string]: string } {
    return this.apiData?.columns || {};
  }

  getColumnMapping(): { [key: string]: string } {
    return this.apiData?.columns || {};
  }

  // Transform backend data to grid format with SKU columns and hierarchical structure
  transformToGridData(parts: PartData[], isSbom: boolean = false): any[] {
    if (!this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    // Sort parts by sortingNumber before mapping
    const sortedParts = [...parts].sort((a, b) => {
      const sortA = parseInt(a.sortingNumber) || 0;
      const sortB = parseInt(b.sortingNumber) || 0;
      return sortA - sortB;
    });

    // Create hierarchical structure
    const hierarchicalData = this.createHierarchicalStructure(sortedParts, skuInfo);

    return hierarchicalData;
  }

  // Create hierarchical structure for parent-child relationships with accordion functionality
  private createHierarchicalStructure(parts: PartData[], skuInfo: any[]): any[] {
    const result: any[] = [];
    const parentMap = new Map<string, any>();

    // First pass: Create all rows and identify parents
    parts.forEach((part) => {
      const row = this.createRowData(part, skuInfo);

      // Check if this is a parent row (has linkedBom: "1")
      if (part.linkedBom === '1') {
        row.isParent = true;
        row.hasChildren = false; // Will be updated if children are found
        row.isExpanded = false; // Accordion starts collapsed
        row.children = [];
        parentMap.set(part.branchID, row);
      } else {
        row.isChild = true;
        row.parentBranchID = this.extractParentBranchID(part.branchID);
        row.isVisible = false; // Children start hidden
      }

      result.push(row);
    });

    // Second pass: Link children to parents
    result.forEach((row) => {
      if (row.isChild && row.parentBranchID) {
        const parent = parentMap.get(row.parentBranchID);
        if (parent) {
          parent.hasChildren = true;
          parent.children.push(row);
          row.parent = parent;
        }
      }
    });

    // Third pass: Create accordion structure (only show parents initially)
    const finalResult: any[] = [];
    result.forEach((row) => {
      if (row.isParent) {
        // Use the parent from parentMap to ensure we have the children
        const parentWithChildren = parentMap.get(row.branchID);
        if (parentWithChildren) {
          finalResult.push(parentWithChildren);
        } else {
          finalResult.push(row);
        }
      } else if (!row.isChild) {
        // Standalone rows (no parent-child relationship)
        finalResult.push(row);
      }
    });

    return finalResult;
  }

  // Extract parent branch ID from child branch ID (e.g., "16-16" -> "16")
  private extractParentBranchID(childBranchID: string): string | null {
    const dashIndex = childBranchID.indexOf('-');
    if (dashIndex > 0) {
      return childBranchID.substring(0, dashIndex);
    }
    return null;
  }

  // Create individual row data
  private createRowData(part: PartData, skuInfo: any[]): any {
    const row: any = {
      // Map all fields from the new backend structure
      branchID: part.branchID,
      quantity: part.quantity,
      bomLinkFeature: part.bomLinkFeature,
      bomLinkSpecSheetExtra: part.bomLinkSpecSheetExtra,
      bomLinkPart: part.bomLinkPart,
      color: part.color,
      part: part.part,
      bomLinkEndDate: part.bomLinkEndDate,
      section: part.section,
      partName: part.partName,
      materialDescription: part.materialDescription,
      masterBranchID: part.masterBranchID,
      material: part.material,
      bomLinkStartDate: part.bomLinkStartDate,
      supplier: part.supplier,
      flexBomLinkID: part.flexBomLinkID,
      linkedBom: part.linkedBom,
      supplierDescription: part.supplierDescription,
      bomLinkIncludeInSpecSheet: part.bomLinkIncludeInSpecSheet,
      sortingNumber: part.sortingNumber,
      colorDescription: part.colorDescription,
      // New fields from mock2.json
      materialcolorLongDescription: part.materialcolorLongDescription,
      materialcolorShortDescription: part.materialcolorShortDescription,
      materialSupplierComments: part.materialSupplierComments,
    };

    // Add SKU columns based on backend SKU data
    skuInfo.forEach((sku) => {
      const fieldName = `sku${sku.sku}`;
      // Find matching SKU in backend data
      const matchingSku = part.skus.find((s) => s.skuId === sku.sku);
      row[fieldName] = matchingSku ? matchingSku.value : '';
    });

    return row;
  }

  // Accordion functionality methods
  toggleAccordion(parentRow: any, gridApi: any): void {
    if (!parentRow.isParent || !parentRow.hasChildren) return;

    parentRow.isExpanded = !parentRow.isExpanded;

    if (parentRow.isExpanded) {
      // Show children
      this.showChildren(parentRow, gridApi);
    } else {
      // Hide children
      this.hideChildren(parentRow, gridApi);
    }
  }

  private showChildren(parentRow: any, gridApi: any): void {
    const allRowData = gridApi
      .getDisplayedRowModel()
      .rootNode.children.map((node: any) => node.data);
    const parentIndex = allRowData.findIndex((row: any) => row.branchID === parentRow.branchID);

    if (parentIndex === -1) return;

    // Insert children after parent
    const newRowData = [...allRowData];
    parentRow.children.forEach((child: any, index: number) => {
      child.isSubRow = true;
      child.isVisible = true;
      newRowData.splice(parentIndex + 1 + index, 0, child);
    });

    gridApi.setGridOption('rowData', newRowData);
  }

  private hideChildren(parentRow: any, gridApi: any): void {
    const allRowData = gridApi
      .getDisplayedRowModel()
      .rootNode.children.map((node: any) => node.data);
    const newRowData = allRowData.filter((row: any) => {
      if (row.isSubRow && row.parent && row.parent.branchID === parentRow.branchID) {
        row.isVisible = false;
        return false; // Remove from display
      }
      return true;
    });

    gridApi.setGridOption('rowData', newRowData);
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

  // Get username from JSP data attribute (passed from FlexPLM session)
  getUserNameFromJsp(): string | null {
    return this.getJspDataAttribute('data-username');
  }
}
