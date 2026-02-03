import { Injectable } from '@angular/core';
import { GridApi, GridOptions, IRowNode } from 'ag-grid-community';
import {
  EBOM_CORE_FIELDS,
  EBOM_SERVICE_FIELDS,
  EDITABLE_AUTOPOPULATED_FIELDS,
} from '../constants';
import { DataService } from './data.service';

export interface GroupConfig {
  field: string;
  headerName: string;
}

@Injectable({
  providedIn: 'root',
})
export class GridConfigService {
  constructor(private readonly dataService: DataService) {}

  getDefaultColDef() {
    const defaultColDef = {
      sortable: true,
      comparator: () => 0,
      filter: true,
      resizable: true,
      suppressSizeToFit: false,
      suppressAutoSize: false,
      floatingFilter: false,
      wrapHeaderText: true,
      headerClass: 'custom-header-with-border',
      width: 140,
      minWidth: 100,
      maxWidth: 300,
      wrapText: false,
      autoHeight: false,
      cellStyle: (params: any) => {
        const baseStyle: any = {
          padding: '8px 12px',
        };
        if (!params.data?.isSectionHeader) {
          baseStyle.borderRight = '1px solid #e2e8f0';
        }
        return baseStyle;
      },
    };

    return defaultColDef;
  }

  /**
   * Helper method to size columns to fit with improved experience
   */
  sizeColumnsToFit(gridApi: GridApi): void {
    if (!gridApi) return;
    gridApi.autoSizeAllColumns();
    gridApi.refreshHeader();
  }

  /**
   * Force horizontal scrollbar visibility - Simple and reliable
   */
  forceHorizontalScrollbarVisibility(gridApi: GridApi): void {
    if (!gridApi) return;

    setTimeout(() => {
      const horizontalScrollViewport = document.querySelector(
        '.ag-body-horizontal-scroll-viewport'
      ) as HTMLElement;

      if (horizontalScrollViewport) {
        horizontalScrollViewport.style.overflowX = 'auto';
        horizontalScrollViewport.style.overflowY = 'hidden';
      }

      const bodyViewport = document.querySelector('.ag-body-viewport') as HTMLElement;
      if (bodyViewport) {
        bodyViewport.style.overflowX = 'auto';
      }
    }, 100);
  }

