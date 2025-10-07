import { Injectable } from '@angular/core';
import { GridApi, GridOptions } from 'ag-grid-community';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root',
})
export class GridCommonService {
  constructor() {}

  /**
   * Helper method to size columns to fit with improved experience
   */
  sizeColumnsToFit(gridApi: GridApi): void {
    if (!gridApi) return;
    gridApi.autoSizeAllColumns();
    gridApi.refreshHeader();
  }

  /**
   * Force horizontal scrollbar visibility for Firefox
   */
  forceHorizontalScrollbarVisibility(gridApi: GridApi): void {
    if (!gridApi) return;

    gridApi.refreshCells({ force: true });

    const horizontalScrollViewport = document.querySelector(
      '.ag-body-horizontal-scroll-viewport'
    ) as HTMLElement;
    if (horizontalScrollViewport) {
      horizontalScrollViewport.style.overflowX = 'auto';
      horizontalScrollViewport.style.scrollbarWidth = 'auto';
      horizontalScrollViewport.style.scrollbarColor = '#cbd5e1 #f1f5f9';
      horizontalScrollViewport.style.minWidth = 'max-content';
      horizontalScrollViewport.style.width = 'max-content';
      horizontalScrollViewport.style.setProperty('-moz-overflow-scrolling', 'touch');
      horizontalScrollViewport.style.setProperty('-moz-box-sizing', 'border-box');
      horizontalScrollViewport.style.setProperty('-moz-transform', 'translateZ(0)');
      horizontalScrollViewport.style.display = 'block';
    }

    const gridContainer = document.querySelector('.ag-grid-container-wrapper') as HTMLElement;
    if (gridContainer) {
      gridContainer.style.overflowX = 'auto';
      gridContainer.style.setProperty('-moz-overflow-scrolling', 'touch');
    }

    setTimeout(() => {
      if (horizontalScrollViewport) {
        horizontalScrollViewport.style.display = 'block';
        horizontalScrollViewport.offsetHeight;
        horizontalScrollViewport.style.setProperty('overflow-x', 'auto');
        horizontalScrollViewport.style.setProperty('scrollbar-width', 'auto');
      }
    }, 100);

    setTimeout(() => {
      this.forceOldFirefoxScroll();
    }, 200);
  }

  /**
   * Additional method specifically for old Firefox
   */
  private forceOldFirefoxScroll(): void {
    const horizontalScrollViewport = document.querySelector(
      '.ag-body-horizontal-scroll-viewport'
    ) as HTMLElement;
    if (horizontalScrollViewport) {
      horizontalScrollViewport.style.setProperty('overflow-x', 'auto', 'important');
      horizontalScrollViewport.style.setProperty('scrollbar-width', 'auto', 'important');
      horizontalScrollViewport.style.setProperty('min-width', 'max-content', 'important');

      horizontalScrollViewport.scrollLeft = 1;
      horizontalScrollViewport.scrollLeft = 0;
    }
  }

  /**
   * Date formatter function for MM/DD/YYYY format
   */
  dateFormatter(params: any): string {
    if (!params.value) return '';

    if (typeof params.value === 'string') {
      const mmddyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
      if (mmddyyyyPattern.test(params.value)) {
        return params.value;
      }
    }

    const date = new Date(params.value);
    if (isNaN(date.getTime())) return params.value;

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
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
  generateExpiredEntries(dataService: DataService, isSbom: boolean = false): any[] {
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

    // Add SBOM-specific fields if needed
    if (isSbom) {
      expiredEntries.forEach((entry) => {
        (entry as any).SpecSheet = 'N'; // Default to N for expired entries
        (entry as any).SpecSheetExtra = 'N'; // Default to N for expired entries
      });
    }

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

    const first20Parts = rowData.slice(0, 20).map((row) => row.part.toString());
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
      if (row.feature && !row.isNewRow) {
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
      if (!row.isNewRow) {
        partNumbers.add(row.part.toString());
      }
    });
    return Array.from(partNumbers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /**
   * Get unique suppliers
   */
  getUniqueSuppliers(rowData: any[]): string[] {
    const suppliers = new Set<string>();
    rowData.forEach((row) => {
      if (row.supplier && !row.isNewRow) {
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
      if (row.color && !row.isNewRow) {
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
      animateRows: true,
      enableCellTextSelection: true,
      rowSelection: 'single' as const,
      suppressColumnVirtualisation: false,
      suppressHorizontalScroll: false,
      suppressColumnMoveAnimation: false,
      suppressDragLeaveHidesColumns: false,
      suppressFieldDotNotation: true,
      suppressContextMenu: false,
      suppressScrollOnNewData: false,
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
      stopEditingWhenCellsLoseFocus: false,
      singleClickEdit: true,
      getRowClass: (params) => {
        if (params.data && params.data.isExpired) {
          return 'expired-row';
        }
        if (params.data && params.data.isNew) {
          return 'new-row';
        }
        if (params.data && params.data.isEdited) {
          return 'edited-row';
        }
        return '';
      },
      enableRangeSelection: false,
      suppressAnimationFrame: true,
      context: {
        dataService: null,
      },
      onGridReady: (params) => {
        componentInstance.gridApi = params.api;
        setTimeout(() => {
          this.forceHorizontalScrollbarVisibility(params.api);
        }, 100);
      },
      onCellValueChanged: (params) => {
        // Track changes for all editable fields
        if (componentInstance.trackFieldChange) {
          componentInstance.trackFieldChange(params);
        }

        // Handle part number changes for auto-populating feature
        if (params.colDef.field === 'part') {
          if (componentInstance.onNewRowValueChanged) {
            componentInstance.onNewRowValueChanged(
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
          if (componentInstance.pasteSkuValue) {
            componentInstance.pasteSkuValue(params as any);
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
    };
  }
}
