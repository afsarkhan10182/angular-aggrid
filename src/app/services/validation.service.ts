// Product BOM validation service: validates Product MBOM required fields, duplicate rows, SKU selections, effective dates, and data consistency.
import { Injectable } from '@angular/core';
import {
  BOM_LINK_KEY,
  FIELD_PART_NUMBER,
  REQUIRED_FIELDS_FOR_SAVE,
  DEFAULT_REQUIRED_FIELDS,
  ROW_ID_UNKNOWN,
  MSG_VALIDATION_REQUIRED_FIELDS,
  MSG_NO_SKUS_SELECTED,
  MSG_SKU_SELECTION,
  MSG_DUPLICATE_FEATURE_SKU_SECTION,
  MSG_DUPLICATE_SECTION_PART_SKU,
  MSG_DUPLICATE_FEATURE_SKU_SECTION_ONE,
  MSG_NO_DUPLICATE_FOUND,
  DUPLICATE_TYPE_FEATURE_UNIQUENESS,
  DUPLICATE_TYPE_DUPLICATE_FEATURE,
  DUPLICATE_TYPE_DUPLICATE_PART,
  HEADER_FEATURE,
  LABEL_QUANTITY,
} from '../constants';
import { DataService } from './data.service';
import { SkuService } from './sku.service';

export interface RequiredField {
  keys: string[];
  label: string;
}

export interface InvalidRow {
  row: any;
  missingFields: string[];
  rowId: string | number;
  skuErrors?: string[];
  duplicateType?: DuplicateType; // Track which type of duplicate for error message
}

export type DuplicateType =
  | typeof DUPLICATE_TYPE_FEATURE_UNIQUENESS
  | typeof DUPLICATE_TYPE_DUPLICATE_FEATURE
  | typeof DUPLICATE_TYPE_DUPLICATE_PART
  | null;

const EMPTY_QUANTITY_VALUES = new Set<unknown>([undefined, null, '', 0, '0']);

const DUPLICATE_TYPE_ERROR_MESSAGE_MAP: Readonly<Record<string, string>> = {
  [DUPLICATE_TYPE_FEATURE_UNIQUENESS]: MSG_DUPLICATE_FEATURE_SKU_SECTION_ONE,
  [DUPLICATE_TYPE_DUPLICATE_FEATURE]: MSG_DUPLICATE_FEATURE_SKU_SECTION,
  [DUPLICATE_TYPE_DUPLICATE_PART]: MSG_DUPLICATE_SECTION_PART_SKU,
};

export interface ValidationResult {
  isValid: boolean;
  message: string;
  invalidRows?: InvalidRow[];
}

export interface SkuValidationResult {
  isValid: boolean;
  message: string;
  invalidRows?: InvalidRow[];
}

@Injectable({
  providedIn: 'root',
})
export class ValidationService {
  constructor(
    private readonly dataService: DataService,
    private readonly skuService: SkuService,
  ) {}
  /**
   * Default required fields for new BOM rows (from constants)
   */
  private readonly defaultRequiredFields: RequiredField[] = [...DEFAULT_REQUIRED_FIELDS];

