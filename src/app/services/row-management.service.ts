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

    // Assign sectionDisplayName if provided (inherited from reference row)
    if (sectionDisplayName) {
      newRow.sectionDisplayName = sectionDisplayName;
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
    editedFields?: Map<string | number, Set<string>>,
    originalRowValues?: Map<string | number, any>
  ): void {
    const fieldName: string | undefined = params?.colDef?.field;

    // Use a truly unique row key for edit tracking.
    // NOTE: partNumber/part can repeat (duplicates). To avoid wrong highlight,
    // also track a composite key using section when we don't have a unique id.
    const partId =
      params.data.materialKey || params.data.newRowId || params.data.partNumber || params.data.part;
    if (!partId || !fieldName) return;

    // Extra disambiguation key for duplicate part/partNumber across sections
    // (keeps existing save logic intact because we still store the original partId).
    const partValue = params.data.partNumber || params.data.part;
    const sectionValue = params.data.section;
    const compositeId =
      !params.data.materialKey && !params.data.newRowId && sectionValue && partValue
        ? `${sectionValue}::${partValue}`
        : null;

    const normalizeForField = (f: string, v: any): any => {
      // Treat null/undefined/whitespace as the same "empty" value
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') {
        const s = v.trim();
        if (s === '') return '';
        if (f === 'quantity' || f === 'qty') {
          const n = parseFloat(s);
          return isNaN(n) ? s : n;
        }
        if (
          f === 'bomLinkStartDate' ||
          f === 'bomLinkEndDate' ||
          f === 'startDate' ||
          f === 'endDate'
        ) {
          const d = this.gridCommonService.parseDateString(s);
          return d ? d.getTime() : s;
        }
        return s;
      }
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number' && (f === 'quantity' || f === 'qty')) return v;
      return v;
    };

    const getOriginalForField = (): any => {
      if (!originalRowValues) return undefined;
      const original =
        originalRowValues.get(params.data.materialKey) ||
        originalRowValues.get(partId) ||
        (compositeId ? originalRowValues.get(compositeId) : null) ||
        originalRowValues.get(params.data.partNumber) ||
        originalRowValues.get(params.data.part) ||
        null;
      if (!original) return undefined;

      // Map grid field -> stored snapshot field
      if (fieldName === 'bomLinkStartDate' || fieldName === 'startDate')
        return original.bomLinkStartDate;
      if (fieldName === 'bomLinkEndDate' || fieldName === 'endDate') return original.bomLinkEndDate;
      if (fieldName === 'quantity' || fieldName === 'qty') return original.quantity;
      if (fieldName === 'bomLinkSpecSheetExtra') return original.bomLinkSpecSheetExtra;
      if (fieldName === 'bomLinkIncludeInSpecSheet') return original.bomLinkIncludeInSpecSheet;

      return undefined;
    };

    // New rows: keep the old behavior (any net change marks edited)
    // Existing rows: only mark edited if value differs from the original snapshot.
    const isNewRow = !!params?.data?.isNewRow;
    const changed = isNewRow
      ? normalizeForField(fieldName, params.oldValue) !==
        normalizeForField(fieldName, params.newValue)
      : normalizeForField(fieldName, getOriginalForField()) !==
        normalizeForField(fieldName, params.newValue);

    // Track which specific field is currently edited (relative to original)
    if (editedFields) {
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

    // Update editedRows set based on whether the row has any edited fields.
    // If editedFields isn't provided, fall back to simple add-on-change behavior.
    if (!editedFields) {
      if (changed) {
        editedRows.add(partId);
        if (compositeId) editedRows.add(compositeId);
      }
    } else {
      const hasAnyEdits = editedFields.has(partId) && (editedFields.get(partId)?.size || 0) > 0;
      if (hasAnyEdits) {
        editedRows.add(partId);
        if (compositeId) editedRows.add(compositeId);
      } else {
        editedRows.delete(partId);
        if (compositeId) editedRows.delete(compositeId);
      }
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

              // Update grid with API response if available
              if (response && (response.instances || response.data)) {
                // If API returns updated data, use it to refresh the grid
                const responseData = response.instances ? response : response.data;

                // CRITICAL: Update dataService.apiData with the save response
                // This ensures validation and SKU matching use the latest data including newly saved rows
                if (
                  responseData &&
                  componentInstance.dataService &&
                  componentInstance.dataService.updateApiData
                ) {
                  componentInstance.dataService.updateApiData(responseData);
                }

                if (responseData && componentInstance.transformToHierarchicalData) {
                  try {
                    const updatedHierarchicalData =
                      componentInstance.transformToHierarchicalData(responseData);
                    componentInstance.rowData = updatedHierarchicalData;

                    // FIX: Clear displayData to prevent applyGrouping from preserving the old local "new rows"
                    // giving us duplicates (one real from API, one ghost from local state)
                    componentInstance.displayData = [];

                    // Update displayData if available
                    if (componentInstance.applyHierarchicalSearch) {
                      componentInstance.applyHierarchicalSearch();
                    }
                  } catch (error) {
                    console.warn('Could not transform API response, using local update:', error);
                    // Fall back to local update
                    this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
                  }
                } else {
                  // Fall back to local update
                  this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
                }
              } else {
                // No response data, use local update
                this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);
              }

              // CRITICAL: Always clear edited state on success so the next payload is fresh.
              // Some success paths replace rowData from API and skip updateLocalRowDataAfterSave().
              editedRows.clear();
              if (componentInstance.editedFields) {
                componentInstance.editedFields.clear();
              }

              // After successful save, update original values to match current state
              // This ensures subsequent edits use the correct "old" values
              // Note: Backend does NOT return old values in response - frontend must track them
              if (componentInstance.storeOriginalValues) {
                componentInstance.storeOriginalValues();
              }

              this.lastSavedAt = new Date();
              localStorage.setItem('lastSavedAt', this.lastSavedAt.toISOString());
              this.newRows.clear();

              // Refresh grid to show updated icons (change - to + for saved new rows)
              gridApi.refreshCells({
                force: true,
                suppressFlash: false,
              });

              // Also refresh the entire grid to ensure all changes are reflected
              setTimeout(() => {
                if (componentInstance.applyHierarchicalSearch) {
                  componentInstance.applyHierarchicalSearch();
                }
                gridApi.refreshCells({ force: true });
              }, 100);

              resolve({
                success: true,
                message: `Successfully saved ${changesCount} changes!`,
                payload: apiPayload,
              });
            },
            error: (error: any) => {
              console.error('BOM update failed:', error);

              // Extract error message based on HTTP status code
              let errorMessage = 'Failed to save changes.';

              if (error.status) {
                switch (error.status) {
                  case 404:
                    errorMessage =
                      'Failed to save: Resource not found (404). Please check your connection and try again.';
                    break;
                  case 500:
                    errorMessage =
                      'Failed to save: Server error (500). Please try again later or contact support.';
                    break;
                  case 400:
                    errorMessage = `Failed to save: Bad request (400). ${
                      error.error?.message ||
                      error.message ||
                      'Please check your data and try again.'
                    }`;
                    break;
                  case 401:
                    errorMessage =
                      'Failed to save: Unauthorized (401). Please refresh the page and try again.';
                    break;
                  case 403:
                    errorMessage =
                      'Failed to save: Forbidden (403). You do not have permission to perform this action.';
                    break;
                  default:
                    errorMessage = `Failed to save: ${error.status} ${
                      error.statusText || 'Error'
                    }. ${error.error?.message || error.message || 'Please try again.'}`;
                }
              } else if (error.message) {
                errorMessage = `Failed to save: ${error.message}`;
              }

              // IMPORTANT: Do NOT update grid, icons, or state on error
              // Keep UI exactly as it was before clicking save
              // Only show error message to user

              resolve({
                success: false,
                message: errorMessage,
                payload: apiPayload,
              });
            },
          });
        } else {
          // No API call needed, just update locally
          setTimeout(() => {
            this.updateLocalRowDataAfterSave(rowData, componentInstance, editedRows);

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
              payload: apiPayload,
            });
          }, 100);
        }
      } else {
        resolve({
          success: false,
          message: 'No payload to save',
        });
      }
    });
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

    // FIX: Clear displayData here too, to prevent applyGrouping from preserving ghost new rows
    // when we refresh the grid later
    componentInstance.displayData = [];

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
