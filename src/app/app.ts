import {
  Component,
  OnInit,
  ViewContainerRef,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { AutocompleteCellEditorComponent } from './autocomplete-cell-editor/autocomplete-cell-editor.component';
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

  @ViewChild('columnPanel') columnPanel!: ElementRef;
  @ViewChild('toggleBtn') toggleBtn!: ElementRef;
  public showExpiredData = false;
  public expiredDataCount = 0;

  // Material modal state
  public showMaterialModal = false;
  public selectedMaterialData: any = {};
  public selectedMaterialSkuData: any[] = [];

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

  // Current user state
  public currentUser: any = null;

  // BOM information from API
  public bomName: string = 'MBOM'; // Default fallback

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
    const commonOptions = this.gridCommonService.getCommonGridOptions(this);
    // Merge with our component registration - ensure components are preserved
    this.gridOptions = {
      ...commonOptions,
      components: {
        ...(commonOptions.components || {}),
        AutocompleteCellEditorComponent: AutocompleteCellEditorComponent,
      },
      // Set dataService in context so AutocompleteCellEditor can access it
      context: {
        ...(commonOptions.context || {}),
        dataService: this.dataService,
      },
    };

    // Initialize authentication check
    this.checkAuthentication();
  }

  ngOnInit(): void {
    // Make accordion functions available globally
    (window as any).toggleSection = (section: string) => {
      this.toggleSection(section);
    };
    (window as any).toggleMaterial = (
      section: string,
      material: string,
      materialIndex?: number
    ) => {
      this.toggleMaterial(section, material, materialIndex);
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

    // Update using setGridOption (like add/delete rows) - prevents scroll jump
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.displayData = flatData;
    this.gridApi.setGridOption('rowData', flatData);
  }

  // Toggle material expansion
  public toggleMaterial(section: string, material: string, materialIndex?: number): void {
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

      // Use the materialIndex from the data, not the array position
      materialRow = materialHeaders.find((m: any) => m.materialIndex === materialIndex);
    } else {
      // Fallback to finding by name only
      materialRow = sectionRow.children.find(
        (child: any) => child.material === material && child.isMaterialHeader
      );
    }

    if (!materialRow) return;
    materialRow.isExpanded = !materialRow.isExpanded;

    // Update using setGridOption (like add/delete rows) - prevents scroll jump
    const flatData = this.flattenHierarchicalData(this.rowData);
    this.displayData = flatData;
    this.gridApi.setGridOption('rowData', flatData);
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

    data.forEach((item) => {
      result.push(item);

      if (item.isSectionHeader && item.isExpanded) {
        if (item.children && Array.isArray(item.children)) {
          item.children.forEach((child: any) => {
            if (child.isDirectRow) {
              // Direct row - show immediately without accordion
              result.push(child);
            } else if (child.isMaterialHeader) {
              // Material header with accordion
              result.push(child);

              if (child.isExpanded && child.children && Array.isArray(child.children)) {
                child.children.forEach((sub: any) => {
                  result.push(sub);
                });
              }
            }
          });
        }
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

    // Get username from JSP data attribute (using DataService for consistency)
    const userName = this.dataService.getUserNameFromJsp();

    if (userName) {
      // Set current user from JSP data
      this.currentUser = {
        name: userName,
        fullName: userName,
        userName: userName,
      };
    }

    // Step 1: Get CSRF token (keep this call as it uses existing FlexPLM session)
    this.sessionService.getCsrfToken().subscribe({
      next: (csrfToken) => {
        // CSRF token received successfully - skip login modal and getUserDetails for now
        // TODO: Re-enable in future when needed
        // setTimeout(() => {
        //   this.promptForCredentials();
        // }, 100);

        // Load data directly without authentication
        this.loadData();
      },
      error: (error) => {
        // CSRF API failed - app must be accessed outside FlexPLM
        // Show error and DO NOT load data
        this.showNotification(
          'This application must be accessed through FlexPLM. Please login to FlexPLM first.',
          'error'
        );
        // TODO: Re-enable modal in future if needed
        // setTimeout(() => {
        //   this.promptForCredentials();
        // }, 100);
      },
    });
  }

  // TODO: Re-enable login modal and getUserDetails API in future
  /*
  private async promptForCredentials(): Promise<void> {
    try {
      const credentials = await this.modalService.showSignInModal(this.viewContainerRef);

      if (!credentials) {
        this.showNotification('Authentication is required to access this application.', 'error');
        return;
      }

      // Validate credentials for mock API
      if (environment.useMockApi) {
        const expectedUsername = environment.credentials.username;
        const expectedPassword = environment.credentials.password;

        if (
          credentials.username !== expectedUsername ||
          credentials.password !== expectedPassword
        ) {
          this.showNotification('Invalid credentials. Please try again.', 'error');
          this.promptForCredentials();
          return;
        }
      }

      // Update environment credentials
      environment.credentials.username = credentials.username;
      environment.credentials.password = credentials.password;

      // Call getUserDetails POST with credentials and CSRF token
      this.sessionService.initSession().subscribe({
        next: (user) => {
          if (user && user.name && user.userName) {
            this.currentUser = user;
            this.loadData();
          } else {
            this.showNotification('Authentication failed. Please check your credentials.', 'error');
            this.promptForCredentials();
          }
        },
        error: (error) => {
          this.showNotification(
            'Authentication failed. Please check your credentials and try again.',
            'error'
          );
          this.promptForCredentials();
        },
      });
    } catch (error) {}
  }
  */

  loadData(): void {
    this.dataService.loadData().subscribe((data) => {
      // Get BOM name and modify timestamp from API response
      const bomPartInfo = this.dataService.getBomPartInfo();
      if (bomPartInfo?.bomName) {
        this.bomName = bomPartInfo.bomName;
      }
      if (bomPartInfo?.modifyTimestamp) {
        // Parse timestamp from API (format: "2025-10-29 11:52:20.0")
        this.lastSavedAt = new Date(bomPartInfo.modifyTimestamp);
        // Save to localStorage for persistence
        localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
      }

      // Transform data to hierarchical structure
      this.rowData = this.transformToHierarchicalData(data);

      // Initialize columns after data is loaded
      this.initializeColumns();

      // Set the initial flattened data to the grid (show all expanded data)
      this.displayData = this.getInitialDisplayData();

      // Make only some parts clickable (random selection from first 20 rows)
      this.clickableParts = this.gridCommonService.initializeClickableParts(this.displayData);

      // Force horizontal scroll after data is loaded
      if (this.gridApi) {
        setTimeout(() => {
          this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);
        }, 200);
      }
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

    // Add Actions column as the first column (never changes based on selection)
    columns.push({
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
        // Show red "e" for expired data
        if (params.data.isExpired) {
          return `<span class="expired-indicator" title="Expired">e</span>`;
        }

        const partId = params.data.part || '';

        // For new rows, show delete button
        if (params.data.isNewRow) {
          const newRowId = params.data.newRowId;
          return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
        }

        // Only show add/remove buttons on parent level materials
        // This includes: isMaterialHeader (materials with children) OR isDirectRow (materials without children)
        // Both are at level 1 and represent parent materials
        if ((params.data.isMaterialHeader && params.data.hasLinkedBom) || params.data.isDirectRow) {
          return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
        }

        // For all other rows (section headers, sub-rows, direct rows), show nothing
        return '';
      },
      cellStyle: {
        textAlign: 'center',
        padding: '4px',
        borderRight: '1px solid #e2e8f0',
      },
    });

    // Add Material column as the second column with hierarchical display
    columns.push({
      headerName: '',
      field: 'material',
      width: 150,
      minWidth: 150,
      pinned: 'left',
      sortable: false,
      filter: false,
      tooltipValueGetter: (params: any) => {
        // Always show tooltip for material column
        if (!params.data) return null;
        const materialValue = params.data.material || params.value || '';
        if (!materialValue) return null;
        return String(materialValue);
      },
      cellRenderer: (params: any) => {
        return this.renderHierarchicalCell(params);
      },
      cellStyle: (params: any) => {
        return this.getHierarchicalCellStyle(params);
      },
      editable: false, // Material column is not editable - it's just for hierarchical display
    });

    // Add columns based on response column mapping
    Object.keys(columnMapping).forEach((field) => {
      const headerName = columnMapping[field];
      const columnDef: ColDef = {
        headerName: headerName,
        field: field,
        width: 150,
        minWidth: 100,
        filter: true,
        sortable: true,
        cellRenderer: (params: any) => {
          // Show values for data rows and material headers (header carries parent data)
          if (params.data.isSectionHeader || params.data.isBranchHeader) {
            return '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
          return this.createCellContentWithTooltip(params.value, columnWidth);
        },
        tooltipValueGetter: (params: any) => {
          // Always show tooltip if value exists
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        // Make all fields editable for new rows, but not for section headers
        editable: (params: any) => {
          return params.data && params.data.isNewRow && !params.data.isSectionHeader;
        },
      };

      // Add specific cell editors for different field types
      if (field === 'bomLinkPart') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          values: this.getAvailablePartNumbers(),
          placeholder: 'Type to search part numbers...',
        });
      } else if (field === 'material') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          values: this.getAvailableMaterials(),
          placeholder: 'Type to search materials...',
        });
      } else if (field === 'qty' || field === 'quantity') {
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          max: 9999,
        };
        // Qty field is always editable (like in SBOM), but not for section headers
        columnDef.editable = (params: any) => {
          // Don't allow editing expired rows or section headers
          if (params.data && (params.data.isExpired || params.data.isSectionHeader)) {
            return false;
          }
          // Always allow editing quantity field
          return true;
        };
      } else if (field === 'supplier' || field === 'color' || field === 'feature') {
        columnDef.cellEditor = 'agTextCellEditor';
        columnDef.cellEditorParams = (params: any) => {
          let values: string[] = [];
          if (field === 'supplier') {
            values = this.getUniqueSuppliers();
          } else if (field === 'color') {
            values = this.getUniqueColors();
          } else if (field === 'feature') {
            values = this.getUniqueFeatures();
          }
          return {
            values: values,
            placeholder: `Type to search ${field}...`,
          };
        };
      } else if (field === 'startDate' || field === 'endDate') {
        // Date columns should use date picker - use exact same config as ColumnService
        columnDef.cellEditor = 'agDateCellEditor';
        columnDef.cellDataType = 'date';
        columnDef.cellEditorParams = {
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
          format: 'mm/dd/yyyy',
        };
        columnDef.valueFormatter = (params: any) => {
          // Just return the value as-is, keeping the original string format
          return params.value || '';
        };
        columnDef.valueParser = (params: any) => {
          if (!params.newValue) return '';
          // Keep dates as strings to match mock2.json format
          if (
            params.newValue &&
            typeof params.newValue === 'object' &&
            'toLocaleDateString' in params.newValue
          ) {
            return (params.newValue as Date).toLocaleDateString('en-US');
          }
          // Return the string value as-is
          return String(params.newValue);
        };
        columnDef.valueSetter = (params: any) => {
          if (!params.newValue) return false;
          const date = new Date(params.newValue);
          if (isNaN(date.getTime())) return false;
          params.data[params.colDef.field as string] = date.toISOString();
          return true;
        };
      }

      columns.push(columnDef);
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
        const data = params.data || {};

        // Hide SKU values on section headers and branch headers
        if (data.isSectionHeader || data.isBranchHeader) {
          return '';
        }

        // Show SKU values on material headers (linked BOM) and direct rows
        // Hide SKU values on child rows (subrows) since they're already on material header
        if (data.isMaterialHeader || data.isDirectRow) {
          const columnWidth = params.column?.getActualWidth() || 200;
          return this.createCellContentWithTooltip(params.value, columnWidth);
        }

        // Hide on subrows (child rows under material headers)
        return '';
      },
      tooltipValueGetter: (params: any) => {
        // Always show tooltip for SKU columns
        if (params.value === null || params.value === undefined) return null;
        return String(params.value);
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
          cursor: pointer; 
        " 
             onclick="window.toggleSection('${data.section}')"
             onmouseover="this.style.background='#e0f2fe'; this.style.borderLeftColor='#1d4ed8'"
             onmouseout="this.style.background='#f8fafc'; this.style.borderLeftColor='#3b82f6'">
          <span style="
            margin-right: 4px; 
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
      const materialIndex = data.materialIndex || 0;
      const linkIcon = data.hasLinkedBom ? '🔗' : '⧉';
      // Show section name with accordion functionality, but no material name
      return `
        <div style="
          
          cursor: pointer; 
          
        " 
             onclick="window.toggleMaterial('${data.section}', '${data.material}', ${materialIndex})"
             onmouseover="this.style.background='#dcfce7'; this.style.borderLeftColor='#059669'"
             onmouseout="this.style.background='#f0fdf4'; this.style.borderLeftColor='#10b981'">
        
          <span style="
              margin-right: 6px;
              font-size: 12px;
              color: #0f766e;
            ">${linkIcon}</span>
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
      const directIndent = ''; // No indent - same level as section headers
      return '';
    }

    // Regular data row (sub-row)
    const dataIndent = '&nbsp;'.repeat(24);
    return '';
  }

  // Helper method to escape HTML for tooltip
  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper method to estimate if text will be truncated based on column width
  private isTextLikelyTruncated(text: string | null | undefined, columnWidth: number): boolean {
    if (!text) return false;
    const textStr = String(text);
    // Estimate ~8-10 pixels per character (conservative estimate)
    // Add some padding for cell padding (16px total)
    const estimatedPixelsNeeded = textStr.length * 9 + 16;
    return estimatedPixelsNeeded > columnWidth;
  }

  // Helper method to create cell content with conditional tooltip
  private createCellContentWithTooltip(value: any, columnWidth: number): string {
    if (!value && value !== 0) return '';
    const textStr = String(value);
    const escapedText = this.escapeHtml(textStr);
    const shouldShowTooltip = this.isTextLikelyTruncated(textStr, columnWidth);

    // Don't add title attribute here - let AG Grid's tooltipValueGetter handle tooltips
    // This ensures tooltipValueGetter works properly with enableBrowserTooltips
    if (shouldShowTooltip) {
      return `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; width: 100%;">${escapedText}</span>`;
    }
    // Return plain text without title attribute
    return escapedText;
  }

  getHierarchicalCellStyle(params: any): any {
    const data = params.data;
    const isSectionHeader = data?.isSectionHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isSectionHeader) {
      return {
        backgroundColor: '#eff6ff',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
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
    const isSectionHeader = data?.isSectionHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isSectionHeader) {
      return {
        backgroundColor: '#eff6ff',
        color: 'transparent',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
      };
    }

    if (data.isMaterialHeader) {
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

      // No need for manual event listeners - HostListener handles this
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    if (!this.showColumnVisibilityPanel) return;

    const target = event.target as Element;
    const panel = this.columnPanel?.nativeElement;
    const toggleBtn = this.toggleBtn?.nativeElement;

    // Check if click is outside all relevant elements
    const clickedOutside =
      panel && !panel.contains(target) && toggleBtn && !toggleBtn.contains(target);

    if (clickedOutside) {
      this.showColumnVisibilityPanel = false;
    }
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

    // Start editing for all editable fields in new rows (but not section headers)
    if (event.data && event.data.isNewRow && !event.data.isSectionHeader) {
      // Check if this is an editable field (not actions, not SKU fields)
      const field = event.colDef.field;
      if (field && field !== 'actions' && !field.startsWith('sku')) {
        event.api.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: event.column.getId(),
          rowPinned: event.rowPinned,
          keyPress: event.event?.key,
        });
        return;
      }
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
    } else if (event.colDef.field === 'part' || event.colDef.field === 'bomLinkPart') {
      // Part column clicks are handled differently - no modal functionality for parts
      return;
    } else if (event.colDef.field === 'material') {
      // Don't open modal for new rows - they are in edit mode
      if (event.data && event.data.isNewRow) {
        return; // Skip modal opening for new rows
      }

      // Open material modal if clicking on a material header or direct row with material data
      if (
        event.data &&
        (event.data.isMaterialHeader || event.data.isDirectRow) &&
        event.data.material
      ) {
        this.openMaterialModal(event.data);
      }
    }
  }

  openMaterialModal(materialData: any): void {
    if (!materialData) return;

    const materialId = materialData.material || materialData.part;
    if (!materialId) return;

    // Fetch Complex BOM data from API
    this.dataService.getComplexBOM(materialId).subscribe({
      next: (complexBOMData: any) => {
        // Convert to key-value array format for table display
        const keyValuePairs: any[] = [];

        // If API returns object, convert to array of {key, value} pairs
        if (
          complexBOMData &&
          typeof complexBOMData === 'object' &&
          !Array.isArray(complexBOMData)
        ) {
          Object.keys(complexBOMData).forEach((key) => {
            if (complexBOMData[key] !== null && complexBOMData[key] !== undefined) {
              keyValuePairs.push({
                key: key,
                value: complexBOMData[key],
              });
            }
          });
        } else if (Array.isArray(complexBOMData)) {
          // If API already returns array format
          keyValuePairs.push(...complexBOMData);
        }

        // If API returned data, merge it with the original row data, otherwise use original row data
        const allRowData =
          keyValuePairs.length > 0
            ? { ...materialData, ...this.convertKeyValuePairsToObject(keyValuePairs) }
            : materialData;

        // Set ALL row data (everything from that particular row)
        this.selectedMaterialData = allRowData;

        // Get SKU data for the material
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);

        this.showMaterialModal = true;
      },
      error: (error) => {
        // Use original row data if API fails
        this.selectedMaterialData = materialData;
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
    });
  }

  private convertKeyValuePairsToObject(keyValuePairs: any[]): any {
    const obj: any = {};
    keyValuePairs.forEach((pair) => {
      if (pair.key && pair.value !== null && pair.value !== undefined) {
        obj[pair.key] = pair.value;
      }
    });
    return obj;
  }

  closeMaterialModal(): void {
    this.showMaterialModal = false;
    this.selectedMaterialData = {};
    this.selectedMaterialSkuData = [];
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
      this.displayData, // Use displayData instead of rowData
      this.gridApi,
      this.dataService,
      this.nextRowId,
      false // Not SBOM
    );
    this.nextRowId = result.newRowId;
    this.newRows.set(result.newRow.newRowId, result.newRow);

    // Force grid refresh to ensure cell editor is available
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);
  }

  deleteRowById(newRowId: number): void {
    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);
    this.newRows.delete(newRowId);
  }

  deleteRow(partId: string): void {
    this.rowManagementService.deleteRow(partId, this.rowData, this.gridApi);
    this.newRows.delete(parseInt(partId));
  }

  getUniqueFeatures(): string[] {
    return this.gridCommonService.getUniqueFeatures(this.rowData);
  }

  // Helper: Check if column is actions column
  private isActionsColumn(params: any): boolean {
    const fieldName = params.colDef?.field;
    const colId = params.column?.getColId() || params.colDef?.colId || fieldName;
    return fieldName === 'actions' || colId === 'actions';
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
    return this.gridCommonService.getAvailablePartNumbers(this.displayData);
  }

  getAvailableMaterials(): string[] {
    return this.gridCommonService.getAvailableMaterials(this.displayData);
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

    // Group items by section and create material groups (not SKU-expanded)
    for (const item of items) {
      const section = item.section || 'NA';
      if (!sections[section]) sections[section] = [];

      // Create unique key for material group (part + branchID + flexBomLinkID)
      const materialKey = `${item.part}_${item.branchID}_${item.flexBomLinkID}`;

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

    for (const sectionName of sectionOrder) {
      const sectionItems = sections[sectionName] || [];
      const roots = sectionItems.filter((i: any) => i.masterBranchID == '0');

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
      }
    }

    return result;
  }

  // Transform data to hierarchical structure using SKU-based grouping
  transformToHierarchicalData(data: any): any[] {
    const hierarchicalData: any[] = [];

    // Build SKU-based hierarchy
    const sections = this.buildMbomHierarchy(data);

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
          // Create material header with children (NO separate parent row)
          const materialRow: any = {
            // carry over all original material fields so other columns can show values
            ...material,
            section: section.section,
            material: material.part,
            materialIndex: materialIndex,
            allSkus: material.allSkus,
            isMaterialHeader: true,
            isExpanded: true,
            children: [],
            level: 1,
            parent: sectionRow,
            hasLinkedBom: true,
          };

          // Add SKU data to material header
          this.addSkuDataToRow(materialRow, material);

          // Add only child items under the header
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

    // Final guard
    if (hierarchicalData.length === 0) {
      return hierarchicalData;
    }

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
    this.router.navigate(['/sbom']).then(
      (success) => {
        // Navigation completed
      },
      (error) => {
        // Navigation failed
      }
    );
  }

  // Angular-friendly notification method
  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.saveMessage = message;
    this.saveMessageType = type;

    // Auto-clear after 5 seconds
    setTimeout(() => {
      this.saveMessage = '';
      this.saveMessageType = '';
    }, 5000);
  }
}
