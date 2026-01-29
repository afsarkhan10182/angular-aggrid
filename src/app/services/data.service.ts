import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import { UtilService } from './util.service';

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
  bomId?: string;
  bomName?: string;
}

export interface BomLink {
  quantity: string | number; // Can be string (from API) or number (float, when sending)
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
  ptcbomPartMarkUp?: string; // MBOM markup type (e.g., 'enumMBOM001')
}

export interface SkuInfo {
  skuId: string; // Changed from 'sku' to match actual API response
  product: string;
  productId?: string;
  material?: string; // Material field for EBOM and MATERIALMBOM
  manufacturer: string;
  color: string;
  size1: string;
  destination?: string;
  colorDimensionId?: string;
  sourceDimensionId?: string;
  destinationDimensionId?: string;
  bomId?: string;
  bomName?: string;
  isHDSource?: boolean;
  isEditable?: boolean;
  isReleased?: boolean;
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
  skuInfo: SkuInfo[];
  bomPartInfo?: BomPartInfo | BomPartInfo[];
  sectionOrder?: string[];
  sectionDetails?: { [key: string]: string }; // Maps internal section ID to display name (e.g., "enumSection001": "Fuselage")
  bomType?: string;
  skuIds?: string; // Version IDs from API response (e.g., "VR:com.lcs.wc.foundation.LCSRevisableEntity:574978")
}