  /**
   * Check if a value is empty (null, undefined, empty string, or whitespace-only string)
   */
  private isEmpty(value: any): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    return false;
  }

  /**
   * Check if a field has a value in a row (checks all possible field names)
   */
  private isEmptyQuantity(value: unknown): boolean {
    return EMPTY_QUANTITY_VALUES.has(value);
  }

  private hasFieldValue(row: any, field: RequiredField): boolean {
    for (const key of field.keys) {
      const value = row[key];

      if (field.label === LABEL_QUANTITY) {
        if (this.isEmptyQuantity(value)) {
          continue;
        }
        if (typeof value === 'string') {
          const s = value.trim();
          const isNumericLike = /^\d*\.?\d*$/.test(s) && /\d/.test(s);
          if (!isNumericLike) {
            continue;
          }
          const numValue = parseFloat(s);
          if (!isNaN(numValue) && numValue !== 0) {
            return true;
          }
          continue;
        }

        if (typeof value === 'number' && !isNaN(value) && value !== 0) {
          return true;
        }
      } else {
        // Standard validation for other fields
        if (!this.isEmpty(value)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Recursively find all new rows in tree data structure
   */
  private findNewRows(rows: any[]): any[] {
    const newRows: any[] = [];
    rows.forEach((row) => {
      if (this.isDataRowForValidation(row) && row.isNewRow) {
        newRows.push(row);
      }
      if (row.children && Array.isArray(row.children)) {
        newRows.push(...this.findNewRows(row.children));
      }
    });
    return newRows;
  }

  private isDataRowForValidation(row: any): boolean {
    return !!(row && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader);
  }

  private getValidationRowId(row: any): string | number {
    return row.newRowId ?? row.materialKey ?? row[FIELD_PART_NUMBER] ?? row.part ?? ROW_ID_UNKNOWN;
  }

  private collectNewRows(rowData: any[], displayData?: any[]): any[] {
    const newRows = this.findNewRows(rowData);
    if (!displayData || !Array.isArray(displayData)) {
      return newRows;
    }

    displayData.forEach((row: any) => {
      if (!this.isDataRowForValidation(row) || !row.isNewRow) {
        return;
      }

      const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
      if (!exists) {
        newRows.push(row);
      }
    });

    return newRows;
  }

  /**
   * Validate a single row against required fields
   */
  validateRow(
    row: any,
    requiredFields: RequiredField[] = this.defaultRequiredFields
  ): {
    isValid: boolean;
    missingFields: string[];
  } {
    const missingFields: string[] = [];

    requiredFields.forEach((field) => {
      if (!this.hasFieldValue(row, field)) {
        missingFields.push(field.label);
      }
    });

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Validate all new rows in the grid data
   * @param rowData - Hierarchical row data (with children)
   * @param displayData - Flat display data (optional, for rows not yet in hierarchy)
   * @param requiredFields - Custom required fields (optional, uses default if not provided)
   * @returns Validation result with list of invalid rows and their missing fields
   */
  validateNewRows(
    rowData: any[],
    displayData?: any[],
    requiredFields: RequiredField[] = this.defaultRequiredFields
  ): ValidationResult {
    const invalidRows: InvalidRow[] = [];
    const newRows = this.collectNewRows(rowData, displayData);

    newRows.forEach((row) => {
      const validation = this.validateRow(row, requiredFields);

      if (!validation.isValid) {
        invalidRows.push({
          row,
          missingFields: validation.missingFields,
          rowId: this.getValidationRowId(row),
        });
      }
    });

    if (invalidRows.length > 0) {
      return {
        isValid: false,
        message: MSG_VALIDATION_REQUIRED_FIELDS,
        invalidRows,
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * Get default required fields (useful for customization)
   */
  getDefaultRequiredFields(): RequiredField[] {
    return [...this.defaultRequiredFields];
  }

  getRequiredFieldsForSave(bomType: string): RequiredField[] {
    const fields = [...REQUIRED_FIELDS_FOR_SAVE];
    return fields;
  }

  /**
   * Validate a list of rows against required fields (reuses validateRow).
   * @param requiredFields - Fixed list for all rows, or a function that returns required fields per row (e.g. for Product MBOM where editability varies by row).
   */
  validateRows(
    rows: any[],
    requiredFields: RequiredField[] | ((row: any) => RequiredField[])
  ): ValidationResult {
    const invalidRows: InvalidRow[] = [];
    rows.forEach((row) => {
      const fields =
        typeof requiredFields === 'function' ? requiredFields(row) : requiredFields;
      const validation = this.validateRow(row, fields);
      if (!validation.isValid) {
        invalidRows.push({
          row,
          missingFields: validation.missingFields,
          rowId: this.getValidationRowId(row),
        });
      }
    });
    if (invalidRows.length > 0) {
      return {
        isValid: false,
        message: MSG_VALIDATION_REQUIRED_FIELDS,
        invalidRows,
      };
    }
    return { isValid: true, message: '' };
  }

  /**
   * Create custom required fields configuration
   */
  createRequiredFields(fields: Array<{ keys: string[]; label: string }>): RequiredField[] {
    return fields.map((f) => ({ keys: f.keys, label: f.label }));
  }

  /**
   * Validate SKU selection for a new row
   * At least 1 SKU must be selected (have a value) before submit
   * @param row - The row to validate
   * @param skuInfo - Array of SKU info objects with skuId property
   * @returns Validation result
   */
  validateRowSkus(
    row: any,
    skuInfo: any[]
  ): {
    isValid: boolean;
    message: string;
    selectedSkuCount: number;
  } {
    if (!row.isNewRow) {
      return { isValid: true, message: '', selectedSkuCount: 0 };
    }

    const { count } = this.skuService.countSkusWithValues(row, skuInfo);

    if (count === 0) {
      const rowId = this.getValidationRowId(row);
      return {
        isValid: false,
        message: `Row ${rowId}: At least 1 SKU must be selected before submit.`,
        selectedSkuCount: 0,
      };
    }

    return { isValid: true, message: '', selectedSkuCount: count };
  }

  /**
   * Validate SKU payload for a row
   * Validates that either only one SKU is passed, or all selected SKUs are correctly passed
   * @param row - The row to validate
   * @param skuInfo - Array of SKU info objects with skuId property
   * @param payloadSkus - Array of SKUs from the payload for this row
   * @returns Validation result
   */
  validateSkuPayload(
    row: any,
    skuInfo: any[],
    payloadSkus: any[]
  ): {
    isValid: boolean;
    message: string;
  } {
    if (!row.isNewRow) {
      return { isValid: true, message: '' };
    }

    const {
      count: selectedCount,
      skuIds: selectedSkuIds,
    } = this.skuService.countSkusWithValues(row, skuInfo);

    if (selectedCount === 0) {
      return { isValid: false, message: MSG_NO_SKUS_SELECTED };
    }

    const payloadSkuIds = this.skuService.getPayloadSkuIds(payloadSkus);

    if (selectedCount === 1) {
      if (payloadSkuIds.length !== 1) {
        const rowId = this.getValidationRowId(row);
        return {
          isValid: false,
          message: `Row ${rowId}: Only 1 SKU is selected, but payload contains ${payloadSkuIds.length} SKU(s).`,
        };
      }

      if (!payloadSkuIds.includes(selectedSkuIds[0])) {
        const rowId = this.getValidationRowId(row);
        return {
          isValid: false,
          message: `Row ${rowId}: Selected SKU (${selectedSkuIds[0]}) does not match payload SKU (${payloadSkuIds[0]}).`,
        };
      }
    } else {
      const missingSkus = selectedSkuIds.filter((id) => !payloadSkuIds.includes(id));
      if (missingSkus.length > 0) {
        const rowId = this.getValidationRowId(row);
        return {
          isValid: false,
          message: `Row ${rowId}: Selected SKUs (${selectedSkuIds.join(
            ', '
          )}) are not all present in payload. Missing: ${missingSkus.join(', ')}.`,
        };
      }

      const extraSkus = payloadSkuIds.filter((id) => !selectedSkuIds.includes(id));
      if (extraSkus.length > 0) {
        const rowId = this.getValidationRowId(row);
        return {
          isValid: false,
          message: `Row ${rowId}: Payload contains SKUs (${extraSkus.join(
            ', '
          )}) that were not selected in the row.`,
        };
      }
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validate SKUs for all new rows
   * @param rowData - Hierarchical row data (with children)
   * @param displayData - Flat display data (optional, for rows not yet in hierarchy)
   * @param skuInfo - Array of SKU info objects with skuId property
   * @returns Validation result with list of invalid rows
   */
  validateNewRowsSkus(rowData: any[], skuInfo: any[], displayData?: any[]): SkuValidationResult {
    const invalidRows: InvalidRow[] = [];
    const newRows = this.collectNewRows(rowData, displayData);

    newRows.forEach((row) => {
      const validation = this.validateRowSkus(row, skuInfo);

      if (!validation.isValid) {
        invalidRows.push({
          row,
          missingFields: [MSG_SKU_SELECTION],
          rowId: this.getValidationRowId(row),
        });
      }
    });

    if (invalidRows.length > 0) {
      return {
        isValid: false,
        message: `Cannot save: no SKU selected.`,
        invalidRows,
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validate duplicate Feature+Part+SKU combinations
   * @param rowData - Hierarchical row data (filtered rows visible in UI)
   * @param displayData - Flat display data (for new rows not yet in hierarchy)
   * @param skuInfo - Array of SKU info objects with skuId property
   * @param apiData - Optional: Original API data to check ALL rows including hidden ones
   * @returns Validation result with invalid rows if duplicates found
   */
  validateDuplicateFeatureSkuCombination(
    rowData: any[],
    displayData: any[] = [],
    skuInfo: any[],
    apiData?: any
  ): ValidationResult {
    const newRows = this.collectNewRows(rowData, displayData);

    const duplicateNewRowsResult = this.validateDuplicateNewRows(newRows, skuInfo, apiData);
    if (!duplicateNewRowsResult.isValid) {
      return duplicateNewRowsResult;
    }

    const invalidRows = this.findDuplicateRowsAgainstApi(newRows, skuInfo, apiData);
    return this.buildDuplicateFeatureSkuResult(invalidRows);
  }

  private validateDuplicateNewRows(newRows: any[], skuInfo: any[], apiData?: any): ValidationResult {
    if (newRows.length <= 1) {
      return { isValid: true, message: '' };
    }

    const newRowDetails = this.collectNewRowDuplicateDetails(newRows, skuInfo);
    for (const [combinationKey, rows] of newRowDetails.entries()) {
      if (rows.length > 1) {
        return this.buildDuplicateNewRowsResult(combinationKey, rows, apiData);
      }
    }
    return { isValid: true, message: '' };
  }

  private collectNewRowDuplicateDetails(newRows: any[], skuInfo: any[]): Map<string, any[]> {
    const newRowDetails = new Map<string, any[]>();
    for (const row of newRows) {
      const details = this.getNewRowDuplicateDetails(row, skuInfo);
      if (!details) {
        continue;
      }
      for (const skuId of details.skuIds) {
        const combinationKey = `${details.section}|${details.partNumber}|${details.bomLinkFeature}|${skuId}`;
        this.addMapArrayValue(newRowDetails, combinationKey, { ...row, _checkSkuId: skuId });
      }
    }
    return newRowDetails;
  }

  private getNewRowDuplicateDetails(row: any, skuInfo: any[]): any | null {
    const section = row.section || '';
    const bomLinkFeature = String(row.bomLinkFeature || '').trim();
    const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
    if (!section || !partNumber || !bomLinkFeature) {
      return null;
    }

    const rowSkus = this.skuService.countSkusWithValues(row, skuInfo);
    if (rowSkus.count === 0 || rowSkus.skuIds.length === 0) {
      return null;
    }
    return { section, partNumber, bomLinkFeature, skuIds: rowSkus.skuIds };
  }

  private buildDuplicateNewRowsResult(combinationKey: string, rows: any[], apiData?: any): ValidationResult {
    const [section, , feature, skuId] = combinationKey.split('|');
    const sectionDisplayName = this.resolveSectionDisplayName(section, rows[0], apiData);
    const invalidRows: InvalidRow[] = rows.map((duplicateRow) => ({
      row: duplicateRow,
      missingFields: [],
      rowId: duplicateRow.newRowId || duplicateRow.id || 0,
      duplicateType: DUPLICATE_TYPE_DUPLICATE_PART,
    }));

    return {
      isValid: false,
      message: `Duplicate feature "${feature}" for the same SKU "${skuId}" and section "${sectionDisplayName}". Multiple new rows cannot have the same feature for the same SKU in the same section.`,
      invalidRows,
    };
  }

  private resolveSectionDisplayName(section: string, row: any, apiData?: any): string {
    const sectionDetails = apiData?.sectionDetails || {};
    if (sectionDetails[section]) {
      return sectionDetails[section];
    }
    if (row?.sectionDisplayName) {
      return row.sectionDisplayName;
    }
    return this.findParentSectionDisplayName(row) || section;
  }

  private findParentSectionDisplayName(row: any): string {
    let currentParent = row?.parent;
    while (currentParent) {
      if (currentParent.sectionDisplayName) {
        return currentParent.sectionDisplayName;
      }
      currentParent = currentParent.parent;
    }
    return '';
  }

  private findDuplicateRowsAgainstApi(newRows: any[], skuInfo: any[], apiData?: any): InvalidRow[] {
    const invalidRows: InvalidRow[] = [];
    for (const row of newRows) {
      const rowData = this.getNewRowApiDuplicateData(row, skuInfo, apiData);
      if (!rowData) {
        continue;
      }
      const duplicateType = this.findApiDuplicateTypeForSkus(rowData, apiData);
      if (duplicateType) {
        invalidRows.push({ row, missingFields: [], rowId: this.getValidationRowId(row), duplicateType });
      }
    }
    return invalidRows;
  }

  private getNewRowApiDuplicateData(row: any, skuInfo: any[], apiData?: any): any | null {
    const section = this.resolveInternalSection(row, apiData);
    const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
    const bomLinkFeature = String(row.bomLinkFeature || '').trim();
    if (!section || !partNumber || !bomLinkFeature) {
      return null;
    }

    const rowSkus = this.skuService.countSkusWithValues(row, skuInfo);
    if (rowSkus.count === 0) {
      return null;
    }
    return { section, partNumber, bomLinkFeature, skuIds: rowSkus.skuIds };
  }

  private resolveInternalSection(row: any, apiData?: any): string {
    let section = row.section || '';
    const sectionDisplayName = row.sectionDisplayName || this.findParentSectionDisplayName(row);
    const sectionDetails = apiData?.sectionDetails || {};
    if (sectionDisplayName && Object.keys(sectionDetails).length > 0) {
      const foundInternalId = Object.keys(sectionDetails).find((internalId) => sectionDetails[internalId] === sectionDisplayName);
      if (foundInternalId) {
        section = foundInternalId;
      }
    }
    return section;
  }

  private findApiDuplicateTypeForSkus(rowData: any, apiData?: any): DuplicateType {
    for (const skuId of rowData.skuIds) {
      const matchingRecords = this.findFeatureSkuApiRecords(rowData, skuId, apiData);
      const duplicateType = this.getDuplicateTypeFromApiRecords(matchingRecords, rowData.partNumber);
      if (duplicateType) {
        return duplicateType;
      }
    }
    return null;
  }

  private findFeatureSkuApiRecords(rowData: any, skuId: string, apiData?: any): any[] {
    if (!this.hasApiInstances(apiData)) {
      return [];
    }

    const matchingRecords: any[] = [];
    for (const instance of apiData.instances) {
      const record = this.createMatchingFeatureSkuRecord(instance, rowData, skuId);
      if (record) {
        matchingRecords.push(record);
      }
    }
    return matchingRecords;
  }

  private createMatchingFeatureSkuRecord(instance: any, rowData: any, skuId: string): any | null {
    const bomLink = instance[BOM_LINK_KEY];
    if (!bomLink || !Array.isArray(bomLink.skus)) {
      return null;
    }

    const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
    const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
    if (instanceSection !== rowData.section || instanceFeature !== rowData.bomLinkFeature) {
      return null;
    }
    if (!this.skuService.bomLinkHasSkuId(bomLink, skuId)) {
      return null;
    }

    const partNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
    return { bomLink, section: instanceSection, feature: instanceFeature, partNumber, ptcBomPartMarkup: bomLink.ptcBomPartMarkup || '', isEmptyPartNumber: !partNumber };
  }

  private getDuplicateTypeFromApiRecords(matchingRecords: any[], partNumber: string): DuplicateType {
    if (matchingRecords.length > 1) {
      return DUPLICATE_TYPE_FEATURE_UNIQUENESS;
    }
    if (matchingRecords.length !== 1 || matchingRecords[0].isEmptyPartNumber) {
      return null;
    }
    return matchingRecords[0].partNumber !== partNumber ? DUPLICATE_TYPE_DUPLICATE_FEATURE : DUPLICATE_TYPE_DUPLICATE_PART;
  }

  private buildDuplicateFeatureSkuResult(invalidRows: InvalidRow[]): ValidationResult {
    const firstDuplicateType = invalidRows[0]?.duplicateType;
    const message = firstDuplicateType
      ? DUPLICATE_TYPE_ERROR_MESSAGE_MAP[firstDuplicateType] ?? 'Duplicate Part for the chosen Feature and SKU'
      : MSG_NO_DUPLICATE_FOUND;
    return { isValid: invalidRows.length === 0, message, invalidRows: invalidRows.length > 0 ? invalidRows : undefined };
  }

  private hasApiInstances(apiData: any): boolean {
    return !!apiData?.instances && Array.isArray(apiData.instances);
  }

  private addMapArrayValue(map: Map<string, any[]>, key: string, value: any): void {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(value);
  }


}
