import { Injectable } from '@angular/core';
import { GridApi } from 'ag-grid-community';
import { GridCommonService } from './grid-common.service';
import { DataService } from './data.service';

export interface MassEditState {
  startDate: string;
  endDate: string;
  quantity: number | null;
  includeInSpecSheet: string;
}

@Injectable({
  providedIn: 'root',
})
export class MassEditService {
  constructor(
    private readonly gridCommonService: GridCommonService,
    private readonly dataService: DataService
  ) {}

  populateMassEditFields(
    selectedRows: any[],
    isMbomMode: () => boolean,
    isSbomMode: () => boolean
  ): MassEditState {
    if (selectedRows.length === 0) {
      return {
        startDate: '',
        endDate: '',
        quantity: null,
        includeInSpecSheet: '',
      };
    }

    const getDateValue = (row: any, fields: string[]): string => {
      for (const field of fields) {
        if (row[field]) return row[field];
      }
      return '';
    };

    const getQtyValue = (row: any, fields: string[]): number | null => {
      for (const field of fields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          return Number(row[field]);
        }
      }
      return null;
    };

    const getStringValue = (row: any, fields: string[]): string => {
      for (const field of fields) {
        if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
          return String(row[field]).trim();
        }
      }
      return '';
    };

    const state: MassEditState = {
      startDate: '',
      endDate: '',
      quantity: null,
      includeInSpecSheet: '',
    };

    const startDateFields = ['bomLinkStartDate'];
    const firstStartDate = getDateValue(selectedRows[0], startDateFields);
    const allSameStartDate = selectedRows.every((row) => {
      const rowDate = getDateValue(row, startDateFields);
      return rowDate === firstStartDate;
    });
    if (allSameStartDate && firstStartDate) {
      const date = this.gridCommonService.parseDateString(firstStartDate);
      state.startDate = date ? this.convertToDateInputFormat(date) : '';
    }

    const endDateFields = ['bomLinkEndDate'];
    const firstEndDate = getDateValue(selectedRows[0], endDateFields);
    const allSameEndDate = selectedRows.every((row) => {
      const rowDate = getDateValue(row, endDateFields);
      return rowDate === firstEndDate;
    });
    if (allSameEndDate && firstEndDate) {
      const date = this.gridCommonService.parseDateString(firstEndDate);
      state.endDate = date ? this.convertToDateInputFormat(date) : '';
    }

    if (isMbomMode()) {
      const qtyFields = ['quantity'];
      const firstQty = getQtyValue(selectedRows[0], qtyFields);
      const allSameQty = selectedRows.every((row) => {
        const rowQty = getQtyValue(row, qtyFields);
        return rowQty === firstQty;
      });
      if (allSameQty && firstQty !== null) {
        state.quantity = firstQty;
      }
    }

    if (isSbomMode()) {
      const hasMbomRows = selectedRows.some(
        (row: any) => row?.ptcbomPartMarkUp === 'enumMBOM001'
      );

      if (hasMbomRows) {
        const includeInSpecSheetFields = ['bomLinkIncludeInSpecSheet'];
        const firstIncludeInSpecSheet = getStringValue(selectedRows[0], includeInSpecSheetFields);
        const allSameIncludeInSpecSheet = selectedRows.every((row) => {
          const rowValue = getStringValue(row, includeInSpecSheetFields);
          return rowValue === firstIncludeInSpecSheet;
        });
        if (allSameIncludeInSpecSheet && firstIncludeInSpecSheet) {
          state.includeInSpecSheet = firstIncludeInSpecSheet;
        }
      } else {
        const qtyFields = ['quantity'];
        const firstQty = getQtyValue(selectedRows[0], qtyFields);
        const allSameQty = selectedRows.every((row) => {
          const rowQty = getQtyValue(row, qtyFields);
          return rowQty === firstQty;
        });
        if (allSameQty && firstQty !== null) {
          state.quantity = firstQty;
        }

        const includeInSpecSheetFields = ['bomLinkIncludeInSpecSheet'];
        const firstIncludeInSpecSheet = getStringValue(selectedRows[0], includeInSpecSheetFields);
        const allSameIncludeInSpecSheet = selectedRows.every((row) => {
          const rowValue = getStringValue(row, includeInSpecSheetFields);
          return rowValue === firstIncludeInSpecSheet;
        });
        if (allSameIncludeInSpecSheet && firstIncludeInSpecSheet) {
          state.includeInSpecSheet = firstIncludeInSpecSheet;
        }
      }
    }

    return state;
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

  applyMassEdit(
    gridApi: GridApi,
    selectedRows: Set<any>,
    columnDefs: any[],
    state: MassEditState,
    isMbomMode: () => boolean,
    isSbomMode: () => boolean,
    editedRows: Set<string | number>,
    editedFields: Map<string | number, Set<string>>,
    originalRowValues: Map<string | number, any>
  ): void {
    if (selectedRows.size === 0 || !gridApi) return;

    const selectedNodes = gridApi.getSelectedNodes();
    const nodesToUpdate: any[] = [];
    const columnsToUpdate: Set<string> = new Set();

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

    selectedNodes.forEach((node: any) => {
      if (!node.data) return;

      const rowData = node.data;
      let hasChanges = false;
      const isMbomRow = rowData?.ptcbomPartMarkUp === 'enumMBOM001';

      const shouldUpdateStartDate =
        state.startDate && (isMbomMode() || (isSbomMode() && !isMbomRow));

      if (shouldUpdateStartDate) {
        const formattedDate = this.gridCommonService.formatDateToMMDDYYYY(state.startDate);
        const startDateFields = ['bomLinkStartDate'];
        let targetField: string | null = null;
        for (const field of startDateFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }
        if (!targetField) {
          for (const field of startDateFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }
        if (!targetField) {
          targetField = 'bomLinkStartDate';
        }
        const currentValue = rowData[targetField] || '';
        if (currentValue !== formattedDate) {
          rowData[targetField] = formattedDate;
          node.setDataValue(targetField, formattedDate);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      const shouldUpdateEndDate =
        state.endDate && (isMbomMode() || (isSbomMode() && !isMbomRow));

      if (shouldUpdateEndDate) {
        const formattedDate = this.gridCommonService.formatDateToMMDDYYYY(state.endDate);
        const endDateFields = ['bomLinkEndDate'];
        let targetField: string | null = null;
        for (const field of endDateFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }
        if (!targetField) {
          for (const field of endDateFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }
        if (!targetField) {
          targetField = 'bomLinkEndDate';
        }
        const currentValue = rowData[targetField] || '';
        if (currentValue !== formattedDate) {
          rowData[targetField] = formattedDate;
          node.setDataValue(targetField, formattedDate);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      const shouldUpdateQuantity =
        (isMbomMode() || (isSbomMode() && !isMbomRow)) &&
        state.quantity !== null &&
        state.quantity !== undefined;

      if (shouldUpdateQuantity) {
        const qtyFields = ['quantity'];
        let targetField: string | null = null;
        for (const field of qtyFields) {
          if (columnFields.has(field)) {
            targetField = field;
            break;
          }
        }
        if (!targetField) {
          for (const field of qtyFields) {
            if (rowData.hasOwnProperty(field)) {
              targetField = field;
              break;
            }
          }
        }
        if (!targetField) {
          targetField = 'quantity';
        }
        const currentValue = rowData[targetField];
        if (currentValue !== state.quantity) {
          rowData[targetField] = state.quantity;
          node.setDataValue(targetField, state.quantity);
          columnsToUpdate.add(targetField);
          hasChanges = true;
        }
      }

      if (isSbomMode() && state.includeInSpecSheet) {
        // Skip bomLinkIncludeInSpecSheet for new rows (disabled and not sent in payload)
        if (rowData.isNewRow) {
          // Don't apply to new rows - field is disabled
        } else {
          // For existing rows: Only apply if bomLinkSpecSheetExtra doesn't exist
          // (field is disabled if bomLinkSpecSheetExtra exists)
          const specSheetExtra = rowData?.bomLinkSpecSheetExtra;
          const hasSpecSheetExtra = specSheetExtra !== undefined && specSheetExtra !== null && String(specSheetExtra).trim() !== '';
          
          if (!hasSpecSheetExtra) {
            const includeInSpecSheetFields = ['bomLinkIncludeInSpecSheet'];
            let targetField: string | null = null;
            for (const field of includeInSpecSheetFields) {
              if (columnFields.has(field)) {
                targetField = field;
                break;
              }
            }
            if (!targetField) {
              for (const field of includeInSpecSheetFields) {
                if (rowData.hasOwnProperty(field)) {
                  targetField = field;
                  break;
                }
              }
            }
            if (!targetField) {
              targetField = 'bomLinkIncludeInSpecSheet';
            }
            const currentValue = rowData[targetField] || '';
            if (currentValue !== state.includeInSpecSheet) {
              rowData[targetField] = state.includeInSpecSheet;
              node.setDataValue(targetField, state.includeInSpecSheet);
              columnsToUpdate.add(targetField);
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges) {
        const primaryKey =
          rowData.materialKey || rowData.newRowId || rowData.partNumber || rowData.part;
        const compositeKey =
          rowData.section && (rowData.partNumber || rowData.part)
            ? `${rowData.section}::${rowData.partNumber || rowData.part}`
            : null;
        const editKey = primaryKey || compositeKey;

        if (editKey) {
          editedRows.add(editKey);
          if (compositeKey) editedRows.add(compositeKey);

          if (!editedFields.has(editKey)) {
            editedFields.set(editKey, new Set<string>());
          }
          const editedFieldsForRow = editedFields.get(editKey)!;

          if (isMbomMode()) {
            if (state.startDate) {
              const startDateFields = ['bomLinkStartDate'];
              for (const field of startDateFields) {
                if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                  editedFieldsForRow.add(field);
                  break;
                }
              }
            }
            if (state.endDate) {
              const endDateFields = ['bomLinkEndDate'];
              for (const field of endDateFields) {
                if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                  editedFieldsForRow.add(field);
                  break;
                }
              }
            }
            if (state.quantity !== null && state.quantity !== undefined) {
              const qtyFields = ['quantity'];
              for (const field of qtyFields) {
                if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                  editedFieldsForRow.add(field);
                  break;
                }
              }
            }
          }

          if (isSbomMode()) {
            if (!isMbomRow) {
              if (state.startDate) {
                const startDateFields = ['bomLinkStartDate'];
                for (const field of startDateFields) {
                  if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                    editedFieldsForRow.add(field);
                    break;
                  }
                }
              }
              if (state.endDate) {
                const endDateFields = ['bomLinkEndDate'];
                for (const field of endDateFields) {
                  if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                    editedFieldsForRow.add(field);
                    break;
                  }
                }
              }
              if (state.quantity !== null && state.quantity !== undefined) {
                const qtyFields = ['quantity'];
                for (const field of qtyFields) {
                  if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                    editedFieldsForRow.add(field);
                    break;
                  }
                }
              }
            }
            if (state.includeInSpecSheet) {
              const includeInSpecSheetFields = ['bomLinkIncludeInSpecSheet'];
              for (const field of includeInSpecSheetFields) {
                if (columnFields.has(field) || rowData.hasOwnProperty(field)) {
                  editedFieldsForRow.add(field);
                  break;
                }
              }
            }
          }
        }
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
}
