import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GridApi, GridOptions, ColDef } from 'ag-grid-community';
import { AgGridAngular } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/data.service';
import { ColumnService } from '../services/column.service';
import { GridCommonService } from '../services/grid-common.service';
import { RowManagementService } from '../services/row-management.service';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';
import { PartModalComponent } from '../part-modal/part-modal.component';

@Component({
  selector: 'app-sbom',
  templateUrl: './sbom.component.html',
  styleUrls: ['./sbom.component.css'],
  imports: [CommonModule, FormsModule, AgGridAngular, PartModalComponent],
  standalone: true,
})
export class SbomComponent implements OnInit {
  // Grid configuration
  public gridOptions: GridOptions = {} as GridOptions;
  public defaultColDef: any;
  public columnDefs: ColDef[] = [];
  public skuColumns: any[] = []; // Dynamic SKU columns

  // Data
  public rowData: any[] = [];
  public totalRows = 1000;

  // Grid API
  public gridApi!: GridApi;

  // State management
  public showExpiredData = false;
  public searchText = '';
  public saveMessage: string = '';
  public saveMessageType: string = '';
  public lastSavedAt: Date | null = null;
  public clickableParts = new Set<number>();
  public editedRows = new Set<number>();
  public newRows = new Map<number, any>();
  public nextRowId = 10000;

  // Copy/Paste state for SKU columns in new rows
  public copiedSkuValue: string = '';
  public copiedFromRowId: number | null = null;
  public copiedFromCellKey: string = '';
  public copiedCellIndicator: string = '';

  // Modal state
  public showPartModal = false;
  public selectedPartData: any = {};
  public selectedPartSkuData: any[] = [];

  // Column visibility
  public allColumns = [
    // Core Part Information
    { field: 'actions', headerName: '', hide: false, isVirtual: false },
    { field: 'SpecSheet', headerName: 'Include In Spec Sheet', hide: false, isVirtual: false },
    { field: 'SpecSheetExtra', headerName: 'SpecSheet Extra', hide: false, isVirtual: false },
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

  // Search debounce timer
  private searchTextDebounceTimer: any;

  constructor(
    private router: Router,
    public dataService: DataService,
    private columnService: ColumnService,
    private gridCommonService: GridCommonService,
    private rowManagementService: RowManagementService
  ) {
    // Set the data service in grid context immediately
    this.gridOptions.context = {
      dataService: this.dataService,
    };

    // Load expired data state from localStorage (separate from MBOM)
    const savedState = localStorage.getItem('sbom_showExpiredData');
    this.showExpiredData = savedState === 'true';

    // Load last saved timestamp from localStorage (separate from MBOM)
    const savedTimestamp = localStorage.getItem('sbom_lastSavedAt');
    if (savedTimestamp) {
      this.lastSavedAt = new Date(savedTimestamp);
    }

    this.defaultColDef = this.columnService.getDefaultColDef(this);
    this.gridOptions = this.gridCommonService.getCommonGridOptions(this);
    this.loadData();
  }

  ngOnInit(): void {}

  loadData(): void {
    this.dataService.loadData().subscribe((data) => {
      // Get modify timestamp from API response
      const bomPartInfo = this.dataService.getBomPartInfo();
      if (bomPartInfo?.modifyTimestamp) {
        // Parse timestamp from API (format: "2025-10-29 11:52:20.0")
        this.lastSavedAt = new Date(bomPartInfo.modifyTimestamp);
        // Save to localStorage for persistence (separate from MBOM)
        localStorage.setItem('sbom_lastSavedAt', this.lastSavedAt.toISOString());
      }

      // Transform mock data to grid format - use only the base data (176 entries)
      // Pass isSbom=true to include SBOM-specific fields
      let baseData = this.dataService.transformToGridData(data.mbom, true);

      // Always generate expired entries to get the count
      const expiredEntries = this.gridCommonService.generateExpiredEntries(this.dataService, true);
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
    // Pass includeSbomColumns=true to include SBOM-specific columns
    const baseColumns = this.columnService.buildDynamicColumnDefinitions(
      this.dataService,
      this,
      true
    );

    // Add SKU columns (same as in app.ts)
    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => ({
      headerName: `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`,
      field: sku.fieldName,
      filter: false, // Filters disabled
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

  // Grid event handlers
  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.gridCommonService.sizeColumnsToFit(this.gridApi);
    this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);
  }

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

  // Row management methods
  addRowAfter(rowIndex: number): void {
    const result = this.rowManagementService.addRowAfter(
      rowIndex,
      this.rowData,
      this.gridApi,
      this.dataService,
      this.nextRowId,
      true
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

  // Utility methods
  getUniqueFeatures(): string[] {
    return this.gridCommonService.getUniqueFeatures(this.rowData);
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

  async searchPartNumbers(searchTerm: string): Promise<string[]> {
    return this.gridCommonService.searchPartNumbers(searchTerm, this.rowData);
  }

  onNewRowValueChanged(params: any): void {
    this.rowManagementService.onNewRowValueChanged(params, this.dataService, this.editedRows);
  }

  formatLastSavedTime(date: Date): string {
    return this.gridCommonService.formatLastSavedTime(date);
  }

  formatDate(params: any): string {
    return this.gridCommonService.dateFormatter(params);
  }

  // Search functionality
  onSearchTextChange(): void {
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    this.searchTextDebounceTimer = setTimeout(() => {
      this.gridCommonService.applyQuickFilter(this.gridApi, this.searchText);
    }, 300);
  }

  clearSearch(): void {
    this.searchText = '';
    this.gridCommonService.clearSearch(this.gridApi, this);
  }

  // Change tracking and save methods
  trackFieldChange(params: any): void {
    this.rowManagementService.trackFieldChange(params, this.editedRows);
  }

  saveChanges(): void {
    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        if (result.success) {
          this.lastSavedAt = new Date();
          localStorage.setItem('sbom_lastSavedAt', this.lastSavedAt.toISOString());
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

  // Copy/Paste methods
  copySkuValue(params: any): void {
    this.rowManagementService.copySkuValue(params, this);
  }

  pasteSkuValue(params: any): void {
    this.rowManagementService.pasteSkuValue(params, this);
  }

  clearCopyState(): void {
    this.rowManagementService.clearCopyState(this.gridApi, this);
  }

  // Modal methods
  openPartModal(partId: string): void {
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

  // Column visibility methods
  get allColumnsForPanel() {
    return this.allColumns;
  }

  get realColumnsForGrid() {
    return this.allColumns.filter((col) => !col.isVirtual);
  }

  get selectAllState() {
    const visibleColumns = this.allColumns.filter((col) => !col.isVirtual && !col.hide);
    const totalColumns = this.allColumns.filter((col) => !col.isVirtual);

    if (visibleColumns.length === 0) return false;
    if (visibleColumns.length === totalColumns.length) return true;
    return null;
  }

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

  // Additional methods needed for the HTML template
  applyQuickFilter(): void {
    this.gridCommonService.applyQuickFilter(this.gridApi, this.searchText);
  }

  toggleExpiredData(): void {
    // The ngModel should have already updated showExpiredData
    // Save state to localStorage
    localStorage.setItem('sbom_showExpiredData', this.showExpiredData.toString());

    // Reload data with or without expired entries
    this.loadData();
  }

  public expiredDataCount = 0;

  showColumnVisibilityPanel = false;

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

  isSkuColumn(col: any): boolean {
    // Check if the column is a SKU column by examining the field name
    return col.field && (col.field.startsWith('sku') || col.field.startsWith('actions'));
  }

  // Navigation
  goToMainApp(): void {
    this.router.navigate(['/']);
  }
}
