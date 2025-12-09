import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

export interface BomLinkSku {
  product: string;
  productId: string;
  color: string;
  destination: string;
  isActive: boolean;
  destinationDimensionId: string;
  manufacturer: string;
  dimensionId: string;
  size1: string;
  colorDimensionId: string;
  sourceDimensionId: string;
  value: string;
  skuId: string;
}

export interface BomLink {
  quantity: string;
  bomLinkFeature: string;
  bomLinkSpecSheetExtra: string;
  skus: BomLinkSku[];
  bomLinkEndDate: string;
  section: string;
  materialDescription: string;
  partSixtyCharacterDescription: string;
  bomLinkStartDate: string;
  sectionInternalName: string;
  supplier: string;
  bomLinkNotes: string;
  partNumber: string;
  materialSupplierComments: string;
  supplierDescription: string;
  bomLinkIncludeInSpecSheet: string;
  colorDescription: string;
  bomLinkCountryOfOrigin: string;
  partThirtyCharacterDescription: string;
  linkedBom?: string;
}

export interface SkuInfo {
  skuId: string; // Changed from 'sku' to match actual API response
  product: string;
  productId?: string;
  manufacturer: string;
  color: string;
  size1: string;
  destination?: string;
  colorDimensionId?: string;
  sourceDimensionId?: string;
  destinationDimensionId?: string;
}

export interface BomPartInfo {
  bomMasterId?: string;
  bomName: string;
  bomOwnerId?: string;
  bomOwner?: string;
  modifyTimestamp: string;
}

export interface BomInstance {
  'bom-link': BomLink;
}

export interface ApiData {
  instances: BomInstance[];
  columns: { [key: string]: string };
  skuInfo: {
    skus: SkuInfo[];
  };
  bomPartInfo?: BomPartInfo | BomPartInfo[];
  sectionOrder?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiData: ApiData | null = null;

  constructor(private http: HttpClient, private sessionService: SessionService) {}

