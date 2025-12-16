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
}
