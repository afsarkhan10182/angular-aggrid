import { Injectable } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { DataService } from './data.service';
import { GridCommonService } from './grid-common.service';

@Injectable({
  providedIn: 'root',
})
export class RowManagementService {
  private nextRowId = 10000;
  private newRows = new Map<number, any>();
  private lastSavedAt: Date | null = null;

  constructor(private gridCommonService: GridCommonService) {
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
    section?: string // Optional section to inherit from reference row
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

    const skuInfo = dataService.getSkuInfo();
    skuInfo.forEach((sku) => {
      (newRow as any)[`sku${sku.skuId}`] = '';
    });

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

      const partIdNum = parseInt(partId, 10);
      if (!isNaN(partIdNum)) {
        this.newRows.delete(partIdNum);
      }
    }
  }

  /**
   * Paste Part Number specifically to a cell
   */
  pastePartNumber(params: any, componentInstance: any): void {
    if (!params.data || !params.data.isNewRow) {
      return;
    }

    const valueToPaste = params.data.partNumber || params.data.part;

    if (!valueToPaste) {
      return;
    }

    // Don't paste if the cell already has the same value
    if (params.value === valueToPaste) {
      return;
    }

    // Stop any ongoing editing
    params.api.stopEditing();

    // Set the value in the cell
    params.node.setDataValue(params.colDef.field, valueToPaste);

    // Mark the row as edited
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
    if (!params?.data || !params.data.isNewRow) {
      return;
    }

    const fieldName = params.colDef?.field;
    if (!fieldName || !fieldName.startsWith('sku')) {
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
    editedFields?: Map<string | number, Set<string>>
  ): void {
    let valuesAreSame = false;
    if (params.oldValue instanceof Date && params.newValue instanceof Date) {
      valuesAreSame = params.oldValue.getTime() === params.newValue.getTime();
    } else {
      valuesAreSame = params.oldValue === params.newValue;
    }

    if (valuesAreSame) {
      return;
    }

    const partId = params.data.partNumber || params.data.part || params.data.newRowId;
    const fieldName = params.colDef.field;

    if (params.data.isNewRow && fieldName.startsWith('sku')) {
      return;
    }

    editedRows.add(partId);

    // Track which specific field was edited
    if (editedFields && partId) {
      if (!editedFields.has(partId)) {
        editedFields.set(partId, new Set<string>());
      }
      editedFields.get(partId)!.add(fieldName);
    }

    params.api.refreshCells({
      rowNodes: [params.node],
      force: true,
    });
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
              valueToSet = this.gridCommonService.formatDateToMMDDYYYY(valueToSet);
            }

            if (oldData[fieldName] !== valueToSet) {
              params.node.setDataValue(fieldName, valueToSet);
              if (params.node.data) {
                (params.node.data as any)[fieldName] = valueToSet;
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
              (params.node.data as any)[skuFieldName] = newSkuValue;
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

      const changesCount = editedRows.size;

      // Transform grid data to API format with mixed edit/create support
      const apiPayload = componentInstance.transformGridDataToApiFormat
        ? componentInstance.transformGridDataToApiFormat(rowData)
        : null;

      // Log the payload for debugging (can be removed in production)
      if (apiPayload) {
        console.log('Update API Payload:', JSON.stringify(apiPayload, null, 2));

        // Call the API if payload exists and has instances
        if (
          apiPayload.instances &&
          apiPayload.instances.length > 0 &&
          componentInstance.dataService
        ) {
          componentInstance.dataService.updateBomData(apiPayload).subscribe({
            next: (response: any) => {
              console.log('BOM update successful:', response);
              // After successful save, update original values to match current state
              // This ensures subsequent edits use the correct "old" values
              // Note: Backend does NOT return old values in response - frontend must track them
              if (componentInstance.storeOriginalValues) {
                componentInstance.storeOriginalValues();
              }
            },
            error: (error: any) => {
              console.error('BOM update failed:', error);
            },
          });
        }
      }

      setTimeout(() => {
        const updatedRowData = rowData.map((row) => {
          if (row.isNewRow) {
            const updatedRow = { ...row };
            delete updatedRow.isNewRow;
            delete updatedRow.newRowId;
            delete updatedRow.insertAfter;
            return updatedRow;
          }
          return row;
        });

        componentInstance.rowData = updatedRowData;
        editedRows.clear();
        // Clear edited fields tracking
        if (componentInstance.editedFields) {
          componentInstance.editedFields.clear();
        }

        // CRITICAL: After successful save, update original values to match current values
        // This ensures that if user edits again, we have the correct "old" values
        // The originalRowValues Map should reflect the current state after save
        if (componentInstance.storeOriginalValues) {
          componentInstance.storeOriginalValues();
        }

        this.lastSavedAt = new Date();
        localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
        this.newRows.clear();

        gridApi.refreshCells({
          force: true,
          suppressFlash: false,
        });

        resolve({
          success: true,
          message: `Successfully saved ${changesCount} changes!`,
          payload: apiPayload, // Include payload in response for potential API call
        });
      }, 1000);
    });
  }

  /**
   * Show save message
   */
  showSaveMessage(
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    componentInstance: any
  ): void {
    componentInstance.saveMessage = message;
    componentInstance.saveMessageType = type;

    // Auto-clear success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
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
