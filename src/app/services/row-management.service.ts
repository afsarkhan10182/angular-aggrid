import {
  BOM_LINK_KEY,
  LS_KEY_LAST_SAVED_AT,
  VALUE_SPEC_YES,
  NOTIFICATION_TYPE_SUCCESS,
  NOTIFICATION_TYPE_ERROR,
  NOTIFICATION_TYPE_INFO,
  FIELD_PART_NUMBER,
  FIELD_PART,
  FIELD_BOM_LINK_PART,
  FIELD_BOM_LINK_FEATURE,
  FIELD_FEATURE,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_START_DATE,
  FIELD_END_DATE,
  FIELD_QUANTITY,
  FIELD_QTY,
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  PART_LOOKUP_POPULATED_FIELDS,
} from '../constants';
import { Injectable } from '@angular/core';
import { ColDef, GridApi } from 'ag-grid-community';
import { DataService } from './data.service';
import { GridConfigService } from './grid/grid-config.service';
import { SkuService } from './sku.service';

const QUANTITY_FIELD_SET = new Set<string>([FIELD_QUANTITY, FIELD_QTY]);
const DATE_FIELD_SET = new Set<string>([
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_START_DATE,
  FIELD_END_DATE,
]);

const resolvePartValue = (original: any): any =>
  original[FIELD_PART_NUMBER] ?? original[FIELD_BOM_LINK_PART] ?? original[FIELD_PART];
const resolveFeatureValue = (original: any): any =>
  original[FIELD_BOM_LINK_FEATURE] ?? original[FIELD_FEATURE];

const ORIGINAL_VALUE_RESOLVERS: Readonly<Record<string, (original: any) => any>> = {
  [FIELD_PART_NUMBER]: resolvePartValue,
  [FIELD_PART]: resolvePartValue,
  [FIELD_BOM_LINK_PART]: resolvePartValue,
  [FIELD_BOM_LINK_FEATURE]: resolveFeatureValue,
  [FIELD_FEATURE]: resolveFeatureValue,
  [FIELD_BOM_LINK_START_DATE]: (original) => original[FIELD_BOM_LINK_START_DATE],
  [FIELD_START_DATE]: (original) => original[FIELD_BOM_LINK_START_DATE],
  [FIELD_BOM_LINK_END_DATE]: (original) => original[FIELD_BOM_LINK_END_DATE],
  [FIELD_END_DATE]: (original) => original[FIELD_BOM_LINK_END_DATE],
  [FIELD_QUANTITY]: (original) => original[FIELD_QUANTITY],
  [FIELD_QTY]: (original) => original[FIELD_QUANTITY],
  [FIELD_BOM_LINK_SPEC_SHEET_EXTRA]: (original) => original[FIELD_BOM_LINK_SPEC_SHEET_EXTRA],
  [FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET]: (original) => original[FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET],
};

@Injectable({
  providedIn: 'root',
})
export class RowManagementService {
  private nextRowId = 10000;
  private readonly newRows = new Map<number, any>();
  private lastSavedAt: Date | null = null;

  constructor(
    private readonly gridConfigService: GridConfigService,
    private readonly skuService: SkuService,
  ) {
    const savedTimestamp = localStorage.getItem(LS_KEY_LAST_SAVED_AT);
    if (savedTimestamp) {
      this.lastSavedAt = new Date(savedTimestamp);
    }
  }

  /**
   * Get the current nextRowId
   */
  getNextRowId(): number {
    return this.nextRowId;
  }

  /**
   * Get all new rows
   */
  getNewRows(): Map<number, any> {
    return this.newRows;
  }

  /**
   * Get last saved timestamp
   */
  getLastSavedAt(): Date | null {
    return this.lastSavedAt;
  }

  /**
   * Set last saved timestamp
   */
  setLastSavedAt(date: Date): void {
    this.lastSavedAt = date;
    localStorage.setItem(LS_KEY_LAST_SAVED_AT, date.toISOString());
  }

  /**
   * Store original values for existing rows and reset edited-field tracking.
   */
  captureOriginalValues(
    rowData: any[],
    originalRowValues: Map<string | number, any>,
    editedFields: Map<string | number, Set<string>>,
  ): void {
    originalRowValues.clear();
    editedFields.clear();

    const processRow = (row: any): void => {
      if (
        row.isNewRow ||
        row.isSectionHeader ||
        row.isGroupHeader ||
        row.isMaterialHeader ||
        row.isBranchHeader
      ) {
        return;
      }
      const rowId = row.materialKey || row.newRowId || row[FIELD_PART_NUMBER] || row.part;
      if (!rowId) return;

      // Keep a shallow snapshot so existing-row edits can be reverted reliably across all editable fields.
      const originalValues: any = { ...row };
      delete originalValues.children;

      originalRowValues.set(rowId, originalValues);
      if (row.section && (row[FIELD_PART_NUMBER] || row.part)) {
        originalRowValues.set(
          `${row.section}::${row[FIELD_PART_NUMBER] || row.part}`,
          originalValues,
        );
      }

      if (row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => processRow(child));
      }
    };

