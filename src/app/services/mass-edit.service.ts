import { Injectable } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { GridConfigService } from './grid-config.service';
import { DataService } from './data.service';

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
}

interface TrackEditedFieldsParams {
  rowData: any;
  state: MassEditState;
  isMbomMode: () => boolean;
  isSbomMode: () => boolean;
  isEbomMode: () => boolean;
  isMaterialMbomMode?: () => boolean;
  isMbomRow: boolean;
  columnFields: Set<string>;
  editedRows: Set<string | number>;
  editedFields: Map<string | number, Set<string>>;
}

@Injectable({
  providedIn: 'root',
})
export class MassEditService {
  constructor(
    private readonly gridConfigService: GridConfigService,
    private readonly dataService: DataService
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
    this.populateDateField(selectedRows, ['bomLinkStartDate'], (dateStr) => {
      state.startDate = dateStr;
    });
  }

  private populateEndDate(selectedRows: any[], state: MassEditState): void {
    this.populateDateField(selectedRows, ['bomLinkEndDate'], (dateStr) => {
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
    if (isMbomMode() || isEbomMode() || isMaterialMbomMode?.()) {
      this.setQuantityIfSame(selectedRows, state);
    } else if (isSbomMode()) {
      const hasMbomRows = selectedRows.some(
        (row: any) => row?.ptcbomPartMarkUp === 'enumMBOM001'
      );
      if (!hasMbomRows) {
        this.setQuantityIfSame(selectedRows, state);
      }
    }
  }

  private populateIncludeInSpecSheet(
    selectedRows: any[],
    state: MassEditState,
    isSbomMode: () => boolean
  ): void {
    if (!isSbomMode()) return;

    const includeInSpecSheetFields = ['bomLinkIncludeInSpecSheet'];
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
    const qtyFields = ['quantity'];
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
      (row: any) => row?.ptcbomPartMarkUp === 'enumMBOM001'
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
      };

      hasChanges = this.updateStartDate(updateParams) || hasChanges;
      hasChanges = this.updateEndDate(updateParams) || hasChanges;
      hasChanges = this.updateQuantity(updateParams) || hasChanges;
      hasChanges = this.updateIncludeInSpecSheet(node, rowData, state, isSbomMode, columnFields, columnsToUpdate) || hasChanges;

      if (hasChanges) {
        const trackParams: TrackEditedFieldsParams = {
          rowData,
          state,
          isMbomMode,
          isSbomMode,
          isEbomMode,
          isMaterialMbomMode,
          isMbomRow,
          columnFields,
          editedRows,
          editedFields,
        };
        this.trackEditedFields(trackParams);
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
        if (col.getColId && col.getColId() !== 'checkbox' && col.getColId() !== 'actions') {
          columnFields.add(col.getColId());
        }
      });
    }