  /**
   * Parse MM/DD/YYYY format string to Date object
   * @param dateStr - Date string in MM/DD/YYYY format or any parseable date format
   * @returns Date object or null if invalid
   */
  parseDateString(dateStr: string): Date | null {
    if (!dateStr || dateStr === '') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = Number.parseInt(parts[0], 10) - 1;
      const day = Number.parseInt(parts[1], 10);
      const year = Number.parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    // Fallback to standard Date parsing
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Format Date object to MM/DD/YYYY string format
   * @param date - Date object to format
   * @returns Formatted string in MM/DD/YYYY format (e.g., "10/31/2025")
   */
  formatDateToString(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Convert any date value (Date object, string, etc.) to MM/DD/YYYY format string
   * @param value - Date value (Date object, string, or any parseable date)
   * @returns Formatted string in MM/DD/YYYY format or empty string if invalid
   */
  formatDateToMMDDYYYY(value: any): string {
    if (!value) return '';

    if (value instanceof Date) {
      return this.formatDateToString(value);
    }

    if (typeof value === 'string') {
      const mmddyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
      if (mmddyyyyPattern.test(value)) {
        return value;
      }
      const date = this.parseDateString(value);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return this.formatDateToString(date);
  }

  /**
   * Convert Date object from editor to MM/DD/YYYY format string for storage
   * @param dateValue - Date object or any value from date editor
   * @returns Formatted string in MM/DD/YYYY format or empty string
   */
  convertDateEditorValueToString(dateValue: any): string {
    if (!dateValue) return '';

    if (dateValue && typeof dateValue === 'object' && 'toLocaleDateString' in dateValue) {
      return this.formatDateToString(dateValue as Date);
    }

    if (typeof dateValue === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        return dateValue;
      }
      const date = this.parseDateString(dateValue);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';

    return this.formatDateToString(date);
  }

  /**
   * Date formatter function for AG Grid valueFormatter (MM/DD/YYYY format)
   * @param params - AG Grid params object
   * @returns Formatted date string
   */
  dateFormatter(params: any): string {
    return this.formatDateToMMDDYYYY(params.value);
  }

  /**
   * Format last saved time
   */
  formatLastSavedTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Generate expired entries for testing
   */
  generateExpiredEntries(dataService: DataService): any[] {
    const expiredEntries = [
      {
        part: '5000001',
        supplier: 'Expired Supplier 1',
        color: 'Red',
        feature: 'Expired Frame',
        startDate: '01/01/2023',
        endDate: '12/31/2023',
        qty: 5,
        isExpired: true,
      },
      {
        part: '5000002',
        supplier: 'Expired Supplier 2',
        color: 'Orange',
        feature: 'Expired Hardware',
        startDate: '02/01/2023',
        endDate: '11/30/2023',
        qty: 3,
        isExpired: true,
      },
      {
        part: '5000003',
        supplier: 'Expired Supplier 3',
        color: 'Yellow',
        feature: 'Expired Label',
        startDate: '03/01/2023',
        endDate: '10/31/2023',
        qty: 8,
        isExpired: true,
      },
    ];

    const skuInfo = dataService.getSkuInfo();
    expiredEntries.forEach((entry) => {
      skuInfo.forEach((sku) => {
        (entry as any)[`sku${sku.skuId}`] = '';
      });
    });

    return expiredEntries;
  }

  /**
   * Initialize clickable parts (random selection)
   */
  initializeClickableParts(rowData: any[]): Set<number> {
    const clickableParts = new Set<number>();

    const dataRows = rowData.filter(
      (row) => !row.isSectionHeader && !row.isMaterialHeader && !row.isBranchHeader && row.part
    );

    const first20Parts = dataRows.slice(0, 20).map((row) => row.part.toString());
    const clickableCount = Math.floor(first20Parts.length * 0.3);

    for (let i = 0; i < clickableCount; i++) {
      const randomIndex = Math.floor(Math.random() * first20Parts.length);
      clickableParts.add(Number.parseInt(first20Parts[randomIndex], 10));
    }

    return clickableParts;
  }

  /**
   * Get unique features from row data
   */
  getUniqueFeatures(rowData: any[]): string[] {
    const features = new Set<string>();
    rowData.forEach((row) => {
      if (
        row.feature &&
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader
      ) {
        features.add(row.feature);
      }
    });
    return Array.from(features).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get available part numbers
   */
  getAvailablePartNumbers(rowData: any[]): string[] {
    const partNumbers = new Set<string>();
    rowData.forEach((row) => {
      if (
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader &&
        row.part
      ) {
        partNumbers.add(row.part.toString());
      }
    });
    return Array.from(partNumbers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /**
   * Get available materials
   */
  getAvailableMaterials(rowData: any[]): string[] {
    const materials = new Set<string>();
    rowData.forEach((row) => {
      if (
        row.material &&
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader
      ) {
        materials.add(row.material.toString());
      }
    });
    return Array.from(materials).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /**
   * Get unique suppliers
   */
  getUniqueSuppliers(rowData: any[]): string[] {
    const suppliers = new Set<string>();
    rowData.forEach((row) => {
      if (
        row.supplier &&
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader
      ) {
        suppliers.add(row.supplier);
      }
    });
    return Array.from(suppliers).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get unique colors
   */
  getUniqueColors(rowData: any[]): string[] {
    const colors = new Set<string>();
    rowData.forEach((row) => {
      if (
        row.color &&
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader
      ) {
        colors.add(row.color);
      }
    });
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Search part numbers (for future API integration)
   */
  async searchPartNumbers(searchTerm: string, rowData: any[]): Promise<string[]> {
    const allParts = this.getAvailablePartNumbers(rowData);
    if (!searchTerm) {
      return allParts.slice(0, 5);
    }

    return allParts.filter((part) => part.includes(searchTerm)).slice(0, 5);
  }

  /**
   * Apply quick filter
   */
  applyQuickFilter(gridApi: GridApi, searchText: string): void {
    if (!gridApi) return;
    gridApi.setGridOption('quickFilterText', searchText);
  }

  /**
   * Clear search
   */
  clearSearch(gridApi: GridApi, componentInstance: any): void {
    componentInstance.searchText = '';
    this.applyQuickFilter(gridApi, componentInstance.searchText);

    if (componentInstance.searchTextDebounceTimer) {
      clearTimeout(componentInstance.searchTextDebounceTimer);
    }
  }

  /**
   * Get common grid options configuration
   */
  getCommonGridOptions(componentInstance: any): GridOptions {
    return {
      theme: 'legacy',
      animateRows: false,
      enableCellTextSelection: true,
      rowSelection: 'multiple',
      suppressRowClickSelection: true,
      isRowSelectable: (rowNode: IRowNode) => {
        const data: any = rowNode?.data;
        return !!(
          data &&
          !data.isSectionHeader &&
          !data.isGroupHeader &&
          !data.isMaterialHeader &&
          !data.isBranchHeader
        );
      },
      suppressColumnVirtualisation: false,
      suppressHorizontalScroll: false,
      enableCharts: false,
      enableBrowserTooltips: true,
      suppressColumnMoveAnimation: false,
      suppressDragLeaveHidesColumns: false,
      suppressFieldDotNotation: true,
      suppressContextMenu: false,
      suppressScrollOnNewData: true,
      allowDragFromColumnsToolPanel: true,
      suppressRowVirtualisation: false,
      domLayout: 'normal',
      quickFilterText: '',
      includeHiddenColumnsInQuickFilter: false,
      cacheQuickFilter: true,
      rowModelType: 'clientSide',
      navigateToNextCell: (params) => {
        return params.nextCellPosition;
      },
      tabToNextCell: (params) => {
        return params.nextCellPosition || false;
      },
      enterNavigatesVertically: false,
      enterNavigatesVerticallyAfterEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      suppressClickEdit: false,
      singleClickEdit: true,
      getRowClass: (params) => {
        return this.buildRowClasses(params, componentInstance);
      },
      suppressAnimationFrame: true,
      context: {
        dataService: null,
      },
      onGridReady: (params) => {
        componentInstance.gridApi = params.api;
        this.forceHorizontalScrollbarVisibility(params.api);
      },
      onFirstDataRendered: (params) => {
        this.setupRowHoverSync(params.api);
      },
      onRowSelected: (params) => {},
      onSelectionChanged: (params) => {
        if (componentInstance.onSelectionChanged) {
          componentInstance.onSelectionChanged(params);
        }
      },
      onCellValueChanged: (params) => {
        if (componentInstance.rowManagementService?.isSkipEditTracking()) return;
        if (componentInstance.rowManagementService && componentInstance.editedRows) {
          componentInstance.rowManagementService.trackFieldChange(
            params,
            componentInstance.editedRows,
            componentInstance.editedFields,
            componentInstance.originalRowValues
          );
        }

        if (params.data?.isNewRow) {
          params.api.redrawRows({ rowNodes: [params.node] });
        }

        if (componentInstance.validateRowLive && params.data?.isNewRow) {
          componentInstance.validateRowLive(params.data);
        }

        if (params.data?.isNewRow) {
          if (
            componentInstance.rowManagementService &&
            componentInstance.dataService &&
            componentInstance.editedRows
          ) {
            componentInstance.rowManagementService.onNewRowValueChanged(
              params,
              componentInstance.dataService,
              componentInstance.editedRows
            );
          }

          setTimeout(() => {
            params.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }, 100);
        }

        if (
          params.data?.isNewRow &&
          params.colDef.field &&
          params.colDef.field !== 'part' &&
          params.node.data
        ) {
          params.node.data[params.colDef.field] = params.newValue;
        }
      },
      onCellEditingStarted: (params) => {},
      onCellMouseOver: (params) => {},
      onCellEditingStopped: (params) => {
        if (
          params.data &&
          params.newValue !== undefined &&
          params.colDef.field &&
          params.newValue !== params.oldValue &&
          !params.colDef.field?.includes('Date') &&
          params.colDef.field !== 'quantity'
        ) {
          params.data[params.colDef.field] = params.newValue;
        }
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: [params.column],
          force: true,
        });
      },
      onCellClicked: (params) => {
        if (params.colDef.field === 'actions' || params.colDef.field === 'checkbox') {
          return;
        }

        if (params.event) {
          const target = params.event.target as HTMLElement;
          if (
            target &&
            (target.closest('button') ||
              target.closest('[data-action]') ||
              target.closest('.ag-selection-checkbox') ||
              target.closest('input[type="checkbox"]') ||
              target.tagName === 'INPUT' ||
              target.closest('.ag-checkbox'))
          ) {
            return;
          }
        }
      },
      onCellKeyDown: (params) => {
        if (!params.event) return;
        
        const event = params.event as KeyboardEvent;
        const colDef = 'colDef' in params ? params.colDef : undefined;
        if (
          event.ctrlKey &&
          event.key === 'v' &&
          (colDef?.field?.startsWith('sku') ?? false) &&
          params.data?.isNewRow
        ) {
          // Prevent paste if SKU column is disabled (not editable)
          const colDefAny = colDef as any;
          if (colDefAny?.isDisabled) {
            event.preventDefault();
            return;
          }
          
          if (componentInstance.rowManagementService) {
            componentInstance.rowManagementService.pasteSkuValue(params as any, componentInstance);
          }
          event.preventDefault();
        }
      },
      onFilterChanged: (params) => {},
      onFilterModified: (params) => {},
      onSortChanged: (params) => {
        if (componentInstance.applyHierarchicalSort) {
          componentInstance.applyHierarchicalSort(params);
        }
      },
    };
  }

  /**
   * Setup row hover synchronization across pinned columns
   *
   * NOTE: AG Grid doesn't provide a built-in API for synchronizing hover states
   * across pinned columns. This is a common limitation that requires DOM manipulation.
   *
   * This implementation:
   * - Uses AG Grid's stable `row-index` attribute (used internally by AG Grid)
   * - Uses `getDisplayedRowAtIndex()` API for row state checks
   * - Properly cleans up event listeners
   * - Works with AG Grid's virtual scrolling and row updates
   */
  private setupRowHoverSync(gridApi: GridApi): void {
    const gridElement = document.querySelector('.ag-theme-alpine');
    if (!gridElement) return;

    const mainBody = gridElement.querySelector('.ag-body-viewport');
    const pinnedLeft = gridElement.querySelector('.ag-pinned-left-cols-viewport');
    const pinnedRight = gridElement.querySelector('.ag-pinned-right-cols-viewport');

    if (!mainBody) return;

    const eventHandlers: Array<{
      container: Element;
      type: string;
      handler: EventListener;
    }> = [];

    const syncHover = (rowIndex: number | null, add: boolean) => {
      if (rowIndex === null || rowIndex === undefined) return;

      const rowNode = gridApi.getDisplayedRowAtIndex(rowIndex);
      const allRows = gridElement.querySelectorAll(`.ag-row[row-index="${rowIndex}"]`);

      allRows.forEach((rowElement) => {
        if (rowNode) {
          if (add && !rowNode.isSelected() && !rowNode.data?.isSectionHeader) {
            rowElement.classList.add('ag-row-hover');
          } else {
            rowElement.classList.remove('ag-row-hover');
          }
        } else if (add) {
          rowElement.classList.add('ag-row-hover');
        } else {
          rowElement.classList.remove('ag-row-hover');
        }
      });
    };

    const createMouseEnterHandler = (): EventListener => {
      return (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const cell = target.closest('.ag-cell');
        const row = target.closest('.ag-row') || cell?.closest('.ag-row') || null;

        if (row) {
          const rowIndexAttr = row.getAttribute('row-index');
          if (rowIndexAttr !== null) {
            const rowIndex = Number.parseInt(rowIndexAttr, 10);
            if (!Number.isNaN(rowIndex)) {
              syncHover(rowIndex, true);
            }
          }
        }
      };
    };

    const createMouseLeaveHandler = (): EventListener => {
      return (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const cell = target.closest('.ag-cell');
        const row = target.closest('.ag-row') || cell?.closest('.ag-row') || null;

        if (row) {
          const rowIndexAttr = row.getAttribute('row-index');
          if (rowIndexAttr !== null) {
            const rowIndex = Number.parseInt(rowIndexAttr, 10);
            if (!Number.isNaN(rowIndex)) {
              syncHover(rowIndex, false);
            }
          }
        }
      };
    };

    [mainBody, pinnedLeft, pinnedRight].forEach((container) => {
      if (!container) return;

      const mouseEnterHandler = createMouseEnterHandler();
      const mouseLeaveHandler = createMouseLeaveHandler();

      container.addEventListener('mouseenter', mouseEnterHandler, true);
      container.addEventListener('mouseleave', mouseLeaveHandler, true);

      eventHandlers.push(
        { container, type: 'mouseenter', handler: mouseEnterHandler },
        { container, type: 'mouseleave', handler: mouseLeaveHandler }
      );
    });

    (gridApi as any)._hoverSyncCleanup = () => {
      eventHandlers.forEach(({ container, type, handler }) => {
        container.removeEventListener(type, handler, true);
      });
    };
  }

  getEbomServiceFieldNames(): string[] {
    return [...EBOM_SERVICE_FIELDS];
  }

  isFieldEditableInSbom(
    field: string,
    rowData: any,
    isSkuFilterReadOnly: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode?: () => boolean
  ): boolean {
    if (isSkuFilterReadOnly()) {
      return false;
    }

    if (isEbomMode?.()) {
      const core = EBOM_CORE_FIELDS.includes(field);
      const serviceField = EBOM_SERVICE_FIELDS.includes(field);
      return core || serviceField;
    }

    if (!isSbomMode()) {
      return ['bomLinkStartDate', 'bomLinkEndDate', 'quantity'].includes(field);
    }

    const isMbomLineItem = rowData?.ptcbomPartMarkUp === 'enumMBOM001';

    // For MBOM line items: bomLinkIncludeInSpecSheet is always editable
    if (isMbomLineItem) {
      return field === 'bomLinkIncludeInSpecSheet';
    }

    // For SBOM: Disable bomLinkIncludeInSpecSheet if bomLinkSpecSheetExtra exists
    if (field === 'bomLinkIncludeInSpecSheet') {
      const specSheetExtra = rowData?.bomLinkSpecSheetExtra;
      if (specSheetExtra !== undefined && specSheetExtra !== null && String(specSheetExtra).trim() !== '') {
        return false;
      }
    }

    // For regular SBOM rows
    const editableFields = ['bomLinkIncludeInSpecSheet', 'quantity', 'bomLinkStartDate', 'bomLinkEndDate'];
    return editableFields.includes(field);
  }

  isFieldEditableForNewRow(
    field: string,
    isSkuFilterReadOnly: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode?: () => boolean
  ): boolean {
    if (isSkuFilterReadOnly()) {
      return false;
    }

    if (isEbomMode?.()) {
      const core = EBOM_CORE_FIELDS.includes(field) || field === 'bomLinkFeature';
      const autopopulated = EDITABLE_AUTOPOPULATED_FIELDS.includes(field);
      const serviceField = EBOM_SERVICE_FIELDS.includes(field);
      return core || autopopulated || serviceField;
    }

    if (isSbomMode() && field === 'bomLinkSpecSheetExtra') {
      return false;
    }

    if (isSbomMode() && field === 'bomLinkFeature') {
      return false;
    }

    // For SBOM: Disable bomLinkIncludeInSpecSheet for new rows
    if (isSbomMode() && field === 'bomLinkIncludeInSpecSheet') {
      return false;
    }

    const editableFields = [
      'bomLinkFeature',
      'materialDescription',
      'material',
      'supplier',
      'colorDescription',
      'color',
      'partNumber',
      'bomLinkStartDate',
      'bomLinkEndDate',
      'quantity',
      'bomLinkSpecSheetExtra',
      'bomLinkIncludeInSpecSheet',
      'bomLinkCountryOfOrigin',
    ];
    return editableFields.includes(field);
  }

  // Grouping Methods (merged from GroupByService)
  /**
   * Groups data by specified fields and creates group header rows
   * Preserves section headers and material headers while grouping data rows
   */
  groupData(data: any[], groupFields: GroupConfig[]): any[] {
    if (!groupFields || groupFields.length === 0) {
      return data;
    }

    const result: any[] = [];
    let currentDataGroup: any[] = [];

    data.forEach((row) => {
      if (row.isSectionHeader || row.isMaterialHeader || row.isGroupHeader) {
        if (currentDataGroup.length > 0) {
          const grouped = this.createNestedGroups(currentDataGroup, groupFields, 0);
          const flattened = this.flattenGroupedData(grouped);
          result.push(...flattened);
          currentDataGroup = [];
        }
        result.push(row);
      } else {
        currentDataGroup.push(row);
      }
    });

    if (currentDataGroup.length > 0) {
      const grouped = this.createNestedGroups(currentDataGroup, groupFields, 0);
      const flattened = this.flattenGroupedData(grouped);
      result.push(...flattened);
    }

    return result;
  }

  /**
   * Creates nested group structure
   */
  private createNestedGroups(
    data: any[],
    groupFields: GroupConfig[],
    level: number
  ): any[] {
    if (level >= groupFields.length) {
      return data;
    }

    const groupField = groupFields[level];
    const groups = new Map<string | null, any[]>();

    const rowsToGroup: any[] = [];
    
    data.forEach((row) => {
      if (row.isSectionHeader) {
        return;
      }

      if (row.isMaterialHeader && row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => {
          rowsToGroup.push(child);
        });
      } else {
        rowsToGroup.push(row);
      }
    });

    rowsToGroup.forEach((row) => {
      const isHeader = row.isGroupHeader;
      if (!isHeader) {
        const partNumber = row.partNumber || row.part;
        if (!partNumber || String(partNumber).trim() === '') {
          return;
        }
      }

      let groupValue = row[groupField.field];
      if (groupField.field === 'bomLinkFeature' && !groupValue && row.feature) {
        groupValue = row.feature;
      }
      const key = groupValue !== null && groupValue !== undefined ? String(groupValue).trim() : '__null__';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    const result: any[] = [];
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === '__null__') return 1;
      if (b[0] === '__null__') return -1;
      const aKey = a[0] || '';
      const bKey = b[0] || '';
      return aKey.localeCompare(bKey);
    });

    sortedGroups.forEach(([key, groupRows]) => {
      const groupValue = key === '__null__' ? null : key;
      
      const groupHeader: any = {
        isGroupHeader: true,
        groupLevel: level,
        groupField: groupField.field,
        groupHeaderName: groupField.headerName,
        groupValue: groupValue,
        groupKey: `${groupField.field}_${key}`,
        isExpanded: true,
        children: [],
      };

      if (level < groupFields.length - 1) {
        groupHeader.children = this.createNestedGroups(groupRows, groupFields, level + 1);
      } else {
        groupHeader.children = groupRows;
      }

      result.push(groupHeader);
    });

    return result;
  }

  /**
   * Flattens grouped data structure respecting expand/collapse state
   */
  flattenGroupedData(grouped: any[]): any[] {
    const result: any[] = [];

    grouped.forEach((item) => {
      if (item.isGroupHeader) {
        result.push(item);
        if (item.isExpanded && item.children) {
          item.children.forEach((child: any) => {
            if (child.isGroupHeader) {
              const nested = this.flattenGroupedData([child]);
              result.push(...nested);
            } else {
              result.push(child);
            }
          });
        }
      } else {
        result.push(item);
      }
    });

    return result;
  }

  /**
   * Toggles group expand/collapse state
   */
  toggleGroup(data: any[], groupKey: string): any[] {
    const findAndToggle = (items: any[]): any[] => {
      return items.map((item) => {
        if (item.isGroupHeader && item.groupKey === groupKey) {
          return {
            ...item,
            isExpanded: !item.isExpanded,
          };
        }
        if (item.children && Array.isArray(item.children)) {
          return {
            ...item,
            children: findAndToggle(item.children),
          };
        }
        return item;
      });
    };

    return findAndToggle(data);
  }

  /**
   * Removes grouping and returns original flat data
   */
  ungroupData(groupedData: any[]): any[] {
    return groupedData.filter((row) => !row.isGroupHeader);
  }

  /**
   * Gets unique values for a field (useful for group by dropdown)
   */
  getUniqueValues(data: any[], field: string): any[] {
    const values = new Set<any>();
    data.forEach((row) => {
      if (row[field] !== null && row[field] !== undefined && !row.isGroupHeader) {
        values.add(row[field]);
      }
    });
    return Array.from(values).sort((a, b) => {
      if (a === null || a === undefined) return 1;
      if (b === null || b === undefined) return -1;
      return String(a).localeCompare(String(b));
    });
  }

  /**
   * Gets count of items in a group
   */
  getGroupCount(groupHeader: any): number {
    if (!groupHeader.children) return 0;
    
    let count = 0;
    const countItems = (items: any[]): void => {
      items.forEach((item) => {
        if (item.isGroupHeader) {
          countItems(item.children || []);
        } else {
          count++;
        }
      });
    };
    
    countItems(groupHeader.children);
    return count;
  }

  /**
   * Groups hierarchical data (sections -> materials)
   * Groups the children of each section based on the group fields
   */
  groupHierarchicalData(sections: any[], groupFields: GroupConfig[]): any[] {
    if (!groupFields || groupFields.length === 0) {
      return sections;
    }

    return sections.map(section => {
      if (!section.isSectionHeader) {
        return section;
      }

      const sectionWithExpanded = {
        ...section,
        isExpanded: section.isExpanded ?? true
      };

      if (!Array.isArray(section.children) || section.children.length === 0) {
        return {
          ...sectionWithExpanded,
          children: []
        };
      }

      const groupedChildren = this.createNestedGroups(section.children, groupFields, 0);
      
      return {
        ...sectionWithExpanded,
        children: groupedChildren || []
      };
    });
  }

  /**
   * Build row classes for AG Grid rows
   * Extracted from getRowClass to reduce cognitive complexity
   */
  private buildRowClasses(params: any, componentInstance: any): string {
    const classes: string[] = [];
    const data = params.data;

    if (!data) {
      return classes.join(' ');
    }

    this.addHeaderRowClasses(classes, data);
    this.addGroupRowClasses(classes, data);
    this.addStatusRowClasses(classes, data);
    this.addEditedRowClass(classes, data, componentInstance);
    this.addValidationErrorClass(classes, data, componentInstance);

    return classes.join(' ');
  }

  private addHeaderRowClasses(classes: string[], data: any): void {
    if (data.isSectionHeader) {
      classes.push('section-header-row');
    }
  }

  private addGroupRowClasses(classes: string[], data: any): void {
    if (data.isGroupHeader) {
      classes.push('group-header-row');
      if (data.groupLevel === 0) {
        classes.push('group-level-0');
      } else if (data.groupLevel === 1) {
        classes.push('group-level-1');
      } else {
        classes.push('group-level-2');
      }
    }
  }

  private addStatusRowClasses(classes: string[], data: any): void {
    if (data.isExpired) {
      classes.push('expired-row');
    }
    if (data.isNew) {
      classes.push('new-row');
    }
    if (data.isEdited) {
      classes.push('edited-row');
    }
    if (data.isParent) {
      classes.push('parent-row');
      if (data.isExpanded) {
        classes.push('expanded');
      }
    }
    if (data.isSubRow) {
      classes.push('subrow');
    }
  }

  private addEditedRowClass(classes: string[], data: any, componentInstance: any): void {
    if (!componentInstance.editedRows) {
      return;
    }

    const candidates = this.getEditedRowCandidates(data);
    const isEdited = this.isRowEdited(candidates, componentInstance.editedRows);

    if (isEdited) {
      classes.push('row-edited');
    }
  }

  private getEditedRowCandidates(data: any): any[] {
    const isNewRow = data.isNewRow === true;

    if (isNewRow) {
      return data.newRowId ? [data.newRowId] : [];
    }

    if (data.materialKey) {
      return [data.materialKey];
    }

    return [
      data.partNumber,
      data.part,
      data.section && (data.partNumber || data.part)
        ? `${data.section}::${data.partNumber || data.part}`
        : null,
    ].filter((v) => v !== null && v !== undefined && `${v}`.trim() !== '');
  }

  private isRowEdited(candidates: any[], editedRows: Set<any>): boolean {
    return candidates.some((id) => {
      return (
        editedRows.has(id) ||
        editedRows.has(`${id}`) ||
        editedRows.has(Number(id))
      );
    });
  }

  private addValidationErrorClass(classes: string[], data: any, componentInstance: any): void {
    if (!componentInstance.invalidRowIds) {
      return;
    }

    const rowId =
      data.materialKey || data.newRowId || data.partNumber || data.part;
    const compositeId =
      data.section && (data.partNumber || data.part)
        ? `${data.section}::${data.partNumber || data.part}`
        : null;
    const hasError =
      (rowId && componentInstance.invalidRowIds.has(rowId)) ||
      (compositeId && componentInstance.invalidRowIds.has(compositeId));
    if (hasError) {
      classes.push('validation-error-row');
    }
  }
}
