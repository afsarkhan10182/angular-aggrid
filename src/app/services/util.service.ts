import { Injectable } from '@angular/core';
import { GridApi, ColDef } from 'ag-grid-community';

// Extended ColDef interface for type safety (custom properties should use context)
export interface ExtendedColDef extends ColDef {
  // Custom properties should be placed in context property
}

@Injectable({
  providedIn: 'root',
})
export class UtilService {
  /**
   * Convert date from MM/DD/YYYY format to API format (YYYY/M/D)
   * Example: "10/30/2025" -> "2025/10/30"
   * @param dateStr - Date string in various formats
   * @returns Formatted date string in YYYY/M/D format or empty string
   */
  convertDateToApiFormat(dateStr: string): string {
    if (!dateStr) return '';

    // If already in YYYY/M/D format, return as-is
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      return dateStr;
    }

    // Try to parse MM/DD/YYYY format
    const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(mmddyyyyPattern);
    if (match) {
      const [, month, day, year] = match;
      return `${year}/${parseInt(month)}/${parseInt(day)}`;
    }

    // Try to parse as Date object or ISO string
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}/${month}/${day}`;
    }

    // Return as-is if can't parse
    return dateStr;
  }

  /**
   * Format quantity to float with 2 decimal places
   * Example: "10" -> 10.00, "3.5" -> 3.50, "10.123" -> 10.12
   * @param quantity - Quantity value (string, number, or any)
   * @returns A number (float) formatted to 2 decimal places, or null for invalid/empty values
   */
  formatQuantityToFloat(quantity: any): number | null {
    if (quantity === undefined || quantity === null || quantity === '') {
      return null;
    }

    // Convert to number
    const numValue = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);

    // Check if valid number
    if (isNaN(numValue)) {
      return null;
    }

    // Format to 2 decimal places and return as float
    // Using parseFloat to ensure it's a number, not a string
    return parseFloat(numValue.toFixed(2));
  }

  /**
   * Format quantity to string with 2 decimal places
   * Example: "10" -> "10.00", "3.5" -> "3.50", empty -> ""
   * @param quantity - Quantity value (string, number, or any)
   * @returns A string formatted to 2 decimal places, or empty string for invalid/empty values
   */
  formatQuantityToString(quantity: any): string {
    if (quantity === undefined || quantity === null || quantity === '') {
      return '';
    }

    // Convert to number
    const numValue = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);

    // Check if valid number
    if (isNaN(numValue)) {
      return '';
    }

    // Format to 2 decimal places and return as string
    return numValue.toFixed(2);
  }

  /**
   * Escape HTML special characters to prevent XSS attacks
   * @param text - Text to escape
   * @returns Escaped HTML string
   */
  escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Convert array of key-value pairs to object
   * @param keyValuePairs - Array of objects with 'key' and 'value' properties
   * @returns Object with keys and values from the pairs
   */
  convertKeyValuePairsToObject(keyValuePairs: any[]): any {
    const obj: any = {};
    keyValuePairs.forEach((pair) => {
      if (pair.key && pair.value !== null && pair.value !== undefined) {
        obj[pair.key] = pair.value;
      }
    });
    return obj;
  }

  /**
   * Check if text is likely to be truncated based on column width
   * @param text - Text to check
   * @param columnWidth - Width of the column in pixels
   * @returns True if text is likely truncated
   */
  isTextLikelyTruncated(text: string | null | undefined, columnWidth: number): boolean {
    if (!text) return false;
    const textStr = String(text);
    const estimatedPixelsNeeded = textStr.length * 9 + 16;
    return estimatedPixelsNeeded > columnWidth;
  }

  /**
   * Create cell content with tooltip if text is likely truncated
   * @param value - Cell value
   * @param columnWidth - Width of the column in pixels
   * @param color - Optional text color to apply
   * @returns HTML string with tooltip if needed
   */
  createCellContentWithTooltip(value: any, columnWidth: number, color?: string): string {
    if (!value && value !== 0) return '';
    const textStr = String(value);
    const escapedText = this.escapeHtml(textStr);
    const shouldShowTooltip = this.isTextLikelyTruncated(textStr, columnWidth);

    const colorStyle = color ? `color: ${color};` : '';
    
    if (shouldShowTooltip) {
      return `<span style="${colorStyle}overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; width: 100%;">${escapedText}</span>`;
    }
    if (color) {
      return `<span style="${colorStyle}">${escapedText}</span>`;
    }
    return escapedText;
  }

  /**
   * Extract ID after the last colon in a string
   * @param idString - String containing ID with colon separator
   * @returns ID after last colon, or original string if no colon found
   */
  extractIdAfterLastColon(idString: string): string {
    if (!idString) return '';
    const lastColonIndex = idString.lastIndexOf(':');
    if (lastColonIndex !== -1) {
      return idString.substring(lastColonIndex + 1);
    }
    return idString;
  }

  /**
   * Compare two values for sorting
   * Handles null/undefined, numbers, and strings
   * @param a - First value to compare
   * @param b - Second value to compare
   * @param sortDirection - Sort direction ('asc' or 'desc')
   * @returns Comparison result (-1, 0, or 1)
   */
  compareValues(a: any, b: any, sortDirection: 'asc' | 'desc'): number {
    if (a === null || a === undefined) {
      return b === null || b === undefined ? 0 : 1;
    }
    if (b === null || b === undefined) {
      return -1;
    }

    let aVal: any = a;
    let bVal: any = b;

    const aNum = typeof a === 'string' ? parseFloat(a) : a;
    const bNum = typeof b === 'string' ? parseFloat(b) : b;

    if (!isNaN(aNum) && !isNaN(bNum) && typeof a === 'string' && typeof b === 'string') {
      aVal = aNum;
      bVal = bNum;
    } else {
      aVal = String(a).toLowerCase();
      bVal = String(b).toLowerCase();
    }

    let result = 0;
    if (aVal < bVal) {
      result = -1;
    } else if (aVal > bVal) {
      result = 1;
    }

    return sortDirection === 'desc' ? -result : result;
  }

  /**
   * Get JSP data attribute value from angular-root element
   * Used to retrieve data attributes passed from Windchill JSP pages
   * @param attributeName - Name of the data attribute (e.g., 'data-bomid', 'data-host')
   * @returns Attribute value or null if not found
   */
  getJspDataAttribute(attributeName: string): string | null {
    const angularRoot = document.getElementById('angular-root');
    return angularRoot?.getAttribute(attributeName) || null;
  }

  /**
   * Export grid data to Excel file
   * Uses dynamic import to lazy-load xlsx library, reducing initial bundle size
   * @param gridApi - AG Grid API instance
   * @param options - Export options
   * @param options.excludedFields - Array of field names to exclude from export
   * @param options.fileName - Custom file name (default: BOM_Composer_Export_YYYY-MM-DD.xlsx)
   * @param options.sheetName - Custom sheet name (default: 'BOM Export')
   * @param options.excludeHeaderRows - Whether to exclude section/group/material headers (default: true)
   * @returns Promise that resolves when export is complete, or throws error
   */
  exportGridToExcel(
    gridApi: GridApi,
    options: {
      excludedFields?: string[];
      fileName?: string;
      sheetName?: string;
      excludeHeaderRows?: boolean;
    } = {}
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const {
          excludedFields = ['actions'],
          fileName,
          sheetName = 'BOM Export',
          excludeHeaderRows = true,
        } = options;

        // Get all visible columns (excluding hidden ones)
        const allColumns = gridApi.getColumns();
        if (!allColumns || allColumns.length === 0) {
          console.warn('No columns found for export');
          reject(new Error('No columns found for export'));
          return;
        }

        // Filter out hidden columns and excluded columns
        const visibleColumns = allColumns
          .filter((col) => {
            if (!col.isVisible()) return false;

            const colDef = col.getColDef();
            const field = col.getColId();

            // Exclude if field is in the excluded list
            if (excludedFields.includes(field)) return false;

            // Exclude if column definition has excludeFromExport in context set to true
            const colContext = colDef.context as any;
            if (colContext?.excludeFromExport === true) return false;

            return true;
          })
          .map((col) => {
            const colDef = col.getColDef();
            return {
              field: col.getColId(),
              headerName: colDef.headerName || col.getColId(),
              col: col,
            };
          });

        // Get all row data (excluding group headers, section headers, etc.)
        const rowData: any[] = [];
        const rowNodes: any[] = [];
        gridApi.forEachNode((node) => {
          if (!node.data) return;

          // Skip header rows if excludeHeaderRows is true
          if (excludeHeaderRows) {
            if (
              node.data.isSectionHeader ||
              node.data.isGroupHeader ||
              node.data.isMaterialHeader ||
              node.data.isBranchHeader
            ) {
              return;
            }
          }

          rowData.push(node.data);
          rowNodes.push(node); // Store node reference to access parent section info if needed
        });

        // Prepare data for Excel export
        const excelData: any[] = [];

        // Add header row with Section column as first column
        const headers: string[] = ['Section', ...visibleColumns.map((col) => col.headerName)];
        excelData.push(headers);

        // Add data rows
        rowData.forEach((row, index) => {
          const rowDataArray: any[] = [];

          // Add section information as first column
          // Prefer sectionDisplayName (user-friendly name) over section (internal name)
          let sectionValue = '';
          if (row) {
            sectionValue = row.sectionDisplayName || row.section || '';

            // If section is not in row data, try to get it from parent node
            if (!sectionValue && rowNodes[index]) {
              const node = rowNodes[index];
              // Check parent node for section information
              if (node.parent && node.parent.data) {
                const parentData = node.parent.data;
                sectionValue = parentData.sectionDisplayName || parentData.section || '';
              }
              // If still not found, traverse up the parent chain
              if (!sectionValue && node.parent) {
                let currentParent = node.parent.parent;
                while (currentParent && currentParent.data && !sectionValue) {
                  const parentData = currentParent.data;
                  if (parentData.sectionDisplayName || parentData.section) {
                    sectionValue = parentData.sectionDisplayName || parentData.section;
                    break;
                  }
                  currentParent = currentParent.parent;
                }
              }
            }
          }
          rowDataArray.push(sectionValue);

          // Add other column values
          visibleColumns.forEach((col) => {
            let cellValue: any = '';

            // Get the cell value from the row data
            if (row && col.field) {
              cellValue = row[col.field];
            }

            // Handle null/undefined values
            if (cellValue === null || cellValue === undefined) {
              cellValue = '';
            } else if (typeof cellValue === 'object') {
              // Convert objects to string
              cellValue = JSON.stringify(cellValue);
            } else if (cellValue instanceof Date) {
              // Format dates properly for Excel
              cellValue = cellValue.toISOString().split('T')[0];
            } else {
              cellValue = String(cellValue);
            }

            rowDataArray.push(cellValue);
          });
          excelData.push(rowDataArray);
        });

        // Dynamically import xlsx library only when needed (reduces initial bundle size)
        const XLSX = await import('xlsx');

        // Create workbook and worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Set column widths (include Section column)
        const colWidths = [{ wch: 20 }, ...visibleColumns.map(() => ({ wch: 15 }))];
        worksheet['!cols'] = colWidths;

        // Generate file name
        const exportFileName =
          fileName || `BOM_Composer_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Write file
        XLSX.writeFile(workbook, exportFileName);

        resolve();
      } catch (error) {
        console.error('Error exporting to Excel:', error);
        reject(error);
      }
    });
  }
}
