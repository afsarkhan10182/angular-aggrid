import {
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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { IconComponent } from '../icon/icon.component';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';
import { ColumnHeaderPinComponent } from '../column-header-pin/column-header-pin.component';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import {
  SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS,
  SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS,
  FIELD_PART_NUMBER,
  FIELD_MATERIAL_COLOR_STATUS,
  PLACEHOLDER_SEARCH_SERVICES,
  COL_ERROR_INDICATOR,
} from '../../constants';
import { DataService } from '../../services/data.service';
import { GridConfigService } from '../../services/grid-config.service';
import { MassEditService } from '../../services/mass-edit.service';
import { UtilService } from '../../services/util.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-service-data-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './service-data-manager-modal.component.html',
  styleUrls: ['./service-data-manager-modal.component.css'],
})
export class ServiceDataManagerModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() materialColorIds: string[] = [];
  @Output() modalClose = new EventEmitter<void>();
  @Output() save = new EventEmitter<any[]>();
  @Output() dataSaved = new EventEmitter<void>();

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  @ViewChild('massEditHeaderRow') massEditHeaderRow?: ElementRef<HTMLDivElement>;
  @ViewChild('massEditHeaderContent') massEditHeaderContent?: ElementRef<HTMLDivElement>;
  @ViewChild('modalGridContainer') modalGridContainer?: ElementRef<HTMLDivElement>;

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
  public rowErrors: { [materialColorId: string]: string } = {};
  public successMessage: string = '';
  public showSuccessMessage: boolean = false;
  public isSaving: boolean = false;

  public massEditAutocomplete: { [field: string]: { showDropdown: boolean; options: string[]; selectedIndex: number; top?: string; left?: string; width?: string } } = {};
  private massEditSearchSubjects: { [field: string]: Subject<string> } = {};
  private massEditSubscriptions: Subscription[] = [];
  private massEditInputElements: { [field: string]: HTMLInputElement } = {};

  public get hasEditedRows(): boolean {
    return this.editedRows.size > 0;
  }

  constructor(
    private readonly dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly massEditService: MassEditService,
    private readonly utilService: UtilService
  ) {}

  ngOnInit(): void {
    this.initializeGrid();
    this.loadMaterialColors();
  }

  private notifyGridLayoutChange(): void {
    if (this.gridApi) {
      setTimeout(() => {
        this.gridApi.refreshHeader();
      }, 50);
    }
  }


  private getDisabledFields(): Set<string> {
    return new Set(SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS);
  }

  private buildColumnDefs(columns: { [key: string]: string }): ColDef[] {
    const columnDefs: ColDef[] = [
      {
        headerName: '',
        field: COL_ERROR_INDICATOR,
        colId: COL_ERROR_INDICATOR,
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        suppressMovable: true,
        headerClass: 'error-indicator-header',
        cellClass: 'error-indicator-cell',
        headerComponent: undefined, // Don't show pin icon on error indicator column
        cellRenderer: (params: any) => {
          // Show error icon if row has error
          const hasError = params.data?.materialColorId && this.rowErrors[params.data.materialColorId];
          if (hasError) {
            const errorMessage = this.rowErrors[params.data.materialColorId];
            const escapedMessage = this.escapeHtml(errorMessage);
            return `<span class="validation-error-icon" title="${escapedMessage}" aria-label="Row error">ⓘ</span>`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          // Show raw error message from backend in tooltip
          if (params.data?.materialColorId && this.rowErrors[params.data.materialColorId]) {
            return this.rowErrors[params.data.materialColorId];
          }
          return null;
        },
      },
    ];

    const disabledFields = this.getDisabledFields();
    
    const dropdownFields = new Set(SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS);

    // Build columns in the order they appear in the API response
    Object.keys(columns).forEach((field) => {
      const headerName = columns[field];
      const isDisabled = disabledFields.has(field);
      const isDropdown = dropdownFields.has(field);
      const isPartNumberField = field === FIELD_PART_NUMBER;

      const colDef: ColDef = {
        headerName: headerName,
        field: field,
        width: isPartNumberField || field === FIELD_MATERIAL_COLOR_STATUS ? 140 : 200,
        minWidth: isPartNumberField || field === FIELD_MATERIAL_COLOR_STATUS ? 120 : 150,
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
    this.handleCloseClick();
  }

  private initializeGrid(): void {
    // ColumnDefs will be built dynamically from API response columns
    this.columnDefs = [];

    this.defaultColDef = {
      ...this.gridConfigService.getDefaultColDef(),
      headerComponent: ColumnHeaderPinComponent,
      suppressMovable: true,
    };

    const commonOptions = this.gridConfigService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      suppressRowClickSelection: true,
      suppressMovableColumns: true,
      rowSelection: 'single',
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

          if (!this.originalRowValues.has(materialColorId)) {
            const originalRow = this.rowData.find((row) => row.materialColorId === materialColorId);
            if (originalRow) {
              this.originalRowValues.set(materialColorId, { ...originalRow });
            }
          }

          const originalRow = this.originalRowValues.get(materialColorId);
          
          const normalizeValue = (val: any): string => {
            if (val === null || val === undefined) return '';
            return String(val).trim();
          };

          let originalValue: any;
          let newValue: any;
          
          if (fieldName === 'materialColorServiceEquivalent' || 
              fieldName === 'materialColorServiceSubstituteOne' || 
              fieldName === 'materialColorServiceSubstituteTwo') {
            originalValue = originalRow?.[fieldName] || '';
            newValue = params.newValue || '';
          } else {
            originalValue = originalRow?.[fieldName];
            newValue = params.newValue;
          }

          const normalizedOriginal = normalizeValue(originalValue);
          const normalizedNew = normalizeValue(newValue);
          const hasChanged = normalizedOriginal !== normalizedNew;

          if (hasChanged) {
            this.editedRows.add(materialColorId);
            if (!this.editedFields.has(materialColorId)) {
              this.editedFields.set(materialColorId, new Set());
            }
            this.editedFields.get(materialColorId)!.add(fieldName);
          } else {
            if (this.editedFields.has(materialColorId)) {
              this.editedFields.get(materialColorId)!.delete(fieldName);
              if (this.editedFields.get(materialColorId)!.size === 0) {
                this.editedRows.delete(materialColorId);
                this.editedFields.delete(materialColorId);
              }
            }
          }

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
    this.rowErrors = {};
    this.showSuccessMessage = false;
    this.successMessage = '';
    this.modalClose.emit();
  }

  saveModal(): void {
    if (!this.gridApi) return;
    this.gridApi.stopEditing();
    if (this.editedRows.size === 0) return;

    const instances: { [key: string]: any } = {};
    
    this.editedRows.forEach((materialColorId) => {
      let currentRow: any = null;
      this.gridApi.forEachNode((node) => {
        if (node.data?.materialColorId === materialColorId) {
          currentRow = node.data;
        }
      });

      if (!currentRow) {
        return;
      }

      const editedFieldsForRow = this.editedFields.get(materialColorId);
      if (!editedFieldsForRow || editedFieldsForRow.size === 0) {
        return;
      }

      const instanceData = this.dataService.buildMaterialColorInstanceData(currentRow, editedFieldsForRow);
      if (Object.keys(instanceData).length > 0) {
        instances[materialColorId] = instanceData;
      }
    });

    if (Object.keys(instances).length === 0) return;

    this.rowErrors = {};
    this.showSuccessMessage = false;
    this.isSaving = true;

    const payload = { instances };

    this.dataService.saveMaterialColors(payload).subscribe({
      next: (response: any) => {
        
        // Handle errors from response
        const hasErrors = response?.errors && typeof response.errors === 'object' && Object.keys(response.errors).length > 0;
        
        if (hasErrors) {
          Object.keys(response.errors).forEach((materialColorId) => {
            const errorObj = response.errors[materialColorId];
            const rawErrorMessage = errorObj?.errorMessage || errorObj?.message || 'Unknown error occurred';
            this.rowErrors[materialColorId] = rawErrorMessage;
          });
          
          this.showSuccessMessage = false;

          if (response?.instances && typeof response.instances === 'object') {
            Object.keys(response.instances).forEach((materialColorId) => {
              if (!this.rowErrors[materialColorId]) {
                const updatedData = response.instances[materialColorId];
                const rowIndex = this.rowData.findIndex((row) => row.materialColorId === materialColorId);
                if (rowIndex >= 0) {
                  this.rowData[rowIndex] = {
                    ...this.rowData[rowIndex],
                    ...updatedData,
                    materialColorId,
                  };
                  this.editedRows.delete(materialColorId);
                  this.editedFields.delete(materialColorId);
                }
              }
            });
          }

          const successCount = response?.instances ? Object.keys(response.instances).length : 0;
          if (successCount > 0) {
            this.dataSaved.emit();
            this.successMessage = `${successCount} row${successCount > 1 ? 's' : ''} saved successfully.`;
            this.showSuccessMessage = true;
            this.notifyGridLayoutChange();
            setTimeout(() => {
              this.showSuccessMessage = false;
              this.notifyGridLayoutChange();
            }, 5000);
          } else {
            this.showSuccessMessage = false;
          }

          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', [...this.rowData]);
            this.gridApi.refreshCells({ 
              force: true,
              columns: [COL_ERROR_INDICATOR]
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
          // No errors - update row data with saved instances (modal stays open)
          if (response?.instances && typeof response.instances === 'object') {
            Object.keys(response.instances).forEach((materialColorId) => {
              const updatedData = response.instances[materialColorId];
              const rowIndex = this.rowData.findIndex((row) => row.materialColorId === materialColorId);
              if (rowIndex >= 0) {
                this.rowData[rowIndex] = {
                  ...this.rowData[rowIndex],
                  ...updatedData,
                  materialColorId, // Ensure materialColorId is preserved
                };
              }
            });
          }

          // Clear edited rows
          this.editedRows.clear();
          this.editedFields.clear();
          
          // Close mass edit mode after successful save
          if (this.massEditMode) {
            this.closeMassEditMode();
          }
          
          // Show success message
          const savedCount = Object.keys(response.instances || {}).length;
          this.successMessage = savedCount === 1 
            ? 'Material color saved successfully!' 
            : `${savedCount} material colors saved successfully!`;
          this.showSuccessMessage = true;
          this.notifyGridLayoutChange();
          
          setTimeout(() => {
            this.showSuccessMessage = false;
            this.notifyGridLayoutChange();
          }, 5000);
          
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
        const errorMessage = error?.error?.message || error?.message || 'Failed to save material colors';
        alert(`Error: ${errorMessage}`);
      },
    });
  }

  private loadMaterialColors(): void {
    if (!Array.isArray(this.materialColorIds) || this.materialColorIds.length === 0) return;

    const idsString = this.materialColorIds.join(',');
    this.dataService.searchMaterialColors(idsString).subscribe((response: any) => {
      const instances = response?.instances;
      const columns = response?.columns;
      
      if (!instances || typeof instances !== 'object') return;

      if (columns && typeof columns === 'object') {
        this.columnDefs = this.buildColumnDefs(columns);
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.columnDefs);
        }
      }

      this.rowData = Object.keys(instances).map((materialColorId) => {
        const rowData = {
          materialColorId,
          ...instances[materialColorId],
          isSelected: false,
        };
        this.originalRowValues.set(materialColorId, { ...rowData });
        return rowData;
      });

      this.editedRows.clear();
      this.editedFields.clear();

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }

      setTimeout(() => this.notifyGridLayoutChange(), 100);
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
    this.notifyGridLayoutChange();
  }

  private initializeMassEditAutocomplete(): void {
    const editableFields = this.getEditableFields();
    
    editableFields.forEach((field) => {
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
    
    // Close dropdown if value is cleared
    if (!value && this.massEditAutocomplete[field]) {
      this.massEditAutocomplete[field].showDropdown = false;
      this.massEditAutocomplete[field].selectedIndex = -1;
    } else if (value && this.massEditAutocomplete[field]) {
      // Position dropdown when it shows
      setTimeout(() => this.positionMassEditDropdown(field), 0);
    }
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
        if (inputElement !== document.activeElement) {
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
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
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

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        autocomplete.selectedIndex = Math.min(
          autocomplete.selectedIndex + 1,
          autocomplete.options.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        autocomplete.selectedIndex = Math.max(autocomplete.selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (autocomplete.selectedIndex >= 0 && autocomplete.selectedIndex < autocomplete.options.length) {
          this.selectMassEditOption(field, autocomplete.options[autocomplete.selectedIndex]);
        } else if (autocomplete.options.length === 1) {
          this.selectMassEditOption(field, autocomplete.options[0]);
        } else {
          this.closeMassEditDropdown(field);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.closeMassEditDropdown(field);
        break;
    }
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

    this.isMassEditing = true;
    setTimeout(() => {
      try {
        const nodesToUpdate: any[] = [];
        const columnsToUpdate: Set<string> = new Set();

        // Apply mass edit to ALL rows
        this.gridApi.forEachNode((node: any) => {
          if (!node.data) return;

          const rowData = node.data;
          const materialColorId = rowData.materialColorId;
          if (!materialColorId) return;

          let hasChanges = false;

          // Apply each mass edit value that was set
          // Only fields returned by getEditableFields() should be in massEditValues,
          // but we validate here as well for safety
          Object.keys(this.massEditValues).forEach((field) => {
            const value = this.massEditValues[field]?.trim();
            if (value) {
              // Verify field is editable (not in disabled fields)
              const disabledFields = this.getDisabledFields();
              if (!disabledFields.has(field)) {
                rowData[field] = value;
                hasChanges = true;
                columnsToUpdate.add(field);
              }
            }
          });

          if (hasChanges) {
            // Store original value if not already stored
            if (!this.originalRowValues.has(materialColorId)) {
              const originalRow = this.rowData.find((row) => row.materialColorId === materialColorId);
              if (originalRow) {
                this.originalRowValues.set(materialColorId, { ...originalRow });
              }
            }

            // Track edited rows and fields
            this.editedRows.add(materialColorId);
            if (!this.editedFields.has(materialColorId)) {
              this.editedFields.set(materialColorId, new Set());
            }
            columnsToUpdate.forEach((col) => {
              this.editedFields.get(materialColorId)!.add(col);
            });

            nodesToUpdate.push(node);
          }
        });

        if (nodesToUpdate.length > 0 && columnsToUpdate.size > 0) {
          this.gridApi.refreshCells({
            rowNodes: nodesToUpdate,
            columns: Array.from(columnsToUpdate),
            force: true,
          });
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
    
    return this.columnDefs
      .filter((col) => {
        // Must have a field name
        if (!col.field) return false;
        
        // Must be editable (not in disabled fields)
        if (disabledFields.has(col.field)) return false;
        
        // Must use AutocompleteCellEditorComponent
        if (col.cellEditor !== AutocompleteCellEditorComponent) return false;
        
        // Must have isServiceSearch: true in cellEditorParams
        const cellEditorParams = typeof col.cellEditorParams === 'function' 
          ? col.cellEditorParams({} as any) 
          : col.cellEditorParams;
        
        return cellEditorParams?.isServiceSearch === true;
      })
      .map((col) => col.field!);
  }

  isDropdownField(field: string): boolean {
    const colDef = this.columnDefs.find((col) => col.field === field);
    if (!colDef) return false;
    
    // Must use AutocompleteCellEditorComponent
    if (colDef.cellEditor !== AutocompleteCellEditorComponent) return false;
    
    // Must have isServiceSearch: true in cellEditorParams
    const cellEditorParams = typeof colDef.cellEditorParams === 'function' 
      ? colDef.cellEditorParams({} as any) 
      : colDef.cellEditorParams;
    
    return cellEditorParams?.isServiceSearch === true;
  }

  getColumnHeaderName(field: string): string {
    const colDef = this.columnDefs.find((col) => col.field === field);
    return colDef?.headerName || field;
  }

  getColumnWidth(field: string): number {
    const colDef = this.columnDefs.find((col) => col.field === field);
    return colDef?.width || 200;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getRowError(materialColorId: string): string | null {
    return this.rowErrors[materialColorId] || null;
  }

  clearRowError(materialColorId: string): void {
    if (this.rowErrors[materialColorId]) {
      delete this.rowErrors[materialColorId];
      if (this.gridApi) {
        this.gridApi.refreshCells({ 
          force: true,
          columns: [COL_ERROR_INDICATOR] // Refresh error indicator column
        });
        this.gridApi.redrawRows();
      }
      if (!this.hasErrors()) {
        this.notifyGridLayoutChange();
      }
    }
  }

  clearAllErrors(): void {
    this.rowErrors = {};
    if (this.gridApi) {
      this.gridApi.refreshCells({ 
        force: true,
        columns: [COL_ERROR_INDICATOR] // Refresh error indicator column
      });
      this.gridApi.redrawRows();
    }
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
    
    // Cleanup ResizeObserver
    if ((this as any)._resizeObserver) {
      (this as any)._resizeObserver.disconnect();
    }
  }

  private setupMassEditScrollSync(): void {
    if (!this.gridApi || !this.massEditHeaderRow) return;

    const gridContainer = document.querySelector('.modal-grid-container .ag-body-viewport');
    const headerRow = this.massEditHeaderRow.nativeElement;

    if (!gridContainer) return;

    // Sync grid scroll to header row
    gridContainer.addEventListener('scroll', () => {
      headerRow.scrollLeft = gridContainer.scrollLeft;
    });

    // Sync header row scroll to grid
    headerRow.addEventListener('scroll', () => {
      if (gridContainer.scrollLeft !== headerRow.scrollLeft) {
        gridContainer.scrollLeft = headerRow.scrollLeft;
      }
    });
  }

}
