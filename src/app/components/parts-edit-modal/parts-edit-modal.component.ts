import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { IconComponent } from '../icon/icon.component';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';
import { ColumnHeaderPinComponent } from '../column-header-pin/column-header-pin.component';
import { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-community';
import { DataService } from '../../services/data.service';
import { GridConfigService } from '../../services/grid-config.service';
import { MassEditService } from '../../services/mass-edit.service';

@Component({
  selector: 'app-parts-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './parts-edit-modal.component.html',
  styleUrls: ['./parts-edit-modal.component.css'],
})
export class PartsEditModalComponent implements OnInit {
  @Input() materialColorIds: string[] = [];
  @Output() modalClose = new EventEmitter<void>();
  @Output() save = new EventEmitter<any[]>();

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  public columnDefs: ColDef[] = [];
  public gridOptions: GridOptions = {};
  public defaultColDef: Partial<ColDef> = {};
  public rowData: any[] = [];
  private gridApi!: GridApi;
  public massEditMode = false;
  public massEditServiceDescription: string = '';
  public massEditServiceMessage: string = '';
  public selectedRows = new Set<any>();
  public isMassEditing = false;
  private readonly editedRows = new Set<string | number>();
  private readonly editedFields = new Map<string | number, Set<string>>();
  private readonly originalRowValues = new Map<string | number, any>();
  private columnsMapping: { [key: string]: string } = {};
  public rowErrors: { [materialColorId: string]: string } = {};
  
  // Track if any rows have been edited
  public get hasEditedRows(): boolean {
    return this.editedRows.size > 0;
  }

  constructor(
    private readonly dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly massEditService: MassEditService
  ) {}

  ngOnInit(): void {
    this.initializeGrid();
    this.loadMaterialColors();
  }

  /**
   * Build column definitions dynamically based on API response columns
   */
  private buildColumnDefs(columns: { [key: string]: string }): ColDef[] {
    const columnDefs: ColDef[] = [
      {
        headerName: '',
        field: 'isSelected',
        colId: 'checkbox',
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: false,
      },
    ];

    // Non-editable fields
    const disabledFields = new Set(['partNumber', 'materialColorManufacturersPartNumber', 'materialColorStatus']);
    
    // Dropdown fields (use AutocompleteCellEditorComponent)
    const dropdownFields = new Set([
      'materialColorServiceSubstituteOne',
      'materialColorServiceSubstituteTwo',
      'materialColorServiceEquivalent',
    ]);

    // Build columns in the order they appear in the API response
    Object.keys(columns).forEach((field) => {
      const headerName = columns[field];
      const isDisabled = disabledFields.has(field);
      const isDropdown = dropdownFields.has(field);

      const colDef: ColDef = {
        headerName: headerName,
        field: field,
        width: 200,
        minWidth: 150,
        editable: !isDisabled,
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => {
          // Show error icon in first column (partNumber) if row has error
          if (field === 'partNumber' && params.data?.materialColorId && this.rowErrors[params.data.materialColorId]) {
            const errorMessage = this.rowErrors[params.data.materialColorId];
            const escapedMessage = this.escapeHtml(errorMessage);
            const value = params.value || '';
            return `<div style="display: flex; align-items: center; gap: 6px;">
              <span title="${escapedMessage}" style="color: #ef4444; cursor: help; font-size: 16px;" aria-label="Error">⚠</span>
              <span>${this.escapeHtml(String(value))}</span>
            </div>`;
          }
          return params.value || '';
        },
      };

      // Add cell editor for dropdown fields
      if (isDropdown) {
        colDef.cellEditor = AutocompleteCellEditorComponent;
        colDef.cellEditorParams = () => ({
          placeholder: 'search services...',
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
      if (field === 'partNumber') {
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
    };

    const commonOptions = this.gridConfigService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      suppressRowClickSelection: false,
      enableRangeSelection: true,
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
        this.gridConfigService.sizeColumnsToFit(this.gridApi);
        this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);
      },
      onSelectionChanged: () => {
        this.updateSelectedRows();
      },
      onCellValueChanged: (params) => {
        if (params.data) {
          const materialColorId = params.data.materialColorId;
          if (!materialColorId) return;

          const fieldName = params.colDef?.field;
          if (!fieldName) return;

          // Store original value if not already stored
          if (!this.originalRowValues.has(materialColorId)) {
            // Find original row data
            const originalRow = this.rowData.find((row) => row.materialColorId === materialColorId);
            if (originalRow) {
              this.originalRowValues.set(materialColorId, { ...originalRow });
            }
          }

          const originalRow = this.originalRowValues.get(materialColorId);
          const originalValue = originalRow?.[fieldName];
          const newValue = params.newValue;

          // Check if value actually changed
          const hasChanged = String(originalValue || '') !== String(newValue || '');

          if (hasChanged) {
            // Add to edited rows
            this.editedRows.add(materialColorId);

            // Track edited fields
            if (!this.editedFields.has(materialColorId)) {
              this.editedFields.set(materialColorId, new Set());
            }
            this.editedFields.get(materialColorId)!.add(fieldName);
          } else {
            // Value reverted to original - check if all fields are back to original
            if (this.editedFields.has(materialColorId)) {
              this.editedFields.get(materialColorId)!.delete(fieldName);
              
              // If no fields are edited, remove from edited rows
              if (this.editedFields.get(materialColorId)!.size === 0) {
                this.editedRows.delete(materialColorId);
                this.editedFields.delete(materialColorId);
              }
            }
          }

          // Update row data - ensure we preserve materialColorId and all fields
          const rowIndex = this.rowData.findIndex((row) => row.materialColorId === materialColorId);
          if (rowIndex >= 0) {
            // Merge with existing data to preserve all fields, ensuring materialColorId is preserved
            // Use params.newValue directly for the changed field to ensure we have the latest value
            this.rowData[rowIndex] = {
              ...this.rowData[rowIndex],
              ...params.data,
              [fieldName]: newValue, // Explicitly set the new value
              materialColorId, // Ensure materialColorId is always preserved
            };
          }

          // Clear error when user edits the row
          if (this.rowErrors[materialColorId]) {
            this.clearRowError(materialColorId);
          }
        }
      },
      rowClassRules: {
        'error-row': (params: any) => {
          return params.data?.materialColorId && this.rowErrors[params.data.materialColorId];
        },
      },
    };
  }

  onGridReady(event: GridReadyEvent): void {}

  /**
   * Handle close button/ESC key clicks
   * Shows confirmation if there are unsaved changes
   */
  handleCloseClick(): void {
    // Warn if there are unsaved changes
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

  /**
   * Close the modal (called after confirmation)
   * Clears all tracking data and emits close event
   */
  closeModal(): void {
    // Clear edited tracking when closing
    this.editedRows.clear();
    this.editedFields.clear();
    this.originalRowValues.clear();
    this.rowErrors = {};
    this.modalClose.emit();
  }

  saveModal(): void {
    if (!this.gridApi || this.editedRows.size === 0) return;

    // Build payload ONLY for edited rows
    const instances: { [key: string]: any } = {};
    
    this.editedRows.forEach((materialColorId) => {
      // Get the latest row data directly from the grid API to ensure we have current values
      let currentRow: any = null;
      this.gridApi.forEachNode((node) => {
        if (node.data?.materialColorId === materialColorId) {
          currentRow = node.data;
        }
      });

      // Fallback to rowData if not found in grid
      if (!currentRow) {
        currentRow = this.rowData.find((row) => row.materialColorId === materialColorId);
      }

      if (!currentRow) {
        return;
      }

      // Build instance with ALL fields for this row (including disabled fields)
      // For service dropdowns, send ID if available (like bomLinkFeature pattern), otherwise send display value
      instances[materialColorId] = {
        // Editable fields
        materialColorServiceDescription: currentRow.materialColorServiceDescription || '',
        materialColorServiceMessage: currentRow.materialColorServiceMessage || '',
        materialColorServiceEquivalent: currentRow.materialColorServiceEquivalentId || currentRow.materialColorServiceEquivalent || '',
        materialColorServiceSubstituteOne: currentRow.materialColorServiceSubstituteOneId || currentRow.materialColorServiceSubstituteOne || '',
        materialColorServiceSubstituteTwo: currentRow.materialColorServiceSubstituteTwoId || currentRow.materialColorServiceSubstituteTwo || '',
        
        // Disabled/read-only fields (include them in payload)
        partNumber: currentRow.partNumber || '',
        materialColorManufacturersPartNumber: currentRow.materialColorManufacturersPartNumber || '',
        materialColorStatus: currentRow.materialColorStatus || '',
        
        // Other fields that might be present
        materialColorSixtyCharacterDescription: currentRow.materialColorSixtyCharacterDescription || '',
        materialColorThirtyCharacterDescription: currentRow.materialColorThirtyCharacterDescription || '',
      };
    });

    if (Object.keys(instances).length === 0) return;

    // Clear previous errors
    this.rowErrors = {};

    // Build the payload
    const payload = { instances };

    this.dataService.saveMaterialColors(payload).subscribe({
      next: (response: any) => {
        
        // Handle errors from response
        const hasErrors = response?.errors && typeof response.errors === 'object' && Object.keys(response.errors).length > 0;
        
        if (hasErrors) {
          // Set errors for failed rows
          Object.keys(response.errors).forEach((materialColorId) => {
            const errorObj = response.errors[materialColorId];
            const errorMessage = errorObj?.errorMessage || errorObj?.message || 'Unknown error occurred';
            this.rowErrors[materialColorId] = errorMessage;
          });

          // Update row data with successfully saved instances (if any)
          if (response?.instances && typeof response.instances === 'object') {
            Object.keys(response.instances).forEach((materialColorId) => {
              // Only update if this row doesn't have an error
              if (!this.rowErrors[materialColorId]) {
                const updatedData = response.instances[materialColorId];
                const rowIndex = this.rowData.findIndex((row) => row.materialColorId === materialColorId);
                if (rowIndex >= 0) {
                  this.rowData[rowIndex] = {
                    ...this.rowData[rowIndex],
                    ...updatedData,
                    materialColorId, // Ensure materialColorId is preserved
                  };
                  // Remove from edited rows since it was successfully saved
                  this.editedRows.delete(materialColorId);
                  this.editedFields.delete(materialColorId);
                }
              }
            });
          }

          // Refresh grid to show error indicators and updated data
          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', [...this.rowData]);
            this.gridApi.refreshCells({ force: true });
            this.gridApi.redrawRows();
          }

          // Scroll to first error row if possible
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
          // No errors - update row data with saved instances and close modal
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
          
          // Get all current row data for emit
          const allRowData: any[] = [];
          this.gridApi.forEachNode((node) => {
            if (node.data) {
              allRowData.push({ ...node.data });
            }
          });
          this.save.emit(allRowData);
          // Don't auto-close after successful save - user can close manually via close icon, cancel button, or ESC
        }
      },
      error: (error: any) => {
        console.error('Error saving material colors:', error);
        // Handle HTTP errors
        const errorMessage = error?.error?.message || error?.message || 'Failed to save material colors';
        alert(`Error: ${errorMessage}`);
      },
    });
  }

  /**
   * Load material colors by comma-separated unique materialColorIds.
   * Modal rows come ONLY from the API response.
   * Columns are built dynamically from the API response columns object.
   */
  private loadMaterialColors(): void {
    if (!Array.isArray(this.materialColorIds) || this.materialColorIds.length === 0) return;

    const idsString = this.materialColorIds.join(',');
    this.dataService.searchMaterialColors(idsString).subscribe((response: any) => {
      const instances = response?.instances;
      const columns = response?.columns;
      
      if (!instances || typeof instances !== 'object') return;

      // Store columns mapping
      if (columns && typeof columns === 'object') {
        this.columnsMapping = columns;
        // Build column definitions based on API columns order
        this.columnDefs = this.buildColumnDefs(columns);
        
        // Update grid columns if grid is already initialized
        if (this.gridApi) {
          this.gridApi.setGridOption('columnDefs', this.columnDefs);
        }
      }

      // Build row data from instances and store original values
      this.rowData = Object.keys(instances).map((materialColorId) => {
        const rowData = {
          materialColorId,
          ...instances[materialColorId],
          isSelected: false,
        };
        // Store original values for comparison
        this.originalRowValues.set(materialColorId, { ...rowData });
        return rowData;
      });

      // Clear edited rows when loading new data
      this.editedRows.clear();
      this.editedFields.clear();

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    });
  }

  getSelectedRowsCount(): number {
    return this.gridApi ? this.gridApi.getSelectedNodes().length : 0;
  }

  private updateSelectedRows(): void {
    if (!this.gridApi) return;
    this.selectedRows.clear();
    this.gridApi.getSelectedNodes().forEach((node) => {
      if (node.data) {
        this.selectedRows.add(node.data);
      }
    });
    // Close mass edit mode if less than 2 rows are selected
    if (this.selectedRows.size <= 1) {
      this.massEditMode = false;
      this.massEditServiceDescription = '';
      this.massEditServiceMessage = '';
    }
  }

  openMassEdit(): void {
    if (this.selectedRows.size > 1) {
      this.massEditMode = true;
      this.massEditServiceDescription = '';
      this.massEditServiceMessage = '';
    }
  }

  closeMassEditMode(): void {
    this.massEditMode = false;
    if (this.gridApi) {
      this.gridApi.deselectAll();
    }
    this.massEditServiceDescription = '';
    this.massEditServiceMessage = '';
  }

  applyMassEdit(): void {
    if (this.selectedRows.size === 0 || !this.gridApi || this.isMassEditing) return;

    this.isMassEditing = true;
    setTimeout(() => {
      try {
        const selectedNodes = this.gridApi.getSelectedNodes();
        const nodesToUpdate: any[] = [];
        const columnsToUpdate: Set<string> = new Set();

        selectedNodes.forEach((node: any) => {
          if (!node.data) return;

          const rowData = node.data;
          let hasChanges = false;

          const serviceDescription = this.massEditServiceDescription?.trim();
          if (serviceDescription) {
            rowData.materialColorServiceDescription = serviceDescription;
            hasChanges = true;
            columnsToUpdate.add('materialColorServiceDescription');
          }

          const serviceMessage = this.massEditServiceMessage?.trim();
          if (serviceMessage) {
            rowData.materialColorServiceMessage = serviceMessage;
            hasChanges = true;
            columnsToUpdate.add('materialColorServiceMessage');
          }

          if (hasChanges) {
            const rowId = rowData.partNumber || node.id;
            this.editedRows.add(rowId);
            if (!this.editedFields.has(rowId)) {
              this.editedFields.set(rowId, new Set());
            }
            columnsToUpdate.forEach((col) => {
              this.editedFields.get(rowId)!.add(col);
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

        this.massEditServiceDescription = '';
        this.massEditServiceMessage = '';
      } finally {
        this.isMassEditing = false;
      }
    }, 0);
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
        this.gridApi.refreshCells({ force: true });
        this.gridApi.redrawRows();
      }
    }
  }

  getErrorEntries(): Array<{ materialColorId: string; message: string }> {
    return Object.keys(this.rowErrors).map((materialColorId) => ({
      materialColorId,
      message: this.rowErrors[materialColorId],
    }));
  }

  hasErrors(): boolean {
    return Object.keys(this.rowErrors).length > 0;
  }
}
