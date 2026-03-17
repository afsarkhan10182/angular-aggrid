import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  Inject,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ColumnState, GridApi, GridOptions, getGridElement } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { AutocompleteCellEditorComponent } from './components/autocomplete-cell-editor/autocomplete-cell-editor.component';
import { IconComponent } from './components/icon/icon.component';
import { ColumnHeaderPinComponent } from './components/column-header-pin/column-header-pin.component';
import { HierarchicalCellRendererComponent } from './components/hierarchical-cell-renderer/hierarchical-cell-renderer.component';
import { LinkedBomModalComponent } from './components/linked-bom-modal/linked-bom-modal.component';
import { ServiceDataManagerModalComponent } from './components/service-data-manager-modal/service-data-manager-modal.component';
import { PartEditModalComponent } from './components/part-edit-modal/part-edit-modal.component';
import { DataService } from './services/data.service';
import { GridConfigService, GroupConfig } from './services/grid/grid-config.service';
import { GridService, ColumnVisibilityConfig } from './services/grid/grid.service';
import { RowManagementService } from './services/row-management.service';
import { SessionService } from './services/session.service';
import { ValidationService } from './services/validation.service';
import { UtilService, ExtendedColDef } from './services/util.service';
import { GridColumnsService } from './services/grid/grid-columns.service';
import { GridDataTransformService } from './services/grid/grid-data-transform.service';
import {
  PayloadTransformService,
  TransformGridDataToApiOptions,
} from './services/payload-transform.service';
import { MassEditService, MassEditState } from './services/mass-edit.service';
import { SkuService } from './services/sku.service';
import { environment } from '../environments/environment';
import {
  BOM_TYPE_EBOM,
  BOM_TYPE_MBOM,
  BOM_TYPE_SBOM,
  BOM_TYPE_MATERIALMBOM,
  DEFAULT_BOM_TYPE,
  EBOM_SERVICE_FIELDS,
  EDITABLE_AUTOPOPULATED_FIELDS,
  COL_ACTIONS,
  COL_CHECKBOX,
  ENUM_MBOM_LINE_ITEM,
  FIELD_ACTIONS,
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_PART,
  FIELD_PART_NUMBER,
  FIELD_MATERIAL,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_MATERIAL_COLOR_STATUS,
  LS_KEY_SHOW_EXPIRED_DATA,
  NOTIFICATION_TYPE_ERROR,
  NOTIFICATION_TYPE_ERROR_PERSISTENT,
  NOTIFICATION_TYPE_SUCCESS,
  NOTIFICATION_TYPE_INFO,
  MSG_SAVE_DISABLED_VIEW_ONLY,
  COLUMNS_REFRESH_ACTIONS,
  ROW_ID_UNKNOWN,
  EXCLUDED_FIELDS_EXPORT,
  MSG_EXPORT_EXCEL_ERROR,
  MSG_EXPORT_EXCEL_SUCCESS,
  MSG_EXPORT_EXCEL_SUCCESS_SELECTED,
  LABEL_ROW,
  LABEL_ROWS,
  VALUE_SPEC_YES,
} from './constants';
import type {
  SkuFilterOption,
  MbomSkuFilterOption,
  SbomSkuFilterOption,
  EbomSkuFilterOption,
  SkuInfo,
} from './services/data.service';

