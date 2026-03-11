import {
  ChangeDetectorRef,
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  Renderer2,
  Inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { IconComponent } from '../icon/icon.component';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';
import { ColumnHeaderPinComponent } from '../column-header-pin/column-header-pin.component';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import {
  SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS,
  SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS,
  PART_EDIT_MODAL_DISABLED_FIELDS,
  FIELD_PART_NUMBER,
  FIELD_MATERIAL_COLOR_STATUS,
  FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO,
  PLACEHOLDER_SEARCH_SERVICES,
  COL_ACTIONS,
} from '../../constants';
import { DataService } from '../../services/data.service';
import { GridConfigService } from '../../services/grid/grid-config.service';
import { GridService, ColumnVisibilityConfig } from '../../services/grid/grid.service';
import { RowManagementService } from '../../services/row-management.service';
import { UtilService, ExtendedColDef } from '../../services/util.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

const COMPACT_COLUMN_FIELDS = new Set<string>([FIELD_PART_NUMBER, FIELD_MATERIAL_COLOR_STATUS]);

@Component({
  selector: 'app-ag-grid-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './ag-grid-edit-modal.component.html',
  styleUrls: ['./ag-grid-edit-modal.component.css'],
})
export class AgGridEditModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() materialColorIds: string[] = [];
  @Input() mode: 'service' | 'part' = 'service';
  @Output() modalClose = new EventEmitter<void>();
  @Output() save = new EventEmitter<any[]>();
  @Output() dataSaved = new EventEmitter<void>();

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  @ViewChild('massEditHeaderRow') massEditHeaderRow?: ElementRef<HTMLDivElement>;
  @ViewChild('massEditHeaderContent') massEditHeaderContent?: ElementRef<HTMLDivElement>;
  @ViewChild('modalGridContainer') modalGridContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('modalColumnPanel') modalColumnPanel!: ElementRef<HTMLElement>;
  @ViewChild('modalColumnsToggleBtn') modalColumnsToggleBtn!: ElementRef<HTMLElement>;
  @ViewChild('modalColumnCheckboxes') modalColumnCheckboxes!: ElementRef<HTMLElement>;

  public columnDefs: ColDef[] = [];
  public gridOptions: GridOptions = {};
  public defaultColDef: Partial<ColDef> = {};
  public rowData: any[] = [];
  private gridApi!: GridApi;
  public massEditMode = false;
  public massEditValues: { [field: string]: string } = {};
  public isMassEditing = false;
  private readonly editedRows = new Set<string | number>();
  private readonly editedFields = new Map<string | number, Set<string>>();
  private readonly originalRowValues = new Map<string | number, any>();
  private readonly actionsColumnCompactWidth = 44;
  private readonly actionsColumnErrorWidth = 60;
  public rowErrors: { [materialColorId: string]: string } = {};
  public successMessage: string = '';
  public showSuccessMessage: boolean = false;
  public isSaving: boolean = false;
  public isLoading = false;
  public loadErrorMessage: string = '';
  public selectedRowCount = 0;
  public showColumnVisibilityPanel = false;
  public draggedColumnModal: ColDef | null = null;
  public draggedColumnIndexModal = -1;
  public dragOverIndexModal = -1;
  private modalAutoScrollInterval: ReturnType<typeof setInterval> | null = null;
  private readonly MODAL_AUTO_SCROLL_THRESHOLD = 24;
  private readonly MODAL_AUTO_SCROLL_SPEED = 8;
  private modalPanelColumnOrder: ExtendedColDef[] = [];
  private readonly serviceLookupFields = new Set<string>([
    FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT,
    FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE,
    FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO,
  ]);

  public massEditAutocomplete: { [field: string]: { showDropdown: boolean; options: string[]; selectedIndex: number; top?: string; left?: string; width?: string } } = {};
  private massEditSearchSubjects: { [field: string]: Subject<string> } = {};
  private massEditSubscriptions: Subscription[] = [];
  private massEditInputElements: { [field: string]: HTMLInputElement } = {};
  private massEditScrollCleanupFns: Array<() => void> = [];

  public get modalTitle(): string {
    return this.mode === 'part' ? 'Part Edit' : 'Service Data Manager';
  }

  public get loadingText(): string {
    return this.mode === 'part' ? 'Loading part edit data...' : 'Loading service data...';
  }

  public get hasEditedRows(): boolean {
    return this.editedRows.size > 0;
  }

  public get colActionsField(): string {
    return COL_ACTIONS;
  }

  constructor(
    private readonly dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly gridService: GridService,
    private readonly rowManagementService: RowManagementService,
    private readonly utilService: UtilService,
    private readonly renderer: Renderer2,
    private readonly cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.initializeGrid();
    this.loadModalData();
  }

  private notifyGridLayoutChange(): void {
    if (this.gridApi) {
      setTimeout(() => {
        this.gridApi.refreshHeader();
      }, 50);
    }
  }


  private getDisabledFields(): Set<string> {
    return this.mode === 'part'
      ? new Set(PART_EDIT_MODAL_DISABLED_FIELDS)
      : new Set(SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS);
  }

  private getDropdownFields(): Set<string> {
    return this.mode === 'part' ? new Set<string>() : new Set(SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS);
  }

  private getServiceLookupFields(): Set<string> {
    return this.mode === 'part' ? new Set<string>() : this.serviceLookupFields;
  }

  private buildColumnDefs(columns: { [key: string]: string }): ColDef[] {
    const columnDefs: ColDef[] = [
      {
        headerName: '',
        field: COL_ACTIONS,
        colId: COL_ACTIONS,
        width: this.actionsColumnCompactWidth,
        minWidth: this.actionsColumnCompactWidth,
        maxWidth: this.actionsColumnErrorWidth,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        suppressMovable: true,
        suppressHeaderMenuButton: true,
        lockPosition: true,
        lockPinned: true,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: false,
        cellClassRules: {
          'actions-has-error': (params: any) =>
            !!(params.data?.materialColorId && this.rowErrors[params.data.materialColorId]),
        },
        headerComponent: undefined, // Keep utility actions column header simple (no pin control)
        cellRenderer: (params: any) => {
          const hasError = params.data?.materialColorId && this.rowErrors[params.data.materialColorId];
          if (hasError) {
            const errorMessage = this.rowErrors[params.data.materialColorId];
            const escapedMessage = this.utilService.escapeHtml(errorMessage);
            return `<div class="actions-cell-content"><span class="validation-error-icon" title="${escapedMessage}" aria-label="Row error">ⓘ</span></div>`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.data?.materialColorId && this.rowErrors[params.data.materialColorId]) {
            return this.rowErrors[params.data.materialColorId];
          }
          return null;
        },
      },
    ];

    const disabledFields = this.getDisabledFields();
    
    const dropdownFields = this.getDropdownFields();

    // Build columns in the order they appear in the API response
    Object.keys(columns).forEach((field) => {
      const headerName = columns[field];
      const isDisabled = disabledFields.has(field);
      const isDropdown = dropdownFields.has(field);
      const isCompactColumnField = COMPACT_COLUMN_FIELDS.has(field);
      const isPartNumberField = field === FIELD_PART_NUMBER;

      const colDef: ColDef = {
        headerName: headerName,
        field: field,
        width: isCompactColumnField ? 140 : 200,
        minWidth: isCompactColumnField ? 120 : 150,
        editable: !isDisabled,
        sortable: true,
        filter: true,
        suppressMovable: true,
        cellRenderer: (params: any) => {
          // Get column width - try multiple methods for reliability
          let columnWidth = 150; // default fallback
          if (params.column) {
            columnWidth = params.column.getActualWidth() || params.column.getWidth() || colDef.width || 150;
          } else {
            columnWidth = colDef.width || 150;
          }
          
          // Ensure we're using the correct value from params
          const cellValue = params.value;
          
          return this.utilService.createCellContentWithTooltip(
            cellValue,
            columnWidth
          );
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
      };

      // Add cell editor for dropdown fieldsparams.column?.getActualWidth() || colDef.width || 
      if (isDropdown) {
        colDef.cellEditor = AutocompleteCellEditorComponent;
        colDef.cellEditorParams = () => ({
          placeholder: PLACEHOLDER_SEARCH_SERVICES,
          isServiceSearch: true,
          context: {
            dataService: this.dataService,
          },
        });
        // Add CSS class to identify dropdown columns
        colDef.cellClass = 'dropdown-cell';
        colDef.headerClass = 'dropdown-header';
      }

      // Add value formatter for partNumber
      if (isPartNumberField) {
        colDef.valueFormatter = (params: any) => {
          return params.value || '';
        };
      }

      columnDefs.push(colDef);
    });

    return columnDefs;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showColumnVisibilityPanel) {
      this.showColumnVisibilityPanel = false;
      return;
    }
    this.handleCloseClick();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    this.utilService.handlePanelClickOutside(
      target,
      this.showColumnVisibilityPanel,
      this.modalColumnPanel,
      this.modalColumnsToggleBtn,
      (value) => (this.showColumnVisibilityPanel = value),
    );
  }

  private getModalColumnVisibilityConfig(): ColumnVisibilityConfig {
    return {
      gridApi: this.gridApi,
      allColumns: this.columnDefs as ExtendedColDef[],
      isSkuColumn: (col) => (col?.field ?? col?.colId) === COL_ACTIONS,
      isFieldGrouped: () => false,
      panelColumnOrder: this.modalPanelColumnOrder,
      setPanelColumnOrder: (order) => {
        this.modalPanelColumnOrder = order;
        this.cdr.detectChanges();
      },
    };
  }

  getModalVisibleColumnsForPanel(): ExtendedColDef[] {
    return this.gridService.getVisibleColumnsForPanel(this.getModalColumnVisibilityConfig());
  }

  toggleColumnVisibility(): void {
    this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
  }

  toggleModalColumnVisibility(col: ExtendedColDef, event: Event): void {
    const visible = (event.target as HTMLInputElement).checked;
    this.gridService.toggleColumnVisibility(col, visible, this.getModalColumnVisibilityConfig());
    this.cdr.detectChanges();
  }

  selectAllModalColumns(): void {
    this.gridService.selectAllColumns(this.getModalColumnVisibilityConfig());
    this.cdr.detectChanges();
  }

  clearAllModalColumns(): void {
    this.gridService.clearAllColumns(this.getModalColumnVisibilityConfig());
    this.cdr.detectChanges();
  }

  trackByModalColumnField(_index: number, col: ColDef): string {
    return col?.field ?? col?.colId ?? `col-${_index}`;
  }

  onModalColumnsPanelFocusOut(event: FocusEvent): void {
    const panel = this.modalColumnPanel?.nativeElement as HTMLElement | undefined;
    if (!panel) return;
    try {
      const relatedTarget = event.relatedTarget as Node | null;
      if (!relatedTarget || !panel.contains(relatedTarget)) {
        this.cdr.detectChanges();
      }
    } catch {
      this.cdr.detectChanges();
    }
  }

  onModalColumnMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('label')) {
      event.stopPropagation();
    }
  }

  onModalDragStart(event: DragEvent, col: ColDef, index: number): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('label')) {
      event.preventDefault();
      return;
    }
    this.draggedColumnModal = col;
    this.draggedColumnIndexModal = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', '');
    }
  }

  onModalDragEnd(_event: DragEvent): void {
    this.stopModalColumnAutoScroll();
    this.draggedColumnModal = null;
    this.draggedColumnIndexModal = -1;
    this.dragOverIndexModal = -1;
  }

  onModalDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.checkModalColumnAutoScroll(event);
  }

  onModalItemDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.draggedColumnIndexModal === -1 || this.draggedColumnIndexModal === index) {
      this.dragOverIndexModal = -1;
      this.stopModalColumnAutoScroll();
      return;
    }
    this.dragOverIndexModal = index;
    this.checkModalColumnAutoScroll(event);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onModalItemDragLeave(event: DragEvent): void {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      this.dragOverIndexModal = -1;
    }
  }

  onModalDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggedColumnModal || !this.gridApi) {
      this.resetModalDragState();
      return;
    }
    const visibleColumns = this.getModalVisibleColumnsForPanel();
    const targetIndex = this.dragOverIndexModal >= 0 ? this.dragOverIndexModal : visibleColumns.length - 1;
    if (this.draggedColumnIndexModal === targetIndex) {
      this.resetModalDragState();
      return;
    }
    const targetColumn = visibleColumns[targetIndex];
    if (!targetColumn) {
      this.resetModalDragState();
      return;
    }
    this.gridService.moveColumn(
      this.draggedColumnModal as ExtendedColDef,
      targetColumn,
      this.draggedColumnIndexModal,
      targetIndex,
      this.getModalColumnVisibilityConfig(),
    );
    this.resetModalDragState();
    this.cdr.detectChanges();
  }

  private resetModalDragState(): void {
    this.draggedColumnModal = null;
    this.draggedColumnIndexModal = -1;
    this.dragOverIndexModal = -1;
  }

  private checkModalColumnAutoScroll(event: DragEvent): void {
    const container = this.modalColumnCheckboxes?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseY = event.clientY;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const distanceFromTop = mouseY - rect.top;
    const distanceFromBottom = rect.bottom - mouseY;
    this.stopModalColumnAutoScroll();
    if (distanceFromTop < this.MODAL_AUTO_SCROLL_THRESHOLD && scrollTop > 0) {
      this.startModalColumnAutoScroll('up');
    } else if (
      distanceFromBottom < this.MODAL_AUTO_SCROLL_THRESHOLD &&
      scrollTop < scrollHeight - clientHeight
    ) {
      this.startModalColumnAutoScroll('down');
    }
  }

  private startModalColumnAutoScroll(direction: 'up' | 'down'): void {
    if (this.modalAutoScrollInterval) return;
    const container = this.modalColumnCheckboxes?.nativeElement;
    if (!container) return;
    this.modalAutoScrollInterval = setInterval(() => {
      if (!container) {
        this.stopModalColumnAutoScroll();
        return;
      }
      const amount = direction === 'up' ? -this.MODAL_AUTO_SCROLL_SPEED : this.MODAL_AUTO_SCROLL_SPEED;
      container.scrollTop += amount;
      const atTop = direction === 'up' && container.scrollTop <= 0;
      const atBottom =
        direction === 'down' && container.scrollTop >= container.scrollHeight - container.clientHeight;
      if (atTop || atBottom) {
        this.stopModalColumnAutoScroll();
      }
    }, 16);
  }

  stopModalColumnAutoScroll(): void {
    if (this.modalAutoScrollInterval) {
      clearInterval(this.modalAutoScrollInterval);
      this.modalAutoScrollInterval = null;
    }
  }

  private initializeGrid(): void {
    // ColumnDefs will be built dynamically from API response columns
    this.columnDefs = [];

    this.defaultColDef = {
      ...this.gridConfigService.getDefaultColDef(),
      headerComponent: ColumnHeaderPinComponent,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    };

    const commonOptions = this.gridConfigService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      suppressRowClickSelection: true,
      suppressMovableColumns: true,
      rowSelection: 'multiple',
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
      onGridReady: (params) => {
        this.gridApi = params.api;
        // If columns are already loaded, set them
        if (this.columnDefs.length > 0) {
          this.gridApi.setGridOption('columnDefs', this.columnDefs);
        }
        this.applyActionsColumnWidth(this.computeActionsColumnWidth());
        this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);
        this.setupMassEditScrollSync();
        // Notify grid to recalculate layout
        this.notifyGridLayoutChange();
      },
      onCellValueChanged: (params) => {
        if (params.data) {
          const materialColorId = params.data.materialColorId;
          if (!materialColorId) return;

          const fieldName = params.colDef?.field;
          if (!fieldName) return;
          const newValue = this.rowManagementService.getComparableFieldValue(
            fieldName,
            params.newValue,
            this.getServiceLookupFields(),
          );
          this.rowManagementService.syncEditedState({
            materialColorId,
            fieldName,
            newValue,
            rowData: this.rowData,
            originalRowValues: this.originalRowValues,
            editedRows: this.editedRows,
            editedFields: this.editedFields,
            serviceLookupFields: this.getServiceLookupFields(),
          });

          const rowIndex = this.rowData.findIndex((row) => row.materialColorId === materialColorId);
          if (rowIndex >= 0) {
            this.rowData[rowIndex] = {
              ...this.rowData[rowIndex],
              ...params.data,
              [fieldName]: newValue,
              materialColorId,
            };
          }

          if (this.rowErrors[materialColorId]) {
            this.clearRowError(materialColorId);
          }
        }
      },
      rowClassRules: {
        'edited-row': (params: any) => {
          return params.data?.materialColorId && this.editedRows.has(params.data.materialColorId);
        },
        'error-row': (params: any) => {
          return params.data?.materialColorId && this.rowErrors[params.data.materialColorId];
        },
      },
    };
  }

  handleCloseClick(): void {
    if (this.hasEditedRows) {
      const confirmed = confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    this.closeModal();
  }

  closeModal(): void {
    this.editedRows.clear();
    this.editedFields.clear();
    this.originalRowValues.clear();
    this.selectedRowCount = 0;
    this.rowErrors = {};
    this.applyActionsColumnWidth(this.computeActionsColumnWidth());
    this.showSuccessMessage = false;
    this.successMessage = '';
    this.modalClose.emit();
  }

  private showAutoHideSuccessMessage(message: string): void {
    this.successMessage = message;
    this.showSuccessMessage = true;
    this.notifyGridLayoutChange();

    setTimeout(() => {
      this.showSuccessMessage = false;
      this.notifyGridLayoutChange();
    }, 5000);
  }

  saveModal(): void {
    if (!this.gridApi) return;
    this.gridApi.stopEditing();
    if (this.editedRows.size === 0) return;

    const rowsByMaterialColorId = this.rowManagementService.buildRowsByMaterialColorId(this.gridApi);
    const instances = this.rowManagementService.buildEditedInstances({
      editedRows: this.editedRows,
      editedFields: this.editedFields,
      rowsByMaterialColorId,
      buildInstanceData: (currentRow, editedFieldsForRow) => {
        if (this.mode === 'part') {
          const data: any = {};
          editedFieldsForRow.forEach((field) => {
            data[field] = currentRow[field] ?? '';
          });
          return data;
        }
        return this.dataService.buildMaterialColorInstanceData(currentRow, editedFieldsForRow);
      },
    });

    if (Object.keys(instances).length === 0) return;

    this.rowErrors = {};
    this.applyActionsColumnWidth(this.computeActionsColumnWidth());
    this.showSuccessMessage = false;
    this.isSaving = true;

    const save$ =
      this.mode === 'part'
        ? this.dataService.savePartEditData({
            instances,
            materialColorIds: this.materialColorIds.join(','),
          })
        : this.dataService.saveMaterialColors({ instances });

    save$.subscribe({
      next: (response: any) => {
        
        // Handle errors from response
        const hasErrors = response?.errors && typeof response.errors === 'object' && Object.keys(response.errors).length > 0;
        
        if (hasErrors) {
          Object.keys(response.errors).forEach((materialColorId) => {
            const errorObj = response.errors[materialColorId];
            const rawErrorMessage = errorObj?.errorMessage || errorObj?.message || 'Unknown error occurred';
            this.rowErrors[materialColorId] = rawErrorMessage;
          });
          this.applyActionsColumnWidth(this.computeActionsColumnWidth());
          
          this.showSuccessMessage = false;

          this.rowManagementService.applyResponseInstances({
            instances: response?.instances,
            rowData: this.rowData,
            editedRows: this.editedRows,
            editedFields: this.editedFields,
            skipIds: new Set(Object.keys(this.rowErrors)),
            clearEditedState: true,
          });

          const successCount = response?.instances
            ? Object.keys(response.instances).filter((id) => !this.rowErrors[id]).length
            : 0;
          if (successCount > 0) {
            this.dataSaved.emit();
            this.showAutoHideSuccessMessage(
              `${successCount} row${successCount > 1 ? 's' : ''} saved successfully.`
            );
          } else {
            this.showSuccessMessage = false;
          }

          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', [...this.rowData]);
            this.gridApi.refreshCells({ 
              force: true,
              columns: [COL_ACTIONS]
            });
            this.gridApi.redrawRows();
          }

          this.notifyGridLayoutChange();

          const firstErrorId = Object.keys(this.rowErrors)[0];
          if (firstErrorId && this.gridApi) {
            let targetNode: any = null;
            this.gridApi.forEachNode((node) => {
              if (node.data?.materialColorId === firstErrorId) {
                targetNode = node;
              }
            });
            if (targetNode) {
              this.gridApi.ensureNodeVisible(targetNode, 'middle');
            }
          }
        } else {
          this.applyActionsColumnWidth(this.computeActionsColumnWidth());
          // No errors - update row data with saved instances (modal stays open)
          this.rowManagementService.applyResponseInstances({
            instances: response?.instances,
            rowData: this.rowData,
            editedRows: this.editedRows,
            editedFields: this.editedFields,
          });

          // Clear edited rows
          this.editedRows.clear();
          this.editedFields.clear();
          
          // Close mass edit mode after successful save
          if (this.massEditMode) {
            this.closeMassEditMode();
          }
          
          // Show success message
          const savedCount = Object.keys(response.instances || {}).length;
          this.showAutoHideSuccessMessage(
            savedCount === 1
              ? (this.mode === 'part' ? 'Part edit row saved successfully!' : 'Material color saved successfully!')
              : (this.mode === 'part'
                ? `${savedCount} part edit rows saved successfully!`
                : `${savedCount} material colors saved successfully!`)
          );
          
          // Get all current row data for emit
          const allRowData: any[] = [];
          this.gridApi.forEachNode((node) => {
            if (node.data) {
              allRowData.push({ ...node.data });
            }
          });
          this.save.emit(allRowData);
          
          // Emit dataSaved event to trigger parent refresh
          // This ensures parent page updates with checkbox selections
          this.dataSaved.emit();
          // Don't auto-close after successful save - user can close manually via close icon, cancel button, or ESC
        }
        this.isSaving = false;
      },
      error: (error: any) => {
        this.isSaving = false;
        const errorMessage = error?.error?.message || error?.message || (
          this.mode === 'part' ? 'Failed to save part edit data' : 'Failed to save material colors'
        );
        alert(`Error: ${errorMessage}`);
      },
    });
  }

  private flattenInstance(instance: any): any {
    if (!instance || typeof instance !== 'object') return {};
    const flattened: any = {};
    Object.keys(instance).forEach((key) => {
      const value = instance[key];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        key.toLowerCase().includes('attributes')
      ) {
        Object.assign(flattened, value);
      } else {
        flattened[key] = value;
      }
    });
    return flattened;
  }

  private loadModalData(): void {
    this.isLoading = true;
    this.loadErrorMessage = '';
    this.rowData = [];
    this.rowErrors = {};

    if (!Array.isArray(this.materialColorIds) || this.materialColorIds.length === 0) {
      this.isLoading = false;
      return;
    }

    const idsString = this.materialColorIds.join(',');
    const load$ =
      this.mode === 'part'
        ? this.dataService.searchPartEditData(idsString)
        : this.dataService.searchMaterialColors(idsString);

    load$.subscribe({
      next: (response: any) => {
        const instances = response?.instances;
        const columns = response?.columns;

        if (!instances || typeof instances !== 'object') {
          this.isLoading = false;
          this.loadErrorMessage = 'Failed to load service data.';
          return;
        }

        if (columns && typeof columns === 'object') {
          this.columnDefs = this.buildColumnDefs(columns);
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.columnDefs);
          }
        }

        this.rowData = Object.keys(instances).map((materialColorId) => {
          const flattened = this.flattenInstance(instances[materialColorId]);
          const rowData = {
            materialColorId,
            ...flattened,
            isSelected: false,
          };
          this.originalRowValues.set(materialColorId, { ...rowData });
          return rowData;
        });

        this.editedRows.clear();
        this.editedFields.clear();
        this.selectedRowCount = 0;
        this.applyActionsColumnWidth(this.computeActionsColumnWidth());

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }

        this.isLoading = false;
        setTimeout(() => this.notifyGridLayoutChange(), 100);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.loadErrorMessage =
          error?.error?.message || error?.message || (
            this.mode === 'part' ? 'Failed to load part edit data.' : 'Failed to load service data.'
          );
      },
    });
  }

  openMassEdit(): void {
    this.massEditMode = true;
    this.massEditValues = {};
    this.initializeMassEditAutocomplete();
    setTimeout(() => {
      this.setupMassEditScrollSync();
      this.notifyGridLayoutChange();
    }, 150);
  }

  closeMassEditMode(): void {
    this.massEditMode = false;
    this.massEditValues = {};
    this.cleanupMassEditAutocomplete();
    this.cleanupMassEditScrollSync();
    this.notifyGridLayoutChange();
  }

  private initializeMassEditAutocomplete(): void {
    const editableFields = this.getEditableFields();
    const dropdownFields = this.getDropdownFields();
    
    editableFields.forEach((field) => {
      if (!dropdownFields.has(field)) {
        return;
      }
      // Initialize autocomplete state
      if (!this.massEditAutocomplete[field]) {
        this.massEditAutocomplete[field] = {
          showDropdown: false,
          options: [],
          selectedIndex: -1,
          top: undefined,
          left: undefined,
          width: undefined,
        };
      }

      // Create search subject if it doesn't exist
      if (!this.massEditSearchSubjects[field]) {
        this.massEditSearchSubjects[field] = new Subject<string>();
        
        // Subscribe to search with debounce
        const searchSub = this.massEditSearchSubjects[field]
          .pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap((query) => {
              const effectiveQuery = query ?? '';
              if (effectiveQuery.length >= 1) {
                return this.dataService.searchServices(effectiveQuery, 20);
              }
              return of({ results: [], resultCount: 0, hasMore: false });
            }),
            catchError(() => {
              return of({ results: [], resultCount: 0, hasMore: false });
            })
          )
          .subscribe((response) => {
            const results = response.results || [];
            if (this.massEditAutocomplete[field]) {
              this.massEditAutocomplete[field].options = results
                .map((service: any) => service.displayValue || service.name || '')
                .filter((name: string) => name.length > 0);
              this.massEditAutocomplete[field].showDropdown = this.massEditAutocomplete[field].options.length > 0;
              this.massEditAutocomplete[field].selectedIndex = -1;
              
              // Position dropdown when it shows
              if (this.massEditAutocomplete[field].showDropdown) {
                setTimeout(() => this.positionMassEditDropdown(field), 0);
              }
            }
          });
        
        this.massEditSubscriptions.push(searchSub);
      }
    });
  }

  private cleanupMassEditAutocomplete(): void {
    this.massEditSubscriptions.forEach((sub) => sub.unsubscribe());
    this.massEditSubscriptions = [];
    
    Object.keys(this.massEditSearchSubjects).forEach((field) => {
      this.massEditSearchSubjects[field].complete();
    });
    this.massEditSearchSubjects = {};
    
    this.massEditAutocomplete = {};
  }

  onMassEditInputChange(field: string, value: string, event?: Event): void {
    this.massEditValues[field] = value;
    
    // Store input element reference
    if (event && event.target) {
      this.massEditInputElements[field] = event.target as HTMLInputElement;
    }
    
    if (this.massEditSearchSubjects[field]) {
      this.massEditSearchSubjects[field].next(value);
    }

    const autocompleteState = this.massEditAutocomplete[field];
    if (!autocompleteState) return;

    // Close dropdown if value is cleared
    if (!value) {
      autocompleteState.showDropdown = false;
      autocompleteState.selectedIndex = -1;
      return;
    }

    // Position dropdown when it shows
    setTimeout(() => this.positionMassEditDropdown(field), 0);
  }

  /**
   * Handle mass edit input click - ensure input gets focused
   */
  onMassEditInputClick(field: string, event: MouseEvent): void {
    // Stop propagation to prevent any parent handlers from interfering
    event.stopPropagation();
    
    const inputElement = event.target as HTMLInputElement;
    if (inputElement) {
      // Store input element reference
      this.massEditInputElements[field] = inputElement;
      
      // Ensure input is focused and cursor is positioned
      setTimeout(() => {
        if (inputElement !== this.document.activeElement) {
          inputElement.focus();
        }
        // Position cursor at end of text if there's a value
        if (inputElement.value) {
          inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
        }
      }, 0);
    }
  }

  /**
   * Handle mass edit input focus
   */
  onMassEditInputFocus(field: string, event?: FocusEvent): void {
    // Store input element reference
    if (event && event.target) {
      this.massEditInputElements[field] = event.target as HTMLInputElement;
    }
    
    const value = this.massEditValues[field] || '';
    if (value && this.massEditSearchSubjects[field]) {
      this.massEditSearchSubjects[field].next(value);
    }
  }

  private positionMassEditDropdown(field: string): void {
    const inputElement = this.massEditInputElements[field];
    if (!inputElement || !this.massEditAutocomplete[field]) return;

    const inputRect = inputElement.getBoundingClientRect();
    const viewportHeight = this.document.defaultView?.innerHeight || 0;
    const viewportWidth = this.document.defaultView?.innerWidth || 0;
    const dropdownHeight = 200; // max-height

    // Calculate position below input
    let top = inputRect.bottom + 2;
    let left = inputRect.left;
    let width = inputRect.width;

    // If dropdown would go below viewport, show above input
    if (top + dropdownHeight > viewportHeight) {
      if (inputRect.top - dropdownHeight > 0) {
        top = inputRect.top - dropdownHeight - 2;
      }
    }

    // Adjust if dropdown would go off right edge
    if (left + width > viewportWidth) {
      left = Math.max(0, viewportWidth - width - 10);
    }

    // Update dropdown position
    this.massEditAutocomplete[field].top = `${top}px`;
    this.massEditAutocomplete[field].left = `${left}px`;
    this.massEditAutocomplete[field].width = `${width}px`;
  }

  onMassEditInputKeyDown(field: string, event: KeyboardEvent): void {
    const autocomplete = this.massEditAutocomplete[field];
    if (!autocomplete) return;

    const keyHandlers: Record<string, () => void> = {
      ArrowDown: () => {
        event.preventDefault();
        autocomplete.selectedIndex = Math.min(
          autocomplete.selectedIndex + 1,
          autocomplete.options.length - 1
        );
      },
      ArrowUp: () => {
        event.preventDefault();
        autocomplete.selectedIndex = Math.max(autocomplete.selectedIndex - 1, -1);
      },
      Enter: () => {
        event.preventDefault();
        if (autocomplete.selectedIndex >= 0 && autocomplete.selectedIndex < autocomplete.options.length) {
          this.selectMassEditOption(field, autocomplete.options[autocomplete.selectedIndex]);
        } else if (autocomplete.options.length === 1) {
          this.selectMassEditOption(field, autocomplete.options[0]);
        } else {
          this.closeMassEditDropdown(field);
        }
      },
      Escape: () => {
        event.preventDefault();
        this.closeMassEditDropdown(field);
      },
    };

    keyHandlers[event.key]?.();
  }

  selectMassEditOption(field: string, option: string): void {
    this.massEditValues[field] = option;
    this.closeMassEditDropdown(field);
  }

  /**
   * Close mass edit dropdown
   */
  closeMassEditDropdown(field: string): void {
    // Use setTimeout to allow click events to fire before closing
    setTimeout(() => {
      if (this.massEditAutocomplete[field]) {
        this.massEditAutocomplete[field].showDropdown = false;
        this.massEditAutocomplete[field].selectedIndex = -1;
      }
    }, 200);
  }

  getMassEditAutocomplete(field: string): { showDropdown: boolean; options: string[]; selectedIndex: number; top?: string; left?: string; width?: string } {
    return this.massEditAutocomplete[field] || { showDropdown: false, options: [], selectedIndex: -1 };
  }

  applyMassEdit(): void {
    if (!this.gridApi || this.isMassEditing || this.rowData.length === 0) return;

    // Check if any mass edit values are set
    const hasValues = Object.values(this.massEditValues).some((val) => val && val.trim() !== '');
    if (!hasValues) {
      return;
    }

    const selectedNodes = this.gridApi.getSelectedNodes().filter((node: any) => !!node.data);
    const targetNodes: any[] = [];
    if (selectedNodes.length > 0) {
      targetNodes.push(...selectedNodes);
    } else {
      this.gridApi.forEachNode((node: any) => {
        if (node.data) targetNodes.push(node);
      });
    }
    if (targetNodes.length === 0) {
      return;
    }

    this.isMassEditing = true;
    setTimeout(() => {
      try {
        const nodesToUpdate: any[] = [];
        const columnsToUpdate: Set<string> = new Set();
        const disabledFields = this.getDisabledFields();

        // Apply to selected rows when selected, otherwise apply to all rows
        targetNodes.forEach((node: any) => {
          const rowData = node.data;
          const materialColorId = rowData.materialColorId;
          if (!materialColorId) return;

          // Capture baseline once before any field updates for this row.
          this.rowManagementService.ensureOriginalRowSnapshot({
            materialColorId,
            rowData: this.rowData,
            originalRowValues: this.originalRowValues,
            fallbackRow: rowData,
          });
          const wasRowEdited = this.editedRows.has(materialColorId);
          let rowValueChanged = false;
          let rowTouched = false;

          // Apply each mass edit value that was set
          // Only fields returned by getEditableFields() should be in massEditValues,
          // but we validate here as well for safety
          Object.keys(this.massEditValues).forEach((field) => {
            const rawValue = this.massEditValues[field];
            const value = rawValue?.trim();
            if (!value || disabledFields.has(field)) return;

            rowTouched = true;

            if (this.rowManagementService.hasComparableValueChanged({
              fieldName: field,
              currentValue: rowData[field],
              newValue: value,
              serviceLookupFields: this.getServiceLookupFields(),
            })) {
              rowData[field] = this.rowManagementService.getComparableFieldValue(
                field,
                value,
                this.getServiceLookupFields(),
              );
              rowValueChanged = true;
              columnsToUpdate.add(field);
            }

            this.rowManagementService.syncEditedState({
              materialColorId,
              fieldName: field,
              newValue: value,
              rowData: this.rowData,
              originalRowValues: this.originalRowValues,
              editedRows: this.editedRows,
              editedFields: this.editedFields,
              serviceLookupFields: this.getServiceLookupFields(),
            });
          });

          const isRowEditedNow = this.editedRows.has(materialColorId);
          if (rowTouched && (rowValueChanged || wasRowEdited !== isRowEditedNow)) {
            nodesToUpdate.push(node);
          }
        });

        if (nodesToUpdate.length > 0) {
          if (columnsToUpdate.size > 0) {
            this.gridApi.refreshCells({
              rowNodes: nodesToUpdate,
              columns: Array.from(columnsToUpdate),
              force: true,
            });
          }
          // Always redraw touched rows so edited-row class can be added/removed
          // even when only edit state changed (e.g., revert to modal-open values).
          this.gridApi.redrawRows({ rowNodes: nodesToUpdate });
        }

        // Clear mass edit values after applying (but keep mass edit mode open)
        this.massEditValues = {};
      } finally {
        this.isMassEditing = false;
      }
    }, 0);
  }

  getEditableFields(): string[] {
    const disabledFields = this.getDisabledFields();
    if (this.mode === 'part') {
      return this.columnDefs
        .filter((col) => !!col.field && col.field !== COL_ACTIONS && !disabledFields.has(String(col.field)))
        .map((col) => String(col.field));
    }

    return this.rowManagementService.getEditableServiceFields(
      this.columnDefs,
      disabledFields,
      AutocompleteCellEditorComponent,
    );
  }

  private getColumnDefByField(field: string): ColDef | undefined {
    return this.columnDefs.find((col) => col.field === field);
  }

  onSelectionChanged(params: any): void {
    this.selectedRowCount = params?.api?.getSelectedNodes?.().length || 0;
  }

  isDropdownField(field: string): boolean {
    const colDef = this.getColumnDefByField(field);
    return this.rowManagementService.isServiceSearchColumn(
      colDef,
      AutocompleteCellEditorComponent,
    );
  }

  getColumnHeaderName(field: string): string {
    const colDef = this.getColumnDefByField(field);
    return colDef?.headerName || field;
  }

  getColumnWidth(field: string): number {
    const colDef = this.getColumnDefByField(field);
    return colDef?.width || 200;
  }

  private computeActionsColumnWidth(): number {
    return this.hasErrors() ? this.actionsColumnErrorWidth : this.actionsColumnCompactWidth;
  }

  private applyActionsColumnWidth(width: number): void {
    if (!this.gridApi) return;
    this.gridApi.setColumnWidths([{ key: COL_ACTIONS, newWidth: width }], false);
  }

  private refreshActionsErrorUi(): void {
    this.applyActionsColumnWidth(this.computeActionsColumnWidth());
    if (!this.gridApi) return;
    this.gridApi.refreshCells({
      force: true,
      columns: [COL_ACTIONS],
    });
    this.gridApi.redrawRows();
  }

  getRowError(materialColorId: string): string | null {
    return this.rowErrors[materialColorId] || null;
  }

  clearRowError(materialColorId: string): void {
    if (this.rowErrors[materialColorId]) {
      delete this.rowErrors[materialColorId];
      this.refreshActionsErrorUi();
      if (!this.hasErrors()) {
        this.notifyGridLayoutChange();
      }
    }
  }

  clearAllErrors(): void {
    this.rowErrors = {};
    this.refreshActionsErrorUi();
    this.notifyGridLayoutChange();
  }

  getErrorEntries(): Array<{ materialColorId: string; message: string }> {
    return Object.keys(this.rowErrors).map((materialColorId) => ({
      materialColorId,
      message: this.rowErrors[materialColorId],
    }));
  }

  getPartNumberForError(materialColorId: string): string {
    const row = this.rowData.find((r) => r.materialColorId === materialColorId);
    return row?.[FIELD_PART_NUMBER] || materialColorId;
  }

  hasErrors(): boolean {
    return Object.keys(this.rowErrors).length > 0;
  }

  ngAfterViewInit(): void {
    if (this.massEditMode) {
      setTimeout(() => this.setupMassEditScrollSync(), 100);
    }
  }

  ngOnDestroy(): void {
    this.cleanupMassEditAutocomplete();
    this.cleanupMassEditScrollSync();
    
    // Cleanup ResizeObserver
    if ((this as any)._resizeObserver) {
      (this as any)._resizeObserver.disconnect();
    }
  }

  private setupMassEditScrollSync(): void {
    this.cleanupMassEditScrollSync();

    if (!this.gridApi || !this.massEditHeaderRow || !this.modalGridContainer) return;

    const gridContainer = this.modalGridContainer.nativeElement.querySelector(
      '.ag-body-viewport',
    ) as HTMLElement | null;
    const headerRow = this.massEditHeaderRow.nativeElement;

    if (!gridContainer || !headerRow) return;

    const gridScrollUnlisten = this.renderer.listen(gridContainer, 'scroll', () => {
      headerRow.scrollLeft = gridContainer.scrollLeft;
    });

    const headerScrollUnlisten = this.renderer.listen(headerRow, 'scroll', () => {
      if (gridContainer.scrollLeft !== headerRow.scrollLeft) {
        gridContainer.scrollLeft = headerRow.scrollLeft;
      }
    });

    this.massEditScrollCleanupFns.push(gridScrollUnlisten, headerScrollUnlisten);
  }

  private cleanupMassEditScrollSync(): void {
    this.massEditScrollCleanupFns.forEach((cleanup) => cleanup());
    this.massEditScrollCleanupFns = [];
  }

}
