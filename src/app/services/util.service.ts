// Product BOM utility service: contains shared row, hierarchy, styling, search, and value helpers used across the Product MBOM grid.
import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { GridApi, ColDef } from 'ag-grid-community';
import {
  COL_ACTIONS,
  FIELD_PART_NUMBER,
  FIELD_HAS_LINKED_BOM,
} from '../constants';

export interface ExtendedColDef extends ColDef {
  isVirtual?: boolean;
  hide?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UtilService {
  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  /**
   * Convert date from MM/DD/YYYY format to API format (YYYY/M/D)
   * Example: "10/30/2025" -> "2025/10/30"
   * @param dateStr - Date string in various formats
   * @returns Formatted date string in YYYY/M/D format or empty string
   */
  convertDateToApiFormat(dateStr: string): string {
    if (!dateStr) return '';

    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      return dateStr;
    }

    const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = mmddyyyyPattern.exec(dateStr);
    if (match) {
      const [, month, day, year] = match;
      return `${year}/${Number.parseInt(month, 10)}/${Number.parseInt(day, 10)}`;
    }

    const date = new Date(dateStr);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}/${month}/${day}`;
    }

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

    const numValue = typeof quantity === 'string' ? Number.parseFloat(quantity) : Number(quantity);

    if (Number.isNaN(numValue)) {
      return null;
    }

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

    const numValue = typeof quantity === 'string' ? Number.parseFloat(quantity) : Number(quantity);

    if (Number.isNaN(numValue)) {
      return '';
    }

    return numValue.toFixed(2);
  }

  /**
   * Escape HTML special characters to prevent XSS attacks
   * @param text - Text to escape
   * @returns Escaped HTML string
   */
  escapeHtml(text: string): string {
    if (!text) return '';
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return String(text).replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
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

  getJspDataAttribute(attributeName: string): string | null {
    const angularRoot = this.document.getElementById('angular-root');
    return angularRoot?.getAttribute(attributeName) || null;
  }

  getServiceHostUrl(): string {
    const hostFromJsp = this.getJspDataAttribute('data-host');

    if (!hostFromJsp) {
      return '';
    }

    if (/^https?:\/\//i.test(hostFromJsp)) {
      return hostFromJsp;
    }

    const protocol = this.document.location?.protocol || 'https:';
    return protocol + '//' + hostFromJsp;
  }

  getExcludedSearchFields(): Set<string> {
    return new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      FIELD_HAS_LINKED_BOM,
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
      COL_ACTIONS,
    ]);
  }

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

  getMaterialHeaderStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#e5e7eb',
      borderLeft: '4px solid #10b981',
      fontWeight: '600',
      color: hasPartForRefSku ? '#ff0000' : 'inherit',
    };
  }

  getParentRowStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#eff6ff',
      borderLeft: '3px solid #3b82f6',
      fontWeight: '500',
      color: hasPartForRefSku ? '#ff0000' : '#1e40af',
    };
  }

  getDirectRowStyle(hasPartForRefSku: boolean): any {
    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      fontWeight: '400',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

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

  isActionsColumn(params: any): boolean {
    const fieldName = params.colDef?.field;
    const colId = params.column?.getColId() || params.colDef?.colId || fieldName;
    return fieldName === COL_ACTIONS || colId === COL_ACTIONS;
  }

  getRowId(row: any): string | number | null {
    return row.materialKey || row.newRowId || row[FIELD_PART_NUMBER] || row.part || null;
  }

  /**
   * Build section+part composite identifier used as a secondary edit-state key.
   */
  getCompositeSectionPartId(row: any): string | null {
    if (!row) return null;
    const part = row[FIELD_PART_NUMBER] ?? row.part;
    if (!row.section || !part) return null;
    return `${row.section}::${part}`;
  }

  /**
   * Stable row token for disconnect state:
   * materialKey/newRowId first, then section::part, then part fallback.
   */
  getStableRowToken(row: any): string {
    if (!row) return '';

    const stableId = row?.materialKey ?? row?.newRowId;
    if (stableId !== undefined && stableId !== null && String(stableId).trim() !== '') {
      return String(stableId);
    }

    const compositeId = this.getCompositeSectionPartId(row);
    if (compositeId) return compositeId;

    const part = row?.[FIELD_PART_NUMBER] ?? row?.part;
    return part !== undefined && part !== null ? String(part).trim() : '';
  }

  /**
   * Find a grid node by strict data object reference.
   */
  findNodeByDataReference(gridApi: GridApi | null | undefined, targetData: any): any | null {
    if (!gridApi || !targetData) return null;

    let targetNode: any = null;
    gridApi.forEachNode((node: any) => {
      if (node.data === targetData) {
        targetNode = node;
      }
    });
    return targetNode;
  }

  createAutocompleteFilter(): (searchValue: string, options: string[]) => string[] {
    return (searchValue: string, options: string[]) => {
      if (!searchValue) return options;
      const lower = searchValue.toLowerCase();
      return options.filter((opt) => opt.toLowerCase().includes(lower));
    };
  }

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

  findAllNewRows(rowData: any[], displayData?: any[]): any[] {
    const newRows: any[] = [];

    const traverseTreeRows = (rows: any[]) => {
      rows.forEach((row) => {
        if (row.isNewRow && !this.isHeaderRow(row)) {
          newRows.push(row);
        }
        if (row.children && Array.isArray(row.children)) {
          traverseTreeRows(row.children);
        }
      });
    };

    traverseTreeRows(rowData);

    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !this.isHeaderRow(row)) {
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    return newRows;
  }

  isDataRowForValidation(row: any): boolean {
    if (this.isHeaderRow(row)) {
      return false;
    }

    const hasBomFields =
      row[FIELD_PART_NUMBER] !== undefined ||
      row.bomLinkPart !== undefined ||
      row.bomLinkFeature !== undefined ||
      row.quantity !== undefined ||
      row.qty !== undefined;

    return !!(row.isDirectRow || row.isSubRow || row.isNewRow || row.materialKey || hasBomFields);
  }

  /**
   * Find all data rows (existing + new) for validation on save.
   * Excludes section/group/material/branch headers.
   */
  findAllDataRows(rowData: any[], displayData?: any[]): any[] {
    const dataRows: any[] = [];

    const collect = (rows: any[]) => {
      if (!Array.isArray(rows)) return;
      rows.forEach((row) => {
        if (this.isDataRowForValidation(row)) {
          dataRows.push(row);
        }
        if (row.children?.length) collect(row.children);
      });
    };
    collect(rowData);

    if (displayData?.length) {
      displayData.forEach((row) => {
        if (
          row.isNewRow &&
          this.isDataRowForValidation(row) &&
          !dataRows.some((r) => r === row || (r.newRowId !== undefined && r.newRowId === row.newRowId))
        ) {
          dataRows.push(row);
        }
      });
    }
    return dataRows;
  }

  getIdVariants(id: any): Set<string | number> {
    const variants = new Set<string | number>();
    if (id === null || id === undefined || `${id}`.trim() === '') return variants;
    variants.add(id);
    variants.add(`${id}`);
    const numId = Number(id);
    if (!Number.isNaN(numId)) variants.add(numId);
    return variants;
  }

  getFeatureValue(row: any): string {
    return row.bomLinkFeature;
  }

  /**
   * Get part number value from row
   * @param row - Row data object
   * @returns Part number value
   */
  getPartNumberValue(row: any): string {
    return row?.[FIELD_PART_NUMBER];
  }

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
}
