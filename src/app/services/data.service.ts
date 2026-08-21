// Product BOM data service: loads Product MBOM API data, SKU metadata, linked BOM details, and autocomplete lookup data for the composer.
import {
  BOM_LINK_KEY,
  DEFAULT_BOM_TYPE,
  HEADER_CSRF_NONCE,
  ATTR_PART_NUMBER,
  ATTR_PTCMATERIAL_NAME,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_COUNTRY_OF_ORIGIN,
  FIELD_MATERIAL_SUPPLIER_COUNTRY_OF_ORIGIN,
  FIELD_PART_NUMBER,
  FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO,
  MSG_LOAD_BOM_FAILED,
  MSG_LOAD_BOM_SERVER_ERROR,
  PARAM_BOM_TYPE,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  SKU_FILTER_LABEL_ALL,
  SKU_FILTER_LABEL_HD_EDITABLE,
  SKU_FILTER_LABEL_HD_VIEW_ONLY,
  SKU_FILTER_LABEL_NON_HD,
  SKU_FILTER_EMPTY_HD_EDITABLE,
  SKU_FILTER_EMPTY_HD_VIEW_ONLY,
  SKU_FILTER_EMPTY_NON_HD,
  LABEL_ALL,
} from '../constants';
import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import { SkuService } from './sku.service';
import { UtilService } from './util.service';

type MaterialColorFieldValueConfig = {
  idKey: string;
  valueKey: string;
};

const MATERIAL_COLOR_FIELD_VALUE_MAP: Readonly<Record<string, MaterialColorFieldValueConfig>> = {
  [FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT]: {
    idKey: 'materialColorServiceEquivalentId',
    valueKey: 'materialColorServiceEquivalent',
  },
  [FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE]: {
    idKey: 'materialColorServiceSubstituteOneId',
    valueKey: 'materialColorServiceSubstituteOne',
  },
  [FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO]: {
    idKey: 'materialColorServiceSubstituteTwoId',
    valueKey: 'materialColorServiceSubstituteTwo',
  },
};


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
  materialColorPartNumber: string;
  materialSupplierComments: string;
  supplierDescription: string;
  bomLinkIncludeInSpecSheet: string;
  colorDescription: string;
  bomLinkCountryOfOrigin: string;
  partThirtyCharacterDescription: string;
  linkedBom?: string;
  ptcBomPartMarkup?: string; // MBOM markup type (e.g., 'enumMBOM001')
}

export interface SkuInfo {
  skuId: string; // Changed from 'sku' to match actual API response
  product: string;
  productId?: string;
  material?: string; // Material field for Product MBOM and Product SBOM
  manufacturer: string;
  color: string;
  size1: string;
  destination?: string;
  colorDimensionId?: string;
  sourceDimensionId?: string;
  destinationDimensionId?: string;
  bomId?: string;
  bomName?: string;
  /** Product MBOM/Product MBOM: parent part number, displayed as "Parent part" in SKU header */
  materialColorPartNumber?: string;
  /** Product MBOM/Product MBOM: state of the parent part, displayed on its own line in the SKU header */
  materialColorState?: string;
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
export type SkuFilterOption = MbomSkuFilterOption;

/** Payload for attribute search on material-colors/search (part number or material name; only attribute differs). */
export interface MaterialColorsSearchPayload {
  searchParameter: {
    typeName: string;
    parameters: Array<{ name: string; value: string }>;
    attributeParameters: Array<{ name: string; typeId: string; value: string }>;
    viewParameters: Array<{ name: string }>;
  };
}

/** Payload for fetch-by-IDs on material-colors/search (single endpoint). */
export interface ByIdsPayload {
  materialColorIds: string;
  bomType?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiData: ApiData | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService,
    private readonly skuService: SkuService,
    private readonly utilService: UtilService,
    @Inject(DOCUMENT) private readonly document: Document,
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
      headers[HEADER_CSRF_NONCE] = csrfToken;
    }

