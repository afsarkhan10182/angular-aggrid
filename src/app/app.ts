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
    // Make accordion functions available globally
    (window as any).toggleSection = (section: string) => {
      this.toggleSection(section);
    };
    (window as any).toggleMaterial = (section: string, material: string) => {
      this.toggleMaterial(section, material);
    };
    (window as any).toggleBranch = (branchId: string) => {
      this.toggleBranch(branchId);
    };
  }

  // Toggle section expansion
  public toggleSection(section: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    sectionRow.isExpanded = !sectionRow.isExpanded;

    // Update the grid with the new data
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.gridApi.setGridOption('rowData', flatData);
  }

  // Toggle material expansion
  public toggleMaterial(section: string, material: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    const materialRow = sectionRow.children.find(
      (child: any) => child.material === material && child.isMaterialHeader
    );
    if (!materialRow) return;

    materialRow.isExpanded = !materialRow.isExpanded;

    // Update the grid with the new data
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.gridApi.setGridOption('rowData', flatData);
  }

  // Toggle branch expansion
  public toggleBranch(branchId: string): void {
    if (!this.gridApi) return;

    // Find the branch row in the hierarchical structure
    for (const sectionRow of this.rowData) {
      if (sectionRow.isSectionHeader) {
        for (const materialRow of sectionRow.children) {
          if (materialRow.isMaterialHeader) {
            const branchRow = materialRow.children.find(
              (child: any) => child.branchID === branchId && child.isBranchHeader
            );
            if (branchRow) {
              branchRow.isExpanded = !branchRow.isExpanded;

              // Update the grid with the new data
              const flatData = this.flattenHierarchicalData(this.rowData);
              this.gridApi.setGridOption('rowData', flatData);
              return;
            }
          }
        }
      }
    }
  }

  private updateGridData(): void {
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.gridApi.setGridOption('rowData', flatData);
  }

  private getInitialDisplayData(): any[] {
    // Only show section headers initially
    return this.rowData.filter((item) => item.isSectionHeader);
  }

  private flattenHierarchicalData(data: any[]): any[] {
    const result: any[] = [];

    data.forEach((item) => {
      result.push(item);

      if (item.isSectionHeader && item.isExpanded) {
        item.children.forEach((material: any) => {
          result.push(material);

          if (material.isMaterialHeader && material.isExpanded) {
            material.children.forEach((branch: any) => {
              result.push(branch);

              if (branch.isBranchHeader && branch.isExpanded) {
                branch.children.forEach((subItem: any) => {
                  result.push(subItem);
                });
              }
            });
          }
        });
      }
    });

    return result;
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
      // Transform data to hierarchical structure
      this.rowData = this.transformToHierarchicalData(data);

      // Initialize columns after data is loaded
      this.initializeColumns();

      // Set the initial flattened data to the grid (only section headers visible initially)
      const initialData = this.getInitialDisplayData();
      this.gridApi?.setGridOption('rowData', initialData);

      // Make only some parts clickable (random selection from first 20 rows)
      this.clickableParts = this.gridCommonService.initializeClickableParts(initialData);
    });
  }

  initializeColumns(): void {
    // Get column mapping from data service
    const columnMapping = this.dataService.getColumnMapping();

    // Create hierarchical columns based on response structure
    this.columnDefs = this.createHierarchicalColumns(columnMapping);
  }

  createHierarchicalColumns(columnMapping: any): ColDef[] {
    const columns: ColDef[] = [];

    // Add hierarchical structure column
    columns.push({
      headerName: 'Hierarchy',
      field: 'hierarchy',
      width: 300,
      minWidth: 200,
      cellRenderer: (params: any) => {
        return this.renderHierarchicalCell(params);
      },
      cellStyle: (params: any) => {
        return this.getHierarchicalCellStyle(params);
      },
    });

    // Add columns based on response column mapping
    Object.keys(columnMapping).forEach((field) => {
      const headerName = columnMapping[field];
      columns.push({
        headerName: headerName,
        field: field,
        width: 150,
        minWidth: 100,
        cellRenderer: (params: any) => {
          // Only show values for actual data rows, not headers
          if (
            params.data.isSectionHeader ||
            params.data.isMaterialHeader ||
            params.data.isBranchHeader
          ) {
            return '';
          }
          return params.value || '';
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
      });
    });

    // Add SKU columns
    const skuColumns = this.dataService.getSkuInfo().map((sku) => ({
      skuId: sku.sku,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size,
      fieldName: `sku${sku.sku}`,
      hasData: true,
    }));

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
      cellRenderer: (params: any) => {
        // Only show SKU values for actual data rows
        if (
          params.data.isSectionHeader ||
          params.data.isMaterialHeader ||
          params.data.isBranchHeader
        ) {
          return '';
        }
        return params.value || '';
      },
      cellStyle: (params: any) => {
        return this.getDataCellStyle(params);
      },
      editable: false,
    }));

    return [...columns, ...dynamicSkuColumns];
  }

  renderHierarchicalCell(params: any): string {
    const data = params.data;
    const level = data.level || 0;

    if (data.isSectionHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      return `
        <div style="
          display: flex; 
          align-items: center; 
          font-weight: 600; 
          color: #1e40af; 
          background: #f8fafc; 
          padding: 8px 12px; 
          border-radius: 4px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          border-left: 4px solid #3b82f6;
          margin: 2px 0;
        " 
             onclick="window.toggleSection('${data.section}')"
             onmouseover="this.style.background='#e0f2fe'; this.style.borderLeftColor='#1d4ed8'"
             onmouseout="this.style.background='#f8fafc'; this.style.borderLeftColor='#3b82f6'">
          <span style="
            margin-right: 8px; 
            font-size: 12px; 
            transition: transform 0.2s ease; 
            color: #1e40af;
            font-weight: 700;
            width: 16px;
            text-align: center;
          ">${arrowIcon}</span>
          <span style="font-size: 14px; font-weight: 600;">${data.section}</span>
        </div>
      `;
    }

    if (data.isMaterialHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      const materialIndent = '&nbsp;'.repeat(16); // Add indentation for materials
      return `
        <div style="
          display: flex; 
          align-items: center; 
          font-weight: 500; 
          color: #065f46; 
          background: #f0fdf4; 
          padding: 6px 10px; 
          border-radius: 3px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          border-left: 3px solid #10b981;
          margin: 1px 0;
        " 
             onclick="window.toggleMaterial('${data.section}', '${data.material}')"
             onmouseover="this.style.background='#dcfce7'; this.style.borderLeftColor='#059669'"
             onmouseout="this.style.background='#f0fdf4'; this.style.borderLeftColor='#10b981'">
          <span style="
            margin-right: 6px; 
            font-size: 11px; 
            transition: transform 0.2s ease; 
            color: #065f46;
            font-weight: 600;
            width: 14px;
            text-align: center;
          ">${arrowIcon}</span>
          <span style="font-size: 13px; font-weight: 500;">${materialIndent}${data.material}</span>
        </div>
      `;
    }

    if (data.isBranchHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      const branchIndent = '&nbsp;'.repeat(32); // Add more indentation for branches
      return `
        <div style="
          display: flex; 
          align-items: center; 
          font-weight: 400; 
          color: #92400e; 
          background: #fffbeb; 
          padding: 5px 8px; 
          border-radius: 3px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          border-left: 2px solid #f59e0b;
          margin: 1px 0;
        " 
             onclick="window.toggleBranch('${data.branchID}')"
             onmouseover="this.style.background='#fef3c7'; this.style.borderLeftColor='#d97706'"
             onmouseout="this.style.background='#fffbeb'; this.style.borderLeftColor='#f59e0b'">
          <span style="
            margin-right: 6px; 
            font-size: 10px; 
            transition: transform 0.2s ease; 
            color: #92400e;
            font-weight: 600;
            width: 12px;
            text-align: center;
          ">${arrowIcon}</span>
          <span style="font-size: 12px; font-weight: 400;">${branchIndent}Branch: ${data.branchID}</span>
        </div>
      `;
    }

    // Regular data row
    const dataIndent = '&nbsp;'.repeat(48); // Add maximum indentation for data rows
    return `
      <div style="
        display: flex; 
        align-items: center; 
        color: #6b7280; 
        padding: 4px 6px; 
        background: #f8fafc;
        border-radius: 2px;
        margin: 1px 0;
        border-left: 2px solid #cbd5e1;
        transition: all 0.2s ease;
      " 
           onmouseover="this.style.background='#f1f5f9'; this.style.borderLeftColor='#94a3b8'"
           onmouseout="this.style.background='#f8fafc'; this.style.borderLeftColor='#cbd5e1'">
        <span style="
          margin-right: 6px; 
          font-size: 10px; 
          color: #64748b;
          font-weight: 400;
        ">•</span>
        <span style="
          font-size: 12px; 
          color: #475569;
          font-weight: 400;
        ">${dataIndent}${data.part || data.material || 'Item'}</span>
      </div>
    `;
  }

  getHierarchicalCellStyle(params: any): any {
    const data = params.data;

    if (data.isSectionHeader) {
      return {
        backgroundColor: '#f3f4f6',
        borderLeft: '4px solid #3b82f6',
        fontWeight: 'bold',
      };
    }

    if (data.isMaterialHeader) {
      return {
        backgroundColor: '#e5e7eb',
        borderLeft: '4px solid #10b981',
        fontWeight: '600',
      };
    }

    if (data.isBranchHeader) {
      return {
        backgroundColor: '#f9fafb',
        borderLeft: '4px solid #f59e0b',
        fontWeight: '500',
      };
    }

    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
    };
  }

  getDataCellStyle(params: any): any {
    const data = params.data;

    if (data.isSectionHeader || data.isMaterialHeader || data.isBranchHeader) {
      return {
        backgroundColor: 'transparent',
        color: 'transparent',
      };
    }

    return {
      backgroundColor: '#ffffff',
      color: '#374151',
    };
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

  // Transform data to hierarchical structure
  transformToHierarchicalData(data: any): any[] {
    const hierarchicalData: any[] = [];

    console.log('Total items in response:', data.mbom.length);
    console.log(
      'All items:',
      data.mbom.map((item: any) => ({
        branchID: item.branchID,
        section: item.section,
        material: item.material,
        part: item.part,
      }))
    );

    // Group by section first
    const sections = this.groupBySection(data.mbom);
    console.log('Sections found:', Object.keys(sections));

    Object.keys(sections).forEach((sectionName) => {
      const sectionData = sections[sectionName];

      // Create section header row
      const sectionRow: any = {
        section: sectionName,
        isSectionHeader: true,
        isExpanded: false, // Start collapsed
        children: [],
        level: 0,
      };

      // Group by material within section
      const materials = this.groupByMaterial(sectionData);
      console.log(`Materials in ${sectionName}:`, Object.keys(materials));

      Object.keys(materials).forEach((materialName) => {
        const materialData = materials[materialName];
        console.log(
          `Items for material ${materialName}:`,
          materialData.map((item: any) => ({
            branchID: item.branchID,
            part: item.part,
          }))
        );

        // Create material header row
        const materialRow: any = {
          section: sectionName,
          material: materialName,
          isMaterialHeader: true,
          isExpanded: false,
          children: [],
          level: 1,
          parent: sectionRow,
        };

        // Group by branchID for sub-rows
        const branchGroups = this.groupByBranchID(materialData);
        console.log(`Branches for ${materialName}:`, Object.keys(branchGroups));

        Object.keys(branchGroups).forEach((branchID) => {
          const branchData = branchGroups[branchID];

          // Create branch header row if there are multiple items with same branchID
          if (branchData.length > 1) {
            const branchRow: any = {
              section: sectionName,
              material: materialName,
              branchID: branchID,
              isBranchHeader: true,
              isExpanded: false,
              children: [],
              level: 2,
              parent: materialRow,
            };

            // Add individual items as children
            branchData.forEach((item: any) => {
              const itemRow = {
                ...item,
                isSubRow: true,
                level: 3,
                parent: branchRow,
              };

              // Add SKU data to the item row
              this.addSkuDataToRow(itemRow, item);

              branchRow.children.push(itemRow);
            });

            materialRow.children.push(branchRow);
          } else {
            // Single item, add directly to material
            const itemRow = {
              ...branchData[0],
              isSubRow: true,
              level: 2,
              parent: materialRow,
            };

            // Add SKU data to the item row
            this.addSkuDataToRow(itemRow, branchData[0]);

            materialRow.children.push(itemRow);
          }
        });

        sectionRow.children.push(materialRow);
      });

      hierarchicalData.push(sectionRow);
    });

    // Count total items in hierarchical structure
    let totalItems = 0;
    hierarchicalData.forEach((section: any) => {
      totalItems += 1; // section header
      section.children.forEach((material: any) => {
        totalItems += 1; // material header
        material.children.forEach((branch: any) => {
          if (branch.isBranchHeader) {
            totalItems += 1; // branch header
            totalItems += branch.children.length; // branch items
          } else {
            totalItems += 1; // single item
          }
        });
      });
    });

    console.log('Total items in hierarchical structure:', totalItems);
    console.log(
      'Expected total items (11 original + headers):',
      data.mbom.length + ' original items + section headers + material headers + branch headers'
    );

    // Verify all original items are preserved
    const originalItems = data.mbom.map((item: any) => item.branchID + '-' + item.part);
    const hierarchicalItems: string[] = [];

    hierarchicalData.forEach((section: any) => {
      section.children.forEach((material: any) => {
        material.children.forEach((branch: any) => {
          if (branch.isBranchHeader) {
            branch.children.forEach((item: any) => {
              if (item.part) {
                hierarchicalItems.push(item.branchID + '-' + item.part);
              }
            });
          } else if (branch.part) {
            hierarchicalItems.push(branch.branchID + '-' + branch.part);
          }
        });
      });
    });

    console.log('Original items:', originalItems);
    console.log('Hierarchical items:', hierarchicalItems);
    console.log(
      'All items preserved:',
      originalItems.every((item: string) => hierarchicalItems.includes(item))
    );

    console.log('Hierarchical structure:', hierarchicalData);

    return hierarchicalData;
  }

  private groupBySection(data: any[]): any {
    return data.reduce((groups, item) => {
      const section = item.section;
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(item);
      return groups;
    }, {});
  }

  private groupByMaterial(data: any[]): any {
    return data.reduce((groups, item) => {
      const material = item.material;
      if (!groups[material]) {
        groups[material] = [];
      }
      groups[material].push(item);
      return groups;
    }, {});
  }

  private groupByBranchID(data: any[]): any {
    return data.reduce((groups, item) => {
      const branchID = item.branchID;
      if (!groups[branchID]) {
        groups[branchID] = [];
      }
      groups[branchID].push(item);
      return groups;
    }, {});
  }

  private addSkuDataToRow(itemRow: any, originalItem: any): void {
    // Get SKU info from data service
    const skuInfo = this.dataService.getSkuInfo();

    // Map SKU data to the row
    if (originalItem.skus && Array.isArray(originalItem.skus)) {
      skuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        // Find matching SKU in the original item's skus array
        const matchingSku = originalItem.skus.find((s: any) => s.skuId === sku.sku);
        itemRow[fieldName] = matchingSku ? matchingSku.value : '';
      });
    } else {
      // If no skus array, set empty values
      skuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        itemRow[fieldName] = '';
      });
    }

    // Debug: Log SKU data for the first few items
    if (itemRow.part && (itemRow.part === 'Material2' || itemRow.part === 'mat1')) {
      console.log('SKU data for', itemRow.part, ':', {
        sku100480: itemRow.sku100480,
        sku100484: itemRow.sku100484,
        originalSkus: originalItem.skus,
      });
    }
  }

  // Navigation
  goToSbom(): void {
    this.router.navigate(['/sbom']);
  }
}
