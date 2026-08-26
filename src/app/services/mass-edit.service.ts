import { Injectable } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { GridConfigService } from './grid/grid-config.service';
import { RowManagementService } from './row-management.service';
import {
  ENUM_MBOM_LINE_ITEM,
  COL_CHECKBOX,
  COL_ACTIONS,
  MASS_EDIT_DATE_START_FIELDS,
  MASS_EDIT_DATE_END_FIELDS,
  MASS_EDIT_QUANTITY_FIELDS,
  MASS_EDIT_INCLUDE_IN_SPEC_SHEET_FIELDS,
} from '../constants';

export interface MassEditState {
  startDate: string;
  endDate: string;
  quantity: number | null;
  includeInSpecSheet: string;
}

export interface ApplyMassEditOptions {
  gridApi: GridApi;
  selectedRows: Set<any>;
  columnDefs: any[];
  state: MassEditState;
  isMbomMode: () => boolean;
  isSbomMode: () => boolean;
  isEbomMode: () => boolean;
  isMaterialMbomMode?: () => boolean;
  editedRows: Set<string | number>;
  editedFields: Map<string | number, Set<string>>;
  originalRowValues: Map<string | number, any>;
}

interface UpdateFieldParams {
  node: any;
  rowData: any;
  state: MassEditState;
  isMbomMode: () => boolean;
  isSbomMode: () => boolean;
  isEbomMode: () => boolean;
  isMaterialMbomMode?: () => boolean;
  isMbomRow: boolean;
  columnFields: Set<string>;
  columnsToUpdate: Set<string>;
  updatedFieldsForRow: Set<string>;
}

@Injectable({
  providedIn: 'root',
})
export class MassEditService {
  constructor(
    private readonly gridConfigService: GridConfigService,
    private readonly rowManagementService: RowManagementService,
  ) {}

  populateMassEditFields(
    selectedRows: any[],
    isMbomMode: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode: () => boolean,
    isMaterialMbomMode?: () => boolean
  ): MassEditState {
    if (selectedRows.length === 0) {
      return {
        startDate: '',
        endDate: '',
        quantity: null,
        includeInSpecSheet: '',
      };
    }

    const state: MassEditState = {
      startDate: '',
      endDate: '',
      quantity: null,
      includeInSpecSheet: '',
    };

    this.populateStartDate(selectedRows, state);
    this.populateEndDate(selectedRows, state);
    this.populateQuantity(selectedRows, state, isMbomMode, isSbomMode, isEbomMode, isMaterialMbomMode);
    this.populateIncludeInSpecSheet(selectedRows, state, isSbomMode);

    return state;
  }

  private populateStartDate(selectedRows: any[], state: MassEditState): void {
    this.populateDateField(selectedRows, [...MASS_EDIT_DATE_START_FIELDS], (dateStr) => {
      state.startDate = dateStr;
    });
  }

  private populateEndDate(selectedRows: any[], state: MassEditState): void {
    this.populateDateField(selectedRows, [...MASS_EDIT_DATE_END_FIELDS], (dateStr) => {
      state.endDate = dateStr;
    });
  }

  private populateDateField(
    selectedRows: any[],
    fields: string[],
    setter: (dateStr: string) => void
  ): void {
    const firstDate = this.getDateValue(selectedRows[0], fields);
    const allSameDate = selectedRows.every((row) => {
      const rowDate = this.getDateValue(row, fields);
      return rowDate === firstDate;
    });
    if (allSameDate && firstDate) {
      const date = this.gridConfigService.parseDateString(firstDate);
      setter(date ? this.convertToDateInputFormat(date) : '');
    }
  }

  private populateQuantity(
    selectedRows: any[],
    state: MassEditState,
    isMbomMode: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode: () => boolean,
    isMaterialMbomMode?: () => boolean
  ): void {
    const isPrimaryEditableMode = isMbomMode() || isEbomMode() || isMaterialMbomMode?.();
    if (isPrimaryEditableMode) {
      this.setQuantityIfSame(selectedRows, state);
      return;
    }

    if (!isSbomMode()) {
      return;
    }

    const hasMbomRows = selectedRows.some(
      (row: any) => row?.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM
    );
    if (!hasMbomRows) {
      this.setQuantityIfSame(selectedRows, state);
    }
  }

