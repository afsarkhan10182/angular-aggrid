import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

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

  constructor(private http: HttpClient, private sessionService: SessionService) {}

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
   * Get Complex BOM data for a specific material
   * @param materialId Material ID or part number
   * @returns Observable of material details in key-value format
   */
  getComplexBOM(materialId: string): Observable<any> {
    let apiUrl = environment.useMockApi
      ? `/api/complexBOM/${materialId}` // Mock endpoint
      : `${environment.serverHostUrl}/api/complexBOM/${materialId}`;

    return this.http.get<any>(apiUrl).pipe(
      map((data) => {
        // Transform API response to key-value pairs if needed
        // If API already returns key-value format, return as-is
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return data;
        }
        // If API returns array, convert to object
        if (Array.isArray(data)) {
          const keyValuePairs: any = {};
          data.forEach((item: any) => {
            if (item.key && item.value !== undefined) {
              keyValuePairs[item.key] = item.value;
            }
          });
          return keyValuePairs;
        }
        return data;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Search materials by query string using Windchill API
   * @param query Search query string
   * @returns Observable of material search results
   */
  searchMaterials(query: string): Observable<any[]> {
    // If using mock API, load directly from material.json
    if (environment.useMockApi) {
      return this.searchMaterialsMock(query);
    }

    // Production: Use real API with CSRF token
    const apiUrl = `${environment.serverHostUrl}/Windchill/servlet/rest/rfa/materials/search`;

    // Build the request body
    const requestBody = {
      typeName: 'com.lcs.wc.material.LCSMaterial',
      parameters: [
        { name: 'fromIndex', value: '1' },
        { name: 'toIndex', value: '100' },
        { name: 'includeSupplier', value: true },
      ],
      attributeParameters: [
        {
          name: 'ptcmaterialName',
          typeId: 'com.lcs.wc.material.LCSMaterial',
          value: query.trim().length > 0 ? `${query.trim()}*` : '*',
        },
      ],
      viewParameters: [{ name: 'material.ptcmaterialName' }, { name: 'material.versionId' }],
    };

    // Get CSRF token from SessionService
    const csrfToken = this.sessionService.getCsrfNonce();

    // Prepare headers
    const headers: any = {
      accept: 'application/json',
      'Content-Type': 'application/json',
    };

    // Add CSRF token if available
    if (csrfToken) {
      headers['CSRF_NONCE'] = csrfToken;
    }

    return this.http.post<any>(apiUrl, requestBody, { headers }).pipe(
      map((response) => {
        // Transform API response to material options
        if (!response || !response.results || !Array.isArray(response.results)) {
          return [];
        }

        return response.results.map((result: any) => {
          const material = result.material || {};
          const supplier = result.supplier || {};

          return {
            // Extract ptcmaterialName from material object
            name: material.ptcmaterialName || '',
            materialName: material.ptcmaterialName || '',
            ptcmaterialName: material.ptcmaterialName || '',
            versionId: material.versionId || '',
            materialMaster: material.materialMaster || '',
            materialVersionId: material.versionId || '',
            // Supplier information
            supplier: supplier.supplierName || supplier.name || '',
            supplierName: supplier.supplierName || supplier.name || '',
            supplierVersionId: supplier.versionId || '',
            // Material-supplier relationship
            materialSupplierVersionId: result['material-supplier']?.versionId || '',
            // Full result object for reference
            fullResult: result,
          };
        });
      }),
      catchError((error) => {
        console.error('Material search API error:', error);
        return of([]);
      })
    );
  }

  /**
   * Mock material search for local development
   * @param query Search query string
   * @returns Observable of mocked material search results
   */
  private searchMaterialsMock(query: string): Observable<any[]> {
    // Load mock data from JSON file
    const mockApiUrl = environment.mockApiEndpoints.material;

    return this.http.get<any>(mockApiUrl).pipe(
      map((mockResponse) => {
        // Filter results based on query (case-insensitive)
        const queryLower = query.trim().toLowerCase();
        let filteredResults = mockResponse.results || [];

        if (queryLower.length > 0 && filteredResults.length > 0) {
          filteredResults = filteredResults.filter((result: any) => {
            const materialName = (result.material?.ptcmaterialName || '').toLowerCase();
            return materialName.includes(queryLower);
          });
        }

        // Transform to match the same format as production API
        return filteredResults.map((result: any) => {
          const material = result.material || {};
          const supplier = result.supplier || {};

          return {
            // Extract ptcmaterialName from material object
            name: material.ptcmaterialName || '',
            materialName: material.ptcmaterialName || '',
            ptcmaterialName: material.ptcmaterialName || '',
            versionId: material.versionId || '',
            materialMaster: material.materialMaster || '',
            materialVersionId: material.versionId || '',
            // Supplier information
            supplier: supplier.supplierName || supplier.name || '',
            supplierName: supplier.supplierName || supplier.name || '',
            supplierVersionId: supplier.versionId || '',
            // Material-supplier relationship
            materialSupplierVersionId: result['material-supplier']?.versionId || '',
            // Full result object for reference
            fullResult: result,
          };
        });
      }),
      catchError((error) => {
        console.warn('Failed to load mock material data:', error);
        // Return empty array if file fails to load
        return of([]);
      })
    );
  }

  /**
   * Get material data by material name/ID from mock2.json
   * Currently uses mock2.json data, later will be replaced with API call
   * @param materialName Material name or ID
   * @returns Observable of material data
   */
  getMaterialFromMock2(materialName: string): Observable<any | null> {
    // For now, load from mock2.json
    // Later: Replace this with API call when backend is ready
    const apiUrl = '/mock2.json';

    return this.http.get<any>(apiUrl).pipe(
      map((data) => {
        if (!data || !data.mbom || !Array.isArray(data.mbom)) {
          return null;
        }

        // Find exact match or closest match
        const material = data.mbom.find(
          (m: any) =>
            (m.material && m.material.toLowerCase() === materialName.toLowerCase()) ||
            (m.part && m.part.toLowerCase() === materialName.toLowerCase())
        );

        return material || null;
      }),
      catchError((error) => {
        return of(null);
      })
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