    rowData.forEach((sectionRow: any) => {
      if (sectionRow.children) {
        sectionRow.children.forEach((child: any) => processRow(child));
      }
    });
  }

  /**
   * Determine whether a row should be treated as touched/edited.
   */
  isRowTouched(row: any, editedRows: Set<string | number>): boolean {
    if (row?.isNewRow) return true;

    const uniqueId = row?.materialKey ?? row?.newRowId;
    if (uniqueId != null) {
      const variants = this.getIdVariants(uniqueId);
      for (const id of variants) {
        if (editedRows.has(id)) return true;
      }
      return false;
    }

    const rowId = row?.[FIELD_PART_NUMBER] ?? row?.part;
    if (rowId == null) return false;

    const variants = this.getIdVariants(rowId);
    for (const id of variants) {
      if (editedRows.has(id)) return true;
    }

    const compositeId =
      row?.section && (row[FIELD_PART_NUMBER] ?? row.part)
        ? `${row.section}::${row[FIELD_PART_NUMBER] ?? row.part}`
        : null;
    if (compositeId && editedRows.has(compositeId)) return true;

    return false;
  }

  /**
   * Clear edited-state markers for a row when disconnect edits are fully reverted.
   */
  clearRowEditStateIfReverted(options: {
    rowId: string | number;
    row?: any;
    disconnectedSkuKeys: Set<string>;
    editedRows: Set<string | number>;
    editedFields: Map<string | number, Set<string>>;
    invalidRowIds: Set<string | number>;
    getDisconnectRowToken: (row: any) => string;
  }): void {
    const {
      rowId,
      row,
      disconnectedSkuKeys,
      editedRows,
      editedFields,
      invalidRowIds,
      getDisconnectRowToken,
    } = options;

    const rowToken = row ? getDisconnectRowToken(row) : String(rowId);
    const rowIdToken = String(rowId);
    const hasOtherDisconnects = [...disconnectedSkuKeys].some(
      (k) => k.startsWith(`${rowToken}|`) || k.startsWith(`${rowIdToken}|`),
    );
    if (hasOtherDisconnects) return;

    const variants = this.getIdVariants(rowId);
    const hasEditedFields = [...variants].some((id) => (editedFields.get(id)?.size ?? 0) > 0);
    if (row) {
      const compositeId =
        row.section && (row[FIELD_PART_NUMBER] ?? row.part)
          ? `${row.section}::${row[FIELD_PART_NUMBER] ?? row.part}`
          : null;
      if (compositeId && (editedFields.get(compositeId)?.size ?? 0) > 0) return;
    }
    if (hasEditedFields) return;

    variants.forEach((id) => {
      editedRows.delete(id);
      editedFields.delete(id);
      invalidRowIds.delete(id);
    });

    if (row) {
      const compositeId =
        row.section && (row[FIELD_PART_NUMBER] ?? row.part)
          ? `${row.section}::${row[FIELD_PART_NUMBER] ?? row.part}`
          : null;
      if (compositeId) {
        editedRows.delete(compositeId);
        editedFields.delete(compositeId);
        invalidRowIds.delete(compositeId);
      }
      row.validation = { isValid: true, missingFields: [], skuErrors: [] };
    }
  }

  normalizeEditValue(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  getComparableFieldValue(fieldName: string, value: any, serviceLookupFields: Set<string>): any {
    if (serviceLookupFields.has(fieldName)) {
      return value || '';
    }
    return value;
  }

  hasComparableValueChanged(options: {
    fieldName: string;
    currentValue: any;
    newValue: any;
    serviceLookupFields: Set<string>;
  }): boolean {
    const { fieldName, currentValue, newValue, serviceLookupFields } = options;
    const normalizedCurrent = this.normalizeEditValue(
      this.getComparableFieldValue(fieldName, currentValue, serviceLookupFields),
    );
    const normalizedNew = this.normalizeEditValue(
      this.getComparableFieldValue(fieldName, newValue, serviceLookupFields),
    );
    return normalizedCurrent !== normalizedNew;
  }

  ensureOriginalRowSnapshot(options: {
    materialColorId: string;
    rowData: any[];
    originalRowValues: Map<string | number, any>;
    fallbackRow?: any;
  }): any {
    const { materialColorId, rowData, originalRowValues, fallbackRow } = options;

    if (!originalRowValues.has(materialColorId)) {
      const sourceRow = rowData.find((row) => row.materialColorId === materialColorId) || fallbackRow;
      if (sourceRow) {
        originalRowValues.set(materialColorId, { ...sourceRow });
      }
    }

    return originalRowValues.get(materialColorId);
  }

  syncEditedState(options: {
    materialColorId: string;
    fieldName: string;
    newValue: any;
    rowData: any[];
    fallbackRow?: any;
    originalRowValues: Map<string | number, any>;
    editedRows: Set<string | number>;
    editedFields: Map<string | number, Set<string>>;
    serviceLookupFields: Set<string>;
  }): boolean {
    const {
      materialColorId,
      fieldName,
      newValue,
      rowData,
      fallbackRow,
      originalRowValues,
      editedRows,
      editedFields,
      serviceLookupFields,
    } = options;

    const originalRow = this.ensureOriginalRowSnapshot({
      materialColorId,
      rowData,
      originalRowValues,
      fallbackRow,
    });
    const hasChanged = this.hasComparableValueChanged({
      fieldName,
      currentValue: originalRow?.[fieldName],
      newValue,
      serviceLookupFields,
    });

    if (hasChanged) {
      editedRows.add(materialColorId);
      if (!editedFields.has(materialColorId)) {
        editedFields.set(materialColorId, new Set());
      }
      editedFields.get(materialColorId)!.add(fieldName);
    } else if (editedFields.has(materialColorId)) {
      editedFields.get(materialColorId)!.delete(fieldName);
      if (editedFields.get(materialColorId)!.size === 0) {
        editedRows.delete(materialColorId);
        editedFields.delete(materialColorId);
      }
    }

    return hasChanged;
  }

  buildRowsByMaterialColorId(gridApi: GridApi | undefined): Map<string, any> {
    const rowsById = new Map<string, any>();
    if (!gridApi) return rowsById;

    gridApi.forEachNode((node) => {
      const id = node.data?.materialColorId;
      if (id !== null && id !== undefined) {
        rowsById.set(String(id), node.data);
      }
    });
    return rowsById;
  }

  buildEditedInstances(options: {
    editedRows: Set<string | number>;
    editedFields: Map<string | number, Set<string>>;
    rowsByMaterialColorId: Map<string, any>;
    buildInstanceData: (row: any, editedFieldsForRow: Set<string>) => any;
  }): { [key: string]: any } {
    const { editedRows, editedFields, rowsByMaterialColorId, buildInstanceData } = options;
    const instances: { [key: string]: any } = {};

    editedRows.forEach((materialColorIdRaw) => {
      const materialColorId = String(materialColorIdRaw);
      const currentRow = rowsByMaterialColorId.get(materialColorId);
      if (!currentRow) {
        return;
      }

      const editedFieldsForRow = editedFields.get(materialColorIdRaw) || editedFields.get(materialColorId);
      if (!editedFieldsForRow || editedFieldsForRow.size === 0) {
        return;
      }

      const instanceData = buildInstanceData(currentRow, editedFieldsForRow);
      if (instanceData && Object.keys(instanceData).length > 0) {
        instances[materialColorId] = instanceData;
      }
    });

    return instances;
  }

  applyResponseInstances(options: {
    instances: { [key: string]: any } | undefined;
    rowData: any[];
    editedRows: Set<string | number>;
    editedFields: Map<string | number, Set<string>>;
    skipIds?: Set<string>;
    clearEditedState?: boolean;
  }): void {
    const { instances, rowData, editedRows, editedFields, skipIds, clearEditedState } = options;
    if (!instances || typeof instances !== 'object') return;

    const indexById = new Map<string, number>();
    rowData.forEach((row, index) => {
      if (row?.materialColorId !== undefined && row?.materialColorId !== null) {
        indexById.set(String(row.materialColorId), index);
      }
    });

    Object.keys(instances).forEach((materialColorId) => {
      if (skipIds?.has(materialColorId)) {
        return;
      }

      const rowIndex = indexById.get(materialColorId);
      if (rowIndex === undefined) return;

      rowData[rowIndex] = {
        ...rowData[rowIndex],
        ...instances[materialColorId],
        materialColorId,
      };

      if (clearEditedState) {
        editedRows.delete(materialColorId);
        editedRows.delete(Number(materialColorId));
        editedFields.delete(materialColorId);
        editedFields.delete(Number(materialColorId));
      }
    });
  }

  isServiceSearchColumn(colDef: ColDef | undefined, editorComponent: any): boolean {
    if (!colDef) return false;
    if (colDef.cellEditor !== editorComponent) return false;

    const cellEditorParams = typeof colDef.cellEditorParams === 'function'
      ? colDef.cellEditorParams({} as any)
      : colDef.cellEditorParams;

    return cellEditorParams?.isServiceSearch === true;
  }

  getEditableServiceFields(
    columnDefs: ColDef[],
    disabledFields: Set<string>,
    editorComponent: any,
  ): string[] {
    return columnDefs
      .filter((col) => {
        if (!col.field) return false;
        if (disabledFields.has(col.field)) return false;
        return this.isServiceSearchColumn(col, editorComponent);
      })
      .map((col) => col.field!);
  }

  /**
   * Add row after a specific row index
   */
  addRowAfter(
    rowIndex: number,
    rowData: any[],
    gridApi: GridApi,
    dataService: DataService,
    section?: string, // Optional section to inherit from reference row
    sectionDisplayName?: string // Optional sectionDisplayName to inherit from reference row
  ): { newRow: any; newRowId: number } {
    const newRowIdValue = this.nextRowId;
    const newRow: any = {
      part: '',
      [FIELD_PART_NUMBER]: '',
      supplier: '',
      color: '',
      feature: '',
      bomLinkFeature: '',
      bomLinkStartDate: '',
      bomLinkEndDate: '',
      startDate: '',
      endDate: '',
      qty: 0,
      material: '',
      bomLinkCountryOfOrigin: '',
      isNewRow: true,
      newRowId: newRowIdValue,
      insertAfter: rowIndex,
    };

    // Assign section if provided (inherited from reference row)
    if (section) {
      newRow.section = section;
    }

    if (sectionDisplayName) {
      newRow.sectionDisplayName = sectionDisplayName;
    }

    const skuInfo = dataService.getSkuInfo();
    this.skuService.getFieldNames(skuInfo).forEach((skuFieldName) => {
      newRow[skuFieldName] = '';
    });

    const bomType = dataService.getBomType();

    const insertIndex = rowIndex;

    if (insertIndex >= 0 && insertIndex < rowData.length) {
      const currentFirstVisibleRow = gridApi.getFirstDisplayedRowIndex();
      const currentLastVisibleRow = gridApi.getLastDisplayedRowIndex();
      const newRowIndex = insertIndex + 1;

      const transaction = {
        addIndex: newRowIndex,
        add: [newRow],
      };

      gridApi.applyTransaction(transaction);
      rowData.splice(newRowIndex, 0, newRow);

      setTimeout(() => {
        if (newRowIndex >= currentFirstVisibleRow - 2 && newRowIndex <= currentLastVisibleRow + 2) {
          if (newRowIndex > currentLastVisibleRow) {
            gridApi.ensureIndexVisible(newRowIndex, 'bottom');
          } else if (newRowIndex < currentFirstVisibleRow) {
            gridApi.ensureIndexVisible(newRowIndex, 'top');
          }
        }
      }, 50);
    }

    this.nextRowId = newRowIdValue + 1;
    this.newRows.set(newRowIdValue, newRow);

    return { newRow, newRowId: this.nextRowId };
  }

  /**
   * Delete row by new row ID
   */
  deleteRowById(newRowId: number, rowData: any[], gridApi: GridApi): void {
    const rowIndex = rowData.findIndex((row) => row.newRowId === newRowId);

    if (rowIndex === -1) {
      return;
    }

    const rowToDelete = rowData[rowIndex];

    if (!rowToDelete.isNewRow) {
      return;
    }

    const transaction = {
      remove: [rowToDelete],
    };

    gridApi.applyTransaction(transaction);
    rowData.splice(rowIndex, 1);
    this.newRows.delete(newRowId);
  }

  /**
   * Delete row by part ID
   */
  deleteRow(partId: string, rowData: any[], gridApi: GridApi): void {
    const rowIndex = rowData.findIndex((row) => row.part.toString() === partId);

    if (rowIndex !== -1) {
      const rowToDelete = rowData[rowIndex];

      if (!rowToDelete.isNewRow) {
        return;
      }

      const transaction = {
        remove: [rowToDelete],
      };

      gridApi.applyTransaction(transaction);
      rowData.splice(rowIndex, 1);

      const partIdNum = Number.parseInt(partId, 10);
      if (!Number.isNaN(partIdNum)) {
        this.newRows.delete(partIdNum);
      }
    }
  }

  /**
   * Paste Part Number specifically to a cell
   */
  pastePartNumber(params: any, componentInstance: any): void {
    if (!params.data?.isNewRow) {
      return;
    }

    if (params.colDef?.isDisabled) {
      return;
    }

    const valueToPaste = params.data?.[FIELD_PART_NUMBER] || params.data?.part;

    if (!valueToPaste) {
      return;
    }

    if (params.value === valueToPaste) {
      return;
    }

    params.api.stopEditing();

    const targetField = params.colDef.field;
    params.node.setDataValue(targetField, valueToPaste);

    if (componentInstance?.editedRows && componentInstance?.editedFields) {
      this.syncRowFieldEditState({
        rowData: params.data,
        fieldName: targetField,
        newValue: valueToPaste,
        editedRows: componentInstance.editedRows,
        editedFields: componentInstance.editedFields,
        originalRowValues: componentInstance.originalRowValues,
      });
    }

    params.api.redrawRows({
      rowNodes: [params.node],
    });

    setTimeout(() => {
      params.api.refreshCells({
        rowNodes: [params.node],
        force: true,
      });

      params.api.flashCells({
        rowNodes: [params.node],
        columns: [params.colDef.field],
      });
    }, 50);
  }

  /**
   * Clear SKU cell value for a new row
   */
  clearSkuValue(params: any, componentInstance: any): void {
    if (!params?.data?.isNewRow) {
      return;
    }

    const fieldName = params.colDef?.field;
    if (!this.skuService.isSkuField(fieldName)) {
      return;
    }

    const currentValue = params.node?.data ? params.node.data[fieldName] : params.value;
    if (!currentValue) {
      return;
    }

    params.api.stopEditing();
    params.node.setDataValue(fieldName, '');

    if (componentInstance?.editedRows && componentInstance?.editedFields) {
      this.syncRowFieldEditState({
        rowData: params.data,
        fieldName,
        newValue: '',
        editedRows: componentInstance.editedRows,
        editedFields: componentInstance.editedFields,
        originalRowValues: componentInstance.originalRowValues,
      });
    }

    params.api.refreshCells({
      rowNodes: [params.node],
      columns: [fieldName],
      force: true,
    });

    params.api.flashCells({
      rowNodes: [params.node],
      columns: [fieldName],
    });
  }

  private _skipEditTracking = false;

  setSkipEditTracking(skip: boolean): void {
    this._skipEditTracking = skip;
  }

  isSkipEditTracking(): boolean {
    return this._skipEditTracking;
  }

  /**
   * Track field changes
   */
  trackFieldChange(
    params: any,
    editedRows: Set<string | number>,
    editedFields?: Map<string | number, Set<string>>,
    originalRowValues?: Map<string | number, any>
  ): void {
    if (this._skipEditTracking) return;

    const fieldName: string | undefined = params?.colDef?.field;
    const partId =
      params.data.materialKey ||
      params.data.newRowId ||
      params.data[FIELD_PART_NUMBER] ||
      params.data.part;
    if (!partId || !fieldName) return;

    const compositeId = this.getCompositeId(params.data);
    const isNewRow = !!params?.data?.isNewRow;
    const changed = this.isFieldChanged(params, fieldName, isNewRow, partId, compositeId, originalRowValues);

    this.updateEditedFields(editedFields, partId, fieldName, changed);
    const wasRemoved = this.updateEditedRows(editedRows, params, partId, compositeId, editedFields, changed);

    params.api.refreshCells({
      rowNodes: [params.node],
      force: true,
    });

    if (wasRemoved) {
      this.scheduleRowRedraw(params);
    }
  }

  private getCompositeId(rowData: any): string | null {
    const partValue = rowData?.[FIELD_PART_NUMBER] || rowData?.part;
    const sectionValue = rowData.section;
    return !rowData.materialKey && !rowData.newRowId && sectionValue && partValue
      ? `${sectionValue}::${partValue}`
      : null;
  }

  syncRowFieldEditState(options: {
    rowData: any;
    fieldName: string;
    newValue: any;
    editedRows: Set<string | number>;
    editedFields: Map<string | number, Set<string>>;
    originalRowValues?: Map<string | number, any>;
  }): void {
    const { rowData, fieldName, newValue, editedRows, editedFields, originalRowValues } = options;
    if (!rowData || !fieldName) return;

    const partId =
      rowData.materialKey || rowData.newRowId || rowData[FIELD_PART_NUMBER] || rowData.part;
    if (!partId) return;

    const compositeId = this.getCompositeId(rowData);
    const isNewRow = !!rowData.isNewRow;

    const params = {
      data: rowData,
      oldValue: undefined,
      newValue,
    };

    const changed = this.isFieldChanged(params, fieldName, isNewRow, partId, compositeId, originalRowValues);
    this.updateEditedFields(editedFields, partId, fieldName, changed);
    this.updateEditedRows(editedRows, params, partId, compositeId, editedFields, changed);
  }

  private normalizeForField(fieldName: string, value: any): any {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      return this.normalizeStringValue(fieldName, value);
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && this.isQuantityField(fieldName)) return value;
    return value;
  }

  private normalizeStringValue(fieldName: string, value: string): any {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (this.isQuantityField(fieldName)) {
      const num = Number.parseFloat(trimmed);
      return Number.isNaN(num) ? trimmed : num;
    }
    if (this.isDateField(fieldName)) {
      const date = this.gridConfigService.parseDateString(trimmed);
      return date ? date.getTime() : trimmed;
    }
    return trimmed;
  }

  private isQuantityField(fieldName: string): boolean {
    return QUANTITY_FIELD_SET.has(fieldName);
  }

  private isDateField(fieldName: string): boolean {
    return DATE_FIELD_SET.has(fieldName);
  }

  private getOriginalForField(
    params: any,
    fieldName: string,
    partId: any,
    compositeId: string | null,
    originalRowValues?: Map<string | number, any>
  ): any {
    if (!originalRowValues) return undefined;
    const original =
      originalRowValues.get(params.data.materialKey) ||
      originalRowValues.get(partId) ||
      (compositeId ? originalRowValues.get(compositeId) : null) ||
      originalRowValues.get(params.data?.[FIELD_PART_NUMBER]) ||
      originalRowValues.get(params.data.part) ||
      null;
    if (!original) return undefined;

    const resolver = ORIGINAL_VALUE_RESOLVERS[fieldName];
    return resolver ? resolver(original) : original?.[fieldName];
  }

  private isFieldChanged(
    params: any,
    fieldName: string,
    isNewRow: boolean,
    partId: any,
    compositeId: string | null,
    originalRowValues?: Map<string | number, any>
  ): boolean {
    if (isNewRow) {
      return (
        this.normalizeForField(fieldName, params.oldValue) !==
        this.normalizeForField(fieldName, params.newValue)
      );
    }
    const originalValue = this.getOriginalForField(params, fieldName, partId, compositeId, originalRowValues);
    return (
      this.normalizeForField(fieldName, originalValue) !==
      this.normalizeForField(fieldName, params.newValue)
    );
  }

  private updateEditedFields(
    editedFields: Map<string | number, Set<string>> | undefined,
    partId: any,
    fieldName: string,
    changed: boolean
  ): void {
    if (!editedFields) return;
    if (!editedFields.has(partId)) {
      editedFields.set(partId, new Set<string>());
    }
    const set = editedFields.get(partId)!;
    if (changed) {
      set.add(fieldName);
    } else {
      set.delete(fieldName);
    }
    if (set.size === 0) {
      editedFields.delete(partId);
    }
  }

  private getIdVariants(id: any): Set<string | number> {
    const variants = new Set<string | number>();
    if (id === null || id === undefined || `${id}`.trim() === '') return variants;
    variants.add(id);
    variants.add(`${id}`);
    const numId = Number(id);
    if (!Number.isNaN(numId)) variants.add(numId);
    return variants;
  }

  private getAllIdVariants(params: any, partId: any, compositeId: string | null): Set<string | number> {
    const baseIds = new Set([
      params.data.materialKey,
      params.data.newRowId,
      partId,
      params.data[FIELD_PART_NUMBER],
      params.data.part,
      compositeId,
      params.data.section && (params.data[FIELD_PART_NUMBER] || params.data.part)
        ? `${params.data.section}::${params.data[FIELD_PART_NUMBER] || params.data.part}`
        : null,
    ]);
    baseIds.delete(null);
    baseIds.delete(undefined);
    baseIds.delete('');

    const allIdVariants = new Set<string | number>();
    baseIds.forEach((id) => {
      this.getIdVariants(id).forEach((variant) => allIdVariants.add(variant));
    });
    return allIdVariants;
  }

  private updateEditedRows(
    editedRows: Set<string | number>,
    params: any,
    partId: any,
    compositeId: string | null,
    editedFields: Map<string | number, Set<string>> | undefined,
    changed: boolean
  ): boolean {
    const allIdVariants = this.getAllIdVariants(params, partId, compositeId);
    if (editedFields) {
      const hasAnyEdits = editedFields.has(partId) && (editedFields.get(partId)?.size || 0) > 0;
      if (hasAnyEdits) {
        allIdVariants.forEach((id) => editedRows.add(id));
        return false;
      } else {
        allIdVariants.forEach((id) => editedRows.delete(id));
        return true;
      }
    } else if (changed) {
      allIdVariants.forEach((id) => editedRows.add(id));
      return false;
    }
    return false;
  }

  private scheduleRowRedraw(params: any): void {
    setTimeout(() => {
      const isEditing = params.api
        .getEditingCells()
        .some((cell: any) => cell.rowIndex === params.node.rowIndex);
      if (!isEditing) {
        params.api.redrawRows({ rowNodes: [params.node] });
      }
    }, 100);
  }

  /**
   * Handle new row value changes (auto-population)
   */
  onNewRowValueChanged(
    params: any,
    dataService: DataService,
    editedRows: Set<string | number>
  ): void {
    const isPartField = params.field === FIELD_PART || params.colDef?.field === FIELD_PART;
    const isPartChanged = this.normalizeEditValue(params.oldValue) !== this.normalizeEditValue(params.newValue);

    if (isPartField && isPartChanged) {
      const skuFieldNames = this.skuService.getFieldNames(dataService.getSkuInfo());
      skuFieldNames.forEach((fieldName) => {
        const currentValue = params.node?.data?.[fieldName];
        if (currentValue !== '' && currentValue !== null && currentValue !== undefined) {
          params.node.setDataValue(fieldName, '');
          if (params.node?.data) {
            params.node.data[fieldName] = '';
          }
        }
      });
    }

    if (isPartField && params.newValue) {
      const apiData = dataService.getApiData();
      const items = Array.isArray(apiData?.instances) ? apiData.instances : [];
      if (items.length === 0) {
        return;
      }
      const existingPart = items.find((item) => {
        const bomLink = item[BOM_LINK_KEY];
        return bomLink?.[FIELD_PART_NUMBER] === params.newValue;
      });

      if (existingPart) {
        const bomLink = existingPart[BOM_LINK_KEY];
        const existingPartData = bomLink as any;

        const fieldsToPopulate = PART_LOOKUP_POPULATED_FIELDS;
        const oldData = { ...params.node.data };

        fieldsToPopulate.forEach((fieldName) => {
          if (existingPartData[fieldName] !== undefined && existingPartData[fieldName] !== null) {
            let valueToSet = existingPartData[fieldName];

            if (fieldName === FIELD_BOM_LINK_START_DATE || fieldName === FIELD_BOM_LINK_END_DATE) {
              valueToSet = this.gridConfigService.formatDateToMMDDYYYY(valueToSet);
            }

            if (oldData[fieldName] !== valueToSet) {
              params.node.setDataValue(fieldName, valueToSet);
              if (params.node.data) {
                params.node.data[fieldName] = valueToSet;
              }
            }
          }
        });

        setTimeout(() => {
          params.api.refreshCells({
            rowNodes: [params.node],
            force: true,
          });
        }, 100);
      }
    }

    if (!params.data.isNewRow) {
      editedRows.add(String(params.data?.[FIELD_PART_NUMBER] ?? ''));
    }
  }

  /**
   * Save changes
   */
  saveChanges(
    rowData: any[],
    editedRows: Set<string | number>,
    gridApi: GridApi,
    componentInstance: any
  ): Promise<{ success: boolean; message: string; payload?: any }> {
    return new Promise((resolve) => {
      if (editedRows.size === 0) {
        resolve({ success: false, message: 'No changes to save' });
        return;
      }

      const apiPayload = componentInstance.transformGridDataToApiFormat
        ? componentInstance.transformGridDataToApiFormat(rowData)
        : null;

      if (apiPayload) {
        if (
          apiPayload.instances &&
          apiPayload.instances.length > 0 &&
          componentInstance.dataService
        ) {
          componentInstance.dataService.updateBomData(apiPayload).subscribe({
            next: (response: any) => {
              this.handleSaveSuccess(response, rowData, componentInstance, editedRows, gridApi, apiPayload, resolve);
            },
            error: (error: any) => {
              const errorMessage = this.getErrorMessage(error);
              resolve({
                success: false,
                message: errorMessage,
                payload: apiPayload,
              });
            },
          });
        } else {
          this.handleLocalSave(rowData, componentInstance, editedRows, gridApi, apiPayload, resolve);
        }
      } else {
        resolve({
          success: false,
          message: 'No payload to save',
        });
      }
    });
  }

  private handleSaveSuccess(
    response: any,
    rowData: any[],
    componentInstance: any,
    editedRows: Set<string | number>,
    gridApi: GridApi,
    apiPayload: any,
    resolve: (value: { success: boolean; message: string; payload?: any }) => void
  ): void {
    this.updateSaveTimestamp();

    if (response && (response.instances || response.data)) {
      const responseData = response.instances ? response : response.data;
      this.updateApiData(responseData, componentInstance);
      this.updateGridData(responseData, rowData, componentInstance, editedRows);
    } else {
      this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
    }

    this.clearEditedState(editedRows, componentInstance);
    this.updateOriginalValues(componentInstance);
    this.refreshGridAfterSave(gridApi, componentInstance);

    resolve({
      success: true,
      message: `Successfully saved changes!`,
      payload: apiPayload,
    });
  }

  private handleLocalSave(
    rowData: any[],
    componentInstance: any,
    editedRows: Set<string | number>,
    gridApi: GridApi,
    apiPayload: any,
    resolve: (value: { success: boolean; message: string; payload?: any }) => void
  ): void {
    setTimeout(() => {
      this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
      this.updateSaveTimestamp();
      gridApi.refreshCells({
        force: true,
        suppressFlash: false,
      });
      resolve({
        success: true,
        message: `Successfully saved changes!`,
        payload: apiPayload,
      });
    }, 100);
  }

  private updateApiData(responseData: any, componentInstance: any): void {
    if (responseData && componentInstance.dataService?.updateApiData) {
      componentInstance.dataService.updateApiData(responseData);
    }
  }

  private updateGridData(
    responseData: any,
    rowData: any[],
    componentInstance: any,
    editedRows: Set<string | number>
  ): void {
    if (responseData && componentInstance.transformToTreeData) {
      try {
        const updatedHierarchicalData = componentInstance.transformToTreeData(responseData);
        componentInstance.rowData = updatedHierarchicalData;
        componentInstance.displayData = [];
        if (componentInstance.applyGridSearch) {
          componentInstance.applyGridSearch();
        }
      } catch (error) {
        this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
      }
    } else {
      this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
    }
  }

  private clearEditedState(editedRows: Set<string | number>, componentInstance: any): void {
    editedRows.clear();
    if (componentInstance.editedFields) {
      componentInstance.editedFields.clear();
    }
  }

  private updateOriginalValues(componentInstance: any): void {
    if (componentInstance.storeOriginalValues) {
      componentInstance.storeOriginalValues();
    }
  }

  private updateSaveTimestamp(): void {
    this.lastSavedAt = new Date();
    localStorage.setItem(LS_KEY_LAST_SAVED_AT, this.lastSavedAt.toISOString());
    this.newRows.clear();
  }

  private refreshGridAfterSave(gridApi: GridApi, componentInstance: any): void {
    gridApi.refreshCells({
      force: true,
      suppressFlash: false,
    });
    setTimeout(() => {
      if (componentInstance.applyGridSearch) {
        componentInstance.applyGridSearch();
      }
      gridApi.refreshCells({ force: true });
    }, 100);
  }

  private getErrorMessage(error: any): string {
    const backendError =
      (typeof error.error === 'string' ? error.error : null) ||
      error.error?.error ||
      error.error?.message ||
      error.message ||
      '';

    if (error.status) {
      return this.getErrorMessageForStatus(error.status, backendError, error.statusText);
    }
    if (error.message) {
      return `Failed to save: ${error.message}`;
    }
    return 'Failed to save changes.';
  }

  private getErrorMessageForStatus(status: number, backendError: string, statusText?: string): string {
    const errorMessages: Record<number, string> = {
      404: backendError || 'Failed to save: Resource not found (404). Please check your connection and try again.',
      500: backendError || 'Failed to save: Server error (500). Please try again later or contact support.',
      400: backendError || 'Failed to save: Bad request (400). Please check your data and try again.',
      401: backendError || 'Failed to save: Unauthorized (401). Please refresh the page and try again.',
      403: backendError || 'Failed to save: Forbidden (403). You do not have permission to perform this action.',
    };

    if (errorMessages[status]) {
      return backendError ? `Failed to save: ${backendError}` : errorMessages[status];
    }

    return backendError
      ? `Failed to save: ${backendError}`
      : `Failed to save: ${status} ${statusText || 'Error'}. Please try again.`;
  }

  /**
   * Update local row data after save (remove isNewRow flags, etc.)
   */
  private updateLocalRowDataAfterSave(
    rowData: any[],
    componentInstance: any,
    editedRows: Set<string | number>
  ): void {
    const updatedRowData = this.removeNewRowFlags(rowData);
    componentInstance.rowData = updatedRowData;

    componentInstance.displayData = [];

    editedRows.clear();

    if (componentInstance.editedFields) {
      componentInstance.editedFields.clear();
    }

    if (componentInstance.storeOriginalValues) {
      componentInstance.storeOriginalValues();
    }
  }

  /**
   * Recursively remove isNewRow flags from row data
   */
  private removeNewRowFlags(rows: any[]): any[] {
    return rows.map((row) => {
      const updatedRow = { ...row };

      if (updatedRow.isNewRow) {
        delete updatedRow.isNewRow;
        delete updatedRow.newRowId;
        delete updatedRow.insertAfter;
        delete updatedRow.insertAfterSection;
      }

      // Recursively process children
      if (updatedRow.children && Array.isArray(updatedRow.children)) {
        updatedRow.children = this.removeNewRowFlags(updatedRow.children);
      }

      return updatedRow;
    });
  }

  /**
   * Show save message
   */
  showSaveMessage(
    message: string,
    componentInstance: any,
    type: 'success' | 'error' | 'error-persistent' | 'info' = NOTIFICATION_TYPE_INFO
  ): void {
    componentInstance.saveMessage = message;
    componentInstance.saveMessageType = type;

    if (type === NOTIFICATION_TYPE_SUCCESS || type === NOTIFICATION_TYPE_INFO || type === NOTIFICATION_TYPE_ERROR) {
      setTimeout(() => {
        this.clearSaveMessage(componentInstance);
      }, 3000);
    }
  }

  /**
   * Clear save message
   */
  clearSaveMessage(componentInstance: any): void {
    componentInstance.saveMessage = '';
    componentInstance.saveMessageType = '';
  }
}
