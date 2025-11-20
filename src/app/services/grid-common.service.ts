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

    // Apply styles after a short delay to ensure DOM is ready
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
    // Handle MM/DD/YYYY format (e.g., "10/31/2025")
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
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

    // If it's already a Date object, format it
    if (value instanceof Date) {
      return this.formatDateToString(value);
    }

    // If it's already a string, check if it's in the correct format
    if (typeof value === 'string') {
      const mmddyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
      if (mmddyyyyPattern.test(value)) {
        return value;
      }
      // Try to parse and reformat
      const date = this.parseDateString(value);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    // Try to parse as Date
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

    // If it's a Date object (from date editor)
    if (dateValue && typeof dateValue === 'object' && 'toLocaleDateString' in dateValue) {
      return this.formatDateToString(dateValue as Date);
    }

    // If it's already a string in MM/DD/YYYY format, return as-is
    if (typeof dateValue === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        return dateValue;
      }
      // Try to parse and format
      const date = this.parseDateString(dateValue);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    // Try to parse as Date
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

    // Filter out header rows and only process actual data rows
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
      animateRows: false, // Disable row animations to prevent flickering
      enableCellTextSelection: true,
      rowSelection: 'single' as const,
      suppressRowClickSelection: true, // We handle selection manually in onCellClicked
      suppressMultiRangeSelection: true, // Prevent multiple range selections
      suppressColumnVirtualisation: false,
      suppressHorizontalScroll: false,
      // Enable horizontal scrolling for wide grids
      enableCharts: false,
      // Enable browser tooltips for cells
      enableBrowserTooltips: true,
      suppressColumnMoveAnimation: false,
      suppressDragLeaveHidesColumns: false,
      suppressFieldDotNotation: true,
      suppressContextMenu: false,
      suppressScrollOnNewData: true, // Prevent scroll jump when accordion expands/collapses
      allowDragFromColumnsToolPanel: true,
      suppressRowVirtualisation: false,
      domLayout: 'normal',
      quickFilterText: '',
      includeHiddenColumnsInQuickFilter: false,
      cacheQuickFilter: true,
      rowModelType: 'clientSide',
      // Sorting is handled manually in onSortChanged to preserve hierarchy
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
      isRowSelectable: (params) => {
        // Prevent selection of section header rows
        return !(params.data && params.data.isSectionHeader);
      },
      getRowClass: (params) => {
        let classes = [];

        if (params.data && params.data.isSectionHeader) {
          classes.push('section-header-row');
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
      enableRangeSelection: false,
      suppressAnimationFrame: true,
      context: {
        dataService: null,
      },
      onGridReady: (params) => {
        componentInstance.gridApi = params.api;
        this.forceHorizontalScrollbarVisibility(params.api);
      },
      onFirstDataRendered: (params) => {
        // Setup row hover synchronization after grid is fully rendered
        // Using onFirstDataRendered ensures DOM is ready without setTimeout
        this.setupRowHoverSync(params.api);
      },
      onRowSelected: (params) => {
        // Ensure only one row can be selected at a time
        if (params.node.isSelected()) {
          // Deselect all other rows (use setTimeout to batch and prevent flickering)
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
        // Use setTimeout to batch operations and prevent flickering
        setTimeout(() => {
          const selectedNodes = params.api.getSelectedNodes();
          if (selectedNodes.length > 0) {
            // If multiple selected, keep only the first one
            if (selectedNodes.length > 1) {
              selectedNodes.slice(1).forEach((node) => node.setSelected(false));
            }
            // Don't auto-scroll - let user control scrolling to prevent layout issues
            // Only scroll if row is completely out of view (not just partially)
          }
        }, 0);
      },
      onCellValueChanged: (params) => {
        // Track changes for all editable fields
        if (componentInstance.rowManagementService && componentInstance.editedRows) {
          componentInstance.rowManagementService.trackFieldChange(params, componentInstance.editedRows);
        }

        // Handle field changes for new rows (auto-population)
        if (params.data && params.data.isNewRow) {
          if (componentInstance.rowManagementService && componentInstance.dataService && componentInstance.editedRows) {
            componentInstance.rowManagementService.onNewRowValueChanged(
              params,
              componentInstance.dataService,
              componentInstance.editedRows
            );
          }

          // Force refresh to ensure the value is displayed
          setTimeout(() => {
            params.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }, 100);
        }

        // Ensure values are properly saved for new rows (only for non-part fields to avoid infinite loop)
        if (
          params.data &&
          params.data.isNewRow &&
          params.colDef.field &&
          params.colDef.field !== 'part'
        ) {
          // Only update the data object directly to avoid triggering another onCellValueChanged
          if (params.node.data) {
            (params.node.data as any)[params.colDef.field] = params.newValue;
          }
        }
      },
      onCellEditingStarted: (params) => {
        // Cell editing started
      },
      onCellMouseOver: (params) => {
        // Don't manually set title - let AG Grid's tooltipValueGetter handle it
        // This allows tooltipValueGetter to work properly with enableBrowserTooltips
      },
      onCellEditingStopped: (params) => {
        // Only commit if there's actually a new value and it's not a date or quantity column
        // Date and quantity columns have their own valueSetter that handles the conversion properly
        if (
          params.data &&
          params.newValue !== undefined &&
          params.colDef.field &&
          params.newValue !== params.oldValue &&
          !params.colDef.field.includes('Date') && // Skip date columns as they have valueSetter
          params.colDef.field !== 'quantity' // Skip quantity column as it has valueSetter
        ) {
          params.data[params.colDef.field] = params.newValue;
        }
        // Refresh the cell to show the updated value
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: [params.column],
          force: true,
        });
      },
      onCellClicked: (params) => {
        // Handle accordion toggle for the accordion icon column
        if (
          params.colDef.field === 'accordionIcon' &&
          params.data.isParent &&
          params.data.hasChildren
        ) {
          if (componentInstance.toggleAccordion) {
            componentInstance.toggleAccordion(params.data.branchID);
          }
          return; // Don't toggle selection when clicking accordion
        }

        // Skip selection toggle for actions column (user wants to click action buttons)
        if (params.colDef.field === 'actions') {
          return;
        }

        // Toggle row selection on cell click (but not during text selection)
        if (params.event) {
          const mouseEvent = params.event as MouseEvent;
          // Clear any text selection first
          const selection = window.getSelection();
          if (selection && selection.toString().trim() === '') {
            // Only toggle row if no text is selected and no modifier keys pressed
            if (!mouseEvent.shiftKey && !mouseEvent.ctrlKey && !mouseEvent.metaKey) {
              // Use setTimeout to batch selection update and prevent flickering
              setTimeout(() => {
                // Toggle selection: if selected, deselect; if not selected, select
                const isSelected = params.node.isSelected();
                params.node.setSelected(!isSelected);
              }, 0);
            }
          }
        }
      },
      // Prevent row selection during scrolling/dragging
      suppressRowDeselection: false, // Allow deselecting
      onCellKeyDown: (params) => {
        // Handle Ctrl+V for paste in SKU columns of new rows
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
      onFilterChanged: (params) => {
        // Filter changed event
      },
      onFilterModified: (params) => {
        // Filter modified event
      },
      onSortChanged: (params) => {
        // Handle hierarchical sorting
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
   *
   * Future-proof considerations:
   * - Uses standard DOM events (mouseenter/mouseleave)
   * - Relies on stable AG Grid attributes (row-index)
   * - Uses AG Grid's official API methods where possible
   */
  private setupRowHoverSync(gridApi: GridApi): void {
    const gridElement = document.querySelector('.ag-theme-alpine');
    if (!gridElement) return;

    const mainBody = gridElement.querySelector('.ag-body-viewport');
    const pinnedLeft = gridElement.querySelector('.ag-pinned-left-cols-viewport');
    const pinnedRight = gridElement.querySelector('.ag-pinned-right-cols-viewport');

    if (!mainBody) return;

    // Store event handlers for cleanup
    const eventHandlers: Array<{
      container: Element;
      type: string;
      handler: EventListener;
    }> = [];

    // Synchronize hover state across all row containers
    const syncHover = (rowIndex: number | null, add: boolean) => {
      if (rowIndex === null || rowIndex === undefined) return;

      // Use AG Grid's API to get row node state
      const rowNode = gridApi.getDisplayedRowAtIndex(rowIndex);

      // Find all row elements with matching row-index (main body + pinned columns)
      // Note: row-index is a stable AG Grid attribute used for row identification
      const allRows = gridElement.querySelectorAll(`.ag-row[row-index="${rowIndex}"]`);

      allRows.forEach((rowElement) => {
        // Only add hover if row is not selected and not a section header
        if (rowNode) {
          if (add && !rowNode.isSelected() && !rowNode.data?.isSectionHeader) {
            rowElement.classList.add('ag-row-hover');
          } else {
            rowElement.classList.remove('ag-row-hover');
          }
        } else {
          // Fallback: toggle class if node not found (shouldn't happen in normal operation)
          if (add) {
            rowElement.classList.add('ag-row-hover');
          } else {
            rowElement.classList.remove('ag-row-hover');
          }
        }
      });
    };

    // Create reusable event handler factory
    const createMouseEnterHandler = (): EventListener => {
      return (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        // Find the row element (could be cell, cell content, or row itself)
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

    // Add event listeners to all containers
    [mainBody, pinnedLeft, pinnedRight].forEach((container) => {
      if (!container) return;

      const mouseEnterHandler = createMouseEnterHandler();
      const mouseLeaveHandler = createMouseLeaveHandler();

      container.addEventListener('mouseenter', mouseEnterHandler, true);
      container.addEventListener('mouseleave', mouseLeaveHandler, true);

      // Store for cleanup
      eventHandlers.push(
        { container, type: 'mouseenter', handler: mouseEnterHandler },
        { container, type: 'mouseleave', handler: mouseLeaveHandler }
      );
    });

    // Cleanup function - store on gridApi for potential future cleanup
    // Note: In Angular, component destruction will handle cleanup, but this is defensive
    (gridApi as any)._hoverSyncCleanup = () => {
      eventHandlers.forEach(({ container, type, handler }) => {
        container.removeEventListener(type, handler, true);
      });
    };
  }
}