  private populateIncludeInSpecSheet(
    selectedRows: any[],
    state: MassEditState,
    isSbomMode: () => boolean
  ): void {
    if (!isSbomMode()) return;

    const includeInSpecSheetFields = [...MASS_EDIT_INCLUDE_IN_SPEC_SHEET_FIELDS];
    const firstIncludeInSpecSheet = this.getStringValue(selectedRows[0], includeInSpecSheetFields);
    const allSameIncludeInSpecSheet = selectedRows.every((row) => {
      const rowValue = this.getStringValue(row, includeInSpecSheetFields);
      return rowValue === firstIncludeInSpecSheet;
    });
    if (allSameIncludeInSpecSheet && firstIncludeInSpecSheet) {
      state.includeInSpecSheet = firstIncludeInSpecSheet;
    }
  }

  private setQuantityIfSame(selectedRows: any[], state: MassEditState): void {
    const qtyFields = [...MASS_EDIT_QUANTITY_FIELDS];
    const firstQty = this.getQtyValue(selectedRows[0], qtyFields);
    const allSameQty = selectedRows.every((row) => {
      const rowQty = this.getQtyValue(row, qtyFields);
      return rowQty === firstQty;
    });
    if (allSameQty && firstQty !== null) {
      state.quantity = firstQty;
    }
  }

  private getDateValue(row: any, fields: string[]): string {
    for (const field of fields) {
      if (row[field]) return row[field];
    }
    return '';
  }

