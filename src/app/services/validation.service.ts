import { Injectable } from '@angular/core';

export interface RequiredField {
  keys: string[];
  label: string;
}

export interface InvalidRow {
  row: any;
  missingFields: string[];
  rowId: string | number;
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
  /**
   * Default required fields for new BOM rows
   */
  private readonly defaultRequiredFields: RequiredField[] = [
    { keys: ['bomLinkFeature', 'feature'], label: 'Feature' },
    { keys: ['materialDescription', 'material'], label: 'Material' },
    { keys: ['supplier'], label: 'Supplier' },
    { keys: ['colorDescription', 'color'], label: 'Color' },
    { keys: ['partNumber', 'part'], label: 'Part' },
    { keys: ['bomLinkStartDate', 'startDate'], label: 'Start Date' },
    { keys: ['bomLinkEndDate', 'endDate'], label: 'End Date' },
    { keys: ['quantity', 'qty'], label: 'Quantity' },
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
      if (!this.isEmpty(value)) {
        return true;
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
}
