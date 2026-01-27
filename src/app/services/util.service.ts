import { Injectable } from '@angular/core';
import { GridApi, ColDef } from 'ag-grid-community';

// Extended ColDef interface for type safety (custom properties should use context)
export interface ExtendedColDef extends ColDef {
  // Custom properties should be placed in context property
  isVirtual?: boolean; // Indicates if column is virtual (not a real grid column)
  hide?: boolean; // Custom property to track column visibility state
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
    const match = mmddyyyyPattern.exec(dateStr);
    if (match) {
      const [, month, day, year] = match;
      return `${year}/${Number.parseInt(month, 10)}/${Number.parseInt(day, 10)}`;
    }

    // Try to parse as Date object or ISO string
    const date = new Date(dateStr);
    if (!Number.isNaN(date.getTime())) {
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
    const numValue = typeof quantity === 'string' ? Number.parseFloat(quantity) : Number(quantity);

    // Check if valid number
    if (Number.isNaN(numValue)) {
      return null;
    }

    // Format to 2 decimal places and return as float
    // Using Number.parseFloat to ensure it's a number, not a string
    return Number.parseFloat(numValue.toFixed(2));
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
    const numValue = typeof quantity === 'string' ? Number.parseFloat(quantity) : Number(quantity);

    // Check if valid number
    if (Number.isNaN(numValue)) {
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

    const aNum = typeof a === 'string' ? Number.parseFloat(a) : a;
    const bNum = typeof b === 'string' ? Number.parseFloat(b) : b;

    let aVal: any;
    let bVal: any;
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && typeof a === 'string' && typeof b === 'string') {
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
      selectedNodes?: any[];
    } = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      (async () => {
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
          reject(new Error('No columns found for export'));
          return;
        }

        // Filter out hidden columns and excluded columns
        const visibleColumns = this.getVisibleColumnsForExport(allColumns, excludedFields);

        // Get row data - either selected nodes or all nodes
        const { rowData, rowNodes } = this.getRowDataForExport(gridApi, options, excludeHeaderRows);

        // Prepare data for Excel export
        const excelData: any[] = [];

        // Add header row with Section column as first column
        const headers: string[] = ['Section', ...this.getColumnHeaders(visibleColumns)];
        excelData.push(headers);

        // Add data rows
        this.addDataRowsToExcel(excelData, rowData, rowNodes, visibleColumns);

        // Dynamically import xlsx library only when needed (reduces initial bundle size)
        const XLSX = await import('xlsx');

        // Create workbook and worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Set column widths (include Section column)
        const colWidths = this.getColumnWidths(visibleColumns);
        worksheet['!cols'] = colWidths;

        // Generate file name
        const exportFileName =
          fileName || `BOM_Composer_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Write file
        XLSX.writeFile(workbook, exportFileName);

          resolve();
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  /**
   * Get excluded fields for search functionality
   * @returns Set of field names that should be excluded from search
   */
  getExcludedSearchFields(): Set<string> {
    return new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus',
      'materialKey',
      '_availablePartNumbers',
      '_availableSuppliers',
      '_availableColors',
      'newRowId',
      'actions',
    ]);
  }

  /**
   * Check if an array value matches search text
   * @param value - Value to check (should be an array)
   * @param searchLower - Lowercase search text
   * @returns True if any array item matches the search
   */
  matchesArrayValue(value: any, searchLower: string): boolean {
    if (!Array.isArray(value)) {
      return false;
    }

    for (const item of value) {
      if (item !== null && item !== undefined) {
        const itemStr = String(item).toLowerCase();
        if (itemStr.includes(searchLower)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get group header cell style
   * @param groupBackgroundColor - Background color for the group level
   * @param isActionsColumn - Whether this is the actions column
   * @returns Style object for group header
   */
  getGroupHeaderStyle(groupBackgroundColor: string, isActionsColumn: boolean): any {
    return {
      backgroundColor: groupBackgroundColor,
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
      borderLeft: 'none',
      fontWeight: 'bold',
    };
  }

  /**
   * Get section header cell style
   * @param isActionsColumn - Whether this is the actions column
   * @returns Style object for section header
   */
  getSectionHeaderStyle(isActionsColumn: boolean): any {
    return {
      backgroundColor: '#eff6ff',
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
      borderLeft: 'none',
      fontWeight: 'bold',
    };
  }

  /**
   * Get material header cell style
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for material header
   */
  getMaterialHeaderStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#e5e7eb',
      borderLeft: '4px solid #10b981',
      fontWeight: '600',
      color: hasPartForRefSku ? '#ff0000' : 'inherit',
    };
  }

  /**
   * Get parent row cell style
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for parent row
   */
  getParentRowStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#eff6ff',
      borderLeft: '3px solid #3b82f6',
      fontWeight: '500',
      color: hasPartForRefSku ? '#ff0000' : '#1e40af',
    };
  }

  /**
   * Get direct row cell style
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for direct row
   */
  getDirectRowStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      fontWeight: '400',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

  /**
   * Get default row cell style
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for default row
   */
  getDefaultRowStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

  /**
   * Get data cell group header style
   * @param groupBackgroundColor - Background color for the group level
   * @param isActionsColumn - Whether this is the actions column
   * @returns Style object for data cell group header
   */
  getDataGroupHeaderStyle(groupBackgroundColor: string, isActionsColumn: boolean): any {
    return {
      backgroundColor: groupBackgroundColor,
      color: 'transparent',
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
      borderLeft: 'none',
    };
  }

  /**
   * Get data cell section header style
   * @param isActionsColumn - Whether this is the actions column
   * @returns Style object for data cell section header
   */
  getDataSectionHeaderStyle(isActionsColumn: boolean): any {
    return {
      backgroundColor: '#fef3c7',
      borderTop: 'none',
      borderBottom: 'none',
      borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
      borderLeft: 'none',
      fontWeight: 'bold',
      color: '#92400e',
    };
  }

  /**
   * Get data cell material header style
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for data cell material header
   */
  getDataMaterialHeaderStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: 'transparent',
      borderLeft: '4px solid #10b981',
      fontWeight: '600',
      color: hasPartForRefSku ? '#ff0000' : 'inherit',
    };
  }


  /**
   * Get data cell direct row style
   * @param baseStyle - Base style object to extend
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for data cell direct row
   */
  getDataDirectRowStyle(baseStyle: any, hasPartForRefSku: boolean): any {
    return {
      ...baseStyle,
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      fontWeight: '400',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

  /**
   * Get data cell default style
   * @param baseStyle - Base style object to extend
   * @param hasPartForRefSku - Whether row has part for reference SKU
   * @returns Style object for data cell default
   */
  getDataDefaultStyle(baseStyle: any, hasPartForRefSku: boolean): any {
    return {
      ...baseStyle,
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

  /**
   * Check if click is outside a panel (with toggle button exclusion)
   * @param target - Click target element
   * @param isOpen - Whether panel is currently open
   * @param panel - Panel element reference
   * @param toggleBtn - Toggle button element reference
   * @param setter - Function to call to close the panel
   */
  handlePanelClickOutside(
    target: Element,
    isOpen: boolean,
    panel: any,
    toggleBtn: any,
    setter: (value: boolean) => void,
  ): void {
    if (!isOpen) return;
    const panelEl = panel?.nativeElement;
    const toggleEl = toggleBtn?.nativeElement;
    const clickedOutside = panelEl && !panelEl.contains(target) && toggleEl && !toggleEl.contains(target);
    if (clickedOutside) {
      setter(false);
    }
  }

  /**
   * Check if click is outside a dropdown
   * @param target - Click target element
   * @param isOpen - Whether dropdown is currently open
   * @param dropdown - Dropdown element reference
   * @param setter - Function to call to close the dropdown
   */
  handleDropdownClickOutside(
    target: Element,
    isOpen: boolean,
    dropdown: any,
    setter: (value: boolean) => void,
  ): void {
    if (!isOpen) return;
    const dropdownEl = dropdown?.nativeElement;
    const clickedOutside = dropdownEl && !dropdownEl.contains(target);
    if (clickedOutside) {
      setter(false);
    }
  }

  /**
   * Check if a row is a header row (section, group, material, or branch header)
   * @param row - Row data object
   * @returns True if row is a header type
   */
  isHeaderRow(row: any): boolean {
    return (
      !row ||
      row.isSectionHeader ||
      row.isGroupHeader ||
      row.isMaterialHeader ||
      row.isBranchHeader
    );
  }

  /**
   * Extract row data into a structured format
   * @param row - Row data object
   * @returns Extracted row data with section, feature, and partNumber
   */
  extractRowData(row: any): { section: string; feature: string; partNumber: string } {
    return {
      section: row.section || '',
      feature: String(row.bomLinkFeature || '').trim(),
      partNumber: String(row.partNumber || '').trim(),
    };
  }

  /**
   * Extract instance data from BOM link
   * @param bomLink - BOM link object
   * @returns Extracted instance data with section, feature, and partNumber
   */
  extractInstanceData(bomLink: any): { section: string; feature: string; partNumber: string } {
    return {
      section: bomLink.sectionInternalName || bomLink.section || '',
      feature: String(bomLink.bomLinkFeature || '').trim(),
      partNumber: String(bomLink.partNumber || '').trim(),
    };
  }

  /**
   * Determine if part number matching is required based on BOM type
   * @param bomType - BOM type ('SBOM' or 'MBOM')
   * @param rowPartNumber - Part number from row
   * @param instancePartNumber - Part number from instance
   * @returns True if part matching is required
   */
  shouldRequirePartMatch(bomType: string, rowPartNumber: string, instancePartNumber: string): boolean {
    if (bomType === 'SBOM') {
      return true;
    }

    if (bomType === 'MBOM') {
      const rowHasPartNumber = !!(rowPartNumber && String(rowPartNumber).trim() !== '');
      const instanceHasPartNumber = !!(instancePartNumber && String(instancePartNumber).trim() !== '');
      return rowHasPartNumber && instanceHasPartNumber;
    }

    return false;
  }

  /**
   * Check if instance has target SKU IDs
   * @param bomLink - BOM link object
   * @param targetSkuIds - Set of target SKU IDs to check
   * @returns True if instance has any target SKU ID
   */
  instanceHasTargetSku(bomLink: any, targetSkuIds: Set<string>): boolean {
    if (!bomLink.skus || !Array.isArray(bomLink.skus)) {
      return false;
    }

    const instanceSkuIds = new Set(
      bomLink.skus
        .map((sku: any) => (sku?.skuId ? String(sku.skuId).trim() : ''))
        .filter((id: string) => id !== '')
    );

    for (const targetSkuId of targetSkuIds) {
      const normalizedTargetId = String(targetSkuId).trim();
      if (instanceSkuIds.has(normalizedTargetId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if row has target SKU values
   * @param row - Row data object
   * @param targetSkuIds - Set of target SKU IDs to check
   * @returns True if row has any target SKU value
   */
  rowHasTargetSkuValue(row: any, targetSkuIds: Set<string>): boolean {
    for (const targetSkuId of targetSkuIds) {
      const skuFieldName = `sku${targetSkuId}`;
      const skuValue = row[skuFieldName];
      if (skuValue !== undefined && skuValue !== null && String(skuValue).trim() !== '') {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if column is the actions column
   * @param params - AG Grid params object
   * @returns True if column is actions column
   */
  isActionsColumn(params: any): boolean {
    const fieldName = params.colDef?.field;
    const colId = params.column?.getColId() || params.colDef?.colId || fieldName;
    return fieldName === 'actions' || colId === 'actions';
  }

  /**
   * Extract row ID from row data
   * @param row - Row data object
   * @returns Row ID (materialKey, newRowId, partNumber, part, or null)
   */
  getRowId(row: any): string | number | null {
    return row.materialKey || row.newRowId || row.partNumber || row.part || null;
  }

  /**
   * Create autocomplete filter function
   * @returns Filter function for autocomplete
   */
  createAutocompleteFilter(): (searchValue: string, options: string[]) => string[] {
    return (searchValue: string, options: string[]) => {
      if (!searchValue) return options;
      const lower = searchValue.toLowerCase();
      return options.filter((opt) => opt.toLowerCase().includes(lower));
    };
  }

  /**
   * Get all searchable fields from a row (excluding internal/metadata fields)
   * @param row - Row data object
   * @returns Array of searchable field names
   */
  getAllSearchableFields(row: any): string[] {
    const fields: string[] = [];
    const excludedFields = this.getExcludedSearchFields();

    for (const key in row) {
      if (row.hasOwnProperty(key) && !excludedFields.has(key)) {
        fields.push(key);
      }
    }

    return fields;
  }

  /**
   * Recursively find all new rows in hierarchical data structure
   * @param rowData - Hierarchical row data
   * @param displayData - Optional flat display data
   * @returns Array of new row objects
   */
  findAllNewRows(rowData: any[], displayData?: any[]): any[] {
    const newRows: any[] = [];

    // Recursively find new rows in hierarchical data
    const findInHierarchy = (rows: any[]) => {
      rows.forEach((row) => {
        if (row.isNewRow && !this.isHeaderRow(row)) {
          newRows.push(row);
        }
        if (row.children && Array.isArray(row.children)) {
          findInHierarchy(row.children);
        }
      });
    };

    findInHierarchy(rowData);

    // Also check displayData for new rows that might not be in hierarchical structure
    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !this.isHeaderRow(row)) {
          // Check if already in newRows
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    return newRows;
  }

  /**
   * Generate all possible ID variants for a given ID
   * Used for matching row IDs in different formats (string, number, etc.)
   * @param id - ID value (string, number, or any)
   * @returns Set of ID variants
   */
  getIdVariants(id: any): Set<string | number> {
    const variants = new Set<string | number>();
    if (id === null || id === undefined || `${id}`.trim() === '') return variants;
    variants.add(id);
    variants.add(`${id}`);
    const numId = Number(id);
    if (!Number.isNaN(numId)) variants.add(numId);
    return variants;
  }

  /**
   * Get feature value from row
   * @param row - Row data object
   * @returns Feature value
   */
  getFeatureValue(row: any): string {
    return row.bomLinkFeature;
  }

  /**
   * Get part number value from row
   * @param row - Row data object
   * @returns Part number value
   */
  getPartNumberValue(row: any): string {
    return row.partNumber;
  }

  /**
   * Get section value for a row, traversing parent nodes if needed
   * @param row - Row data object
   * @param node - Grid node for parent traversal
   * @returns Section display name or internal name
   */
  private getSectionValueForRow(row: any, node: any): string {
    if (!row) return '';

    let sectionValue = row.sectionDisplayName || row.section || '';
    if (sectionValue) return sectionValue;

    if (!node) return '';

    sectionValue = this.getSectionFromParentNode(node);
    if (sectionValue) return sectionValue;

    return this.traverseParentChainForSection(node);
  }

  private getSectionFromParentNode(node: any): string {
    const parentData = node.parent?.data;
    if (parentData) {
      return parentData.sectionDisplayName || parentData.section || '';
    }
    return '';
  }

  private traverseParentChainForSection(node: any): string {
    let currentParent = node.parent?.parent;
    while (currentParent?.data) {
      const parentData = currentParent.data;
      const section = parentData.sectionDisplayName || parentData.section;
      if (section) {
        return section;
      }
      currentParent = currentParent.parent;
    }
    return '';
  }

  private buildExcelRowData(row: any, node: any, visibleColumns: any[]): any[] {
    const rowDataArray: any[] = [];
    const sectionValue = this.getSectionValueForRow(row, node);
    rowDataArray.push(sectionValue);

    visibleColumns.forEach((col) => {
      const cellValue = this.formatCellValueForExport(row, col.field);
      rowDataArray.push(cellValue);
    });

    return rowDataArray;
  }

  private formatCellValueForExport(row: any, field: string | undefined): string {
    if (!row || !field) return '';

    let cellValue: any = row[field];

    if (cellValue === null || cellValue === undefined) {
      return '';
    }

    if (typeof cellValue === 'object') {
      if (cellValue instanceof Date) {
        return cellValue.toISOString().split('T')[0];
      }
      return JSON.stringify(cellValue);
    }

    return String(cellValue);
  }

  private getVisibleColumnsForExport(allColumns: any[], excludedFields: string[]): any[] {
    return allColumns
      .filter((col) => this.isColumnVisibleForExport(col, excludedFields))
      .map((col) => this.mapColumnForExport(col));
  }

  private isColumnVisibleForExport(col: any, excludedFields: string[]): boolean {
    if (!col.isVisible()) return false;

    const field = col.getColId();
    if (excludedFields.includes(field)) return false;

    const colDef = col.getColDef();
    const colContext = colDef.context as { excludeFromExport?: boolean } | undefined;
    if (colContext?.excludeFromExport === true) return false;

    return true;
  }

  private mapColumnForExport(col: any): any {
    const colDef = col.getColDef();
    return {
      field: col.getColId(),
      headerName: colDef.headerName || col.getColId(),
      col: col,
    };
  }

  private getRowDataForExport(
    gridApi: GridApi,
    options: { selectedNodes?: any[]; excludeHeaderRows?: boolean },
    excludeHeaderRows: boolean
  ): { rowData: any[]; rowNodes: any[] } {
    const rowData: any[] = [];
    const rowNodes: any[] = [];

    if (options.selectedNodes && options.selectedNodes.length > 0) {
      this.processSelectedNodes(options.selectedNodes, rowData, rowNodes, excludeHeaderRows);
    } else {
      this.processAllNodes(gridApi, rowData, rowNodes, excludeHeaderRows);
    }

    return { rowData, rowNodes };
  }

  private processSelectedNodes(
    selectedNodes: any[],
    rowData: any[],
    rowNodes: any[],
    excludeHeaderRows: boolean
  ): void {
    selectedNodes.forEach((node) => {
      if (!node.data) return;
      if (excludeHeaderRows && this.isHeaderRow(node.data)) return;
      rowData.push(node.data);
      rowNodes.push(node);
    });
  }

  private processAllNodes(
    gridApi: GridApi,
    rowData: any[],
    rowNodes: any[],
    excludeHeaderRows: boolean
  ): void {
    gridApi.forEachNode((node) => {
      if (!node.data) return;
      if (excludeHeaderRows && this.isHeaderRow(node.data)) return;
      rowData.push(node.data);
      rowNodes.push(node);
    });
  }

  private getColumnHeaders(visibleColumns: any[]): string[] {
    return visibleColumns.map((col) => col.headerName);
  }

  private addDataRowsToExcel(
    excelData: any[],
    rowData: any[],
    rowNodes: any[],
    visibleColumns: any[]
  ): void {
    rowData.forEach((row, index) => {
      const rowDataArray = this.buildExcelRowData(row, rowNodes[index], visibleColumns);
      excelData.push(rowDataArray);
    });
  }

  private getColumnWidths(visibleColumns: any[]): any[] {
    return [{ wch: 20 }, ...visibleColumns.map(() => ({ wch: 15 }))];
  }
}
