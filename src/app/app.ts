import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { DataService } from './services/data.service';
import { ColumnService } from './services/column.service';
import { GridCommonService } from './services/grid-common.service';
import { RowManagementService } from './services/row-management.service';
import { SessionService } from './services/session.service';
import { ModalService } from './services/modal.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
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
  public clickableParts = new Set<number>();
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
    // { field: 'SpecSheetExtra', headerName: 'SpecSheet Extra', hide: true, isVirtual: true },
    { field: 'part', headerName: 'Part Number', hide: false, isVirtual: false },
    { field: 'type', headerName: 'Type', hide: true, isVirtual: true },
    {
      field: 'manufacturerPartNumber',
      headerName: 'Manufacturer Part Number',
      hide: true,
      isVirtual: true,
    },
    
    // Descriptions
    { field: 'shortDesc', headerName: 'Short Description', hide: false, isVirtual: false },
    { field: 'longDesc', headerName: 'Long Description', hide: false, isVirtual: false },
    { field: 'serviceDescription', headerName: 'Service Description', hide: true, isVirtual: true },
    
    // Features and Specifications
    { field: 'feature', headerName: 'BOM Feature', hide: false, isVirtual: false },
    
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
    { field: 'endDate', headerName: 'End Date', hide: false, isVirtual: false },
  ];
  // Grid configuration - client-side
  public gridOptions: GridOptions = {} as GridOptions;

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];
  public skuColumns: any[] = []; // Dynamic SKU columns

  public rowData: any[] = [];
  public totalRows = 1000;

  constructor(
    public router: Router, 
    public dataService: DataService, 
    private columnService: ColumnService,
    private gridCommonService: GridCommonService,
    private rowManagementService: RowManagementService,
    private sessionService: SessionService,
    private modalService: ModalService,
    private viewContainerRef: ViewContainerRef
  ) {
    // Set the data service in grid context immediately
    this.gridOptions.context = {
      dataService: this.dataService,
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
    this.gridOptions = this.gridCommonService.getCommonGridOptions(this);

    // Initialize authentication check
    this.checkAuthentication();
  }

  ngOnInit(): void {
    // Make accordion function available globally
    (window as any).toggleAccordion = (branchId: string) => {
      this.toggleAccordion(branchId);
    };
  }

  // Accordion toggle method
  public toggleAccordion(branchId: string): void {
    if (!this.gridApi) return;

    const allRowData = this.rowData;
    const parentRow = allRowData.find((row: any) => row.branchID === branchId);

    if (!parentRow || !parentRow.isParent || !parentRow.hasChildren) return;

    parentRow.isExpanded = !parentRow.isExpanded;

    if (parentRow.isExpanded) {
      // Show children
      this.showChildren(parentRow, allRowData);
    } else {
      // Hide children
      this.hideChildren(parentRow, allRowData);
    }
  }

  private showChildren(parentRow: any, allRowData: any[]): void {
    const parentIndex = allRowData.findIndex((row: any) => row.branchID === parentRow.branchID);

    if (parentIndex === -1) return;

    // Insert children after parent
    const newRowData = [...allRowData];
    parentRow.children.forEach((child: any, index: number) => {
      child.isSubRow = true;
      child.isVisible = true;
      newRowData.splice(parentIndex + 1 + index, 0, child);
    });

    this.rowData = newRowData;
    this.gridApi.setGridOption('rowData', newRowData);
  }

  private hideChildren(parentRow: any, allRowData: any[]): void {
    const newRowData = allRowData.filter((row: any) => {
      if (row.isSubRow && row.parent && row.parent.branchID === parentRow.branchID) {
        row.isVisible = false;
        return false; // Remove from display
      }
      return true;
    });

    this.rowData = newRowData;
    this.gridApi.setGridOption('rowData', newRowData);
  }

  private checkAuthentication(): void {
    if (!environment.enableHttpBasicAuth) {
      // Authentication disabled - load data directly
      this.loadData();
      return;
    }

    // Try to authenticate with existing credentials first
    this.sessionService.initSession().subscribe({
      next: (user) => {
        // Only load data if user is properly authenticated
        if (user) {
          console.log('CSRF API succeeded - user authenticated');
    this.loadData();
        } else {
          console.log('CSRF API succeeded but no valid user - showing modal');
          this.promptForCredentials();
        }
      },
      error: (error) => {
        // CSRF API failed - show modal, NO DATA LOADING
        console.log('CSRF API failed - showing modal, no data loaded', error);
        setTimeout(() => {
          this.promptForCredentials();
        }, 100);
      },
    });
  }

  private async promptForCredentials(): Promise<void> {
    try {
      const credentials = await this.modalService.showSignInModal(this.viewContainerRef);

      if (!credentials) {
        alert('Authentication is required to access this application.');
        return; // Don't reopen modal
      }

      // Validate credentials for mock API
      if (environment.useMockApi) {
        const expectedUsername = environment.credentials.username;
        const expectedPassword = environment.credentials.password;

        if (
          credentials.username !== expectedUsername ||
          credentials.password !== expectedPassword
        ) {
          alert('Invalid credentials. Please try again.');
          this.promptForCredentials(); // Show modal again
          return;
        }
      }

      // Update environment credentials
      environment.credentials.username = credentials.username;
      environment.credentials.password = credentials.password;

      // Try to authenticate - the API call will happen regardless
      this.sessionService.initSession().subscribe({
        next: (user) => {
          if (user && user.name && user.id) {
            this.loadData();
          } else {
            // Authentication failed - show modal again
            alert('Authentication failed. Please check your credentials.');
            this.promptForCredentials(); // Show modal again
          }
        },
        error: (error) => {
          // CSRF API failed after user entered credentials - NO DATA LOADING
          console.log('CSRF API failed after credentials - no data loaded', error);
          alert('Authentication failed. Please check your credentials and try again.');
          this.promptForCredentials(); // Show modal again
        },
      });
    } catch (error) {
      console.error('Error showing sign-in modal:', error);
    }
  }

  loadData(): void {
    this.dataService.loadData().subscribe((data) => {
      // Transform mock data to grid format - use only the base data (176 entries)
      let baseData = this.dataService.transformToGridData(data.mbom);
      
      // Always generate expired entries to get the count
      const expiredEntries = this.gridCommonService.generateExpiredEntries(this.dataService);
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
        this.clickableParts = this.gridCommonService.initializeClickableParts(this.rowData);
    });
  }

  initializeColumns(): void {
    // Get SKU columns from data service
    const skuColumns = this.dataService.getSkuInfo().map((sku) => ({
      skuId: sku.sku,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size,
      fieldName: `sku${sku.sku}`,
      hasData: true,
    }));

    // Build dynamic column definitions based on backend column mapping
    const baseColumns = this.columnService.buildDynamicColumnDefinitions(this.dataService, this);

    // Add SKU columns
    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => ({
      headerName: `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`,
      field: sku.fieldName,
      filter: 'agTextColumnFilter',
      width: 200,
      minWidth: 200,
      maxWidth: 350,
      resizable: true,
      suppressSizeToFit: true,
      suppressAutoSize: true,
      headerClass: index === 0 ? 'first-sku-column-header' : '',
      cellClass: index === 0 ? 'first-sku-column-cell' : '',
      cellStyle: (params: any) => {
        const cellKey = `${params.node.rowIndex}-${params.colDef.field}`;
        const isCopiedCell = this.copiedFromCellKey === cellKey;
        const isNewRow = params.data && params.data.isNewRow;

        const baseStyle = {
          textAlign: 'left',
          padding: '0 8px',
          cursor: isNewRow && params.value ? 'copy' : 'default',
        };

        if (index === 0) {
          if (
            params.data &&
            params.value &&
            params.data.part &&
            String(params.value) === String(params.data.part)
          ) {
            return {
              ...baseStyle,
              color: '#d32f2f',
              fontWeight: '600',
              backgroundColor: isCopiedCell ? '#e8f5e9' : '#fff9c4',
              border: isCopiedCell ? '2px solid #4caf50' : 'none',
            };
          }
          return {
            ...baseStyle,
            color: '#374151',
            fontWeight: '400',
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#fff9c4',
            border: isCopiedCell ? '2px solid #4caf50' : 'none',
          };
        }

        if (params.value) {
          return {
            ...baseStyle,
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#f0f9ff',
            fontWeight: 'bold',
            color: '#000000',
            border: isCopiedCell ? '2px solid #4caf50' : isNewRow ? '1px solid #e2e8f0' : 'none',
          };
        } else {
          return {
            ...baseStyle,
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#f9fafb',
            color: '#9ca3af',
            fontWeight: 'normal',
            border: isCopiedCell ? '2px solid #4caf50' : isNewRow ? '1px solid #e2e8f0' : 'none',
          };
        }
      },
      cellRenderer: (params: any) => {
        const cellKey = `${params.node.rowIndex}-${params.colDef.field}`;
        const isCopiedCell = this.copiedFromCellKey === cellKey;

        if (!params.data.isNewRow) {
          return params.value || '';
        }

        const buttonStyles = `
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 4px;
          padding: 2px 6px;
          margin-left: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          font-size: 12px;
          line-height: 1;
        `;

        if (!params.value) {
          const canPaste =
            this.copiedSkuValue !== '' &&
            this.copiedFromRowId !== null &&
            params.data.newRowId === this.copiedFromRowId;
          const pasteButton = canPaste
            ? `
            <div class="paste-button" 
              data-action="paste"
              style="
                ${buttonStyles}
                background: #f0fdf4;
                border: 1px solid #86efac;
                color: #16a34a;
                display: inline-flex;
                gap: 6px;
                align-items: center;
                min-width: 120px;
                height: 24px;
                white-space: nowrap;
                overflow: visible;
                position: relative;
                pointer-events: all;
                z-index: 999;
                cursor: pointer;
                user-select: none;
              "
              title="Click to paste '${this.copiedSkuValue}' or press Ctrl+V"
            >
              <div style="display: flex; align-items: center; gap: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                <span style="font-weight: 500;">Paste</span>
              </div>
              <div style="
                background: #dcfce7;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                border: 1px solid #86efac;
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.2;
              " title="${this.copiedSkuValue}">
                ${this.copiedSkuValue}
              </div>
            </button>
          `
            : '';

          return `
            <div class="sku-cell" style="
              display: flex;
              align-items: center;
              min-height: 28px;
              padding: 2px;
              ${
                canPaste
                  ? `
                background: #f0fdf4;
                border: 1px dashed #86efac;
                position: relative;
              `
                  : ''
              }
            ">
              ${
                canPaste
                  ? `
                <div style="
                  position: absolute;
                  top: -6px;
                  left: 8px;
                  background: #dcfce7;
                  padding: 0 6px;
                  border-radius: 3px;
                  font-size: 10px;
                  color: #16a34a;
                  border: 1px solid #86efac;
                  opacity: 0;
                  transition: opacity 0.2s;
                  line-height: 14px;
                  z-index: 1;
                ">Can paste here</div>
              `
                  : ''
              }
              <div style="flex: 1; display: flex; justify-content: flex-end;">
                ${pasteButton}
              </div>
              <style>
                .sku-cell {
                  transition: all 0.2s ease;
                }
                .sku-cell:hover .paste-button {
                  opacity: 1 !important;
                }
                .sku-cell:hover > div > div:first-child {
                  opacity: 1 !important;
                }
                .paste-button:hover {
                  background: #dcfce7 !important;
                  border-color: #4ade80 !important;
                }
                .paste-button:active {
                  background: #bbf7d0 !important;
                  transform: scale(0.98);
                }
              </style>
            </div>
          `;
        }

        const copyButton = `
          <button class="copy-button" 
            style="
              ${buttonStyles}
              background: #f0f9ff;
              border: 1px solid #e2e8f0;
              color: #3b82f6;
            "
            title="Copy SKU value"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span style="margin-left: 4px;">Copy</span>
          </button>
        `;

        const checkmark = isCopiedCell
          ? '<span style="color: #4caf50; margin-left: 4px; display: flex; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>'
          : '';

        return `
          <div class="sku-cell" style="display: flex; align-items: center; position: relative;">
            <span style="flex: 1;">${params.value}</span>
            ${isCopiedCell ? checkmark : copyButton}
            <style>
              .sku-cell:hover .copy-button {
                opacity: 1 !important;
              }
              .copy-button:hover {
                background: #e0f2fe !important;
                border-color: #93c5fd !important;
              }
              .copy-button:active {
                background: #bfdbfe !important;
                transform: scale(0.98);
              }
            </style>
          </div>
        `;
      },
      editable: false,
    }));

    // Combine base columns with SKU columns
    this.columnDefs = [...baseColumns, ...dynamicSkuColumns];
  }

  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.gridCommonService.sizeColumnsToFit(this.gridApi);
    // Add Firefox compatibility
    this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);
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
    const clickedOutside =
      panel &&
      !panel.contains(target) &&
      toggleBtn &&
      !toggleBtn.contains(target) &&
      toggleContainer &&
      !toggleContainer.contains(target);
    
    if (clickedOutside) {
      this.showColumnVisibilityPanel = false;
      document.removeEventListener('click', this.handleClickOutside, true);
      // Force change detection since we're outside Angular zone
      setTimeout(() => {
        // This ensures Angular detects the change
      }, 0);
    }
  };

  onCellClicked(event: any): void {
    const target = event.event?.target as HTMLElement;

    // Handle paste button click first
    const pasteButton = target?.closest('[data-action="paste"]');
    if (pasteButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow
      ) {
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
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow &&
        event.value
      ) {
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
        keyPress: event.event?.key,
      });
      return;
    }
    
    if (event.colDef.field === 'actions') {
      const target = event.event?.target as HTMLElement;
      
      if (target && target.classList.contains('add-row-btn')) {
        // Use the row index instead of partId for reliable positioning
        const rowIndex = event.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          this.addRowAfter(rowIndex);
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
      if (
        this.clickableParts.has(event.value?.toString()) ||
        this.clickableParts.has(parseInt(event.value?.toString()))
      ) {
        this.openPartModal(event.value?.toString());
      }
    }
  }

  openPartModal(partId: string): void {
    // Find the part data from the current row data
    const partData = this.rowData.find((row) => row.part.toString() === partId);
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
    this.rowManagementService.trackFieldChange(params, this.editedRows);
  }

  saveChanges(): void {
    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        if (result.success) {
          // Update last saved timestamp
          this.lastSavedAt = new Date();
          
          // Save timestamp to localStorage for persistence
          localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
          
          // Clear new rows tracking
          this.newRows.clear();
          
          this.rowManagementService.showSaveMessage(result.message, 'success', this);
        } else {
          this.rowManagementService.showSaveMessage(result.message, 'info', this);
        }
      });
  }
  
  showSaveMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.rowManagementService.showSaveMessage(message, type, this);
  }
  
  clearSaveMessage(): void {
    this.rowManagementService.clearSaveMessage(this);
  }

  // Copy SKU value from a cell (only for new rows)
  copySkuValue(params: any): void {
    this.rowManagementService.copySkuValue(params, this);
  }

  pasteSkuValue(params: any): void {
    this.rowManagementService.pasteSkuValue(params, this);
  }

  // Clear copy state and visual indicators
  clearCopyState(): void {
    this.rowManagementService.clearCopyState(this.gridApi, this);
  }

  addRowAfter(rowIndex: number): void {
    const result = this.rowManagementService.addRowAfter(
      rowIndex,
      this.rowData,
      this.gridApi,
      this.dataService,
      this.nextRowId
    );
    this.nextRowId = result.newRowId;
    this.newRows.set(result.newRow.newRowId, result.newRow);
  }

  deleteRowById(newRowId: number): void {
    this.rowManagementService.deleteRowById(newRowId, this.rowData, this.gridApi);
    this.newRows.delete(newRowId);
  }

  deleteRow(partId: string): void {
    this.rowManagementService.deleteRow(partId, this.rowData, this.gridApi);
    this.newRows.delete(parseInt(partId));
  }

  getUniqueFeatures(): string[] {
    return this.gridCommonService.getUniqueFeatures(this.rowData);
  }

  // Get all columns for the visibility panel (real + virtual)
  get allColumnsForPanel() {
    return this.allColumns;
  }

  // Get only real columns for AG Grid (filter out virtual ones)
  get realColumnsForGrid() {
    return this.allColumns.filter((col) => !col.isVirtual);
  }

  // Get select all state
  get selectAllState() {
    const visibleColumns = this.allColumns.filter((col) => !col.isVirtual && !col.hide);
    const totalColumns = this.allColumns.filter((col) => !col.isVirtual);
    
    if (visibleColumns.length === 0) return false;
    if (visibleColumns.length === totalColumns.length) return true;
    return null; // indeterminate state
  }

  // Toggle select all
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    
    this.allColumns.forEach((col) => {
      if (!col.isVirtual) {
        col.hide = !checked;
        if (this.gridApi) {
          this.gridApi.setColumnsVisible([col.field], checked);
        }
      }
    });
  }

  getAvailablePartNumbers(): string[] {
    return this.gridCommonService.getAvailablePartNumbers(this.rowData);
  }

  getUniqueSuppliers(): string[] {
    return this.gridCommonService.getUniqueSuppliers(this.rowData);
  }

  getUniqueColors(): string[] {
    return this.gridCommonService.getUniqueColors(this.rowData);
  }

  // Method for future API integration
  async searchPartNumbers(searchTerm: string): Promise<string[]> {
    return this.gridCommonService.searchPartNumbers(searchTerm, this.rowData);
  }

  onNewRowValueChanged(params: any): void {
    this.rowManagementService.onNewRowValueChanged(params, this.dataService, this.editedRows);
  }

  formatLastSavedTime(date: Date): string {
    return this.gridCommonService.formatLastSavedTime(date);
  }

  // Date formatter utility method for use in column definitions
  formatDate(params: any): string {
    return this.gridCommonService.dateFormatter(params);
  }

  // Search functionality methods
  onSearchTextChange(): void {
    // Auto-apply filter as user types (debounced)
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
    
    this.searchTextDebounceTimer = setTimeout(() => {
      this.gridCommonService.applyQuickFilter(this.gridApi, this.searchText);
    }, 300); // 300ms debounce
  }

  private searchTextDebounceTimer: any;

  applyQuickFilter(): void {
    this.gridCommonService.applyQuickFilter(this.gridApi, this.searchText);
  }

  clearSearch(): void {
    this.gridCommonService.clearSearch(this.gridApi, this);
  }

  // Navigation
  goToSbom(): void {
    this.router.navigate(['/sbom']);
  }
}