export type MbomSkuFilterOption = 'all' | 'hdEditable' | 'hdViewOnly' | 'nonHdSource';
export type SbomSkuFilterOption = 'all' | 'editableSkus';
export type SkuFilterOption = MbomSkuFilterOption | SbomSkuFilterOption;

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiData: ApiData | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService,
    private readonly utilService: UtilService,
  ) {}

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

  loadData(): Observable<ApiData> {
    let apiUrl = environment.useMockApi
      ? environment.dataApiPath
      : `${this.getServiceHostUrl()}${environment.dataApiPath}`;

    if (!environment.useMockApi) {
      const bomId = this.utilService.getJspDataAttribute('data-bomid');
      const bomType = this.utilService.getJspDataAttribute('data-bomtype');

      if (bomId) {
        apiUrl += `/${bomId}`;
      }
      if (bomType) {
        apiUrl += `?bomType=${bomType}`;
      }
    }

    return this.http.get<ApiData>(apiUrl).pipe(
      map((data) => {
        this.apiData = data;
        return data;
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Get Complex BOM data for a specific material
   * @param materialId Material ID or part number
   * @returns Observable of material details in key-value format
   */
  getComplexBOM(materialId: string): Observable<any> {
    const apiUrl = environment.useMockApi
      ? `/api/materialmodal.json`
      : `${this.getServiceHostUrl()}/Windchill/servlet/rest/trek/getMaterialBOM?materialMasterId=${materialId}`;

    return this.http.get<any>(apiUrl).pipe(
      map((data) => {
        if (data?.instances && Array.isArray(data.instances)) {
          return data;
        }

        throw new Error('Invalid API response format: expected instances/columns structure');
      }),
      catchError(this.handleError),
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
    isPartNumberSearch: boolean = false,
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
                const partNumber = result['material-color']?.partNumber || '';
                return partNumber.includes(queryLower);
              } else {
                const materialName = (result.material?.ptcmaterialName || '').toLowerCase();
                return materialName.includes(queryLower);
              }
            });
          }

          const resultCount = filteredResults.length;
          const paginatedResults = filteredResults.slice(fromIndex - 1, toIndex);
          const hasMore = resultCount > toIndex;

          return {
            results: paginatedResults,
            resultCount,
            hasMore,
          };
        }),
      );
    } else {
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
            if (!response?.results || !Array.isArray(response.results)) {
              return { results: [], resultCount: 0, hasMore: false };
            }

            const resultCount = response.resultCount || 0;
            const hasMore = resultCount > toIndex;

            return {
              results: response.results,
              resultCount,
              hasMore,
            };
          }),
        );
    }

    return dataSource.pipe(
      map((data) => {
        const results = data.results || [];
        const resultCount = data.resultCount || 0;
        const hasMore = data.hasMore || false;

        const transformedResults = results.map((result: any) => {
          return this.transformMaterialResult(result);
        });

        let finalResults = transformedResults;
        if (!isPartNumberSearch) {
          finalResults = this.getUniqueMaterialCombinations(transformedResults);
        }

        return { results: finalResults, resultCount, hasMore };
      }),
      catchError((error) => {
        return of({ results: [], resultCount: 0, hasMore: false });
      }),
    );
  }

  /**
   * Search BOM features using Windchill API (or mock data when using mock API)
   */
  searchBomFeatures(
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances(
      String.raw`Business Object\bomFeature`,
      'name',
      query,
      fetchLimit,
      'bomLinkFeature',
    );
  }

  /**
   * Search Countries of Origin using Windchill API (shared endpoint)
   */
  searchCountriesOfOrigin(
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances('Country', 'name', query, fetchLimit, 'bomLinkCountryOfOrigin');
  }

  /**
   * Search Parts/Services using Windchill API
   */
  searchServices(
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances(
      String.raw`Revisable Entity\sku\sKUTrekBicycleCorp\parts`,
      'name',
      query,
      fetchLimit,
      'partNumber',
    );
  }

  private searchFlexInstances(
    flexTypeName: string,
    attributeName: string,
    query: string,
    fetchLimit: number,
    mockFieldName: string,
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
      catchError(() => {
        return of({ results: [], resultCount: 0, hasMore: false });
      }),
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

      const combinationKey = `${materialName}|${supplierName}|${colorName}`;

      if (!seen.has(combinationKey) && materialName) {
        seen.add(combinationKey);
        unique.push({
          ...item,
          color: colorName,
          colorName: colorName,
          supplier: supplierName,
          supplierName: supplierName,
        });
      }
    }

    return unique;
  }

  private transformMaterialResult(result: any): any {
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
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  /**
   * Extract error message from error object
   */
  private extractBackendMessage(error: any): string | null {
    if (!error?.error) return null;

    if (typeof error.error === 'string') {
      try {
        const parsed = JSON.parse(error.error);
        return parsed.error || parsed.message || error.error;
      } catch {
        return error.error;
      }
    }

    if (typeof error.error === 'object') {
      return error.error.error || error.error.message || null;
    }

    return null;
  }

  /**
   * Extract message from error.message if it's not a generic HTTP error
   */
  private extractErrorMessage(error: any): string | null {
    if (!error?.message || typeof error.message !== 'string') return null;

    const genericPatterns = ['Http failure response', 'Server Error:'];
    if (genericPatterns.some((pattern) => error.message.includes(pattern))) {
      return null;
    }

    return error.message;
  }

  getLoadErrorMessage(error: any): string {
    const fallback = 'Failed to load BOM data. Please try again.';
    if (!error) return fallback;

    const status = error.status;
    const backendMessage = this.extractBackendMessage(error) || this.extractErrorMessage(error);

    if (status === 500) {
      return backendMessage
        ? `Failed to load BOM data: ${backendMessage}`
        : 'Failed to load BOM data: Server error (500).';
    }

    if (backendMessage) {
      return `Failed to load BOM data: ${backendMessage}`;
    }

    if (status) {
      return `Failed to load BOM data: Server error (${status}).`;
    }

    return fallback;
  }

  getApiData(): ApiData | null {
    return this.apiData;
  }

  /**
   * Update apiData with new response data after save
   * This ensures validation and SKU matching use the latest data including newly saved rows
   */
  updateApiData(responseData: ApiData): void {
    if (responseData) {
      this.apiData = {
        ...responseData,
        sectionDetails: responseData.sectionDetails || this.apiData?.sectionDetails || {},
      };
    }
  }

  /**
   * Update BOM data
   * Sends the payload with bomCheckIn, bomType, bomPartInfo, instances, columns, sectionOrder, skuInfo
   */
  updateBomData(payload: any): Observable<any> {
    let apiUrl = environment.useMockApi
      ? '/api/updateBom'
      : `${this.getServiceHostUrl()}/Windchill/servlet/rest/trek/saveBOMLinks`;

    return this.http.put<any>(apiUrl, payload, { headers: this.buildHttpHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      }),
    );
  }

  /**
   * Search/Fetch Material Colors by IDs
   * GET: /Windchill/servlet/rest/trek/searchMaterialColors/{materialColorIds}
   * @param materialColorIds - Comma-separated list of material color IDs (e.g., "OR:com.lcs.wc.material.LCSMaterialColor:554762,OR:com.lcs.wc.material.LCSMaterialColor:243946")
   */
  searchMaterialColors(materialColorIds: string): Observable<any> {
    if (environment.useMockApi) {
      // Mock response for development
      return this.http.get<any>('/api/serviceDataModal.json', { headers: this.buildHttpHeaders() });
    }

    const apiUrl = `${this.getServiceHostUrl()}/Windchill/servlet/rest/trek/searchMaterialColors/${encodeURIComponent(materialColorIds)}`;

    return this.http.get<any>(apiUrl, { headers: this.buildHttpHeaders() });
  }

  /**
   * Save Material Colors
   * PUT: /Windchill/servlet/rest/trek/saveMaterialColors
   * @param payload - Object with instances containing material color updates
   */
  saveMaterialColors(payload: { instances: { [key: string]: any } }): Observable<any> {
    if (environment.useMockApi) {
      return of({ success: true, message: 'Material colors saved (mock)' });
    }

    const apiUrl = `${this.getServiceHostUrl()}/Windchill/servlet/rest/trek/saveMaterialColors`;
    
    return this.http.put<any>(apiUrl, payload, { headers: this.buildHttpHeaders() }).pipe(
      map((response) => {
        return response || { success: true };
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      }),
    );
  }

  getSkuInfo(): SkuInfo[] {
    const info = this.apiData?.skuInfo;
    return Array.isArray(info) ? info : [];
  }

  getBomTypeFromResponse(): string | null {
    return this.apiData?.bomType || null;
  }

  getProductInfo() {
    const skuInfo = this.apiData?.skuInfo;
    const bomPartInfo = this.apiData?.bomPartInfo;
    const firstSku = Array.isArray(skuInfo) ? skuInfo[0] : null;

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

  getSkuDataForPart(partRow: any): any[] {
    if (!partRow || !this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    return skuInfo
      .filter((sku) => partRow[`sku${sku.skuId}`])
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

  getUserNameFromJsp(): string | null {
    return this.utilService.getJspDataAttribute('data-username');
  }

  getBomType(): string | null {
    return this.utilService.getJspDataAttribute('data-bomtype') || 'MBOM';
  }

  getRefSkuId(): string | null {
    return this.utilService.getJspDataAttribute('data-refskuid');
  }

  getServiceHostUrl(): string {
    const hostFromJsp = this.utilService.getJspDataAttribute('data-host');

    if (!hostFromJsp) {
      return '';
    }

    if (hostFromJsp.startsWith('http://') || hostFromJsp.startsWith('https://')) {
      return hostFromJsp;
    }

    const protocol = globalThis.location.protocol;
    return `${protocol}//${hostFromJsp}`;
  }
  /**
   * Fetch bomLinkIncludeInSpecSheet constraints from API/Mock
   */
  fetchIncludeInSpecSheetConstraints(): Observable<any> {
    const url = environment.useMockApi
      ? 'api/IncludeInSpecSheet.json'
      : `${this.getServiceHostUrl()}/Windchill/servlet/rest/tm/types/com.lcs.wc.flexbom.FlexBOMLink/attributes/bomLinkIncludeInSpecSheet`;

    return this.http.get<any>(url).pipe(
      catchError(() => {
        return of({});
      }),
    );
  }

  /**
   * Parse the IncludeInSpecSheet options from the constraint data
   * Returns an array of display names sorted by sort_order
   */
  getIncludeInSpecSheetOptions(constraints: any): string[] {
    if (!constraints?.constraints) return [];

    const constraintWithMembers = constraints.constraints.find(
      (c: any) => c.ruleData?.enumerationDefinition?.members,
    );

    if (!constraintWithMembers) return [];

    const members = constraintWithMembers.ruleData.enumerationDefinition.members;

    const sortedMembers = members
      .filter((m: any) => m.entry?.properties?.selectable === true)
      .sort((a: any, b: any) => a.properties.sort_order - b.properties.sort_order);

    return sortedMembers.map((m: any) => m.entry.properties.displayName);
  }

  /**
   * Get the mapping from Display Name (Y, N, C) to Internal Key (enum...)
   * Used for payload construction
   */
  getIncludeInSpecSheetMapping(constraints: any): { [key: string]: string } {
    if (!constraints?.constraints) return {};

    const constraintWithMembers = constraints.constraints.find(
      (c: any) => c.ruleData?.enumerationDefinition?.members,
    );

    if (!constraintWithMembers) return {};

    const members = constraintWithMembers.ruleData.enumerationDefinition.members;
    const mapping: { [key: string]: string } = {};

    members.forEach((m: any) => {
      const displayName = m.entry.properties.displayName;
      const internalName = m.entry.name;
      mapping[displayName] = internalName;
    });

    return mapping;
  }

  getMbomSkuFilterOptions(): Array<{
    label: string;
    value: MbomSkuFilterOption;
  }> {
    return [
      { label: 'ALL - View only', value: 'all' },
      { label: 'HD source - Editable', value: 'hdEditable' },
      { label: 'HD source - View only', value: 'hdViewOnly' },
      { label: 'Non HD source - View only', value: 'nonHdSource' },
    ];
  }

  getSbomSkuFilterOptions(): Array<{ label: string; value: SbomSkuFilterOption }> {
    return [
      { label: 'ALL - View only', value: 'all' },
      { label: 'Editable SKUs', value: 'editableSkus' },
    ];
  }

  getFilteredSkuInfo(
    selectedFilter: SkuFilterOption,
    isMbomMode: () => boolean,
  ): any[] {
    const skuInfo = this.getSkuInfo();

    if (isMbomMode()) {
      return this.filterSkuInfoByOption(
        selectedFilter as MbomSkuFilterOption,
        skuInfo,
        'mbom',
      );
    } else {
      return this.filterSkuInfoByOption(selectedFilter as SbomSkuFilterOption, skuInfo, 'sbom');
    }
  }

  filterSkuInfoByOption(
    option: SkuFilterOption,
    skuInfo: any[],
    bomType: 'mbom' | 'sbom',
  ): any[] {
    const mbomConfig: Record<string, { filter?: (sku: any) => boolean; emptyMessage?: string }> = {
      all: {},
      hdEditable: {
        filter: (sku) => sku.isHDSource === true && sku.isEditable === true,
        emptyMessage: 'No HD editable SKUs found. Editing is disabled.',
      },
      hdViewOnly: {
        filter: (sku) => sku.isHDSource === true,
        emptyMessage: 'No HD source view-only SKUs found.',
      },
      nonHdSource: {
        filter: (sku) => sku.isHDSource === false,
        emptyMessage: 'No non-HD source SKUs found.',
      },
    };

    const sbomConfig: Record<string, { filter?: (sku: any) => boolean; emptyMessage?: string }> = {
      all: {},
      editableSkus: {
        filter: (sku) => sku.isEditable === true,
        emptyMessage: 'No editable SKUs found. Editing is disabled.',
      },
    };

    const config = bomType === 'mbom' ? mbomConfig[option] : sbomConfig[option];

    if (!config?.filter) {
      return skuInfo;
    }
    return skuInfo.filter(config.filter);
  }

  isSkuFilterOptionDisabled(
    option: SkuFilterOption,
    isMbomMode: () => boolean,
  ): boolean {
    if (option === 'all') {
      return false;
    }

    const skuInfo = this.getSkuInfo();
    const bomType = isMbomMode() ? 'mbom' : 'sbom';
    return this.filterSkuInfoByOption(option, skuInfo, bomType).length === 0;
  }

  getSkuFilterOptionTooltip(
    option: SkuFilterOption,
    isMbomMode: () => boolean,
  ): string {
    if (option === 'all') {
      return '';
    }

    const skuInfo = this.getSkuInfo();
    const bomType = isMbomMode() ? 'mbom' : 'sbom';
    if (this.filterSkuInfoByOption(option, skuInfo, bomType).length > 0) {
      return '';
    }

    return this.getSkuFilterEmptyMessage(option, isMbomMode);
  }

  getSkuFilterEmptyMessage(
    option: SkuFilterOption,
    isMbomModeFn: () => boolean,
  ): string {
    const mbomMessages: Record<string, string> = {
      hdEditable: 'No HD editable SKUs found. Editing is disabled.',
      hdViewOnly: 'No HD source view-only SKUs found.',
      nonHdSource: 'No non-HD source SKUs found.',
    };

    const sbomMessages: Record<string, string> = {
      editableSkus: 'No editable SKUs found. Editing is disabled.',
    };

    if (isMbomModeFn()) {
      return mbomMessages[option] || '';
    } else {
      return sbomMessages[option] || '';
    }
  }

  getSkuFilterLabel(
    option: SkuFilterOption,
    mbomOptions: Array<{
      label: string;
      value: 'all' | 'hdEditable' | 'hdViewOnly' | 'nonHdSource';
    }>,
    sbomOptions: Array<{ label: string; value: 'all' | 'editableSkus' }>,
    isMbomMode: () => boolean,
  ): string {
    const options = isMbomMode() ? mbomOptions : sbomOptions;
    return options.find((item) => item.value === option)?.label || 'All';
  }
}
