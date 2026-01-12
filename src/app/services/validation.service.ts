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
  duplicateType?: 'enumMBOM001' | 'notEnumMBOM001' | 'sbom' | null; // Track which type of duplicate for error message
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

      // Special handling for Quantity field: treat 0 as empty
      if (field.label === 'Quantity') {
        if (value === undefined || value === null || value === '' || value === 0 || value === '0') {
          continue; // This key doesn't have a valid value, try next key
        }
        // If not empty/zero, check if it's a valid non-zero number or string
        const numValue = typeof value === 'string' ? parseFloat(value.trim()) : value;
        if (!isNaN(numValue) && numValue !== 0) {
          return true; // Found a valid non-zero quantity
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

    // Find all new rows from hierarchical data
    const newRows = this.findNewRows(rowData);

    // Also check displayData for new rows that might not be in hierarchical structure
    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          // Check if already in newRows
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    // Validate each new row
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

    // Build error message if validation failed
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
      // Existing rows don't need SKU validation
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
      // For existing rows, payload validation is less strict
      return { isValid: true, message: '' };
    }

    const { count: selectedCount, skuIds: selectedSkuIds } = this.countSkusWithValues(row, skuInfo);

    if (selectedCount === 0) {
      // This should have been caught by validateRowSkus, but double-check
      return { isValid: false, message: 'No SKUs selected in row' };
    }

    // Get SKU IDs from payload
    const payloadSkuIds = payloadSkus
      .map((sku) => String(sku.skuId || sku.skuNumber || ''))
      .filter((id) => id !== '');

    // Check if payload matches selected SKUs
    if (selectedCount === 1) {
      // Only one SKU selected - payload should have exactly one matching SKU
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
      // Multiple SKUs selected - all selected SKUs must be in payload
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

      // Check for extra SKUs in payload that weren't selected
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

    // Find all new rows from hierarchical data
    const newRows = this.findNewRows(rowData);

    // Also check displayData for new rows that might not be in hierarchical structure
    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          // Check if already in newRows
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    // Validate each new row's SKU selection
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

    // Build error message if validation failed
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
   * Validate that there are no duplicate Feature+Part+SKU combinations
   * Checks ONLY: section, bomLinkFeature, partNumber, and SKU IDs
   * @param rowData - Hierarchical row data (with children)
   * @param displayData - Flat display data (optional, for rows not yet in hierarchy)
   * @param skuInfo - Array of SKU info objects with skuId property
   * @returns Validation result with duplicate information
   */
  /**
   * Validate duplicate Feature+Part+SKU combinations
   *
   * VALIDATION LOGIC:
   *
   * FOR MBOM:
   * - Show row if: partNumber is NOT empty AND ptcbomPartMarkUp === 'enumMBOM001' (visible in grid)
   * - Show row if: partNumber is NOT empty AND ptcbomPartMarkUp !== 'enumMBOM001' (visible in grid)
   * - Hide row if: partNumber == empty
   *
   * 🔴 FIRST VALIDATION (MOST IMPORTANT - MUST RUN FIRST):
   * - If new row has partNumber NOT empty:
   *   - Check against existing rows with ptcbomPartMarkUp === 'enumMBOM001' in mock.json
   *   - Duplicate key: feature + section + partNumber + skuId
   *   - If duplicate found → Error: "Duplicate Part for the chosen Feature and SKU"
   *   - This prevents creating the same MBOM entry again
   *
   * Case A: partNumber is empty in new row
   * - Row hidden in UI
   * - ❌ NO duplicate validation (skip)
   * - Payload constructed using SKU match (check existing skus array, map by skuId, send that object if found, otherwise use skuInfo)
   *
   * Case B: partNumber NOT empty AND ptcbomPartMarkUp !== 'enumMBOM001' in mock.json (existing row)
   * - Row visible in UI
   * - ✅ Duplicate validation applies
   * - Same rule: feature + section + partNumber + skuId
   * - But error message different: "Duplicate Feature for the chosen SKU" (only feature is duplicated, not part)
   *
   * FOR SBOM:
   * - No ptcbomPartMarkUp concept
   * - If partNumber is empty → NO duplicate check (skip validation)
   * - If partNumber is NOT empty → Check feature + section + partNumber + skuId
   *
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
    apiData?: any // Optional: Original API data to check ALL rows including hidden ones
  ): ValidationResult {
    console.log('[DUPLICATE CHECK] Starting validation...');

    // Separate new rows from existing rows
    // RULE: New rows are always visible (user-created), so we only validate visible new rows
    // New rows are in displayData with isNewRow=true or newRowId
    const newRows: any[] = [];
    const existingRows: any[] = [];

    // First, check displayData for new rows (they have isNewRow or newRowId)
    // NOTE: New rows are always visible because they're user-created
    if (displayData && displayData.length > 0) {
      for (const row of displayData) {
        if (row.isNewRow || row.newRowId !== undefined) {
          // New rows are always visible (user-created), so we validate them
          newRows.push(row);
        }
      }
    }

    // Get bomType to determine validation rules
    const bomType = this.dataService.getBomType();
    const isMbom = bomType === 'MBOM';
    const isSbom = bomType === 'SBOM';

    // IMPORTANT: Check against ALL API instances (including hidden rows) if provided
    // This ensures we catch duplicates even if rows are filtered out from UI
    if (apiData && apiData.instances && Array.isArray(apiData.instances)) {
      console.log(`[DUPLICATE CHECK] Checking against ALL API instances (BOM Type: ${bomType})`);
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

        // For MBOM with ptcbomPartMarkUp === 'enumMBOM001': Skip rows with empty partNumber (requires partNumber)
        // For MBOM with ptcbomPartMarkUp !== 'enumMBOM001': Include rows with empty partNumber (checks Section+Feature+SKU, no partNumber)
        // For SBOM: Skip rows with empty partNumber (no duplicate check)
        if (isMbom && ptcbomPartMarkUp === 'enumMBOM001' && isEmptyPartNumber) {
          continue; // Skip - requires partNumber for duplicate check
        }
        if (isSbom && isEmptyPartNumber) {
          continue; // Skip - no duplicate validation for empty partNumber in SBOM
        }

        // Build row-like object for SKU counting
        const rowLike: any = {
          section: section,
          partNumber: partNumber,
          bomLinkFeature: bomLinkFeature,
          ptcbomPartMarkUp: ptcbomPartMarkUp, // Store for MBOM validation logic
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
                // Also set the value in rowLike for countSkusWithValues (if value exists)
                const skuFieldName = `sku${sku.skuId}`;
                if (
                  sku.value !== undefined &&
                  sku.value !== null &&
                  String(sku.value).trim() !== ''
                ) {
                  rowLike[skuFieldName] = sku.value;
                } else {
                  // Set empty string to mark SKU ID exists (even without value)
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
          // Merge SKUs: Add SKU IDs and values from this row to the existing row
          const existingRow = existingRows[existingIndex];

          // Merge SKU IDs (even if values are empty)
          if (!existingRow._allSkuIds) {
            existingRow._allSkuIds = [];
          }
          skuIdsFromApi.forEach((skuId: string) => {
            if (!existingRow._allSkuIds.includes(skuId)) {
              existingRow._allSkuIds.push(skuId);
            }
          });

          // Merge SKU values (if they exist)
          bomLink.skus.forEach((sku: any) => {
            if (
              sku &&
              sku.skuId &&
              sku.value !== undefined &&
              sku.value !== null &&
              String(sku.value).trim() !== ''
            ) {
              const skuFieldName = `sku${sku.skuId}`;
              // Only add if not already present (avoid overwriting)
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
          // New combination, add it
          existingRows.push(rowLike);
        }
      }
    } else {
      // Fallback: Collect existing rows from hierarchical rowData (filtered rows only)
      const collectRows = (rows: any[]) => {
        for (const row of rows) {
          if (row.isDirectRow || row.isSubRow) {
            // Skip if it's a new row (has newRowId)
            // Also ensure it's not already added from displayData if it somehow got there
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

    console.log(
      `[DUPLICATE CHECK] NEW rows: ${newRows.length}, EXISTING rows: ${existingRows.length}`
    );
    newRows.forEach((row, idx) => {});
    existingRows.forEach((row, idx) => {});

    // Build map structure based on ptcbomPartMarkUp:
    // MBOM with ptcbomPartMarkUp === 'enumMBOM001': section -> part -> feature -> Set<skuId> (includes partNumber)
    // MBOM with ptcbomPartMarkUp !== 'enumMBOM001': section -> feature -> Set<skuId> (no partNumber)
    // SBOM: section -> part -> feature -> Set<skuId> (always includes partNumber)
    const existingCombinations = new Map<string, Map<string, Map<string, Set<string>>>>(); // For MBOM ptcbomPartMarkUp === 'enumMBOM001' and SBOM
    const existingCombinationsNoPart = new Map<string, Map<string, Set<string>>>(); // For MBOM ptcbomPartMarkUp !== 'enumMBOM001' (feature-only check)
    // Track which combinations in existingCombinations are from ptcbomPartMarkUp !== 'enumMBOM001' (for Case B error message)
    const existingCombinationsNoPartWithPart = new Map<
      string,
      Map<string, Map<string, Set<string>>>
    >(); // For MBOM ptcbomPartMarkUp !== 'enumMBOM001' with partNumber

    // Store EXISTING rows - merge SKUs based on combination type
    for (const row of existingRows) {
      const section = row.section || '';
      const partNumber = String(row.partNumber || '').trim();
      const bomLinkFeature = String(row.bomLinkFeature || '').trim();
      const ptcbomPartMarkUp = row.ptcbomPartMarkUp || '';

      // Require section and feature
      if (!section || !bomLinkFeature) {
        console.log(
          `[EXISTING SKIP] Missing field - Section: ${section}, Part: ${partNumber}, Feature: "${bomLinkFeature}"`
        );
        continue;
      }

      // Get ALL SKU IDs (including those with empty values) for duplicate validation
      const allSkuIds = row._allSkuIds || [];
      const rowSkus = this.countSkusWithValues(row, skuInfo);
      const skuIdsToUse = allSkuIds.length > 0 ? allSkuIds : rowSkus.skuIds;

      if (skuIdsToUse.length === 0) {
        console.log(
          `[EXISTING SKIP] No SKUs found - Section: ${section}, Part: ${partNumber}, Feature: "${bomLinkFeature}"`
        );
        continue;
      }

      console.log(
        `[EXISTING] Section: ${section}, Part: ${partNumber}, Feature: "${bomLinkFeature}", ptcbomPartMarkUp: ${ptcbomPartMarkUp}, SKUs: [${skuIdsToUse.join(
          ', '
        )}]`
      );

      const isEmptyPartNumber = !partNumber || partNumber === '';

      // Store rows based on ptcbomPartMarkUp value
      if (isMbom && ptcbomPartMarkUp === 'enumMBOM001') {
        // MBOM with ptcbomPartMarkUp === 'enumMBOM001': Only store rows with partNumber NOT empty
        // Skip rows with empty partNumber for this case (requires partNumber in duplicate check)
        if (isEmptyPartNumber) {
          console.log(
            `[SKIP EMPTY PART] Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}", ptcbomPartMarkUp=enumMBOM001`
          );
          continue;
        }
        // MBOM with ptcbomPartMarkUp === 'enumMBOM001': Store as Section+Part+Feature (includes partNumber)
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

        console.log(
          `[MERGE MBOM ptcbomPartMarkUp=enumMBOM001] Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}", SKUs: [${Array.from(
            skuSet
          ).join(', ')}]`
        );
      } else if (isMbom && ptcbomPartMarkUp !== 'enumMBOM001') {
        // MBOM with ptcbomPartMarkUp !== 'enumMBOM001': Store in multiple maps
        // This includes rows with ptcbomPartMarkUp === "" (empty string) or any other value != 'enumMBOM001'
        // 1. Store in existingCombinationsNoPartWithPart (with partNumber) if partNumber is NOT empty - for Case B validation
        // 2. Store in existingCombinationsNoPart (without partNumber) - for feature-only duplicate check

        console.log(
          `[STORE MBOM ptcbomPartMarkUp!=enumMBOM001] Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}", ptcbomPartMarkUp="${ptcbomPartMarkUp}", isEmptyPartNumber=${isEmptyPartNumber}`
        );

        // Store in existingCombinationsNoPartWithPart (with partNumber) if partNumber is NOT empty
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

          console.log(
            `[MERGE MBOM ptcbomPartMarkUp!=enumMBOM001 WITH PART] Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}", SKUs: [${Array.from(
              skuSet
            ).join(', ')}]`
          );
        }

        // Also store in existingCombinationsNoPart (without partNumber) for feature-only checks
        // BUT: Only store if partNumber is NOT empty
        // RULE: If existing row has empty partNumber, skip duplicate check when new row has any partNumber
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

          console.log(
            `[MERGE MBOM ptcbomPartMarkUp!=enumMBOM001 NO PART] Section="${section}", Feature="${bomLinkFeature}", Part="${partNumber}", SKUs: [${Array.from(
              skuSetNoPart
            ).join(', ')}]`
          );
        } else {
          console.log(
            `[SKIP EMPTY PART FOR DUPLICATE CHECK] Section="${section}", Feature="${bomLinkFeature}", Part="${
              partNumber || '(empty)'
            }" - Will skip duplicate check when new row has partNumber`
          );
        }
      } else {
        // SBOM: Store as Section+Part+Feature (includes partNumber)
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

        console.log(
          `[MERGE SBOM] Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}", SKUs: [${Array.from(
            skuSet
          ).join(', ')}]`
        );
      }
    }

    console.log('[DUPLICATE CHECK] Existing combinations:', existingCombinations);

    // Check NEW rows for duplicates
    // RULE: Only validate visible new rows (new rows are always visible - user-created)
    // Check against ALL backend rows (visible + hidden) to prevent duplicates
    const invalidRows: InvalidRow[] = [];

    for (const row of newRows) {
      // Resolve section: Use sectionDetails to map display name to internal ID
      let section = row.section || '';
      const sectionDetails = apiData?.sectionDetails || {};
      let sectionDisplayName = row.sectionDisplayName || '';

      // If not found on row, check parent chain
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

      // Map display name to internal ID using sectionDetails
      if (sectionDisplayName && Object.keys(sectionDetails).length > 0) {
        const foundInternalId = Object.keys(sectionDetails).find(
          (internalId) => sectionDetails[internalId] === sectionDisplayName
        );
        if (foundInternalId) {
          section = foundInternalId;
          console.log(
            `[VALIDATION] Resolved section "${row.section}" -> "${foundInternalId}" using sectionDisplayName "${sectionDisplayName}"`
          );
        }
      }

      const partNumber = String(row.partNumber || '').trim();
      const bomLinkFeature = String(row.bomLinkFeature || '').trim();
      const isEmptyPartNumber = !partNumber || partNumber === '';

      console.log(
        `[NEW ROW] Section: "${section}", Part: "${partNumber}", Feature: "${bomLinkFeature}", EmptyPart: ${isEmptyPartNumber}, BOMType: ${bomType}`
      );

      // Require section and feature
      if (!section || !bomLinkFeature) {
        console.log(
          `[SKIP] Missing required field - Section: ${section}, Part: ${partNumber}, Feature: ${bomLinkFeature}`
        );
        continue;
      }

      // CASE 1: partNumber is empty → NO duplicate check (skip validation)
      if (isEmptyPartNumber) {
        console.log(`[SKIP] Empty partNumber - no duplicate check (Case 1)`);
        continue;
      }

      const rowSkus = this.countSkusWithValues(row, skuInfo);
      if (rowSkus.count === 0) {
        console.log(`[SKIP] No SKUs with values`);
        continue;
      }

      console.log(`[NEW ROW] SKUs with values: [${rowSkus.skuIds.join(', ')}]`);

      let foundDuplicate = false;
      const duplicateSkus: string[] = [];
      let duplicateType: 'enumMBOM001' | 'notEnumMBOM001' | 'sbom' | null = null; // Track which type of duplicate

      if (isMbom) {
        // 🔴 FIRST VALIDATION (MOST IMPORTANT): Check against rows with ptcbomPartMarkUp === 'enumMBOM001'
        // This is the primary check that must run FIRST
        // Duplicate key: feature + section + partNumber + skuId
        const sectionMap = existingCombinations.get(section);
        if (sectionMap) {
          const partMap = sectionMap.get(partNumber);
          if (partMap) {
            const existingSkuSet = partMap.get(bomLinkFeature);
            if (existingSkuSet) {
              for (const skuId of rowSkus.skuIds) {
                if (existingSkuSet.has(skuId)) {
                  console.log(
                    `[DUPLICATE MBOM ptcbomPartMarkUp=enumMBOM001!] SKU ${skuId} already exists for Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}"`
                  );
                  duplicateSkus.push(skuId);
                  foundDuplicate = true;
                  duplicateType = 'enumMBOM001';
                }
              }
            }
          }
        }

        // Case B: Check against rows with ptcbomPartMarkUp !== 'enumMBOM001' (with partNumber NOT empty)
        // Rule: feature + section + skuId (NO partNumber requirement)
        // Error message: only feature is duplicated (not part)
        // This checks existingCombinationsNoPart which stores by section -> feature -> Set<skuId>
        if (!foundDuplicate) {
          console.log(
            `[CASE B CHECK] Checking against existingCombinationsNoPart for Section="${section}", Feature="${bomLinkFeature}"`
          );
          console.log(
            `[CASE B CHECK] Available sections in existingCombinationsNoPart:`,
            Array.from(existingCombinationsNoPart.keys())
          );
          const sectionMapNoPart = existingCombinationsNoPart.get(section);
          if (sectionMapNoPart) {
            console.log(
              `[CASE B CHECK] Found section map. Available features:`,
              Array.from(sectionMapNoPart.keys())
            );
            const existingSkuSet = sectionMapNoPart.get(bomLinkFeature);
            if (existingSkuSet) {
              console.log(
                `[CASE B CHECK] Found feature. Existing SKUs:`,
                Array.from(existingSkuSet)
              );
              for (const skuId of rowSkus.skuIds) {
                if (existingSkuSet.has(skuId)) {
                  console.log(
                    `[DUPLICATE MBOM ptcbomPartMarkUp!=enumMBOM001!] SKU ${skuId} already exists for Section="${section}", Feature="${bomLinkFeature}" (Case B: feature duplicate, no partNumber check)`
                  );
                  duplicateSkus.push(skuId);
                  foundDuplicate = true;
                  duplicateType = 'notEnumMBOM001';
                }
              }
            } else {
              console.log(`[CASE B CHECK] Feature "${bomLinkFeature}" not found in section map`);
            }
          } else {
            console.log(
              `[CASE B CHECK] Section "${section}" not found in existingCombinationsNoPart`
            );
          }
        }
      } else {
        // SBOM: Check Section + Feature + PartNumber + SKU ID (includes partNumber)
        const sectionMap = existingCombinations.get(section);
        if (sectionMap) {
          const partMap = sectionMap.get(partNumber);
          if (partMap) {
            const existingSkuSet = partMap.get(bomLinkFeature);
            if (existingSkuSet) {
              for (const skuId of rowSkus.skuIds) {
                if (existingSkuSet.has(skuId)) {
                  console.log(
                    `[DUPLICATE SBOM!] SKU ${skuId} already exists for Section="${section}", Part="${partNumber}", Feature="${bomLinkFeature}"`
                  );
                  duplicateSkus.push(skuId);
                  foundDuplicate = true;
                  duplicateType = 'sbom';
                }
              }
            }
          }
        }
      }

      if (foundDuplicate) {
        console.log(
          `[DUPLICATE ROW!] Duplicate SKUs: [${duplicateSkus.join(', ')}], Type: ${duplicateType}`
        );
        const rowId = row.newRowId || row.partNumber || 'Unknown';
        invalidRows.push({
          row,
          missingFields: [],
          rowId,
          duplicateType, // Store duplicate type for error message
        });
      } else {
        console.log(`[UNIQUE] No duplicate found`);
      }
    }

    // Determine error message based on duplicate type
    let errorMessage = 'Duplicate Part for the chosen Feature and SKU';
    if (invalidRows.length > 0) {
      const firstDuplicate = invalidRows[0] as any;
      if (firstDuplicate.duplicateType === 'notEnumMBOM001') {
        errorMessage = 'Duplicate Feature for the chosen SKU'; // Case B: only feature is duplicated
      } else if (firstDuplicate.duplicateType === 'enumMBOM001') {
        errorMessage = 'Duplicate Feature and Part for the chosen SKU'; // First validation: part + feature duplicated
      } else if (firstDuplicate.duplicateType === 'sbom') {
        errorMessage = 'Duplicate Feature and Part for the chosen SKU'; // SBOM: part + feature duplicated
      }
    }

    const result = {
      isValid: invalidRows.length === 0,
      message:
        invalidRows.length > 0 ? errorMessage : 'No duplicate Feature+Part+SKU combinations found.',
      invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
    };

    console.log('[RESULT]', result.isValid ? 'VALID' : 'INVALID');
    console.log(`[RESULT] ${invalidRows.length} duplicate row(s) found`);

    return result;
  }
}
