import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { DataService } from './services/data.service';
// AutocompleteCellEditorComponent is used in column definitions, not in template
// @ts-ignore - Used in column definitions
import { AutocompleteCellEditorComponent } from './autocomplete-cell-editor/autocomplete-cell-editor.component';

// AutocompleteCellEditorComponent usage examples available in component documentation

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridAngular, PartModalComponent, AutocompleteCellEditorComponent], // AutocompleteCellEditorComponent used in column definitions
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
  // Grid configuration - client-side
  public gridOptions: GridOptions = {
    theme: 'legacy', // Use legacy theme for Firefox 102 ESR compatibility
    animateRows: true,
    enableCellTextSelection: true,
    rowSelection: 'single' as const,
    suppressColumnVirtualisation: false,
    suppressHorizontalScroll: false,
    suppressColumnMoveAnimation: true,
    suppressDragLeaveHidesColumns: true,
    suppressFieldDotNotation: true,
    suppressContextMenu: false,
    suppressScrollOnNewData: false,
    allowDragFromColumnsToolPanel: true,
    suppressRowVirtualisation: false,
    // Quick filter configuration
    quickFilterText: '', // Enable quick filter functionality
    includeHiddenColumnsInQuickFilter: false, // Don't search hidden columns
    cacheQuickFilter: true, // Improve performance for large datasets
    // Ensure client-side row model for quick filter to work
    rowModelType: 'clientSide',
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
    
    onFilterChanged: (params) => {
      // Filter changed event
    },
    
    onFilterModified: (params) => {
      // Filter modified event
    },
    
    // Removed onBodyScroll handler to improve performance
    // AG-Grid handles scrolling efficiently by default
  };

  // Helper method to size columns to fit
  private sizeColumnsToFit() {
    if (!this.gridApi) return;
    
    this.gridApi.sizeColumnsToFit({
      defaultMinWidth: 140,
      columnLimits: [
        { key: 'part', minWidth: 140 },
        { key: 'supplier', minWidth: 160 },
        { key: 'color', minWidth: 140 },
        { key: 'feature', minWidth: 180 },
        { key: 'startDate', minWidth: 150 },
        { key: 'endDate', minWidth: 150 },
        { key: 'qty', minWidth: 100 }
      ]
    });
    
    // Ensure the last column is fully visible
    setTimeout(() => {
      const allColumns = this.gridApi.getColumns();
      if (allColumns && allColumns.length > 0) {
        const lastCol = allColumns[allColumns.length - 1];
        this.gridApi.autoSizeColumns([lastCol.getColId()]);
      }
    }, 100);
  }

  // Force horizontal scrollbar visibility for Firefox 102 ESR
  private forceHorizontalScrollbarVisibility(): void {
    if (!this.gridApi) return;
    
    // Force refresh to ensure proper rendering
    this.gridApi.refreshCells({ force: true });
    
    // Ensure horizontal scroll is enabled
    const horizontalScrollViewport = document.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement;
    if (horizontalScrollViewport) {
      horizontalScrollViewport.style.overflowX = 'auto';
      horizontalScrollViewport.style.minWidth = 'max-content';
      horizontalScrollViewport.style.width = 'max-content';
      
      // Force scrollbar to be visible
      horizontalScrollViewport.style.scrollbarWidth = 'auto';
      horizontalScrollViewport.style.scrollbarColor = '#cbd5e1 #f1f5f9';
      
      // Add Firefox-specific styles
      horizontalScrollViewport.style.setProperty('-moz-overflow-scrolling', 'touch');
      horizontalScrollViewport.style.setProperty('-moz-user-select', 'none');
      horizontalScrollViewport.style.setProperty('-moz-user-drag', 'none');
    }
    
    // Ensure grid container allows proper scrolling
    const gridContainer = document.querySelector('.ag-grid-container') as HTMLElement;
    if (gridContainer) {
      gridContainer.style.overflow = 'visible';
      gridContainer.style.position = 'relative';
    }
    
    console.log('Forced horizontal scrollbar visibility for Firefox 102 ESR');
  }

  // Date formatter function for MM/DD/YYYY format
  private dateFormatter(params: any): string {
    if (!params.value) return '';
    const date = new Date(params.value);
    if (isNaN(date.getTime())) return params.value; // Return original if invalid date
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  }

  public defaultColDef = {
    sortable: true,
    filter: 'agTextColumnFilter',
    resizable: true,
    floatingFilter: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    headerClass: 'custom-header-with-border',
    filterParams: {
      suppressAndOrCondition: true,   // removes AND/OR + 2nd filter
      buttons: ['reset', 'apply'],    // shows Apply / Reset
      defaultOption: 'contains'       // sets default filter type
    },
    width: 140,
    minWidth: 120,
    wrapText: false,
    suppressSizeToFit: false,
    cellStyle: (params: any) => {
      const baseStyle = {
        padding: '8px 12px',
        borderRight: '1px solid #e2e8f0'
      };
      
      // Temporarily removed custom styling for testing
      return baseStyle;
    }
  };

  public columnDefs: ColDef[] = [];
  public skuColumns: any[] = []; // Dynamic SKU columns

  public rowData: any[] = [];
  public totalRows = 1000;

  constructor(private router: Router, public dataService: DataService) {
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
    
    this.loadData();
  }

  ngOnInit(): void { }

  loadData(): void {
    this.dataService.loadMockData().subscribe(data => {
      // Transform mock data to grid format
      let baseData = this.dataService.transformToGridData(data.mbom);
      let additionalData = this.dataService.generateAdditionalData(data.mbom, 1000);
      
      // Always generate expired entries to get the count
      const expiredEntries = this.generateExpiredEntries();
      this.expiredDataCount = expiredEntries.length;
      
      if (this.showExpiredData) {
        // Show expired entries when toggle is on
        this.rowData = [...expiredEntries, ...baseData, ...additionalData];
      } else {
        // Hide expired entries when toggle is off
        this.rowData = [...baseData, ...additionalData];
      }
      
      // Initialize columns after data is loaded
      this.initializeColumns();
      
      // Make only some parts clickable (random selection from first 20 rows)
      this.initializeClickableParts();
      
      console.log('Loaded data:', this.rowData.length, 'rows');
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
    
    console.log('Clickable parts:', Array.from(this.clickableParts));
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
    
    // Build column definitions
    this.columnDefs = this.buildColumnDefinitions(skuColumns);
    console.log('Dynamic columns created:', this.columnDefs.length);
    console.log('SKU columns found:', skuColumns);
  }

  buildColumnDefinitions(skuColumns: any[]): ColDef[] {
    const baseColumns: ColDef[] = [
      {
        headerName: '',
        field: 'actions',
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          if (params.data.isNewRow) {
            // For new rows, use the newRowId as identifier since part is empty
            const newRowId = params.data.newRowId;
            return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
          }
          
          // Show red "e" for expired data
          if (params.data.isExpired) {
            return `<span class="expired-indicator" title="Expired">e</span>`;
          }
          
          const partId = params.data.part || '';
          return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
        },
        cellStyle: {
          textAlign: 'center',
          padding: '4px',
          borderRight: '1px solid #e2e8f0'
        }
      },
      {
        headerName: 'Part',
        field: 'part',
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          // Always show the value, whether it's a new row or existing row
          if (params.data.isNewRow) {
            if (!params.value) {
              return '<span class="new-row-placeholder">Click to enter part number...</span>';
            }
            return params.value; // Show the selected value for new rows
          }
          
          // Check if this part matches the first SKU to determine color
          const skuInfo = this.dataService.getSkuInfo();
          let isMatching = false;
          if (skuInfo && skuInfo.length > 0) {
            const firstSkuField = `sku${skuInfo[0].sku}`;
            const firstSkuValue = params.data[firstSkuField];
            isMatching = firstSkuValue && String(params.value) === String(firstSkuValue);
          }
          
          const isClickable = this.clickableParts.has(params.value);
          
          if (isMatching) {
            // Matching values get red text, regardless of clickability
            return `<span class="part-text matching-value" style="color: #d32f2f !important; font-weight: 600;">${params.value}</span>`;
          } else if (isClickable) {
            // Non-matching clickable parts get blue link
            return `<span class="part-link clickable">${params.value}</span>`;
          } else {
            // Non-matching, non-clickable parts get gray text
            return `<span class="part-text">${params.value}</span>`;
          }
        },
        width: 140,
        minWidth: 120,
        maxWidth: 180,
        pinned: 'left',
        resizable: true,
        editable: (params) => params.data.isNewRow, // Only editable for new rows
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: (params: any) => ({
          values: this.getAvailablePartNumbers(),
          placeholder: 'Type to search part numbers...'
        }),
        cellStyle: (params: any) => {
          // Enhanced styling for new rows
          if (params.data && params.data.isNewRow) {
            return {
              border: '2px solid #007bff',
              backgroundColor: '#f8fbff',
              fontStyle: params.value ? 'normal' : 'italic'
            };
          }
          return null;
        },
        headerClass: 'part-column-header'
      },
      {
        headerName: 'Supplier',
        field: 'supplier',
        filter: 'agTextColumnFilter',
        width: 160,
        minWidth: 140,
        maxWidth: 200,
        resizable: true,
        editable: false, // Make supplier non-editable
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          // Ensure consistent styling with Part column
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff'
            };
          }
          return null;
        }
      },
      {
        headerName: 'Color',
        field: 'color',
        filter: 'agTextColumnFilter',
        width: 140,
        minWidth: 120,
        maxWidth: 180,
        resizable: true,
        editable: false, // Make color non-editable
        cellRenderer: (params: any) => {
          return params.value || '';
        }
      },
      {
        headerName: 'Feature',
        field: 'feature',
        filter: 'agTextColumnFilter',
        width: 180,
        minWidth: 160,
        maxWidth: 220,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow, // Make feature editable for new rows
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          const features = this.getUniqueFeatures();
          console.log('Available features for dropdown:', features);
          return {
            values: features
          };
        },
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff'
            };
          }
          return null;
        }
      },
      {
        headerName: 'Start Date',
        field: 'startDate',
        filter: 'agDateColumnFilter',
        width: 150,
        minWidth: 130,
        maxWidth: 170,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: true, // Make start date editable for all rows
        cellEditor: 'agDateCellEditor',
        valueFormatter: this.dateFormatter.bind(this),
        cellRenderer: (params: any) => {
          return this.dateFormatter(params);
        },
        cellStyle: (params: any) => {
          const baseStyle = {
            borderRight: '1px solid #e2e8f0',
            padding: '6px 10px',
            fontSize: '12px'
          };
          
          // Add new row styling
          if (params.data && params.data.isNewRow) {
            return {
              ...baseStyle,
              border: '1px solid #007bff',
              fontStyle: 'italic'
            };
          }
          
          // Add edited row styling
          if (this.editedRows.has(params.data.part.toString())) {
            return {
              ...baseStyle,
              backgroundColor: '#f8fafc',
              fontWeight: '500'
            };
          }
          
          return baseStyle;
        },
        filterParams: {
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          }
        }
      },
      {
        headerName: 'End Date',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        width: 150,
        minWidth: 130,
        maxWidth: 170,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: false, // Make end date non-editable
        valueFormatter: this.dateFormatter.bind(this),
        cellRenderer: (params: any) => {
          return this.dateFormatter(params);
        },
        filterParams: {
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          }
        }
      },
      {
        headerName: 'Qty',
        field: 'qty',
        headerClass: 'qty-header',
        filter: 'agNumberColumnFilter',
        width: 100,
        minWidth: 80,
        maxWidth: 120,
        type: 'numericColumn',
        cellStyle: (params: any) => {
          const baseStyle = {
            textAlign: 'right',
            borderRight: '1px solid #e2e8f0',
            fontWeight: '500',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            padding: '6px 10px',
            fontSize: '12px'
          };
          
          // Add new row styling
          if (params.data.isNewRow) {
            return {
              ...baseStyle,
              border: '1px solid #007bff'
              // Removed fontStyle: 'italic' for normal text appearance
            };
          }
          
          // Add expired row styling - make it look disabled
          if (params.data && params.data.isExpired) {
            return {
              ...baseStyle,
              backgroundColor: '#f9fafb',
              color: '#9ca3af',
              fontWeight: '400',
              cursor: 'not-allowed'
            };
          }
          
          // Add edited row styling
          if (this.editedRows.has(params.data.part.toString())) {
            return {
              ...baseStyle,
              backgroundColor: '#f8fafc',
              fontWeight: '500'
            };
          }
          
          return baseStyle;
        },
        resizable: true,
        editable: (params) => {
          // Don't allow editing expired rows
          if (params.data && params.data.isExpired) {
            return false;
          }
          return true; // Allow editing for all other rows (existing and new rows)
        },
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 9999
        },
        valueFormatter: (params: any) => {
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          return params.value.toString();
        },
        cellRenderer: (params: any) => {
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          return `<span style="display: inline-block; width: 100%; text-align: right; font-weight: 500;">${params.value}</span>`;
        },
        filterParams: {
          filterOptions: ['equals', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'inRange']
        }
      }
    ];

    // Add dynamic SKU columns
    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => ({
      headerName: `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`,
      field: sku.fieldName,
      filter: 'agTextColumnFilter',
      width: 200,
      minWidth: 200,
      maxWidth: 200,
      resizable: true,
      suppressSizeToFit: true,
      suppressAutoSize: true,
      headerClass: index === 0 ? 'first-sku-column-header' : '',
      cellClass: index === 0 ? 'first-sku-column-cell' : '',

      cellStyle: (params: any) => {
        // First SKU column styling
        if (index === 0) {
          // Check if this SKU value matches the Part value in the same row
          if (params.data && params.value && params.data.part) {
            if (String(params.value) === String(params.data.part)) {
              return {
                color: '#d32f2f', // Red text for matching values
                fontWeight: '600',
                backgroundColor: '#fff9c4', // Yellow background for first SKU column
                textAlign: 'left',
                padding: '0 8px'
              };
            }
          }
          
          // Non-matching or empty values get yellow background too
          return {
            color: '#374151', // Default gray text
            fontWeight: '400',
            backgroundColor: '#fff9c4', // Yellow background for first SKU column
            textAlign: 'left',
            padding: '0 8px'
          };
        }
        
        // Other SKU columns keep original styling
        if (params.value) {
          return { 
            backgroundColor: '#f0f9ff', 
            fontWeight: 'bold', 
            color: '#000000',
            textAlign: 'left',
            padding: '0 8px'
          };
        } else {
          return { 
            backgroundColor: '#f9fafb', 
            color: '#9ca3af', 
            fontWeight: 'normal',
            textAlign: 'left',
            padding: '0 8px'
          };
        }
      },
      cellRenderer: (params: any) => params.value || ''
    }));

    return [...baseColumns, ...dynamicSkuColumns];
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
    return col.field && col.field.startsWith('sku');
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
    console.log('Toggle expired data clicked, current state:', this.showExpiredData);
    
    // Save state to localStorage
    localStorage.setItem('showExpiredData', this.showExpiredData.toString());
    
    // Reload data with or without expired entries
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      // Toggle single column
      const visible = (event.target as HTMLInputElement).checked;
      this.gridApi.setColumnsVisible([col.field], visible);
      
      // Update the column definition to reflect the change
      const columnDef = this.columnDefs.find(c => c.field === col.field);
      if (columnDef) {
        columnDef.hide = !visible;
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
      if (this.clickableParts.has(event.value)) {
        this.openPartModal(event.value);
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
    const partId = params.data.part.toString();
    const fieldName = params.colDef.field;
    
    // Mark row as edited
    this.editedRows.add(partId);
    
    // Refresh the row to apply styling
    this.gridApi.refreshCells({
      rowNodes: [params.node],
      force: true
    });
    
    console.log(`${fieldName} changed for part ${partId}: ${params.oldValue} -> ${params.newValue}`);
  }

  saveChanges(): void {
    if (this.editedRows.size === 0) {
      this.showSaveMessage('No changes to save', 'info');
      return;
    }
    
    // Capture the number of changes before clearing
    const changesCount = this.editedRows.size;
    const changedParts = Array.from(this.editedRows);
    
    // Here you would typically send the changes to your API
    console.log('Saving changes for parts:', changedParts);
    
    // Show saving message
    this.showSaveMessage(`Saving ${changesCount} changes...`, 'info');
    
    // Simulate API call delay
    setTimeout(() => {
      // Clear the edited state
      this.editedRows.clear();
      
      // Refresh all rows to remove highlighting
      this.gridApi.refreshCells({
        force: true
      });
      
      // Update last saved timestamp
      this.lastSavedAt = new Date();
      
      // Save timestamp to localStorage for persistence
      localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
      
      // Show success message with correct count
      this.showSaveMessage(`Successfully saved ${changesCount} changes!`, 'success');
      
      console.log('Changes saved successfully!');
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
    console.log('Available features:', result);
    return result;
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
    console.log('Available part numbers:', result);
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
    console.log('=== onNewRowValueChanged called ===');
    console.log('Field:', params.field);
    console.log('New value:', params.newValue);
    
    // If part number is changed, populate the feature from existing data
    if (params.field === 'part' && params.newValue) {
      console.log('Part field changed to:', params.newValue);
      
      // Get the original mock data from the data service
      const mockData = this.dataService.getMockData();
      console.log('Mock data available:', !!mockData);
      console.log('Mock data object:', mockData);
      
      if (mockData && mockData.mbom) {
        console.log('Mock data mbom length:', mockData.mbom.length);
        console.log('First few parts in mock data:', mockData.mbom.slice(0, 3).map(p => ({ part: p.part, feature: p.feature })));
        
        // Search in the original mock data
        const existingPart = mockData.mbom.find(part => 
          part.part === params.newValue
        );
        
        if (existingPart) {
          console.log('Found existing part in mock data:', existingPart);
          console.log('Auto-populating feature:', existingPart.feature);
          
          // Update the feature field in the grid
          params.node.setDataValue('feature', existingPart.feature);
          
          // Also update the data object directly
          if (params.node.data) {
            params.node.data.feature = existingPart.feature;
            console.log('Updated node data feature:', params.node.data.feature);
          }
          
          // Refresh the row to show the updated feature
          setTimeout(() => {
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              force: true
            });
            console.log('Refreshed cells to show feature value');
          }, 100);
          
          console.log('Auto-populated feature for part', params.newValue, ':', existingPart.feature);
        } else {
          console.log('No existing part found in mock data for:', params.newValue);
          console.log('Available parts in mock data:', mockData.mbom.slice(0, 5).map(p => p.part));
        }
      } else {
        console.log('Mock data not available');
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
    
    // Log current state for debugging
    console.log('=== QUICK FILTER DEBUG ===');
    console.log('Search text:', this.searchText);
    console.log('Grid API exists:', !!this.gridApi);
    console.log('Row count before filter:', this.gridApi.getDisplayedRowCount());
    
    // Apply AG Grid's quick filter using the correct method for v34
    this.gridApi.setGridOption('quickFilterText', this.searchText);
    
    // Log results after filter
    setTimeout(() => {
      console.log('Row count after filter:', this.gridApi.getDisplayedRowCount());
      console.log('Current quick filter:', this.gridApi.getGridOption('quickFilterText'));
      
      // Check if any rows are displayed and log their data
      const displayedRows: any[] = [];
      this.gridApi.forEachNodeAfterFilterAndSort((node) => {
        if (displayedRows.length < 3) { // Log first 3 rows
          displayedRows.push({
            part: node.data?.part,
            color: node.data?.color,
            supplier: node.data?.supplier
          });
        }
      });
      console.log('Displayed rows after filter:', displayedRows);
      
      // Also check total row data in grid
      console.log('Total rows in grid:', this.rowData.length);
      console.log('Sample row from rowData:', this.rowData[0]);
    }, 100);
    
    // Log for debugging
    if (this.searchText) {
      console.log('Applied quick filter:', this.searchText);
    } else {
      console.log('Cleared quick filter');
    }
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