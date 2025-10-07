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

  ngOnInit(): void {}

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

    // Build column definitions using the column service
    this.columnDefs = this.columnService.buildColumnDefinitions(skuColumns, this.dataService, this);
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
