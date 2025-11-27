import { Injectable } from '@angular/core';
import { GridApi, GridOptions, IRowNode } from 'ag-grid-community';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root',
})
export class GridCommonService {
  constructor() {}

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
        if (!params.data || !params.data.isSectionHeader) {
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
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // Fallback to standard Date parsing
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
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
    if (isNaN(date.getTime())) return '';

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
    if (isNaN(date.getTime())) return '';

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
        (entry as any)[`sku${sku.sku}`] = '';
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
      clickableParts.add(parseInt(first20Parts[randomIndex]));
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
    return Array.from(features).sort();
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
    return Array.from(suppliers).sort();
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
    return Array.from(colors).sort();
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
      rowSelection: {
        mode: 'singleRow',
        enableClickSelection: false,
        checkboxes: false,
        isRowSelectable: (params) => {
          return !(params.data && params.data.isSectionHeader);
        },
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
        let classes = [];

        if (params.data && params.data.isSectionHeader) {
          classes.push('section-header-row');
        }
        if (params.data && params.data.isGroupHeader) {
          classes.push('group-header-row');
          if (params.data.groupLevel === 0) {
            classes.push('group-level-0');
          } else if (params.data.groupLevel === 1) {
            classes.push('group-level-1');
          } else {
            classes.push('group-level-2');
          }
        }
        if (params.data && params.data.isExpired) {
          classes.push('expired-row');
        }
        if (params.data && params.data.isNew) {
          classes.push('new-row');
        }
        if (params.data && params.data.isEdited) {
          classes.push('edited-row');
        }
        if (params.data && params.data.isParent) {
          classes.push('parent-row');
          if (params.data.isExpanded) {
            classes.push('expanded');
          }
        }
        if (params.data && params.data.isSubRow) {
          classes.push('subrow');
        }

        return classes.join(' ');
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
      onRowSelected: (params) => {
        if (params.node.isSelected()) {
          setTimeout(() => {
            params.api.forEachNode((node) => {
              if (node.id !== params.node.id && node.isSelected()) {
                node.setSelected(false);
              }
            });
          }, 0);
        }
      },
      onSelectionChanged: (params) => {
        setTimeout(() => {
          const selectedNodes = params.api.getSelectedNodes();
          if (selectedNodes.length > 1) {
            selectedNodes.slice(1).forEach((node) => node.setSelected(false));
          }
        }, 0);
      },
      onCellValueChanged: (params) => {
        if (componentInstance.rowManagementService && componentInstance.editedRows) {
          componentInstance.rowManagementService.trackFieldChange(
            params,
            componentInstance.editedRows
          );
        }

        if (params.data && params.data.isNewRow) {
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
          params.data &&
          params.data.isNewRow &&
          params.colDef.field &&
          params.colDef.field !== 'part'
        ) {
          if (params.node.data) {
            (params.node.data as any)[params.colDef.field] = params.newValue;
          }
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
          !params.colDef.field.includes('Date') &&
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
        if (
          params.colDef.field === 'accordionIcon' &&
          params.data.isParent &&
          params.data.hasChildren
        ) {
          if (componentInstance.toggleAccordion) {
            componentInstance.toggleAccordion(params.data.branchID);
          }
          return;
        }

        if (params.colDef.field === 'actions') {
          return;
        }

        if (params.event) {
          const mouseEvent = params.event as MouseEvent;
          const selection = window.getSelection();
          if (selection && selection.toString().trim() === '') {
            if (!mouseEvent.shiftKey && !mouseEvent.ctrlKey && !mouseEvent.metaKey) {
              setTimeout(() => {
                const isSelected = params.node.isSelected();
                params.node.setSelected(!isSelected);
              }, 0);
            }
          }
        }
      },
      onCellKeyDown: (params) => {
        if (
          params.event &&
          (params.event as KeyboardEvent).ctrlKey &&
          (params.event as KeyboardEvent).key === 'v' &&
          (params as any).colDef?.field &&
          (params as any).colDef.field.startsWith('sku') &&
          params.data &&
          params.data.isNewRow
        ) {
          if (componentInstance.rowManagementService) {
            componentInstance.rowManagementService.pasteSkuValue(params as any, componentInstance);
          }
          params.event.preventDefault();
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
        } else {
          if (add) {
            rowElement.classList.add('ag-row-hover');
          } else {
            rowElement.classList.remove('ag-row-hover');
          }
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
            const rowIndex = parseInt(rowIndexAttr, 10);
            if (!isNaN(rowIndex)) {
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
            const rowIndex = parseInt(rowIndexAttr, 10);
            if (!isNaN(rowIndex)) {
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
}
