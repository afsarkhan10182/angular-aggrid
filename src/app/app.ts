import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { PartModalComponent } from './part-modal/part-modal.component';
import { AutocompleteCellEditorComponent } from './autocomplete-cell-editor/autocomplete-cell-editor.component';
import { DataService } from './services/data.service';
import { GridCommonService } from './services/grid-common.service';
import { RowManagementService } from './services/row-management.service';
import { SessionService } from './services/session.service';
import { GroupByService, GroupConfig } from './services/group-by.service';
import { ValidationService } from './services/validation.service';
import { UtilService } from './services/util.service';
import { ColumnHeaderPinComponent } from './column-header-pin/column-header-pin.component';
import { environment } from '../environments/environment';
import { ExtendedColDef } from './services/util.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy {
  private gridApi!: GridApi;
  private subscriptions: Subscription[] = [];
  public showColumnVisibilityPanel = false;
  public showGroupByPanel = false;

  @ViewChild('columnPanel') columnPanel!: ElementRef;
  @ViewChild('toggleBtn') toggleBtn!: ElementRef;
  @ViewChild('groupByPanel') groupByPanel!: ElementRef;
  @ViewChild('groupByBtn') groupByBtn!: ElementRef;
  public showExpiredData = false;
  public showMaterialModal = false;
  public selectedMaterialData: any = {};
  public selectedMaterialSkuData: any[] = [];
  public searchText: string = '';
  public saveMessage: string = '';
  public saveMessageType: string = '';
  public editedRows = new Set<string | number>();
  public currentUser: any = null;
  public bomName: string = '';
  public isLoading: boolean = true;
  public isSaving: boolean = false; // Track save operation state
  public isMassEditing: boolean = false; // Track mass edit operation state
  private originalRowValues = new Map<string | number, any>(); // Store original values for existing rows
  private editedFields = new Map<string | number, Set<string>>(); // Track which specific fields were edited per row
  public invalidRowIds = new Set<string | number>(); // Track rows with validation errors for highlighting
  public selectedRows = new Set<any>();
  public massEditMode = false;
  public massEditStartDate: string = '';
  public massEditEndDate: string = '';
  public massEditQuantity: number | null = null;

  public allColumns = [
    // Core Part Information
    { field: 'actions', headerName: '', hide: false, isVirtual: false },
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

  public gridOptions: GridOptions = {} as GridOptions;

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];

  public rowData: any[] = [];
  public displayData: any[] = []; // Flattened data for display
  public activeGroupFields: GroupConfig[] = []; // Currently active group fields
  public availableGroupFields: GroupConfig[] = []; // Available columns for grouping
  private groupExpandedState: Map<string, boolean> = new Map(); // Track group expand/collapse state

  constructor(
    public dataService: DataService,
    private gridCommonService: GridCommonService,
    private rowManagementService: RowManagementService,
    private sessionService: SessionService,
    private groupByService: GroupByService,
    private validationService: ValidationService,
    private utilService: UtilService
  ) {
    this.gridOptions.context = {
      dataService: this.dataService,
    };

    const savedState = localStorage.getItem('showExpiredData');
    this.showExpiredData = savedState === 'true';

    this.defaultColDef = {
      ...this.gridCommonService.getDefaultColDef(),
      headerComponent: ColumnHeaderPinComponent,
    };
    const commonOptions = this.gridCommonService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      components: {
        ...(commonOptions.components || {}),
        AutocompleteCellEditorComponent: AutocompleteCellEditorComponent,
        ColumnHeaderPinComponent: ColumnHeaderPinComponent,
      },
      context: {
        ...(commonOptions.context || {}),
        dataService: this.dataService,
      },
      isFullWidthRow: (params: any) => {
        return params.rowNode.data.isGroupHeader;
      },
      fullWidthCellRenderer: (params: any) => {
        return this.renderGroupHeaderFullWidth(params);
      },
    };

    this.checkAuthentication();
  }

  ngOnInit(): void {
    (window as any).toggleSection = (section: string) => {
      this.toggleSection(section);
    };
    (window as any).toggleMaterial = (
      section: string,
      materialIdentifier: string,
      materialIndex?: number
    ) => {
      this.toggleMaterial(section, materialIdentifier, materialIndex);
    };
    (window as any).toggleGroup = (groupKey: string) => {
      this.toggleGroup(groupKey);
    };
  }

  public toggleSection(section: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    sectionRow.isExpanded = !sectionRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  public toggleMaterial(
    section: string,
    materialIdentifier?: string,
    materialIndex?: number
  ): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    let materialRow;

    if (materialIndex !== undefined) {
      materialRow = sectionRow.children.find(
        (child: any) => child.isMaterialHeader && child.materialIndex === materialIndex
      );
    }

    if (!materialRow && materialIdentifier) {
      materialRow = sectionRow.children.find((child: any) => {
        if (!child.isMaterialHeader) {
          return false;
        }

        const candidateValues = [
          child.materialKey,
          child.material,
          child.part,
          child.partNumber,
        ].filter((val) => val !== undefined && val !== null);

        return candidateValues.some((val) => val === materialIdentifier);
      });
    }

    if (!materialRow) return;
    materialRow.isExpanded = !materialRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  private getInitialDisplayData(): any[] {
    let hierarchicalData = this.rowData;

    // Apply grouping if active
    if (this.activeGroupFields.length > 0) {
      hierarchicalData = this.groupByService.groupHierarchicalData(
        hierarchicalData,
        this.activeGroupFields
      );
    }

    return this.flattenHierarchicalData(hierarchicalData);
  }

  private flattenHierarchicalData(data: any[]): any[] {
    const result: any[] = [];

    const processNode = (node: any) => {
      result.push(node);

      // If expanded and has children, process them
      if (node.isExpanded && node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          processNode(child);
        });
      }
    };

    data.forEach((item) => {
      processNode(item);
    });

    return result;
  }

  private checkAuthentication(): void {
    if (!environment.enableHttpBasicAuth) {
      this.loadData();
      return;
    }

    const userName = this.dataService.getUserNameFromJsp();

    if (userName) {
      this.currentUser = {
        name: userName,
        fullName: userName,
        userName: userName,
      };
    }

    const csrfSub = this.sessionService.getCsrfToken().subscribe({
      next: (csrfToken) => {
        this.loadData();
      },
      error: (error) => {
        this.showNotification(
          'This application must be accessed through FlexPLM. Please login to FlexPLM first.',
          'error'
        );
      },
    });
    this.subscriptions.push(csrfSub);
  }

  loadData(): void {
    this.isLoading = true;
    const loadSub = this.dataService.loadData().subscribe(
      (data) => {
        this.isLoading = false;
        const bomPartInfo = this.dataService.getBomPartInfo();
        if (bomPartInfo) {
          const bomPartInfoArray = Array.isArray(bomPartInfo) ? bomPartInfo : [bomPartInfo];
          if (bomPartInfoArray.length > 0 && bomPartInfoArray[0]?.bomName) {
            this.bomName = bomPartInfoArray[0].bomName;
          }
          if (bomPartInfoArray.length > 0 && bomPartInfoArray[0]?.modifyTimestamp) {
            this.rowManagementService.setLastSavedAt(new Date(bomPartInfoArray[0].modifyTimestamp));
          }
        }

        this.rowData = this.transformToHierarchicalData(data);
        this.storeOriginalValues(); // Store original values for tracking edits
        this.initializeColumns();

        if (this.gridApi) {
          this.gridApi.refreshHeader();
          this.applyHierarchicalSearch();
        } else {
          this.displayData = this.getInitialDisplayData();
        }

        if (this.gridApi) {
          setTimeout(() => {
            this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);
          }, 200);
        }
      },
      (error) => {
        this.isLoading = false;
        console.error('Error loading data:', error);
      }
    );
    this.subscriptions.push(loadSub);
  }

  initializeColumns(): void {
    const columnMapping = this.dataService.getColumnMapping();
    this.columnDefs = this.createHierarchicalColumns(columnMapping);

    this.availableGroupFields = this.columnDefs
      .filter((col) => col.field && col.field !== 'actions' && col.sortable !== false)
      .map((col) => ({
        field: col.field!,
        headerName: col.headerName || col.field!,
      }));

    if (this.gridApi && this.activeGroupFields.length > 0) {
      const groupedFields = this.activeGroupFields
        .map((g) => g.field)
        .filter((f): f is string => !!f);
      groupedFields.forEach((field) => {
        this.gridApi.setColumnsVisible([field], false);
      });
    }
  }

  createHierarchicalColumns(columnMapping: any): ColDef[] {
    const columns: ExtendedColDef[] = [];

    // Dedicated checkbox selection column (fixed width, pinned left)
    columns.push({
      headerName: '',
      field: 'checkbox',
      colId: 'checkbox',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      context: {
        excludeFromExport: true,
      },
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: (params: any) => {
        const data = params?.data;
        if (!data) return false;
        return !(
          data.isSectionHeader ||
          data.isGroupHeader ||
          data.isMaterialHeader ||
          data.isBranchHeader
        );
      },
    });

    columns.push({
      headerName: '',
      field: 'actions',
      colId: 'actions',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: true,
      context: {
        excludeFromExport: true, // Exclude this column from Excel export
      },
      cellRenderer: (params: any) => {
        if (params.data.isGroupHeader) {
          return '';
        }

        if (params.data.isExpired) {
          return `<span class="expired-indicator" title="Expired">e</span>`;
        }

        const partId = params.data.partNumber;

        if (params.data.isNewRow) {
          const newRowId = params.data.newRowId;
          return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
        }

        if ((params.data.isMaterialHeader && params.data.hasLinkedBom) || params.data.isDirectRow) {
          return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
        }

        return '';
      },
      cellStyle: {
        textAlign: 'center',
        padding: '4px',
        borderRight: '1px solid #e2e8f0',
      },
    });

    columns.push({
      headerName: 'Feature',
      field: 'bomLinkFeature',
      colId: 'bomLinkFeature',
      width: 150,
      minWidth: 150,
      pinned: 'left',
      sortable: false,
      filter: true,
      tooltipValueGetter: (params: any) => {
        if (!params.data) return null;
        if (params.data.isSectionHeader) {
          return params.data.section || null;
        }
        const featureValue = this.getFeatureValue(params.data);
        if (!featureValue) return null;
        return String(featureValue);
      },
      cellRenderer: (params: any) => {
        return this.renderHierarchicalCell(params);
      },
      cellStyle: (params: any) => {
        return this.getHierarchicalCellStyle(params);
      },
      editable: (params: any) => {
        return params.data && params.data.isNewRow && !params.data.isSectionHeader;
      },
      cellEditor: AutocompleteCellEditorComponent,
      cellEditorParams: () => ({
        placeholder: 'search BOM features...',
        isBomFeatureSearch: true,
        context: {
          dataService: this.dataService,
        },
      }),
    });

    Object.keys(columnMapping).forEach((field) => {
      if (field === 'feature' || field === 'bomLinkFeature') {
        return;
      }

      if (field === 'bomLinkCountryOfOrigin') {
        const headerName = columnMapping[field];
        columns.push({
          headerName,
          field,
          width: 180,
          minWidth: 140,
          sortable: true,
          cellRenderer: (params: any) => {
            if (
              params.data.isSectionHeader ||
              params.data.isBranchHeader ||
              params.data.isGroupHeader
            ) {
              return '';
            }
            const columnWidth = params.column?.getActualWidth() || 180;
            return this.utilService.createCellContentWithTooltip(params.value, columnWidth);
          },
          tooltipValueGetter: (params: any) => {
            if (params.value === null || params.value === undefined) return null;
            return String(params.value);
          },
          cellStyle: (params: any) => this.getDataCellStyle(params),
          editable: (params: any) => {
            return params.data && params.data.isNewRow && !params.data.isSectionHeader;
          },
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: () => ({
            placeholder: 'search countries...',
            isCountrySearch: true,
            context: {
              dataService: this.dataService,
            },
          }),
        });
        return;
      }

      const headerName = columnMapping[field];
      const columnDef: ColDef = {
        headerName: headerName,
        field: field,
        width: 150,
        minWidth: 100,
        sortable: true,
        cellRenderer: (params: any) => {
          if (
            params.data.isSectionHeader ||
            params.data.isBranchHeader ||
            params.data.isGroupHeader
          ) {
            return '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
          return this.utilService.createCellContentWithTooltip(params.value, columnWidth);
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        editable: (params: any) => {
          return params.data && params.data.isNewRow && !params.data.isSectionHeader;
        },
      };

      if (field === 'bomLinkPart' || field === 'partNumber') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          placeholder: 'search part numbers...',
          useApiSearch: true,
          isPartNumberSearch: true,
          context: {
            dataService: this.dataService,
          },
        });
      } else if (field === 'material' || field === 'materialDescription') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          placeholder: 'search materials...',
          useApiSearch: true,
          context: {
            dataService: this.dataService,
          },
        });
      } else if (field === 'qty' || field === 'quantity') {
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          max: 9999,
        };
        columnDef.editable = (params: any) => {
          if (
            params.data &&
            (params.data.isExpired ||
              params.data.isSectionHeader ||
              params.data.isGroupHeader ||
              params.data.isMaterialHeader ||
              params.data.isBranchHeader)
          ) {
            return false;
          }
          return true;
        };
      } else if (
        field === 'supplier' ||
        field === 'color' ||
        field === 'colorDescription' ||
        field === 'feature'
      ) {
        const isColorField = field === 'color' || field === 'colorDescription';

        if (field === 'supplier' || isColorField) {
          columnDef.cellEditor = AutocompleteCellEditorComponent;

          // Map color field to colorDescription (actual data field)
          if (isColorField) {
            columnDef.valueGetter = (params: any) =>
              params.data?.colorDescription || params.data?.color || '';
            columnDef.valueSetter = (params: any) => {
              if (!params.data) return false;
              params.data.color = params.newValue || '';
              params.data.colorDescription = params.newValue || '';
              return true;
            };
          }

          columnDef.cellEditorParams = (params: any) => {
            const nodeData = params.node?.data || params.data || {};
            let values: string[] = [];

            if (field === 'supplier') {
              values =
                nodeData._availableSuppliers && Array.isArray(nodeData._availableSuppliers)
                  ? nodeData._availableSuppliers
                  : this.gridCommonService.getUniqueSuppliers(this.rowData);
            } else if (isColorField) {
              values =
                nodeData._availableColors && Array.isArray(nodeData._availableColors)
                  ? nodeData._availableColors
                  : this.gridCommonService.getUniqueColors(this.rowData);
            }

            return {
              values,
              placeholder: `search ${isColorField ? 'color' : field}...`,
              context: { dataService: this.dataService },
            };
          };
        } else {
          columnDef.cellEditor = 'agTextCellEditor';
          columnDef.cellEditorParams = (params: any) => {
            return {
              values: this.gridCommonService.getUniqueFeatures(this.rowData),
              placeholder: `search ${field}...`,
            };
          };
        }
      } else if (
        field === 'bomLinkStartDate' ||
        field === 'bomLinkEndDate' ||
        field === 'startDate' ||
        field === 'endDate'
      ) {
        columnDef.filter = false;
        columnDef.cellEditor = 'agDateCellEditor';
        columnDef.editable = (params: any) => {
          if (
            params.data &&
            (params.data.isSectionHeader ||
              params.data.isGroupHeader ||
              params.data.isBranchHeader ||
              params.data.isMaterialHeader)
          ) {
            return false;
          }
          return true;
        };
        columnDef.cellRenderer = (params: any) => {
          if (
            params.data.isSectionHeader ||
            params.data.isBranchHeader ||
            params.data.isGroupHeader
          ) {
            return '';
          }
          let formattedValue = '';
          if (columnDef.valueFormatter && typeof columnDef.valueFormatter === 'function') {
            formattedValue = columnDef.valueFormatter(params) || '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
          return this.utilService.createCellContentWithTooltip(formattedValue, columnWidth);
        };
        columnDef.valueGetter = (params: any) => {
          if (!params.data) return undefined;
          const value = params.data[field];
          if (!value || value === '') return undefined;
          if (value instanceof Date) return value;
          return this.gridCommonService.parseDateString(String(value)) || undefined;
        };
        columnDef.cellEditorParams = {
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
          format: 'mm/dd/yyyy',
        };
        columnDef.valueFormatter = (params: any) => {
          if (!params.data) return '';
          const rawValue = params.data[field];
          return this.gridCommonService.formatDateToMMDDYYYY(rawValue);
        };
        columnDef.valueParser = (params: any) => {
          if (!params.newValue) return '';
          return this.gridCommonService.convertDateEditorValueToString(params.newValue);
        };
        columnDef.valueSetter = (params: any) => {
          if (!params.newValue) {
            params.data[params.colDef.field as string] = '';
            return true;
          }
          const dateStr = this.gridCommonService.convertDateEditorValueToString(params.newValue);
          params.data[params.colDef.field as string] = dateStr;
          return true;
        };
      }

      columns.push(columnDef);
    });

    const skuColumns = this.dataService.getSkuInfo().map((sku) => ({
      skuId: sku.skuId,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size1,
      destination: sku.destination,
      fieldName: `sku${sku.skuId}`,
      hasData: true,
    }));

    // Custom header component class for SKU columns
    class SkuHeaderComponent {
      private eGui!: HTMLDivElement;
      private params: any;

      init(params: any) {
        this.params = params;
        const lines = params.lines || [];
        const fullText = lines.join('\n');

        this.eGui = document.createElement('div');
        this.eGui.className = 'sku-header-wrapper';
        // Displays: SKU, Product, Manufacturer, Color, Size, and Destination (if present)
        this.eGui.setAttribute('title', fullText);

        // Prevent text selection during resize
        this.eGui.style.userSelect = 'none';
        this.eGui.style.webkitUserSelect = 'none';

        lines.forEach((line: string) => {
          const div = document.createElement('div');
          div.className = 'sku-line';
          div.textContent = line;
          // Explicitly remove any title attribute from child divs
          // This ensures only the parent wrapper shows the tooltip with all lines
          div.removeAttribute('title');
          this.eGui.appendChild(div);
        });
      }

      getGui() {
        return this.eGui;
      }

      refresh(params: any) {
        return false;
      }

      destroy() {
        // Cleanup if needed
      }
    }

    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => {
      // Individual lines for custom header
      const lines = [
        `SKU - ${sku.skuId}`,
        `Product - ${sku.product}`,
        `Manufacturer - ${sku.manufacturer}`,
        `Color - ${sku.color}`,
        `Size - ${sku.size}`,
      ];

      // Add Destination if present, otherwise stop at Size
      if (sku.destination && sku.destination.trim() !== '') {
        lines.push(`Destination - ${sku.destination}`);
      }

      // Full header text for tooltip (each value on new line, no truncation)
      const fullHeader = lines.join('\n');

      return {
        headerName: fullHeader,
        headerTooltip: fullHeader,
        headerComponent: SkuHeaderComponent,
        headerComponentParams: {
          lines: lines,
          fullText: fullHeader,
        },
        field: sku.fieldName,
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

          if (data.isSectionHeader || data.isBranchHeader || data.isGroupHeader) {
            return '';
          }

          if (data.isMaterialHeader || data.isDirectRow) {
            const value = params.value;
            if (!value && value !== 0) return '';

            // Convert value to string and preserve newlines
            const valueStr = String(value);
            // Replace newlines with <br> tags for HTML rendering
            const htmlValue = this.utilService.escapeHtml(valueStr).replace(/\n/g, '<br>');

            return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0;">${htmlValue}</div>`;
          }

          if (data.isNewRow) {
            return this.renderNewRowSkuCell(params);
          }

          // For material headers and direct rows - show value with delete icon if value exists
          if (data.isMaterialHeader || data.isDirectRow) {
            const value = params.value;
            if (!value && value !== 0) return '';

            const valueStr = String(value);
            const htmlValue = this.utilService.escapeHtml(valueStr).replace(/\n/g, '<br>');
            const skuField = params.colDef.field;
            const deleteIcon = `<button type="button" class="sku-delete-btn-existing" data-action="disconnect-sku" data-sku-field="${skuField}" title="Disconnect part from SKU">✕</button>`;

            return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0; display: flex; align-items: center;">
              <span style="flex: 1;">${htmlValue}</span>
              ${deleteIcon}
            </div>`;
          }

          // For other existing rows (sub-rows, etc.) - show value with delete icon if value exists
          const value = params.value;
          if (!value && value !== 0) return '';

          const valueStr = String(value);
          const htmlValue = this.utilService.escapeHtml(valueStr).replace(/\n/g, '<br>');
          const skuField = params.colDef.field;
          const deleteIcon = `<button type="button" class="sku-delete-btn-existing" data-action="disconnect-sku" data-sku-field="${skuField}" title="Disconnect part from SKU">✕</button>`;

          return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0; display: flex; align-items: center;">
            <span style="flex: 1;">${htmlValue}</span>
            ${deleteIcon}
          </div>`;
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        editable: false,
      };
    });

    const allColumns = [...columns, ...dynamicSkuColumns];
    return allColumns;
  }

  renderHierarchicalCell(params: any): string {
    const data = params.data;
    const level = data.level || 0;

    if (data.isGroupHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      const groupValue =
        data.groupValue !== null && data.groupValue !== undefined
          ? String(data.groupValue)
          : '(Empty)';
      const groupCount = this.groupByService.getGroupCount(data);
      const bgColor =
        data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      const borderColor =
        data.groupLevel === 0 ? '#3b82f6' : data.groupLevel === 1 ? '#10b981' : '#f59e0b';
      const hoverBg =
        data.groupLevel === 0 ? '#e0f2fe' : data.groupLevel === 1 ? '#dcfce7' : '#fde68a';
      const indentPx = (data.groupLevel || 0) * 16;

      return `
        <div
          class="hier-header hier-clickable"
          style="--bg:${bgColor};--bg-hover:${hoverBg};--border:${borderColor};--arrow-color:${borderColor};--indent:${indentPx}px;"
          onclick="window.toggleGroup('${data.groupKey}')"
        >
          <span class="hier-arrow">${arrowIcon}</span>
          <span class="hier-title">
            <span class="hier-indent"></span>${this.utilService.escapeHtml(
              data.groupHeaderName
            )}: ${this.utilService.escapeHtml(groupValue)}
          </span>
          <span class="hier-count">(${groupCount})</span>
        </div>
      `;
    }

    if (data.isSectionHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      // Use sectionDisplayName for UI display (always from API), but use section (internal name) for toggle function
      const displayName = data.sectionDisplayName; // Always from API response
      const internalName = data.section; // Keep internal name for toggle function
      return `
        <div
          class="hier-header hier-clickable section-header"
          title="${this.utilService.escapeHtml(displayName)}"
          onclick="window.toggleSection('${internalName}')"
        >
          <span class="hier-arrow">${arrowIcon}</span>
          <span class="hier-title">${this.utilService.escapeHtml(displayName)}</span>
        </div>
      `;
    }

    if (data.isMaterialHeader) {
      const materialIndex = data.materialIndex;
      const linkIcon = data.hasLinkedBom ? '🔗' : '';
      const materialIdentifier = data.materialKey;
      return `
        <div class="hier-header hier-clickable material-header" onclick="window.toggleMaterial('${
          data.section
        }', '${materialIdentifier}', ${materialIndex})">
          ${linkIcon ? `<span class="material-link-icon">${linkIcon}</span>` : ''}
          <span class="hier-title">${this.utilService.escapeHtml(
            String(data.material || data.part || data.partNumber || '')
          )}</span>
        </div>
      `;
    }

    if (data.isParentRow) {
      return `
        <div class="hier-header parent-row-header">
          <span class="hier-title"><span class="hier-indent" style="--indent:16px;"></span>${this.utilService.escapeHtml(
            String(data.part || '')
          )}</span>
        </div>
      `;
    }

    if (data.isDirectRow) {
      const linkIcon = data.hasLinkedBom ? '🔗' : '';
      const featureValue = data.bomLinkFeature || '';
      return `
        <div class="hier-row direct-row">
          ${linkIcon ? `<span class="direct-link-icon">${linkIcon}</span>` : ''}
          <span class="direct-text">${this.utilService.escapeHtml(featureValue)}</span>
        </div>
      `;
    }

    const featureValue = data.bomLinkFeature;
    const columnWidth = 220;
    return this.utilService.createCellContentWithTooltip(featureValue, columnWidth);
  }

  private getFeatureValue(row: any): string {
    return row.bomLinkFeature;
  }

  private renderGroupHeaderFullWidth(params: any): string {
    const data = params.data;
    const arrowIcon = data.isExpanded ? '▼' : '▶';
    const groupValue =
      data.groupValue !== null && data.groupValue !== undefined
        ? String(data.groupValue)
        : '(Empty)';
    // Use padding for indent instead of &nbsp; for better alignment
    const indentPixels = data.groupLevel * 20;
    const groupCount = this.groupByService.getGroupCount(data);
    const bgColor =
      data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
    const borderColor =
      data.groupLevel === 0 ? '#3b82f6' : data.groupLevel === 1 ? '#10b981' : '#f59e0b';
    const hoverBg =
      data.groupLevel === 0 ? '#e0f2fe' : data.groupLevel === 1 ? '#dcfce7' : '#fde68a';

    return `
      <div
        class="hier-header hier-clickable"
        style="height:100%;padding:0 8px;--bg:${bgColor};--bg-hover:${hoverBg};--border:${borderColor};--arrow-color:${borderColor};--indent:${indentPixels}px;"
        onclick="window.toggleGroup('${data.groupKey}')"
      >
        <span class="hier-arrow">${arrowIcon}</span>
        <span class="hier-title">
          <span class="hier-indent"></span>${this.utilService.escapeHtml(
            data.groupHeaderName
          )}: ${this.utilService.escapeHtml(groupValue)}
        </span>
        <span class="hier-count">(${groupCount})</span>
      </div>
    `;
  }

  private renderNewRowSkuCell(params: any): string {
    const rowData = params.data || {};
    const partNumber = this.getPartNumberValue(rowData);
    if (!partNumber) {
      return '';
    }

    const hasValue = params.value !== null && params.value !== undefined && params.value !== '';
    const partLabel = this.utilService.escapeHtml(partNumber);

    if (!hasValue) {
      return `
        <div class="sku-cell-action-wrapper empty">
          <button type="button" class="sku-paste-part-btn" data-action="paste-part" title="Paste Part # ${partLabel}">
             Paste Part #
          </button>
        </div>
      `;
    }

    const valueText = this.utilService.escapeHtml(String(params.value));
    return `
      <div class="sku-cell-action-wrapper filled">
        <span class="sku-cell-value" title="${valueText}">${valueText}</span>
        <button type="button" class="sku-delete-btn" data-action="clear-sku" title="Remove value">
          ✕
        </button>
      </div>
    `;
  }

  private getPartNumberValue(row: any): string {
    return row.partNumber;
  }

  getHierarchicalCellStyle(params: any): any {
    const data = params.data;
    const isSectionHeader = data?.isSectionHeader;
    const isGroupHeader = data?.isGroupHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isGroupHeader) {
      const bgColor =
        data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      return {
        backgroundColor: bgColor,
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
        fontWeight: 'bold',
      };
    }

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
    const isGroupHeader = data?.isGroupHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isGroupHeader) {
      const bgColor =
        data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      return {
        backgroundColor: bgColor,
        color: 'transparent',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
      };
    }

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

    if (this.gridApi) {
      this.gridApi.refreshHeader();
    }

    if (this.rowData && this.rowData.length > 0) {
      this.applyHierarchicalSearch();
    }
  }

  isSkuColumn(col: any): boolean {
    return col.field && (col.field.startsWith('sku') || col.field.startsWith('actions'));
  }

  toggleExpiredData(): void {
    localStorage.setItem('showExpiredData', this.showExpiredData.toString());
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      const visible = (event.target as HTMLInputElement).checked;

      if (col.isVirtual) {
        col.hide = !visible;
      } else {
        this.gridApi.setColumnsVisible([col.field], visible);
        col.hide = !visible;
      }
    } else {
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as Element;

    // Handle column visibility panel
    if (this.showColumnVisibilityPanel) {
      const panel = this.columnPanel?.nativeElement;
      const toggleBtn = this.toggleBtn?.nativeElement;
      const clickedOutside =
        panel && !panel.contains(target) && toggleBtn && !toggleBtn.contains(target);
      if (clickedOutside) {
        this.showColumnVisibilityPanel = false;
      }
    }

    // Handle group by panel
    if (this.showGroupByPanel) {
      const panel = this.groupByPanel?.nativeElement;
      const toggleBtn = this.groupByBtn?.nativeElement;
      const clickedOutside =
        panel && !panel.contains(target) && toggleBtn && !toggleBtn.contains(target);
      if (clickedOutside) {
        this.showGroupByPanel = false;
      }
    }
  }

  // Group By Methods
  toggleGroupByPanel(): void {
    this.showGroupByPanel = !this.showGroupByPanel;
  }

  addGroupField(field: GroupConfig): void {
    if (this.activeGroupFields.some((g) => g.field === field.field)) {
      return;
    }

    this.activeGroupFields.push(field);

    if (this.gridApi && field.field) {
      this.gridApi.setColumnsVisible([field.field], false);
    }

    this.applyGrouping();
  }

  removeGroupField(field: GroupConfig): void {
    this.activeGroupFields = this.activeGroupFields.filter((g) => g.field !== field.field);

    if (this.gridApi && field.field) {
      const colDef = this.columnDefs.find((col) => col.field === field.field);
      if (colDef && !colDef.hide) {
        this.gridApi.setColumnsVisible([field.field], true);
      }
    }

    this.applyGrouping();
  }

  clearAllGroups(): void {
    const groupedFields = this.activeGroupFields
      .map((g) => g.field)
      .filter((f): f is string => !!f);
    this.activeGroupFields = [];

    if (this.gridApi && groupedFields.length > 0) {
      groupedFields.forEach((field) => {
        const colDef = this.columnDefs.find((col) => col.field === field);
        if (colDef && !colDef.hide) {
          this.gridApi.setColumnsVisible([field], true);
        }
      });
    }

    this.applyGrouping();
  }

  isFieldGrouped(field: string): boolean {
    return this.activeGroupFields.some((g) => g.field === field);
  }

  toggleGroup(groupKey: string): void {
    // Toggle the expanded state
    const currentState = this.groupExpandedState.get(groupKey) ?? true;
    this.groupExpandedState.set(groupKey, !currentState);

    // Regenerate display data with updated state
    this.applyGrouping();
  }

  private applyGrouping(): void {
    // Start with the base hierarchical data (filtered if search is active)
    let hierarchicalData = this.rowData;
    if (this.searchText && this.searchText.trim() !== '') {
      hierarchicalData = this.filterHierarchicalData(this.rowData, this.searchText);
    }

    // Apply grouping if active
    if (this.activeGroupFields.length > 0) {
      // Group the hierarchical data (groups materials within sections)
      let groupedHierarchicalData = this.groupByService.groupHierarchicalData(
        hierarchicalData,
        this.activeGroupFields
      );

      // Apply saved expand/collapse state to group headers
      const applyGroupState = (items: any[]): any[] => {
        return items.map((item) => {
          const newItem = { ...item };

          if (newItem.isGroupHeader && newItem.groupKey) {
            const savedState = this.groupExpandedState.get(newItem.groupKey);
            // Default to expanded
            newItem.isExpanded = savedState !== undefined ? savedState : true;
          }

          if (newItem.children && Array.isArray(newItem.children)) {
            newItem.children = applyGroupState(newItem.children);
          }

          return newItem;
        });
      };

      groupedHierarchicalData = applyGroupState(groupedHierarchicalData);

      // Flatten the grouped hierarchical data
      this.displayData = this.flattenHierarchicalData(groupedHierarchicalData);
    } else {
      // No grouping: just flatten the base hierarchical data
      this.displayData = this.flattenHierarchicalData(hierarchicalData);
      // Clear group state when no grouping
      this.groupExpandedState.clear();
    }

    // Update grid if available
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.displayData);
      this.gridApi.refreshCells();
    }
  }

  onCellClicked(event: any): void {
    // Open Material modal ONLY via the link icon (🔗)
    // This is the single source of truth for modal opening behavior.
    const iconTarget = event.event?.target as HTMLElement | undefined;
    const linkIconEl = iconTarget?.closest?.('.material-link-icon, .direct-link-icon');
    if (linkIconEl && event.data && !event.data.isNewRow) {
      event.event?.preventDefault?.();
      event.event?.stopPropagation?.();
      this.openMaterialModal(event.data);
      return;
    }

    if (event.colDef.field === 'bomLinkPart' || event.colDef.field === 'partNumber') {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
      return;
    }

    if (event.event && event.event.target) {
      const target = event.event.target as HTMLElement;
      if (
        target.closest('.ag-header-cell-filter-button') ||
        target.closest('.ag-icon-filter') ||
        target.classList.contains('ag-header-cell-filter-button') ||
        target.classList.contains('ag-icon-filter')
      ) {
        return;
      }
    }
    const target = event.event?.target as HTMLElement;

    const pastePartButton = target?.closest('[data-action="paste-part"]');
    if (pastePartButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow
      ) {
        this.rowManagementService.pastePartNumber(event, this);
      }
      return;
    }

    const deleteButton = target?.closest('[data-action="clear-sku"]');
    if (deleteButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow
      ) {
        this.rowManagementService.clearSkuValue(event, this);
      }
      return;
    }

    const disconnectButton = target?.closest('[data-action="disconnect-sku"]');
    if (disconnectButton) {
      const skuField = disconnectButton.getAttribute('data-sku-field');
      if (skuField && event.data) {
        this.disconnectPartFromSku(event.data, skuField, event.event);
      }
      return;
    }

    if (event.data && event.data.isNewRow && !event.data.isSectionHeader) {
      const field = event.colDef.field;
      if (field && field !== 'actions' && !field.startsWith('sku')) {
        const isDateColumn =
          field === 'bomLinkStartDate' ||
          field === 'bomLinkEndDate' ||
          field === 'startDate' ||
          field === 'endDate';

        if (isDateColumn) {
          event.api.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: event.column.getId(),
            rowPinned: event.rowPinned,
          });
          setTimeout(() => {
            const editingCell = document.querySelector('.ag-cell-inline-editing') as HTMLElement;
            if (editingCell) {
              const dateInput =
                (editingCell.querySelector('input[type="date"]') as HTMLInputElement) ||
                (editingCell.querySelector('input.ag-date-input') as HTMLInputElement) ||
                (editingCell.querySelector('input') as HTMLInputElement);

              if (dateInput) {
                dateInput.focus();
                if (typeof dateInput.showPicker === 'function') {
                  dateInput.showPicker();
                } else {
                  dateInput.click();
                }
              }
            }
          }, 150);
        } else {
          event.api.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: event.column.getId(),
            rowPinned: event.rowPinned,
            keyPress: event.event?.key,
          });
        }
        return;
      }
    }

    if (event.colDef.field === 'actions') {
      const target = event.event?.target as HTMLElement;

      if (target && target.classList.contains('add-row-btn')) {
        const rowIndex = event.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          this.addRowAfter(rowIndex);
          return;
        }
      } else if (target && target.classList.contains('delete-row-btn')) {
        const partId = target.getAttribute('data-part-id');
        const newRowId = target.getAttribute('data-new-row-id');

        if (newRowId !== null) {
          this.deleteRowById(parseInt(newRowId));
          return;
        } else if (partId) {
          this.deleteRow(partId);
          return;
        }
      }
    } else if (event.colDef.field === 'material' || event.colDef.field === 'materialDescription') {
      // For new rows or when material is empty, allow editing
      if (event.data && event.data.isNewRow) {
        event.api.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: event.column.getId(),
          rowPinned: event.rowPinned,
          keyPress: event.event?.key,
        });
        return;
      }
    }
  }

  openMaterialModal(materialData: any): void {
    if (!materialData) return;

    // Extract partNumber from material data
    const partNumber = materialData.partNumber;
    const materialIdString = partNumber.trim();

    const bomSub = this.dataService.getComplexBOM(materialIdString).subscribe({
      next: (complexBOMData: any) => {
        const keyValuePairs: any[] = [];

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
          keyValuePairs.push(...complexBOMData);
        }

        const allRowData =
          keyValuePairs.length > 0
            ? { ...materialData, ...this.utilService.convertKeyValuePairsToObject(keyValuePairs) }
            : materialData;

        this.selectedMaterialData = allRowData;
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
      error: (error) => {
        this.selectedMaterialData = materialData;
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
    });
    this.subscriptions.push(bomSub);
  }

  closeMaterialModal(): void {
    this.showMaterialModal = false;
    this.selectedMaterialData = {};
    this.selectedMaterialSkuData = [];
  }

  saveChanges(): void {
    // Clear previous validation errors
    this.invalidRowIds.clear();

    // Validate new rows before saving (required fields)
    const validationResult = this.validationService.validateNewRows(this.rowData, this.displayData);
    if (!validationResult.isValid) {
      // Mark invalid rows for highlighting
      if (validationResult.invalidRows) {
        validationResult.invalidRows.forEach((invalidRow) => {
          this.invalidRowIds.add(invalidRow.rowId);
        });
      }
      this.refreshGridForValidationErrors();
      this.showNotification(validationResult.message, 'error');
      return;
    }

    // Validate SKU selection for new rows
    const skuInfo = this.dataService.getSkuInfo();
    const skuValidationResult = this.validationService.validateNewRowsSkus(
      this.rowData,
      skuInfo,
      this.displayData
    );
    if (!skuValidationResult.isValid) {
      // Mark invalid rows for highlighting
      if (skuValidationResult.invalidRows) {
        skuValidationResult.invalidRows.forEach((invalidRow) => {
          this.invalidRowIds.add(invalidRow.rowId);
        });
      }
      this.refreshGridForValidationErrors();
      this.showNotification(skuValidationResult.message, 'error');
      return;
    }

    // Validate SKU payload (use the exact same SKU builder used for save payload)
    const allNewRows = this.findAllNewRows(this.rowData, this.displayData);
    for (const newRow of allNewRows) {
      const payloadSkus = this.buildSkusArrayFromRow(newRow, skuInfo);
      const payloadValidation = this.validationService.validateSkuPayload(
        newRow,
        skuInfo,
        payloadSkus
      );
      if (!payloadValidation.isValid) {
        const rowId = newRow.newRowId || newRow.partNumber || newRow.part || 'Unknown';
        this.invalidRowIds.add(rowId);
        this.refreshGridForValidationErrors();
        this.showNotification(payloadValidation.message, 'error');
        return;
      }
    }

    // All validations passed, proceed with save
    // Set loading state
    this.isSaving = true;

    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        // Always clear loading state when response is received (success or error)
        this.isSaving = false;

        if (result.success) {
          // Clear validation errors after successful save
          this.invalidRowIds.clear();
          this.rowManagementService.showSaveMessage(result.message, 'success', this);
        } else {
          // Show error message - do NOT update grid or state
          // UI remains exactly as it was before clicking save
          this.rowManagementService.showSaveMessage(result.message, 'error', this);
        }
      })
      .catch((error) => {
        // Handle any unexpected errors
        this.isSaving = false;
        console.error('Unexpected error during save:', error);
        this.rowManagementService.showSaveMessage(
          'An unexpected error occurred while saving. Please try again.',
          'error',
          this
        );
      });
  }

  /**
   * Refresh grid cells to show validation error highlighting
   */
  private refreshGridForValidationErrors(): void {
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  /**
   * Find all new rows from hierarchical and display data
   */
  private findAllNewRows(rowData: any[], displayData?: any[]): any[] {
    const newRows: any[] = [];

    // Recursively find new rows in hierarchical data
    const findInHierarchy = (rows: any[]) => {
      rows.forEach((row) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          newRows.push(row);
        }
        if (row.children && Array.isArray(row.children)) {
          findInHierarchy(row.children);
        }
      });
    };

    findInHierarchy(rowData);

    // Also check displayData for new rows that might not be in hierarchical structure
    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((row: any) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          // Check if already in newRows
          const exists = newRows.some((nr) => nr.newRowId === row.newRowId);
          if (!exists) {
            newRows.push(row);
          }
        }
      });
    }

    return newRows;
  }

  addRowAfter(rowIndex: number): void {
    // Get the row at the current index to inherit section
    const referenceRow = this.displayData[rowIndex];
    let section: string | undefined;

    // Try to get section from reference row
    if (referenceRow) {
      section = referenceRow.section || referenceRow.parent?.data?.section;

      // If still no section, try to get from grid node
      if (!section && this.gridApi) {
        const node = this.gridApi.getDisplayedRowAtIndex(rowIndex);
        if (node) {
          // Try to find section from parent nodes
          let parentNode = node.parent;
          while (parentNode && !section) {
            if (parentNode.data && parentNode.data.section) {
              section = parentNode.data.section;
              break;
            }
            parentNode = parentNode.parent;
          }
        }
      }
    }

    const result = this.rowManagementService.addRowAfter(
      rowIndex,
      this.displayData,
      this.gridApi,
      this.dataService,
      section // Pass section to be assigned to new row
    );

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);
  }

  deleteRowById(newRowId: number): void {
    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);
  }

  deleteRow(partId: string): void {
    this.rowManagementService.deleteRow(partId, this.displayData, this.gridApi);
  }

  getLastSavedText(): string {
    const lastSavedAt = this.rowManagementService.getLastSavedAt();
    if (!lastSavedAt) {
      return 'No saves yet';
    }
    return 'Last Saved: ' + this.gridCommonService.formatLastSavedTime(lastSavedAt);
  }

  clearSaveMessage(): void {
    this.rowManagementService.clearSaveMessage(this);
  }

  private isActionsColumn(params: any): boolean {
    const fieldName = params.colDef?.field;
    const colId = params.column?.getColId() || params.colDef?.colId || fieldName;
    return fieldName === 'actions' || colId === 'actions';
  }

  onSearchTextChange(): void {
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    this.searchTextDebounceTimer = setTimeout(() => {
      this.applyHierarchicalSearch();
    }, 300);
  }

  private searchTextDebounceTimer: any;

  clearSearch(): void {
    this.searchText = '';
    this.applyHierarchicalSearch();
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
  }

  private rowMatchesSearch(row: any, searchText: string): boolean {
    if (!searchText || searchText.trim() === '') {
      return true;
    }

    const searchLower = searchText.toLowerCase().trim();

    const visibleFields = this.getVisibleColumnFields();

    const fieldsToSearch =
      visibleFields.length > 0 ? visibleFields : this.getAllSearchableFields(row);

    const excludedFields = new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus',
      'materialKey',
      '_availablePartNumbers',
      '_availableSuppliers',
      '_availableColors',
      'newRowId',
      'actions',
    ]);

    for (const key of fieldsToSearch) {
      if (excludedFields.has(key)) {
        continue;
      }

      if (!row.hasOwnProperty(key)) {
        continue;
      }

      const value = row[key];

      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && item !== undefined) {
            const itemStr = String(item).toLowerCase();
            if (itemStr.includes(searchLower)) {
              return true;
            }
          }
        }
        continue;
      }

      if (typeof value === 'object') {
        continue;
      }

      const valueStr = String(value).toLowerCase();
      if (valueStr.includes(searchLower)) {
        return true;
      }
    }

    return false;
  }

  private getVisibleColumnFields(): string[] {
    if (!this.gridApi) {
      return [];
    }

    const visibleFields: string[] = [];
    const columns = this.gridApi.getColumns();

    if (columns) {
      columns.forEach((column) => {
        const colDef = column.getColDef();
        const field = colDef.field;

        if (field && column.isVisible()) {
          const isHidden = colDef.hide === true;
          if (!isHidden) {
            visibleFields.push(field);
          }
        }
      });
    }

    return visibleFields;
  }

  private getAllSearchableFields(row: any): string[] {
    const fields: string[] = [];
    const excludedFields = new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus',
      'materialKey',
      '_availablePartNumbers',
      '_availableSuppliers',
      '_availableColors',
      'newRowId',
      'actions',
    ]);

    for (const key in row) {
      if (row.hasOwnProperty(key) && !excludedFields.has(key)) {
        fields.push(key);
      }
    }

    return fields;
  }

  private filterHierarchicalData(data: any[], searchText: string): any[] {
    if (!searchText || searchText.trim() === '') {
      return data;
    }

    const filteredData: any[] = [];

    data.forEach((sectionRow) => {
      if (!sectionRow.isSectionHeader) {
        return;
      }

      const filteredSection: any = {
        ...sectionRow,
        children: [],
      };

      if (sectionRow.children && Array.isArray(sectionRow.children)) {
        sectionRow.children.forEach((child: any) => {
          if (child.isMaterialHeader) {
            const headerMatches = this.rowMatchesSearch(child, searchText);

            let hasMatchingChildren = false;
            const filteredChildren: any[] = [];

            if (child.children && Array.isArray(child.children)) {
              child.children.forEach((subChild: any) => {
                if (this.rowMatchesSearch(subChild, searchText)) {
                  hasMatchingChildren = true;
                  filteredChildren.push(subChild);
                }
              });
            }

            if (headerMatches || hasMatchingChildren) {
              const filteredMaterialHeader: any = {
                ...child,
                children: filteredChildren,
              };
              filteredSection.children.push(filteredMaterialHeader);
            }
          } else if (child.isDirectRow) {
            if (this.rowMatchesSearch(child, searchText)) {
              filteredSection.children.push(child);
            }
          }
        });
      }

      if (filteredSection.children.length > 0) {
        filteredData.push(filteredSection);
      }
    });

    return filteredData;
  }

  public applyHierarchicalSearch(): void {
    this.applyGrouping();
  }

  private getFieldNameFromColId(colId: string): string {
    if (!colId || !this.gridApi) return colId;

    const column = this.gridApi.getColumn(colId);
    if (column) {
      const field = column.getColDef().field;
      if (field) {
        return field;
      }
    }

    return colId;
  }

  private getSortValue(row: any, field: string): any {
    if (!row || !field) return null;

    const value = row[field];

    if (value === null || value === undefined) {
      return null;
    }

    return value;
  }

  private sortHierarchicalData(data: any[], sortModel: any[]): any[] {
    if (!sortModel || sortModel.length === 0) {
      return data;
    }

    const sortedData: any[] = [];
    const sortColId = sortModel[0].colId;
    const sortField = this.getFieldNameFromColId(sortColId) || sortModel[0].field || sortColId;
    const sortDirection = sortModel[0].sort as 'asc' | 'desc';

    data.forEach((sectionRow) => {
      if (!sectionRow.isSectionHeader) {
        return;
      }

      const sortedSection: any = {
        ...sectionRow,
        children: [],
      };

      if (
        sectionRow.children &&
        Array.isArray(sectionRow.children) &&
        sectionRow.children.length > 0
      ) {
        const sortedChildren = [...sectionRow.children].sort((a: any, b: any) => {
          const aValue = this.getSortValue(a, sortField);
          const bValue = this.getSortValue(b, sortField);

          return this.utilService.compareValues(aValue, bValue, sortDirection);
        });

        sortedChildren.forEach((child: any) => {
          if (child.isMaterialHeader) {
            const sortedMaterialHeader: any = {
              ...child,
              children: [],
            };

            if (child.children && Array.isArray(child.children) && child.children.length > 0) {
              const sortedSubChildren = [...child.children].sort((a: any, b: any) => {
                const aValue = this.getSortValue(a, sortField);
                const bValue = this.getSortValue(b, sortField);
                return this.utilService.compareValues(aValue, bValue, sortDirection);
              });
              sortedMaterialHeader.children = sortedSubChildren;
            }

            sortedSection.children.push(sortedMaterialHeader);
          } else if (child.isDirectRow) {
            sortedSection.children.push(child);
          }
        });
      }

      sortedData.push(sortedSection);
    });

    return sortedData;
  }

  public applyHierarchicalSort(params: any): void {
    if (!this.gridApi) return;

    setTimeout(() => {
      const sortModel = this.gridApi.getColumnState().filter((col: any) => col.sort);

      if (!sortModel || sortModel.length === 0) {
        this.applyHierarchicalSearch();
        return;
      }

      let dataToSort = this.rowData;
      if (this.searchText && this.searchText.trim() !== '') {
        dataToSort = this.filterHierarchicalData(this.rowData, this.searchText);
      }

      if (!dataToSort || dataToSort.length === 0) {
        return;
      }

      const sortedData = this.sortHierarchicalData(dataToSort, sortModel);
      const flatData = this.flattenHierarchicalData(sortedData);
      this.displayData = flatData;

      this.gridApi.setGridOption('rowData', flatData);

      this.gridApi.applyColumnState({
        state: sortModel,
        defaultState: { sort: null },
      });
    }, 10);
  }

  private buildMbomHierarchy(data: any): any[] {
    const sections: Record<string, any[]> = {};
    // Map to store section internal name -> display name mapping
    const sectionDisplayNameMap: Record<string, string> = {};

    // Extract bom-link data from instances
    const processedItems = data.instances.map((item: any) => {
      const bomLink = item['bom-link'];
      // Prefer the true internal name if provided by API. Using display text as a key
      // can cause non-unique matches and "wrong section toggles".
      const sectionInternalName = bomLink.sectionInternalName || bomLink.section; // e.g., "enumSection001"
      const sectionDisplayName = bomLink.sectionDisplayName; // e.g., "Fuselage"

      // Build mapping of internal name to display name
      if (sectionInternalName && sectionDisplayName) {
        sectionDisplayNameMap[sectionInternalName] = sectionDisplayName;
      }

      return {
        ...bomLink,
        part: bomLink.partNumber,
        partNumber: bomLink.partNumber,
        skus: bomLink.skus,
        linkedBom: bomLink.linkedBom,
        section: sectionInternalName, // Keep internal name for payload + toggling
        sectionDisplayName: sectionDisplayName, // Store display name for UI
      };
    });

    // Group items by section (using internal name)
    processedItems.forEach((item: any, index: number) => {
      const sectionInternalName = item.section;
      if (!sections[sectionInternalName]) {
        sections[sectionInternalName] = [];
      }

      // Add every instance as a separate row - no deduplication
      const material = {
        ...item,
        materialKey: `${item.partNumber}_${index}`, // Simple unique key for identification
        allSkus: item.skus,
        part: item.partNumber,
        partNumber: item.partNumber,
        linkedBom: item.linkedBom,
        section: sectionInternalName, // Internal name for payload
        sectionDisplayName: item.sectionDisplayName, // Display name for UI
      };
      sections[sectionInternalName].push(material);
    });

    const result: Array<{ section: string; sectionDisplayName: string; materials: any[] }> = [];
    const sectionOrder: string[] = Array.isArray(data.sectionOrder) ? data.sectionOrder : [];

    const displayToInternalMap = new Map<string, string[]>();
    Object.keys(sectionDisplayNameMap).forEach((internalName) => {
      const displayName = sectionDisplayNameMap[internalName];
      if (!displayName) return;
      const current = displayToInternalMap.get(displayName) ?? [];
      if (!current.includes(internalName)) {
        current.push(internalName);
      }
      displayToInternalMap.set(displayName, current);
    });

    /**
     * Sort function: by Feature (bomLinkFeature) first, then by Part# (partNumber)
     * This ensures consistent ordering within each section
     */
    const sortMaterials = (a: any, b: any): number => {
      // Primary sort: Feature (bomLinkFeature)
      const featureA = a.bomLinkFeature.toLowerCase().trim();
      const featureB = b.bomLinkFeature.toLowerCase().trim();

      if (featureA !== featureB) {
        return featureA.localeCompare(featureB);
      }

      // Secondary sort: Part# (partNumber) when features are the same
      const partA = a.partNumber.toLowerCase().trim();
      const partB = b.partNumber.toLowerCase().trim();

      return partA.localeCompare(partB);
    };

    // Show ALL sections from sectionOrder, even if they have no materials
    sectionOrder.forEach((sectionDisplayName, idx) => {
      const internalNames = displayToInternalMap.get(sectionDisplayName) ?? [];

      // If mapping is missing, create a stable synthetic key so we don't end up with
      // multiple sections using '' and toggling the "wrong" one.
      const resolvedInternalNames =
        internalNames.length > 0 ? internalNames : [`__missing_section__${idx}`];

      resolvedInternalNames.forEach((sectionInternalName) => {
        const sectionItems = sections[sectionInternalName] || [];
        const sortedMaterials = [...sectionItems].sort(sortMaterials);
        result.push({
          section: sectionInternalName,
          sectionDisplayName: sectionDisplayName,
          materials: sortedMaterials,
        });
      });
    });

    // Also include sections that are not in sectionOrder but exist in data
    Object.keys(sections).forEach((sectionInternalName) => {
      const sectionDisplayName = sectionDisplayNameMap[sectionInternalName] || sectionInternalName;
      // Check if this section's display name is not in sectionOrder
      if (!sectionOrder.includes(sectionDisplayName)) {
        const sectionItems = sections[sectionInternalName];
        if (sectionItems && sectionItems.length > 0) {
          const sortedMaterials = [...sectionItems].sort(sortMaterials);
          const sectionObj = {
            section: sectionInternalName, // Internal name for payload
            sectionDisplayName: sectionDisplayName, // Display name from API
            materials: sortedMaterials,
          };
          result.push(sectionObj);
        }
      }
    });

    return result;
  }

  transformToHierarchicalData(data: any): any[] {
    const hierarchicalData: any[] = [];

    const sections = this.buildMbomHierarchy(data);

    sections.forEach((section: any) => {
      const sectionRow: any = {
        section: section.section,
        sectionDisplayName: section.sectionDisplayName,
        isSectionHeader: true,
        isExpanded: true, // Start expanded to show materials
        children: [],
        level: 0,
      };

      section.materials.forEach((material: any, materialIndex: number) => {
        const hasChildren = material.children && material.children.length > 0;

        if (hasChildren) {
          const materialRow: any = {
            ...material,
            section: section.section, // Internal name for payload
            sectionDisplayName: section.sectionDisplayName, // Display name for UI
            material: material.part,
            materialIndex: materialIndex,
            allSkus: material.allSkus,
            isMaterialHeader: true,
            isExpanded: true,
            children: [],
            level: 1,
            parent: sectionRow,
            hasLinkedBom:
              material.linkedBom === '1' ||
              material.linkedBom === 1 ||
              material.linkedBom === true ||
              (material.linkedBom && material.linkedBom !== ''),
          };

          this.addSkuDataToRow(materialRow, material);

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
          const directRow = {
            ...material,
            section: section.section, // Internal name for payload
            sectionDisplayName: section.sectionDisplayName, // Display name for UI
            isDirectRow: true,
            level: 1,
            parent: sectionRow,
            hasLinkedBom:
              material.linkedBom === '1' ||
              material.linkedBom === 1 ||
              material.linkedBom === true ||
              (material.linkedBom && material.linkedBom !== ''),
          };
          this.addSkuDataToRow(directRow, material);
          sectionRow.children.push(directRow);
        }
      });

      hierarchicalData.push(sectionRow);
    });

    if (hierarchicalData.length === 0) {
      return hierarchicalData;
    }

    return hierarchicalData;
  }

  /**
   * Store original values for existing rows to track changes
   * Only stores values for editable fields: startDate, endDate, quantity
   */
  private storeOriginalValues(): void {
    this.originalRowValues.clear();
    this.editedFields.clear();

    const processRow = (row: any) => {
      if (
        row.isNewRow ||
        row.isSectionHeader ||
        row.isGroupHeader ||
        row.isMaterialHeader ||
        row.isBranchHeader
      ) {
        return;
      }

      // IMPORTANT: use a stable key for original snapshot lookup (duplicates can exist)
      const rowId = row.materialKey || row.partNumber || row.part || row.newRowId;
      if (!rowId) return;

      // Store original values for editable fields
      // IMPORTANT: Store these values ONCE at load time - they represent the frozen snapshot
      const originalValues: any = {
        bomLinkStartDate: String(row.bomLinkStartDate || row.startDate || ''),
        bomLinkEndDate: String(row.bomLinkEndDate || row.endDate || ''),
        quantity: String(row.quantity || row.qty || ''),
      };

      // Store as frozen snapshot - this is the "old" value that will be sent as _old
      this.originalRowValues.set(rowId, originalValues);
      // Also store a composite fallback for duplicate part/partNumber across sections
      if (row.section && (row.partNumber || row.part)) {
        this.originalRowValues.set(`${row.section}::${row.partNumber || row.part}`, originalValues);
      }

      // Process children if any
      if (row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => processRow(child));
      }
    };

    this.rowData.forEach((sectionRow: any) => {
      if (sectionRow.children) {
        sectionRow.children.forEach((child: any) => processRow(child));
      }
    });
  }

  private addSkuDataToRow(itemRow: any, originalItem: any): void {
    const skuInfo = this.dataService.getSkuInfo();

    skuInfo.forEach((sku) => {
      const fieldName = `sku${sku.skuId}`;
      const matchingSku = originalItem.skus.find((s: any) => s.skuId === sku.skuId);
      itemRow[fieldName] = matchingSku ? matchingSku.value : '';
    });
  }

  /**
   * Build skus array from row SKU fields (reusable helper)
   * Converts individual SKU fields (sku100150, sku100152, etc.) back to skus array format
   * For new rows: Uses skuInfo structure (no isActive, value, dimensionId)
   * For edited rows: Preserves original SKU structure with value and isActive
   */
  private buildSkusArrayFromRow(row: any, skuInfo: any[]): any[] {
    const skus: any[] = [];
    const isNewRow = row.isNewRow;

    if (isNewRow) {
      const hasSkuValue = (v: any) => {
        if (v === undefined || v === null) return false;
        const s = String(v).trim();
        return s !== '';
      };

      let hasAnySkuValue = false;
      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];

        // Check if this SKU has a value
        if (hasSkuValue(skuValue)) {
          hasAnySkuValue = true;
        }
      });

      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];

        // Include SKU if it has a value, OR if no SKUs have values (include all from skuInfo)
        if (!hasAnySkuValue || hasSkuValue(skuValue)) {
          // Include: product, productId, color, destination, destinationDimensionId, manufacturer, size1, colorDimensionId, sourceDimensionId, skuId
          // Exclude: isActive, value, dimensionId (these are only for edited rows)
          skus.push({
            product: sku.product || '',
            productId: sku.productId || '',
            color: sku.color || '',
            destination: sku.destination || '',
            destinationDimensionId: sku.destinationDimensionId || '',
            manufacturer: sku.manufacturer || '',
            size1: sku.size1 || '',
            colorDimensionId: sku.colorDimensionId || '',
            sourceDimensionId: sku.sourceDimensionId || '',
            skuId: sku.skuId || '',
          });
        }
      });
    } else {
      // For existing/edited rows: Use original SKUs from row.allSkus (from API/mock.json)
      // This preserves all original properties (dimensionId, isActive, etc.)
      if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
        // Use original SKUs from API response, but update value if it changed
        row.allSkus.forEach((originalSku: any) => {
          const skuFieldName = `sku${originalSku.skuId}`;
          const currentValue = row[skuFieldName];

          // Include the original SKU with updated value if changed
          skus.push({
            ...originalSku,
            value:
              currentValue !== undefined && currentValue !== null
                ? String(currentValue)
                : originalSku.value || '',
          });
        });
      } else {
        // Fallback: Build from skuInfo if allSkus not available
        skuInfo.forEach((sku) => {
          const skuFieldName = `sku${sku.skuId}`;
          const skuValue = row[skuFieldName];

          if (skuValue !== undefined && skuValue !== null && skuValue !== '') {
            skus.push({
              skuId: sku.skuId,
              value: String(skuValue),
              product: sku.product || '',
              productId: sku.productId || '',
              manufacturer: sku.manufacturer || '',
              color: sku.color || '',
              size1: sku.size1 || '',
              destination: sku.destination || '',
              destinationDimensionId: sku.destinationDimensionId || '',
              colorDimensionId: sku.colorDimensionId || '',
              sourceDimensionId: sku.sourceDimensionId || '',
              isActive: true,
            });
          }
        });
      }
    }

    return skus;
  }

  /**
   * Transform grid row data back to API format with mixed edit/create support
   * For existing rows: Uses _old/_new suffixes for edited fields (startDate, endDate, quantity)
   * For new rows: Uses regular fields and adds childId + colorId
   */
  transformGridDataToApiFormat(rowData: any[]): any {
    // instances are extended with client-only metadata for validation (stripped before API call)
    const instances: any[] = [];
    const skuInfo = this.dataService.getSkuInfo();
    // Get bomType from API response, fallback to JSP data attribute if not available
    const bomType =
      this.dataService.getBomTypeFromResponse() || this.dataService.getBomType() || 'MBOM';

    // UI-only fields to exclude from API payload
    const uiOnlyFields = new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isParentRow',
      'isNewRow',
      'isExpanded',
      'isGroupHeader',
      'isBranchHeader',
      'level',
      'parent',
      'children',
      'materialIndex',
      'materialKey',
      'allSkus',
      'hasLinkedBom',
      'newRowId',
      'insertAfter',
      'groupKey',
      'groupValue',
      'groupLevel',
      'groupHeaderName',
      'material',
      'part',
      'sectionDisplayName', // UI-only field - payload should use 'section' (internal name)
      'bomLinkFeatureId', // UI-only field - used to store ID for payload, but bomLinkFeature field contains the actual value
    ]);

    // Process hierarchical data structure - need to iterate through children
    // rowData is hierarchical: [sectionHeader, sectionHeader, ...]
    // Each sectionHeader has children: [materialHeader/directRow, ...]
    // Each materialHeader has children: [subRow, ...]
    const processRow = (row: any) => {
      // Process children first (recursive)
      if (row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => processRow(child));
      }

      // Skip section headers, group headers, material headers, and other UI-only rows
      // Only process actual data rows: isDirectRow, isSubRow, or isNewRow
      // Note: isDirectRow and isSubRow are the actual data rows that need to be saved
      if (
        row.isSectionHeader ||
        row.isGroupHeader ||
        row.isBranchHeader ||
        row.isParentRow ||
        row.isMaterialHeader
      ) {
        return;
      }

      // Extract a stable row key. Avoid using part/partNumber alone because duplicates can exist.
      // Priority: materialKey (existing rows) > newRowId (new rows) > section::partNumber/part (fallback)
      const primaryId = row.materialKey || row.newRowId || row.partNumber || row.part;
      const compositeId =
        row.section && (row.partNumber || row.part)
          ? `${row.section}::${row.partNumber || row.part}`
          : null;
      const rowId = primaryId || compositeId;
      if (!rowId) return;

      const isNewRow = row.isNewRow;

      // For new rows, section might not be set yet - try to inherit from parent or find from context
      // For existing rows, section is required
      if (!isNewRow && !row.section) {
        return;
      }

      // For new rows without section, try to get it from parent or context
      if (isNewRow && !row.section) {
        // Try to get section from parent (if row is in hierarchical structure)
        if (row.parent && row.parent.section) {
          row.section = row.parent.section;
        } else {
          // Try to find section from the grid's rowData structure
          // This handles cases where new rows are added but not yet in hierarchical structure
          const node = this.gridApi.getRowNode(rowId.toString());
          if (node && node.parent && node.parent.data && node.parent.data.section) {
            row.section = node.parent.data.section;
          } else {
            // Last resort: try to find section from displayData
            const flatRow = this.displayData.find(
              (r: any) =>
                (r.newRowId && r.newRowId === row.newRowId) ||
                (r.partNumber && r.partNumber === row.partNumber) ||
                (r.part && r.part === row.part)
            );
            if (flatRow && flatRow.section) {
              row.section = flatRow.section;
            }
          }
        }
      }

      // If still no section, skip this row (but log for debugging)
      if (!row.section) {
        console.warn('Skipping row without section:', { rowId, isNewRow, row });
        return;
      }

      // Check if row is edited - accept any of the possible keys stored in editedRows
      const editCandidates: any[] = [
        row.materialKey,
        row.newRowId,
        row.partNumber,
        row.part,
        compositeId,
      ].filter((v) => v !== null && v !== undefined && `${v}`.trim() !== '');

      const isEdited =
        !isNewRow &&
        editCandidates.some(
          (id) =>
            this.editedRows.has(id) ||
            this.editedRows.has(`${id}`) ||
            this.editedRows.has(Number(id))
        );

      // Debug logging (can be removed in production)
      if (isNewRow || isEdited) {
        console.log('Processing row for payload:', {
          rowId,
          isNewRow,
          isEdited,
          partNumber: row.partNumber,
          part: row.part,
          newRowId: row.newRowId,
          section: row.section,
          isDirectRow: row.isDirectRow,
          isSubRow: row.isSubRow,
          editedRowsSize: this.editedRows.size,
          editedRowsHasRowId: this.editedRows.has(rowId),
        });
      }

      const bomLink: any = {};

      if (isNewRow) {
        // NEW ROW: Only include specific fields as per API requirements
        // Section is required
        if (row.section) {
          bomLink.section = row.section;
        }

        // Format as string with 2 decimal places
        // Only include quantity if it has been set by user (not default 0 or empty)
        const quantityValue =
          row.quantity !== undefined && row.quantity !== null && row.quantity !== ''
            ? row.quantity
            : row.qty !== undefined && row.qty !== null && row.qty !== ''
            ? row.qty
            : null;

        if (quantityValue !== null && quantityValue !== 0 && quantityValue !== '0') {
          const formattedQuantity = this.utilService.formatQuantityToString(quantityValue);
          // Format as string with 2 decimal places (e.g., "12.00")
          if (formattedQuantity !== '') {
            bomLink.quantity = formattedQuantity;
          }
        }

        // Priority: bomLinkFeatureId (from API id) > bomLinkFeature (display value)
        if (
          row.bomLinkFeatureId !== undefined &&
          row.bomLinkFeatureId !== null &&
          row.bomLinkFeatureId !== ''
        ) {
          bomLink.bomLinkFeature = String(row.bomLinkFeatureId);
        } else if (
          row.bomLinkFeature !== undefined &&
          row.bomLinkFeature !== null &&
          row.bomLinkFeature !== ''
        ) {
          bomLink.bomLinkFeature = String(row.bomLinkFeature);
        }

        // Dates (convert to API format YYYY/M/D)
        if (row.bomLinkStartDate) {
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(
            String(row.bomLinkStartDate)
          );
        } else if (row.startDate) {
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(String(row.startDate));
        }

        if (row.bomLinkEndDate) {
          bomLink.bomLinkEndDate = this.utilService.convertDateToApiFormat(
            String(row.bomLinkEndDate)
          );
        } else if (row.endDate) {
          bomLink.bomLinkEndDate = this.utilService.convertDateToApiFormat(String(row.endDate));
        }

        // Add childId from material-supplier.materialSupplierMaster (value after LAST colon)
        if (row.materialSupplierMasterId) {
          bomLink.childId = this.utilService.extractIdAfterLastColon(row.materialSupplierMasterId);
        } else if (row.materialSupplierVersionId) {
          // Fallback: extract from versionId if materialSupplierMasterId not available
          bomLink.childId = this.utilService.extractIdAfterLastColon(row.materialSupplierVersionId);
        }

        // Add colorId from color.iterationId (value after LAST colon)
        if (row.colorId) {
          bomLink.colorId = this.utilService.extractIdAfterLastColon(row.colorId);
        }

        // Build skus array
        bomLink.skus = this.buildSkusArrayFromRow(row, skuInfo);
      } else if (isEdited) {
        // EXISTING ROW WITH EDITS: Only include section, skus, and _old/_new fields for edited fields
        const compositeId =
          row.section && (row.partNumber || row.part)
            ? `${row.section}::${row.partNumber || row.part}`
            : null;
        const originalValues =
          this.originalRowValues.get(row.materialKey) ||
          this.originalRowValues.get(rowId) ||
          (compositeId ? this.originalRowValues.get(compositeId) : null) ||
          this.originalRowValues.get(row.partNumber) ||
          this.originalRowValues.get(row.part) ||
          {};

        // Section is required
        if (row.section) {
          bomLink.section = row.section;
        }

        // Handle editable fields with _old/_new suffixes
        // Only include fields that were actually edited (touched)
        const editedFieldsForRow = this.editedFields.get(rowId) || new Set<string>();

        // Only include startDate if it was edited
        // IMPORTANT: originalValues is the frozen snapshot from load time (never mutated)
        // row values are the current edited values from the grid
        if (editedFieldsForRow.has('bomLinkStartDate') || editedFieldsForRow.has('startDate')) {
          const currentStartDate =
            originalValues.bomLinkStartDate || originalValues.startDate || '';
          const newStartDate = row.bomLinkStartDate || row.startDate || '';
          if (currentStartDate !== newStartDate) {
            // _old = frozen original value (what backend had before)
            // _new = current edited value (what user changed it to)
            bomLink.bomLinkStartDate_old =
              this.utilService.convertDateToApiFormat(currentStartDate);
            bomLink.bomLinkStartDate_new = this.utilService.convertDateToApiFormat(newStartDate);
          }
        }

        // Only include endDate if it was edited
        if (editedFieldsForRow.has('bomLinkEndDate') || editedFieldsForRow.has('endDate')) {
          const currentEndDate = originalValues.bomLinkEndDate || originalValues.endDate || '';
          const newEndDate = row.bomLinkEndDate || row.endDate || '';
          if (currentEndDate !== newEndDate) {
            bomLink.bomLinkEndDate_old = this.utilService.convertDateToApiFormat(currentEndDate);
            bomLink.bomLinkEndDate_new = this.utilService.convertDateToApiFormat(newEndDate);
          }
        }

        if (editedFieldsForRow.has('quantity') || editedFieldsForRow.has('qty')) {
          const currentQuantity = originalValues.quantity || '';
          const newQuantity = row.quantity || row.qty || '';
          if (currentQuantity !== newQuantity) {
            // Format to string with 2 decimal places
            bomLink.quantity_old = this.utilService.formatQuantityToString(currentQuantity);

            bomLink.quantity_new = this.utilService.formatQuantityToString(newQuantity);
          }
        }

        // Build skus array - for existing rows, use allSkus directly (from API/mock.json)
        // This preserves all original properties (dimensionId, isActive, etc.)
        if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
          // Use original SKUs from API response, but update value if it changed
          bomLink.skus = row.allSkus.map((originalSku: any) => {
            const skuFieldName = `sku${originalSku.skuId}`;
            const currentValue = row[skuFieldName];

            return {
              ...originalSku,
              value:
                currentValue !== undefined && currentValue !== null
                  ? String(currentValue)
                  : originalSku.value || '',
            };
          });
        } else {
          // Fallback: Build from skuInfo if allSkus not available
          bomLink.skus = this.buildSkusArrayFromRow(row, skuInfo);
        }
      } else {
        // EXISTING ROW WITHOUT EDITS: Skip (don't include unchanged rows)
        return;
      }

      instances.push({
        'bom-link': bomLink,
      });
    };

    // Start processing from root rowData (which contains section headers)
    rowData.forEach((row) => processRow(row));

    // Also process new rows from displayData that might not be in hierarchical structure yet
    // This handles cases where new rows are added but not yet integrated into the hierarchy
    if (this.displayData && Array.isArray(this.displayData)) {
      this.displayData.forEach((flatRow: any) => {
        // Only process new rows that weren't already processed
        if (flatRow.isNewRow && flatRow.newRowId) {
          // Check if this row was already processed in the hierarchical structure
          let alreadyProcessed = false;
          const checkProcessed = (node: any) => {
            if (node.newRowId === flatRow.newRowId) {
              alreadyProcessed = true;
              return;
            }
            if (node.children && Array.isArray(node.children)) {
              node.children.forEach((child: any) => checkProcessed(child));
            }
          };
          rowData.forEach((sectionRow: any) => checkProcessed(sectionRow));

          // If not already processed, process it now
          if (!alreadyProcessed) {
            processRow(flatRow);
          }
        }
      });
    }

    // Build full payload with bomCheckIn, bomType, bomPartInfo, columns, sectionOrder, skuInfo, skuIds
    // Use API response (mock.json) as base for bomPartInfo, columns, sectionOrder, and skuInfo
    const apiData = this.dataService.getApiData();
    const bomPartInfo = this.dataService.getBomPartInfo();
    const columnsRaw = this.dataService.getColumnMapping();
    const sectionOrder = apiData?.sectionOrder || [];
    const skuInfoData = apiData?.skuInfo || { skus: skuInfo };

    // Fix columns mapping: Transform materialColor* to part* keys to match expected payload
    const columns: { [key: string]: string } = {};
    if (columnsRaw) {
      Object.keys(columnsRaw).forEach((key) => {
        // Transform materialColorThirtyCharacterDescription to partThirtyCharacterDescription
        if (key === 'materialColorThirtyCharacterDescription') {
          columns['partThirtyCharacterDescription'] = columnsRaw[key];
        }
        // Transform materialColorSixtyCharacterDescription to partSixtyCharacterDescription
        else if (key === 'materialColorSixtyCharacterDescription') {
          columns['partSixtyCharacterDescription'] = columnsRaw[key];
        }
        // Keep all other columns as-is
        else {
          columns[key] = columnsRaw[key];
        }
      });
    }

    // Collect all unique SKUs from instances for skuInfo
    const uniqueSkusMap = new Map<string, any>();

    // First, add SKUs from original API response (skuInfoData)
    if (skuInfoData.skus && Array.isArray(skuInfoData.skus)) {
      skuInfoData.skus.forEach((sku: any) => {
        if (sku.skuId) {
          uniqueSkusMap.set(sku.skuId, { ...sku });
        }
      });
    }

    // Then, add/update SKUs from instances
    instances.forEach((instance) => {
      const bomLink = instance['bom-link'];
      if (bomLink.skus && Array.isArray(bomLink.skus)) {
        bomLink.skus.forEach((sku: any) => {
          if (sku.skuId) {
            // For new rows, SKUs don't have isActive/value/dimensionId - use structure from skuInfo
            // For existing rows, SKUs have full structure - preserve it
            if (!uniqueSkusMap.has(sku.skuId)) {
              // Create a clean SKU object matching skuInfo structure (for new rows)
              uniqueSkusMap.set(sku.skuId, {
                product: sku.product || '',
                productId: sku.productId || '',
                color: sku.color || '',
                destination: sku.destination || '',
                destinationDimensionId: sku.destinationDimensionId || '',
                manufacturer: sku.manufacturer || '',
                size1: sku.size1 || '',
                colorDimensionId: sku.colorDimensionId || '',
                sourceDimensionId: sku.sourceDimensionId || '',
                skuId: sku.skuId || '',
              });
            }
          }
        });
      }
    });

    // Build final skuInfo with all unique SKUs
    const finalSkuInfo = {
      skus: Array.from(uniqueSkusMap.values()),
    };

    // Use skuIds from API response (mock.json) - this contains version IDs
    const skuIds = apiData?.skuIds || '';

    return {
      bomCheckIn: 'true',
      bomType: bomType,
      bomPartInfo: Array.isArray(bomPartInfo) ? bomPartInfo : bomPartInfo ? [bomPartInfo] : [],
      instances: instances,
      columns: columns,
      sectionOrder: sectionOrder,
      skuIds: skuIds,
      skuInfo: finalSkuInfo,
    };
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.saveMessage = message;
    this.saveMessageType = type;

    setTimeout(() => {
      this.saveMessage = '';
      this.saveMessageType = '';
    }, 5000);
  }

  onSelectionChanged(params: any): void {
    const selectedNodes = params.api.getSelectedNodes();
    this.selectedRows.clear();
    selectedNodes.forEach((node: any) => {
      if (node.data) {
        this.selectedRows.add(node.data);
      }
    });
    // Show mass edit only when more than 1 checkbox is selected
    this.massEditMode = this.selectedRows.size > 1;

    if (this.massEditMode && this.selectedRows.size > 1) {
      // Populate mass edit fields with common values if all rows have the same value
      this.populateMassEditFields(Array.from(this.selectedRows));
    } else {
      this.massEditStartDate = '';
      this.massEditEndDate = '';
      this.massEditQuantity = null;
    }
  }

  private populateMassEditFields(selectedRows: any[]): void {
    if (selectedRows.length === 0) return;

    // Helper to get date field value
    const getDateValue = (row: any, fields: string[]): string => {
      for (const field of fields) {
        if (row[field]) return row[field];
      }
      return '';
    };

    // Helper to get quantity value
    const getQtyValue = (row: any, fields: string[]): number | null => {
      for (const field of fields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          return Number(row[field]);
        }
      }
      return null;
    };

    // Check if all rows have the same start date
    const startDateFields = ['bomLinkStartDate', 'startDate'];
    const firstStartDate = getDateValue(selectedRows[0], startDateFields);
    const allSameStartDate = selectedRows.every((row) => {
      const rowDate = getDateValue(row, startDateFields);
      return rowDate === firstStartDate;
    });
    if (allSameStartDate && firstStartDate) {
      // Convert MM/DD/YYYY to YYYY-MM-DD for date input
      const date = this.gridCommonService.parseDateString(firstStartDate);
      this.massEditStartDate = date ? this.convertToDateInputFormat(date) : '';
    } else {
      this.massEditStartDate = '';
    }

    // Check if all rows have the same end date
    const endDateFields = ['bomLinkEndDate', 'endDate'];
    const firstEndDate = getDateValue(selectedRows[0], endDateFields);
    const allSameEndDate = selectedRows.every((row) => {
      const rowDate = getDateValue(row, endDateFields);
      return rowDate === firstEndDate;
    });
    if (allSameEndDate && firstEndDate) {
      const date = this.gridCommonService.parseDateString(firstEndDate);
      this.massEditEndDate = date ? this.convertToDateInputFormat(date) : '';
    } else {
      this.massEditEndDate = '';
    }

    // Check if all rows have the same quantity
    const qtyFields = ['qty', 'quantity'];
    const firstQty = getQtyValue(selectedRows[0], qtyFields);
    const allSameQty = selectedRows.every((row) => {
      const rowQty = getQtyValue(row, qtyFields);
      return rowQty === firstQty;
    });
    if (allSameQty && firstQty !== null) {
      this.massEditQuantity = firstQty;
    } else {
      this.massEditQuantity = null;
    }
  }

  private convertToDateInputFormat(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  applyMassEdit(): void {
    if (this.selectedRows.size === 0 || !this.gridApi) return;
    if (this.isMassEditing) return;

    // Let the UI paint "Applying..." state before heavy grid updates
    this.isMassEditing = true;
    setTimeout(() => {
      try {
        this.applyMassEditInternal();
      } finally {
        this.isMassEditing = false;
      }
    }, 0);
  }

  private applyMassEditInternal(): void {
    if (this.selectedRows.size === 0 || !this.gridApi) return;

    const selectedNodes = this.gridApi.getSelectedNodes();
    const nodesToUpdate: any[] = [];
    const columnsToUpdate: Set<string> = new Set();

    // Get all column definitions to find the correct field names
    const columnFields = new Set<string>();

    // First, try to get from grid API columns
    const allColumns = this.gridApi.getColumns();
    if (allColumns) {
      allColumns.forEach((col: any) => {
        if (col.getColId && col.getColId() !== 'checkbox' && col.getColId() !== 'actions') {
          columnFields.add(col.getColId());
        }
      });
    }

    // Also check columnDefs as fallback (includes hidden columns)
    if (this.columnDefs && this.columnDefs.length > 0) {
      this.columnDefs.forEach((colDef: any) => {
        if (colDef.field && colDef.field !== 'checkbox' && colDef.field !== 'actions') {
          columnFields.add(colDef.field);
        }
        if (colDef.colId && colDef.colId !== 'checkbox' && colDef.colId !== 'actions') {
          columnFields.add(colDef.colId);
        }
      });
    }

    selectedNodes.forEach((node: any) => {
      if (!node.data) return;

      const rowData = node.data;
      let hasChanges = false;

      // Update start date - check which field exists in the grid
      if (this.massEditStartDate) {
        const formattedDate = this.gridCommonService.formatDateToMMDDYYYY(this.massEditStartDate);
        const startDateFields = ['bomLinkStartDate', 'startDate'];

        // Find which field exists in the column definitions
        let targetField: string | null = null;
        for (const field of startDateFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }

        // If no column found, try to use the field that exists in rowData
        if (!targetField) {
          for (const field of startDateFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }

        // Default to startDate if nothing found
        if (!targetField) {
          targetField = 'startDate';
        }

        // Update the value
        const currentValue = rowData[targetField] || '';
        if (currentValue !== formattedDate) {
          rowData[targetField] = formattedDate;
          node.setDataValue(targetField, formattedDate);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      // Update end date - check which field exists in the grid
      if (this.massEditEndDate) {
        const formattedDate = this.gridCommonService.formatDateToMMDDYYYY(this.massEditEndDate);
        const endDateFields = ['bomLinkEndDate', 'endDate'];

        // Find which field exists in the column definitions
        let targetField: string | null = null;
        for (const field of endDateFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }

        // If no column found, try to use the field that exists in rowData
        if (!targetField) {
          for (const field of endDateFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }

        // Default to endDate if nothing found
        if (!targetField) {
          targetField = 'endDate';
        }

        // Update the value
        const currentValue = rowData[targetField] || '';
        if (currentValue !== formattedDate) {
          rowData[targetField] = formattedDate;
          node.setDataValue(targetField, formattedDate);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      // Update quantity - check which field exists in the grid
      if (this.massEditQuantity !== null && this.massEditQuantity !== undefined) {
        const qtyFields = ['qty', 'quantity'];

        // Find which field exists in the column definitions
        let targetField: string | null = null;
        for (const field of qtyFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }

        // If no column found, try to use the field that exists in rowData
        if (!targetField) {
          for (const field of qtyFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }

        // Default to qty if nothing found
        if (!targetField) {
          targetField = 'qty';
        }

        // Update the value
        const currentValue = rowData[targetField];
        if (currentValue !== this.massEditQuantity) {
          rowData[targetField] = this.massEditQuantity;
          node.setDataValue(targetField, this.massEditQuantity);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        // Mark row as edited (use stable keys to avoid misses/duplicates)
        const primaryKey =
          rowData.materialKey || rowData.newRowId || rowData.partNumber || rowData.part;
        const compositeKey =
          rowData.section && (rowData.partNumber || rowData.part)
            ? `${rowData.section}::${rowData.partNumber || rowData.part}`
            : null;
        const editKey = primaryKey || compositeKey;

        if (editKey) {
          this.editedRows.add(editKey);
          if (compositeKey) this.editedRows.add(compositeKey);

          // Track which specific fields were edited (required for save payload)
          if (!this.editedFields.has(editKey)) {
            this.editedFields.set(editKey, new Set<string>());
          }
          const editedFieldsForRow = this.editedFields.get(editKey)!;

          // Track start date field
          if (this.massEditStartDate) {
            const startDateFields = ['bomLinkStartDate', 'startDate'];
            for (const field of startDateFields) {
              if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                editedFieldsForRow.add(field);
                break;
              }
            }
          }

          // Track end date field
          if (this.massEditEndDate) {
            const endDateFields = ['bomLinkEndDate', 'endDate'];
            for (const field of endDateFields) {
              if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                editedFieldsForRow.add(field);
                break;
              }
            }
          }

          // Track quantity field
          if (this.massEditQuantity !== null && this.massEditQuantity !== undefined) {
            const qtyFields = ['qty', 'quantity'];
            for (const field of qtyFields) {
              if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                editedFieldsForRow.add(field);
                break;
              }
            }
          }
        }
        nodesToUpdate.push(node);
      }
    });

    // Refresh only affected cells to avoid flicker
    if (nodesToUpdate.length > 0 && columnsToUpdate.size > 0) {
      this.gridApi.refreshCells({
        rowNodes: nodesToUpdate,
        columns: Array.from(columnsToUpdate),
        force: true,
      });
      // Force row re-render so getRowClass runs and yellow highlight appears for all updated rows
      this.gridApi.redrawRows({ rowNodes: nodesToUpdate });
    }

    // Clear mass edit fields after applying
    this.massEditStartDate = '';
    this.massEditEndDate = '';
    this.massEditQuantity = null;
  }

  exportToExcel(): void {
    if (!this.gridApi) return;

    // Define columns to exclude from export
    // You can add field names here or set excludeFromExport: true in column definitions
    const excludedFields = ['actions']; // Add more field names to exclude here

    this.utilService
      .exportGridToExcel(this.gridApi, {
        excludedFields,
        fileName: `BOM_Composer_Export_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: 'BOM Export',
        excludeHeaderRows: true,
      })
      .then(() => {
        this.showNotification('Excel file exported successfully', 'success');
      })
      .catch((error) => {
        console.error('Error exporting to Excel:', error);
        this.showNotification('Error exporting to Excel. Please try again.', 'error');
      });
  }

  disconnectPartFromSku(rowData: any, skuField: string, event?: any): void {
    if (!rowData || !skuField || !this.gridApi) return;

    // Prevent event propagation to avoid flicker
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const rowId = rowData.newRowId || rowData.partNumber;

    // Find the node and update it without full refresh
    let targetNode: any = null;
    this.gridApi.forEachNode((node: any) => {
      if (node.data === rowData) {
        targetNode = node;
      }
    });

    if (targetNode) {
      // Clear the SKU value
      targetNode.setDataValue(skuField, '');
      rowData[skuField] = '';

      // Mark row as edited
      if (rowId) {
        this.editedRows.add(rowId);
      }

      // Use refreshCells with specific column to avoid flicker
      const column = this.gridApi.getColumn(skuField);
      if (column) {
        this.gridApi.refreshCells({
          rowNodes: [targetNode],
          columns: [skuField],
          force: true,
        });
      }
    }
  }

  closeMassEditMode(): void {
    this.massEditMode = false;
    if (this.gridApi) {
      this.gridApi.deselectAll();
    }
    this.selectedRows.clear();
    this.massEditStartDate = '';
    this.massEditEndDate = '';
    this.massEditQuantity = null;
  }

  bulkDisconnectFromSkus(): void {
    if (this.selectedRows.size === 0 || !this.gridApi) {
      return;
    }

    const selectedNodes = this.gridApi.getSelectedNodes();
    const skuInfo = this.dataService.getSkuInfo();
    const nodesToUpdate: any[] = [];
    const skuFields: string[] = skuInfo.map((sku) => `sku${sku.skuId}`);

    selectedNodes.forEach((node: any) => {
      if (!node.data) return;

      const rowData = node.data;
      let hasChanges = false;

      skuFields.forEach((skuField) => {
        if (rowData[skuField] && rowData[skuField] !== '') {
          rowData[skuField] = '';
          node.setDataValue(skuField, '');
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const rowId = rowData.newRowId || rowData.partNumber;
        if (rowId) {
          this.editedRows.add(rowId);
        }
        nodesToUpdate.push(node);
      }
    });

    // Refresh only affected cells to avoid flicker
    if (nodesToUpdate.length > 0 && skuFields.length > 0) {
      this.gridApi.refreshCells({
        rowNodes: nodesToUpdate,
        columns: skuFields,
        force: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    if (this.gridApi && (this.gridApi as any)._hoverSyncCleanup) {
      (this.gridApi as any)._hoverSyncCleanup();
    }

    delete (window as any).toggleSection;
    delete (window as any).toggleMaterial;
    delete (window as any).toggleGroup;
  }
}
