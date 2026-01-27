import { Injectable } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { DataService } from './data.service';
import { GridConfigService } from './grid-config.service';

@Injectable({
  providedIn: 'root',
})
export class RowManagementService {
  private nextRowId = 10000;
  private readonly newRows = new Map<number, any>();
  private lastSavedAt: Date | null = null;

  constructor(private readonly gridConfigService: GridConfigService) {
    const savedTimestamp = localStorage.getItem('lastSavedAt');
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
    localStorage.setItem('lastSavedAt', date.toISOString());
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
      partNumber: '',
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
    skuInfo.forEach((sku) => {
      newRow[`sku${sku.skuId}`] = '';
    });

    const bomType = dataService.getBomType();
    if (bomType === 'SBOM') {
      newRow.bomLinkSpecSheetExtra = 'Yes';
      newRow.bomLinkIncludeInSpecSheet = '';
    }

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

    const valueToPaste = params.data.partNumber || params.data.part;

    if (!valueToPaste) {
      return;
    }

    if (params.value === valueToPaste) {
      return;
    }

    params.api.stopEditing();

    params.node.setDataValue(params.colDef.field, valueToPaste);

    if (params.data.newRowId) {
      componentInstance.editedRows.add(params.data.newRowId);
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
    if (!fieldName?.startsWith('sku')) {
      return;
    }

    const currentValue = params.node?.data ? params.node.data[fieldName] : params.value;
    if (!currentValue) {
      return;
    }

    params.api.stopEditing();
    params.node.setDataValue(fieldName, '');

    if (params.data.newRowId) {
      componentInstance.editedRows.add(params.data.newRowId);
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

  /**
   * Track field changes
   */
  trackFieldChange(
    params: any,
    editedRows: Set<string | number>,
    editedFields?: Map<string | number, Set<string>>,
    originalRowValues?: Map<string | number, any>
  ): void {
    const fieldName: string | undefined = params?.colDef?.field;
    const partId =
      params.data.materialKey || params.data.newRowId || params.data.partNumber || params.data.part;
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
    const partValue = rowData.partNumber || rowData.part;
    const sectionValue = rowData.section;
    return !rowData.materialKey && !rowData.newRowId && sectionValue && partValue
      ? `${sectionValue}::${partValue}`
      : null;
  }

  private normalizeForField(fieldName: string, value: any): any {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      return this.normalizeStringValue(fieldName, value);
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && (fieldName === 'quantity' || fieldName === 'qty')) return value;
    return value;
  }

  private normalizeStringValue(fieldName: string, value: string): any {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (fieldName === 'quantity' || fieldName === 'qty') {
      const num = Number.parseFloat(trimmed);
      return Number.isNaN(num) ? trimmed : num;
    }
    if (this.isDateField(fieldName)) {
      const date = this.gridConfigService.parseDateString(trimmed);
      return date ? date.getTime() : trimmed;
    }
    return trimmed;
  }

  private isDateField(fieldName: string): boolean {
    return (
      fieldName === 'bomLinkStartDate' ||
      fieldName === 'bomLinkEndDate' ||
      fieldName === 'startDate' ||
      fieldName === 'endDate'
    );
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
      originalRowValues.get(params.data.partNumber) ||
      originalRowValues.get(params.data.part) ||
      null;
    if (!original) return undefined;

    if (fieldName === 'bomLinkStartDate' || fieldName === 'startDate') return original.bomLinkStartDate;
    if (fieldName === 'bomLinkEndDate' || fieldName === 'endDate') return original.bomLinkEndDate;
    if (fieldName === 'quantity' || fieldName === 'qty') return original.quantity;
    if (fieldName === 'bomLinkSpecSheetExtra') return original.bomLinkSpecSheetExtra;
    if (fieldName === 'bomLinkIncludeInSpecSheet') return original.bomLinkIncludeInSpecSheet;

    return undefined;
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
      params.data.partNumber,
      params.data.part,
      compositeId,
      params.data.section && (params.data.partNumber || params.data.part)
        ? `${params.data.section}::${params.data.partNumber || params.data.part}`
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
    if ((params.field === 'part' || params.colDef?.field === 'part') && params.newValue) {
      const apiData = dataService.getApiData();

      const items = apiData!.instances;
      const existingPart = items.find((item) => {
        const bomLink = item['bom-link'];
        return bomLink.partNumber === params.newValue;
      });

      if (existingPart) {
        const bomLink = existingPart['bom-link'];
        const existingPartData = bomLink as any;

        const fieldsToPopulate = [
          'supplier',
          'colorDescription',
          'bomLinkFeature',
          'materialDescription',
          'bomLinkStartDate',
          'bomLinkEndDate',
          'quantity',
        ];
        const oldData = { ...params.node.data };

        fieldsToPopulate.forEach((fieldName) => {
          if (existingPartData[fieldName] !== undefined && existingPartData[fieldName] !== null) {
            let valueToSet = existingPartData[fieldName];

            if (fieldName === 'bomLinkStartDate' || fieldName === 'bomLinkEndDate') {
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

        const skuInfo = dataService.getSkuInfo();
        skuInfo.forEach((sku) => {
          const skuFieldName = `sku${sku.skuId}`;
          const matchingSku = existingPartData.skus.find((s: any) => s.skuId === sku.skuId);
          const newSkuValue = matchingSku ? matchingSku.value : '';

          if (oldData[skuFieldName] !== newSkuValue) {
            params.node.setDataValue(skuFieldName, newSkuValue);
            if (params.node.data) {
              params.node.data[skuFieldName] = newSkuValue;
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
      editedRows.add(params.data.partNumber.toString());
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
    if (response && (response.instances || response.data)) {
      const responseData = response.instances ? response : response.data;
      this.updateApiData(responseData, componentInstance);
      this.updateGridData(responseData, rowData, componentInstance, editedRows);
    } else {
      this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
    }

    this.clearEditedState(editedRows, componentInstance);
    this.updateOriginalValues(componentInstance);
    this.updateSaveTimestamp();
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
    if (responseData && componentInstance.transformToHierarchicalData) {
      try {
        const updatedHierarchicalData = componentInstance.transformToHierarchicalData(responseData);
        componentInstance.rowData = updatedHierarchicalData;
        componentInstance.displayData = [];
        if (componentInstance.applyHierarchicalSearch) {
          componentInstance.applyHierarchicalSearch();
        }
      } catch (error) {
        console.warn('Failed to apply hierarchical search after save, using local update:', error);
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
    localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
    this.newRows.clear();
  }

  private refreshGridAfterSave(gridApi: GridApi, componentInstance: any): void {
    gridApi.refreshCells({
      force: true,
      suppressFlash: false,
    });
    setTimeout(() => {
      if (componentInstance.applyHierarchicalSearch) {
        componentInstance.applyHierarchicalSearch();
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
    type: 'success' | 'error' | 'error-persistent' | 'info' = 'info'
  ): void {
    componentInstance.saveMessage = message;
    componentInstance.saveMessageType = type;

    if (type === 'success' || type === 'info' || type === 'error') {
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
