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
  private copiedSkuValue: string = '';
  private copiedFromRowId: number | null = null;
  private copiedFromCellKey: string = '';

  constructor(private gridCommonService: GridCommonService) {
    // Load lastSavedAt from localStorage if available
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
    dataService: DataService
  ): { newRow: any; newRowId: number } {
    const newRowIdValue = this.nextRowId;
    const newRow = {
      part: '', // Start with empty string for part
      partNumber: '',
      supplier: '',
      color: '',
      feature: '',
      bomLinkFeature: '',
      bomLinkStartDate: '', // Use bomLinkStartDate to match API field names
      bomLinkEndDate: '', // Use bomLinkEndDate to match API field names
      startDate: '', // Keep for backward compatibility
      endDate: '', // Keep for backward compatibility
      qty: 0,
      material: '', // Add empty material field
      bomLinkCountryOfOrigin: '',
      isNewRow: true,
      newRowId: newRowIdValue, // Add the unique ID to the row data
      insertAfter: rowIndex,
    };

    // Add SKU columns with empty values
    const skuInfo = dataService.getSkuInfo();
    skuInfo.forEach((sku) => {
      (newRow as any)[`sku${sku.sku}`] = '';
    });

    // Use the provided row index directly
    const insertIndex = rowIndex;

    if (insertIndex >= 0 && insertIndex < rowData.length) {
      // Store current scroll context
      const currentFirstVisibleRow = gridApi.getFirstDisplayedRowIndex();
      const currentLastVisibleRow = gridApi.getLastDisplayedRowIndex();
      const newRowIndex = insertIndex + 1;

      // Use AG Grid's transaction API for efficient updates
      const transaction = {
        addIndex: newRowIndex, // Insert after the target row
        add: [newRow],
      };

      // Apply the transaction - AG Grid handles the update efficiently
      gridApi.applyTransaction(transaction);

      // Update our local rowData to stay in sync
      rowData.splice(newRowIndex, 0, newRow);

      // Smart scroll behavior - show new row without jumping away from current area
      setTimeout(() => {
        // If the new row is within or near the currently visible area
        if (newRowIndex >= currentFirstVisibleRow - 2 && newRowIndex <= currentLastVisibleRow + 2) {
          // If the new row is below the current visible area, scroll just enough to show it
          if (newRowIndex > currentLastVisibleRow) {
            gridApi.ensureIndexVisible(newRowIndex, 'bottom');
          }
          // If the new row is above the current visible area, scroll just enough to show it
          else if (newRowIndex < currentFirstVisibleRow) {
            gridApi.ensureIndexVisible(newRowIndex, 'top');
          }
          // If the new row is already visible, don't scroll at all
        }
        // Otherwise, don't scroll - let the user stay where they are
      }, 50);
    }

    // Update state
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

    // Only allow deletion of new rows
    if (!rowToDelete.isNewRow) {
      return;
    }

    // Use AG Grid's transaction API for efficient deletion
    const transaction = {
      remove: [rowToDelete],
    };

    // Apply the transaction
    gridApi.applyTransaction(transaction);

    // Update our local rowData to stay in sync
    rowData.splice(rowIndex, 1);

    // Update state
    this.newRows.delete(newRowId);
  }

  /**
   * Delete row by part ID
   */
  deleteRow(partId: string, rowData: any[], gridApi: GridApi): void {
    const rowIndex = rowData.findIndex((row) => row.part.toString() === partId);

    if (rowIndex !== -1) {
      const rowToDelete = rowData[rowIndex];

      // Only allow deletion of new rows
      if (!rowToDelete.isNewRow) {
        return;
      }

      // Use AG Grid's transaction API for efficient deletion
      const transaction = {
        remove: [rowToDelete],
      };

      // Apply the transaction
      gridApi.applyTransaction(transaction);

      // Update our local rowData to stay in sync
      rowData.splice(rowIndex, 1);

      // Update state
      const partIdNum = parseInt(partId, 10);
      if (!isNaN(partIdNum)) {
        this.newRows.delete(partIdNum);
      }
    }
  }

  /**
   * Copy SKU value from a cell (only for new rows)
   */
  copySkuValue(params: any, componentInstance: any): void {
    if (!params.data || !params.data.isNewRow) {
      return;
    }

    const valueToCopy = params.value || params.data.partNumber || params.data.part;

    if (!valueToCopy) {
      return;
    }

    this.copiedSkuValue = valueToCopy;
    this.copiedFromRowId = params.data.newRowId;
    this.copiedFromCellKey = `${params.node.rowIndex}-${params.colDef.field}`;

    // Visual feedback - refresh cells to show copy indicator
    params.api.refreshCells({
      force: true,
    });
  }

  /**
   * Paste SKU value to a cell
   */
  pasteSkuValue(params: any, componentInstance: any): void {
    if (!params.data || !params.data.isNewRow) {
      return;
    }

    let valueToPaste = this.copiedSkuValue;

    // If we have a copied value, check the row restriction
    if (valueToPaste) {
      if (this.copiedFromRowId !== null && params.data.newRowId !== this.copiedFromRowId) {
        // If restriction fails, fall back to local part number
        valueToPaste = params.data.partNumber || params.data.part;
      }
    } else {
      // No copied value, use local part number
      valueToPaste = params.data.partNumber || params.data.part;
    }

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

    // Force immediate refresh of the entire row
    params.api.redrawRows({
      rowNodes: [params.node],
    });

    // Additional refresh after a short delay
    setTimeout(() => {
      params.api.refreshCells({
        rowNodes: [params.node],
        force: true,
      });

      // Flash the cell to show the paste was successful
      params.api.flashCells({
        rowNodes: [params.node],
        columns: [params.colDef.field],
      });
    }, 50);
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

    // Force immediate refresh of the entire row
    params.api.redrawRows({
      rowNodes: [params.node],
    });

    // Additional refresh after a short delay
    setTimeout(() => {
      params.api.refreshCells({
        rowNodes: [params.node],
        force: true,
      });

      // Flash the cell to show the paste was successful
      params.api.flashCells({
        rowNodes: [params.node],
        columns: [params.colDef.field],
      });
    }, 50);
  }

  /**
   * Clear copy state and visual indicators
   */
  clearCopyState(gridApi: GridApi, componentInstance: any): void {
    this.copiedSkuValue = '';
    this.copiedFromRowId = null;
    this.copiedFromCellKey = '';

    // Refresh grid to remove visual indicators
    gridApi.refreshCells({
      force: true,
    });
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
  trackFieldChange(params: any, editedRows: Set<string | number>): void {
    // Skip if values are the same (no actual change)
    // Handle date comparison properly
    let valuesAreSame = false;
    if (params.oldValue instanceof Date && params.newValue instanceof Date) {
      valuesAreSame = params.oldValue.getTime() === params.newValue.getTime();
    } else {
      valuesAreSame = params.oldValue === params.newValue;
    }

    if (valuesAreSame) {
      return;
    }

    const partId = params.data.part;
    const fieldName = params.colDef.field;

    // Skip tracking during auto-population for SKU fields only
    if (params.data.isNewRow && fieldName.startsWith('sku')) {
      return;
    }

    // Mark row as edited - use the part value directly (should be a number)
    editedRows.add(partId);

    // Refresh the row to apply styling
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
    // If part number is changed, populate the feature from existing data
    if ((params.field === 'part' || params.colDef?.field === 'part') && params.newValue) {
      // Get the original mock data from the data service
      const apiData = dataService.getApiData();

      if (apiData && apiData.mbom) {
        // Search in the original API data
        const existingPart = apiData.mbom.find((part) => part.part === params.newValue);

        if (existingPart) {
          // Auto-populate all available fields from the existing part
          const fieldsToPopulate = [
            'supplier',
            'color',
            'feature',
            'shortDesc',
            'longDesc',
            'startDate',
            'endDate',
            'qty',
          ];
          const existingPartData = existingPart as any;

          // Temporarily disable cell value changed events
          const oldData = { ...params.node.data };

          // Auto-populate base fields
          fieldsToPopulate.forEach((fieldName) => {
            if (existingPartData[fieldName] !== undefined && existingPartData[fieldName] !== null) {
              let valueToSet = existingPartData[fieldName];

              // Special handling for date fields - keep in MM/DD/YYYY format
              if (
                fieldName === 'startDate' ||
                fieldName === 'endDate' ||
                fieldName === 'bomLinkStartDate' ||
                fieldName === 'bomLinkEndDate'
              ) {
                // Use centralized function to format date to MM/DD/YYYY
                valueToSet = this.gridCommonService.formatDateToMMDDYYYY(valueToSet);
              }

              // Only update if value is different
              if (oldData[fieldName] !== valueToSet) {
                params.node.setDataValue(fieldName, valueToSet);
                if (params.node.data) {
                  (params.node.data as any)[fieldName] = valueToSet;
                }
              }
            }
          });

          // Auto-populate SKU columns based on the skus array in the existing part
          const skuInfo = dataService.getSkuInfo();
          if (skuInfo && skuInfo.length > 0) {
            skuInfo.forEach((sku) => {
              const skuFieldName = `sku${sku.sku}`;
              const newSkuValue =
                existingPartData.skus && existingPartData.skus.includes(sku.sku)
                  ? existingPartData.part
                  : '';

              // Only update if value is different
              if (oldData[skuFieldName] !== newSkuValue) {
                params.node.setDataValue(skuFieldName, newSkuValue);
                if (params.node.data) {
                  (params.node.data as any)[skuFieldName] = newSkuValue;
                }
              }
            });
          }

          // Refresh the row to show all updated values
          setTimeout(() => {
            params.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }, 100);
        }
      }
    }

    // Track edited rows for styling
    if (!params.data.isNewRow) {
      editedRows.add(params.data.part.toString());
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
  ): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      if (editedRows.size === 0) {
        resolve({ success: false, message: 'No changes to save' });
        return;
      }

      // Capture the number of changes before clearing
      const changesCount = editedRows.size;

      // Simulate API call delay
      setTimeout(() => {
        // Update new rows to be regular rows after save
        const updatedRowData = rowData.map((row) => {
          if (row.isNewRow) {
            // Convert new row to regular row
            const updatedRow = { ...row };
            delete updatedRow.isNewRow;
            delete updatedRow.newRowId;
            delete updatedRow.insertAfter;
            return updatedRow;
          }
          return row;
        });

        // Update the component's rowData with the updated data
        componentInstance.rowData = updatedRowData;

        // Clear the edited state
        editedRows.clear();

        // Update state
        this.lastSavedAt = new Date();
        localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
        this.newRows.clear();

        // Clear copy state to remove copyable behavior after save
        this.clearCopyState(gridApi, componentInstance);

        // Refresh the grid to apply all changes
        gridApi.refreshCells({
          force: true,
          suppressFlash: false,
        });

        resolve({
          success: true,
          message: `Successfully saved ${changesCount} changes!`,
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
