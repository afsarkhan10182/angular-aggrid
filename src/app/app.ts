import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { DataService } from './services/data.service';
import { ColumnService } from './services/column.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  private gridApi!: GridApi;
  public showColumnVisibilityPanel = false;
  public showExpiredData = false;
  public expiredDataCount = 0;

  // Modal state
  public showPartModal = false;
  public selectedPartData: any = {};
  public selectedPartSkuData: any[] = [];
  
  // Search functionality
  public searchText: string = '';
  
  // Save message state
  public saveMessage: string = '';
  public saveMessageType: string = '';
  // Last saved timestamp
  public lastSavedAt: Date | null = null;
  // Track which parts are clickable (random selection)
  private clickableParts = new Set<number>();
  // Editable state
  public editedRows = new Set<number>();
  // Add row state
  public newRows = new Map<number, any>();
  public nextRowId = 10000; // Unique ID for new rows
  
  // Copy/Paste state for SKU columns in new rows
  public copiedSkuValue: string = '';
  public copiedFromRowId: number | null = null; // Track which row the value was copied from
  public copiedFromCellKey: string = ''; // Track which cell was copied from (for visual indicator)
  public copiedCellIndicator: string = ''; // Visual indicator for copied cell
  
  // Master list for column visibility panel (includes both real and virtual columns)
  public allColumns = [
    // Core Part Information
    { field: 'actions', headerName: '', hide: false, isVirtual: false },
    { field: 'SpecSheet', headerName: 'Include In Spec Sheet', hide: true, isVirtual: true },
    { field: 'part', headerName: 'Part Number', hide: false, isVirtual: false },
    { field: 'type', headerName: 'Type', hide: true, isVirtual: true },
    { field: 'manufacturerPartNumber', headerName: 'Manufacturer Part Number', hide: true, isVirtual: true },
    
    // Descriptions
    { field: 'shortDesc', headerName: 'Short Description', hide: false, isVirtual: false },
    { field: 'longDesc', headerName: 'Long Description', hide: false, isVirtual: false },
    { field: 'serviceDescription', headerName: 'Service Description', hide: true, isVirtual: true },
    
    // Features and Specifications
    { field: 'feature', headerName: 'BOM Feature', hide: false, isVirtual: false },
    { field: 'includeInSpecSheet', headerName: 'Include In Spec Sheet', hide: true, isVirtual: true },
    
    // Service Information
    { field: 'tcgEquivalent', headerName: 'TCG Equivalent', hide: true, isVirtual: true },
    { field: 'serviceSub1', headerName: 'Service Sub1', hide: true, isVirtual: true },
    { field: 'serviceSub2', headerName: 'Service Sub2', hide: true, isVirtual: true },
    { field: 'colorFinish', headerName: 'Color Finish', hide: true, isVirtual: true },
    
    // Supplier and Origin
    { field: 'supplier', headerName: 'Supplier', hide: false, isVirtual: false },
    { field: 'countryOfOrigin', headerName: 'Country Of Origin', hide: true, isVirtual: true },
    
    // Physical Properties
    { field: 'color', headerName: 'Color', hide: false, isVirtual: false },
    
    // Quantity and Units
    { field: 'qty', headerName: 'Qty', hide: false, isVirtual: false },
    { field: 'uom', headerName: 'UoM', hide: true, isVirtual: true },
    
    // Dates
    { field: 'startDate', headerName: 'Start Date', hide: false, isVirtual: false },
    { field: 'endDate', headerName: 'End Date', hide: false, isVirtual: false }
  ];
  // Grid configuration - client-side
  public gridOptions: GridOptions = {
    theme: 'legacy', // Use legacy theme for Firefox 102 ESR compatibility
    animateRows: true,
    enableCellTextSelection: true,
    rowSelection: 'single' as const,
    suppressColumnVirtualisation: false,
    suppressHorizontalScroll: false, // Ensure horizontal scroll is enabled
    suppressColumnMoveAnimation: false, // Enable smooth column move animation
    suppressDragLeaveHidesColumns: false, // Allow normal drag behavior
    suppressFieldDotNotation: true,
    suppressContextMenu: false,
    suppressScrollOnNewData: false,
    allowDragFromColumnsToolPanel: true,
    suppressRowVirtualisation: false,
    // Force horizontal scroll to be visible
    domLayout: 'normal',
    // Quick filter configuration
    quickFilterText: '', // Enable quick filter functionality
    includeHiddenColumnsInQuickFilter: false, // Don't search hidden columns
    cacheQuickFilter: true, // Improve performance for large datasets
    // Ensure client-side row model for quick filter to work
    rowModelType: 'clientSide',
    // Enable keyboard navigation and editing
    navigateToNextCell: (params) => {
      // Allow normal navigation
      return params.nextCellPosition;
    },
    tabToNextCell: (params) => {
      // Return false to prevent tabbing if we're at the last cell, otherwise return next position
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
      return '';
    },
    // Firefox 102 ESR compatibility settings
    // Force horizontal scroll to always be visible
    // Enable native scrolling for better Firefox compatibility
    enableRangeSelection: false,
    // Disable animations that might cause issues in older Firefox
    suppressAnimationFrame: true,
    context: {
      dataService: null // Will be set in constructor
    },
    // Removed getRowClass to improve scroll performance
    // New row styling is now handled via cell-level styling in column definitions
    onGridReady: (params) => {
      this.gridApi = params.api;
      // Don't auto-size columns on ready to preserve manual resizing
      
      // Force horizontal scrollbar visibility for Firefox 102 ESR
      setTimeout(() => {
        this.forceHorizontalScrollbarVisibility();
      }, 100);
    },
    onCellValueChanged: (params) => {
      // Track changes for all editable fields
      this.trackFieldChange(params);
      
      // Handle part number changes for auto-populating feature
      if (params.colDef.field === 'part') {
        this.onNewRowValueChanged(params);
        
        // Force refresh to ensure the value is displayed
        setTimeout(() => {
          this.gridApi.refreshCells({
            rowNodes: [params.node],
            force: true
          });
        }, 100);
      }
      
      // Ensure values are properly saved for new rows
      if (params.data && params.data.isNewRow && params.colDef.field) {
        // Force update the data model to ensure values persist
        params.node.setDataValue(params.colDef.field, params.newValue);
        
        // Also update the data object directly
        if (params.node.data) {
          (params.node.data as any)[params.colDef.field] = params.newValue;
        }
        
        // Update placeholder styling after value change
        setTimeout(() => {
          this.gridApi.refreshCells({
            rowNodes: [params.node],
            columns: params.colDef.field ? [params.colDef.field] : undefined,
            force: true
          });
        }, 50);
      }
    },
    onCellKeyDown: (params) => {
      // Handle Ctrl+V for paste in SKU columns of new rows
      if (params.event && (params.event as KeyboardEvent).ctrlKey && 
          (params.event as KeyboardEvent).key === 'v' && 
          (params as any).colDef?.field && (params as any).colDef.field.startsWith('sku') &&
          params.data && params.data.isNewRow) {
        this.pasteSkuValue(params as any);
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

  // Helper method to size columns to fit with improved experience
  private sizeColumnsToFit() {
    if (!this.gridApi) return;
    
    // Use auto-sizing for better initial column widths
    this.gridApi.autoSizeAllColumns();
    
    // Refresh the grid to apply changes
    this.gridApi.refreshHeader();
  }

  // Force horizontal scrollbar visibility for Firefox
  private forceHorizontalScrollbarVisibility(): void {
    if (!this.gridApi) return;
    
    // Force refresh to ensure proper rendering
    this.gridApi.refreshCells({ force: true });
    
    // Comprehensive approach for old Firefox
    const horizontalScrollViewport = document.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement;
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
    
    // Also ensure the grid container allows scrolling
    const gridContainer = document.querySelector('.ag-grid-container-wrapper') as HTMLElement;
    if (gridContainer) {
      gridContainer.style.overflowX = 'auto';
      gridContainer.style.setProperty('-moz-overflow-scrolling', 'touch');
    }
    
    // Force a reflow to ensure Firefox applies the styles
    setTimeout(() => {
      if (horizontalScrollViewport) {
        horizontalScrollViewport.style.display = 'block';
        horizontalScrollViewport.offsetHeight; // Force reflow
        // Additional force for old Firefox
        horizontalScrollViewport.style.setProperty('overflow-x', 'auto');
        horizontalScrollViewport.style.setProperty('scrollbar-width', 'auto');
      }
    }, 100);
    
    // Additional attempts specifically for old Firefox
    setTimeout(() => {
      this.forceOldFirefoxScroll();
    }, 200);
    

  }

  // Additional method specifically for old Firefox
  private forceOldFirefoxScroll(): void {
    const horizontalScrollViewport = document.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement;
    if (horizontalScrollViewport) {
      // Force scrollbar visibility with multiple approaches
      horizontalScrollViewport.style.setProperty('overflow-x', 'auto', 'important');
      horizontalScrollViewport.style.setProperty('scrollbar-width', 'auto', 'important');
      horizontalScrollViewport.style.setProperty('min-width', 'max-content', 'important');
      
      // Force a scroll to trigger scrollbar visibility
      horizontalScrollViewport.scrollLeft = 1;
      horizontalScrollViewport.scrollLeft = 0;
    }
    

  }

  // Date formatter function for MM/DD/YYYY format
  private dateFormatter(params: any): string {
    if (!params.value) return '';
    
    // Handle string dates in MM/DD/YYYY format from mock data
    if (typeof params.value === 'string') {
      // Check if it's already in MM/DD/YYYY format
      const mmddyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
      if (mmddyyyyPattern.test(params.value)) {
        return params.value; // Already in correct format
      }
    }
    
    // Handle Date objects or other string formats
    const date = new Date(params.value);
    if (isNaN(date.getTime())) return params.value; // Return original if invalid date
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  }

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];
  public skuColumns: any[] = []; // Dynamic SKU columns

  public rowData: any[] = [];
  public totalRows = 1000;

  constructor(private router: Router, public dataService: DataService, private columnService: ColumnService) {
    // Set the data service in grid context immediately
    this.gridOptions.context = {
      dataService: this.dataService
    };
    
    // Load expired data state from localStorage
    const savedState = localStorage.getItem('showExpiredData');
    this.showExpiredData = savedState === 'true';
    
    // Load last saved timestamp from localStorage
    const savedTimestamp = localStorage.getItem('lastSavedAt');
    if (savedTimestamp) {
      this.lastSavedAt = new Date(savedTimestamp);
    }
    
    this.defaultColDef = this.columnService.getDefaultColDef(this);
    this.loadData();
  }

  ngOnInit(): void { }

  loadData(): void {
    this.dataService.loadMockData().subscribe(data => {
      // Transform mock data to grid format - use only the base data (176 entries)
      let baseData = this.dataService.transformToGridData(data.mbom);
      
      // Always generate expired entries to get the count
      const expiredEntries = this.generateExpiredEntries();
      this.expiredDataCount = expiredEntries.length;
      
      if (this.showExpiredData) {
        // Show expired entries when toggle is on
        this.rowData = [...expiredEntries, ...baseData];
      } else {
        // Hide expired entries when toggle is off
        this.rowData = [...baseData];
      }
      
      // Initialize columns after data is loaded
      this.initializeColumns();
      
      // Make only some parts clickable (random selection from first 20 rows)
      this.initializeClickableParts();
    });
  }

  generateExpiredEntries(): any[] {
    const today = new Date();
    const expiredEntries = [
      {
        part: '5000001',
        supplier: 'Expired Supplier 1',
        color: 'Red',
        feature: 'Expired Frame',
        startDate: '01/01/2023',
        endDate: '12/31/2023',
        qty: 5,
        isExpired: true
      },
      {
        part: '5000002',
        supplier: 'Expired Supplier 2',
        color: 'Orange',
        feature: 'Expired Hardware',
        startDate: '02/01/2023',
        endDate: '11/30/2023',
        qty: 3,
        isExpired: true
      },
      {
        part: '5000003',
        supplier: 'Expired Supplier 3',
        color: 'Yellow',
        feature: 'Expired Label',
        startDate: '03/01/2023',
        endDate: '10/31/2023',
        qty: 8,
        isExpired: true
      }
    ];

    // Add SKU columns with empty values for expired entries
    const skuInfo = this.dataService.getSkuInfo();
    expiredEntries.forEach(entry => {
      skuInfo.forEach(sku => {
        (entry as any)[`sku${sku.sku}`] = '';
      });
    });

    return expiredEntries;
  }

  initializeClickableParts(): void {
    // Make approximately 30% of parts from first 20 rows clickable
    const first20Parts = this.rowData.slice(0, 20).map(row => row.part.toString());
    const clickableCount = Math.floor(first20Parts.length * 0.3); // 30% of first 20
    
    // Randomly select parts to be clickable
    for (let i = 0; i < clickableCount; i++) {
      const randomIndex = Math.floor(Math.random() * first20Parts.length);
      this.clickableParts.add(first20Parts[randomIndex]);
    }

  }

  initializeColumns(): void {
    // Get SKU columns from data service
    const skuColumns = this.dataService.getSkuInfo().map(sku => ({
      skuId: sku.sku,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size,
      fieldName: `sku${sku.sku}`,
      hasData: true
    }));
    
    // Build column definitions using the column service
    this.columnDefs = this.columnService.buildColumnDefinitions(skuColumns, this.dataService, this);

  }

  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.sizeColumnsToFit();
  }

  getColumnDisplayName(col: any): string {
    // Return the exact same header name as shown in the grid
    return col.headerName || col.field;
  }

  isSkuColumn(col: any): boolean {
    // Check if the column is a SKU column by examining the field name
    return col.field && (col.field.startsWith('sku') || col.field.startsWith('actions'));
  }

  getFirstSkuFieldName(): string {
    // Get the first SKU column field name
    const skuInfo = this.dataService.getSkuInfo();
    if (skuInfo && skuInfo.length > 0) {
      return `sku${skuInfo[0].sku}`;
    }
    return '';
  }

  toggleExpiredData(): void {
    // Save state to localStorage
    localStorage.setItem('showExpiredData', this.showExpiredData.toString());
    
    // Reload data with or without expired entries
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      const visible = (event.target as HTMLInputElement).checked;

      if (col.isVirtual) {
        // Just update metadata for virtual columns
        col.hide = !visible;
      } else {
        // Real AG Grid column
        this.gridApi.setColumnsVisible([col.field], visible);
        col.hide = !visible;
      }
    } else {
      // Toggle visibility panel
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
      
      // Remove existing listener first to prevent duplicates
      document.removeEventListener('click', this.handleClickOutside, true);
      
      // Add click outside handler when panel opens
      if (this.showColumnVisibilityPanel) {
        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
          document.addEventListener('click', this.handleClickOutside, true);
        }, 150);
      }
    }
  }

  private handleClickOutside = (event: Event): void => {
    const target = event.target as Element;
    const panel = document.querySelector('.grid-column-visibility-panel-container');
    const toggleBtn = document.querySelector('.grid-toggle-columns-btn');
    const toggleContainer = document.querySelector('.grid-toggle-button-container');
    
    // Check if click is outside all relevant elements
    const clickedOutside = panel && !panel.contains(target) && 
                          toggleBtn && !toggleBtn.contains(target) &&
                          toggleContainer && !toggleContainer.contains(target);
    
    if (clickedOutside) {
      this.showColumnVisibilityPanel = false;
      document.removeEventListener('click', this.handleClickOutside, true);
      // Force change detection since we're outside Angular zone
      setTimeout(() => {
        // This ensures Angular detects the change
      }, 0);
    }
  }

  closePanelOnClickOutside(event: Event): void {
    // Legacy method - keeping for compatibility
    this.handleClickOutside(event);
  }

  onCellClicked(event: any): void {
    const target = event.event?.target as HTMLElement;

    // Handle paste button click first
    const pasteButton = target?.closest('[data-action="paste"]');
    if (pasteButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (event.colDef.field && event.colDef.field.startsWith('sku') && event.data && event.data.isNewRow) {
        // Ensure we're not in edit mode
        event.api.stopEditing(true);
        
        // Small delay to ensure edit mode is fully cleared
        setTimeout(() => {
          // Execute paste
          this.pasteSkuValue(event);
        }, 0);
      }
      return;
    }

    // Handle copy button click
    if (target && (target.closest('.copy-button') || target.matches('.copy-button'))) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (event.colDef.field && event.colDef.field.startsWith('sku') && event.data && event.data.isNewRow && event.value) {
        this.copySkuValue(event);
      }
      return;
    }

    // Start editing for part field in new rows
    if (event.colDef.field === 'part' && event.data && event.data.isNewRow) {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key
      });
      return;
    }
    
    if (event.colDef.field === 'actions') {
      const target = event.event?.target as HTMLElement;
      
      if (target && target.classList.contains('add-row-btn')) {
        const partId = target.getAttribute('data-part-id') || '';
        if (partId) {
          this.addRowAfter(partId);
          return;
        }
      } else if (target && target.classList.contains('delete-row-btn')) {
        const partId = target.getAttribute('data-part-id');
        const newRowId = target.getAttribute('data-new-row-id');
        
        if (newRowId !== null) {
          // Delete by new row ID for new rows
          this.deleteRowById(parseInt(newRowId));
          return;
        } else if (partId) {
          // Delete by part ID for existing rows
          this.deleteRow(partId);
          return;
        }
      }
    } else if (event.colDef.field === 'part') {
      // Don't open modal for new rows - they are in edit mode
      if (event.data && event.data.isNewRow) {
        return; // Skip modal opening for new rows
      }
      
      // Check if it's a clickable part for modal
      if (this.clickableParts.has(event.value?.toString())) {
        this.openPartModal(event.value?.toString());
      }
    }
  }

  openPartModal(partId: string): void {
    // Find the part data from the current row data
    const partData = this.rowData.find(row => row.part.toString() === partId);
    if (partData) {
      this.selectedPartData = partData;
      this.selectedPartSkuData = this.dataService.getSkuDataForPart(partData);
      this.showPartModal = true;
    }
  }

  closePartModal(): void {
    this.showPartModal = false;
    this.selectedPartData = {};
    this.selectedPartSkuData = [];
  }

  trackFieldChange(params: any): void {
    // Skip if values are the same (no actual change)
    if (params.oldValue === params.newValue) {
      return;
    }

    const partId = params.data.part.toString();
    const fieldName = params.colDef.field;
    
    // Skip tracking during auto-population
    if (params.data.isNewRow && fieldName !== 'part') {
      return;
    }
    
    // Mark row as edited
    this.editedRows.add(partId);
    
    // Refresh the row to apply styling
    this.gridApi.refreshCells({
      rowNodes: [params.node],
      force: true
    });
  }

  saveChanges(): void {
    if (this.editedRows.size === 0) {
      this.showSaveMessage('No changes to save', 'info');
      return;
    }
    
    // Capture the number of changes before clearing
    const changesCount = this.editedRows.size;
    const changedParts = Array.from(this.editedRows);
    // Show saving message
    this.showSaveMessage(`Saving ${changesCount} changes...`, 'info');
    
    // Simulate API call delay
    setTimeout(() => {
      // Update new rows to be regular rows after save
      this.rowData = this.rowData.map(row => {
        if (row.isNewRow) {
          // Convert new row to regular row
          const updatedRow = { ...row };
          delete updatedRow.isNewRow;
          delete updatedRow.newRowId;
          delete updatedRow.insertAfter;
          return updatedRow;
        }
        return row;
      });
      
      // Clear the edited state
      this.editedRows.clear();
      
      // Clear copy state to remove copyable behavior after save
      this.clearCopyState();
      
      // Clear new rows tracking
      this.newRows.clear();
      
      // Refresh the grid to apply all changes
      this.gridApi.refreshCells({
        force: true,
        suppressFlash: false
      });
      
      // Update last saved timestamp
      this.lastSavedAt = new Date();
      
      // Save timestamp to localStorage for persistence
      localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
      
      // Show success message with correct count
      this.showSaveMessage(`Successfully saved ${changesCount} changes!`, 'success');
    }, 1000);
  }
  
  showSaveMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.saveMessage = message;
    this.saveMessageType = type;
    
    // Auto-clear success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.clearSaveMessage();
      }, 3000);
    }
  }
  
  clearSaveMessage(): void {
    this.saveMessage = '';
    this.saveMessageType = '';
  }

  // Copy SKU value from a cell (only for new rows)
  copySkuValue(params: any): void {
    if (!params.data || !params.data.isNewRow || !params.value) {
      return;
    }

    this.copiedSkuValue = params.value;
    this.copiedFromRowId = params.data.newRowId; // Track the row ID where value was copied from
    this.copiedFromCellKey = `${params.node.rowIndex}-${params.colDef.field}`;
    
    // Visual feedback - refresh cells to show copy indicator
    this.gridApi.refreshCells({
      force: true
    });
  }

  pasteSkuValue(params: any): void {
    if (!params.data || !params.data.isNewRow || !this.copiedSkuValue) {
      return;
    }

    // Only allow pasting within the same row where the value was copied from
    if (this.copiedFromRowId !== null && params.data.newRowId !== this.copiedFromRowId) {

      return;
    }

    // Don't paste if the cell already has the same value
    if (params.value === this.copiedSkuValue) {
      return;
    }

    // Stop any ongoing editing
    this.gridApi.stopEditing();

    // Set the value in the cell
    params.node.setDataValue(params.colDef.field, this.copiedSkuValue);
    
    // Mark the row as edited
    if (params.data.newRowId) {
      this.editedRows.add(params.data.newRowId);
    }

    // Force immediate refresh of the entire row to ensure all values are visible
    this.gridApi.redrawRows({
      rowNodes: [params.node]
    });
    
    // Additional refresh after a short delay to ensure visibility
    setTimeout(() => {
      // Refresh cells again
      this.gridApi.refreshCells({
        rowNodes: [params.node],
        force: true
      });
      
      // Flash the cell to show the paste was successful
      this.gridApi.flashCells({
        rowNodes: [params.node],
        columns: [params.colDef.field]
      });
    }, 50);
  }

  // Clear copy state and visual indicators
  clearCopyState(): void {
    this.copiedSkuValue = '';
    this.copiedFromRowId = null;
    this.copiedFromCellKey = '';
    
    // Refresh grid to remove visual indicators
    this.gridApi.refreshCells({
      force: true
    });
  }

  addRowAfter(partId: string): void {
    const newRowId = this.nextRowId++;
    const newRow = {
      part: '', // Start with empty string for part
      supplier: '',
      color: '',
      feature: '',
      startDate: '',
      endDate: '',
      qty: 0,
      isNewRow: true,
      newRowId: newRowId, // Add the unique ID to the row data
      insertAfter: partId
    };

    // Add SKU columns with empty values
    const skuInfo = this.dataService.getSkuInfo();
    skuInfo.forEach(sku => {
      (newRow as any)[`sku${sku.sku}`] = '';
    });

    this.newRows.set(newRowId, newRow);
    
    // Find the target row in the current data
    const insertIndex = this.rowData.findIndex(row => row.part.toString() === partId);
    if (insertIndex !== -1) {
      // Store current scroll context
      const currentFirstVisibleRow = this.gridApi.getFirstDisplayedRowIndex();
      const currentLastVisibleRow = this.gridApi.getLastDisplayedRowIndex();
      const newRowIndex = insertIndex + 1;
      
      // Use AG Grid's transaction API for efficient updates
      const transaction = {
        addIndex: newRowIndex,  // Insert after the target row
        add: [newRow]
      };
      
      // Apply the transaction - AG Grid handles the update efficiently
      this.gridApi.applyTransaction(transaction);
      
      // Update our local rowData to stay in sync
      this.rowData.splice(newRowIndex, 0, newRow);
      
      // Smart scroll behavior - show new row without jumping away from current area
      setTimeout(() => {
        // If the new row is within or near the currently visible area
        if (newRowIndex >= currentFirstVisibleRow - 2 && newRowIndex <= currentLastVisibleRow + 2) {
          // If the new row is below the current visible area, scroll just enough to show it
          if (newRowIndex > currentLastVisibleRow) {
            this.gridApi.ensureIndexVisible(newRowIndex, 'bottom');
          }
          // If the new row is above the current visible area, scroll just enough to show it
          else if (newRowIndex < currentFirstVisibleRow) {
            this.gridApi.ensureIndexVisible(newRowIndex, 'top');
          }
          // If the new row is already visible, don't scroll at all
        }
        // Otherwise, don't scroll - let the user stay where they are
      }, 50);
    }
  }

  deleteRowById(newRowId: number): void {
    // Find the row to be deleted by newRowId
    const rowIndex = this.rowData.findIndex(row => row.newRowId === newRowId);
    
    if (rowIndex === -1) {
      return;
    }
    
    const rowToDelete = this.rowData[rowIndex];
    
    // Only allow deletion of new rows
    if (!rowToDelete.isNewRow) {
      return;
    }
    
    // Store current scroll context BEFORE deletion
    const currentFirstVisibleRow = this.gridApi.getFirstDisplayedRowIndex();
    const currentLastVisibleRow = this.gridApi.getLastDisplayedRowIndex();
    
    // Remove from newRows map
    this.newRows.delete(newRowId);
    
    // Use AG Grid's transaction API for efficient deletion
    const transaction = {
      remove: [rowToDelete]
    };
    
    // Apply the transaction - AG Grid handles the update efficiently
    this.gridApi.applyTransaction(transaction);
    
    // Update our local rowData to stay in sync
    this.rowData.splice(rowIndex, 1);
    
    // Minimal scroll behavior after deletion - only adjust if absolutely necessary
    setTimeout(() => {
      // Only adjust scroll if we deleted a row above the current view
      if (rowIndex < currentFirstVisibleRow) {
        // Deleted above view - shift current view up by 1 to compensate
        const adjustedFirstRow = Math.max(0, currentFirstVisibleRow - 1);
        this.gridApi.ensureIndexVisible(adjustedFirstRow, 'top');
      }
      // If row was within or below current view, let AG Grid handle naturally - no forced scrolling
    }, 30);
  }

  deleteRow(partId: string): void {
    // Find the row to be deleted
    const rowIndex = this.rowData.findIndex(row => row.part.toString() === partId);
    
    if (rowIndex !== -1) {
      const rowToDelete = this.rowData[rowIndex];
      
      // Only allow deletion of new rows
      if (!rowToDelete.isNewRow) {
        return;
      }
      
      // Store current scroll context BEFORE deletion
      const currentFirstVisibleRow = this.gridApi.getFirstDisplayedRowIndex();
      const currentLastVisibleRow = this.gridApi.getLastDisplayedRowIndex();
      
      // Remove from newRows if it exists
      this.newRows.delete(parseInt(partId));
      
      // Use AG Grid's transaction API for efficient deletion
      const transaction = {
        remove: [rowToDelete]
      };
      
      // Apply the transaction - AG Grid handles the update efficiently
      this.gridApi.applyTransaction(transaction);
      
      // Update our local rowData to stay in sync
      this.rowData.splice(rowIndex, 1);
      
      // Minimal scroll behavior after deletion - only adjust if absolutely necessary
      setTimeout(() => {
        // Only adjust scroll if we deleted a row above the current view
        if (rowIndex < currentFirstVisibleRow) {
          // Deleted above view - shift current view up by 1 to compensate
          const adjustedFirstRow = Math.max(0, currentFirstVisibleRow - 1);
          this.gridApi.ensureIndexVisible(adjustedFirstRow, 'top');
        }
        // If row was within or below current view, let AG Grid handle naturally - no forced scrolling
      }, 30);
    }
  }

  getUniqueFeatures(): string[] {
    const features = new Set<string>();
    this.rowData.forEach(row => {
      if (row.feature && !row.isNewRow) {
        features.add(row.feature);
      }
    });
    const result = Array.from(features).sort();

    return result;
  }

  // Get all columns for the visibility panel (real + virtual)
  get allColumnsForPanel() {
    return this.allColumns;
  }

  // Get only real columns for AG Grid (filter out virtual ones)
  get realColumnsForGrid() {
    return this.allColumns.filter(col => !col.isVirtual);
  }

  // Get select all state
  get selectAllState() {
    const visibleColumns = this.allColumns.filter(col => !col.isVirtual && !col.hide);
    const totalColumns = this.allColumns.filter(col => !col.isVirtual);
    
    if (visibleColumns.length === 0) return false;
    if (visibleColumns.length === totalColumns.length) return true;
    return null; // indeterminate state
  }

  // Toggle select all
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    
    this.allColumns.forEach(col => {
      if (!col.isVirtual) {
        col.hide = !checked;
        if (this.gridApi) {
          this.gridApi.setColumnsVisible([col.field], checked);
        }
      }
    });
  }

  getAvailablePartNumbers(): string[] {
    // This method can be easily modified to make API calls later
    const partNumbers = new Set<string>();
    this.rowData.forEach(row => {
      if (!row.isNewRow) {
        partNumbers.add(row.part.toString());
      }
    });
    const result = Array.from(partNumbers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return result;
  }

  getUniqueSuppliers(): string[] {
    const suppliers = new Set<string>();
    this.rowData.forEach(row => {
      if (row.supplier && !row.isNewRow) {
        suppliers.add(row.supplier);
      }
    });
    return Array.from(suppliers).sort();
  }

  getUniqueColors(): string[] {
    const colors = new Set<string>();
    this.rowData.forEach(row => {
      if (row.color && !row.isNewRow) {
        colors.add(row.color);
      }
    });
    return Array.from(colors).sort();
  }

  // Method for future API integration
  async searchPartNumbers(searchTerm: string): Promise<string[]> {
    // TODO: Replace with actual API call
    // Example: return this.dataService.searchParts(searchTerm);
    
    // For now, filter existing data
    const allParts = this.getAvailablePartNumbers();
    if (!searchTerm) {
      return allParts.slice(0, 5); // Return first 5 if no search term
    }
    
    return allParts
      .filter(part => part.includes(searchTerm))
      .slice(0, 5); // Limit to 5 results
  }

  onNewRowValueChanged(params: any): void {
    // If part number is changed, populate the feature from existing data
    if (params.field === 'part' && params.newValue) {
      // Get the original mock data from the data service
      const mockData = this.dataService.getMockData();
      
      if (mockData && mockData.mbom) {
        // Search in the original mock data
        const existingPart = mockData.mbom.find(part => 
          part.part === params.newValue
        );
        
        if (existingPart) {
          
          // Auto-populate all available fields from the existing part
          const fieldsToPopulate = ['supplier', 'color', 'feature', 'shortDesc', 'longDesc', 'startDate', 'endDate', 'qty'];
          const existingPartData = existingPart as any; // Cast to any for dynamic field access
          
          // Temporarily disable cell value changed events
          const oldData = { ...params.node.data };
          
          // Auto-populate base fields
          fieldsToPopulate.forEach(fieldName => {
            if (existingPartData[fieldName] !== undefined && existingPartData[fieldName] !== null) {
              let valueToSet = existingPartData[fieldName];
              
              // Special handling for date fields
              if (fieldName === 'startDate' || fieldName === 'endDate') {
                const date = new Date(valueToSet);
                if (!isNaN(date.getTime())) {
                  valueToSet = date.toISOString();
                }
              }
              
              // Only update if value is different
              if (oldData[fieldName] !== valueToSet) {
                params.node.setDataValue(fieldName, valueToSet);
                if (params.node.data) {
                  (params.node.data as any)[fieldName] = valueToSet;
                }

              }
            }
          });
          
          // Auto-populate SKU columns based on the skus array in the existing part
          const skuInfo = this.dataService.getSkuInfo();
          if (skuInfo && skuInfo.length > 0) {
            skuInfo.forEach(sku => {
              const skuFieldName = `sku${sku.sku}`;
              const newSkuValue = existingPartData.skus && existingPartData.skus.includes(sku.sku) 
                ? existingPartData.part // If SKU is included, use part number
                : ''; // If SKU is not included, use empty string
              
              // Only update if value is different
              if (oldData[skuFieldName] !== newSkuValue) {
                params.node.setDataValue(skuFieldName, newSkuValue);
                if (params.node.data) {
                  (params.node.data as any)[skuFieldName] = newSkuValue;
                }

              }
            });
          }
          
          // Refresh the row to show all updated values
          setTimeout(() => {
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              force: true
            });
          }, 100);
        }
      }
    }
    
    // Track edited rows for styling
    if (!params.data.isNewRow) {
      this.editedRows.add(params.data.part.toString());
    }
  }

  formatLastSavedTime(date: Date): string {
    // Always show full date and time only
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    return date.toLocaleDateString('en-US', options);
  }

  // Search functionality methods
  onSearchTextChange(): void {
    // Auto-apply filter as user types (debounced)
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
    
    this.searchTextDebounceTimer = setTimeout(() => {
      this.applyQuickFilter();
    }, 300); // 300ms debounce
  }

  private searchTextDebounceTimer: any;

  applyQuickFilter(): void {
    if (!this.gridApi) return;
    
    // Apply AG Grid's quick filter using the correct method for v34
    this.gridApi.setGridOption('quickFilterText', this.searchText);
  }

  clearSearch(): void {
    this.searchText = '';
    this.applyQuickFilter();
    
    // Clear the debounce timer if active
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
  }

}