    return headers;
  }

  loadData(): Observable<ApiData> {
    let apiUrl = environment.useMockApi
      ? environment.dataApiPath
      : `${this.utilService.getServiceHostUrl()}${environment.dataApiPath}`;

    if (!environment.useMockApi) {
      const bomId = this.utilService.getJspDataAttribute('data-bomid');
      const bomType = this.utilService.getJspDataAttribute('data-bomtype');

      if (bomId) {
        apiUrl += `/${bomId}`;
      }
      if (bomType) {
        apiUrl += `?${PARAM_BOM_TYPE}=${bomType}`;
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
   * Get linked/complex BOM data for a material child/master id.
   * This endpoint is used by linked BOM modal, not by material-color search/edit flows.
   */
  getComplexBOM(materialId: string): Observable<any> {
    const apiUrl = environment.useMockApi
      ? environment.mockApiEndpoints.complexMaterial
      : `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/getMaterialBOM?materialMasterId=${materialId}`;

    return this.http.get<any>(apiUrl).pipe(
      map((data) => {
        if (Array.isArray(data?.instances)) {
          return data;
        }
        throw new Error('Invalid API response format for linked BOM modal');
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
      const mockApiUrl = environment.mockApiEndpoints.materialColorsSearch;
      dataSource = this.http.get<any>(mockApiUrl).pipe(
        map((mockResponse) => {
          const instances = mockResponse?.instances ?? {};
          const queryLower = (query || '').trim().toLowerCase();
          const filteredInstances: { [key: string]: any } = {};

          Object.entries(instances).forEach(([id, instance]: [string, any]) => {
            const match =
              queryLower.length === 0
                ? true
                : isPartNumberSearch
                  ? (instance.materialColorPartNumber || '').toLowerCase().includes(queryLower)
                  : (instance.material || '').toLowerCase().includes(queryLower);
            if (match) filteredInstances[id] = instance;
          });

          const payload: any = {
            instances: filteredInstances,
            columns: mockResponse?.columns,
          };
          if (queryLower.length === 0 && mockResponse?.resultCount != null) {
            payload.resultCount = mockResponse.resultCount;
            if (mockResponse.from != null) payload.from = mockResponse.from;
            if (mockResponse.to != null) payload.to = mockResponse.to;
          }
          return this.mapMaterialColorsResponseToResults(payload, fromIndex, toIndex);
        }),
      );
    } else {
      const attributeName = isPartNumberSearch ? ATTR_PART_NUMBER : ATTR_PTCMATERIAL_NAME;
      const typeId = isPartNumberSearch
        ? 'com.lcs.wc.material.LCSMaterialColor'
        : 'com.lcs.wc.material.LCSMaterial';
      dataSource = this.materialColorsSearchByAttribute(
        attributeName,
        typeId,
        query,
        fromIndex,
        toIndex,
      );
    }

    return dataSource.pipe(
      map((data) => ({
        results: data.results || [],
        resultCount: data.resultCount || 0,
        hasMore: data.hasMore || false,
      })),
      catchError(() => of({ results: [], resultCount: 0, hasMore: false })),
    );
  }

  /**
   * Search BOM features using Windchill API (or mock data when using mock API)
   */
  searchBomFeatures(
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    const flexTypeName = String.raw`Business Object\bomFeature`;
    return this.searchFlexInstances(
      flexTypeName,
      'name',
      query,
      fetchLimit,
      FIELD_BOM_LINK_FEATURE,
      environment.mockApiEndpoints.bomFeatures,
    );
  }

  /**
   * Search Countries of Origin using Windchill API (shared endpoint)
   */
  searchCountriesOfOrigin(
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    return this.searchFlexInstances('Country', 'name', query, fetchLimit, FIELD_BOM_LINK_COUNTRY_OF_ORIGIN);
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
      FIELD_PART_NUMBER,
    );
  }

  searchUserList(
    type: string,
    attributeName: string,
    query: string,
    fetchLimit: number = 20,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    const searchTerm = (query || '').trim().toLowerCase();
    const mapRows = (response: any) => {
      const rows = Array.isArray(response?.rows) ? response.rows : [];
      const filteredRows =
        searchTerm.length > 0
          ? rows.filter((row: any) =>
              String(row?.displayValue ?? row?.name ?? '')
                .toLowerCase()
                .includes(searchTerm),
            )
          : rows;
      const limitedRows = filteredRows.slice(0, fetchLimit).map((row: any, index: number) => ({
        ...row,
        displayValue: String(row?.displayValue ?? row?.name ?? ''),
        id: row?.id != null ? String(row.id) : `${attributeName}-${index}`,
      }));

      return {
        results: limitedRows,
        resultCount: filteredRows.length,
        hasMore: filteredRows.length > limitedRows.length,
      };
    };

    if (environment.useMockApi) {
      return this.http.get<any>(environment.mockApiEndpoints.getUser, {
        headers: this.buildHttpHeaders(),
      }).pipe(
        map(mapRows),
        catchError(() => of({ results: [], resultCount: 0, hasMore: false })),
      );
    }

    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/getUserList`;
    const requestBody = {
      type,
      attributeName,
    };
    const headers = {
      ...this.buildHttpHeaders(),
      accept: '*/*',
    };

    return this.http.post<any>(apiUrl, requestBody, { headers }).pipe(
      map(mapRows),
      catchError(() => of({ results: [], resultCount: 0, hasMore: false })),
    );
  }

  private searchFlexInstances(
    flexTypeName: string,
    attributeName: string,
    query: string,
    fetchLimit: number,
    mockFieldName: string,
    mockApiUrl?: string,
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    const searchTerm = (query || '').trim();

    if (environment.useMockApi) {
      if (mockApiUrl) {
        return this.http.get<any>(mockApiUrl).pipe(
          map((response) => {
            const rows = Array.isArray(response?.rows) ? response.rows : [];
            const filteredRows =
              searchTerm.length > 0
                ? rows.filter((row: any) =>
                    String(row?.displayValue ?? row?.name ?? '')
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                  )
                : rows;

            const resultCount = response?.totalNumberOfRows ?? filteredRows.length;
            const limitedRows = filteredRows.slice(0, fetchLimit).map((row: any, index: number) => ({
              ...row,
              displayValue: String(row?.displayValue ?? row?.name ?? ''),
              id: row?.id != null ? String(row.id) : `${mockFieldName}-${index}`,
            }));

            return {
              results: limitedRows,
              resultCount,
              hasMore: resultCount > limitedRows.length,
            };
          }),
          catchError(() => of({ results: [], resultCount: 0, hasMore: false })),
        );
      }

      const items = Array.isArray(this.apiData?.instances) ? this.apiData.instances : [];
      const allValues = items
        .map((item: BomInstance) => {
          const bomLink = item[BOM_LINK_KEY];
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

    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/instances`;
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
    const fallback = MSG_LOAD_BOM_FAILED;
    if (!error) return fallback;

    const status = error.status;
    const backendMessage = this.extractBackendMessage(error) || this.extractErrorMessage(error);

    if (status === 500) {
      return backendMessage
        ? `Failed to load BOM data: ${backendMessage}`
        : MSG_LOAD_BOM_SERVER_ERROR;
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
    const apiUrl = environment.useMockApi
      ? environment.mockApiEndpoints.saveBomLinks
      : `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/saveBOMLinks`;

    return this.http.put<any>(apiUrl, payload, { headers: this.buildHttpHeaders() }).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      }),
    );
  }

  /**
   * Single material-colors search endpoint (single source of truth).
   * POST: /Windchill/servlet/rest/trek/material-colors/search
   * Payloads: attribute search (part number or material name; only attribute differs), or fetch by IDs (materialColorIds).
   * Response shape: { instances, columns, materialColorIds? }.
   */
  private postMaterialColorsSearch(
    payload: MaterialColorsSearchPayload | ByIdsPayload
  ): Observable<any> {
    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/material-colors/search`;
    return this.http.post<any>(apiUrl, payload, { headers: this.buildHttpHeaders() });
  }

  /**
   * Part/material search: same endpoint and payload shape; only attribute name and typeId differ.
   * Part: attributeName 'materialColorPartNumber', typeId 'com.lcs.wc.material.LCSMaterialColor'
   * Material: attributeName 'ptcmaterialName', typeId 'com.lcs.wc.material.LCSMaterial'
   */
  private materialColorsSearchByAttribute(
    attributeName: string,
    typeId: string,
    query: string,
    fromIndex: number,
    toIndex: number
  ): Observable<{ results: any[]; resultCount: number; hasMore: boolean }> {
    const value = (query || '').trim().length > 0 ? `${(query || '').trim()}*` : '*';
    const payload: MaterialColorsSearchPayload = {
      searchParameter: {
        typeName: 'com.lcs.wc.material.LCSMaterial',
        parameters: [
          { name: 'fromIndex', value: String(fromIndex) },
          { name: 'toIndex', value: String(toIndex) },
        ],
        attributeParameters: [{ name: attributeName, typeId, value }],
        viewParameters: [{ name: 'material-color.iterationId' }],
      },
    };
    return this.postMaterialColorsSearch(payload).pipe(
      map((response) => this.mapMaterialColorsResponseToResults(response, fromIndex, toIndex)),
      catchError(() => of({ results: [], resultCount: 0, hasMore: false }))
    );
  }

  /**
   * Map API response (serviceDataModal.json shape) to { results, resultCount, hasMore }.
   * Uses response.resultCount, response.from, response.to when present for pagination/count.
   * Each result: { flatInstance, responseColumns, materialColorPartNumber, material } for dropdown and row population.
   */
  private mapMaterialColorsResponseToResults(
    response: any,
    fromIndex: number,
    toIndex: number
  ): { results: any[]; resultCount: number; hasMore: boolean } {
    const instances = response?.instances ?? {};
    const columns = response?.columns ?? {};
    const entries = Object.entries(instances) as [string, any][];
    const pageSize = Math.max(1, toIndex - fromIndex + 1);
    // Backend already returns one page for fromIndex/toIndex. Only client-slice
    // when the payload clearly contains more than one page (e.g. mock full set).
    const isAlreadyPaged = entries.length <= pageSize;
    const pageEntries = isAlreadyPaged ? entries : entries.slice(fromIndex - 1, toIndex);
    const totalCount = response?.resultCount ?? entries.length;
    const pageEnd =
      typeof response?.to === 'number'
        ? response.to
        : isAlreadyPaged
          ? fromIndex + pageEntries.length - 1
          : Math.min(toIndex, entries.length);

    const results = pageEntries.map(([materialColorId, instance]) => ({
      materialColorId,
      flatInstance: instance,
      responseColumns: columns,
      // Backend changed field name from `partNumber` -> `materialColorPartNumber`
      materialColorPartNumber: instance.materialColorPartNumber ?? '',
      material: instance.material ?? '',
      supplier: instance.supplier ?? '',
      color: instance.color ?? '',
    }));

    const hasMore = totalCount > pageEnd;
    return { results, resultCount: totalCount, hasMore };
  }

  /**
   * Fetch material colors by IDs: same endpoint, materialColorIds payload. Returns raw { instances, columns, materialColorIds }.
   */
  private materialColorsSearchByIds(materialColorIds: string): Observable<any> {
    const payload: ByIdsPayload = { materialColorIds };
    return this.postMaterialColorsSearch(payload);
  }

  private getBomTypeForPayload(): string {
    return this.getBomTypeFromResponse() || this.getBomType() || DEFAULT_BOM_TYPE;
  }

  private postPartEdits(payload: ByIdsPayload): Observable<any> {
    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/material-colors/part-edits`;
    const urlWithQuery = payload.bomType ? `${apiUrl}?${PARAM_BOM_TYPE}=${payload.bomType}` : apiUrl;
    const body = { materialColorIds: payload.materialColorIds };
    return this.http.post<any>(urlWithQuery, body, { headers: this.buildHttpHeaders() });
  }

  /**
   * Search/Fetch Material Colors by IDs
   * Uses single endpoint: POST .../material-colors/search with payload { materialColorIds }.
   * @param materialColorIds - Comma-separated list of material color IDs
   */
  searchMaterialColors(materialColorIds: string): Observable<any> {
    if (environment.useMockApi) {
      const mockUrl = environment.mockApiEndpoints.materialColorsSearch;
      return this.http.get<any>(mockUrl, { headers: this.buildHttpHeaders() });
    }
    return this.materialColorsSearchByIds(materialColorIds);
  }

  /**
   * Load Part Edit modal data by selected material color ids.
   * Mock: /api/parts-edit.json
   * API: reuses material-colors/search by ids payload shape.
   */
  searchPartEditData(materialColorIds: string): Observable<any> {
    if (environment.useMockApi) {
      const mockUrl = environment.mockApiEndpoints.partEditSearch;
      return this.http.get<any>(mockUrl, { headers: this.buildHttpHeaders() });
    }
    return this.postPartEdits({
      materialColorIds,
      bomType: this.getBomTypeForPayload(),
    });
  }

  /**
   * Build instance data for one row for Material Color Save.
   * @param row - Row data (current values)
   * @param editedFieldsForRow - Set of field names that were touched for this row
   * @returns Object with only touched fields; autocomplete fields use Id || value
   */
  buildMaterialColorInstanceData(
    row: any,
    editedFieldsForRow: Set<string>
  ): { [key: string]: any } {
    const instanceData: { [key: string]: any } = {};
    editedFieldsForRow.forEach((fieldName) => {
      const valueConfig = MATERIAL_COLOR_FIELD_VALUE_MAP[fieldName];
      instanceData[fieldName] = valueConfig
        ? row[valueConfig.idKey] || row[valueConfig.valueKey] || ''
        : row[fieldName] ?? '';
    });
    return instanceData;
  }

  buildPartEditInstanceData(
    row: any,
    editedFieldsForRow: Set<string>,
    selectableOptionsByField?: Record<string, Record<string, string>>,
    userListFields?: Set<string>,
    rawInstanceTemplate?: any,
  ): { [key: string]: any } {
    const normalizePartEditValue = (fieldName: string, value: any): string => {
      if (value == null || value === '') {
        return '';
      }

      const normalizedValue = String(value);
      const selectableOptions = selectableOptionsByField?.[fieldName];
      if (!selectableOptions) {
        return normalizedValue;
      }

      if (Object.prototype.hasOwnProperty.call(selectableOptions, normalizedValue)) {
        return normalizedValue;
      }

      const matchedEntry = Object.entries(selectableOptions).find(
        ([, displayValue]) => displayValue === normalizedValue,
      );
      return matchedEntry ? matchedEntry[0] : normalizedValue;
    };

    const instanceData: { [key: string]: any } = {
      material: row?.material ?? '',
      color: row?.color ?? '',
      colorId: row?.colorId ?? '',
      materialColorId: row?.materialColorId ?? '',
      supplier: row?.supplier ?? '',
      materialSupplierId: row?.materialSupplierId ?? '',
      childId: row?.childId ?? '',
      materialId: row?.materialId ?? '',
    };

    const resolveContainerKeyForField = (fieldName: string): string | null => {
      if (!rawInstanceTemplate || typeof rawInstanceTemplate !== 'object') {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(rawInstanceTemplate, fieldName)) {
        return null; // top-level
      }

      for (const [key, value] of Object.entries(rawInstanceTemplate)) {
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          key.toLowerCase().includes('attributes') &&
          Object.prototype.hasOwnProperty.call(value, fieldName)
        ) {
          return key;
        }
      }

      return null;
    };

    editedFieldsForRow.forEach((fieldName) => {
      const normalizedValue =
        userListFields?.has(fieldName) ||
        fieldName === FIELD_BOM_LINK_COUNTRY_OF_ORIGIN ||
        fieldName === FIELD_MATERIAL_SUPPLIER_COUNTRY_OF_ORIGIN
        ? String(row?.[`${fieldName}Id`] ?? row?.[fieldName] ?? '')
        : normalizePartEditValue(fieldName, row?.[fieldName] ?? '');
      const containerKey = resolveContainerKeyForField(fieldName);

      if (containerKey) {
        if (!instanceData[containerKey]) {
          instanceData[containerKey] = {};
        }
        instanceData[containerKey][fieldName] = normalizedValue;
      } else {
        instanceData[fieldName] = normalizedValue;
      }
    });

    return instanceData;
  }

  /**
   * Save Material Colors
   * PUT: /Windchill/servlet/rest/trek/saveMaterialColors
   * @param payload - Object with instances containing material color updates
   */
  saveMaterialColors(payload: { instances: { [key: string]: any } }): Observable<any> {
    if (environment.useMockApi) {
      return of({ success: true });
    }

    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/saveMaterialColors`;

    return this.http.put<any>(apiUrl, payload, { headers: this.buildHttpHeaders() }).pipe(
      map((response) => {
        return response || { success: true };
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      }),
    );
  }

  /**
   * Save Part Edit modal changes.
   * PUT: /Windchill/servlet/rest/trek/saveMaterialandPartDetails?bomType=...
   */
  savePartEditData(payload: { instances: { [key: string]: any }; materialColorIds?: string }): Observable<any> {
    const requestPayload = {
      instances: payload.instances || {},
      materialColorIds: payload.materialColorIds || '',
    };
    if (environment.useMockApi) {
      return of({ instances: requestPayload.instances, success: true });
    }
    const bomType = this.getBomTypeForPayload();
    const apiUrl = `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/trek/saveMaterialandPartDetails`;
    const urlWithQuery = `${apiUrl}?${PARAM_BOM_TYPE}=${encodeURIComponent(bomType)}`;
    const headers = {
      ...this.buildHttpHeaders(),
      accept: '*/*',
    };
    return this.http.put<any>(urlWithQuery, requestPayload, { headers }).pipe(
      map((response) => response || { success: true }),
      catchError((error: HttpErrorResponse) => throwError(() => error)),
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
    return this.apiData?.columns ?? {};
  }

  getSkuDataForPart(partRow: any): any[] {
    if (!partRow || !this.apiData) return [];

    const skuInfo = this.getSkuInfo();

    return skuInfo
      .filter((sku) => this.skuService.hasValue(this.skuService.getValue(partRow, sku.skuId)))
      .map((sku) => ({
        skuNumber: sku.skuId,
        product: sku.product,
        manufacturer: sku.manufacturer,
        color: sku.color,
        size: sku.size1,
        value: this.skuService.getValue(partRow, sku.skuId),
        partNumber: String(partRow?.[FIELD_PART_NUMBER] ?? ''),
      }));
  }

  getUserNameFromJsp(): string | null {
    return this.utilService.getJspDataAttribute('data-username');
  }

  getBomType(): string | null {
    const fromJsp = this.utilService.getJspDataAttribute('data-bomtype');
    if (fromJsp != null && String(fromJsp).trim() !== '') {
      return fromJsp;
    }
    const fromUrl = this.document.defaultView?.location?.search
      ? new URLSearchParams(this.document.defaultView.location.search).get(PARAM_BOM_TYPE)
      : null;
    if (fromUrl != null && String(fromUrl).trim() !== '') {
      return fromUrl;
    }
    return DEFAULT_BOM_TYPE;
  }

  getRefSkuId(): string | null {
    return this.utilService.getJspDataAttribute('data-refskuid');
  }

  /**
   * Fetch bomLinkIncludeInSpecSheet constraints from API/Mock
   */
  fetchIncludeInSpecSheetConstraints(): Observable<any> {
    const url = environment.useMockApi
      ? environment.mockApiEndpoints.includeInSpecSheet
      : `${this.utilService.getServiceHostUrl()}/Windchill/servlet/rest/tm/types/com.lcs.wc.flexbom.FlexBOMLink/attributes/${FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET}`;

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
      { label: SKU_FILTER_LABEL_ALL, value: 'all' },
      { label: SKU_FILTER_LABEL_HD_EDITABLE, value: 'hdEditable' },
      { label: SKU_FILTER_LABEL_HD_VIEW_ONLY, value: 'hdViewOnly' },
      { label: SKU_FILTER_LABEL_NON_HD, value: 'nonHdSource' },
    ];
  }

  getFilteredSkuInfo(
    selectedFilter: SkuFilterOption,
    isMbomMode: () => boolean,
  ): any[] {
    const skuInfo = this.getSkuInfo();
    return this.filterSkuInfoByOption(
      selectedFilter as MbomSkuFilterOption,
      skuInfo,
      'mbom',
    );
  }

  filterSkuInfoByOption(
    option: SkuFilterOption,
    skuInfo: any[],
    bomType: 'mbom',
  ): any[] {
    const mbomConfig: Record<string, { filter?: (sku: any) => boolean; emptyMessage?: string }> = {
      all: {},
      hdEditable: {
        filter: (sku) => sku.isHDSource === true && sku.isEditable === true,
        emptyMessage: SKU_FILTER_EMPTY_HD_EDITABLE,
      },
      hdViewOnly: {
        filter: (sku) => sku.isHDSource === true,
        emptyMessage: SKU_FILTER_EMPTY_HD_VIEW_ONLY,
      },
      nonHdSource: {
        filter: (sku) => sku.isHDSource === false,
        emptyMessage: SKU_FILTER_EMPTY_NON_HD,
      },
    };

    const config = mbomConfig[option];

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
    return this.filterSkuInfoByOption(option, skuInfo, 'mbom').length === 0;
  }

  getSkuFilterOptionTooltip(
    option: SkuFilterOption,
    isMbomMode: () => boolean,
  ): string {
    if (option === 'all') {
      return '';
    }

    const skuInfo = this.getSkuInfo();
    if (this.filterSkuInfoByOption(option, skuInfo, 'mbom').length > 0) {
      return '';
    }

    return this.getSkuFilterEmptyMessage(option, isMbomMode);
  }

  getSkuFilterEmptyMessage(
    option: SkuFilterOption,
    isMbomModeFn: () => boolean,
  ): string {
        const mbomMessages: Record<string, string> = {
      hdEditable: SKU_FILTER_EMPTY_HD_EDITABLE,
      hdViewOnly: SKU_FILTER_EMPTY_HD_VIEW_ONLY,
      nonHdSource: SKU_FILTER_EMPTY_NON_HD,
    };
    return mbomMessages[option] || '';
  }

  getSkuFilterLabel(
    option: SkuFilterOption,
    mbomOptions: Array<{
      label: string;
      value: 'all' | 'hdEditable' | 'hdViewOnly' | 'nonHdSource';
    }>,
  ): string {
    return mbomOptions.find((item) => item.value === option)?.label || LABEL_ALL;
  }
}
