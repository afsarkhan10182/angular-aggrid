import { Injectable } from '@angular/core';
import { DataService } from './data.service';

export interface RequiredField {
  keys: string[];
  label: string;
}

export interface InvalidRow {
  row: any;
  missingFields: string[];
  rowId: string | number;
  duplicateType?:
    | 'enumMBOM001'
    | 'notEnumMBOM001'
    | 'sbom'
    | 'feature-uniqueness'
    | 'duplicate-feature'
    | 'duplicate-part'
    | null; // Track which type of duplicate for error message
}

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
  constructor(private dataService: DataService) {}
  /**
   * Default required fields for new BOM rows
   */
  private readonly defaultRequiredFields: RequiredField[] = [
    { keys: ['bomLinkFeature'], label: 'Feature' },
    { keys: ['materialDescription'], label: 'Material' },
    { keys: ['supplier'], label: 'Supplier' },
    { keys: ['colorDescription'], label: 'Color' },
    { keys: ['partNumber'], label: 'Part' },
    { keys: ['bomLinkStartDate'], label: 'Start Date' },
    { keys: ['bomLinkEndDate'], label: 'End Date' },
    { keys: ['quantity'], label: 'Quantity' },
    { keys: ['bomLinkSpecSheetExtra'], label: 'Spec Sheet Extra' },
    { keys: ['bomLinkIncludeInSpecSheet'], label: 'Include In Spec Sheet' },
  ];

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

      if (field.label === 'Quantity') {
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
   * Recursively find all new rows in hierarchical data structure
   */
  private findNewRows(rows: any[]): any[] {
    const newRows: any[] = [];
    rows.forEach((row) => {
      if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
        newRows.push(row);
      }
      if (row.children && Array.isArray(row.children)) {
        newRows.push(...this.findNewRows(row.children));
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

    const newRows = this.findNewRows(rowData);

    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    newRows.forEach((row) => {
      const validation = this.validateRow(row, requiredFields);

      if (!validation.isValid) {
        invalidRows.push({
          row,
          missingFields: validation.missingFields,
          rowId: row.newRowId || row.partNumber || row.part || 'Unknown',
        });
      }
    });

    if (invalidRows.length > 0) {
      const rowCount = invalidRows.length === 1 ? 'row' : 'rows';
      const missingFieldsList = invalidRows
        .map((ir) => {
          const fields = ir.missingFields.join(', ');
          return `Row ${ir.rowId}: Missing ${fields}`;
        })
        .join('; ');

      return {
        isValid: false,
        message: `Cannot save: ${invalidRows.length} new ${rowCount} have missing required fields. ${missingFieldsList}. Please fill all required fields or remove the row(s) if added by mistake.`,
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

  /**
   * Create custom required fields configuration
   */
  createRequiredFields(fields: Array<{ keys: string[]; label: string }>): RequiredField[] {
    return fields.map((f) => ({ keys: f.keys, label: f.label }));
  }

  /**
   * Count how many SKUs have values in a row
   * @param row - The row to check
   * @param skuInfo - Array of SKU info objects with skuId property
   * @returns Object with count and array of SKU IDs that have values
   */
  private countSkusWithValues(row: any, skuInfo: any[]): { count: number; skuIds: string[] } {
    let count = 0;
    const skuIds: string[] = [];

    skuInfo.forEach((sku) => {
      const skuFieldName = `sku${sku.skuId}`;
      const skuValue = row[skuFieldName];

      if (skuValue !== undefined && skuValue !== null && skuValue !== '') {
        const stringValue = String(skuValue).trim();
        if (stringValue !== '') {
          count++;
          skuIds.push(sku.skuId);
        }
      }
    });

    return { count, skuIds };
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

    const { count, skuIds } = this.countSkusWithValues(row, skuInfo);

    if (count === 0) {
      const rowId = row.newRowId || row.partNumber || row.part || 'Unknown';
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

    const { count: selectedCount, skuIds: selectedSkuIds } = this.countSkusWithValues(row, skuInfo);

    if (selectedCount === 0) {
      return { isValid: false, message: 'No SKUs selected in row' };
    }

    const payloadSkuIds = payloadSkus
      .map((sku) => String(sku.skuId || sku.skuNumber || ''))
      .filter((id) => id !== '');

    if (selectedCount === 1) {
      if (payloadSkuIds.length !== 1) {
        const rowId = row.newRowId || row.partNumber || row.part || 'Unknown';
        return {
          isValid: false,
          message: `Row ${rowId}: Only 1 SKU is selected, but payload contains ${payloadSkuIds.length} SKU(s).`,
        };
      }

      if (!payloadSkuIds.includes(selectedSkuIds[0])) {
        const rowId = row.newRowId || row.partNumber || row.part || 'Unknown';
        return {
          isValid: false,
          message: `Row ${rowId}: Selected SKU (${selectedSkuIds[0]}) does not match payload SKU (${payloadSkuIds[0]}).`,
        };
      }
    } else {
      const missingSkus = selectedSkuIds.filter((id) => !payloadSkuIds.includes(id));
      if (missingSkus.length > 0) {
        const rowId = row.newRowId || row.partNumber || row.part || 'Unknown';
        return {
          isValid: false,
          message: `Row ${rowId}: Selected SKUs (${selectedSkuIds.join(
            ', '
          )}) are not all present in payload. Missing: ${missingSkus.join(', ')}.`,
        };
      }

      const extraSkus = payloadSkuIds.filter((id) => !selectedSkuIds.includes(id));
      if (extraSkus.length > 0) {
        const rowId = row.newRowId || row.partNumber || row.part || 'Unknown';
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

    const newRows = this.findNewRows(rowData);

    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    newRows.forEach((row) => {
      const validation = this.validateRowSkus(row, skuInfo);

      if (!validation.isValid) {
        invalidRows.push({
          row,
          missingFields: ['SKU selection'],
          rowId: row.newRowId || row.partNumber || row.part || 'Unknown',
        });
      }
    });

    if (invalidRows.length > 0) {
      const rowCount = invalidRows.length === 1 ? 'row' : 'rows';
      const rowIds = invalidRows.map((ir) => ir.rowId).join(', ');

      return {
        isValid: false,
        message: `Cannot save: ${invalidRows.length} new ${rowCount} (${rowIds}) have no SKU selected. At least 1 SKU must be selected before submit.`,
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
    const newRows: any[] = [];
    const existingRows: any[] = [];

    if (displayData && displayData.length > 0) {
      for (const row of displayData) {
        if (row.isNewRow || row.newRowId !== undefined) {
          newRows.push(row);
        }
      }
    }

    const bomType = this.dataService.getBomType();
    const isMbom = bomType === 'MBOM';
    const isSbom = bomType === 'SBOM';

    if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
      for (const instance of apiData.instances) {
        const bomLink = instance['bom-link'];
        if (!bomLink) continue;

        const section = bomLink.sectionInternalName || bomLink.section || '';
        const partNumber = String(bomLink.partNumber || '').trim();
        const bomLinkFeature = String(bomLink.bomLinkFeature || '').trim();
        const ptcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';
        const isEmptyPartNumber = !partNumber || partNumber === '';

        // Skip if missing required fields (section and feature are always required)
        if (!section || !bomLinkFeature) continue;

        if (isMbom && ptcbomPartMarkUp === 'enumMBOM001' && isEmptyPartNumber) {
          continue;
        }
        if (isSbom && isEmptyPartNumber) {
          continue;
        }

        const rowLike: any = {
          section: section,
          partNumber: partNumber,
          bomLinkFeature: bomLinkFeature,
          ptcbomPartMarkUp: ptcbomPartMarkUp,
        };

        // Extract SKU IDs from bomLink.skus array
        // IMPORTANT: Include SKU IDs even if value is empty for duplicate validation
        // We check for duplicate SKU IDs, not duplicate SKU values
        const skuIdsFromApi: string[] = [];
        if (bomLink.skus && Array.isArray(bomLink.skus)) {
          bomLink.skus.forEach((sku: any) => {
            if (sku && sku.skuId) {
              const skuId = String(sku.skuId).trim();
              if (skuId !== '') {
                skuIdsFromApi.push(skuId);
                const skuFieldName = `sku${sku.skuId}`;
                if (
                  sku.value !== undefined &&
                  sku.value !== null &&
                  String(sku.value).trim() !== ''
                ) {
                  rowLike[skuFieldName] = sku.value;
                } else {
                  rowLike[skuFieldName] = '';
                }
              }
            }
          });
        }

        // If no SKU IDs found, skip this row
        if (skuIdsFromApi.length === 0) continue;

        // Store ALL SKU IDs (including empty values) in rowLike for duplicate validation
        rowLike._allSkuIds = skuIdsFromApi;

        // Add to existing rows (merge SKUs if same combination already exists)
        // For MBOM with ptcbomPartMarkUp === "enumMBOM001": Key is Section+Feature (no PartNumber)
        // For MBOM with ptcbomPartMarkUp !== "enumMBOM001": Key is Section+Part+Feature
        // For SBOM: Key is Section+Part+Feature (always)
        let existingKey: string;
        if (isMbom && ptcbomPartMarkUp === 'enumMBOM001') {
          // Case 2: MBOM with ptcbomPartMarkUp === "enumMBOM001" - check Section+Feature only
          existingKey = `${section}::${bomLinkFeature}`;
        } else {
          // Normal case: Section+Part+Feature
          existingKey = `${section}::${partNumber}::${bomLinkFeature}`;
        }

        const existingIndex = existingRows.findIndex((r) => {
          if (isMbom && r.ptcbomPartMarkUp === 'enumMBOM001') {
            return `${r.section}::${r.bomLinkFeature}` === existingKey;
          } else {
            return `${r.section}::${r.partNumber}::${r.bomLinkFeature}` === existingKey;
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

          bomLink.skus.forEach((sku: any) => {
            if (
              sku &&
              sku.skuId &&
              sku.value !== undefined &&
              sku.value !== null &&
              String(sku.value).trim() !== ''
            ) {
              const skuFieldName = `sku${sku.skuId}`;
              if (
                existingRow[skuFieldName] === undefined ||
                existingRow[skuFieldName] === null ||
                String(existingRow[skuFieldName]).trim() === ''
              ) {
                existingRow[skuFieldName] = sku.value;
              }
            }
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

    newRows.forEach((row, idx) => {});
    existingRows.forEach((row, idx) => {});

    if (newRows.length > 1) {
      const newRowDetails = new Map<string, any[]>();

      for (const row of newRows) {
        const section = row.section || '';
        const bomLinkFeature = String(row.bomLinkFeature || '').trim();
        const partNumber = String(row.partNumber || '').trim();

        if (!section || !bomLinkFeature) {
          continue;
        }

        if (!partNumber || partNumber === '') {
          continue;
        }

        const rowSkus = this.countSkusWithValues(row, skuInfo);
        if (rowSkus.count === 0 || rowSkus.skuIds.length === 0) {
          continue;
        }

        for (const skuId of rowSkus.skuIds) {
          const combinationKey = `${section}|${bomLinkFeature}|${skuId}`;

          if (!newRowDetails.has(combinationKey)) {
            newRowDetails.set(combinationKey, []);
          }
          newRowDetails.get(combinationKey)!.push({ ...row, _checkSkuId: skuId });
        }
      }

      for (const [combinationKey, rows] of newRowDetails.entries()) {
        if (rows.length > 1) {
          const [section, feature, skuId] = combinationKey.split('|');

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
              duplicateType: 'duplicate-feature' as const,
            });
          }

          return {
            isValid: false,
            message: `Duplicate feature "${feature}" for the same SKU "${skuId}" and section "${sectionDisplayName}". Multiple new rows cannot have the same feature for the same SKU in the same section.`,
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
      const partNumber = String(row.partNumber || '').trim();
      const bomLinkFeature = String(row.bomLinkFeature || '').trim();
      const ptcbomPartMarkUp = row.ptcbomPartMarkUp || '';

      if (!section || !bomLinkFeature) {
        continue;
      }

      const allSkuIds = row._allSkuIds || [];
      const rowSkus = this.countSkusWithValues(row, skuInfo);
      const skuIdsToUse = allSkuIds.length > 0 ? allSkuIds : rowSkus.skuIds;

      if (skuIdsToUse.length === 0) {
        continue;
      }

      const isEmptyPartNumber = !partNumber || partNumber === '';

      if (isMbom && ptcbomPartMarkUp === 'enumMBOM001') {
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
      } else if (isMbom && ptcbomPartMarkUp !== 'enumMBOM001') {
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
        const bomLink = instance['bom-link'];
        if (!bomLink) continue;

        const section = bomLink.sectionInternalName || bomLink.section || '';
        const bomLinkFeature = String(bomLink.bomLinkFeature || '').trim();

        if (!section || !bomLinkFeature) continue;

        if (bomLink.skus && Array.isArray(bomLink.skus)) {
          bomLink.skus.forEach((sku: any) => {
            if (sku && sku.skuId) {
              const skuId = String(sku.skuId).trim();
              if (skuId !== '') {
                if (!featureUniquenessMap.has(section)) {
                  featureUniquenessMap.set(section, new Map());
                }
                const sectionMap = featureUniquenessMap.get(section)!;

                if (!sectionMap.has(skuId)) {
                  sectionMap.set(skuId, new Set());
                }
                const featureSet = sectionMap.get(skuId)!;
                featureSet.add(bomLinkFeature);
              }
            }
          });
        }
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

      const partNumber = String(row.partNumber || '').trim();
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

      const rowSkus = this.countSkusWithValues(row, skuInfo);
      if (rowSkus.count === 0) {
        continue;
      }

      let foundDuplicate = false;
      const duplicateSkus: string[] = [];
      let duplicateType:
        | 'enumMBOM001'
        | 'notEnumMBOM001'
        | 'sbom'
        | 'feature-uniqueness'
        | 'duplicate-feature'
        | 'duplicate-part'
        | null = null;
      let errorMessage = '';

      for (const skuId of rowSkus.skuIds) {
        if (isSbom) {
          if (isEmptyFeature) {
            const matchingRecords: any[] = [];
            if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
              for (const instance of apiData.instances) {
                const bomLink = instance['bom-link'];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instancePartNumber = String(bomLink.partNumber || '').trim();
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instanceSpecSheetExtra = String(bomLink.bomLinkSpecSheetExtra || '').trim();

                const isSectionMatch = instanceSection === section;
                const isPartMatch = instancePartNumber === partNumber;
                const isEmptyFeatureMatch = !instanceFeature || instanceFeature === '';
                const hasSkus = bomLink.skus && Array.isArray(bomLink.skus);

                if (isSectionMatch && isPartMatch && isEmptyFeatureMatch && hasSkus) {
                  const hasMatchingSku = bomLink.skus.some(
                    (sku: any) => sku && sku.skuId && String(sku.skuId).trim() === skuId
                  );

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
              (record) => record.specSheetExtra === 'No' || record.specSheetExtra === 'false'
            );

            const visibleRecords = matchingRecords.filter(
              (record) => record.specSheetExtra !== 'No' && record.specSheetExtra !== 'false'
            );

            if (visibleRecords.length > 0) {
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = 'duplicate-part';
              errorMessage = 'Duplicate part number for the same SKU. A record with the same part and SKU already exists when feature is not present.';
              break;
            } else if (hiddenRecords.length > 1) {
              duplicateSkus.push(skuId);
              foundDuplicate = true;
              duplicateType = 'duplicate-part';
              errorMessage = 'Duplicate part number for the same SKU. Multiple records found with the same part and SKU when feature is not present.';
              break;
            }
          } else {
            const matchingRecords: any[] = [];
            if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
              for (const instance of apiData.instances) {
                const bomLink = instance['bom-link'];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instancePartNumber = String(bomLink.partNumber || '').trim();

                const isSectionMatch = instanceSection === section;
                const isFeatureMatch = instanceFeature === bomLinkFeature;
                const isPartMatch = instancePartNumber === partNumber;
                const hasSkus = bomLink.skus && Array.isArray(bomLink.skus);

                if (isSectionMatch && isFeatureMatch && isPartMatch && hasSkus) {
                  const hasMatchingSku = bomLink.skus.some(
                    (sku: any) => sku && sku.skuId && String(sku.skuId).trim() === skuId
                  );

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
              duplicateType = 'duplicate-part';
              errorMessage = 'Duplicate part for the same SKU.';
              break;
            }
          }
        } else {
          const matchingRecords: any[] = [];
          if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
            for (const instance of apiData.instances) {
              const bomLink = instance['bom-link'];
              if (!bomLink) continue;

              const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
              const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
              const instancePartNumber = String(bomLink.partNumber || '').trim();
              const instancePtcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';

              if (
                instanceSection === section &&
                instanceFeature === bomLinkFeature &&
                bomLink.skus &&
                Array.isArray(bomLink.skus)
              ) {
                const hasMatchingSku = bomLink.skus.some(
                  (sku: any) => sku && sku.skuId && String(sku.skuId).trim() === skuId
                );

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
            duplicateType = 'feature-uniqueness';
            errorMessage = 'Duplicate feature for the same SKU and section.';
            break;
          } else if (recordCount === 0) {
          } else if (recordCount === 1) {
            const matchingRecord = matchingRecords[0];
            const existingPartNumber = matchingRecord.partNumber;
            const existingPtcbomPartMarkUp = matchingRecord.ptcbomPartMarkUp;
            const isEmptyExistingPart = matchingRecord.isEmptyPartNumber;

            if (isEmptyExistingPart) {
            } else {
              if (existingPartNumber !== partNumber) {
                duplicateSkus.push(skuId);
                foundDuplicate = true;
                duplicateType = 'duplicate-feature';
                errorMessage = 'Duplicate feature for the same SKU and section.';
                break;
              } else {
                duplicateSkus.push(skuId);
                foundDuplicate = true;
                duplicateType = 'duplicate-part';
                errorMessage = 'Duplicate feature and part for the same SKU and section.';
                break;
              }
            }
          }
        }
      }

      if (foundDuplicate) {
        const rowId = row.newRowId || row.partNumber || 'Unknown';
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
      if (firstDuplicate.duplicateType === 'feature-uniqueness') {
        finalErrorMessage =
          'Duplicate feature for the same SKU and section. One SKU should not have more than one feature for the same section.';
      } else if (firstDuplicate.duplicateType === 'duplicate-feature') {
        finalErrorMessage = 'Duplicate feature for the same SKU and section.';
      } else if (firstDuplicate.duplicateType === 'duplicate-part') {
        finalErrorMessage = 'Duplicate part for the same SKU and section.';
      } else if (firstDuplicate.duplicateType === 'notEnumMBOM001') {
        finalErrorMessage = 'Duplicate Feature for the chosen SKU';
      } else if (firstDuplicate.duplicateType === 'enumMBOM001') {
        finalErrorMessage = 'Duplicate Feature and Part for the chosen SKU';
      } else if (firstDuplicate.duplicateType === 'sbom') {
        finalErrorMessage = 'Duplicate Feature and Part for the chosen SKU';
      }
    }

    const result = {
      isValid: invalidRows.length === 0,
      message:
        invalidRows.length > 0
          ? finalErrorMessage
          : 'No duplicate Feature+Part+SKU combinations found.',
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
    };

    return result;
  }
}
