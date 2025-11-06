import { Injectable } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';

@Injectable({
  providedIn: 'root',
})
export class ColumnService {
  constructor() {}

  /**
   * Builds column definitions for the grid
   * @param skuColumns - Array of SKU column information
   * @param dataService - Data service instance for accessing data methods
   * @param componentInstance - Component instance for accessing component methods and properties
   * @param includeSbomColumns - Whether to include SBOM-specific columns (SpecSheet, SpecSheetExtra)
   * @returns Array of column definitions
   */
  buildColumnDefinitions(
    skuColumns: any[],
    dataService: any,
    componentInstance: any,
    includeSbomColumns: boolean = false
  ): ColDef[] {
    const baseColumns: ColDef[] = [
      {
        headerName: '',
        field: 'actions',
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          // Show red "e" for expired data
          if (params.data.isExpired) {
            return `<span class="expired-indicator" title="Expired">e</span>`;
          }

          const partId = params.data.part || '';

          // For new rows, show delete button
          if (params.data.isNewRow) {
            const newRowId = params.data.newRowId;
            return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
          }

          // Only show add/remove buttons on parent level materials
          // This includes: isMaterialHeader (materials with children) OR isDirectRow (materials without children)
          // Both are at level 1 and represent parent materials
          if (
            (params.data.isMaterialHeader && params.data.hasLinkedBom) ||
            params.data.isDirectRow
          ) {
            return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
          }

          // For all other rows (section headers, sub-rows, direct rows), show nothing
          return '';
        },
        cellStyle: {
          textAlign: 'center',
          padding: '4px',
          borderRight: '1px solid #e2e8f0',
        },
      },
      // SBOM-specific columns - only include when requested
      ...(includeSbomColumns
        ? [
            {
              headerName: 'Include In Spec Sheet',
              field: 'SpecSheet',
              filter: 'agTextColumnFilter',
              width: 150,
              minWidth: 120,
              maxWidth: 200,
              resizable: true,
              suppressSizeToFit: false,
              suppressAutoSize: false,
              editable: (params: any) => {
                // Don't allow editing expired rows
                if (params.data && params.data.isExpired) {
                  return false;
                }
                // Allow editing for new rows and quantity field for all rows
                return true;
              },
              cellEditor: 'agSelectCellEditor',
              cellEditorParams: {
                values: ['Y', 'N', 'C'],
              },
              cellRenderer: (params: any) => {
                return params.value || '';
              },
              cellStyle: (params: any) => {
                if (params.data && params.data.isNewRow) {
                  return {
                    border: '1px solid #007bff',
                  };
                }
                return null;
              },
            },
            {
              headerName: 'SpecSheet Extra',
              field: 'SpecSheetExtra',
              filter: 'agTextColumnFilter',
              width: 180,
              minWidth: 150,
              maxWidth: 250,
              resizable: true,
              suppressSizeToFit: false,
              suppressAutoSize: false,
              editable: (params: any) => {
                // Don't allow editing expired rows
                if (params.data && params.data.isExpired) {
                  return false;
                }
                // Allow editing for new rows and quantity field for all rows
                return true;
              },
              cellEditor: 'agSelectCellEditor',
              cellEditorParams: {
                values: ['Y', 'N', 'C'],
              },
              cellRenderer: (params: any) => {
                return params.value || '';
              },
              cellStyle: (params: any) => {
                if (params.data && params.data.isNewRow) {
                  return {
                    border: '1px solid #007bff',
                  };
                }
                return null;
              },
            },
          ]
        : []),
      {
        headerName: 'Part Name',
        field: 'part',
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          // Always show the value, whether it's a new row or existing row
          if (params.data.isNewRow) {
            if (!params.value) {
              return '<span class="new-row-placeholder">Click to enter part number...</span>';
            }
            return params.value; // Show the selected value for new rows
          }

          // Check if this part matches the first SKU to determine color
          const skuInfo = dataService.getSkuInfo();
          let isMatching = false;
          if (skuInfo && skuInfo.length > 0) {
            const firstSkuField = `sku${skuInfo[0].sku}`;
            const firstSkuValue = params.data[firstSkuField];
            isMatching = firstSkuValue && String(params.value) === String(firstSkuValue);
          }

          const isClickable =
            componentInstance.clickableParts.has(params.value?.toString()) ||
            componentInstance.clickableParts.has(parseInt(params.value?.toString()));

          if (isMatching) {
            // Matching values get red text, regardless of clickability
            return `<span class="part-text matching-value" style="color: #d32f2f !important; font-weight: 600;">${params.value}</span>`;
          } else if (isClickable) {
            // Non-matching clickable parts get blue link
            return `<span class="part-link clickable clickable-part" style="cursor: pointer !important;">${params.value}</span>`;
          } else {
            // Non-matching, non-clickable parts get gray text
            return `<span class="part-text">${params.value}</span>`;
          }
        },
        width: 130,
        minWidth: 120,
        maxWidth: 250,
        pinned: 'left',
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow, // Only editable for new rows
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: (params: any) => ({
          values: componentInstance.getAvailablePartNumbers(),
          placeholder: 'Type to search part numbers...',
        }),
        cellStyle: (params: any) => {
          // Enhanced styling for new rows
          if (params.data && params.data.isNewRow) {
            return {
              border: '2px solid #007bff',
              backgroundColor: '#f8fbff',
              fontStyle: params.value ? 'normal' : 'italic',
            };
          }
          return null;
        },
        headerClass: 'part-column-header',
      },
      {
        headerName: 'Supplier',
        field: 'supplier',
        filter: 'agTextColumnFilter',
        width: 180,
        minWidth: 120,
        maxWidth: 300,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow, // Editable for new rows
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: (params: any) => {
          // Use row-specific suppliers if available, otherwise use global list
          const availableSuppliers =
            params.data?._availableSuppliers || componentInstance.getUniqueSuppliers?.() || [];
          return {
            values: availableSuppliers,
            placeholder: 'Type to search suppliers...',
            context: {
              dataService: dataService,
            },
          };
        },
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          // Ensure consistent styling with Part column
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff',
            };
          }
          return null;
        },
      },
      {
        headerName: 'Color',
        field: 'color',
        filter: 'agTextColumnFilter',
        width: 180,
        minWidth: 120,
        maxWidth: 250,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow, // Editable for new rows
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: (params: any) => {
          // Use row-specific colors if available, otherwise use global list
          const availableColors =
            params.data?._availableColors || componentInstance.getUniqueColors?.() || [];
          return {
            values: availableColors,
            placeholder: 'Type to search colors...',
            context: {
              dataService: dataService,
            },
          };
        },
        cellRenderer: (params: any) => {
          return params.value || '';
        },
      },
      {
        headerName: 'BOM Feature',
        field: 'feature',
        filter: 'agTextColumnFilter',
        width: 150,
        minWidth: 150,
        maxWidth: 300,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow, // Make feature editable for new rows
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          const features = componentInstance.getUniqueFeatures();

          return {
            values: features,
          };
        },
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff',
            };
          }
          return null;
        },
      },
      {
        headerName: 'Short Desc',
        field: 'shortDesc',
        filter: 'agTextColumnFilter',
        width: 200,
        minWidth: 150,
        maxWidth: 350,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow, // Editable for new rows
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff',
            };
          }
          return null;
        },
      },
      {
        headerName: 'Long Desc',
        field: 'longDesc',
        filter: 'agTextColumnFilter',
        width: 250,
        minWidth: 200,
        maxWidth: 350,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow, // Editable for new rows
        cellRenderer: (params: any) => {
          return params.value || '';
        },
        cellStyle: (params: any) => {
          if (params.data && params.data.isNewRow) {
            return {
              border: '1px solid #007bff',
            };
          }
          return null;
        },
      },
      {
        headerName: 'Start Date',
        field: 'startDate',
        filter: 'agDateColumnFilter',
        width: 130,
        minWidth: 120,
        maxWidth: 170,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agDateCellEditor',
        cellEditorParams: {
          // Configure the date picker
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
        },
        valueFormatter: (params) => {
          // Just return the value as-is, keeping the original string format
          return params.value || '';
        },
        valueParser: (params) => {
          if (!params.newValue) return '';
          // Keep dates as strings to match mock2.json format
          if (
            params.newValue &&
            typeof params.newValue === 'object' &&
            'toLocaleDateString' in params.newValue
          ) {
            return (params.newValue as Date).toLocaleDateString('en-US');
          }
          // Return the string value as-is
          return String(params.newValue);
        },
        valueSetter: (params) => {
          if (!params.newValue) return false;
          const date = new Date(params.newValue);
          if (isNaN(date.getTime())) return false;
          params.data[params.colDef.field as string] = date.toISOString();
          return true;
        },
        cellStyle: (params: any) => {
          const baseStyle = {
            borderRight: '1px solid #e2e8f0',
            padding: '6px 10px',
            fontSize: '12px',
          };

          // Add new row styling
          if (params.data && params.data.isNewRow) {
            return {
              ...baseStyle,
              border: '1px solid #007bff',
            };
          }

          // Add edited row styling
          if (componentInstance.editedRows.has(params.data.part.toString())) {
            return {
              ...baseStyle,
              backgroundColor: '#f8fafc',
              fontWeight: '500',
            };
          }

          return baseStyle;
        },
        filterParams: {
          filterOptions: [
            'equals',
            'notEqual',
            'lessThan',
            'lessThanOrEqual',
            'greaterThan',
            'greaterThanOrEqual',
            'inRange',
          ],
          defaultOption: 'equals',
          buttons: ['reset', 'apply'],
          suppressAndOrCondition: true,
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          },
        },
      },
      {
        headerName: 'End Date',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        width: 130,
        minWidth: 120,
        maxWidth: 200,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data && params.data.isNewRow,
        cellEditor: 'agDateCellEditor',
        cellEditorParams: {
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
        },
        valueFormatter: (params) => {
          // Just return the value as-is, keeping the original string format
          return params.value || '';
        },
        valueParser: (params) => {
          if (!params.newValue) return '';
          // Keep dates as strings to match mock2.json format
          if (
            params.newValue &&
            typeof params.newValue === 'object' &&
            'toLocaleDateString' in params.newValue
          ) {
            return (params.newValue as Date).toLocaleDateString('en-US');
          }
          // Return the string value as-is
          return String(params.newValue);
        },
        valueSetter: (params) => {
          if (!params.newValue) return false;
          const date = new Date(params.newValue);
          if (isNaN(date.getTime())) return false;
          params.data[params.colDef.field as string] = date.toISOString();
          return true;
        },
        filterParams: {
          filterOptions: [
            'equals',
            'notEqual',
            'lessThan',
            'lessThanOrEqual',
            'greaterThan',
            'greaterThanOrEqual',
            'inRange',
          ],
          defaultOption: 'equals',
          buttons: ['reset', 'apply'],
          suppressAndOrCondition: true,
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          },
        },
      },
      {
        headerName: 'Qty',
        field: 'qty',
        headerClass: 'qty-header',
        filter: 'agNumberColumnFilter',
        width: 90,
        minWidth: 90,
        maxWidth: 120,
        type: 'numericColumn',
        suppressMovable: false, // Allow column to be moved
        cellStyle: (params: any) => {
          const baseStyle = {
            textAlign: 'right',
            borderRight: '1px solid #e2e8f0',
            fontWeight: '500',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            padding: '6px 10px',
            fontSize: '12px',
          };

          // Add new row styling
          if (params.data.isNew || params.data.isNewRow) {
            return {
              ...baseStyle,
              border: '1px solid #007bff',
              // Removed fontStyle: 'italic' for normal text appearance
            };
          }

          // Add expired row styling - make it look disabled
          if (params.data && params.data.isExpired) {
            return {
              ...baseStyle,
              backgroundColor: '#f9fafb',
              color: '#9ca3af',
              fontWeight: '400',
              cursor: 'not-allowed',
            };
          }

          // Add edited row styling
          if (componentInstance.editedRows.has(params.data.part.toString())) {
            return {
              ...baseStyle,
              backgroundColor: '#f8fafc',
              fontWeight: '500',
            };
          }

          return baseStyle;
        },
        resizable: true,
        editable: (params) => {
          // Don't allow editing expired rows
          if (params.data && params.data.isExpired) {
            return false;
          }
          // Allow editing for new rows and quantity field for all rows
          return includeSbomColumns ? false : true;
        },
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 9999,
        },
        valueFormatter: (params: any) => {
          // Handle null, undefined, or empty string, but allow 0
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          // Convert to number and check if it's a valid number (including 0)
          const numValue = Number(params.value);
          if (isNaN(numValue)) {
            return '';
          }
          return numValue.toString();
        },
        cellRenderer: (params: any) => {
          // Handle null, undefined, or empty string, but allow 0
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          // Convert to number and check if it's a valid number (including 0)
          const numValue = Number(params.value);
          if (isNaN(numValue)) {
            return '';
          }
          // Use a simpler renderer to avoid dragging conflicts
          return numValue.toString();
        },
        filterParams: {
          filterOptions: [
            'equals',
            'notEqual',
            'lessThan',
            'lessThanOrEqual',
            'greaterThan',
            'greaterThanOrEqual',
            'inRange',
          ],
          defaultOption: 'equals',
          buttons: ['reset', 'apply'],
          suppressAndOrCondition: true,
        },
      },
    ];

    // Add dynamic SKU columns
    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => ({
      headerName: `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`,
      field: sku.fieldName,
      filter: 'agTextColumnFilter',
      width: 200,
      minWidth: 200,
      maxWidth: 350,
      resizable: true,
      suppressSizeToFit: true,
      suppressAutoSize: true,
      headerClass: index === 0 ? 'first-sku-column-header' : '',
      cellClass: index === 0 ? 'first-sku-column-cell' : '',

      cellStyle: (params: any) => {
        const cellKey = `${params.node.rowIndex}-${params.colDef.field}`;
        const isCopiedCell = componentInstance.copiedFromCellKey === cellKey;
        const isNewRow = params.data && params.data.isNewRow;

        // Base style for all cells
        const baseStyle = {
          textAlign: 'left',
          padding: '0 8px',
          cursor: isNewRow && params.value ? 'copy' : 'default',
        };

        // First SKU column styling
        if (index === 0) {
          // Check if this SKU value matches the Part value in the same row
          if (
            params.data &&
            params.value &&
            params.data.part &&
            String(params.value) === String(params.data.part)
          ) {
            return {
              ...baseStyle,
              color: '#d32f2f', // Red text for matching values
              fontWeight: '600',
              backgroundColor: isCopiedCell ? '#e8f5e9' : '#fff9c4', // Light green if copied, yellow background for first SKU column
              border: isCopiedCell ? '2px solid #4caf50' : 'none',
            };
          }

          // Non-matching or empty values get yellow background too
          return {
            ...baseStyle,
            color: '#374151', // Default gray text
            fontWeight: '400',
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#fff9c4', // Light green if copied, yellow background for first SKU column
            border: isCopiedCell ? '2px solid #4caf50' : 'none',
          };
        }

        // Other SKU columns styling
        if (params.value) {
          return {
            ...baseStyle,
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#f0f9ff',
            fontWeight: 'bold',
            color: '#000000',
            border: isCopiedCell ? '2px solid #4caf50' : isNewRow ? '1px solid #e2e8f0' : 'none',
          };
        } else {
          return {
            ...baseStyle,
            backgroundColor: isCopiedCell ? '#e8f5e9' : '#f9fafb',
            color: '#9ca3af',
            fontWeight: 'normal',
            border: isCopiedCell ? '2px solid #4caf50' : isNewRow ? '1px solid #e2e8f0' : 'none',
          };
        }
      },
      cellRenderer: (params: any) => {
        const cellKey = `${params.node.rowIndex}-${params.colDef.field}`;
        const isCopiedCell = componentInstance.copiedFromCellKey === cellKey;

        if (!params.data.isNewRow) {
          return params.value || '';
        }

        const buttonStyles = `
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 4px;
          padding: 2px 6px;
          margin-left: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          font-size: 12px;
          line-height: 1;
        `;

        // For empty cells in new rows that can receive paste
        if (!params.value) {
          // Only show paste button if value was copied from the same row
          const canPaste =
            componentInstance.copiedSkuValue !== '' &&
            componentInstance.copiedFromRowId !== null &&
            params.data.newRowId === componentInstance.copiedFromRowId;
          const pasteButton = canPaste
            ? `
            <div class="paste-button" 
              data-action="paste"
              style="
                ${buttonStyles}
                background: #f0fdf4;
                border: 1px solid #86efac;
                color: #16a34a;
                display: inline-flex;
                gap: 6px;
                align-items: center;
                min-width: 120px;
                height: 24px;
                white-space: nowrap;
                overflow: visible;
                position: relative;
                pointer-events: all;
                z-index: 999;
                cursor: pointer;
                user-select: none;
              "
              title="Click to paste '${componentInstance.copiedSkuValue}' or press Ctrl+V"
            >
              <div style="display: flex; align-items: center; gap: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                <span style="font-weight: 500;">Paste</span>
              </div>
              <div style="
                background: #dcfce7;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                border: 1px solid #86efac;
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.2;
              " title="${componentInstance.copiedSkuValue}">
                ${componentInstance.copiedSkuValue}
              </div>
            </button>
          `
            : '';

          return `
            <div class="sku-cell" style="
              display: flex;
              align-items: center;
              min-height: 28px;
              padding: 2px;
              ${
                canPaste
                  ? `
                background: #f0fdf4;
                border: 1px dashed #86efac;
                position: relative;
              `
                  : ''
              }
            ">
              ${
                canPaste
                  ? `
                <div style="
                  position: absolute;
                  top: -6px;
                  left: 8px;
                  background: #dcfce7;
                  padding: 0 6px;
                  border-radius: 3px;
                  font-size: 10px;
                  color: #16a34a;
                  border: 1px solid #86efac;
                  opacity: 0;
                  transition: opacity 0.2s;
                  line-height: 14px;
                  z-index: 1;
                ">Can paste here</div>
              `
                  : ''
              }
              <div style="flex: 1; display: flex; justify-content: flex-end;">
                ${pasteButton}
              </div>
              <style>
                .sku-cell {
                  transition: all 0.2s ease;
                }
                .sku-cell:hover .paste-button {
                  opacity: 1 !important;
                }
                .sku-cell:hover > div > div:first-child {
                  opacity: 1 !important;
                }
                .paste-button:hover {
                  background: #dcfce7 !important;
                  border-color: #4ade80 !important;
                }
                .paste-button:active {
                  background: #bbf7d0 !important;
                  transform: scale(0.98);
                }
              </style>
            </div>
          `;
        }

        // For cells with values in new rows
        const copyButton = `
          <button class="copy-button" 
            style="
              ${buttonStyles}
              background: #f0f9ff;
              border: 1px solid #e2e8f0;
              color: #3b82f6;
            "
            title="Copy SKU value"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span style="margin-left: 4px;">Copy</span>
          </button>
        `;

        // Add checkmark for copied cells
        const checkmark = isCopiedCell
          ? '<span style="color: #4caf50; margin-left: 4px; display: flex; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>'
          : '';

        return `
          <div class="sku-cell" style="display: flex; align-items: center; position: relative;">
            <span style="flex: 1;">${params.value}</span>
            ${isCopiedCell ? checkmark : copyButton}
            <style>
              .sku-cell:hover .copy-button {
                opacity: 1 !important;
              }
              .copy-button:hover {
                background: #e0f2fe !important;
                border-color: #93c5fd !important;
              }
              .copy-button:active {
                background: #bfdbfe !important;
                transform: scale(0.98);
              }
            </style>
          </div>
        `;
      },
      editable: false, // Never editable - we handle paste through our custom button
    }));

    return [...baseColumns, ...dynamicSkuColumns];
  }

  /**
   * Builds dynamic column definitions based on backend column mapping
   * @param dataService - Data service instance for accessing dynamic columns
   * @param componentInstance - Component instance for accessing component methods and properties
   * @param includeSbomColumns - Whether to include SBOM-specific columns
   * @returns Array of column definitions
   */
  buildDynamicColumnDefinitions(
    dataService: any,
    componentInstance: any,
    includeSbomColumns: boolean = false
  ): ColDef[] {
    const dynamicColumns = dataService.getDynamicColumns();
    const baseColumns: ColDef[] = [
      {
        headerName: '',
        field: 'actions',
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          const partId = params.data.part || '';
          if (params.data.isNewRow) {
            const newRowId = params.data.newRowId;
            return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
          }

          // Don't show plus icon for sub-rows
          if (params.data.isSubRow) {
            return '';
          }

          return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
        },
        cellStyle: {
          textAlign: 'center',
          padding: '4px',
          borderRight: '1px solid #e2e8f0',
        },
      },
      // Accordion expand/collapse column with linkedBom icon
      {
        headerName: '',
        field: 'accordionIcon',
        width: 30,
        minWidth: 30,
        maxWidth: 30,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          if (params.data.isParent && params.data.hasChildren) {
            const arrowIcon = params.data.isExpanded ? '🔽' : '▶️';
            return arrowIcon;
          } else if (params.data.isSubRow) {
            return '└─';
          }
          return '';
        },
        cellStyle: (params: any) => {
          if (params.data.isSubRow) {
            return {
              paddingLeft: '20px',
              backgroundColor: '#f8f9fa',
              borderLeft: '3px solid #28a745',
              textAlign: 'left',
              padding: '4px',
            };
          }
          const baseStyle = {
            textAlign: 'center',
            padding: '4px',
            paddingLeft: '0px',
            backgroundColor: 'transparent',
            borderLeft: 'none',
          };

          // Add cursor pointer for clickable accordion icons
          if (params.data.isParent && params.data.hasChildren) {
            return {
              ...baseStyle,
              cursor: 'pointer',
            };
          }

          return baseStyle;
        },
      },
    ];

    // Add SBOM-specific columns if requested
    if (includeSbomColumns) {
      if (dynamicColumns['bomLinkIncludeInSpecSheet']) {
        baseColumns.push({
          headerName: dynamicColumns['bomLinkIncludeInSpecSheet'],
          field: 'bomLinkIncludeInSpecSheet',
          filter: 'agTextColumnFilter',
          width: 150,
          minWidth: 120,
          maxWidth: 200,
          resizable: true,
          suppressSizeToFit: false,
          suppressAutoSize: false,
          editable: (params: any) => {
            if (params.data && params.data.isExpired) {
              return false;
            }
            return true;
          },
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Y', 'N', 'C'],
          },
          cellRenderer: (params: any) => {
            return params.value || '';
          },
        });
      }
      if (dynamicColumns['bomLinkSpecSheetExtra']) {
        baseColumns.push({
          headerName: dynamicColumns['bomLinkSpecSheetExtra'],
          field: 'bomLinkSpecSheetExtra',
          filter: 'agTextColumnFilter',
          width: 180,
          minWidth: 150,
          maxWidth: 250,
          resizable: true,
          suppressSizeToFit: false,
          suppressAutoSize: false,
          editable: (params: any) => {
            if (params.data && params.data.isExpired) {
              return false;
            }
            return true;
          },
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Y', 'N', 'C'],
          },
          cellRenderer: (params: any) => {
            return params.value || '';
          },
        });
      }
    }

    // Add dynamic columns based on backend mapping
    Object.entries(dynamicColumns).forEach(([fieldKey, headerName]) => {
      // Skip SBOM columns as they're handled above
      if (
        includeSbomColumns &&
        (fieldKey === 'bomLinkIncludeInSpecSheet' || fieldKey === 'bomLinkSpecSheetExtra')
      ) {
        return;
      }

      const columnDef: ColDef = {
        headerName: headerName as string,
        field: fieldKey,
        filter: 'agTextColumnFilter',
        width: 160,
        minWidth: 130,
        maxWidth: 300,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params: any) => {
          // Only editable for new rows, and not for SKU fields
          if (fieldKey.startsWith('sku')) {
            return false; // SKU fields are never editable
          }
          return params.data && params.data.isNewRow;
        },
        cellRenderer: (params: any) => {
          if (params.value === null || params.value === undefined) {
            return '';
          }
          // Ensure we return a valid string
          return String(params.value);
        },
      };

      // Special handling for specific columns
      if (fieldKey === 'part' || fieldKey === 'bomLinkPart' || fieldKey === 'material') {
        columnDef.pinned = 'left';
        columnDef.width = 130;
        columnDef.minWidth = 120;
        columnDef.maxWidth = 250;
        columnDef.editable = (params: any) => {
          // Only editable for new rows
          return params.data && params.data.isNewRow;
        };
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => {
          if (fieldKey === 'material') {
            // For material field, use API search instead of static values
            return {
              placeholder: 'Type to search materials...',
              useApiSearch: true, // Flag to indicate API search should be used
              context: {
                dataService: dataService,
              },
            };
          } else {
            // For part numbers, use static values
            return {
              values: componentInstance.getAvailablePartNumbers(),
              placeholder: 'Type to search part numbers...',
              context: {
                dataService: dataService,
              },
            };
          }
        };
        columnDef.headerClass = 'part-column-header';

        // For material column, hide value in material header rows
        if (fieldKey === 'material') {
          columnDef.cellRenderer = (params: any) => {
            // Hide material name in material header rows
            if (params.data && params.data.isMaterialHeader) {
              return '';
            }
            // Show material name for regular rows
            if (params.value === null || params.value === undefined) {
              return '';
            }
            return String(params.value);
          };
        }
      }

      if (fieldKey === 'quantity') {
        columnDef.filter = 'agNumberColumnFilter';
        columnDef.type = 'numericColumn';
        columnDef.width = 120;
        columnDef.minWidth = 110;
        columnDef.maxWidth = 150;
        columnDef.editable = (params: any) => {
          // Always editable for new rows, or if it's a new row
          return params.data || params.data.isNewRow;
        };
        columnDef.cellStyle = (params: any) => ({
          textAlign: 'right',
          borderRight: '1px solid #e2e8f0',
          fontWeight: '500',
          backgroundColor: '#f8fafc',
          color: '#1e293b',
          padding: '6px 10px',
          fontSize: '12px',
        });
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          max: 9999,
        };
        columnDef.valueFormatter = (params: any) => {
          return params.value || '';
        };
        columnDef.valueParser = (params) => {
          if (!params.newValue) return '';
          // Convert to number for quantity field
          const numValue = Number(params.newValue);
          return isNaN(numValue) ? '' : numValue;
        };
        columnDef.valueSetter = (params) => {
          // Store quantity values properly
          if (params.colDef.field && params.data) {
            if (params.newValue !== null && params.newValue !== undefined) {
              const numValue = Number(params.newValue);
              params.data[params.colDef.field] = isNaN(numValue) ? '' : numValue;
              return true;
            }
            params.data[params.colDef.field] = '';
            return true;
          }
          return false;
        };
      }

      if (fieldKey === 'bomLinkStartDate' || fieldKey === 'bomLinkEndDate') {
        columnDef.filter = 'agDateColumnFilter';
        columnDef.width = 140;
        columnDef.minWidth = 130;
        columnDef.maxWidth = 180;
        columnDef.cellEditor = 'agDateCellEditor';
        columnDef.cellEditorParams = {
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
        };
        columnDef.valueFormatter = (params) => {
          // Just return the value as-is, keeping the original string format
          return params.value || '';
        };
        columnDef.valueParser = (params) => {
          if (!params.newValue) return '';
          // Keep dates as strings to match mock2.json format
          if (
            params.newValue &&
            typeof params.newValue === 'object' &&
            'toLocaleDateString' in params.newValue
          ) {
            // Convert Date to MM/DD/YYYY format to match mock2.json exactly
            const date = params.newValue as Date;
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
          }
          // Return the string value as-is
          return String(params.newValue);
        };
        columnDef.valueSetter = (params) => {
          // Store dates as strings to match mock2.json format
          if (params.colDef.field && params.data) {
            if (
              params.newValue &&
              typeof params.newValue === 'object' &&
              'toLocaleDateString' in params.newValue
            ) {
              // Convert Date to MM/DD/YYYY format to match mock2.json exactly
              const date = params.newValue as Date;
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const day = date.getDate().toString().padStart(2, '0');
              const year = date.getFullYear();
              params.data[params.colDef.field] = `${month}/${day}/${year}`;
              return true;
            }
            if (params.newValue) {
              params.data[params.colDef.field] = String(params.newValue);
              return true;
            }
            params.data[params.colDef.field] = '';
            return true;
          }
          return false;
        };
      }

      baseColumns.push(columnDef);
    });

    return baseColumns;
  }

  /**
   * Gets the default column definition for AG Grid
   * @param componentInstance - Component instance for accessing component properties
   * @returns Default column definition object
   */
  getDefaultColDef(componentInstance: any) {
    return {
      sortable: true,
      // Remove the default filter type to allow individual columns to specify their own
      resizable: true,
      suppressSizeToFit: false,
      suppressAutoSize: false,
      floatingFilter: false,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      headerClass: 'custom-header-with-border',
      filterParams: {
        suppressAndOrCondition: true, // removes AND/OR + 2nd filter
        buttons: ['reset', 'apply'], // shows Apply / Reset
        defaultOption: 'contains', // sets default filter type for text columns
      },
      width: 140,
      minWidth: 100,
      maxWidth: 300,
      wrapText: false,
      autoHeight: false,
      cellStyle: (params: any) => {
        const baseStyle: any = {
          padding: '8px 12px',
        };
        // Don't add border for section headers - they should be seamless
        if (!params.data || !params.data.isSectionHeader) {
          baseStyle.borderRight = '1px solid #e2e8f0';
        }
        return baseStyle;
      },
    };
  }
}
