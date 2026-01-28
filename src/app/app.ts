import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { AutocompleteCellEditorComponent } from './components/autocomplete-cell-editor/autocomplete-cell-editor.component';
import { IconComponent } from './components/icon/icon.component';
import { ColumnHeaderPinComponent } from './components/column-header-pin/column-header-pin.component';
import { PartModalComponent } from './components/part-modal/part-modal.component';
import { PartsEditModalComponent } from './components/parts-edit-modal/parts-edit-modal.component';
import { DataService } from './services/data.service';
import { GridConfigService, GroupConfig } from './services/grid-config.service';
import { GridService } from './services/grid.service';
import { RowManagementService } from './services/row-management.service';
import { SessionService } from './services/session.service';
import { ValidationService } from './services/validation.service';
import { UtilService, ExtendedColDef } from './services/util.service';
import { PayloadTransformService } from './services/payload-transform.service';
import { MassEditService, MassEditState } from './services/mass-edit.service';
import { environment } from '../environments/environment';
import type {
  SkuFilterOption,
  MbomSkuFilterOption,
  SbomSkuFilterOption,
} from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    IconComponent,
    PartModalComponent,
    PartsEditModalComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy, AfterViewInit {
  private gridApi!: GridApi;
  private subscriptions: Subscription[] = [];
  public showColumnVisibilityPanel = false;
  public showGroupByPanel = false;
  public draggedColumn: ExtendedColDef | null = null;
  public draggedColumnIndex: number = -1;
  public dragOverIndex: number = -1;
  public panelColumnOrder: ExtendedColDef[] = []; // Track column order in panel
  private autoScrollInterval: any = null;
  private readonly AUTO_SCROLL_THRESHOLD = 50; // pixels from edge
  private readonly AUTO_SCROLL_SPEED = 10; // pixels per interval

  @ViewChild('columnPanel') columnPanel!: ElementRef;
  @ViewChild('toggleBtn') toggleBtn!: ElementRef;
  @ViewChild('groupByPanel') groupByPanel!: ElementRef;
  @ViewChild('groupByBtn') groupByBtn!: ElementRef;
  @ViewChild('skuFilterDropdown') skuFilterDropdown!: ElementRef;
  @ViewChild('columnCheckboxes') columnCheckboxes!: ElementRef;
  @ViewChild('actionDropdown') actionDropdown!: ElementRef;
  public showExpiredData = false;
  public showMaterialModal = false;
  public selectedMaterialData: any = {};
  public selectedMaterialSkuData: any[] = [];
  public showPartsEditModal = false;
  public partsEditModalMaterialColorIds: string[] = [];
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
  public showSkuFilterDropdown = false;
  public showActionDropdown = false;
  public get mbomSkuFilterOptions(): Array<{ label: string; value: MbomSkuFilterOption }> {
    return this.dataService.getMbomSkuFilterOptions();
  }

  public get sbomSkuFilterOptions(): Array<{ label: string; value: SbomSkuFilterOption }> {
    return this.dataService.getSbomSkuFilterOptions();
  }

  public get skuFilterOptions(): Array<{ label: string; value: SkuFilterOption }> {
    return this.isMbomMode() ? this.mbomSkuFilterOptions : this.sbomSkuFilterOptions;
  }
  public isLoading: boolean = true;
  public constraintsData: any = null;
  public isSaving: boolean = false;
  public isMassEditing: boolean = false;
  public readonly originalRowValues = new Map<string | number, any>();
  private readonly editedFields = new Map<string | number, Set<string>>();
  public invalidRowIds = new Set<string | number>();
  public selectedRows = new Set<any>();
  public massEditMode = false;
  public massEditStartDate: string = '';
  public massEditEndDate: string = '';
  public massEditQuantity: number | null = null;
  public massEditIncludeInSpecSheet: string = '';

  public gridOptions: GridOptions = {} as GridOptions;

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];

  public rowData: any[] = [];
  public displayData: any[] = []; // Flattened data for display
  public activeGroupFields: GroupConfig[] = []; // Currently active group fields
  public availableGroupFields: GroupConfig[] = []; // Available columns for grouping
  private readonly groupExpandedState: Map<string, boolean> = new Map(); // Track group expand/collapse state

  constructor(
    public dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly gridService: GridService,
    private readonly rowManagementService: RowManagementService,
    private readonly sessionService: SessionService,
    private readonly validationService: ValidationService,
    private readonly utilService: UtilService,
    private readonly payloadTransformService: PayloadTransformService,
    private readonly massEditService: MassEditService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.gridOptions.context = {
      dataService: this.dataService,
    };

    this.showExpiredData = false;
    try {
      localStorage.removeItem('showExpiredData');
    } catch {}

    this.defaultColDef = {
      ...this.gridConfigService.getDefaultColDef(),
      headerComponent: ColumnHeaderPinComponent,
    };
    const commonOptions = this.gridConfigService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      components: commonOptions.components
        ? {
            ...commonOptions.components,
            AutocompleteCellEditorComponent,
            ColumnHeaderPinComponent,
          }
        : {
            AutocompleteCellEditorComponent,
            ColumnHeaderPinComponent,
          },
      context: commonOptions.context
        ? {
            ...commonOptions.context,
            dataService: this.dataService,
          }
        : {
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
    (globalThis as any).toggleSection = (section: string) => {
      this.toggleSection(section);
    };
    (globalThis as any).toggleMaterial = (
      section: string,
      materialIdentifier: string,
      materialIndex?: number,
    ) => {
      this.toggleMaterial(section, materialIdentifier, materialIndex);
    };
    (globalThis as any).toggleGroup = (groupKey: string) => {
      this.toggleGroup(groupKey);
    };
  }

  public toggleSection(section: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader,
    );
    if (!sectionRow) return;

    sectionRow.isExpanded = !sectionRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  public toggleMaterial(
    section: string,
    materialIdentifier?: string,
    materialIndex?: number,
  ): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader,
    );
    if (!sectionRow) return;

    let materialRow;

    if (materialIndex !== undefined) {
      materialRow = sectionRow.children.find(
        (child: any) => child.isMaterialHeader && child.materialIndex === materialIndex,
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

        return candidateValues.includes(materialIdentifier);
      });
    }

    if (!materialRow) return;
    materialRow.isExpanded = !materialRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  private getInitialDisplayData(): any[] {
    let hierarchicalData = this.rowData;

    if (this.activeGroupFields.length > 0) {
      hierarchicalData = this.gridConfigService.groupHierarchicalData(
        hierarchicalData,
        this.activeGroupFields,
      );
    }

    return this.flattenHierarchicalData(hierarchicalData);
  }

  private flattenHierarchicalData(data: any[]): any[] {
    return this.gridService.flattenHierarchicalData(data, {
      getBomType: () => this.dataService.getBomType() || 'SBOM',
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      hasSkuInExistingResponse: (row, ids) => this.hasSkuInExistingResponse(row, ids),
      rowMatchesSearch: (row, text) => this.rowMatchesSearch(row, text),
    });
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
          'error',
        );
      },
    });
    this.subscriptions.push(csrfSub);
  }

  loadData(): void {
    this.isLoading = true;
    const loadSub = this.dataService.loadData().subscribe({
      next: (data) => {
        this.isLoading = false;
        const bomPartInfo = this.dataService.getBomPartInfo();
        if (bomPartInfo) {
          const bomPartInfoArray = Array.isArray(bomPartInfo) ? bomPartInfo : [bomPartInfo];
          if (bomPartInfoArray.length > 0) {
            const names = bomPartInfoArray.map((info: any) => info.bomOwner).filter(Boolean);

            this.bomNamesFull = names.join(', ');

            if (names.length > 3) {
              this.bomNamesDisplay = names.slice(0, 3).join(', ') + '...';
            } else {
              this.bomNamesDisplay = this.bomNamesFull;
            }
            this.bomName = this.bomNamesDisplay;
          }
          if (bomPartInfoArray.length > 0 && bomPartInfoArray[0]?.modifyTimestamp) {
            this.rowManagementService.setLastSavedAt(new Date(bomPartInfoArray[0].modifyTimestamp));
          }
        }

        this.rowData = this.transformToHierarchicalData(data);
        this.storeOriginalValues();
        this.initializeColumns();

        if (this.gridApi) {
          this.gridApi.refreshHeader();
          this.applyHierarchicalSearch();
        } else {
          this.displayData = this.getInitialDisplayData();
        }

        if (this.gridApi) {
          setTimeout(() => {
            this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);
          }, 200);
        }
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = this.dataService.getLoadErrorMessage(error);
        this.showNotification(errorMessage, 'error-persistent');
      },
    });
    this.subscriptions.push(loadSub);
  }

  ngAfterViewInit(): void {
    if (this.dataService.getBomType() !== 'SBOM') {
      return;
    }

    this.dataService.fetchIncludeInSpecSheetConstraints().subscribe({
      next: (constraints) => {
        this.constraintsData = constraints;
      },
      error: () => {},
    });
  }

  initializeColumns(): void {
    const columnMapping = this.dataService.getColumnMapping();
    this.columnDefs = this.createHierarchicalColumns(columnMapping);

    this.availableGroupFields = this.columnDefs
      .filter((col) => {
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
        if (field !== 'bomLinkFeature') {
          this.gridApi.setColumnsVisible([field], false);
        }
      });
    }
  }

  private getFilteredSkuInfo(): any[] {
    return this.dataService.getFilteredSkuInfo(this.selectedSkuFilter, () => this.isMbomMode());
  }

  public isSkuFilterOptionDisabled(option: SkuFilterOption): boolean {
    return this.dataService.isSkuFilterOptionDisabled(option, () => this.isMbomMode());
  }

  public getSkuFilterOptionTooltip(option: SkuFilterOption): string {
    return this.dataService.getSkuFilterOptionTooltip(option, () => this.isMbomMode());
  }

  public getSkuFilterLabel(option: SkuFilterOption): string {
    return this.dataService.getSkuFilterLabel(
      option,
      this.mbomSkuFilterOptions,
      this.sbomSkuFilterOptions,
      () => this.isMbomMode(),
    );
  }

  public toggleSkuFilterDropdown(): void {
    this.showSkuFilterDropdown = !this.showSkuFilterDropdown;
  }

  public selectSkuFilterOption(option: SkuFilterOption): void {
    if (this.dataService.isSkuFilterOptionDisabled(option, () => this.isMbomMode())) {
      return;
    }

    this.selectedSkuFilter = option;
    this.showSkuFilterDropdown = false;
    this.onSkuFilterChange();
  }

  public onSkuFilterChange(): void {
    this.showSkuFilterDropdown = false;
    if (
      this.dataService.isSkuFilterOptionDisabled(this.selectedSkuFilter, () => this.isMbomMode())
    ) {
      this.selectedSkuFilter = 'all';
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

    const checkboxCol = this.gridService.createCheckboxColumn();
    checkboxCol.headerCheckboxSelection = () => {
      return this.isAddRowEnabled();
    };
    checkboxCol.headerCheckboxSelectionFilteredOnly = true;
    checkboxCol.checkboxSelection = (params: any) => {
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
    };
    columns.push(checkboxCol);

    const actionsCol = this.gridService.createActionsColumn(
      () => this.isAddRowEnabled(),
      (data) => this.gridConfigService.getGroupCount(data),
      (params) => {
        if (
          !params.data.children ||
          !Array.isArray(params.data.children) ||
          params.data.children.length === 0
        ) {
          return false;
        }

        const bomType = this.dataService.getBomType();
        const isSbom = bomType === 'SBOM';

        return params.data.children.some((child: any) => {
          if (child.isMaterialHeader) return true;

          const val = child.partNumber || child.part;
          if (!val || String(val).trim() === '') {
            return false;
          }

          if (isSbom) {
            const isMbomLineItem = child.ptcbomPartMarkUp === 'enumMBOM001';
            const specSheetExtra = String(child.bomLinkSpecSheetExtra || '').trim();

            if (!isMbomLineItem && specSheetExtra === 'No') {
              return false;
            }
          }

          return true;
        });
      },
      () => this.dataService.getBomType() || 'SBOM',
    );
    columns.push(actionsCol);

    const featureCol = this.gridService.createFeatureColumn({
      columnMapping,
      constraintsData: this.constraintsData,
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      isSbomMode: () => this.isSbomMode(),
      getDataCellStyle: (params) => this.getDataCellStyle(params),
      getFeatureValue: (data) => this.utilService.getFeatureValue(data),
      renderHierarchicalCell: (params) => this.renderHierarchicalCell(params),
      getHierarchicalCellStyle: (params) => this.getHierarchicalCellStyle(params),
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      shouldHighlightRow: (data) => this.shouldHighlightRow(data),
      renderNewRowSkuCell: (params) => this.renderNewRowSkuCell(params),
      utilService: this.utilService,
    });
    columns.push(featureCol);

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
              textColor,
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
            if (params.data.isNewRow) {
              return this.gridConfigService.isFieldEditableForNewRow(
                field,
                () => this.isSkuFilterReadOnly(),
                () => this.isSbomMode(),
              );
            }
            return this.gridConfigService.isFieldEditableInSbom(
              'bomLinkCountryOfOrigin',
              params.data,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
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
              textColor,
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
            if (params.data.isNewRow) {
              return this.gridConfigService.isFieldEditableForNewRow(
                field,
                () => this.isSkuFilterReadOnly(),
                () => this.isSbomMode(),
              );
            }
            return this.gridConfigService.isFieldEditableInSbom(
              'bomLinkSpecSheetExtra',
              params.data,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
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
              textColor,
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
            if (params.data.isNewRow) {
              return this.gridConfigService.isFieldEditableForNewRow(
                field,
                () => this.isSkuFilterReadOnly(),
                () => this.isSbomMode(),
              );
            }
            return this.gridConfigService.isFieldEditableInSbom(
              'bomLinkIncludeInSpecSheet',
              params.data,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
          },
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: (params: any) => {
            const values = ['', ...this.dataService.getIncludeInSpecSheetOptions(this.constraintsData)];
            return {
              values,
              placeholder: 'Select...',
              filterFunction: this.utilService.createAutocompleteFilter(),
            };
          },
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
        resizable: true,
        hide: field === 'ptcbomPartMarkUpDisplayName',
        cellRenderer: (params: any) => {
          if (
            params.data.isSectionHeader ||
            params.data.isBranchHeader ||
            params.data.isGroupHeader
          ) {
            return '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;

          const cellStyle = this.getDataCellStyle(params);
          const textColor = cellStyle?.color || undefined;

          return this.utilService.createCellContentWithTooltip(
            params.value,
            columnWidth,
            textColor,
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
          if (params.data.isNewRow) {
            return this.gridConfigService.isFieldEditableForNewRow(
              field,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
          }
          return this.gridConfigService.isFieldEditableInSbom(
            field,
            params.data,
            () => this.isSkuFilterReadOnly(),
            () => this.isSbomMode(),
          );
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
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          step: 'any',
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

          if (params.data?.isNewRow) {
            return this.gridConfigService.isFieldEditableForNewRow(
              field,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
          }
          return this.gridConfigService.isFieldEditableInSbom(
            field,
            params.data,
            () => this.isSkuFilterReadOnly(),
            () => this.isSbomMode(),
          );
        };
        columnDef.valueSetter = (params: any) => {
          if (!params.data || !params.colDef?.field) return false;
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
                  : this.gridConfigService.getUniqueSuppliers(this.rowData);
            } else if (isColorField) {
              values =
                nodeData._availableColors && Array.isArray(nodeData._availableColors)
                  ? nodeData._availableColors
                  : this.gridConfigService.getUniqueColors(this.rowData);
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
              values: this.gridConfigService.getUniqueFeatures(this.rowData),
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

          if (params.data?.isNewRow) {
            return this.gridConfigService.isFieldEditableForNewRow(
              field,
              () => this.isSkuFilterReadOnly(),
              () => this.isSbomMode(),
            );
          }
          return this.gridConfigService.isFieldEditableInSbom(
            field,
            params.data,
            () => this.isSkuFilterReadOnly(),
            () => this.isSbomMode(),
          );
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
            textColor,
          );
        };
        columnDef.valueGetter = (params: any) => {
          if (!params.data) return undefined;
          const value = params.data[field];
          if (!value || value === '') return undefined;
          if (value instanceof Date) return value;
          return this.gridConfigService.parseDateString(String(value)) || undefined;
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
          return this.gridConfigService.formatDateToMMDDYYYY(rawValue);
        };
        columnDef.valueParser = (params: any) => {
          if (!params.newValue) return '';
          return this.gridConfigService.convertDateEditorValueToString(params.newValue);
        };
        columnDef.valueSetter = (params: any) => {
          const field = params.colDef.field as string;
          const dateStr = params.newValue
            ? this.gridConfigService.convertDateEditorValueToString(params.newValue)
            : '';
          params.data[field] = dateStr;
          return true;
        };
      }

      columns.push(columnDef);
    });

    const dynamicSkuColumns = this.gridService.createSkuColumns({
      columnMapping,
      constraintsData: this.constraintsData,
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      isSbomMode: () => this.isSbomMode(),
      getDataCellStyle: (params) => this.getDataCellStyle(params),
      getFeatureValue: (data) => this.utilService.getFeatureValue(data),
      renderHierarchicalCell: (params) => this.renderHierarchicalCell(params),
      getHierarchicalCellStyle: (params) => this.getHierarchicalCellStyle(params),
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      shouldHighlightRow: (data) => this.shouldHighlightRow(data),
      renderNewRowSkuCell: (params) => this.renderNewRowSkuCell(params),
      utilService: this.utilService,
    });

    const allColumns = [...columns, ...dynamicSkuColumns];
    return allColumns;
  }

  renderHierarchicalCell(params: any): string {
    return this.gridService.renderHierarchicalCell(params, {
      shouldHighlightRow: (data) => this.shouldHighlightRow(data),
      getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      utilService: this.utilService,
      gridConfigService: this.gridConfigService,
    });
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


  private renderGroupHeaderFullWidth(params: any): string {
    return this.gridService.renderGroupHeaderFullWidth(params, {
      shouldHighlightRow: (data) => this.shouldHighlightRow(data),
      getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      utilService: this.utilService,
      gridConfigService: this.gridConfigService,
    });
  }

  /**
   * Check if we're in SBOM mode
   */
  public isSbomMode(): boolean {
    const bomType = this.dataService.getBomType();
    return bomType === 'SBOM';
  }

  public isMbomMode(): boolean {
    const bomType = this.dataService.getBomType();
    return bomType === 'MBOM';
  }

  public getBomComposerTitle(): string {
    const bomType = this.dataService.getBomType();
    
    if (bomType === 'MBOM') {
      return 'MBOM Composer';
    }
    
    if (bomType === 'SBOM') {
      return 'SBOM Composer';
    }
    
    if (bomType === 'EBOM') {
      return 'EBOM Composer';
    }
    
    if (bomType === 'MATERIALMBOM') {
      return 'Material BOM Composer';
    }
    
    return 'Product BOM Composer';
  }

  public getCriteriaLabel(): string {
    const bomType = this.dataService.getBomType();
    if (bomType === 'EBOM' || bomType === 'MATERIALMBOM') {
      return 'Material of SKUs chosen - ';
    }
    // For MBOM and SBOM
    return 'Products of SKUs chosen - ';
  }

  public isSkuFilterReadOnly(): boolean {
    if (this.isMbomMode()) {
      return this.selectedSkuFilter !== 'hdEditable';
    } else {
      return this.selectedSkuFilter !== 'editableSkus';
    }
  }

  /**
   * Get tooltip text for save button based on disabled state
   */
  public getSaveButtonTooltip(): string {
    if (this.isSaving) {
      return 'Saving in progress...';
    }

    if (this.isSkuFilterReadOnly()) {
      if (this.isMbomMode()) {
        return 'Switch to "HD source - Editable" view to enable saving';
      } else {
        return 'Switch to "Editable SKUs" view to enable saving';
      }
    }

    if (this.editedRows.size === 0) {
      return 'No changes to save';
    }

    return 'Save changes';
  }

  /**
   * Check if field is editable for existing rows based on BOM type
   * MBOM: Only bomLinkStartDate, bomLinkEndDate, and quantity are editable
   * SBOM:
   *   - If MBOM line item (ptcbomPartMarkUp === 'enumMBOM001'): Only IncludeInSpecSheet editable
   *   - If NOT MBOM line item: IncludeInSpecSheet, quantity, and dates editable
   */

  /**
   * Check if add row functionality should be enabled
   */
  private isAddRowEnabled(): boolean {
    if (this.isSkuFilterReadOnly()) {
      return false;
    }

    // Add row enabled for both MBOM and SBOM
    return true;
  }

  private renderNewRowSkuCell(params: any): string {
    return this.gridService.renderNewRowSkuCell(params, {
      shouldHighlightRow: (data) => this.shouldHighlightRow(data),
      getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      utilService: this.utilService,
      gridConfigService: this.gridConfigService,
    });
  }


  getHierarchicalCellStyle(params: any): any {
    const data = params.data;
    const isActionsColumn = this.utilService.isActionsColumn(params);
    const hasPartForRefSku = this.shouldHighlightRow(data);

    if (data?.isGroupHeader) {
      const bgColor = this.getGroupBackgroundColor(data.groupLevel ?? 0);
      return this.utilService.getGroupHeaderStyle(bgColor, isActionsColumn);
    }
    if (data?.isSectionHeader) {
      return this.utilService.getSectionHeaderStyle(isActionsColumn);
    }
    if (data.isMaterialHeader) {
      return this.utilService.getMaterialHeaderStyle(hasPartForRefSku);
    }
    if (data.isParentRow) {
      return this.utilService.getParentRowStyle(hasPartForRefSku);
    }
    if (data.isDirectRow) {
      return this.utilService.getDirectRowStyle(hasPartForRefSku);
    }

    return this.utilService.getDefaultRowStyle(hasPartForRefSku);
  }


  getDataCellStyle(params: any): any {
    const data = params.data;
    const baseStyle: any = { borderRight: '1px solid #e2e8f0' };
    if (!data) return baseStyle;

    const hasPartForRefSku = this.shouldHighlightRow(data);
    const isActionsColumn = this.utilService.isActionsColumn(params);

    if (data.isGroupHeader) {
      const bgColor = this.getGroupBackgroundColor(data.groupLevel ?? 0);
      return this.utilService.getDataGroupHeaderStyle(bgColor, isActionsColumn);
    }
    if (data.isSectionHeader) {
      return this.utilService.getDataSectionHeaderStyle(isActionsColumn);
    }
    if (data.isMaterialHeader) {
      return this.utilService.getDataMaterialHeaderStyle(hasPartForRefSku);
    }
    if (data.isParentRow) {
      return this.utilService.getParentRowStyle(hasPartForRefSku);
    }
    if (data.isDirectRow) {
      return this.utilService.getDataDirectRowStyle(baseStyle, hasPartForRefSku);
    }

    return this.utilService.getDataDefaultStyle(baseStyle, hasPartForRefSku);
  }


  onGridReady(params: any): void {
    this.gridApi = params.api;

    this.gridConfigService.sizeColumnsToFit(this.gridApi);
    this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);

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
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      const visible = (event.target as HTMLInputElement).checked;
      this.gridService.toggleColumnVisibility(col, visible, {
        gridApi: this.gridApi,
        allColumns: this.allColumns,
        isSkuColumn: (c) => this.isSkuColumn(c),
        isFieldGrouped: (field) => this.isFieldGrouped(field),
        panelColumnOrder: this.panelColumnOrder,
        setPanelColumnOrder: (order) => {
          this.panelColumnOrder = order;
        },
      });
    } else {
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
      if (this.showColumnVisibilityPanel) {
        this.panelColumnOrder = [];
      }
    }
  }

  selectAllColumns(): void {
    this.gridService.selectAllColumns({
      gridApi: this.gridApi,
      allColumns: this.allColumns,
      isSkuColumn: (col) => this.isSkuColumn(col),
      isFieldGrouped: (field) => this.isFieldGrouped(field),
      panelColumnOrder: this.panelColumnOrder,
      setPanelColumnOrder: (order) => {
        this.panelColumnOrder = order;
      },
    });
  }

  clearAllColumns(): void {
    this.gridService.clearAllColumns({
      gridApi: this.gridApi,
      allColumns: this.allColumns,
      isSkuColumn: (col) => this.isSkuColumn(col),
      isFieldGrouped: (field) => this.isFieldGrouped(field),
      panelColumnOrder: this.panelColumnOrder,
      setPanelColumnOrder: (order) => {
        this.panelColumnOrder = order;
      },
    });
  }

  getVisibleColumnsForPanel(): ExtendedColDef[] {
    return this.gridService.getVisibleColumnsForPanel({
      gridApi: this.gridApi,
      allColumns: this.allColumns,
      isSkuColumn: (col) => this.isSkuColumn(col),
      isFieldGrouped: (field) => this.isFieldGrouped(field),
      panelColumnOrder: this.panelColumnOrder,
      setPanelColumnOrder: (order) => {
        this.panelColumnOrder = order;
      },
    });
  }

  /**
   * Get the actual column order from ag-grid
   * Returns columns in their current display order
   */
  private getCurrentColumnOrder(): string[] {
    if (!this.gridApi) return [];
    const allColumns = this.gridApi.getColumns();
    if (!allColumns) return [];
    return allColumns
      .map((col) => col.getColId())
      .filter((id): id is string => typeof id === 'string' && id !== '');
  }

  onColumnMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('label')) {
      event.stopPropagation();
    }
  }

  onDragStart(event: DragEvent, col: ExtendedColDef, index: number): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('label')) {
      event.preventDefault();
      return;
    }

    this.draggedColumn = col;
    this.draggedColumnIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', '');
    }
  }

  onDragEnd(event: DragEvent): void {
    this.stopAutoScroll();

    this.draggedColumn = null;
    this.draggedColumnIndex = -1;
    this.dragOverIndex = -1;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.checkAutoScroll(event);
  }

  onItemDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.draggedColumnIndex === -1 || this.draggedColumnIndex === index) {
      this.dragOverIndex = -1;
      this.stopAutoScroll();
      return;
    }

    this.dragOverIndex = index;

    this.checkAutoScroll(event);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Check if we need to auto-scroll and start/stop scrolling accordingly
   */
  private checkAutoScroll(event: DragEvent): void {
    if (!this.columnCheckboxes?.nativeElement) {
      return;
    }

    const container = this.columnCheckboxes.nativeElement;
    const rect = container.getBoundingClientRect();
    const mouseY = event.clientY;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    const distanceFromTop = mouseY - rect.top;
    const distanceFromBottom = rect.bottom - mouseY;

    this.stopAutoScroll();

    if (distanceFromTop < this.AUTO_SCROLL_THRESHOLD && scrollTop > 0) {
      this.startAutoScroll('up');
    }
    else if (
      distanceFromBottom < this.AUTO_SCROLL_THRESHOLD &&
      scrollTop < scrollHeight - clientHeight
    ) {
      this.startAutoScroll('down');
    }
  }

  /**
   * Start auto-scrolling in the specified direction
   */
  private startAutoScroll(direction: 'up' | 'down'): void {
    if (this.autoScrollInterval) {
      return; // Already scrolling
    }

    const container = this.columnCheckboxes?.nativeElement;
    if (!container) {
      return;
    }

    this.autoScrollInterval = setInterval(() => {
      if (!container) {
        this.stopAutoScroll();
        return;
      }

      const scrollAmount = direction === 'up' ? -this.AUTO_SCROLL_SPEED : this.AUTO_SCROLL_SPEED;

      container.scrollTop += scrollAmount;

      // Stop if we've reached the top or bottom
      const isAtTop = direction === 'up' && container.scrollTop <= 0;
      const isAtBottom =
        direction === 'down' &&
        container.scrollTop >= container.scrollHeight - container.clientHeight;
      
      if (isAtTop || isAtBottom) {
        this.stopAutoScroll();
      }
    }, 16); // ~60fps
  }

  /**
   * Stop auto-scrolling
   */
  stopAutoScroll(): void {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  onItemDragLeave(event: DragEvent): void {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      this.dragOverIndex = -1;
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedColumn || !this.gridApi) {
      this.resetDragState();
      return;
    }

    const visibleColumns = this.getVisibleColumnsForPanel();
    const targetIndex = this.dragOverIndex >= 0 ? this.dragOverIndex : visibleColumns.length - 1;

    if (this.draggedColumnIndex === targetIndex) {
      this.resetDragState();
      return;
    }

    const targetColumn = visibleColumns[targetIndex];
    if (!targetColumn?.field) {
      this.resetDragState();
      return;
    }

    this.gridService.moveColumn(
      this.draggedColumn,
      targetColumn,
      this.draggedColumnIndex,
      targetIndex,
      {
        gridApi: this.gridApi,
        allColumns: this.allColumns,
        isSkuColumn: (col) => this.isSkuColumn(col),
        isFieldGrouped: (field) => this.isFieldGrouped(field),
        panelColumnOrder: this.panelColumnOrder,
        setPanelColumnOrder: (order) => {
          this.panelColumnOrder = order;
        },
      },
    );

    this.resetDragState();
  }

  /**
   * Reset drag state - Angular best practice: centralized state management
   */
  private resetDragState(): void {
    this.dragOverIndex = -1;
    this.draggedColumn = null;
    this.draggedColumnIndex = -1;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as Element;
    this.utilService.handlePanelClickOutside(target, this.showColumnVisibilityPanel, this.columnPanel, this.toggleBtn, (value) => { this.showColumnVisibilityPanel = value; });
    this.utilService.handlePanelClickOutside(target, this.showGroupByPanel, this.groupByPanel, this.groupByBtn, (value) => { this.showGroupByPanel = value; });
    this.utilService.handleDropdownClickOutside(target, this.showSkuFilterDropdown, this.skuFilterDropdown, (value) => { this.showSkuFilterDropdown = value; });
    this.utilService.handleDropdownClickOutside(target, this.showActionDropdown, this.actionDropdown, (value) => { this.showActionDropdown = value; });
  }

  toggleActionDropdown(): void {
    this.showActionDropdown = !this.showActionDropdown;
  }

  closeActionDropdown(): void {
    this.showActionDropdown = false;
  }

  toggleGroupByPanel(): void {
    this.showGroupByPanel = !this.showGroupByPanel;
  }

  addGroupField(field: GroupConfig): void {
    if (this.activeGroupFields.some((g) => g.field === field.field)) {
      return;
    }

    this.activeGroupFields.push(field);

    if (this.gridApi && field.field && field.field !== 'bomLinkFeature') {
      this.gridApi.setColumnsVisible([field.field], false);
    }

    this.applyGrouping();
  }

  removeGroupField(field: GroupConfig): void {
    this.activeGroupFields = this.activeGroupFields.filter((g) => g.field !== field.field);

    if (this.gridApi && field.field) {
      const colDef = this.columnDefs.find((col) => col.field === field.field);
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
    const currentState = this.groupExpandedState.get(groupKey) ?? true;
    this.groupExpandedState.set(groupKey, !currentState);

    this.applyGrouping();
  }

  /**
   * Check if a row has SKU data in the existing API response
   * For editable filter: Only show rows that have SKU in existing response (not new rows)
   * Must verify SKU exists in original API response instances for this specific row
   */
  private hasSkuInExistingResponse(row: any, targetSkuIds: Set<string>): boolean {
    if (this.utilService.isHeaderRow(row)) {
      return true;
    }

    if (row?.isNewRow) {
      return false;
    }

    const apiData = this.dataService.getApiData();
    if (!apiData?.instances || !Array.isArray(apiData.instances)) {
      return false;
    }

    const matchedInstance = this.findMatchingInstance(row, apiData.instances, targetSkuIds);
    if (!matchedInstance) {
      return false;
    }

    return this.utilService.rowHasTargetSkuValue(row, targetSkuIds);
  }


  private findMatchingInstance(row: any, instances: any[], targetSkuIds: Set<string>): any {
    const rowData = this.utilService.extractRowData(row);
    const bomType = this.dataService.getBomType() ?? '';

    for (const instance of instances) {
      const bomLink = instance['bom-link'];
      if (!bomLink) continue;

      if (!this.matchesRowCriteria(bomLink, rowData, bomType)) {
        continue;
      }

      if (!this.utilService.instanceHasTargetSku(bomLink, targetSkuIds)) {
        continue;
      }

      return bomLink;
    }

    return null;
  }


  private matchesRowCriteria(bomLink: any, rowData: { section: string; feature: string; partNumber: string }, bomType: string): boolean {
    const instanceData = this.utilService.extractInstanceData(bomLink);

    const isSectionMatch = instanceData.section === rowData.section;
    const isFeatureMatch = instanceData.feature === rowData.feature;

    if (!isSectionMatch || !isFeatureMatch) {
      return false;
    }

    if (!this.utilService.shouldRequirePartMatch(bomType, rowData.partNumber, instanceData.partNumber)) {
      return true;
    }

    return String(instanceData.partNumber).trim() === String(rowData.partNumber).trim();
  }


  /**
   * Filter hierarchical data based on SKU filter selection
   *
   * Applies to ALL filters except "all":
   * - MBOM: "hdEditable", "hdViewOnly", "nonHdSource"
   * - SBOM: "editableSkus"
   *
   * Filtering logic:
   * Step 1: Get visible SKU IDs from filtered SKU columns (what's shown in UI)
   * Step 2: Filter rows - only show rows where:
   *   a) Matched instance has at least one visible SKU ID
   *   b) Row has a NON-EMPTY value for at least one visible SKU ID column
   *
   * This ensures rows with empty SKU columns are filtered out for all SKU views.
   */
  private filterHierarchicalDataBySkuFilter(data: any[]): any[] {
    return this.gridService.filterHierarchicalDataBySkuFilter(data, {
      getBomType: () => this.dataService.getBomType() || 'SBOM',
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      hasSkuInExistingResponse: (row, ids) => this.hasSkuInExistingResponse(row, ids),
      rowMatchesSearch: (row, text) => this.rowMatchesSearch(row, text),
    });
  }

  private applyGrouping(): void {
    const newRows: any[] = [];
    const isSkuFilterActive = this.selectedSkuFilter !== 'all';

    if (!isSkuFilterActive && this.displayData && Array.isArray(this.displayData)) {
      this.displayData.forEach((row) => {
        if (row.isNewRow && !row.isSectionHeader && !row.isGroupHeader && !row.isMaterialHeader) {
          newRows.push(row);
        }
      });
    }

    let hierarchicalData = this.rowData;
    if (this.searchText && this.searchText.trim() !== '') {
      hierarchicalData = this.filterHierarchicalData(this.rowData, this.searchText);
    }

    // Apply SKU filter for editable view (only show rows with SKU in existing response)
    hierarchicalData = this.filterHierarchicalDataBySkuFilter(hierarchicalData);
    if (this.activeGroupFields.length > 0) {
      let groupedHierarchicalData = this.gridConfigService.groupHierarchicalData(
        hierarchicalData,
        this.activeGroupFields,
      );

      const applyGroupState = (items: any[]): any[] => {
        return items.map((item) => {
          const newItem = { ...item };

          if (newItem.isSectionHeader) {
            newItem.isExpanded = newItem.isExpanded ?? true;
          }

          if (newItem.isGroupHeader && newItem.groupKey) {
            const savedState = this.groupExpandedState.get(newItem.groupKey);
            newItem.isExpanded = savedState ?? true;
          }

          if (newItem.children && Array.isArray(newItem.children)) {
            newItem.children = applyGroupState(newItem.children);
          }

          return newItem;
        });
      };

      groupedHierarchicalData = applyGroupState(groupedHierarchicalData);

      this.displayData = this.flattenHierarchicalData(groupedHierarchicalData);
    } else {
      this.displayData = this.flattenHierarchicalData(hierarchicalData);
      this.groupExpandedState.clear();
    }

    newRows.forEach((newRow) => {
      const insertAfter = newRow.insertAfter;
      if (insertAfter !== undefined && insertAfter >= 0 && insertAfter < this.displayData.length) {
        this.displayData.splice(insertAfter + 1, 0, newRow);
      }
    });

    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.displayData);
      this.gridApi.refreshCells();
    }
  }

  onCellClicked(event: any): void {
    if (this.handleLinkIconClick(event)) return;
    if (this.handlePartNumberFieldClick(event)) return;
    if (this.isFilterButtonClick(event)) return;

    const target = event.event?.target as HTMLElement;
    const isReadOnlySkuFilter = this.isSkuFilterReadOnly();

    if (this.handlePastePartButton(event, target, isReadOnlySkuFilter)) return;
    if (this.handleDeleteButton(event, target, isReadOnlySkuFilter)) return;
    if (this.handleDisconnectButton(event, target, isReadOnlySkuFilter)) return;

    if (event.colDef.field === 'actions') {
      this.handleActionsColumnClick(event);
      return;
    }

    if (event.colDef.field === 'material' || event.colDef.field === 'materialDescription') {
      this.handleMaterialColumnClick(event);
      return;
    }

    this.handleEditableCellClick(event, isReadOnlySkuFilter);
  }

  private handleLinkIconClick(event: any): boolean {
    const iconTarget = event.event?.target as HTMLElement | undefined;
    const linkIconEl = iconTarget?.closest?.('.material-link-icon, .direct-link-icon');
    if (linkIconEl && event.data && !event.data.isNewRow) {
      event.event?.preventDefault?.();
      event.event?.stopPropagation?.();
      this.openMaterialModal(event.data);
      return true;
    }
    return false;
  }

  private handlePartNumberFieldClick(event: any): boolean {
    if (event.colDef.field === 'bomLinkPart' || event.colDef.field === 'partNumber') {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
      return true;
    }
    return false;
  }

  private isFilterButtonClick(event: any): boolean {
    if (!event.event?.target) return false;
    const target = event.event.target as HTMLElement;
    return !!(
      target.closest('.ag-header-cell-filter-button') ||
      target.closest('.ag-icon-filter') ||
      target.classList.contains('ag-header-cell-filter-button') ||
      target.classList.contains('ag-icon-filter')
    );
  }

  private handlePastePartButton(event: any, target: HTMLElement, isReadOnlySkuFilter: boolean): boolean {
    const pastePartButton = target?.closest('[data-action="paste-part"]');
    if (!pastePartButton) return false;

    event.event.preventDefault();
    event.event.stopPropagation();
    if (isReadOnlySkuFilter || event.colDef?.isDisabled) {
      return true;
    }
    if (event.colDef.field?.startsWith('sku') && event.data?.isNewRow) {
      this.rowManagementService.pastePartNumber(event, this);
    }
    return true;
  }

  private handleDeleteButton(event: any, target: HTMLElement, isReadOnlySkuFilter: boolean): boolean {
    const deleteButton = target?.closest('[data-action="clear-sku"]');
    if (!deleteButton) return false;

    event.event.preventDefault();
    event.event.stopPropagation();
    if (isReadOnlySkuFilter) {
      return true;
    }
    if (event.colDef.field?.startsWith('sku') && event.data?.isNewRow) {
      this.rowManagementService.clearSkuValue(event, this);
    }
    return true;
  }

  private handleDisconnectButton(event: any, target: HTMLElement, isReadOnlySkuFilter: boolean): boolean {
    const disconnectButton = target?.closest('[data-action="disconnect-sku"]');
    if (!(disconnectButton instanceof HTMLElement)) return false;

    if (isReadOnlySkuFilter) {
      return true;
    }
    const skuField = disconnectButton.dataset['skuField'];
    if (skuField && event.data) {
      this.disconnectPartFromSku(event.data, skuField, event.event);
    }
    return true;
  }

  private handleEditableCellClick(event: any, isReadOnlySkuFilter: boolean): void {
    if (!event.data || event.data.isSectionHeader) return;

    const field = event.colDef.field;
    if (!field || field === 'actions' || field.startsWith('sku')) return;

    const isDateColumn = field === 'bomLinkStartDate' || field === 'bomLinkEndDate';
    const isSpecSheetField =
      field === 'bomLinkSpecSheetExtra' || field === 'bomLinkIncludeInSpecSheet';
    const isAutocompleteField =
      isSpecSheetField || field === 'materialDescription' || field === 'material';

    const isEditable =
      !isReadOnlySkuFilter &&
      (event.data.isNewRow ||
        this.gridConfigService.isFieldEditableInSbom(
          field,
          event.data,
          () => this.isSkuFilterReadOnly(),
          () => this.isSbomMode(),
        ));

    if (isDateColumn && isEditable) {
      this.handleDateColumnClick(event);
    } else if (isAutocompleteField && isEditable && event.data.isNewRow) {
      this.handleAutocompleteFieldClick(event);
    } else if (isEditable) {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
    }
  }

  private handleActionsColumnClick(event: any): void {
    const target = event.event?.target as HTMLElement;

    if (target?.classList.contains('add-row-btn')) {
      const rowIndex = event.rowIndex;
      if (rowIndex !== null && rowIndex !== undefined) {
        this.addRowAfter(rowIndex);
      }
    } else if (target?.classList.contains('delete-row-btn')) {
      const partId = target.dataset['partId'];
      const newRowId = target.dataset['newRowId'];

      if (newRowId) {
        this.deleteRowById(Number.parseInt(newRowId));
      } else if (partId) {
        this.deleteRow(partId);
      }
    }
  }

  private handleMaterialColumnClick(event: any): void {
    if (event.data?.isNewRow) {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
    }
  }

  openMaterialModal(materialData: any): void {
    if (!materialData) return;

    // Only open modal if linkedBom is "1"
    if (materialData.linkedBom !== '1' && materialData.linkedBom !== 1) {
      return;
    }

    const childId = materialData.childId;

    if (!childId) {
      return;
    }

    const bomSub = this.dataService.getComplexBOM(childId).subscribe({
      next: (bomData: any) => {
        if (!bomData) {
          this.showNotification('Failed to load material BOM data.', 'error');
          return;
        }

        if (!Array.isArray(bomData.instances)) {
          bomData.instances = [];
        }

        this.selectedMaterialData = {
          ...bomData,
          material: materialData.material || materialData.materialDescription || '',
          materialDescription: materialData.materialDescription || materialData.material || '',
          part: materialData.part || materialData.partNumber || '',
          partNumber: materialData.partNumber || materialData.part || '',
          materialId: materialData.materialId || bomData.materialMasterId || '',
        };
        this.selectedMaterialSkuData = [];
        this.showMaterialModal = true;
      },
      error: (error: any) => {
        const errorMessage =
          error?.error?.message || error?.message || 'Failed to load material BOM data.';
        this.showNotification(errorMessage, 'error');
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

    this.invalidRowIds.clear();

    // Validate new rows before saving (required fields)
    let requiredFields = this.validationService.getDefaultRequiredFields();

    const bomType = this.dataService.getBomType();

    if (bomType === 'SBOM') {
      // For SBOM: Remove bomLinkFeature, bomLinkSpecSheetExtra, and bomLinkIncludeInSpecSheet from required fields
      requiredFields = requiredFields.filter(
        (field) =>
          !field.keys.includes('bomLinkFeature') &&
          !field.keys.includes('bomLinkSpecSheetExtra') &&
          !field.keys.includes('bomLinkIncludeInSpecSheet'),
      );
    } else {
      // For MBOM: Remove SBOM-specific fields
      requiredFields = requiredFields.filter(
        (field) =>
          !field.keys.includes('bomLinkSpecSheetExtra') &&
          !field.keys.includes('bomLinkIncludeInSpecSheet'),
      );
    }

    const validationResult = this.validationService.validateNewRows(
      this.rowData,
      this.displayData,
      requiredFields,
    );
    if (this.handleValidationError(validationResult)) {
      return;
    }

    const skuInfo = this.getFilteredSkuInfo();
    const skuValidationResult = this.validationService.validateNewRowsSkus(
      this.rowData,
      skuInfo,
      this.displayData,
    );
    if (this.handleValidationError(skuValidationResult)) {
      return;
    }

    const allNewRows = this.utilService.findAllNewRows(this.rowData, this.displayData);
    for (const newRow of allNewRows) {
      const payloadSkus = this.buildSkusArrayFromRow(newRow, skuInfo);
      const payloadValidation = this.validationService.validateSkuPayload(
        newRow,
        skuInfo,
        payloadSkus,
      );
      if (!payloadValidation.isValid) {
        const rowId = this.utilService.getRowId(newRow) || 'Unknown';
        this.invalidRowIds.add(rowId);
        this.handleValidationError(payloadValidation);
        return;
      }
    }

    const apiData = this.dataService.getApiData();
    const duplicateValidation = this.validationService.validateDuplicateFeatureSkuCombination(
      this.rowData,
      this.displayData,
      skuInfo,
      apiData || undefined,
    );
    if (this.handleValidationError(duplicateValidation)) {
      return;
    }

    // All validations passed, proceed with save
    this.isSaving = true;

    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        this.isSaving = false;

        if (result.success) {
          this.invalidRowIds.clear();
          this.rowManagementService.showSaveMessage(result.message, this, 'success');
        } else {
          this.rowManagementService.showSaveMessage(result.message, this, 'error');
        }
      })
      .catch((error) => {
        this.isSaving = false;
        this.rowManagementService.showSaveMessage(
          'An unexpected error occurred while saving. Please try again.',
          this,
          'error-persistent',
        );
      });
  }


  private handleValidationError(
    validationResult: { isValid: boolean; message: string; invalidRows?: Array<{ rowId: string | number }> },
  ): boolean {
    if (validationResult.isValid) return false;

    if (validationResult.invalidRows) {
      validationResult.invalidRows.forEach((invalidRow) => {
        this.invalidRowIds.add(invalidRow.rowId);
      });
    }
    this.refreshGridForValidationErrors();
    this.showNotification(validationResult.message, 'error');
    return true;
  }

  private refreshGridForValidationErrors(): void {
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }


  private createEditorCleanup(
    observerRef: { current: MutationObserver | null },
    timeouts: ReturnType<typeof setTimeout>[],
    cleanedUpRef: { current: boolean },
  ): () => void {
    const cleanupObserverAndTimeouts = (
      obs: MutationObserver | null,
      timeoutsArray: ReturnType<typeof setTimeout>[],
    ) => {
      if (obs) {
        try {
          obs.disconnect();
        } catch (e) {
          console.warn('Observer cleanup failed:', e);
        }
      }
      timeoutsArray.forEach((t) => {
        try {
          clearTimeout(t);
        } catch (e) {
          console.warn('Timeout cleanup failed:', e);
        }
      });
      timeoutsArray.length = 0;
    };

    return () => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      cleanupObserverAndTimeouts(observerRef.current, timeouts);
      observerRef.current = null;
    };
  }


  addRowAfter(rowIndex: number): void {
    const { section, sectionDisplayName } = this.getSectionInfoForRow(rowIndex);
    const insertIndex = this.calculateInsertIndex(rowIndex);

    this.rowManagementService.addRowAfter(
      insertIndex,
      this.displayData,
      this.gridApi,
      this.dataService,
      section,
      sectionDisplayName,
    );

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);
  }

  private getSectionInfoForRow(rowIndex: number): { section: string | undefined; sectionDisplayName: string | undefined } {
    const referenceRow = this.displayData[rowIndex];
    let section: string | undefined;
    let sectionDisplayName: string | undefined;

    if (referenceRow) {
      section = referenceRow.section || referenceRow.parent?.data?.section;
      sectionDisplayName = referenceRow.sectionDisplayName || referenceRow.parent?.data?.sectionDisplayName;

      if (!section && this.gridApi) {
        const sectionInfo = this.getSectionFromGridNode(rowIndex);
        section = sectionInfo.section;
        sectionDisplayName = sectionInfo.sectionDisplayName;
      }
    }

    return { section, sectionDisplayName };
  }

  private getSectionFromGridNode(rowIndex: number): { section: string | undefined; sectionDisplayName: string | undefined } {
    const node = this.gridApi?.getDisplayedRowAtIndex(rowIndex);
    if (!node?.parent) {
      return { section: undefined, sectionDisplayName: undefined };
    }

    return this.traverseParentNodesForSection(node.parent);
  }

  private traverseParentNodesForSection(parentNode: any): { section: string | undefined; sectionDisplayName: string | undefined } {
    let section: string | undefined;
    let sectionDisplayName: string | undefined;
    let currentParent = parentNode;

    while (currentParent) {
      const parentData = currentParent.data;
      if (parentData) {
        if (!section && parentData.section) {
          section = parentData.section;
        }
        if (!sectionDisplayName && parentData.sectionDisplayName) {
          sectionDisplayName = parentData.sectionDisplayName;
        }
        if (section && sectionDisplayName) {
          return { section, sectionDisplayName };
        }
      }
      currentParent = currentParent.parent;
    }

    return { section, sectionDisplayName };
  }

  private calculateInsertIndex(rowIndex: number): number {
    let insertIndex = rowIndex;
    while (
      insertIndex + 1 < this.displayData.length &&
      this.displayData[insertIndex + 1].isNewRow
    ) {
      insertIndex++;
    }
    return insertIndex;
  }

  deleteRowById(newRowId: number): void {
    const rowToDelete = this.displayData.find((row) => row.newRowId === newRowId);

    if (rowToDelete) {
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

      baseIds.forEach((id) => {
        this.utilService.getIdVariants(id).forEach((variant) => {
          this.editedRows.delete(variant);
        });
      });

      if (this.editedFields) {
        baseIds.forEach((id) => {
          this.editedFields.delete(id);
        });
      }
    } else {
      this.editedRows.delete(newRowId);
      this.editedRows.delete(`${newRowId}`);
      if (this.editedFields) {
        this.editedFields.delete(newRowId);
        this.editedFields.delete(`${newRowId}`);
      }
    }

    try {
      this.gridApi?.stopEditing?.();
    } catch {}

    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);

    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  deleteRow(partId: string): void {
    const maybeId = Number(partId);
    if (!Number.isNaN(maybeId)) {
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
    return 'Last Saved: ' + this.gridConfigService.formatLastSavedTime(lastSavedAt);
  }

  clearSaveMessage(): void {
    this.rowManagementService.clearSaveMessage(this);
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
      const fieldsToSearch = visibleFields.length > 0 ? visibleFields : this.utilService.getAllSearchableFields(row);
    const excludedFields = this.utilService.getExcludedSearchFields();

    for (const key of fieldsToSearch) {
      if (excludedFields.has(key) || !row.hasOwnProperty(key)) {
        continue;
      }

      const value = row[key];
      if (value === null || value === undefined) {
        continue;
      }

      if (this.utilService.matchesArrayValue(value, searchLower)) {
        return true;
      }

      if (typeof value === 'object') {
        continue;
      }

      if (String(value).toLowerCase().includes(searchLower)) {
        return true;
      }
    }

    return false;
  }


  private handleDateColumnClick(event: any): void {
    const targetRowIndex = event.rowIndex;
    const targetColKey = event.column.getId();
    const gridContainer = event.api.getGridElement() as HTMLElement;

    if (!gridContainer) {
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

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let isCleanedUp = false;
    const observerRef: { current: MutationObserver | null } = { current: null };
    const cleanedUpRef = { current: isCleanedUp };
    const cleanup = this.createEditorCleanup(observerRef, timeouts, cleanedUpRef);

    const openDatePicker = (): boolean => {
      if (cleanedUpRef.current) return false;

      const editingCell = gridContainer.querySelector('.ag-cell-inline-editing') as HTMLElement;
      if (!editingCell) return false;

      const dateInput =
        (editingCell.querySelector('input[type="date"]') as HTMLInputElement) ||
        (editingCell.querySelector('input.ag-date-input') as HTMLInputElement) ||
        (editingCell.querySelector('input') as HTMLInputElement);

      if (dateInput?.type !== 'date') return false;

      try {
        dateInput.focus();
        const openPicker = () => {
          if (cleanedUpRef.current || dateInput.type !== 'date') return;
          if (typeof dateInput.showPicker === 'function') {
            try {
              dateInput.showPicker();
            } catch (e) {
              console.warn('showPicker failed, using click fallback:', e);
              dateInput.click();
            }
          } else {
            dateInput.click();
          }
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(openPicker);
        });
        return true;
      } catch (e) {
        console.warn('Date picker interaction failed:', e);
        return false;
      }
    };

    if (openDatePicker()) {
      cleanup();
      return;
    }

    try {
      const newObserver = new MutationObserver(() => {
        if (!cleanedUpRef.current && openDatePicker()) {
          cleanup();
        }
      });
      observerRef.current = newObserver as MutationObserver | null;
      newObserver.observe(gridContainer, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      console.warn('MutationObserver creation failed:', e);
      cleanup();
    }

    [100, 200, 300].forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!cleanedUpRef.current && openDatePicker()) {
          cleanup();
        }
      }, delay);
      timeouts.push(timeout);
    });

    const cleanupTimeout = setTimeout(() => {
      cleanup();
    }, 1000);
    timeouts.push(cleanupTimeout);
  }

  private handleAutocompleteFieldClick(event: any): void {
    const targetRowIndex = event.rowIndex;
    const targetColKey = event.column.getId();
    const gridContainer = event.api.getGridElement() as HTMLElement;

    if (!gridContainer) {
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

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let isCleanedUp = false;
    const observerRef: { current: MutationObserver | null } = { current: null };
    const cleanedUpRef = { current: isCleanedUp };
    const cleanup = this.createEditorCleanup(observerRef, timeouts, cleanedUpRef);

    const focusAutocompleteEditor = (): boolean => {
      if (cleanedUpRef.current) return false;

      const editingCell = gridContainer.querySelector('.ag-cell-inline-editing') as HTMLElement;
      if (!editingCell) return false;

      const autocompleteInput = editingCell.querySelector('input') as HTMLInputElement;
      if (!autocompleteInput) return false;

      try {
        autocompleteInput.focus();
        const triggerClick = () => {
          if (!cleanedUpRef.current) {
            autocompleteInput.click();
          }
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(triggerClick);
        });
        return true;
      } catch (e) {
        console.warn('Autocomplete interaction failed:', e);
        return false;
      }
    };

    if (focusAutocompleteEditor()) {
      cleanup();
      return;
    }

    try {
      const newObserver = new MutationObserver(() => {
        if (!cleanedUpRef.current && focusAutocompleteEditor()) {
          cleanup();
        }
      });
      observerRef.current = newObserver as MutationObserver | null;
      newObserver.observe(gridContainer, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      console.warn('MutationObserver creation failed:', e);
      cleanup();
    }

    [100, 200, 300].forEach((delay) => {
      const timeout = setTimeout(() => {
        if (!cleanedUpRef.current && focusAutocompleteEditor()) {
          cleanup();
        }
      }, delay);
      timeouts.push(timeout);
    });

    const cleanupTimeout = setTimeout(() => {
      cleanup();
    }, 1000);
    timeouts.push(cleanupTimeout);
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


  private filterHierarchicalData(data: any[], searchText: string): any[] {
    return this.gridService.filterHierarchicalData(data, searchText, {
      getBomType: () => this.dataService.getBomType() || 'SBOM',
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      hasSkuInExistingResponse: (row, ids) => this.hasSkuInExistingResponse(row, ids),
      rowMatchesSearch: (row, text) => this.rowMatchesSearch(row, text),
    });
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
    const sectionDisplayNameMap: Record<string, string> = {};

    const processedItems = data.instances
      .filter((item: any) => {
        const bomLink = item['bom-link'];
        if (!bomLink) return false;

        const hasPartNumber = bomLink.partNumber && String(bomLink.partNumber).trim() !== '';

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
          quantity: bomLink.quantity ? Number(bomLink.quantity).toFixed(1) : bomLink.quantity,
          qty: bomLink.qty ? Number(bomLink.qty).toFixed(1) : bomLink.qty,
          section: sectionInternalName,
          sectionDisplayName: sectionDisplayName,
        };
      });

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
        section: sectionInternalName,
        sectionDisplayName: item.sectionDisplayName,
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
      const featureA = a.bomLinkFeature.toLowerCase().trim();
      const featureB = b.bomLinkFeature.toLowerCase().trim();

      if (featureA !== featureB) {
        return featureA.localeCompare(featureB);
      }

      const partA = a.partNumber.toLowerCase().trim();
      const partB = b.partNumber.toLowerCase().trim();

      return partA.localeCompare(partB);
    };

    // Show ALL sections from sectionOrder, even if they have no materials
    sectionOrder.forEach((sectionDisplayName, idx) => {
      const internalNames = displayToInternalMap.get(sectionDisplayName) ?? [];

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
      if (!sectionOrder.includes(sectionDisplayName)) {
        const sectionItems = sections[sectionInternalName];
        if (sectionItems && sectionItems.length > 0) {
          const sortedMaterials = [...sectionItems].sort(sortMaterials);
          const sectionObj = {
            section: sectionInternalName,
            sectionDisplayName: sectionDisplayName,
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
        isExpanded: true,
        children: [],
        level: 0,
      };

      section.materials.forEach((material: any, materialIndex: number) => {
        const hasChildren = material.children && material.children.length > 0;

        if (hasChildren) {
          const materialRow: any = {
            ...material,
            section: section.section,
            sectionDisplayName: section.sectionDisplayName,
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
            section: section.section,
            sectionDisplayName: section.sectionDisplayName,
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
      const rowId = row.materialKey || row.newRowId || row.partNumber || row.part;
      if (!rowId) return;

      const originalValues: any = {
        bomLinkStartDate: String(row.bomLinkStartDate || row.startDate || ''),
        bomLinkEndDate: String(row.bomLinkEndDate || row.endDate || ''),
        quantity: String(row.quantity || row.qty || ''),
        bomLinkSpecSheetExtra: String(row.bomLinkSpecSheetExtra || ''),
        bomLinkIncludeInSpecSheet: String(row.bomLinkIncludeInSpecSheet || ''),
      };

      this.originalRowValues.set(rowId, originalValues);
      if (row.section && (row.partNumber || row.part)) {
        this.originalRowValues.set(`${row.section}::${row.partNumber || row.part}`, originalValues);
      }

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
   */
  private buildSkusArrayFromRow(row: any, skuInfo: any[]): any[] {
    return this.payloadTransformService.buildSkusArrayFromRow(row, skuInfo, this.rowData);
  }
  /**
   * Transform grid row data back to API format with mixed edit/create support
   * For existing rows: Uses _old/_new suffixes for edited fields
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
      {
        skuInfoOverride: skuInfo,
        gridApi: this.gridApi,
      },
    );
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'error-persistent' | 'info' = 'info',
  ): void {
    this.saveMessage = message;
    this.saveMessageType = type;

    if (type === 'success' || type === 'info' || type === 'error') {
      setTimeout(() => {
        this.saveMessage = '';
        this.saveMessageType = '';
      }, 5000);
    }
  }

  onSelectionChanged(params: any): void {
    const selectedNodes = params.api.getSelectedNodes();
    this.selectedRows.clear();
    selectedNodes.forEach((node: any) => {
      if (node.data) {
        this.selectedRows.add(node.data);
      }
    });

    this.massEditMode = false;
    
    this.massEditStartDate = '';
    this.massEditEndDate = '';
    this.massEditQuantity = null;
    this.massEditIncludeInSpecSheet = '';
  }

  applyMassEdit(): void {
    if (this.selectedRows.size === 0 || !this.gridApi) return;
    if (this.isMassEditing) return;

    this.isMassEditing = true;
    setTimeout(() => {
      try {
        const massEditState: MassEditState = {
          startDate: this.massEditStartDate,
          endDate: this.massEditEndDate,
          quantity: this.massEditQuantity,
          includeInSpecSheet: this.massEditIncludeInSpecSheet,
        };

        this.massEditService.applyMassEdit({
          gridApi: this.gridApi,
          selectedRows: this.selectedRows,
          columnDefs: this.columnDefs,
          state: massEditState,
          isMbomMode: () => this.isMbomMode(),
          isSbomMode: () => this.isSbomMode(),
          editedRows: this.editedRows,
          editedFields: this.editedFields,
          originalRowValues: this.originalRowValues,
        });

        this.massEditStartDate = '';
        this.massEditEndDate = '';
        this.massEditQuantity = null;
        this.massEditIncludeInSpecSheet = '';
      } finally {
        this.isMassEditing = false;
      }
    }, 0);
  }

  exportToExcel(): void {
    if (!this.gridApi) return;

    // Define columns to exclude from export
    const excludedFields = ['actions']; 

    // Check if any rows are selected
    const selectedNodes = this.gridApi.getSelectedNodes();
    const hasSelectedRows = selectedNodes && selectedNodes.length > 0;

    const exportOptions: any = {
      excludedFields,
      fileName: `BOM_Composer_Export_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'BOM Export',
      excludeHeaderRows: true,
    };

    if (hasSelectedRows) {
      exportOptions.selectedNodes = selectedNodes;
    }

    this.utilService
      .exportGridToExcel(this.gridApi, exportOptions)
      .then(() => {
        let message: string;
        if (hasSelectedRows) {
          const rowCount = selectedNodes.length;
          const rowText = rowCount > 1 ? 'rows' : 'row';
          message = `Excel file exported successfully (${rowCount} ${rowText} selected)`;
        } else {
          message = 'Excel file exported successfully';
        }
        this.showNotification(message, 'success');
      })
      .catch(() => {
        this.showNotification('Error exporting to Excel. Please try again.', 'error');
      });
  }

  disconnectPartFromSku(rowData: any, skuField: string, event?: any): void {
    if (!rowData || !skuField || !this.gridApi) return;
    if (this.isSkuFilterReadOnly()) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const rowId = rowData.newRowId || rowData.partNumber;

    let targetNode: any = null;
    this.gridApi.forEachNode((node: any) => {
      if (node.data === rowData) {
        targetNode = node;
      }
    });

    if (targetNode) {
      targetNode.setDataValue(skuField, '');
      rowData[skuField] = '';

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

  private getGroupBackgroundColor(groupLevel: number): string {
    return this.gridService.getGroupBackgroundColor(groupLevel);
  }

  private getGroupBorderColor(groupLevel: number): string {
    return this.gridService.getGroupBorderColor(groupLevel);
  }

  private getGroupHoverBackgroundColor(groupLevel: number): string {
    return this.gridService.getGroupHoverBackgroundColor(groupLevel);
  }

  getIncludeInSpecSheetOptionsForMassEdit(): string[] {
    return this.dataService.getIncludeInSpecSheetOptions(this.constraintsData);
  }

  /**
   * Check if any selected rows contain MBOM line items (ptcbomPartMarkUp === 'enumMBOM001')
   * Used to determine which mass edit fields to show in SBOM mode
   */
  hasMbomLineItemsInSelection(): boolean {
    return this.massEditService.hasMbomLineItemsInSelection(this.selectedRows, () =>
      this.isSbomMode(),
    );
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
    this.massEditIncludeInSpecSheet = '';
  }

  openMassEdit(): void {
    if (this.selectedRows.size > 1) {
      this.massEditMode = true;
      const massEditState = this.massEditService.populateMassEditFields(
        Array.from(this.selectedRows),
        () => this.isMbomMode(),
        () => this.isSbomMode(),
      );
      this.massEditStartDate = massEditState.startDate;
      this.massEditEndDate = massEditState.endDate;
      this.massEditQuantity = massEditState.quantity;
      this.massEditIncludeInSpecSheet = massEditState.includeInSpecSheet;
    }
  }

  openPartsEditModal(): void {
    if (this.selectedRows.size === 0) return;

    const ids = new Set<string>();
    this.selectedRows.forEach((row: any) => {
      const id = row?.materialColorId;
      if (typeof id === 'string' && id.trim()) {
        ids.add(id.trim());
      }
    });

    this.partsEditModalMaterialColorIds = Array.from(ids);
    if (this.partsEditModalMaterialColorIds.length === 0) return;

    this.showPartsEditModal = true;
  }

  closePartsEditModal(): void {
    this.showPartsEditModal = false;
    this.partsEditModalMaterialColorIds = [];
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

    if (nodesToUpdate.length > 0 && skuFields.length > 0) {
      this.gridApi.refreshCells({
        rowNodes: nodesToUpdate,
        columns: skuFields,
        force: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.stopAutoScroll();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    if (this.gridApi && (this.gridApi as any)._hoverSyncCleanup) {
      (this.gridApi as any)._hoverSyncCleanup();
    }

    delete (globalThis as any).toggleSection;
    delete (globalThis as any).toggleMaterial;
    delete (globalThis as any).toggleGroup;
  }
}
