import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
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
import { PayloadTransformService } from './services/payload-transform.service';
import { ColumnHeaderPinComponent } from './column-header-pin/column-header-pin.component';
import { environment } from '../environments/environment';
import { ExtendedColDef } from './services/util.service';

type SkuFilterOption = 'all' | 'hdEditable' | 'hdNonEditable' | 'nonHdSource';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy, AfterViewInit {
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
  public bomNamesDisplay: string = '';
  public bomNamesFull: string = '';
  public bomType: string = '';
  public selectedSkuFilter: SkuFilterOption = 'all';
  public skuFilterOptions: Array<{ label: string; value: SkuFilterOption }> = [
    { label: 'All', value: 'all' },
    { label: 'HD source - editable', value: 'hdEditable' },
    { label: 'HD source', value: 'hdNonEditable' },
    { label: 'Non HD source', value: 'nonHdSource' },
  ];
  private lastSkuFilter: SkuFilterOption = 'all';
  public isLoading: boolean = true;
  public constraintsData: any = null;
  public isSaving: boolean = false; // Track save operation state
  public isMassEditing: boolean = false; // Track mass edit operation state
  public originalRowValues = new Map<string | number, any>(); // Store original values for existing rows
  private editedFields = new Map<string | number, Set<string>>(); // Track which specific fields were edited per row
  public invalidRowIds = new Set<string | number>(); // Track rows with validation errors for highlighting
  public selectedRows = new Set<any>();
  public massEditMode = false;
  public massEditStartDate: string = '';
  public massEditEndDate: string = '';
  public massEditQuantity: number | null = null;

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
    private utilService: UtilService,
    private payloadTransformService: PayloadTransformService
  ) {
    this.gridOptions.context = {
      dataService: this.dataService,
    };

    // Always default to OFF on landing/refresh
    this.showExpiredData = false;
    // Clear any previously persisted state so refresh doesn't flip it back on
    try {
      localStorage.removeItem('showExpiredData');
    } catch {
      // ignore
    }

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
    this.lastSkuFilter = this.selectedSkuFilter;
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
      // Always preserve section headers - they must always be shown
      if (node.isSectionHeader) {
        result.push(node);
        // Process children if section is expanded (default to expanded)
        const isExpanded = node.isExpanded !== undefined ? node.isExpanded : true;
        if (isExpanded && node.children && Array.isArray(node.children)) {
          node.children.forEach((child: any) => {
            processNode(child);
          });
        }
        return;
      }

      // Filter out rows with empty partNumber (only for data rows, not headers)
      const isDataRow = node.isDirectRow || node.isSubRow;
      const partNumber = node.partNumber || node.part || '';
      const hasPartNumber = partNumber && String(partNumber).trim() !== '';

      // Only add the node if:
      // 1. It's a header (group, material, branch), OR
      // 2. It's a data row WITH a valid partNumber
      if (!isDataRow || hasPartNumber) {
        result.push(node);
      }

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

    const bomType = this.dataService.getBomType();
    if (bomType) {
      this.bomType = bomType;
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
          if (bomPartInfoArray.length > 0) {
            const names = bomPartInfoArray
              .map((info: any) => info.bomName)
              .filter((name: string) => name);

            this.bomNamesFull = names.join(', ');

            if (names.length > 3) {
              this.bomNamesDisplay = names.slice(0, 3).join(', ') + '...';
            } else {
              this.bomNamesDisplay = this.bomNamesFull;
            }
            // For backward compatibility if needed, though view uses new props
            this.bomName = this.bomNamesDisplay;
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
        const errorMessage = this.dataService.getLoadErrorMessage(error);
        this.showNotification(errorMessage, 'error');
      }
    );
    this.subscriptions.push(loadSub);
  }

  ngAfterViewInit(): void {
    // Only fetch constraints if we are in SBOM mode
    if (this.dataService.getBomType() !== 'SBOM') {
      return;
    }

    // Fetch constraints after view initialization
    this.dataService.fetchIncludeInSpecSheetConstraints().subscribe({
      next: (constraints) => {
        this.constraintsData = constraints;
      },
      error: (err) => console.error('Error fetching IncludeInSpecSheet constraints', err),
    });
  }

  initializeColumns(): void {
    const columnMapping = this.dataService.getColumnMapping();
    this.columnDefs = this.createHierarchicalColumns(columnMapping);

    this.availableGroupFields = this.columnDefs
      .filter((col) => {
        // Include columns that have a field, exclude actions column
        // Allow bomLinkFeature for grouping even if sortable is false
        return (
          col.field &&
          col.field !== 'actions' &&
          (col.sortable !== false || col.field === 'bomLinkFeature')
        );
      })
      .map((col) => ({
        field: col.field!,
        headerName: col.headerName || col.field!,
      }));

    if (this.gridApi && this.activeGroupFields.length > 0) {
      const groupedFields = this.activeGroupFields
        .map((g) => g.field)
        .filter((f): f is string => !!f);
      groupedFields.forEach((field) => {
        // See `addGroupField()`: don't hide the hierarchy column.
        if (field !== 'bomLinkFeature') {
          this.gridApi.setColumnsVisible([field], false);
        }
      });
    }
  }

  private getFilteredSkuInfo(): any[] {
    const skuInfo = this.dataService.getSkuInfo();
    if (!this.isMbomMode()) {
      return skuInfo;
    }

    switch (this.selectedSkuFilter) {
      case 'hdEditable':
        return skuInfo.filter((sku) => sku.isHDSource === true && sku.isEditable === true);
      case 'hdNonEditable':
        return skuInfo.filter((sku) => sku.isHDSource === true);
      case 'nonHdSource':
        return skuInfo.filter((sku) => sku.isHDSource === false);
      case 'all':
      default:
        return skuInfo;
    }
  }

  public onSkuFilterChange(): void {
    if (!this.isMbomMode()) {
      return;
    }

    const previousFilter = this.lastSkuFilter;
    if (this.selectedSkuFilter === 'hdEditable') {
      const filtered = this.getFilteredSkuInfo();
      if (filtered.length === 0) {
        this.showNotification('No HD editable SKUs found. Editing is disabled.', 'info');
        this.selectedSkuFilter = previousFilter;
      }
    }

    this.initializeColumns();

    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
      this.gridApi.refreshHeader();
      this.applyHierarchicalSearch();

      if (this.isSkuFilterReadOnly()) {
        this.gridApi.deselectAll();
        this.selectedRows.clear();
        this.massEditMode = false;
      }
    }

    this.lastSkuFilter = this.selectedSkuFilter;
  }

  /**
   * Get all columns for visibility panel - dynamically from columnDefs
   */
  get allColumns(): any[] {
    return this.columnDefs.filter((col) => {
      const field = col.field || (col as any).colId;
      return field !== 'checkbox';
    });
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
      headerCheckboxSelection: () => {
        // Hide header checkbox in SBOM read-only mode
        return this.isAddRowEnabled();
      },
      headerCheckboxSelectionFilteredOnly: true,
      checkboxSelection: (params: any) => {
        // Hide all checkboxes in SBOM read-only mode
        if (!this.isAddRowEnabled()) {
          return false;
        }

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

        // Check if section has any VISIBLE children (MaterialHeaders or DirectRows with content)
        const hasVisibleChildren = () => {
          if (
            !params.data.children ||
            !Array.isArray(params.data.children) ||
            params.data.children.length === 0
          ) {
            return false;
          }
          return params.data.children.some((child: any) => {
            if (child.isMaterialHeader) return true;
            // Direct rows are only visible if they have a part number/part
            const val = child.partNumber || child.part;
            return val && String(val).trim() !== '';
          });
        };

        if (
          (params.data.isMaterialHeader && params.data.hasLinkedBom) ||
          params.data.isDirectRow ||
          (params.data.isSectionHeader && !hasVisibleChildren())
        ) {
          // Check if add row is enabled for this BOM type
          if (this.isAddRowEnabled()) {
            return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
          }
          return ''; // Add button hidden for SBOM non-service-team members
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
        if (!params.data || params.data.isSectionHeader) {
          return false;
        }

        // New rows - check restriction
        if (params.data.isNewRow) {
          return this.isFieldEditableForNewRow('bomLinkFeature');
        }

        // Existing rows - check SBOM restrictions
        return this.isFieldEditableInSbom('bomLinkFeature');
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
            const cellStyle = this.getDataCellStyle(params);
            const textColor = cellStyle?.color || undefined;
            return this.utilService.createCellContentWithTooltip(
              params.value,
              columnWidth,
              textColor
            );
          },
          tooltipValueGetter: (params: any) => {
            if (params.value === null || params.value === undefined) return null;
            return String(params.value);
          },
          cellStyle: (params: any) => this.getDataCellStyle(params),
          editable: (params: any) => {
            if (!params.data || params.data.isSectionHeader) {
              return false;
            }

            // New rows - check restriction
            if (params.data.isNewRow) {
              return this.isFieldEditableForNewRow(field);
            }

            // Existing rows - check SBOM restrictions
            return this.isFieldEditableInSbom('bomLinkCountryOfOrigin');
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

      if (field === 'bomLinkSpecSheetExtra') {
        const headerName = columnMapping[field];
        columns.push({
          headerName,
          field,
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
            const columnWidth = params.column?.getActualWidth() || 150;
            const cellStyle = this.getDataCellStyle(params);
            const textColor = cellStyle?.color || undefined;
            return this.utilService.createCellContentWithTooltip(
              params.value,
              columnWidth,
              textColor
            );
          },
          tooltipValueGetter: (params: any) => {
            if (params.value === null || params.value === undefined) return null;
            return String(params.value);
          },
          cellStyle: (params: any) => this.getDataCellStyle(params),
          editable: (params: any) => {
            if (!params.data || params.data.isSectionHeader) {
              return false;
            }
            // New rows - check restriction
            if (params.data.isNewRow) {
              return this.isFieldEditableForNewRow(field);
            }
            // Existing rows - check SBOM restrictions
            return this.isFieldEditableInSbom('bomLinkSpecSheetExtra');
          },
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: {
            values: ['', 'Yes', 'No'],
            placeholder: 'Select...',
            filterFunction: (searchValue: string, options: string[]) => {
              if (!searchValue) return options;
              const lower = searchValue.toLowerCase();
              return options.filter((opt) => opt.toLowerCase().includes(lower));
            },
          },
        });
        return;
      }

      if (field === 'bomLinkIncludeInSpecSheet') {
        const headerName = columnMapping[field];
        columns.push({
          headerName,
          field,
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
            const columnWidth = params.column?.getActualWidth() || 150;
            const cellStyle = this.getDataCellStyle(params);
            const textColor = cellStyle?.color || undefined;
            return this.utilService.createCellContentWithTooltip(
              params.value,
              columnWidth,
              textColor
            );
          },
          tooltipValueGetter: (params: any) => {
            if (params.value === null || params.value === undefined) return null;
            return String(params.value);
          },
          cellStyle: (params: any) => this.getDataCellStyle(params),
          editable: (params: any) => {
            if (!params.data || params.data.isSectionHeader) {
              return false;
            }
            // New rows - check restriction
            if (params.data.isNewRow) {
              return this.isFieldEditableForNewRow(field);
            }
            // Existing rows - check SBOM restrictions
            return this.isFieldEditableInSbom('bomLinkIncludeInSpecSheet');
          },
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: (params: any) => ({
            values: ['', ...this.dataService.getIncludeInSpecSheetOptions(this.constraintsData)],
            placeholder: 'Select...',
            filterFunction: (searchValue: string, options: string[]) => {
              if (!searchValue) return options;
              const lower = searchValue.toLowerCase();
              return options.filter((opt) => opt.toLowerCase().includes(lower));
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
        resizable: true, // Added resizable property
        hide: field === 'ptcbomPartMarkUpDisplayName', // Hide this column by default
        cellRenderer: (params: any) => {
          if (
            params.data.isSectionHeader ||
            params.data.isBranchHeader ||
            params.data.isGroupHeader
          ) {
            return '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;

          // Get the computed cell style to extract color
          const cellStyle = this.getDataCellStyle(params);
          const textColor = cellStyle?.color || undefined;

          return this.utilService.createCellContentWithTooltip(
            params.value,
            columnWidth,
            textColor
          );
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        editable: (params: any) => {
          if (!params.data || params.data.isSectionHeader) {
            return false;
          }

          // New rows - check restriction
          if (params.data.isNewRow) {
            return this.isFieldEditableForNewRow(field);
          }

          // Existing rows - check SBOM restrictions
          return this.isFieldEditableInSbom(field);
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
      } else if (field === 'quantity') {
        // Simple & strict numeric editor (blocks alphabets automatically)
        // Allow decimals via step:'any'
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          step: 'any',
          // max: 100, // add if you want a hard upper bound
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

          // New rows - check restriction
          if (params.data && params.data.isNewRow) {
            return this.isFieldEditableForNewRow(field);
          }

          // Existing rows - check SBOM restrictions
          return this.isFieldEditableInSbom(field);
        };
        columnDef.valueSetter = (params: any) => {
          if (!params.data || !params.colDef?.field) return false;
          // Keep stored value consistent with existing code paths (string in data)
          const v = params.newValue;
          params.data[params.colDef.field] =
            v === null || v === undefined || v === '' ? '' : String(v);
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
      } else if (field === 'bomLinkStartDate' || field === 'bomLinkEndDate') {
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

          // New rows - check restriction
          if (params.data && params.data.isNewRow) {
            return this.isFieldEditableForNewRow(field);
          }

          // Existing rows - check SBOM restrictions
          return this.isFieldEditableInSbom(field);
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
          const cellStyle = this.getDataCellStyle(params);
          const textColor = cellStyle?.color || undefined;
          return this.utilService.createCellContentWithTooltip(
            formattedValue,
            columnWidth,
            textColor
          );
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

    const skuColumns = this.getFilteredSkuInfo().map((sku) => ({
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
        // Add skuId to column definition for validation highlighting
        skuId: sku.skuId,
        headerClass: index === 0 ? 'first-sku-column-header' : '',
        cellClass: index === 0 ? 'first-sku-column-cell' : '',

        cellRenderer: (params: any) => {
          const data = params.data || {};
          const canDisconnect = !this.isSkuFilterReadOnly();

          if (data.isSectionHeader || data.isBranchHeader || data.isGroupHeader) {
            return '';
          }

          // Check if this row has a part for the reference SKU
          const textColor = this.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

          if (data.isMaterialHeader || data.isDirectRow) {
            const value = params.value;
            if (!value && value !== 0) return '';

            // Convert value to string and preserve newlines
            const valueStr = String(value);
            // Replace newlines with <br> tags for HTML rendering
            const htmlValue = this.utilService.escapeHtml(valueStr).replace(/\n/g, '<br>');

            return `<div style="${textColor}white-space: pre-line; line-height: 1.5; padding: 4px 0;">${htmlValue}</div>`;
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
            const deleteIcon = canDisconnect
              ? `<button type="button" class="sku-delete-btn-existing" data-action="disconnect-sku" data-sku-field="${skuField}" title="Disconnect part from SKU">✕</button>`
              : '';

            return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0; display: flex; align-items: center;">
              <span style="${textColor}flex: 1;">${htmlValue}</span>
              ${deleteIcon}
            </div>`;
          }

          // For other existing rows (sub-rows, etc.) - show value with delete icon if value exists
          const value = params.value;
          if (!value && value !== 0) return '';

          const valueStr = String(value);
          const htmlValue = this.utilService.escapeHtml(valueStr).replace(/\n/g, '<br>');
          const skuField = params.colDef.field;
          const deleteIcon = canDisconnect
            ? `<button type="button" class="sku-delete-btn-existing" data-action="disconnect-sku" data-sku-field="${skuField}" title="Disconnect part from SKU">✕</button>`
            : '';

          return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0; display: flex; align-items: center;">
            <span style="${textColor}flex: 1;">${htmlValue}</span>
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
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      const materialIdentifier = data.materialKey || '';
      const materialIndex = data.materialIndex !== undefined ? data.materialIndex : '';
      const linkIcon = data.hasLinkedBom ? '🔗' : '';

      // Check if this row has a part for the reference SKU
      const textColor = this.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

      return `
        <div class="hier-header hier-clickable material-header" onclick="window.toggleMaterial('${
          data.section
        }', '${materialIdentifier}', ${materialIndex})">
          ${linkIcon ? `<span class="material-link-icon">${linkIcon}</span>` : ''}
          <span class="hier-title" style="${textColor}">${this.utilService.escapeHtml(
        String(data.material || data.part || data.partNumber || '')
      )}</span>
        </div>
      `;
    }

    if (data.isParentRow) {
      // Check if this row has a part for the reference SKU
      const textColor = this.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

      return `
        <div class="hier-header parent-row-header">
          <span class="hier-title" style="${textColor}"><span class="hier-indent" style="--indent:16px;"></span>${this.utilService.escapeHtml(
        String(data.part || '')
      )}</span>
        </div>
      `;
    }

    if (data.isDirectRow) {
      const linkIcon = data.hasLinkedBom ? '🔗' : '';
      const featureValue = data.bomLinkFeature || '';

      // Check if this row has a part for the reference SKU
      const textColor = this.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

      return `
        <div class="hier-row direct-row">
          ${linkIcon ? `<span class="direct-link-icon">${linkIcon}</span>` : ''}
          <span class="direct-text" style="${textColor}">${this.utilService.escapeHtml(
        featureValue
      )}</span>
        </div>
      `;
    }

    const featureValue = data.bomLinkFeature;
    const columnWidth = 220;

    // Check if this row has a part for the reference SKU - for red highlighting
    const textColor = this.getHighlightColor(data);

    return this.utilService.createCellContentWithTooltip(featureValue, columnWidth, textColor);
  }

  /**
   * Check if a row should be highlighted (has part for reference SKU)
   */
  private shouldHighlightRow(data: any): boolean {
    if (!data) return false;
    const refSkuId = this.dataService.getRefSkuId();
    const refSkuFieldName = `sku${refSkuId}`;
    return !!(data[refSkuFieldName] && String(data[refSkuFieldName]).trim() !== '');
  }

  /**
   * Get text color for highlighted rows
   */
  private getHighlightColor(data: any): string | undefined {
    return this.shouldHighlightRow(data) ? '#ff0000' : undefined;
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

  /**
   * Check if we're in SBOM mode
   */
  private isSbomMode(): boolean {
    const bomType = this.dataService.getBomType();
    return bomType === 'SBOM';
  }

  public isMbomMode(): boolean {
    const bomType = this.dataService.getBomType();
    return bomType === 'MBOM';
  }

  public isSkuFilterReadOnly(): boolean {
    return this.isMbomMode() && this.selectedSkuFilter !== 'hdEditable';
  }

  /**
   * Check if current user is a service team member
   */
  private isUserServiceTeamMember(): boolean {
    return this.dataService.isServiceTeamMember();
  }

  /**
   * Check if field is editable for existing rows based on BOM type
   * MBOM: Only bomLinkStartDate, bomLinkEndDate, and quantity are editable
   * SBOM: Only SpecSheet fields are editable (and only for service team members)
   */
  private isFieldEditableInSbom(field: string): boolean {
    if (this.isSkuFilterReadOnly()) {
      return false;
    }

    if (!this.isSbomMode()) {
      // MBOM mode - only date and quantity fields are editable for existing rows
      const mbomEditableFields = ['bomLinkStartDate', 'bomLinkEndDate', 'quantity'];
      return mbomEditableFields.includes(field);
    }

    // SBOM mode
    if (!this.isUserServiceTeamMember()) {
      return false; // SBOM + not service team = no editing
    }

    // SBOM + service team = only SpecSheet fields editable
    const isEditable = field === 'bomLinkSpecSheetExtra' || field === 'bomLinkIncludeInSpecSheet';
    return isEditable;
  }

  /**
   * Check if field is editable for NEW rows
   * Explicitly allows only specified fields
   */
  private isFieldEditableForNewRow(field: string): boolean {
    if (this.isSkuFilterReadOnly()) {
      return false;
    }

    const editableFields = [
      'bomLinkFeature',
      'materialDescription',
      'material',
      'supplier',
      'colorDescription',
      'color',
      'partNumber',
      'bomLinkStartDate',
      'bomLinkEndDate',
      'quantity',
      'bomLinkSpecSheetExtra',
      'bomLinkIncludeInSpecSheet',
      'bomLinkCountryOfOrigin',
    ];
    return editableFields.includes(field);
  }

  /**
   * Check if add row functionality should be enabled
   */
  private isAddRowEnabled(): boolean {
    if (this.isSkuFilterReadOnly()) {
      return false;
    }

    if (!this.isSbomMode()) {
      return true; // MBOM - add row enabled
    }

    // SBOM - only enabled for service team members
    return this.isUserServiceTeamMember();
  }

  private renderNewRowSkuCell(params: any): string {
    const rowData = params.data || {};
    const partNumber = this.getPartNumberValue(rowData);
    if (!partNumber) {
      return '';
    }

    const hasValue = params.value !== null && params.value !== undefined && params.value !== '';
    const partLabel = this.utilService.escapeHtml(partNumber);
    const isReadOnly = this.isSkuFilterReadOnly();

    if (isReadOnly) {
      if (!hasValue) {
        return '';
      }
      const valueText = this.utilService.escapeHtml(String(params.value));
      return `
        <div class="sku-cell-action-wrapper filled">
          <span class="sku-cell-value" title="${valueText}">${valueText}</span>
        </div>
      `;
    }

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

    // Check if this row has a part for the reference SKU
    const hasPartForRefSku = this.shouldHighlightRow(data);

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
        color: hasPartForRefSku ? '#ff0000' : 'inherit',
      };
    }

    if (data.isParentRow) {
      return {
        backgroundColor: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
        color: hasPartForRefSku ? '#ff0000' : '#1e40af',
      };
    }

    if (data.isDirectRow) {
      return {
        backgroundColor: '#ffffff',
        borderLeft: '2px solid #d1d5db',
        fontWeight: '400',
        color: hasPartForRefSku ? '#ff0000' : '#374151',
      };
    }

    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
    };
  }

  getDataCellStyle(params: any): any {
    const data = params.data;
    const style: any = { borderRight: '1px solid #e2e8f0' };

    if (!data) return style;

    const hasPartForRefSku = this.shouldHighlightRow(data);

    const isActionsColumn = params.colDef.field === 'actions';

    if (data.isGroupHeader) {
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

    if (data.isSectionHeader) {
      return {
        backgroundColor: '#fef3c7',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
        fontWeight: 'bold',
        color: '#92400e',
      };
    }

    if (data.isMaterialHeader) {
      return {
        backgroundColor: 'transparent',
        borderLeft: '4px solid #10b981',
        fontWeight: '600',
        color: hasPartForRefSku ? '#ff0000' : 'inherit',
      };
    }

    if (data.isParentRow) {
      return {
        backgroundColor: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
        color: hasPartForRefSku ? '#ff0000' : '#1e40af',
      };
    }

    if (data.isDirectRow) {
      return {
        ...style,
        backgroundColor: '#ffffff',
        borderLeft: '2px solid #d1d5db',
        fontWeight: '400',
        color: hasPartForRefSku ? '#ff0000' : '#374151',
      };
    }

    // Default return
    return {
      ...style,
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
      color: hasPartForRefSku ? '#ff0000' : '#374151',
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
    // Do not persist across refresh; just apply for the current session.
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

    // IMPORTANT:
    // The `bomLinkFeature` column is the hierarchical "tree" column in this app.
    // It renders Section / Material / Group header labels via `renderHierarchicalCell`.
    // If we auto-hide it when grouping by Feature, Section headers appear to "disappear".
    if (this.gridApi && field.field && field.field !== 'bomLinkFeature') {
      this.gridApi.setColumnsVisible([field.field], false);
    }

    this.applyGrouping();
  }

  removeGroupField(field: GroupConfig): void {
    this.activeGroupFields = this.activeGroupFields.filter((g) => g.field !== field.field);

    if (this.gridApi && field.field) {
      const colDef = this.columnDefs.find((col) => col.field === field.field);
      // Only re-show columns we auto-hid (never auto-hide `bomLinkFeature`)
      if (field.field !== 'bomLinkFeature' && colDef && !colDef.hide) {
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
        // Never auto-hide `bomLinkFeature`, so never force-show it here either.
        if (field !== 'bomLinkFeature' && colDef && !colDef.hide) {
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
    // Preserve new rows before rebuilding
    const newRows: any[] = [];
    if (this.displayData && Array.isArray(this.displayData)) {
      this.displayData.forEach((row) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          newRows.push(row);
        }
      });
    }

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

      // Apply saved expand/collapse state to group headers and ensure sections are expanded
      const applyGroupState = (items: any[]): any[] => {
        return items.map((item) => {
          const newItem = { ...item };

          // Ensure section headers are expanded by default
          if (newItem.isSectionHeader) {
            newItem.isExpanded = newItem.isExpanded !== undefined ? newItem.isExpanded : true;
          }

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

    // Add new rows back
    newRows.forEach((newRow) => {
      const insertAfter = newRow.insertAfter;
      if (insertAfter !== undefined && insertAfter >= 0 && insertAfter < this.displayData.length) {
        this.displayData.splice(insertAfter + 1, 0, newRow);
      }
    });

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
    const isReadOnlySkuFilter = this.isSkuFilterReadOnly();

    const pastePartButton = target?.closest('[data-action="paste-part"]');
    if (pastePartButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (isReadOnlySkuFilter) {
        return;
      }
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
      if (isReadOnlySkuFilter) {
        return;
      }
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
      if (isReadOnlySkuFilter) {
        return;
      }
      const skuField = disconnectButton.getAttribute('data-sku-field');
      if (skuField && event.data) {
        this.disconnectPartFromSku(event.data, skuField, event.event);
      }
      return;
    }

    // Handle cell clicks for editable cells (both new rows and existing rows)
    if (event.data && !event.data.isSectionHeader) {
      const field = event.colDef.field;
      if (field && field !== 'actions' && !field.startsWith('sku')) {
        const isDateColumn = field === 'bomLinkStartDate' || field === 'bomLinkEndDate';
        const isSpecSheetField =
          field === 'bomLinkSpecSheetExtra' || field === 'bomLinkIncludeInSpecSheet';
        const isAutocompleteField =
          isSpecSheetField || field === 'materialDescription' || field === 'material';

        // Check if this field is editable for this row
        const isEditable =
          !isReadOnlySkuFilter && (event.data.isNewRow || this.isFieldEditableInSbom(field));

        if (isDateColumn && isEditable) {
          // Store current cell info to ensure we target the correct one
          const targetRowIndex = event.rowIndex;
          const targetColKey = event.column.getId();
          const gridContainer = event.api.getGridElement() as HTMLElement;

          // Validate grid container exists
          if (!gridContainer) {
            // Fallback to normal editing if grid container not found
            event.api.startEditingCell({
              rowIndex: targetRowIndex,
              colKey: targetColKey,
              rowPinned: event.rowPinned,
            });
            return;
          }

          // Auto-open date picker for date columns
          event.api.startEditingCell({
            rowIndex: targetRowIndex,
            colKey: targetColKey,
            rowPinned: event.rowPinned,
          });

          // Use MutationObserver to wait for the input to appear, then open picker
          let observer: MutationObserver | null = null;
          const timeouts: ReturnType<typeof setTimeout>[] = [];
          let isCleanedUp = false; // Prevent multiple cleanup calls

          const openDatePicker = (): boolean => {
            // Prevent execution if already cleaned up
            if (isCleanedUp) return false;

            // Only look for editing cell within the grid container
            const editingCell = gridContainer.querySelector(
              '.ag-cell-inline-editing'
            ) as HTMLElement;
            if (editingCell) {
              const dateInput =
                (editingCell.querySelector('input[type="date"]') as HTMLInputElement) ||
                (editingCell.querySelector('input.ag-date-input') as HTMLInputElement) ||
                (editingCell.querySelector('input') as HTMLInputElement);

              if (dateInput && dateInput.type === 'date') {
                try {
                  dateInput.focus();
                  // Use requestAnimationFrame to ensure DOM is ready
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      if (!isCleanedUp && dateInput.type === 'date') {
                        if (typeof dateInput.showPicker === 'function') {
                          try {
                            dateInput.showPicker();
                          } catch (e) {
                            dateInput.click();
                          }
                        } else {
                          dateInput.click();
                        }
                      }
                    });
                  });
                  return true;
                } catch (e) {
                  console.warn('Error opening date picker:', e);
                  return false;
                }
              }
            }
            return false;
          };

          // Cleanup function - idempotent, safe to call multiple times
          const cleanup = () => {
            if (isCleanedUp) return; // Already cleaned up
            isCleanedUp = true;

            if (observer) {
              try {
                observer.disconnect();
              } catch (e) {
                console.warn('Error disconnecting observer:', e);
              }
              observer = null;
            }

            timeouts.forEach((t) => {
              try {
                clearTimeout(t);
              } catch (e) {
                console.warn('Error clearing timeout:', e);
              }
            });
            timeouts.length = 0;
          };

          // Try immediately
          if (openDatePicker()) {
            cleanup();
            return;
          }

          // Use MutationObserver to watch for the input to appear - only observe grid container
          try {
            observer = new MutationObserver(() => {
              if (!isCleanedUp && openDatePicker()) {
                cleanup();
              }
            });

            observer.observe(gridContainer, {
              childList: true,
              subtree: true,
            });
          } catch (e) {
            console.warn('Error setting up MutationObserver:', e);
            cleanup();
          }

          // Also try with progressive timeouts as fallback
          [100, 200, 300].forEach((delay) => {
            const timeout = setTimeout(() => {
              if (!isCleanedUp && openDatePicker()) {
                cleanup();
              }
            }, delay);
            timeouts.push(timeout);
          });

          // Final cleanup timeout - ensure cleanup always happens
          const cleanupTimeout = setTimeout(() => {
            cleanup();
          }, 1000);
          timeouts.push(cleanupTimeout);
        } else if (isAutocompleteField && isEditable && event.data.isNewRow) {
          // Handle specsheet fields in new rows - wait for autocomplete editor to be ready
          const targetRowIndex = event.rowIndex;
          const targetColKey = event.column.getId();
          const gridContainer = event.api.getGridElement() as HTMLElement;

          // Validate grid container exists
          if (!gridContainer) {
            // Fallback to normal editing if grid container not found
            event.api.startEditingCell({
              rowIndex: targetRowIndex,
              colKey: targetColKey,
              rowPinned: event.rowPinned,
            });
            return;
          }

          event.api.startEditingCell({
            rowIndex: targetRowIndex,
            colKey: targetColKey,
            rowPinned: event.rowPinned,
          });

          // Wait for autocomplete editor to be ready and focus it
          let observer: MutationObserver | null = null;
          const timeouts: ReturnType<typeof setTimeout>[] = [];
          let isCleanedUp = false; // Prevent multiple cleanup calls

          const focusAutocompleteEditor = (): boolean => {
            // Prevent execution if already cleaned up
            if (isCleanedUp) return false;

            const editingCell = gridContainer.querySelector(
              '.ag-cell-inline-editing'
            ) as HTMLElement;
            if (editingCell) {
              // Find the autocomplete input
              const autocompleteInput = editingCell.querySelector('input') as HTMLInputElement;
              if (autocompleteInput) {
                try {
                  autocompleteInput.focus();
                  // Trigger click to open dropdown if it's an autocomplete
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      if (!isCleanedUp && autocompleteInput) {
                        autocompleteInput.click();
                      }
                    });
                  });
                  return true;
                } catch (e) {
                  console.warn('Error focusing autocomplete editor:', e);
                  return false;
                }
              }
            }
            return false;
          };

          // Cleanup function - idempotent, safe to call multiple times
          const cleanup = () => {
            if (isCleanedUp) return; // Already cleaned up
            isCleanedUp = true;

            if (observer) {
              try {
                observer.disconnect();
              } catch (e) {
                console.warn('Error disconnecting observer:', e);
              }
              observer = null;
            }

            timeouts.forEach((t) => {
              try {
                clearTimeout(t);
              } catch (e) {
                console.warn('Error clearing timeout:', e);
              }
            });
            timeouts.length = 0;
          };

          // Try immediately
          if (focusAutocompleteEditor()) {
            cleanup();
            return;
          }

          // Use MutationObserver to watch for the editor to appear
          try {
            observer = new MutationObserver(() => {
              if (!isCleanedUp && focusAutocompleteEditor()) {
                cleanup();
              }
            });

            observer.observe(gridContainer, {
              childList: true,
              subtree: true,
            });
          } catch (e) {
            console.warn('Error setting up MutationObserver:', e);
            cleanup();
          }

          // Also try with progressive timeouts as fallback
          [100, 200, 300].forEach((delay) => {
            const timeout = setTimeout(() => {
              if (!isCleanedUp && focusAutocompleteEditor()) {
                cleanup();
              }
            }, delay);
            timeouts.push(timeout);
          });

          // Final cleanup timeout - ensure cleanup always happens
          const cleanupTimeout = setTimeout(() => {
            cleanup();
          }, 1000);
          timeouts.push(cleanupTimeout);
        } else if (isEditable) {
          // For new rows, start editing other fields normally
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

    // Only open modal if linkedBom is "1"
    if (materialData.linkedBom !== '1' && materialData.linkedBom !== 1) {
      // no-op: material has no linked BOM, modal should not open
      return;
    }

    // Use childId for the API call (this is the material master ID)
    const childId = materialData.childId;

    if (!childId) {
      console.warn('No childId found in material data');
      return;
    }

    const bomSub = this.dataService.getComplexBOM(childId).subscribe({
      next: (bomData: any) => {
        // bomData should have format: { materialMasterId: "...", instances: [...], columns: {...} }

        this.selectedMaterialData = {
          ...materialData,
          ...bomData, // Merge API response including instances and columns
        };

        // Keep existing logic for SKU data if needed, or maybe the new response handles everything
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
      error: (error: any) => {
        console.error('Failed to fetch material BOM', error);
        // Fallback or just show what we have
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
    if (this.isSkuFilterReadOnly()) {
      this.showNotification('Save is disabled in view-only mode.', 'info');
      return;
    }

    // Clear previous validation errors
    this.invalidRowIds.clear();

    // Validate new rows before saving (required fields)
    let requiredFields = this.validationService.getDefaultRequiredFields();

    // Only require SBOM-specific fields if we are in SBOM mode
    if (this.dataService.getBomType() !== 'SBOM') {
      requiredFields = requiredFields.filter(
        (field) =>
          !field.keys.includes('bomLinkSpecSheetExtra') &&
          !field.keys.includes('bomLinkIncludeInSpecSheet')
      );
    }

    const validationResult = this.validationService.validateNewRows(
      this.rowData,
      this.displayData,
      requiredFields
    );
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
    const skuInfo = this.getFilteredSkuInfo();
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

    // Validate for duplicate Feature+Part+SKU combinations
    // Pass original API data to check ALL rows including hidden ones (filtered out from UI)
    const apiData = this.dataService.getApiData();
    const duplicateValidation = this.validationService.validateDuplicateFeatureSkuCombination(
      this.rowData,
      this.displayData,
      skuInfo,
      apiData || undefined
    );
    if (!duplicateValidation.isValid) {
      // Mark invalid rows for highlighting
      if (duplicateValidation.invalidRows) {
        duplicateValidation.invalidRows.forEach((invalidRow) => {
          this.invalidRowIds.add(invalidRow.rowId);
        });
      }
      this.refreshGridForValidationErrors();
      this.showNotification(duplicateValidation.message, 'error');
      return;
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
    let sectionDisplayName: string | undefined;

    // Try to get section and sectionDisplayName from reference row
    if (referenceRow) {
      section = referenceRow.section || referenceRow.parent?.data?.section;
      sectionDisplayName =
        referenceRow.sectionDisplayName || referenceRow.parent?.data?.sectionDisplayName;

      // If still no section, try to get from grid node
      if (!section && this.gridApi) {
        const node = this.gridApi.getDisplayedRowAtIndex(rowIndex);
        if (node) {
          // Try to find section from parent nodes
          let parentNode = node.parent;
          while (parentNode && (!section || !sectionDisplayName)) {
            if (parentNode.data) {
              if (!section && parentNode.data.section) {
                section = parentNode.data.section;
              }
              if (!sectionDisplayName && parentNode.data.sectionDisplayName) {
                sectionDisplayName = parentNode.data.sectionDisplayName;
              }
              if (section && sectionDisplayName) {
                break;
              }
            }
            parentNode = parentNode.parent;
          }
        }
      }
    }

    // Calculate actual insert index (skipping existing new rows)
    let insertIndex = rowIndex;
    while (
      insertIndex + 1 < this.displayData.length &&
      this.displayData[insertIndex + 1].isNewRow
    ) {
      insertIndex++;
    }

    const result = this.rowManagementService.addRowAfter(
      insertIndex,
      this.displayData,
      this.gridApi,
      this.dataService,
      section, // Pass section to be assigned to new row
      sectionDisplayName // Pass sectionDisplayName to be assigned to new row
    );

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);
  }

  deleteRowById(newRowId: number): void {
    // Find the row to get all possible IDs (matching trackFieldChange logic)
    const rowToDelete = this.displayData.find((row) => row.newRowId === newRowId);

    if (rowToDelete) {
      // Generate all possible ID variants (matching getRowClass and trackFieldChange)
      const getIdVariants = (id: any): Set<string | number> => {
        const variants = new Set<string | number>();
        if (id === null || id === undefined || `${id}`.trim() === '') return variants;
        variants.add(id);
        variants.add(`${id}`);
        const numId = Number(id);
        if (!isNaN(numId)) variants.add(numId);
        return variants;
      };

      const baseIds = new Set([
        rowToDelete.materialKey,
        rowToDelete.newRowId,
        rowToDelete.partNumber,
        rowToDelete.part,
        rowToDelete.section && (rowToDelete.partNumber || rowToDelete.part)
          ? `${rowToDelete.section}::${rowToDelete.partNumber || rowToDelete.part}`
          : null,
      ]);
      baseIds.delete(null);
      baseIds.delete(undefined);
      baseIds.delete('');

      // Remove all ID variants from editedRows
      baseIds.forEach((id) => {
        getIdVariants(id).forEach((variant) => {
          this.editedRows.delete(variant);
        });
      });

      // Remove from editedFields
      if (this.editedFields) {
        baseIds.forEach((id) => {
          this.editedFields.delete(id);
        });
      }
    } else {
      // Fallback: remove common variants of newRowId
      this.editedRows.delete(newRowId);
      this.editedRows.delete(`${newRowId}`);
      if (this.editedFields) {
        this.editedFields.delete(newRowId);
        this.editedFields.delete(`${newRowId}`);
      }
    }

    // Stop editing to avoid AG Grid keeping stale editor state
    try {
      this.gridApi?.stopEditing?.();
    } catch {
      // ignore
    }

    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);

    // Refresh Save button state & row classes immediately
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  deleteRow(partId: string): void {
    // Best-effort cleanup if this delete path is used for a new row id stored as string
    const maybeId = Number(partId);
    if (!isNaN(maybeId)) {
      this.editedRows.delete(maybeId);
      if (this.editedFields) {
        this.editedFields.delete(maybeId);
      }
    }

    try {
      this.gridApi?.stopEditing?.();
    } catch {
      // ignore
    }

    this.rowManagementService.deleteRow(partId, this.displayData, this.gridApi);

    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
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
    const processedItems = data.instances
      .filter((item: any) => {
        const bomLink = item['bom-link'];
        if (!bomLink) return false;

        const hasPartNumber = bomLink.partNumber && String(bomLink.partNumber).trim() !== '';

        // Markup check only applies to MBOM
        let isCorrectMarkup = true;
        if (this.dataService.getBomType() === 'MBOM') {
          isCorrectMarkup = bomLink.ptcbomPartMarkUp === 'enumMBOM001';
        }

        return hasPartNumber && isCorrectMarkup;
      })
      .map((item: any) => {
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
          quantity: bomLink.quantity ? Number(bomLink.quantity).toFixed(1) : bomLink.quantity, // Format quantity
          qty: bomLink.qty ? Number(bomLink.qty).toFixed(1) : bomLink.qty, // Format qty
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
        bomLinkSpecSheetExtra: String(row.bomLinkSpecSheetExtra || ''),
        bomLinkIncludeInSpecSheet: String(row.bomLinkIncludeInSpecSheet || ''),
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
   * Converts individual SKU fields (sku100150, sku100152 etc.) back to skus array format
   * For new rows: Checks if same bomLinkFeature exists in same section, and reuses full SKU from that row
   * Otherwise: Uses skuInfo structure (no isActive, value, dimensionId)
   * For edited rows: Preserves original SKU structure with value and isActive
   */
  private buildSkusArrayFromRow(row: any, skuInfo: any[]): any[] {
    return this.payloadTransformService.buildSkusArrayFromRow(row, skuInfo, this.rowData);
  }
  /**
   * Transform grid row data back to API format with mixed edit/create support
   * For existing rows: Uses _old/_new suffixes for edited fields (startDate, endDate, quantity)
   * For new rows: Uses regular fields and adds childId + colorId
   */
  transformGridDataToApiFormat(rowData: any[], skuInfoOverride?: any[]): any {
    const skuInfo = skuInfoOverride || this.getFilteredSkuInfo();
    return this.payloadTransformService.transformGridDataToApiFormat(
      rowData,
      this.displayData,
      this.editedRows,
      this.editedFields,
      this.originalRowValues,
      this.constraintsData,
      skuInfo
    );
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
    const startDateFields = ['bomLinkStartDate'];
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
    const endDateFields = ['bomLinkEndDate'];
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
    const qtyFields = ['quantity'];
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
        const startDateFields = ['bomLinkStartDate'];

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
          targetField = 'bomLinkStartDate';
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
        const endDateFields = ['bomLinkEndDate'];

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
          targetField = 'bomLinkEndDate';
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
        const qtyFields = ['quantity'];

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
          targetField = 'quantity';
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
            const startDateFields = ['bomLinkStartDate'];
            for (const field of startDateFields) {
              if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                editedFieldsForRow.add(field);
                break;
              }
            }
          }

          // Track end date field
          if (this.massEditEndDate) {
            const endDateFields = ['bomLinkEndDate'];
            for (const field of endDateFields) {
              if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                editedFieldsForRow.add(field);
                break;
              }
            }
          }

          // Track quantity field
          if (this.massEditQuantity !== null && this.massEditQuantity !== undefined) {
            const qtyFields = ['quantity'];
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
    if (this.isSkuFilterReadOnly()) return;

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
    if (this.isSkuFilterReadOnly()) {
      return;
    }
    if (this.selectedRows.size === 0 || !this.gridApi) {
      return;
    }

    const selectedNodes = this.gridApi.getSelectedNodes();
    const skuInfo = this.getFilteredSkuInfo();
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