    if (columnDefs && columnDefs.length > 0) {
      columnDefs.forEach((colDef: any) => {
        if (colDef.field && colDef.field !== 'checkbox' && colDef.field !== 'actions') {
          columnFields.add(colDef.field);
        }
        if (colDef.colId && colDef.colId !== 'checkbox' && colDef.colId !== 'actions') {
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
      ['bomLinkStartDate'],
      (dateStr) => this.gridConfigService.formatDateToMMDDYYYY(dateStr)
    );
  }

  private updateEndDate(params: UpdateFieldParams): boolean {
    return this.updateDateField(
      params,
      params.state.endDate,
      ['bomLinkEndDate'],
      (dateStr) => this.gridConfigService.formatDateToMMDDYYYY(dateStr)
    );
  }

  private updateDateField(
    params: UpdateFieldParams,
    dateValue: string,
    fields: string[],
    formatter: (dateStr: string) => string
  ): boolean {
    const { node, rowData, isMbomMode, isSbomMode, isEbomMode, isMaterialMbomMode, isMbomRow, columnFields, columnsToUpdate } = params;
    const shouldUpdate = dateValue && (isMbomMode() || isEbomMode() || isMaterialMbomMode?.() || (isSbomMode() && !isMbomRow));
    if (!shouldUpdate) return false;

    const formattedDate = formatter(dateValue);
    const targetField = this.findTargetField(fields, columnFields, rowData);
    const currentValue = rowData[targetField] || '';

    if (currentValue !== formattedDate) {
      rowData[targetField] = formattedDate;
      node.setDataValue(targetField, formattedDate);
      columnsToUpdate.add(targetField);
      return true;
    }
    return false;
  }

  private updateQuantity(params: UpdateFieldParams): boolean {
    const { node, rowData, state, isMbomMode, isSbomMode, isEbomMode, isMaterialMbomMode, isMbomRow, columnFields, columnsToUpdate } = params;
    const shouldUpdate =
      (isMbomMode() || isEbomMode() || isMaterialMbomMode?.() || (isSbomMode() && !isMbomRow)) &&
      state.quantity !== null &&
      state.quantity !== undefined;
    if (!shouldUpdate) return false;

    const targetField = this.findTargetField(['quantity'], columnFields, rowData);
    const currentValue = rowData[targetField];

    if (currentValue !== state.quantity) {
      rowData[targetField] = state.quantity;
      node.setDataValue(targetField, state.quantity);
      columnsToUpdate.add(targetField);
      return true;
    }
    return false;
  }

  private updateIncludeInSpecSheet(
    node: any,
    rowData: any,
    state: MassEditState,
    isSbomMode: () => boolean,
    columnFields: Set<string>,
    columnsToUpdate: Set<string>
  ): boolean {
    if (!isSbomMode() || !state.includeInSpecSheet) return false;
    if (rowData.isNewRow) return false;

    const isMbomRow = rowData?.ptcbomPartMarkUp === 'enumMBOM001';
    
    // For MBOM line items, apply regardless of specSheetExtra value
    // For non-MBOM rows, skip if specSheetExtra exists
    if (!isMbomRow) {
      const specSheetExtra = rowData?.bomLinkSpecSheetExtra;
      const hasSpecSheetExtra = specSheetExtra !== undefined && specSheetExtra !== null && String(specSheetExtra).trim() !== '';
      if (hasSpecSheetExtra) return false;
    }

    const targetField = this.findTargetField(['bomLinkIncludeInSpecSheet'], columnFields, rowData);
    const currentValue = rowData[targetField] || '';

    if (currentValue !== state.includeInSpecSheet) {
      rowData[targetField] = state.includeInSpecSheet;
      node.setDataValue(targetField, state.includeInSpecSheet);
      columnsToUpdate.add(targetField);
      return true;
    }
    return false;
  }

  private trackEditedFields(params: TrackEditedFieldsParams): void {
    const { rowData, state, isMbomMode, isSbomMode, isEbomMode, isMaterialMbomMode, isMbomRow, columnFields, editedRows, editedFields } = params;
    const primaryKey = rowData.materialKey || rowData.newRowId || rowData.partNumber || rowData.part;
    const compositeKey =
      rowData.section && (rowData.partNumber || rowData.part)
        ? `${rowData.section}::${rowData.partNumber || rowData.part}`
        : null;
    const editKey = primaryKey || compositeKey;

    if (!editKey) return;

    editedRows.add(editKey);
    if (compositeKey) editedRows.add(compositeKey);

    if (!editedFields.has(editKey)) {
      editedFields.set(editKey, new Set<string>());
    }
    const editedFieldsForRow = editedFields.get(editKey)!;

    if (isMbomMode() || isEbomMode() || isMaterialMbomMode?.()) {
      this.addFieldIfExists(editedFieldsForRow, ['bomLinkStartDate'], columnFields, rowData, state.startDate);
      this.addFieldIfExists(editedFieldsForRow, ['bomLinkEndDate'], columnFields, rowData, state.endDate);
      this.addFieldIfExists(editedFieldsForRow, ['quantity'], columnFields, rowData, state.quantity !== null && state.quantity !== undefined);
    }

    if (isSbomMode()) {
      if (!isMbomRow) {
        this.addFieldIfExists(editedFieldsForRow, ['bomLinkStartDate'], columnFields, rowData, state.startDate);
        this.addFieldIfExists(editedFieldsForRow, ['bomLinkEndDate'], columnFields, rowData, state.endDate);
        this.addFieldIfExists(editedFieldsForRow, ['quantity'], columnFields, rowData, state.quantity !== null && state.quantity !== undefined);
      }
      this.addFieldIfExists(editedFieldsForRow, ['bomLinkIncludeInSpecSheet'], columnFields, rowData, state.includeInSpecSheet);
    }
  }

  private addFieldIfExists(
    editedFieldsForRow: Set<string>,
    fields: string[],
    columnFields: Set<string>,
    rowData: any,
    condition: any
  ): void {
    if (!condition) return;
    for (const field of fields) {
      if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
        editedFieldsForRow.add(field);
        break;
      }
    }
  }
}
