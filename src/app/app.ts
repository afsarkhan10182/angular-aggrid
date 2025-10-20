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
  public displayData: any[] = []; // Flattened data for display
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
    this.displayData = this.flattenHierarchicalData(this.rowData);
  }

  // Toggle material expansion
  public toggleMaterial(section: string, material: string, materialIndex?: number): void {
    console.log(
      `toggleMaterial called with: section=${section}, material=${material}, materialIndex=${materialIndex}`
    );
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    // Find material row by material name and index if provided
    let materialRow;
    if (materialIndex !== undefined) {
      // Find all material headers with this name and get the one at the specified index
      const materialHeaders = sectionRow.children.filter(
        (child: any) => child.material === material && child.isMaterialHeader
      );
      console.log(`Found ${materialHeaders.length} material headers for ${material}`);
      console.log(
        `Material headers:`,
        materialHeaders.map((m: any) => ({
          material: m.material,
          index: m.materialIndex,
          expanded: m.isExpanded,
        }))
      );

      // Use the materialIndex from the data, not the array position
      materialRow = materialHeaders.find((m: any) => m.materialIndex === materialIndex);
      console.log(
        `Looking for material ${material} with materialIndex ${materialIndex}, found:`,
        materialRow
      );
    } else {
      // Fallback to finding by name only
      materialRow = sectionRow.children.find(
        (child: any) => child.material === material && child.isMaterialHeader
      );
    }

    if (!materialRow) {
      console.log(`Material row not found for ${material} at index ${materialIndex}`);
      return;
    }

    console.log(
      `Toggling material: ${materialRow.material}, current expanded: ${materialRow.isExpanded}`
    );
    materialRow.isExpanded = !materialRow.isExpanded;
    console.log(`New expanded state: ${materialRow.isExpanded}`);

    // Update the grid with the new data
    this.displayData = this.flattenHierarchicalData(this.rowData);
  }

  private updateGridData(): void {
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.gridApi.setGridOption('rowData', flatData);
  }

  private getInitialDisplayData(): any[] {
    // Show all expanded data initially
    return this.flattenHierarchicalData(this.rowData);
  }

  private flattenHierarchicalData(data: any[]): any[] {
    const result: any[] = [];

    console.log('=== FLATTENING HIERARCHICAL DATA ===');
    console.log('Input data:', data);

    data.forEach((item) => {
      result.push(item);
      console.log(
        `Processing item: ${item.section || item.material || 'unknown'}, isSectionHeader: ${
          item.isSectionHeader
        }, isExpanded: ${item.isExpanded}`
      );

      if (item.isSectionHeader && item.isExpanded) {
        console.log(
          `Section ${item.section} is expanded, processing ${item.children?.length || 0} children`
        );
        if (item.children && Array.isArray(item.children)) {
          item.children.forEach((child: any) => {
            console.log(
              `  Child: ${child.material || child.part || 'unknown'}, isDirectRow: ${
                child.isDirectRow
              }, isMaterialHeader: ${child.isMaterialHeader}, isExpanded: ${child.isExpanded}`
            );
            if (child.isDirectRow) {
              // Direct row - show immediately without accordion
              result.push(child);
              console.log(`    Added direct row: ${child.part || child.material}`);
            } else if (child.isMaterialHeader) {
              // Material header with accordion
              result.push(child);
              console.log(`    Added material header: ${child.material}`);

              if (child.isExpanded && child.children && Array.isArray(child.children)) {
                console.log(
                  `    Material ${child.material} is expanded, processing ${child.children.length} children`
                );
                child.children.forEach((item: any) => {
                  result.push(item);
                  console.log(`      Added child: ${item.part || item.material}`);
                });
              }
            }
          });
        }
      }
    });

    console.log('=== FLATTENED RESULT ===');
    console.log('Total items in result:', result.length);
    result.forEach((item, index) => {
      console.log(
        `  ${index + 1}. ${item.section || item.material || item.part || 'unknown'} (${
          item.isSectionHeader
            ? 'Section'
            : item.isMaterialHeader
            ? 'Material'
            : item.isDirectRow
            ? 'Direct'
            : 'Data'
        })`
      );
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
          this.loadData();
        } else {
          this.promptForCredentials();
        }
      },
      error: (error) => {
        // CSRF API failed - show modal, NO DATA LOADING
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
          alert('Authentication failed. Please check your credentials and try again.');
          this.promptForCredentials(); // Show modal again
        },
      });
    } catch (error) {}
  }

  loadData(): void {
    this.dataService.loadData().subscribe((data) => {
      // Transform data to hierarchical structure
      this.rowData = this.transformToHierarchicalData(data);

      // Initialize columns after data is loaded
      this.initializeColumns();

      // Set the initial flattened data to the grid (show all expanded data)
      this.displayData = this.getInitialDisplayData();

      // Make only some parts clickable (random selection from first 20 rows)
      this.clickableParts = this.gridCommonService.initializeClickableParts(this.displayData);
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

    // Add Material column as the first column with hierarchical display
    columns.push({
      headerName: '',
      field: 'material',
      width: 300,
      minWidth: 200,
      pinned: 'left',
      sortable: false,
      filter: false,
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
        filter: true,
        sortable: true,
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
      const materialIndent = '&nbsp;'.repeat(8);
      const materialIndex = data.materialIndex || 0; // Use the material index
      console.log(
        `Rendering material header: ${data.material}, index: ${materialIndex}, expanded: ${data.isExpanded}`
      );
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
             onclick="window.toggleMaterial('${data.section}', '${data.material}', ${materialIndex})"
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

    // Parent row (main item with children)
    if (data.isParentRow) {
      const parentIndent = '&nbsp;'.repeat(16);
      return `
        <div style="
          display: flex; 
          align-items: center; 
          color: #1e40af; 
          padding: 4px 6px; 
          background: #eff6ff;
          border-radius: 2px;
          margin: 1px 0;
          border-left: 3px solid #3b82f6;
          transition: all 0.2s ease;
          font-weight: 500;
        " 
             onmouseover="this.style.background='#dbeafe'; this.style.borderLeftColor='#1d4ed8'"
             onmouseout="this.style.background='#eff6ff'; this.style.borderLeftColor='#3b82f6'">
          <span style="
            font-size: 12px; 
            color: #1e40af;
            font-weight: 500;
          ">${parentIndent}${data.part || data.material || 'Item'}</span>
        </div>
      `;
    }

    // Direct row (no accordion)
    if (data.isDirectRow) {
      const directIndent = '&nbsp;'.repeat(16);
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
            font-size: 12px; 
            color: #475569;
            font-weight: 400;
          ">${directIndent}${data.part || data.material || 'Item'}</span>
        </div>
      `;
    }

    // Regular data row (sub-row)
    const dataIndent = '&nbsp;'.repeat(24);
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

    if (data.isParentRow) {
      return {
        backgroundColor: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
      };
    }

    if (data.isDirectRow) {
      return {
        backgroundColor: '#ffffff',
        borderLeft: '2px solid #d1d5db',
        fontWeight: '400',
      };
    }

    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
    };
  }

  getDataCellStyle(params: any): any {
    const data = params.data;

    if (data.isSectionHeader || data.isMaterialHeader) {
      return {
        backgroundColor: 'transparent',
        color: 'transparent',
      };
    }

    if (data.isParentRow) {
      return {
        backgroundColor: '#ffffff',
        color: '#1e40af',
      };
    }

    if (data.isDirectRow) {
      return {
        backgroundColor: '#ffffff',
        color: '#374151',
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

    // If data is already loaded, set it to the grid
    if (this.rowData && this.rowData.length > 0) {
      this.displayData = this.getInitialDisplayData();
    }
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

  // Build SKU-based MBOM hierarchy
  private buildMbomHierarchy(data: any): any[] {
    const sections: any = {};
    const items = data.mbom;

    console.log('=== BUILDING SKU-BASED HIERARCHY ===');
    console.log('Processing items:', items.length);

    // Group items by section and create material groups (not SKU-expanded)
    for (const item of items) {
      const section = item.section || 'NA';
      if (!sections[section]) sections[section] = [];

      // Create unique key for material group (part + branchID + flexBomLinkID)
      const materialKey = `${item.part}_${item.branchID}_${item.flexBomLinkID}`;
      console.log(`Item ${item.part} (${item.branchID}) - Material Key: ${materialKey}`);

      // Check if this material group already exists
      let existingMaterial = sections[section].find((m: any) => m.materialKey === materialKey);

      if (!existingMaterial) {
        // Create new material group with all SKUs
        existingMaterial = {
          ...item,
          materialKey,
          allSkus: item.skus || [],
        };
        sections[section].push(existingMaterial);
        console.log(
          `  Created new material group: ${materialKey} with SKUs:`,
          item.skus?.map((s: any) => s.skuId)
        );
      }
    }

    // Build tree recursively for children
    const buildTree = (branchID: string, allItems: any[]): any[] => {
      const children = allItems.filter((i: any) => i.masterBranchID == branchID);
      return children
        .sort((a: any, b: any) => Number(a.sortingNumber || 0) - Number(b.sortingNumber || 0))
        .map((c: any) => ({
          ...c,
          children: buildTree(c.branchID, allItems),
        }));
    };

    const result: any[] = [];
    const sectionOrder = data.sectionOrder || [];

    console.log('=== BUILDING FINAL HIERARCHY ===');
    console.log('Section order:', sectionOrder);

    for (const sectionName of sectionOrder) {
      const sectionItems = sections[sectionName] || [];
      const roots = sectionItems.filter((i: any) => i.masterBranchID == '0');

      console.log(
        `Section ${sectionName}: ${sectionItems.length} items, ${roots.length} root items`
      );

      if (roots.length > 0) {
        const sectionObj = {
          section: sectionName,
          materials: roots
            .sort((a: any, b: any) => Number(a.sortingNumber || 0) - Number(b.sortingNumber || 0))
            .map((r: any) => ({
              ...r,
              children: buildTree(r.branchID, sectionItems),
            })),
        };
        result.push(sectionObj);
        console.log(`  Added section ${sectionName} with ${sectionObj.materials.length} materials`);
      }
    }

    console.log('=== FINAL HIERARCHY RESULT ===');
    console.log('Total sections created:', result.length);
    result.forEach((section: any, index: number) => {
      console.log(
        `Section ${index + 1}: ${section.section} (${section.materials.length} materials)`
      );
    });

    return result;
  }

  // Transform data to hierarchical structure using SKU-based grouping
  transformToHierarchicalData(data: any): any[] {
    const hierarchicalData: any[] = [];

    // Log original mock2.json structure
    console.log('=== ORIGINAL MOCK2.JSON DATA ===');
    console.log('Original mbom items:', data.mbom.length);
    console.log('Section order:', data.sectionOrder);
    console.log('Product info:', data.productInfo);
    console.log(
      'Original items structure:',
      data.mbom.map((item: any) => ({
        branchID: item.branchID,
        part: item.part,
        section: item.section,
        masterBranchID: item.masterBranchID,
        linkedBom: item.linkedBom,
        skus: item.skus,
        quantity: item.quantity,
        sortingNumber: item.sortingNumber,
      }))
    );

    // Build SKU-based hierarchy
    const sections = this.buildMbomHierarchy(data);

    // Log the transformed hierarchy
    console.log('=== TRANSFORMED HIERARCHY FOR AG GRID ===');
    console.log('Transformed sections:', sections.length);
    sections.forEach((section: any, index: number) => {
      console.log(`Section ${index + 1}: ${section.section}`);
      console.log(`  Materials: ${section.materials.length}`);
      section.materials.forEach((material: any, matIndex: number) => {
        console.log(`    Material ${matIndex + 1}: ${material.part} (SKU: ${material.skuId})`);
        console.log(`      Children: ${material.children.length}`);
        material.children.forEach((child: any, childIndex: number) => {
          console.log(`        Child ${childIndex + 1}: ${child.part} (SKU: ${child.skuId})`);
        });
      });
    });

    // Convert to AG Grid format
    sections.forEach((section: any) => {
      const sectionRow: any = {
        section: section.section,
        isSectionHeader: true,
        isExpanded: true, // Start expanded to show materials
        children: [],
        level: 0,
      };

      // Process materials in this section
      section.materials.forEach((material: any, materialIndex: number) => {
        // Check if material has children
        const hasChildren = material.children && material.children.length > 0;

        if (hasChildren) {
          // Create material header with children
          const materialRow: any = {
            section: section.section,
            material: material.part,
            materialIndex: materialIndex, // Add unique index for this material
            allSkus: material.allSkus,
            isMaterialHeader: true,
            isExpanded: true, // Start expanded to show children
            children: [],
            level: 1,
            parent: sectionRow,
            hasLinkedBom: true, // Add indicator for linked BOM
          };

          console.log(`Creating material header: ${material.part} with index ${materialIndex}`);

          // Add parent item
          const parentRow = {
            ...material,
            isParentRow: true,
            level: 2,
            parent: materialRow,
          };
          this.addSkuDataToRow(parentRow, material);
          materialRow.children.push(parentRow);

          // Add child items
          material.children.forEach((child: any) => {
            const childRow = {
              ...child,
              isSubRow: true,
              level: 2,
              parent: materialRow,
            };
            this.addSkuDataToRow(childRow, child);
            materialRow.children.push(childRow);
          });

          sectionRow.children.push(materialRow);
        } else {
          // No children - add material directly as a direct row
          const directRow = {
            ...material,
            section: section.section,
            isDirectRow: true,
            level: 1,
            parent: sectionRow,
          };
          this.addSkuDataToRow(directRow, material);
          sectionRow.children.push(directRow);
        }
      });

      hierarchicalData.push(sectionRow);
    });

    // Log final AG Grid structure
    console.log('=== FINAL AG GRID STRUCTURE ===');
    console.log('Total sections in grid:', hierarchicalData.length);
    console.log('Hierarchical data:', hierarchicalData);

    if (hierarchicalData.length === 0) {
      console.log('❌ NO DATA IN HIERARCHICAL STRUCTURE!');
      return hierarchicalData;
    }

    hierarchicalData.forEach((section: any, index: number) => {
      console.log(`Grid Section ${index + 1}: ${section.section}`);
      console.log(`  Grid Children: ${section.children.length}`);
      section.children.forEach((child: any, childIndex: number) => {
        if (child.isMaterialHeader) {
          console.log(
            `    Material Header ${childIndex + 1}: ${child.material} (SKU: ${child.skuId})`
          );
          console.log(`      Material Children: ${child.children.length}`);
          child.children.forEach((item: any, itemIndex: number) => {
            if (item.isParentRow) {
              console.log(`        Parent Row ${itemIndex + 1}: ${item.part} (${item.quantity})`);
            } else if (item.isSubRow) {
              console.log(`        Sub Row ${itemIndex + 1}: ${item.part} (${item.quantity})`);
            }
          });
        } else if (child.isDirectRow) {
          console.log(`    Direct Row ${childIndex + 1}: ${child.part} (${child.quantity})`);
        }
      });
    });

    return hierarchicalData;
  }

  // Sort sections according to the sectionOrder from the data
  private sortSectionsByOrder(sectionNames: string[], sectionOrder: string[]): string[] {
    const orderedSections: string[] = [];
    const unorderedSections: string[] = [];

    // First, add sections in the order specified by sectionOrder
    sectionOrder.forEach((orderedSection) => {
      if (sectionNames.includes(orderedSection)) {
        orderedSections.push(orderedSection);
      }
    });

    // Then add any remaining sections that weren't in the order
    sectionNames.forEach((sectionName) => {
      if (!orderedSections.includes(sectionName)) {
        unorderedSections.push(sectionName);
      }
    });

    return [...orderedSections, ...unorderedSections];
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
  }

  // Navigation
  goToSbom(): void {
    this.router.navigate(['/sbom']);
  }
}