  /**
   * Build HTTP headers with CSRF token
   * Reusable method to avoid duplication
   */
  private buildHttpHeaders(): any {
    const csrfToken = this.sessionService.getCsrfNonce();
    const headers: any = {
      accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (csrfToken) {
      headers['CSRF_NONCE'] = csrfToken;
    }

    return headers;
  }

  // Common method to get data attributes from JSP
  private getJspDataAttribute(attributeName: string): string | null {
    const angularRoot = document.getElementById('angular-root');
    return angularRoot?.getAttribute(attributeName) || null;
  }

  loadData(): Observable<ApiData> {
    let apiUrl = environment.useMockApi
      ? environment.dataApiPath
      : `${this.getServiceHostUrl()}${environment.dataApiPath}`;

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
      ? `/api/complexBOM/${materialId}`
      : `${this.getServiceHostUrl()}/api/complexBOM/${materialId}`;

    return this.http.get<any>(apiUrl).pipe(
      map((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return data;
        }
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
   * Search materials by query string using Windchill API or mock data
   * @param query Search query string
   * @param fromIndex Starting index for pagination (default: 1)
   * @param toIndex Ending index for pagination (default: 20)
   * @param isPartNumberSearch Whether this is a part number search (default: false)
   * @returns Observable of material search results with pagination info
   */
  searchMaterials(
    query: string,
    fromIndex: number = 1,
    toIndex: number = 20,
    isPartNumberSearch: boolean = false
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    let dataSource: Observable<any>;

    if (environment.useMockApi) {
      const mockApiUrl = environment.mockApiEndpoints.material;
      dataSource = this.http.get<any>(mockApiUrl).pipe(
        map((mockResponse) => {
          const queryLower = query.trim().toLowerCase();
          let filteredResults = mockResponse.results || [];

          if (queryLower.length > 0 && filteredResults.length > 0) {
            filteredResults = filteredResults.filter((result: any) => {
              if (isPartNumberSearch) {
                // For part number search, check partNumber
                const partNumber = result['material-color']?.partNumber || '';
                return partNumber.includes(queryLower);
              } else {
                // For material search, check ptcmaterialName
                const materialName = (result.material?.ptcmaterialName || '').toLowerCase();
                return materialName.includes(queryLower);
              }
            });
          }

          // Apply pagination for mock data
          const resultCount = filteredResults.length;
          const paginatedResults = filteredResults.slice(fromIndex - 1, toIndex);
          const hasMore = resultCount > toIndex;

          return {
            results: paginatedResults,
            resultCount,
            hasMore,
          };
        })
      );
    } else {
      // Production: Use real API with CSRF token
      const apiUrl = `${this.getServiceHostUrl()}/Windchill/servlet/rest/rfa/materials/search`;

      const attributeParameters: any[] = [];
      if (isPartNumberSearch) {
        attributeParameters.push({
          name: 'partNumber',
          typeId: 'com.lcs.wc.material.LCSMaterialColor',
          value: query.trim().length > 0 ? `${query.trim()}*` : '*',
        });
      } else {
        attributeParameters.push({
          name: 'ptcmaterialName',
          typeId: 'com.lcs.wc.material.LCSMaterial',
          value: query.trim().length > 0 ? `${query.trim()}*` : '*',
        });
      }

      const requestBody = {
        typeName: 'com.lcs.wc.material.LCSMaterial',
        parameters: [
          { name: 'fromIndex', value: fromIndex.toString() },
          { name: 'toIndex', value: toIndex.toString() },
          { name: 'includeSupplier', value: true },
          { name: 'includeColor', value: true },
        ],
        attributeParameters: attributeParameters,
        viewParameters: [
          { name: 'material.ptcmaterialName' },
          { name: 'material.versionId' },
          { name: 'material-color.partNumber' },
        ],
      };

      dataSource = this.http
        .post<any>(apiUrl, requestBody, { headers: this.buildHttpHeaders() })
        .pipe(
          map((response) => {
            if (!response || !response.results || !Array.isArray(response.results)) {
              return { results: [], resultCount: 0, hasMore: false };
            }

            const resultCount = response.resultCount || 0;
            const hasMore = resultCount > toIndex;

            return {
              results: response.results,
              resultCount,
              hasMore,
            };
          })
        );
    }

    // Common transformation logic for both mock and real API
    return dataSource.pipe(
      map((data) => {
        const results = data.results || [];
        const resultCount = data.resultCount || 0;
        const hasMore = data.hasMore || false;

        const transformedResults = results.map((result: any) => {
          const material = result.material || {};
          const supplier = result.supplier || {};
          const materialColor = result['material-color'] || {};
          const color = result.color || {};

          const supplierName = supplier.supplierName || supplier.name || '';
          const colorName = color.colorName || color.name || '';

          return {
            name: material.ptcmaterialName || '',
            materialName: material.ptcmaterialName || '',
            ptcmaterialName: material.ptcmaterialName || '',
            versionId: material.versionId || '',
            materialMaster: material.materialMaster || '',
            materialVersionId: material.versionId || '',
            supplier: supplierName,
            supplierName: supplierName,
            supplierVersionId: supplier.versionId || '',
            partNumber: materialColor.partNumber || '',
            colorName: colorName,
            color: colorName,
            materialSupplierVersionId: result['material-supplier']?.versionId || '',
            fullResult: result,
          };
        });

        // For material search, show all unique combinations (material + supplier + color)
        // Don't group - each combination is unique
        let finalResults = transformedResults;
        if (!isPartNumberSearch) {
          // Remove duplicates based on unique combination of material + supplier + color
          finalResults = this.getUniqueMaterialCombinations(transformedResults);
        }

        return { results: finalResults, resultCount, hasMore };
      }),
      catchError((error) => {
        const errorMessage = environment.useMockApi
          ? 'Failed to load mock material data'
          : 'Material search API error';
        console.error(errorMessage + ':', error);
        return of({ results: [], resultCount: 0, hasMore: false });
      })
    );
  }

  /**
   * Search BOM features using Windchill API (or mock data when using mock API)
   */
  searchBomFeatures(
    query: string,
    fetchLimit: number = 20
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances(
      'Business Object\\bomFeature',
      'name',
      query,
      fetchLimit,
      'bomLinkFeature'
    );
  }

  /**
   * Search Countries of Origin using Windchill API (shared endpoint)
   */
  searchCountriesOfOrigin(
    query: string,
    fetchLimit: number = 20
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances('Country', 'name', query, fetchLimit, 'bomLinkCountryOfOrigin');
  }

  private searchFlexInstances(
    flexTypeName: string,
    attributeName: string,
    query: string,
    fetchLimit: number,
    mockFieldName: string
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    const searchTerm = (query || '').trim();

    if (environment.useMockApi) {
      const items = this.apiData!.instances;
      const allValues = items
        .map((item: BomInstance) => {
          const bomLink = item['bom-link'];
          const value = bomLink[mockFieldName as keyof BomLink];
          return typeof value === 'string' ? value : '';
        })
        .filter((value: string) => value.length > 0);

      const uniqueValues = Array.from(new Set(allValues));
      const filtered =
        searchTerm.length > 0
          ? uniqueValues.filter((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
          : uniqueValues;

      const resultCount = filtered.length;
      const limited = filtered.slice(0, fetchLimit).map((value, index) => ({
        displayValue: value,
        id: `${mockFieldName}-${index}`,
      }));

      return of({
        results: limited,
        resultCount,
        hasMore: resultCount > fetchLimit,
      });
    }

    const apiUrl = `${this.getServiceHostUrl()}/Windchill/servlet/rest/trek/instances`;
    const requestBody = {
      flexTypeName,
      attributeName,
      attributeValue: searchTerm.length > 0 ? `${searchTerm}*` : '*',
      fetchLimit,
    };

    return this.http.post<any>(apiUrl, requestBody, { headers: this.buildHttpHeaders() }).pipe(
      map((response) => {
        const rows = Array.isArray(response?.rows) ? response.rows : [];
        const totalRows = response?.totalNumberOfRows || rows.length;
        return {
          results: rows,
          resultCount: totalRows,
          hasMore: totalRows > rows.length,
        };
      }),
      catchError((error) => {
        console.error(`${flexTypeName} search API error:`, error);
        return of({ results: [], resultCount: 0, hasMore: false });
      })
    );
  }

  /**
   * Get unique material combinations (material + supplier + color)
   * Each combination is shown as a separate option in the dropdown
   */
  private getUniqueMaterialCombinations(materials: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const item of materials) {
      const materialName = item.ptcmaterialName || item.materialName || item.name || '';
      const supplierName = item.supplier || item.supplierName || '';
      const colorName = item.colorName || item.color || '';

      // Create a unique key for the combination
      const combinationKey = `${materialName}|${supplierName}|${colorName}`;

      // Only add if we haven't seen this combination before
      if (!seen.has(combinationKey) && materialName) {
        seen.add(combinationKey);
        unique.push({
          ...item,
          // Store single values (not arrays) since each entry is a unique combination
          color: colorName,
          colorName: colorName,
          supplier: supplierName,
          supplierName: supplierName,
        });
      }
    }

    return unique;
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

  /**
   * Update BOM data
   * Sends the payload in the same format as mock.json (instances array with bom-link objects)
   */
  updateBomData(payload: { instances: Array<{ 'bom-link': BomLink }> }): Observable<any> {
    let apiUrl = environment.useMockApi
      ? '/api/updateBom'
      : `${this.getServiceHostUrl()}/api/updateBom`;

    return this.http.put<any>(apiUrl, payload, { headers: this.buildHttpHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Update BOM API error:', error);
        return throwError(() => error);
      })
    );
  }

  getSkuInfo(): SkuInfo[] {
    return this.apiData!.skuInfo.skus;
  }

  getProductInfo() {
    const skuInfo = this.apiData?.skuInfo;
    const bomPartInfo = this.apiData?.bomPartInfo;
    const firstSku = skuInfo?.skus?.[0];

    if (!skuInfo || !firstSku) {
      return null;
    }

    const bomOwner = Array.isArray(bomPartInfo) ? bomPartInfo[0]?.bomOwner : bomPartInfo?.bomOwner;

    return {
      productId: firstSku.productId || '',
      productName: bomOwner || firstSku.product || '',
    };
  }

  getBomOwners(): string {
    const bomPartInfo = this.apiData?.bomPartInfo;
    if (!bomPartInfo) {
      return '';
    }

    const bomPartInfoArray = Array.isArray(bomPartInfo) ? bomPartInfo : [bomPartInfo];
    const bomOwners = bomPartInfoArray
      .map((info) => info.bomOwner)
      .filter((owner): owner is string => !!owner);

    return bomOwners.join(', ');
  }

  getBomPartInfo() {
    return this.apiData?.bomPartInfo;
  }

  getColumnMapping(): { [key: string]: string } {
    return this.apiData!.columns;
  }

  // Get SKU metadata for a specific part
  getSkuDataForPart(partRow: any): any[] {
    if (!partRow || !this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    return skuInfo
      .filter((sku) => partRow[`sku${sku.skuId}`]) // only keep SKUs that have values
      .map((sku) => ({
        skuNumber: sku.skuId,
        product: sku.product,
        manufacturer: sku.manufacturer,
        color: sku.color,
        size: sku.size1,
        value: partRow[`sku${sku.skuId}`],
        partNumber: partRow.partNumber.toString(),
      }));
  }

  // Get username from JSP data attribute (passed from FlexPLM session)
  getUserNameFromJsp(): string | null {
    return this.getJspDataAttribute('data-username');
  }

  // Get service host URL from JSP data attribute (passed from Windchill)
  getServiceHostUrl(): string {
    const hostFromJsp = this.getJspDataAttribute('data-host');

    if (!hostFromJsp) {
      return '';
    }

    // If host already includes protocol (http:// or https://), return as-is
    if (hostFromJsp.startsWith('http://') || hostFromJsp.startsWith('https://')) {
      return hostFromJsp;
    }

    // Otherwise, use the current page's protocol (http or https)
    const protocol = window.location.protocol; // Returns "http:" or "https:"
    return `${protocol}//${hostFromJsp}`;
  }
}