  private getQtyValue(row: any, fields: string[]): number | null {
    for (const field of fields) {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        return Number(row[field]);
      }
    }
    return null;
  }

  private getStringValue(row: any, fields: string[]): string {
    for (const field of fields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        return String(row[field]).trim();
      }
    }
    return '';
  }

  convertToDateInputFormat(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  hasMbomLineItemsInSelection(selectedRows: Set<any>, isSbomMode: () => boolean): boolean {
    if (!isSbomMode() || selectedRows.size === 0) {
      return false;
    }
    return Array.from(selectedRows).some(
      (row: any) => row?.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM
    );
  }

  applyMassEdit(options: ApplyMassEditOptions): void {
    const {
      gridApi,
      selectedRows,
      columnDefs,
      state,
      isMbomMode,
      isSbomMode,
      isEbomMode,
      isMaterialMbomMode,
      editedRows,
      editedFields,
      originalRowValues,
    } = options;

    if (selectedRows.size === 0 || !gridApi) return;

    const selectedNodes = gridApi.getSelectedNodes();
    const nodesToUpdate: any[] = [];
    const columnsToUpdate: Set<string> = new Set();
    const columnFields = this.buildColumnFieldsSet(gridApi, columnDefs);

    selectedNodes.forEach((node: any) => {
      if (!node.data) return;

      const rowData = node.data;
      const isMbomRow = rowData?.ptcbomPartMarkUp === 'enumMBOM001';
      let hasChanges = false;
      const updatedFieldsForRow = new Set<string>();

      const updateParams: UpdateFieldParams = {
        node,
        rowData,
        state,
        isMbomMode,
        isSbomMode,
        isEbomMode,
        isMaterialMbomMode,
        isMbomRow,
        columnFields,
        columnsToUpdate,
        updatedFieldsForRow,
      };

      hasChanges = this.updateStartDate(updateParams) || hasChanges;
      hasChanges = this.updateEndDate(updateParams) || hasChanges;
      hasChanges = this.updateQuantity(updateParams) || hasChanges;
      hasChanges = this.updateIncludeInSpecSheet(updateParams) || hasChanges;

      if (hasChanges) {
        updatedFieldsForRow.forEach((fieldName) => {
          this.rowManagementService.syncRowFieldEditState({
            rowData,
            fieldName,
            newValue: rowData?.[fieldName],
            editedRows,
            editedFields,
            originalRowValues,
          });
        });
        nodesToUpdate.push(node);
      }
    });

    if (nodesToUpdate.length > 0 && columnsToUpdate.size > 0) {
      gridApi.refreshCells({
        rowNodes: nodesToUpdate,
        columns: Array.from(columnsToUpdate),
        force: true,
      });
      gridApi.redrawRows({ rowNodes: nodesToUpdate });
    }
  }

  private buildColumnFieldsSet(gridApi: GridApi, columnDefs: any[]): Set<string> {
    const columnFields = new Set<string>();
    const allColumns = gridApi.getColumns();
    if (allColumns) {
      allColumns.forEach((col: any) => {
        if (col.getColId && col.getColId() !== COL_CHECKBOX && col.getColId() !== COL_ACTIONS) {
          columnFields.add(col.getColId());
        }
      });
    }

    if (columnDefs && columnDefs.length > 0) {
      columnDefs.forEach((colDef: any) => {
        if (colDef.field && colDef.field !== 'checkbox' && colDef.field !== 'actions') {
          columnFields.add(colDef.field);
        }
        if (colDef.colId && colDef.colId !== COL_CHECKBOX && colDef.colId !== COL_ACTIONS) {
          columnFields.add(colDef.colId);
        }
      });
    }

    return columnFields;
  }

  private findTargetField(fields: string[], columnFields: Set<string>, rowData: any): string {
    for (const field of fields) {
      if (columnFields.has(field)) {
        return field;
      }
    }
    for (const field of fields) {
      if (rowData.hasOwnProperty(field)) {
        return field;
      }
    }
    return fields[0];
  }

  private updateStartDate(params: UpdateFieldParams): boolean {
    return this.updateDateField(
      params,
      params.state.startDate,
      [...MASS_EDIT_DATE_START_FIELDS],
      (dateStr) => this.gridConfigService.formatDateToMMDDYYYY(dateStr)
    );
  }

  private updateEndDate(params: UpdateFieldParams): boolean {
    return this.updateDateField(
      params,
      params.state.endDate,
      [...MASS_EDIT_DATE_END_FIELDS],
      (dateStr) => this.gridConfigService.formatDateToMMDDYYYY(dateStr)
    );
  }

  private updateDateField(
    params: UpdateFieldParams,
    dateValue: string,
    fields: string[],
    formatter: (dateStr: string) => string
  ): boolean {
    const {
      node,
      rowData,
      isMbomMode,
      isSbomMode,
      isEbomMode,
      isMaterialMbomMode,
      isMbomRow,
      columnFields,
      columnsToUpdate,
      updatedFieldsForRow,
    } = params;
    const shouldUpdate = dateValue && (isMbomMode() || isEbomMode() || isMaterialMbomMode?.() || (isSbomMode() && !isMbomRow));
    if (!shouldUpdate) return false;

    const formattedDate = formatter(dateValue);
    const targetField = this.findTargetField(fields, columnFields, rowData);
    const currentValue = rowData[targetField] || '';

    if (currentValue !== formattedDate) {
      rowData[targetField] = formattedDate;
      node.setDataValue(targetField, formattedDate);
      columnsToUpdate.add(targetField);
      updatedFieldsForRow.add(targetField);
      return true;
    }
    return false;
  }

  private updateQuantity(params: UpdateFieldParams): boolean {
    const {
      node,
      rowData,
      state,
      isMbomMode,
      isSbomMode,
      isEbomMode,
      isMaterialMbomMode,
      isMbomRow,
      columnFields,
      columnsToUpdate,
      updatedFieldsForRow,
    } = params;
    const shouldUpdate =
      (isMbomMode() || isEbomMode() || isMaterialMbomMode?.() || (isSbomMode() && !isMbomRow)) &&
      state.quantity !== null &&
      state.quantity !== undefined;
    if (!shouldUpdate) return false;

    const targetField = this.findTargetField([...MASS_EDIT_QUANTITY_FIELDS], columnFields, rowData);
    const currentValue = rowData[targetField];

    if (currentValue !== state.quantity) {
      rowData[targetField] = state.quantity;
      node.setDataValue(targetField, state.quantity);
      columnsToUpdate.add(targetField);
      updatedFieldsForRow.add(targetField);
      return true;
    }
    return false;
  }

  private updateIncludeInSpecSheet(params: UpdateFieldParams): boolean {
    const { node, rowData, state, isSbomMode, columnFields, columnsToUpdate, updatedFieldsForRow } = params;
    if (!isSbomMode() || !state.includeInSpecSheet) return false;
    if (rowData.isNewRow) return false;

    const isMbomRow = rowData?.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM;
    
    // For MBOM line items, apply regardless of specSheetExtra value
    // For non-MBOM rows, skip if specSheetExtra exists
    if (!isMbomRow) {
      const specSheetExtra = rowData?.bomLinkSpecSheetExtra;
      const hasSpecSheetExtra = specSheetExtra !== undefined && specSheetExtra !== null && String(specSheetExtra).trim() !== '';
      if (hasSpecSheetExtra) return false;
    }

    const targetField = this.findTargetField([...MASS_EDIT_INCLUDE_IN_SPEC_SHEET_FIELDS], columnFields, rowData);
    const currentValue = rowData[targetField] || '';

    if (currentValue !== state.includeInSpecSheet) {
      rowData[targetField] = state.includeInSpecSheet;
      node.setDataValue(targetField, state.includeInSpecSheet);
      columnsToUpdate.add(targetField);
      updatedFieldsForRow.add(targetField);
      return true;
    }
    return false;
  }
}
