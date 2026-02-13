import { Injectable } from '@angular/core';
import {
  BOM_LINK_KEY,
  BOM_TYPE_EBOM,
  BOM_TYPE_MBOM,
  BOM_TYPE_SBOM,
  BOM_TYPE_MATERIALMBOM,
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
  MSG_DUPLICATE_FEATURE_FOR_SKU,
  MSG_DUPLICATE_FEATURE_AND_PART_FOR_SKU,
  MSG_NO_DUPLICATE_FOUND,
  MSG_DUPLICATE_PART_FEATURE_COMBO,
  MSG_NO_DUPLICATE_PART_FEATURE,
  ENUM_MBOM_LINE_ITEM,
  VALUE_SPEC_NO,
  DISPLAY_FALSE,
  DUPLICATE_TYPE_FEATURE_UNIQUENESS,
  DUPLICATE_TYPE_DUPLICATE_FEATURE,
  DUPLICATE_TYPE_DUPLICATE_PART,
  DUPLICATE_TYPE_ENUM_MBOM_001,
  DUPLICATE_TYPE_NOT_ENUM_MBOM_001,
  DUPLICATE_TYPE_SBOM,
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
  | typeof DUPLICATE_TYPE_ENUM_MBOM_001
  | typeof DUPLICATE_TYPE_NOT_ENUM_MBOM_001
  | typeof DUPLICATE_TYPE_SBOM
  | typeof DUPLICATE_TYPE_FEATURE_UNIQUENESS
  | typeof DUPLICATE_TYPE_DUPLICATE_FEATURE
  | typeof DUPLICATE_TYPE_DUPLICATE_PART
  | null;

const DUPLICATE_TYPE_ERROR_MESSAGE_MAP: Readonly<Record<string, string>> = {
  [DUPLICATE_TYPE_FEATURE_UNIQUENESS]: MSG_DUPLICATE_FEATURE_SKU_SECTION_ONE,
  [DUPLICATE_TYPE_DUPLICATE_FEATURE]: MSG_DUPLICATE_FEATURE_SKU_SECTION,
  [DUPLICATE_TYPE_DUPLICATE_PART]: MSG_DUPLICATE_SECTION_PART_SKU,
  [DUPLICATE_TYPE_NOT_ENUM_MBOM_001]: MSG_DUPLICATE_FEATURE_FOR_SKU,
  [DUPLICATE_TYPE_ENUM_MBOM_001]: MSG_DUPLICATE_FEATURE_AND_PART_FOR_SKU,
  [DUPLICATE_TYPE_SBOM]: MSG_DUPLICATE_FEATURE_AND_PART_FOR_SKU,
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
  private hasFieldValue(row: any, field: RequiredField): boolean {
    for (const key of field.keys) {
      const value = row[key];

      if (field.label === LABEL_QUANTITY) {
        if (value === undefined || value === null || value === '' || value === 0 || value === '0') {
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
    if (bomType === BOM_TYPE_SBOM) {
      return fields.filter((f) => f.label !== HEADER_FEATURE);
    }
    return fields;
  }

  /**
   * Validate a list of rows against required fields (reuses validateRow).
   * @param requiredFields - Fixed list for all rows, or a function that returns required fields per row (e.g. for SBOM where editability varies by row).
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
    const bomType = this.dataService.getBomType();
    const isEbom = bomType === BOM_TYPE_EBOM;
    const isMaterialMbom = bomType === BOM_TYPE_MATERIALMBOM;

    // EBOM and MATERIALMBOM: duplicate Part + Feature not allowed. Part+Feature-only logic; no SKU/section/ptcBomPartMarkUp.
    if (isEbom || isMaterialMbom) {
      return this.validateDuplicatePartAndFeatureOnly(rowData, displayData, apiData);
    }

    const newRows = this.collectNewRows(rowData, displayData);

    const existingRows: any[] = [];
    const isMbom = bomType === BOM_TYPE_MBOM;
    const isSbom = bomType === BOM_TYPE_SBOM;

    if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
      for (const instance of apiData.instances) {
        const bomLink = instance[BOM_LINK_KEY];
        if (!bomLink) continue;

        const section = bomLink.sectionInternalName || bomLink.section || '';
        const partNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
        const bomLinkFeature = String(bomLink.bomLinkFeature || '').trim();
        const ptcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';
        const isEmptyPartNumber = !partNumber || partNumber === '';

        // SBOM: feature is not used in UI; allow empty feature. MBOM: require section and feature.
        if (!section) continue;
        if (isMbom && (!bomLinkFeature || bomLinkFeature === '')) continue;

        if (isMbom && ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM && isEmptyPartNumber) {
          continue;
        }
        if (isSbom && isEmptyPartNumber) {
          continue;
        }

        const rowLike: any = {
          section: section,
          [FIELD_PART_NUMBER]: partNumber,
          bomLinkFeature: bomLinkFeature,
          ptcbomPartMarkUp: ptcbomPartMarkUp,
        };

        // Extract SKU IDs from bomLink.skus array
        // IMPORTANT: Include SKU IDs even if value is empty for duplicate validation
        // We check for duplicate SKU IDs, not duplicate SKU values
        const skuIdsFromApi = this.skuService.populateRowSkuFieldsFromSkus(
          rowLike,
          bomLink.skus,
          { includeEmptyValues: true },
        );

        // If no SKU IDs found, skip this row
        if (skuIdsFromApi.length === 0) continue;

        // Store ALL SKU IDs (including empty values) in rowLike for duplicate validation
        rowLike._allSkuIds = skuIdsFromApi;

        // Add to existing rows (merge SKUs if same combination already exists)
        // For MBOM with ptcbomPartMarkUp === "enumMBOM001": Key is Section+Feature (no PartNumber)
        // For MBOM with ptcbomPartMarkUp !== "enumMBOM001": Key is Section+Part+Feature
        // For SBOM: Key is Section+Part+Feature (always)
        let existingKey: string;
        if (isMbom && ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM) {
          // Case 2: MBOM with ptcbomPartMarkUp === "enumMBOM001" - check Section+Feature only
          existingKey = `${section}::${bomLinkFeature}`;
        } else {
          // Normal case: Section+Part+Feature
          existingKey = `${section}::${partNumber}::${bomLinkFeature}`;
        }

        const existingIndex = existingRows.findIndex((r) => {
          if (isMbom && r.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM) {
            return `${r.section}::${r.bomLinkFeature}` === existingKey;
          } else {
            return `${r.section}::${r[FIELD_PART_NUMBER]}::${r.bomLinkFeature}` === existingKey;
          }
        });

        if (existingIndex >= 0) {
          const existingRow = existingRows[existingIndex];

          if (!existingRow._allSkuIds) {
            existingRow._allSkuIds = [];
          }
          skuIdsFromApi.forEach((skuId: string) => {
            if (!existingRow._allSkuIds.includes(skuId)) {
              existingRow._allSkuIds.push(skuId);
            }
          });

          this.skuService.populateRowSkuFieldsFromSkus(existingRow, bomLink.skus, {
            mergeOnlyWhenTargetEmpty: true,
          });
        } else {
          existingRows.push(rowLike);
        }
      }
    } else {
      const collectRows = (rows: any[]) => {
        for (const row of rows) {
          if (row.isDirectRow || row.isSubRow) {
            const isAlreadyNew = newRows.some(
              (nr) => nr.newRowId === row.newRowId && row.newRowId !== undefined
            );
            if (!row.newRowId && !row.isNewRow && !isAlreadyNew) {
              existingRows.push(row);
            }
          }
          if (row.children && row.children.length > 0) {
            collectRows(row.children);
          }
        }
      };

      collectRows(rowData);
    }

    if (newRows.length > 1) {
      const newRowDetails = new Map<string, any[]>();

      for (const row of newRows) {
        const section = row.section || '';
        const bomLinkFeature = String(row.bomLinkFeature || '').trim();
        const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();

        // SBOM-only: use Section+Part+SKU (feature not in UI). MBOM/others: require section, feature, part.
        if (!section || !partNumber || partNumber === '') {
          continue;
        }
        if (!isSbom && !bomLinkFeature) {
          continue;
        }

        const rowSkus = this.skuService.countSkusWithValues(row, skuInfo);
        if (rowSkus.count === 0 || rowSkus.skuIds.length === 0) {
          continue;
        }

        for (const skuId of rowSkus.skuIds) {
          const combinationKey = isSbom
            ? `${section}|${partNumber}|${skuId}`
            : `${section}|${bomLinkFeature}|${skuId}`;

          if (!newRowDetails.has(combinationKey)) {
            newRowDetails.set(combinationKey, []);
          }
          newRowDetails.get(combinationKey)!.push({ ...row, _checkSkuId: skuId });
        }
      }

      for (const [combinationKey, rows] of newRowDetails.entries()) {
        if (rows.length > 1) {
          const parts = combinationKey.split('|');
          const section = parts[0];
          const sectionDetails = apiData?.sectionDetails || {};
          let sectionDisplayName = section;

          if (sectionDetails[section]) {
            sectionDisplayName = sectionDetails[section];
          } else {
            const firstRow = rows[0];
            if (firstRow && firstRow.sectionDisplayName) {
              sectionDisplayName = firstRow.sectionDisplayName;
            } else if (firstRow && firstRow.parent) {
              let currentParent: any = firstRow.parent;
              while (currentParent && sectionDisplayName === section) {
                if (currentParent.sectionDisplayName) {
                  sectionDisplayName = currentParent.sectionDisplayName;
                  break;
                }
                currentParent = currentParent.parent;
              }
            }
          }

          const invalidRows: InvalidRow[] = [];
          for (const duplicateRow of rows) {
            invalidRows.push({
              row: duplicateRow,
              missingFields: [],
              rowId: duplicateRow.newRowId || duplicateRow.id || 0,
              duplicateType: DUPLICATE_TYPE_DUPLICATE_PART,
            });
          }

          const message = isSbom
            ? MSG_DUPLICATE_SECTION_PART_SKU
            : `Duplicate feature "${parts[1]}" for the same SKU "${parts[2]}" and section "${sectionDisplayName}". Multiple new rows cannot have the same feature for the same SKU in the same section.`;

          return {
            isValid: false,
            message,
            invalidRows: invalidRows,
          };
        }
      }
    }

    const existingCombinations = new Map<string, Map<string, Map<string, Set<string>>>>();
    const existingCombinationsNoPart = new Map<string, Map<string, Set<string>>>();
    const existingCombinationsNoPartWithPart = new Map<
      string,
      Map<string, Map<string, Set<string>>>
    >();

    for (const row of existingRows) {
      const section = row.section || '';
      const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
      const bomLinkFeature = String(row.bomLinkFeature || '').trim();
      const ptcbomPartMarkUp = row.ptcbomPartMarkUp || '';

      if (!section || !bomLinkFeature) {
        continue;
      }

      const allSkuIds = row._allSkuIds || [];
      const rowSkus = this.skuService.countSkusWithValues(row, skuInfo);
      const skuIdsToUse = allSkuIds.length > 0 ? allSkuIds : rowSkus.skuIds;

      if (skuIdsToUse.length === 0) {
        continue;
      }

      const isEmptyPartNumber = !partNumber || partNumber === '';

      if (isMbom && ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM) {
        if (isEmptyPartNumber) {
          continue;
        }
        if (!existingCombinations.has(section)) {
          existingCombinations.set(section, new Map());
        }
        const sectionMap = existingCombinations.get(section)!;

        if (!sectionMap.has(partNumber)) {
          sectionMap.set(partNumber, new Map());
        }
        const partMap = sectionMap.get(partNumber)!;

        if (!partMap.has(bomLinkFeature)) {
          partMap.set(bomLinkFeature, new Set());
        }
        const skuSet = partMap.get(bomLinkFeature)!;
        skuIdsToUse.forEach((skuId: string) => skuSet.add(skuId));
      } else if (isMbom && ptcbomPartMarkUp !== ENUM_MBOM_LINE_ITEM) {
        if (!isEmptyPartNumber) {
          if (!existingCombinationsNoPartWithPart.has(section)) {
            existingCombinationsNoPartWithPart.set(section, new Map());
          }
          const sectionMap = existingCombinationsNoPartWithPart.get(section)!;

          if (!sectionMap.has(partNumber)) {
            sectionMap.set(partNumber, new Map());
          }
          const partMap = sectionMap.get(partNumber)!;

          if (!partMap.has(bomLinkFeature)) {
            partMap.set(bomLinkFeature, new Set());
          }
          const skuSet = partMap.get(bomLinkFeature)!;
          skuIdsToUse.forEach((skuId: string) => skuSet.add(skuId));
        }

        if (!isEmptyPartNumber) {
          if (!existingCombinationsNoPart.has(section)) {
            existingCombinationsNoPart.set(section, new Map());
          }
          const sectionMapNoPart = existingCombinationsNoPart.get(section)!;

          if (!sectionMapNoPart.has(bomLinkFeature)) {
            sectionMapNoPart.set(bomLinkFeature, new Set());
          }
          const skuSetNoPart = sectionMapNoPart.get(bomLinkFeature)!;
          skuIdsToUse.forEach((skuId: string) => skuSetNoPart.add(skuId));
        }
      } else {
        if (!existingCombinations.has(section)) {
          existingCombinations.set(section, new Map());
        }
        const sectionMap = existingCombinations.get(section)!;

        if (!sectionMap.has(partNumber)) {
          sectionMap.set(partNumber, new Map());
        }
        const partMap = sectionMap.get(partNumber)!;

        if (!partMap.has(bomLinkFeature)) {
          partMap.set(bomLinkFeature, new Set());
        }
        const skuSet = partMap.get(bomLinkFeature)!;
        skuIdsToUse.forEach((skuId: string) => skuSet.add(skuId));
      }
    }

    const featureUniquenessMap = new Map<string, Map<string, Set<string>>>();

    if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
      for (const instance of apiData.instances) {
        const bomLink = instance[BOM_LINK_KEY];
        if (!bomLink) continue;

        const section = bomLink.sectionInternalName || bomLink.section || '';
        const bomLinkFeature = String(bomLink.bomLinkFeature || '').trim();

        if (!section || !bomLinkFeature) continue;

        this.skuService.getSkuIdsFromBomLink(bomLink).forEach((skuId: string) => {
          if (!featureUniquenessMap.has(section)) {
            featureUniquenessMap.set(section, new Map());
          }
          const sectionMap = featureUniquenessMap.get(section)!;

          if (!sectionMap.has(skuId)) {
            sectionMap.set(skuId, new Set());
          }
          const featureSet = sectionMap.get(skuId)!;
          featureSet.add(bomLinkFeature);
        });
      }
    }
    const invalidRows: InvalidRow[] = [];

    for (const row of newRows) {
      let section = row.section || '';
      const sectionDetails = apiData?.sectionDetails || {};
      let sectionDisplayName = row.sectionDisplayName || '';

      if (!sectionDisplayName && row.parent) {
        let currentParent: any = row.parent;
        while (currentParent && !sectionDisplayName) {
          if (currentParent.sectionDisplayName) {
            sectionDisplayName = currentParent.sectionDisplayName;
            break;
          }
          currentParent = currentParent.parent;
        }
      }

      if (sectionDisplayName && Object.keys(sectionDetails).length > 0) {
        const foundInternalId = Object.keys(sectionDetails).find(
          (internalId) => sectionDetails[internalId] === sectionDisplayName
        );
        if (foundInternalId) {
          section = foundInternalId;
        }
      }

      const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
      const bomLinkFeature = String(row.bomLinkFeature || '').trim();
      const isEmptyPartNumber = !partNumber || partNumber === '';
      const isEmptyFeature = !bomLinkFeature || bomLinkFeature === '';

      if (!section) {
        continue;
      }

      if (!isSbom && isEmptyFeature) {
        continue;
      }

      if (isEmptyPartNumber) {
        continue;
      }

      const rowSkus = this.skuService.countSkusWithValues(row, skuInfo);
      if (rowSkus.count === 0) {
        continue;
      }

      let foundDuplicate = false;
      const duplicateSkus: string[] = [];
      let duplicateType: DuplicateType = null;

      for (const skuId of rowSkus.skuIds) {
        if (isSbom) {
          if (isEmptyFeature) {
            const matchingRecords: any[] = [];
            if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
              for (const instance of apiData.instances) {
                const bomLink = instance[BOM_LINK_KEY];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instancePartNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instanceSpecSheetExtra = String(bomLink.bomLinkSpecSheetExtra || '').trim();

                const isSectionMatch = instanceSection === section;
                const isPartMatch = instancePartNumber === partNumber;
                const isEmptyFeatureMatch = !instanceFeature || instanceFeature === '';
                const hasSkus = bomLink.skus && Array.isArray(bomLink.skus);

                if (isSectionMatch && isPartMatch && isEmptyFeatureMatch && hasSkus) {
                  const hasMatchingSku = this.skuService.bomLinkHasSkuId(bomLink, skuId);

                  if (hasMatchingSku) {
                    matchingRecords.push({
                      bomLink,
                      section: instanceSection,
                      feature: instanceFeature,
                      partNumber: instancePartNumber,
                      specSheetExtra: instanceSpecSheetExtra,
                    });
                  }
                }
              }
            }

            const hiddenRecords = matchingRecords.filter(
              (record) => record.specSheetExtra === VALUE_SPEC_NO || record.specSheetExtra === DISPLAY_FALSE
            );

            const visibleRecords = matchingRecords.filter(
              (record) => record.specSheetExtra !== VALUE_SPEC_NO && record.specSheetExtra !== DISPLAY_FALSE
            );

            if (visibleRecords.length > 0) {
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = DUPLICATE_TYPE_DUPLICATE_PART;
              break;
            } else if (hiddenRecords.length > 1) {
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = DUPLICATE_TYPE_DUPLICATE_PART;
              break;
            }
          } else {
            const matchingRecords: any[] = [];
            if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
              for (const instance of apiData.instances) {
                const bomLink = instance[BOM_LINK_KEY];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instancePartNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();

                const isSectionMatch = instanceSection === section;
                const isFeatureMatch = instanceFeature === bomLinkFeature;
                const isPartMatch = instancePartNumber === partNumber;
                const hasSkus = bomLink.skus && Array.isArray(bomLink.skus);

                if (isSectionMatch && isFeatureMatch && isPartMatch && hasSkus) {
                  const hasMatchingSku = this.skuService.bomLinkHasSkuId(bomLink, skuId);

                  if (hasMatchingSku) {
                    matchingRecords.push({
                      bomLink,
                      section: instanceSection,
                      feature: instanceFeature,
                      partNumber: instancePartNumber,
                    });
                  }
                }
              }
            }

            if (matchingRecords.length > 0) {
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = DUPLICATE_TYPE_DUPLICATE_PART;
              break;
            }
          }
        } else {
          const matchingRecords: any[] = [];
          if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
            for (const instance of apiData.instances) {
              const bomLink = instance[BOM_LINK_KEY];
              if (!bomLink) continue;

              const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
              const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
              const instancePartNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
              const instancePtcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';

              if (
                instanceSection === section &&
                instanceFeature === bomLinkFeature &&
                bomLink.skus &&
                Array.isArray(bomLink.skus)
              ) {
                const hasMatchingSku = this.skuService.bomLinkHasSkuId(bomLink, skuId);

                if (hasMatchingSku) {
                  matchingRecords.push({
                    bomLink,
                    section: instanceSection,
                    feature: instanceFeature,
                    partNumber: instancePartNumber,
                    ptcbomPartMarkUp: instancePtcbomPartMarkUp,
                    isEmptyPartNumber: !instancePartNumber || instancePartNumber === '',
                  });
                }
              }
            }
          }

          const recordCount = matchingRecords.length;

          if (recordCount > 1) {
            duplicateSkus.push(skuId);
            foundDuplicate = true;
            duplicateType = DUPLICATE_TYPE_FEATURE_UNIQUENESS;
            break;
          } else if (recordCount === 1) {
            const matchingRecord = matchingRecords[0];
            const existingPartNumber = matchingRecord.partNumber;
            const isEmptyExistingPart = matchingRecord.isEmptyPartNumber;

            if (!isEmptyExistingPart) {
              if (existingPartNumber !== partNumber) {
                duplicateSkus.push(skuId);
                foundDuplicate = true;
                duplicateType = DUPLICATE_TYPE_DUPLICATE_FEATURE;
                break;
              }
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = DUPLICATE_TYPE_DUPLICATE_PART;
              break;
            }
          }
        }
      }

      if (foundDuplicate) {
        const rowId = this.getValidationRowId(row);
        invalidRows.push({
          row,
          missingFields: [],
          rowId,
          duplicateType,
        });
      }
    }

    let finalErrorMessage = 'Duplicate Part for the chosen Feature and SKU';
    if (invalidRows.length > 0) {
      const firstDuplicate = invalidRows[0] as any;
      const duplicateType = firstDuplicate.duplicateType;
      finalErrorMessage = duplicateType
        ? DUPLICATE_TYPE_ERROR_MESSAGE_MAP[duplicateType] ?? finalErrorMessage
        : finalErrorMessage;
    }

    const result = {
      isValid: invalidRows.length === 0,
      message:
        invalidRows.length > 0
          ? finalErrorMessage
          : MSG_NO_DUPLICATE_FOUND,
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
    };

    return result;
  }

  private validateDuplicatePartAndFeatureOnly(
    rowData: any[],
    displayData: any[] = [],
    apiData?: any
  ): ValidationResult {
    const newRows: any[] = [];
    const existingCombinations = new Set<string>();

    if (displayData && displayData.length > 0) {
      for (const row of displayData) {
        if (row.isNewRow || row.newRowId !== undefined) {
          newRows.push(row);
        }
      }
    }

    if (apiData?.instances && Array.isArray(apiData.instances)) {
      for (const instance of apiData.instances) {
        const bomLink = instance[BOM_LINK_KEY];
        if (!bomLink) continue;
        const partNumber = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
        const feature = String(bomLink.bomLinkFeature || '').trim();
        if (partNumber && partNumber !== '') {
          existingCombinations.add(`${partNumber.toLowerCase()}|${feature.toLowerCase()}`);
        }
      }
    } else {
      const collectRows = (rows: any[]) => {
        for (const row of rows) {
          if ((row.isDirectRow || row.isSubRow) && !row.isNewRow) {
            const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
            const feature = String(row.bomLinkFeature || '').trim();
            if (partNumber && partNumber !== '') {
              existingCombinations.add(`${partNumber.toLowerCase()}|${feature.toLowerCase()}`);
            }
          }
          if (row.children?.length > 0) collectRows(row.children);
        }
      };
      collectRows(rowData);
    }

    const newCombinationCounts = new Map<string, any[]>();
    for (const row of newRows) {
      const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
      const feature = String(row.bomLinkFeature || '').trim();
      if (!partNumber || partNumber === '') continue;
      const key = `${partNumber.toLowerCase()}|${feature.toLowerCase()}`;
      if (!newCombinationCounts.has(key)) newCombinationCounts.set(key, []);
      newCombinationCounts.get(key)!.push(row);
    }

    const invalidRows: InvalidRow[] = [];
    for (const [key, rows] of newCombinationCounts.entries()) {
      if (rows.length > 1) {
        rows.forEach((r) =>
          invalidRows.push({
            row: r,
            missingFields: [],
            rowId: this.getValidationRowId(r),
            duplicateType: DUPLICATE_TYPE_DUPLICATE_PART,
          })
        );
      } else if (existingCombinations.has(key)) {
        invalidRows.push({
          row: rows[0],
          missingFields: [],
          rowId: this.getValidationRowId(rows[0]),
          duplicateType: DUPLICATE_TYPE_DUPLICATE_PART,
        });
      }
    }

    return {
      isValid: invalidRows.length === 0,
      message:
        invalidRows.length > 0
          ? MSG_DUPLICATE_PART_FEATURE_COMBO
          : MSG_NO_DUPLICATE_PART_FEATURE,
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
    };
  }
}