const PART_NUMBER_EDIT_FIELDS = new Set<string>([FIELD_BOM_LINK_PART, FIELD_PART_NUMBER]);
const MATERIAL_CLICK_FIELDS = new Set<string>([FIELD_MATERIAL, FIELD_MATERIAL_DESCRIPTION]);
const DATE_EDIT_FIELDS = new Set<string>([FIELD_BOM_LINK_START_DATE, FIELD_BOM_LINK_END_DATE]);
const SPEC_SHEET_EDIT_FIELDS = new Set<string>([
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    IconComponent,
    LinkedBomModalComponent,
    ServiceDataManagerModalComponent,
    PartEditModalComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy, AfterViewInit {
  public gridApi!: GridApi;
  private subscriptions: Subscription[] = [];
  private actionsColumnWidth = 60;
  public showColumnVisibilityPanel = false;
  public showGroupByPanel = false;
  public draggedColumn: ExtendedColDef | null = null;
  public draggedColumnIndex: number = -1;
  public dragOverIndex: number = -1;
  public panelColumnOrder: ExtendedColDef[] = []; // Used by moveColumn; kept in sync from grid
  private autoScrollInterval: any = null;
  private readonly AUTO_SCROLL_THRESHOLD = 50; // pixels from edge
  private readonly AUTO_SCROLL_SPEED = 10; // pixels per interval

  @ViewChild('columnPanel') columnPanel!: ElementRef;
  @ViewChild('toggleBtn') toggleBtn!: ElementRef;
  @ViewChild('groupByPanel') groupByPanel!: ElementRef;
  @ViewChild('groupByBtn') groupByBtn!: ElementRef;
  @ViewChild('columnCheckboxes') columnCheckboxes!: ElementRef;
  @ViewChild('actionDropdown') actionDropdown!: ElementRef;
  public showExpiredData = false;
  public showLinkedBomModal = false;
  public selectedLinkedBomData: any = {};
  public selectedLinkedBomSkuData: any[] = [];
  public isLinkedBomLoading = false;
  public showServiceDataManagerModal = false;
  public serviceDataManagerModalMaterialColorIds: string[] = [];
  public showPartEditModal = false;
  public partEditModalMaterialColorIds: string[] = [];
  public searchText: string = '';
  public saveMessage: string = '';
  public saveMessageType: string = '';
  public readonly editedRows = new Set<string | number>();
  public currentUser: any = null;
  public bomName: string = '';
  public bomNamesDisplay: string = '';
  public bomNamesFull: string = '';
  public bomType: string = '';
  public selectedSkuFilter: SkuFilterOption = 'all';
  public isSkuFilterSelectOpen = false;
  public highlightSkuFilter = false;
  public showActionDropdown = false;
  public readonly mbomSkuFilterOptions: Array<{ label: string; value: MbomSkuFilterOption }>;
  public readonly sbomSkuFilterOptions: Array<{ label: string; value: SbomSkuFilterOption }>;
  public readonly ebomSkuFilterOptions: Array<{ label: string; value: EbomSkuFilterOption }>;

  public get skuFilterOptions(): Array<{ label: string; value: SkuFilterOption }> {
    if (this.isEbomMode() || this.isMaterialMbomMode()) {
      return this.ebomSkuFilterOptions;
    }
    return this.isMbomMode() ? this.mbomSkuFilterOptions : this.sbomSkuFilterOptions;
  }

  public isLoading: boolean = true;
  public constraintsData: any = null;
  public isSaving: boolean = false;
  public isMassEditing: boolean = false;
  public readonly originalRowValues = new Map<string | number, any>();
  private readonly editedFields = new Map<string | number, Set<string>>();
  public readonly invalidRowIds = new Set<string | number>();
  public readonly selectedRows = new Set<any>();
  public massEditMode = false;
  public massEditStartDate: string = '';
  public massEditEndDate: string = '';
  public massEditQuantity: number | null = null;
  public massEditIncludeInSpecSheet: string = '';

  /** True when user disconnected one or more SKUs (single or bulk); payload will send disconnect: true. Cleared on successful save. */
  public hasDisconnectEdits: boolean = false;

  /** Keys 'rowId|skuField' for SKUs marked disconnected (shown strikethrough until save). Cleared on successful save. */
  public disconnectedSkuKeys: Set<string> = new Set<string>();

  /** When false, the disconnected SKUs panel is hidden (user closed it). Re-shown when new disconnects are added. */
  public showDisconnectedSkusPanel = true;

  /** True when disconnected SKUs panel is visible (same layout impact as mass edit for grid height). */
  get hasDisconnectedSkusPanelVisible(): boolean {
    return this.isSbomMode() && this.disconnectedSkuKeys.size > 0 && this.showDisconnectedSkusPanel;
  }

  private readonly gridHeightOffsets = {
    default: 200,
    withSaveMessage: 250,
    withEditPanels: 350,
  } as const;

  public get gridViewportHeight(): string {
    const offset =
      this.massEditMode || this.hasDisconnectedSkusPanelVisible
        ? this.gridHeightOffsets.withEditPanels
        : this.saveMessage
          ? this.gridHeightOffsets.withSaveMessage
          : this.gridHeightOffsets.default;

    return `max(320px, calc(100dvh - ${offset}px))`;
  }

  public gridOptions: GridOptions = {} as GridOptions;

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];

  public rowData: any[] = [];
  public displayData: any[] = []; // Flattened data for display
  public activeGroupFields: GroupConfig[] = []; // Currently active group fields
  public availableGroupFields: GroupConfig[] = []; // Available columns for grouping
  private readonly groupExpandedState: Map<string, boolean> = new Map(); // Track group expand/collapse state
  private linkedBomRequestId = 0;
  private skuFilterHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly gridService: GridService,
    private readonly rowManagementService: RowManagementService,
    private readonly sessionService: SessionService,
    private readonly validationService: ValidationService,
    private readonly utilService: UtilService,
    private readonly gridColumnsService: GridColumnsService,
    private readonly gridDataTransformService: GridDataTransformService,
    private readonly payloadTransformService: PayloadTransformService,
    private readonly massEditService: MassEditService,
    private readonly skuService: SkuService,
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.mbomSkuFilterOptions = this.dataService.getMbomSkuFilterOptions();
    this.sbomSkuFilterOptions = this.dataService.getSbomSkuFilterOptions();
    this.ebomSkuFilterOptions = this.dataService.getEbomSkuFilterOptions();

    this.gridOptions.context = {
      componentParent: this,
      dataService: this.dataService,
      setSkipEditTracking: (skip: boolean) => this.rowManagementService.setSkipEditTracking(skip),
      editedRows: this.editedRows,
      editedFields: this.editedFields,
    };

    this.showExpiredData = false;
    try {
      localStorage.removeItem(LS_KEY_SHOW_EXPIRED_DATA);
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
            componentParent: this,
            dataService: this.dataService,
            setSkipEditTracking: (skip: boolean) => this.rowManagementService.setSkipEditTracking(skip),
            editedRows: this.editedRows,
            editedFields: this.editedFields,
          }
        : {
            dataService: this.dataService,
            setSkipEditTracking: (skip: boolean) => this.rowManagementService.setSkipEditTracking(skip),
            editedRows: this.editedRows,
            editedFields: this.editedFields,
          },
      isFullWidthRow: (params: any) => {
        const data = params.rowNode.data;
        return data.isGroupHeader || data.isSectionHeader;
      },
      getRowId: (params: any) => {
        return this.getGridRowId(params?.data);
      },
      fullWidthCellRenderer: HierarchicalCellRendererComponent,
      onRowClicked: (params: any) => {
        this.onRowClicked(params);
      },
      onColumnMoved: () => this.refreshVisibleColumnsPanel(),
      onColumnVisible: () => this.refreshVisibleColumnsPanel(),
    };

    this.checkAuthentication();
  }

  ngOnInit(): void {
  }

  private getGridRowId(data: any): string {
    if (!data) return '';

    if (data.isSectionHeader) {
      const sectionKey =
        data.section ?? data.sectionDisplayName ?? data.sectionName ?? 'unknown';
      return `section::${sectionKey}`;
    }

    if (data.isGroupHeader) {
      const groupKey =
        data.groupKey ??
        `${data.groupField ?? ''}:${data.groupValue ?? ''}`;
      const sectionKey = data.section ?? data.sectionDisplayName ?? '';
      return `group::${sectionKey}::${data.groupLevel ?? ''}::${groupKey}`;
    }

    if (data.isMaterialHeader) {
      const materialKey =
        data.materialKey ??
        data.material ??
        data.part ??
        data[FIELD_PART_NUMBER] ??
        data.materialIndex ??
        'unknown';
      const sectionKey = data.section ?? '';
      return `material::${sectionKey}::${materialKey}`;
    }

    if (data.isNewRow && data.newRowId != null) {
      return `new::${data.newRowId}`;
    }

    const baseId =
      data.materialKey ??
      data.newRowId ??
      data[FIELD_PART_NUMBER] ??
      data.part ??
      data.material ??
      'unknown';
    const sectionKey = data.section ?? '';
    return sectionKey ? `row::${sectionKey}::${baseId}` : `row::${baseId}`;
  }

  public toggleSection(section: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader,
    );
    if (!sectionRow) return;

    sectionRow.isExpanded = !sectionRow.isExpanded;
    this.applyGridSearch();
    this.redrawSectionHeader(sectionRow);
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
          child[FIELD_PART_NUMBER],
        ].filter((val) => val !== undefined && val !== null);

        return candidateValues.includes(materialIdentifier);
      });
    }

    if (!materialRow) return;
    materialRow.isExpanded = !materialRow.isExpanded;
    this.applyGridSearch();
  }

  private getInitialDisplayData(): any[] {
    let treeData = this.filterDataBySkuFilter(this.rowData);

    if (this.activeGroupFields.length > 0) {
      treeData = this.gridConfigService.groupHierarchicalData(
        treeData,
        this.activeGroupFields,
      );
    }

    return this.flattenDisplayData(treeData);
  }

  private flattenDisplayData(data: any[]): any[] {
    return this.gridService.flattenHierarchicalData(data, {
      getBomType: () => this.dataService.getBomType() || DEFAULT_BOM_TYPE,
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
      next: () => {
        this.loadData();
      },
      error: () => {
        this.showNotification(
          'This application must be accessed through FlexPLM. Please login to FlexPLM first.',
          NOTIFICATION_TYPE_ERROR,
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

        this.rowData = this.transformToTreeData(data);
        this.storeOriginalValues();
        this.initializeColumns();

        if (this.gridApi) {
          this.gridApi.refreshHeader();
          this.applyGridSearch();
        } else {
          this.displayData = this.getInitialDisplayData();
        }
        this.applyActionsColumnWidth(this.computeActionsColumnWidth());

        if (this.gridApi) {
          setTimeout(() => {
            this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);
          }, 200);
        }
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = this.dataService.getLoadErrorMessage(error);
        this.showNotification(errorMessage, NOTIFICATION_TYPE_ERROR_PERSISTENT);
      },
    });
    this.subscriptions.push(loadSub);
  }

  ngAfterViewInit(): void {
    if (this.dataService.getBomType() !== BOM_TYPE_SBOM) {
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
    this.actionsColumnWidth = this.computeActionsColumnWidth();
    const columnMapping = this.dataService.getColumnMapping();
    this.columnDefs = this.gridColumnsService.createColumns(columnMapping, {
      constraintsData: this.constraintsData,
      actionsColumnWidth: this.actionsColumnWidth,
      rowData: this.rowData,
      isAddRowEnabled: () => this.isAddRowEnabled(),
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      isSbomMode: () => this.isSbomMode(),
      isEbomMode: () => this.isEbomMode(),
      isMaterialMbomMode: () => this.isMaterialMbomMode(),
      getDataCellStyle: (params) => this.getDataCellStyle(params),
      getFeatureValue: (data) => this.utilService.getFeatureValue(data),
      getHierarchicalCellStyle: (params) => this.getHierarchicalCellStyle(params),
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      renderNewRowSkuCell: (params) => this.renderNewRowSkuCell(params),
      renderDataCellContent: (params, fallbackWidth, value) =>
        this.renderDataCellContent(params, fallbackWidth, value),
      getCellTooltipValue: (params) => this.getCellTooltipValue(params),
      isFieldEditable: (field, params) => this.isFieldEditable(field, params),
      clearAutopopulateFieldsForRow: (data) => this.clearAutopopulateFieldsForRow(data),
      canDisconnectForRow: (data) => this.canDisconnectForRow(data),
      isSkuDisconnected: (row, skuField) => this.isSkuDisconnected(row, skuField),
      isSkuEditableForDisconnect: (skuField) => this.isSkuEditableForDisconnect(skuField),
    });
    this.applyActionsColumnWidth(this.actionsColumnWidth);

    this.availableGroupFields = this.columnDefs
      .filter((col) => {
        return (
          col.field &&
          col.field !== COL_ACTIONS &&
          (col.sortable !== false || col.field === FIELD_BOM_LINK_FEATURE)
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
        this.gridApi.setColumnsVisible([field], false);
      });
    }
  }

  private computeActionsColumnWidth(): number {
    const hasErrors =
      this.hasValidationErrors(this.rowData) || this.hasValidationErrors(this.displayData);
    return hasErrors ? 76 : 60;
  }

  private hasValidationErrors(rows: any[] | undefined): boolean {
    if (!rows || rows.length === 0) return false;
    const stack: any[] = [...rows];
    while (stack.length > 0) {
      const row = stack.pop();
      if (row?.validation && row.validation.isValid === false) return true;
      if (Array.isArray(row?.children) && row.children.length > 0) {
        stack.push(...row.children);
      }
    }
    return false;
  }

  private applyActionsColumnWidth(width: number): void {
    if (this.document?.documentElement) {
      this.renderer.setStyle(
        this.document.documentElement,
        '--actions-col-width',
        `${width}px`,
        RendererStyleFlags2.DashCase,
      );
    }
    if (this.gridApi) {
      this.gridApi.setColumnWidths([{ key: COL_ACTIONS, newWidth: width }], false);
    }
  }

  public addRowForSection(sectionInternalName: string): void {
    const rowIndex = this.displayData.findIndex(
      (row) => row?.isSectionHeader && row.section === sectionInternalName,
    );
    if (rowIndex === -1) return;

    const sectionRow = this.rowData.find(
      (row: any) => row?.isSectionHeader && row.section === sectionInternalName,
    );
    const wasExpanded = sectionRow ? (sectionRow.isExpanded ?? true) : true;
    if (sectionRow) {
      sectionRow.isExpanded = true;
    }

    const result = this.addRowAfter(rowIndex);
    if (result?.newRow) {
      result.newRow.insertAfterSection = sectionInternalName;
    }

    if (sectionRow && !wasExpanded) {
      this.applyGridSearch();
      this.redrawSectionHeader(sectionRow);
    }
  }

  private redrawSectionHeader(sectionRow: any): void {
    if (!this.gridApi || !sectionRow) return;
    const rowId = this.getGridRowId(sectionRow);
    if (!rowId) return;
    const rowNode = this.gridApi.getRowNode(rowId);
    if (rowNode) {
      this.gridApi.redrawRows({ rowNodes: [rowNode] });
    }
  }

  private getFilteredSkuInfo(): any[] {
    if (this.isEbomMode() || this.isMaterialMbomMode()) {
      const valid: SkuFilterOption[] = ['all', 'released', 'nonReleased'];
      if (!valid.includes(this.selectedSkuFilter)) {
        this.selectedSkuFilter = 'all';
      }
    }
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
      this.ebomSkuFilterOptions,
      () => this.isMbomMode(),
    );
  }

  public onSkuFilterChange(): void {
    this.isSkuFilterSelectOpen = false;

    if (this.dataService.isSkuFilterOptionDisabled(this.selectedSkuFilter, () => this.isMbomMode())) {
      this.selectedSkuFilter = 'all';
    }

    this.initializeColumns();

    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
      this.gridApi.refreshHeader();
      this.applyGridSearch();

      if (this.isSkuFilterReadOnly()) {
        this.massEditMode = false;
      }
    }
  }

  public onSkuFilterSelectPointerDown(event: PointerEvent): void {
    if (event.button === 0) {
      this.isSkuFilterSelectOpen = true;
    }
  }

  public onSkuFilterSelectBlur(): void {
    this.isSkuFilterSelectOpen = false;
  }

  /**
   * Get all columns for visibility panel - dynamically from columnDefs
   */
  get allColumns(): any[] {
    return this.columnDefs.filter((col) => {
      const field = col.field || (col as any).colId;
      return field !== COL_CHECKBOX;
    });
  }

  /**
   * Check if we're in SBOM mode
   */
  private getCurrentBomType(): string {
    return this.dataService.getBomType() || DEFAULT_BOM_TYPE;
  }

  public isSbomMode(): boolean {
    return this.getCurrentBomType() === BOM_TYPE_SBOM;
  }

  public isMbomMode(): boolean {
    return this.getCurrentBomType() === BOM_TYPE_MBOM;
  }

  public isEbomMode(): boolean {
    return this.getCurrentBomType() === BOM_TYPE_EBOM;
  }

  public isMaterialMbomMode(): boolean {
    return this.getCurrentBomType() === BOM_TYPE_MATERIALMBOM;
  }

  public isPartEditMode(): boolean {
    return this.isEbomMode() || this.isMaterialMbomMode();
  }

  public getBomComposerTitle(): string {
    const bomType = this.getCurrentBomType();
    
    if (bomType === BOM_TYPE_EBOM || bomType === BOM_TYPE_SBOM) {
      return `${bomType} Composer`;
    }
    
    if (bomType === BOM_TYPE_MATERIALMBOM) {
      return 'Material BOM Composer';
    }
    
    return 'Product BOM Composer';
  }

  public getCriteriaLabel(): string {
    const bomType = this.getCurrentBomType();
    if (bomType === BOM_TYPE_EBOM || bomType === BOM_TYPE_MATERIALMBOM) {
      return 'Material of SKUs chosen - ';
    }
    // For MBOM and SBOM
    return 'Products of SKUs chosen - ';
  }

  public isSkuFilterReadOnly(): boolean {
    if (this.isEbomMode() || this.isMaterialMbomMode()) {
      return this.selectedSkuFilter !== 'nonReleased';
    }
    if (this.isSbomMode()) {
      return false;
    }
    if (this.isMbomMode()) {
      return this.selectedSkuFilter !== 'hdEditable';
    }
    return this.selectedSkuFilter !== 'editableSkus';
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
      }
      if (this.isEbomMode() || this.isMaterialMbomMode()) {
        return 'Switch to "Editable - Non-released state" view to enable saving';
      }
      return 'Switch to "Editable SKUs" view to enable saving';
    }

    if (this.editedRows.size === 0) {
      return 'No changes to save';
    }

    return 'Save changes';
  }

  private showSkuFilterEditableHint(actionLabel: string): void {
    let message = `Switch to an editable view to enable ${actionLabel}.`;
    if (this.isMbomMode()) {
      message = `Switch to "HD source - Editable" view to enable ${actionLabel}.`;
    } else if (this.isEbomMode() || this.isMaterialMbomMode()) {
      message = `Switch to "Editable - Non-released" view to enable ${actionLabel}.`;
    } else if (!this.isSbomMode()) {
      message = `Switch to "Editable SKUs" view to enable ${actionLabel}.`;
    }

    this.showNotification(message, NOTIFICATION_TYPE_INFO);
    this.highlightSkuFilter = true;
    if (this.skuFilterHighlightTimeout) {
      clearTimeout(this.skuFilterHighlightTimeout);
    }
    this.skuFilterHighlightTimeout = setTimeout(() => {
      this.highlightSkuFilter = false;
      this.skuFilterHighlightTimeout = null;
    }, 2200);
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
      shouldHighlightRow: (data) => this.gridService.shouldHighlightRow(data),
      getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
      isSkuFilterReadOnly: () => this.isSkuFilterReadOnly(),
      isEbomMode: () => this.isEbomMode(),
      utilService: this.utilService,
      gridConfigService: this.gridConfigService,
    });
  }


  getHierarchicalCellStyle(params: any): any {
    return this.gridService.getHierarchicalCellStyle(params, this.utilService);
  }

  getDataCellStyle(params: any): any {
    return this.gridService.getDataCellStyle(params, this.utilService);
  }

  private isHeaderDataRow(data: any): boolean {
    return !!(data?.isSectionHeader || data?.isBranchHeader || data?.isGroupHeader);
  }

  private renderDataCellContent(
    params: any,
    fallbackWidth: number,
    value: any = params?.value,
  ): string {
    if (this.isHeaderDataRow(params?.data)) {
      return '';
    }

    const columnWidth = params.column?.getActualWidth() || fallbackWidth;
    const cellStyle = this.getDataCellStyle(params);
    const textColor = cellStyle?.color || undefined;
    return this.utilService.createCellContentWithTooltip(value, columnWidth, textColor);
  }

  private getCellTooltipValue(params: any): string | null {
    if (params.value === null || params.value === undefined) {
      return null;
    }
    return String(params.value);
  }

  private isFieldEditable(field: string, params: any): boolean {
    if (!params.data || params.data.isSectionHeader) {
      return false;
    }

    if (params.data.isNewRow) {
      return this.gridConfigService.isFieldEditableForNewRow(
        field,
        () => this.isSkuFilterReadOnly(),
        () => this.isSbomMode(),
        () => this.isEbomMode(),
        () => this.isMaterialMbomMode(),
      );
    }

    return this.gridConfigService.isFieldEditableInSbom(
      field,
      params.data,
      () => this.isSkuFilterReadOnly(),
      () => this.isSbomMode(),
      () => this.isEbomMode(),
      () => this.isMaterialMbomMode(),
    );
  }

  private getColumnVisibilityConfig(): ColumnVisibilityConfig {
    return {
      gridApi: this.gridApi,
      allColumns: this.allColumns as ExtendedColDef[],
      isSkuColumn: (col: any) => this.isSkuColumn(col),
      isFieldGrouped: (field: string) => this.isFieldGrouped(field),
      panelColumnOrder: this.panelColumnOrder,
      setPanelColumnOrder: (order: ExtendedColDef[]) => {
        this.panelColumnOrder = order;
      },
    };
  }


  onGridReady(params: any): void {
    this.gridApi = params.api;

    this.gridConfigService.sizeColumnsToFit(this.gridApi);
    this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);

    if (this.gridApi) {
      this.gridApi.refreshHeader();
    }

    if (this.rowData && this.rowData.length > 0) {
      this.applyGridSearch();
    }

    this.applyActionsColumnWidth(this.actionsColumnWidth);
  }

  isSkuColumn(col: any): boolean {
    return col.field && (this.skuService.isSkuField(col.field) || col.field.startsWith(FIELD_ACTIONS));
  }

  toggleExpiredData(): void {
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      const visible = (event.target as HTMLInputElement).checked;
      this.gridService.toggleColumnVisibility(col, visible, this.getColumnVisibilityConfig());
      this.refreshVisibleColumnsPanel();
    } else {
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
      if (this.showColumnVisibilityPanel) {
        this.showGroupByPanel = false;
        this.panelColumnOrder = [];
      }
    }
  }

  selectAllColumns(): void {
    this.gridService.selectAllColumns(this.getColumnVisibilityConfig());
    this.refreshVisibleColumnsPanel();
  }

  clearAllColumns(): void {
    this.gridService.clearAllColumns(this.getColumnVisibilityConfig());
    this.refreshVisibleColumnsPanel();
  }

  getVisibleColumnsForPanel(): ExtendedColDef[] {
    return this.gridService.getVisibleColumnsForPanel(this.getColumnVisibilityConfig());
  }

  refreshVisibleColumnsPanel(): void {
    this.cdr.detectChanges();
  }

  onVisibleColumnsPanelFocusOut(event: FocusEvent): void {
    const panel = this.columnPanel?.nativeElement as HTMLElement | undefined;
    if (!panel) return;
    try {
      const relatedTarget = event.relatedTarget as Node | null;
      if (!relatedTarget || !panel.contains(relatedTarget)) {
        this.refreshVisibleColumnsPanel();
      }
    } catch {
      this.refreshVisibleColumnsPanel();
    }
  }

  trackByColumnField(_index: number, col: ExtendedColDef): string {
    return col?.field ?? col?.colId ?? `col-${_index}`;
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

  onDragEnd(_event: DragEvent): void {
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
    const targetColumnId = targetColumn?.field ?? targetColumn?.colId;
    if (!targetColumnId) {
      this.resetDragState();
      return;
    }

    this.gridService.moveColumn(
      this.draggedColumn,
      targetColumn,
      this.draggedColumnIndex,
      targetIndex,
      this.getColumnVisibilityConfig(),
    );

    this.resetDragState();
    this.refreshVisibleColumnsPanel();
  }

  /**
   * Reset drag state - Angular best practice: centralized state management
   */
  private resetDragState(): void {
    this.dragOverIndex = -1;
    this.draggedColumn = null;
    this.draggedColumnIndex = -1;
  }

  private stopGridEditingSafely(): void {
    try {
      this.gridApi?.stopEditing?.();
    } catch {
      // ignore
    }
  }

  private forceRefreshGridCells(): void {
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  private isColumnUserVisible(field: string): boolean {
    const colDef = this.columnDefs.find((col) => col.field === field);
    return !!(colDef && !colDef.hide);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as Element;
    this.utilService.handlePanelClickOutside(target, this.showColumnVisibilityPanel, this.columnPanel, this.toggleBtn, (value) => { this.showColumnVisibilityPanel = value; });
    this.utilService.handlePanelClickOutside(target, this.showGroupByPanel, this.groupByPanel, this.groupByBtn, (value) => { this.showGroupByPanel = value; });
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
    if (this.showGroupByPanel) {
      this.showColumnVisibilityPanel = false;
    }
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
      if (this.isColumnUserVisible(field.field)) {
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
        if (this.isColumnUserVisible(field)) {
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
    const apiData = this.dataService.getApiData();
    return this.skuService.hasSkuInExistingResponse({
      row,
      targetSkuIds,
      instances: apiData?.instances,
      bomType: this.dataService.getBomType() ?? '',
      isHeaderRow: (candidateRow) => this.utilService.isHeaderRow(candidateRow),
    });
  }


  /**
   * Filter tree data based on SKU filter selection
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
  private filterDataBySkuFilter(data: any[]): any[] {
    return this.gridService.filterHierarchicalDataBySkuFilter(data, {
      getBomType: () => this.dataService.getBomType() || DEFAULT_BOM_TYPE,
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      hasSkuInExistingResponse: (row, ids) => this.hasSkuInExistingResponse(row, ids),
      rowMatchesSearch: (row, text) => this.rowMatchesSearch(row, text),
    });
  }

  private buildDataForGrouping(): any[] {
    let treeData = this.rowData;
    if (this.searchText && this.searchText.trim() !== '') {
      treeData = this.filterDataBySearch(this.rowData, this.searchText);
    }
    return this.filterDataBySkuFilter(treeData);
  }

  private applyGrouping(): void {
    const newRows = this.gridColumnsService.collectNewRowsForGrouping({
      displayData: this.displayData,
      storedNewRows: this.rowManagementService.getNewRows().values(),
      resolveSectionInternalName: (row) => this.resolveSectionInternalName(row),
      getRowAnchorId: (row) => this.getRowAnchorId(row),
      sectionDetails: this.dataService.getApiData()?.sectionDetails || {},
    });
    const treeData = this.buildDataForGrouping();

    if (this.activeGroupFields.length > 0) {
      let groupedTreeData = this.gridConfigService.groupHierarchicalData(
        treeData,
        this.activeGroupFields,
      );

      groupedTreeData = this.gridColumnsService.applySavedGroupState(
        groupedTreeData,
        this.groupExpandedState,
      );
      this.displayData = this.flattenDisplayData(groupedTreeData);
    } else {
      this.displayData = this.flattenDisplayData(treeData);
      this.groupExpandedState.clear();
    }

    this.gridColumnsService.insertNewRowsIntoDisplayData({
      displayData: this.displayData,
      newRows,
      getRowAnchorId: (row) => this.getRowAnchorId(row),
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
    if (this.handleReconnectButton(event, target, isReadOnlySkuFilter)) return;

    const clickedField = event.colDef?.field as string | undefined;

    if (clickedField === COL_ACTIONS) {
      this.handleActionsColumnClick(event);
      return;
    }

    if (this.isMaterialClickField(clickedField)) {
      this.handleMaterialColumnClick(event);
      return;
    }

    this.handleEditableCellClick(event, isReadOnlySkuFilter);
  }

  onRowClicked(event: any): void {
    const target = event.event?.target as HTMLElement | undefined;
    if (target?.closest?.('[data-action]')) {
      return;
    }
    // Section/group toggle is handled by the renderer click handler only.
    if (event?.data?.isSectionHeader || event?.data?.isGroupHeader) {
      return;
    }
  }

  private handleLinkIconClick(event: any): boolean {
    const iconTarget = event.event?.target as HTMLElement | undefined;
    const linkIconEl = iconTarget?.closest?.('.material-link-icon, .direct-link-icon');
    if (linkIconEl && event.data && !event.data.isNewRow) {
      event.event?.preventDefault?.();
      event.event?.stopPropagation?.();
      this.openLinkedBomModal(event.data);
      return true;
    }
    return false;
  }

  private hasAnyServiceFieldTouched(): boolean {
    const serviceSet = new Set(EBOM_SERVICE_FIELDS);
    for (const rowId of this.editedRows) {
      const fields = this.editedFields.get(rowId);
      if (fields && [...fields].some((f) => serviceSet.has(f))) return true;
    }
    return false;
  }

  private buildMaterialColorSavePayload(): { instances: { [key: string]: any } } {
    const instances: { [key: string]: any } = {};
    const serviceSet = new Set(EBOM_SERVICE_FIELDS);
    if (!this.gridApi) return { instances };

    this.gridApi.forEachNode((node: any) => {
      const row = node?.data;
      if (!row?.materialColorId) return;
      const rowId = this.utilService.getRowId(row) ?? '';
      const compositeId = this.utilService.getCompositeSectionPartId(row);
      const isEdited =
        this.editedRows.has(rowId) ||
        (compositeId && this.editedRows.has(compositeId)) ||
        this.editedRows.has(row.materialColorId);
      if (!isEdited) return;
      const editedFieldsForRow =
        this.editedFields.get(rowId) ??
        this.editedFields.get(compositeId ?? '') ??
        this.editedFields.get(row.materialColorId) ??
        new Set<string>();
      const touchedService = new Set([...editedFieldsForRow].filter((f) => serviceSet.has(f)));
      if (touchedService.size === 0) return;

      const instanceData = this.dataService.buildMaterialColorInstanceData(row, touchedService);
      if (Object.keys(instanceData).length > 0) {
        instances[row.materialColorId] = instanceData;
      }
    });
    return { instances };
  }

  private runBomSaveStep(): void {
    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        this.isSaving = false;
        if (result.success) {
          this.hasDisconnectEdits = false;
          this.disconnectedSkuKeys.clear();
          this.showDisconnectedSkusPanel = true;
          this.invalidRowIds.clear();
          this.rowManagementService.showSaveMessage(result.message, this, NOTIFICATION_TYPE_SUCCESS);
        } else {
          this.rowManagementService.showSaveMessage(result.message, this, NOTIFICATION_TYPE_ERROR);
        }
      })
      .catch(() => {
        this.isSaving = false;
        this.rowManagementService.showSaveMessage(
          'An unexpected error occurred while saving. Please try again.',
          this,
          NOTIFICATION_TYPE_ERROR_PERSISTENT,
        );
      });
  }

  private clearAutopopulateFieldsForRow(data: any): void {
    if (!data) return;
    const fieldsToClear = [
      ...EDITABLE_AUTOPOPULATED_FIELDS,
      'colorId',
      'materialSupplierMasterId',
      '_availablePartNumbers',
    ];
    fieldsToClear.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(data, f)) {
        data[f] = f === '_availablePartNumbers' ? [] : '';
      }
    });
  }

  private handlePartNumberFieldClick(event: any): boolean {
    if (this.isPartNumberEditField(event.colDef?.field)) {
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
    if (this.isEbomMode()) return true;
    if (isReadOnlySkuFilter || event.colDef?.isDisabled) {
      return true;
    }
    if (this.skuService.isSkuField(event.colDef.field) && event.data?.isNewRow) {
      this.rowManagementService.pastePartNumber(event, this);
    }
    return true;
  }

  private handleDeleteButton(event: any, target: HTMLElement, isReadOnlySkuFilter: boolean): boolean {
    const deleteButton = target?.closest('[data-action="clear-sku"]');
    if (!deleteButton) return false;

    event.event.preventDefault();
    event.event.stopPropagation();
    if (this.isEbomMode()) return true;
    if (isReadOnlySkuFilter) {
      return true;
    }
    if (this.skuService.isSkuField(event.colDef.field) && event.data?.isNewRow) {
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
    if (skuField && event.data && this.canDisconnectForRow(event.data)) {
      this.disconnectPartFromSku(event.data, skuField, event.event);
    }
    return true;
  }

  private handleReconnectButton(event: any, target: HTMLElement, isReadOnlySkuFilter: boolean): boolean {
    const reconnectButton = target?.closest('[data-action="reconnect-sku"]');
    if (!(reconnectButton instanceof HTMLElement)) return false;

    if (isReadOnlySkuFilter) return true;
    const skuField = reconnectButton.dataset['skuField'];
    if (skuField && event.data) {
      this.reconnectPartFromSku(event.data, skuField, event.event);
    }
    return true;
  }

  private handleEditableCellClick(event: any, isReadOnlySkuFilter: boolean): void {
    if (!event.data || event.data.isSectionHeader) return;

    const field = event.colDef.field;
    if (!field || field === COL_ACTIONS || this.skuService.isSkuField(field)) return;

    const isDateColumn = this.isDateEditField(field);
    const isSpecSheetField = this.isSpecSheetEditField(field);
    const isAutocompleteField = isSpecSheetField || this.isMaterialClickField(field);

    const isEditable =
      !isReadOnlySkuFilter &&
      (event.data.isNewRow ||
        this.gridConfigService.isFieldEditableInSbom(
          field,
          event.data,
          () => this.isSkuFilterReadOnly(),
          () => this.isSbomMode(),
          () => this.isEbomMode(),
          () => this.isMaterialMbomMode(),
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

  private isPartNumberEditField(field: string | undefined): boolean {
    return !!field && PART_NUMBER_EDIT_FIELDS.has(field);
  }

  private isMaterialClickField(field: string | undefined): boolean {
    return !!field && MATERIAL_CLICK_FIELDS.has(field);
  }

  private isDateEditField(field: string): boolean {
    return DATE_EDIT_FIELDS.has(field);
  }

  private isSpecSheetEditField(field: string): boolean {
    return SPEC_SHEET_EDIT_FIELDS.has(field);
  }

  private handleActionsColumnClick(event: any): void {
    const target = event.event?.target as HTMLElement;
    if (!target) return;

    const actionHandlers: Record<string, () => void> = {
      'add-row-btn': () => {
        const rowIndex = event.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          this.addRowAfter(rowIndex);
        }
      },
      'delete-row-btn': () => this.handleDeleteRowAction(target),
    };

    for (const [className, handler] of Object.entries(actionHandlers)) {
      if (target.classList.contains(className)) {
        handler();
        return;
      }
    }
  }

  private handleDeleteRowAction(target: HTMLElement): void {
    const partId = target.dataset['partId'];
    const newRowId = target.dataset['newRowId'];

    if (newRowId) {
      this.deleteRowById(Number.parseInt(newRowId));
      return;
    }

    if (partId) {
      this.deleteRow(partId);
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

  openLinkedBomModal(materialData: any): void {
    if (!materialData) return;

    if (materialData.linkedBom !== '1' && materialData.linkedBom !== 1) {
      return;
    }

    const materialMasterId = materialData.childId;
    if (materialMasterId == null || String(materialMasterId).trim() === '') {
      return;
    }

    const requestId = ++this.linkedBomRequestId;
    this.selectedLinkedBomData = {
      material: materialData?.material || materialData?.materialDescription || materialData?.materialMasterId || '',
      instances: [],
      columns: {},
    };
    this.selectedLinkedBomSkuData = [];
    this.isLinkedBomLoading = true;
    this.showLinkedBomModal = true;

    const sub = this.dataService.getComplexBOM(String(materialMasterId).trim()).subscribe({
      next: (bomData: any) => {
        if (requestId !== this.linkedBomRequestId) return;

        if (!bomData || typeof bomData !== 'object') {
          this.isLinkedBomLoading = false;
          this.showLinkedBomModal = false;
          this.showNotification('Failed to load linked BOM details.', NOTIFICATION_TYPE_ERROR);
          return;
        }

        this.selectedLinkedBomData = {
          ...bomData,
          instances: Array.isArray(bomData.instances) ? bomData.instances : [],
          columns: bomData.columns && typeof bomData.columns === 'object' ? bomData.columns : {},
        };
        this.selectedLinkedBomSkuData = [];
        this.isLinkedBomLoading = false;
      },
      error: (error: any) => {
        if (requestId !== this.linkedBomRequestId) return;

        this.isLinkedBomLoading = false;
        this.showLinkedBomModal = false;
        const message =
          error?.error?.message ||
          error?.message ||
          'Failed to load material BOM data.';
        this.showNotification(message, NOTIFICATION_TYPE_ERROR);
      },
    });
    this.subscriptions.push(sub);
  }

  closeLinkedBomModal(): void {
    this.linkedBomRequestId++;
    this.isLinkedBomLoading = false;
    this.showLinkedBomModal = false;
    this.selectedLinkedBomData = {};
    this.selectedLinkedBomSkuData = [];
  }

 saveChanges(): void {
    if (this.isSkuFilterReadOnly()) {
      this.showNotification(MSG_SAVE_DISABLED_VIEW_ONLY, NOTIFICATION_TYPE_INFO);
      return;
    }

    const rowValidationMap = new Map<any, { missingFields: string[], skuErrors: string[] }>();

    this.invalidRowIds.clear();
    const allDataRows = this.collectDataRowsFromGrid();
    allDataRows.forEach((row) => {
      row.validation = { isValid: true, missingFields: [], skuErrors: [] };
    });
    this.gridApi.refreshCells({ force: true, columns: [...COLUMNS_REFRESH_ACTIONS] });
    this.applyActionsColumnWidth(this.computeActionsColumnWidth());

    const bomType = this.dataService.getBomType() ?? '';
    const requiredFields = this.validationService.getRequiredFieldsForSave(bomType);
    const touchedRows = allDataRows.filter((row) => this.isRowTouched(row));
    const requiredFieldsOrGetter =
      bomType === BOM_TYPE_SBOM || bomType === BOM_TYPE_EBOM  || bomType === BOM_TYPE_MATERIALMBOM 
        ? (row: any) =>
            requiredFields.filter((f) =>
              f.keys.some((key) =>
                row.isNewRow
                  ? this.gridConfigService.isFieldEditableForNewRow(
                      key,
                      () => this.isSkuFilterReadOnly(),
                      () => this.isSbomMode(),
                      () => this.isEbomMode(),
                      () => this.isMaterialMbomMode(),
                    )
                  : this.gridConfigService.isFieldEditableInSbom(
                      key,
                      row,
                      () => this.isSkuFilterReadOnly(),
                      () => this.isSbomMode(),
                      () => this.isEbomMode(),
                      () => this.isMaterialMbomMode(),
                    ),
              ),
            )
        : requiredFields;
    const validationResult = this.validationService.validateRows(
      touchedRows,
      requiredFieldsOrGetter,
    );

    validationResult.invalidRows?.forEach((ir) => {
      rowValidationMap.set(ir.row, {
        missingFields: Array.isArray(ir.missingFields) ? ir.missingFields : [],
        skuErrors: [],
      });
      this.invalidRowIds.add(ir.rowId);
      const row = ir.row;
      if (row?.section && (row[FIELD_PART_NUMBER] || row.part)) {
        this.invalidRowIds.add(`${row.section}::${row[FIELD_PART_NUMBER] || row.part}`);
      }
    });

    const skuInfo = this.getFilteredSkuInfo();
    let skuValidationResult: { isValid: boolean; message: string; invalidRows?: any[] } = { isValid: true, message: '' };
    let hasPayloadErrors = false;

    if (!this.isEbomMode()) {
      skuValidationResult = this.validationService.validateNewRowsSkus(
        this.rowData,
        skuInfo,
        this.displayData,
      );
      skuValidationResult.invalidRows?.forEach(ir => {
        if (!this.isRowTouched(ir.row)) return;
        const existing = rowValidationMap.get(ir.row);
        if (existing) {
          existing.skuErrors = Array.isArray(ir.skuErrors)
            ? ir.skuErrors
            : ['SKU selection missing'];
        } else {
          rowValidationMap.set(ir.row, {
            missingFields: [],
            skuErrors: Array.isArray(ir.skuErrors)
              ? ir.skuErrors
              : ['SKU selection missing'],
          });
        }
      });

      const allNewRows = this.utilService.findAllNewRows(this.rowData, this.displayData);
      for (const newRow of allNewRows) {
        const payloadSkus = this.buildSkusArrayFromRow(newRow, skuInfo);
        const payloadValidation = this.validationService.validateSkuPayload(
          newRow,
          skuInfo,
          payloadSkus,
        );

        if (!payloadValidation.isValid) {
          hasPayloadErrors = true;
          if (this.isRowTouched(newRow)) {
            const existing = rowValidationMap.get(newRow);
            const skuErrorMessage = payloadValidation.message || 'No SKUs selected in row';
            if (existing) {
              existing.skuErrors.push(skuErrorMessage);
            } else {
              rowValidationMap.set(newRow, {
                missingFields: [],
                skuErrors: [skuErrorMessage],
              });
            }
          }
          const rowId = this.utilService.getRowId(newRow) || ROW_ID_UNKNOWN;
          this.invalidRowIds.add(rowId);
        }
      }
    }

    const apiData = this.dataService.getApiData();
    const duplicateValidation = this.validationService.validateDuplicateFeatureSkuCombination(
      this.rowData,
      this.displayData,
      skuInfo,
      apiData || undefined,
    );

    duplicateValidation.invalidRows?.forEach(ir => {
      if (!this.isRowTouched(ir.row)) return;
      const existing = rowValidationMap.get(ir.row);
      const duplicateMsg = duplicateValidation.message || ((this.isEbomMode() || this.isMaterialMbomMode()) ? 'Duplicate Part + Feature combination' : 'Duplicate Feature-SKU combination');
      if (existing) {
        existing.skuErrors.push(duplicateMsg);
      } else {
        rowValidationMap.set(ir.row, {
          missingFields: [],
          skuErrors: [duplicateMsg],
        });
      }
    });

    if (rowValidationMap.size > 0) {
      rowValidationMap.forEach((validation, row) => {
        row.validation = {
          isValid: false,
          missingFields: validation.missingFields,
          skuErrors: validation.skuErrors,
        };
      });
      this.gridApi.refreshCells({
        force: true,
        columns: [...COLUMNS_REFRESH_ACTIONS],
      });
      this.applyActionsColumnWidth(this.computeActionsColumnWidth());
    }

    if (this.handleValidationError(validationResult)) {
      return;
    }
    if (!this.isEbomMode()) {
      if (this.handleValidationError(skuValidationResult)) {
        return;
      }
      if (hasPayloadErrors) {
        this.handleValidationError({
          isValid: false,
          message: 'Please fix validation errors before saving.',
        } as any);
        return;
      }
    }
    if (this.handleValidationError(duplicateValidation)) {
      return;
    }

    this.isSaving = true;

    if ((this.isEbomMode() || this.isMaterialMbomMode()) && this.hasAnyServiceFieldTouched()) {
      const step1Payload = this.buildMaterialColorSavePayload();
      if (Object.keys(step1Payload.instances).length === 0) {
        this.runBomSaveStep();
        return;
      }
      this.dataService.saveMaterialColors(step1Payload).subscribe({
        next: () => this.runBomSaveStep(),
        error: (err: any) => {
          this.isSaving = false;
          const errors = err?.error?.errors ?? err?.error;
          if (errors && typeof errors === 'object') {
            Object.keys(errors).forEach((materialColorId) => {
              this.invalidRowIds.add(materialColorId);
              this.gridApi?.forEachNode((node: any) => {
                const row = node?.data;
                if (row?.materialColorId === materialColorId) {
                  const rid = this.utilService.getRowId(row);
                  if (rid) this.invalidRowIds.add(rid);
                  const compositeId = this.utilService.getCompositeSectionPartId(row);
                  if (compositeId) this.invalidRowIds.add(compositeId);
                }
              });
            });
          }
          this.refreshGridForValidationErrors();
          const msg = err?.error?.message ?? err?.message ?? 'Material color save failed.';
          this.showNotification(msg, NOTIFICATION_TYPE_ERROR);
        },
      });
    } else {
      this.runBomSaveStep();
    }
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
    this.showNotification(validationResult.message, NOTIFICATION_TYPE_ERROR);
    return true;
  }

  private refreshGridForValidationErrors(): void {
    this.forceRefreshGridCells();
  }

  /**
   * Collect all data rows from the grid (exact node.data the grid displays) for validation.
   * Ensures existing rows show validation because we validate the same objects the grid renders.
   */
  private collectDataRowsFromGrid(): any[] {
    const dataRows: any[] = [];
    if (!this.gridApi) return this.utilService.findAllDataRows(this.rowData, this.displayData);

    this.gridApi.forEachNode((node: any) => {
      const data = node?.data;
      if (this.utilService.isDataRowForValidation(data)) {
        dataRows.push(data);
      }
    });

    if (this.displayData?.length) {
      this.displayData.forEach((row) => {
        if (
          row.isNewRow &&
          this.utilService.isDataRowForValidation(row) &&
          !dataRows.some((r) => r === row || (r.newRowId !== undefined && r.newRowId === row.newRowId))
        ) {
          dataRows.push(row);
        }
      });
    }
    return dataRows;
  }

  /**
   * True if this specific row was touched (edited). Only touched rows get required-field and duplicate validation errors.
   * Uses the row's unique id (materialKey or newRowId) so another row with same Part/Section but different SKU is not considered touched.
   */
  private isRowTouched(row: any): boolean {
    return this.rowManagementService.isRowTouched(row, this.editedRows);
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
        obs.disconnect();
      }
      timeoutsArray.forEach((t) => clearTimeout(t));
      timeoutsArray.length = 0;
    };

    return () => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      cleanupObserverAndTimeouts(observerRef.current, timeouts);
      observerRef.current = null;
    };
  }


  addRowAfter(rowIndex: number): { newRow: any; newRowId: number } | null {
    const referenceRow = this.displayData[rowIndex];
    const { section, sectionDisplayName } = this.getSectionInfoForRow(rowIndex);
    const insertIndex = this.calculateInsertIndex(rowIndex);

    const result = this.rowManagementService.addRowAfter(
      insertIndex,
      this.displayData,
      this.gridApi,
      this.dataService,
      section,
      sectionDisplayName,
    );

    if (result?.newRow) {
      if (section) {
        result.newRow.insertAfterSection = section;
      }
      const anchorId = this.getRowAnchorId(referenceRow);
      if (anchorId !== undefined && anchorId !== null && anchorId !== '') {
        result.newRow.insertAfterRowId = anchorId;
      }
    }

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);

    return result ?? null;
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

    if (!section && !sectionDisplayName) {
      const fallback = this.getSectionFromDisplayIndex(rowIndex);
      section = fallback.section;
      sectionDisplayName = fallback.sectionDisplayName;
    }

    return { section, sectionDisplayName };
  }

  private getSectionFromDisplayIndex(rowIndex: number): { section: string | undefined; sectionDisplayName: string | undefined } {
    for (let i = rowIndex; i >= 0; i--) {
      const row = this.displayData[i];
      if (row?.isSectionHeader) {
        return { section: row.section, sectionDisplayName: row.sectionDisplayName };
      }
    }
    return { section: undefined, sectionDisplayName: undefined };
  }

  private resolveSectionInternalName(row: any): string | undefined {
    if (!row) return undefined;
    const current = row.section;
    if (current && String(current).trim() !== '') {
      return current;
    }

    const displayName = row.sectionDisplayName;
    if (!displayName || String(displayName).trim() === '') {
      return undefined;
    }

    const sectionDetails = this.dataService.getApiData()?.sectionDetails || {};
    const match = Object.keys(sectionDetails).find(
      (internalId) => sectionDetails[internalId] === displayName,
    );
    return match;
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

  private getRowAnchorId(row: any): string | number | null {
    if (!row) return null;
    if (row.materialKey != null) return row.materialKey;
    if (row.newRowId != null) return row.newRowId;
    if (row[FIELD_PART_NUMBER] != null && row[FIELD_PART_NUMBER] !== '') return row[FIELD_PART_NUMBER];
    if (row.part != null && row.part !== '') return row.part;
    return null;
  }

  deleteRowById(newRowId: number): void {
    const rowToDelete = this.displayData.find((row) => row.newRowId === newRowId);

    if (rowToDelete) {
      const baseIds = new Set([
        rowToDelete.materialKey,
        rowToDelete.newRowId,
        rowToDelete[FIELD_PART_NUMBER],
        rowToDelete.part,
        rowToDelete.section && (rowToDelete[FIELD_PART_NUMBER] || rowToDelete.part)
          ? `${rowToDelete.section}::${rowToDelete[FIELD_PART_NUMBER] || rowToDelete.part}`
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

    this.stopGridEditingSafely();

    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);

    this.forceRefreshGridCells();
  }

  deleteRow(partId: string): void {
    const maybeId = Number(partId);
    if (!Number.isNaN(maybeId)) {
      this.editedRows.delete(maybeId);
      if (this.editedFields) {
        this.editedFields.delete(maybeId);
      }
    }

    this.stopGridEditingSafely();

    this.rowManagementService.deleteRow(partId, this.displayData, this.gridApi);

    this.forceRefreshGridCells();
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
      this.applyGridSearch();
    }, 300);
  }

  private searchTextDebounceTimer: any;

  clearSearch(): void {
    this.searchText = '';
    this.applyGridSearch();
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
  }

  private rowMatchesSearch(
    row: any,
    searchText: string,
  ): boolean {
    if (!searchText || searchText.trim() === '') {
      return true;
    }

    const searchLower = searchText.toLowerCase().trim();
    const visibleFields = this.getVisibleColumnFields();
    const fieldsToSearch =
      visibleFields.length > 0 ? visibleFields : this.utilService.getAllSearchableFields(row);
    const excludedFields = this.utilService.getExcludedSearchFields();

    for (const key of fieldsToSearch) {
      if (excludedFields.has(key) || !Object.prototype.hasOwnProperty.call(row, key)) {
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
    const editingCells = event?.api?.getEditingCells?.() ?? [];
    const targetColId = event?.column?.getId?.() ?? event?.colDef?.field ?? '';
    const alreadyEditingSameCell =
      Array.isArray(editingCells) &&
      editingCells.some((cell: any) => {
        const editingColId =
          cell?.column?.getColId?.() ??
          cell?.column?.getId?.() ??
          cell?.colId ??
          '';
        const sameRow = cell?.rowIndex === event?.rowIndex && cell?.rowPinned === event?.rowPinned;
        return sameRow && editingColId === targetColId;
      });

    if (!alreadyEditingSameCell) {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
      });
    }

    const openPickerFromActiveEditor = (): boolean => {
      const editors = event.api.getCellEditorInstances({
        rowNodes: [event.node],
        columns: [event.column],
      });
      const activeEditor = Array.isArray(editors) ? editors[0] : null;
      if (!activeEditor || typeof activeEditor.getGui !== 'function') {
        return false;
      }

      const editorGui = activeEditor.getGui() as HTMLElement;
      if (!editorGui) return false;

      const dateInput = editorGui.querySelector(
        'input[type="date"], input[type="datetime-local"]',
      ) as HTMLInputElement | null;
      if (!dateInput) return false;

      dateInput.focus();
      if (typeof dateInput.showPicker === 'function') {
        try {
          dateInput.showPicker();
        } catch {
          dateInput.click();
        }
      } else {
        dateInput.click();
      }
      return true;
    };

    if (openPickerFromActiveEditor()) return;
    requestAnimationFrame(() => {
      if (openPickerFromActiveEditor()) return;
      setTimeout(() => {
        openPickerFromActiveEditor();
      }, 80);
    });
  }

  private handleAutocompleteFieldClick(event: any): void {
    const targetRowIndex = event.rowIndex;
    const targetColKey = event.column.getId();
    const gridContainer = getGridElement(event.api) as HTMLElement | undefined;

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
    } catch {
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


  private filterDataBySearch(data: any[], searchText: string): any[] {
    return this.gridService.filterHierarchicalData(data, searchText, {
      getBomType: () => this.dataService.getBomType() || DEFAULT_BOM_TYPE,
      getFilteredSkuInfo: () => this.getFilteredSkuInfo(),
      selectedSkuFilter: this.selectedSkuFilter,
      hasSkuInExistingResponse: (row, ids) => this.hasSkuInExistingResponse(row, ids),
      rowMatchesSearch: (row, text) => this.rowMatchesSearch(row, text),
    });
  }

  public applyGridSearch(): void {
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

  public applyGridSort(_params: unknown): void {
    if (!this.gridApi) return;

    setTimeout(() => {
      const sortModel = this.gridApi.getColumnState().filter((col: ColumnState) => !!col.sort);

      if (!sortModel || sortModel.length === 0) {
        this.applyGridSearch();
        return;
      }

      let dataToSort = this.rowData;
      if (this.searchText && this.searchText.trim() !== '') {
        dataToSort = this.filterDataBySearch(this.rowData, this.searchText);
      }
      dataToSort = this.filterDataBySkuFilter(dataToSort);

      if (!dataToSort || dataToSort.length === 0) {
        return;
      }

      const sortColId = sortModel[0].colId;
      const sortField = this.getFieldNameFromColId(sortColId || '') || sortColId;
      const sortDirection = sortModel[0].sort as 'asc' | 'desc';

      const sortedData = this.gridDataTransformService.sortTreeDataByField(
        dataToSort,
        sortField,
        sortDirection,
        (a, b, direction) => this.utilService.compareValues(a, b, direction),
      );
      const flatData = this.flattenDisplayData(sortedData);
      this.displayData = flatData;

      this.gridApi.setGridOption('rowData', flatData);

      this.gridApi.applyColumnState({
        state: sortModel,
        defaultState: { sort: null },
      });
    }, 10);
  }

  transformToTreeData(data: any): any[] {
    return this.gridDataTransformService.transformToTreeData(
      data,
      this.dataService.getBomType(),
      this.dataService.getSkuInfo(),
    );
  }

  /**
   * Store original values for existing rows to track changes
   * Only stores values for editable fields: startDate, endDate, quantity
   */
  private storeOriginalValues(): void {
    this.rowManagementService.captureOriginalValues(
      this.rowData,
      this.originalRowValues,
      this.editedFields,
    );
  }

  /**
   * Build skus array from row SKU fields (reusable helper)
   */
  private buildSkusArrayFromRow(row: any, skuInfo: SkuInfo[]): any[] {
    return this.payloadTransformService.buildSkusArrayFromRow(row, skuInfo, this.rowData);
  }
  /**
   * Transform grid row data back to API format with mixed edit/create support
   * For existing rows: Uses _old/_new suffixes for edited fields
   * For new rows: Uses regular fields and adds childId + colorId
   */
  transformGridDataToApiFormat(rowData: any[], skuInfoOverride?: any[]): any {
    const skuInfo = skuInfoOverride || this.getFilteredSkuInfo();
    const options: TransformGridDataToApiOptions = {
      skuInfoOverride: skuInfo,
      gridApi: this.gridApi,
      hasDisconnectEdits: this.hasDisconnectEdits,
      disconnectedSkuKeys: this.disconnectedSkuKeys,
      getDisconnectedKey: (r: any, f: string) => this.getDisconnectedKey(r, f),
    };
    return this.payloadTransformService.transformGridDataToApiFormat(
      rowData,
      this.displayData,
      this.editedRows,
      this.editedFields,
      this.originalRowValues,
      this.constraintsData,
      options,
    );
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'error-persistent' | 'info' = NOTIFICATION_TYPE_INFO,
  ): void {
    this.saveMessage = message;
    this.saveMessageType = type;

    if (type === NOTIFICATION_TYPE_SUCCESS || type === NOTIFICATION_TYPE_INFO || type === NOTIFICATION_TYPE_ERROR) {
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
          isEbomMode: () => this.isEbomMode(),
          isMaterialMbomMode: () => this.isMaterialMbomMode(),
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
    const excludedFields = [...EXCLUDED_FIELDS_EXPORT]; 

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
          const rowText = rowCount > 1 ? LABEL_ROWS : LABEL_ROW;
          message = `${MSG_EXPORT_EXCEL_SUCCESS_SELECTED}${rowCount} ${rowText} selected)`;
        } else {
          message = MSG_EXPORT_EXCEL_SUCCESS;
        }
        this.showNotification(message, NOTIFICATION_TYPE_SUCCESS);
      })
      .catch(() => {
        this.showNotification(MSG_EXPORT_EXCEL_ERROR, NOTIFICATION_TYPE_ERROR);
      });
  }

  disconnectPartFromSku(rowData: any, skuField: string, event?: any): void {
    if (!rowData || !skuField || !this.gridApi) return;
    if (this.isSkuFilterReadOnly() || !this.canDisconnectForRow(rowData)) return;
    if (!this.isSkuEditableForDisconnect(skuField)) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.hasDisconnectEdits = true;
    this.showDisconnectedSkusPanel = true;
    this.disconnectedSkuKeys.add(this.getDisconnectedKey(rowData, skuField));
    const rowId = this.utilService.getRowId(rowData);
    if (rowId) this.editedRows.add(rowId);

    const targetNode = this.utilService.findNodeByDataReference(this.gridApi, rowData);
    if (targetNode) {
      this.gridApi.refreshCells({
        rowNodes: [targetNode],
        columns: [skuField],
        force: true,
      });
    }
  }

  /**
   * When reconnecting, if this row has no other disconnects and no other edited fields,
   * clear it from editedRows/editedFields and invalidRowIds so Save can become disabled and validation is cleared.
   */
  private clearRowEditStateIfReverted(rowId: string | number, row?: any): void {
    this.rowManagementService.clearRowEditStateIfReverted({
      rowId,
      row,
      disconnectedSkuKeys: this.disconnectedSkuKeys,
      editedRows: this.editedRows,
      editedFields: this.editedFields,
      invalidRowIds: this.invalidRowIds,
      getDisconnectRowToken: (r) => this.getDisconnectRowToken(r),
    });
  }

  /** Revert a disconnect: remove from disconnectedSkuKeys so the SKU is no longer marked for disconnect on save. */
  reconnectPartFromSku(rowData: any, skuField: string, event?: any): void {
    if (!rowData || !skuField || !this.gridApi) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const key = this.getDisconnectedKey(rowData, skuField);
    if (!this.disconnectedSkuKeys.has(key)) return;

    this.disconnectedSkuKeys.delete(key);
    if (this.disconnectedSkuKeys.size === 0) this.hasDisconnectEdits = false;

    const rowId = this.utilService.getRowId(rowData);
    if (rowId !== null) {
      this.clearRowEditStateIfReverted(rowId, rowData);
    }

    const targetNode = this.utilService.findNodeByDataReference(this.gridApi, rowData);
    if (targetNode) {
      this.gridApi.refreshCells({
        rowNodes: [targetNode],
        columns: [skuField, ...COLUMNS_REFRESH_ACTIONS],
        force: true,
      });
    }
  }

  /** Revert one disconnected SKU from the panel item. */
  reconnectSkuFromPanel(
    item: { key: string; row?: any; skuField?: string },
    event?: Event
  ): void {
    event?.preventDefault();
    event?.stopPropagation();

    const panelKey = String(item?.key || '');
    if (!panelKey) return;

    const wasDeleted = this.disconnectedSkuKeys.delete(panelKey);
    if (!wasDeleted) return;

    if (this.disconnectedSkuKeys.size === 0) {
      this.hasDisconnectEdits = false;
    }

    const row = item?.row;
    const skuField = item?.skuField;
    const rowId = this.utilService.getRowId(row);
    if (rowId !== undefined && rowId !== null && String(rowId).trim() !== '') {
      this.clearRowEditStateIfReverted(rowId, row);
    }

    if (this.gridApi && skuField) {
      this.gridApi.refreshCells({
        columns: [skuField, ...COLUMNS_REFRESH_ACTIONS],
        force: true,
      });
    }
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

  /**
   * Row is eligible for disconnect only in SBOM: not read-only, existing row (not new),
   * not MBOM line item, and SpecSheet Extra is Yes.
   */
  canDisconnectForRow(row: any): boolean {
    if (!row || this.isSkuFilterReadOnly() || !this.isSbomMode()) return false;
    if (row.isNewRow) return false;
    if (row.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM) return false;
    const specSheetExtra = String(row[FIELD_BOM_LINK_SPEC_SHEET_EXTRA] ?? '').trim();
    return specSheetExtra === VALUE_SPEC_YES;
  }

  /** Key for disconnectedSkuKeys: rowId|skuField. Used for strikethrough and payload. */
  private getDisconnectRowToken(row: any): string {
    return this.utilService.getStableRowToken(row);
  }

  /** Key for disconnectedSkuKeys: rowToken|skuField. Used for strikethrough and payload. */
  getDisconnectedKey(row: any, skuField: string): string {
    return this.skuService.buildDisconnectedKey(this.getDisconnectRowToken(row), skuField);
  }

  isSkuDisconnected(row: any, skuField: string): boolean {
    return this.disconnectedSkuKeys.has(this.getDisconnectedKey(row, skuField));
  }

  /** True if SKU (from skuInfo) has isEditable === true; only then show disconnect cross and allow disconnect action. */
  isSkuEditableForDisconnect(skuField: string): boolean {
    return this.skuService.isSkuEditableForDisconnect(this.getFilteredSkuInfo(), skuField);
  }

  /** For tooltip: list of SKU names/labels that have values in this row. */
  getConnectedSkuLabelsForRow(row: any): string[] {
    return this.skuService.getConnectedSkuLabelsForRow(row, this.getFilteredSkuInfo());
  }

  closeDisconnectedSkusPanel(): void {
    this.showDisconnectedSkusPanel = false;
  }

  /** List of disconnected SKUs for the panel: part, skuId, and reconnect metadata. */
  getDisconnectedSkuList(): { part: string; skuId: string; key: string; row: any; skuField: string }[] {
    return this.skuService.getDisconnectedSkuList({
      gridApi: this.gridApi,
      skuInfo: this.getFilteredSkuInfo(),
      disconnectedSkuKeys: this.disconnectedSkuKeys,
      getDisconnectedKey: (row, skuField) => this.getDisconnectedKey(row, skuField),
      isEligibleRow: (row) => !!row && (row.isDirectRow || row.isSubRow || row.isNewRow),
    });
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
    if (this.selectedRows.size <= 1) {
      this.showNotification('Select more than 1 row to Mass Edit.', NOTIFICATION_TYPE_INFO);
      return;
    }

    if (this.isSkuFilterReadOnly()) {
      this.showSkuFilterEditableHint('Mass Edit');
      return;
    }

    this.massEditMode = true;
    const massEditState = this.massEditService.populateMassEditFields(
      Array.from(this.selectedRows),
      () => this.isMbomMode(),
      () => this.isSbomMode(),
      () => this.isEbomMode(),
      () => this.isMaterialMbomMode(),
    );
    this.massEditStartDate = massEditState.startDate;
    this.massEditEndDate = massEditState.endDate;
    this.massEditQuantity = massEditState.quantity;
    this.massEditIncludeInSpecSheet = massEditState.includeInSpecSheet;
  }

  openServiceDataManagerModal(): void {
    if (this.selectedRows.size <= 1) {
      this.showNotification('Select more than 1 row to for Service Data Manager.', NOTIFICATION_TYPE_INFO);
      return;
    }

    // Check for unsaved changes in the main grid
    const hasEditedRows = this.editedRows.size > 0;
    const hasNewRows = this.rowData.some((row: any) => row?.isNewRow === true && !row?.isSectionHeader && !row?.isGroupHeader && !row?.isMaterialHeader);
    
    if (hasEditedRows || hasNewRows) {
      const message = 'Any unsaved changes in the BOM Composer will be lost. Do you want to continue?';
      
      const proceed = confirm(message);
      if (!proceed) {
        return;
      }
    }

    const ids = new Set<string>();
    this.selectedRows.forEach((row: any) => {
      const id = row?.materialColorId;
      if (typeof id === 'string' && id.trim()) {
        ids.add(id.trim());
      }
    });

    this.serviceDataManagerModalMaterialColorIds = Array.from(ids);
    if (this.serviceDataManagerModalMaterialColorIds.length === 0) {
      this.showNotification('Selected rows do not contain Material Color IDs.', NOTIFICATION_TYPE_INFO);
      return;
    }

    this.showServiceDataManagerModal = true;
  }

  openPartEditModal(): void {
    if (this.selectedRows.size === 0) {
      this.showNotification('Select at least 1 row to Edit Parts.', NOTIFICATION_TYPE_INFO);
      return;
    }

    const selectedRows = Array.from(this.selectedRows);
    const hasReleasedRows = selectedRows.some((row: any) => this.isReleasedState(row));
    if (hasReleasedRows) {
      this.showNotification(
        'Please uncheck Released state row(s) to open Edit Parts.',
        NOTIFICATION_TYPE_INFO,
      );
      return;
    }

    const hasEditedRows = this.editedRows.size > 0;
    const hasNewRows = this.rowData.some(
      (row: any) =>
        row?.isNewRow === true && !row?.isSectionHeader && !row?.isGroupHeader && !row?.isMaterialHeader,
    );
    if (hasEditedRows || hasNewRows) {
      const message = 'Any unsaved changes in the BOM Composer will be lost. Do you want to continue?';
      const proceed = confirm(message);
      if (!proceed) {
        return;
      }
    }

    const ids = new Set<string>();
    selectedRows.forEach((row: any) => {
      const id = row?.materialColorId;
      if (typeof id === 'string' && id.trim()) {
        ids.add(id.trim());
      }
    });
    this.partEditModalMaterialColorIds = Array.from(ids);
    if (this.partEditModalMaterialColorIds.length === 0) {
      this.showNotification('Selected rows do not contain Material Color IDs.', NOTIFICATION_TYPE_INFO);
      return;
    }

    this.showPartEditModal = true;
  }

  private isReleasedState(row: any): boolean {
    const state = String(row?.[FIELD_MATERIAL_COLOR_STATUS] ?? '').trim().toLowerCase();
    if (!state) return false;
    return state === 'released' || state === 'release' || state.startsWith('release');
  }

  closeServiceDataManagerModal(): void {
    this.showServiceDataManagerModal = false;
    this.serviceDataManagerModalMaterialColorIds = [];
  }

  closePartEditModal(): void {
    this.showPartEditModal = false;
    this.partEditModalMaterialColorIds = [];
  }

  onServiceDataManagerModalDataSaved(): void {
    this.editedRows.clear();
    this.editedFields.clear();
    this.originalRowValues.clear();
    this.loadData();
  }

  onPartEditModalDataSaved(): void {
    this.editedRows.clear();
    this.editedFields.clear();
    this.originalRowValues.clear();
    this.loadData();
  }

  bulkDisconnectFromSkus(): void {
    if (this.isSkuFilterReadOnly() || !this.isSbomMode()) return;
    if (this.selectedRows.size === 0) {
      this.showNotification('Select at least 1 row to disconnect SKUs.', NOTIFICATION_TYPE_INFO);
      return;
    }
    if (!this.gridApi) return;

    const selectedNodes = this.gridApi.getSelectedNodes();
    const skuInfo = this.getFilteredSkuInfo();
    const skuFields: string[] = this.skuService.getFieldNames(skuInfo);
    const nodesToUpdate: any[] = [];

    selectedNodes.forEach((node: any) => {
      if (!node.data) return;

      const rowData = node.data;
      if (rowData.isNewRow || !this.canDisconnectForRow(rowData)) return;

      let hasChanges = false;
      skuFields.forEach((skuField) => {
        if (
          this.isSkuEditableForDisconnect(skuField) &&
          this.skuService.hasValue(rowData[skuField])
        ) {
          this.disconnectedSkuKeys.add(this.getDisconnectedKey(rowData, skuField));
          hasChanges = true;
        }
      });

      if (hasChanges) {
        this.hasDisconnectEdits = true;
        this.showDisconnectedSkusPanel = true;
        const rowId = this.utilService.getRowId(rowData);
        if (rowId) this.editedRows.add(rowId);
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

    if (this.skuFilterHighlightTimeout) {
      clearTimeout(this.skuFilterHighlightTimeout);
      this.skuFilterHighlightTimeout = null;
    }

    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    if (this.gridApi && (this.gridApi as any)._hoverSyncCleanup) {
      (this.gridApi as any)._hoverSyncCleanup();
    }

  }
}
