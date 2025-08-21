import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi, GridOptions, IDatasource, IGetRowsParams } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html'
})
export class App implements OnInit {
  private gridApi!: GridApi;
  public showColumnVisibilityPanel = false;

  // Modal state
  public showPartModal = false;
  public selectedPartData: any = {};
  public selectedPartSkuData: any[] = [];
  
  // Save message state
  public saveMessage: string = '';
  public saveMessageType: string = '';
  // Track which parts are clickable (random selection)
  private clickableParts = new Set<number>();
  // Editable state
  public editedRows = new Set<number>();
  // Add row state
  public newRows = new Map<number, any>();
  public nextRowId = 10000; // Unique ID for new rows
  // Grid configuration - client-side
  public gridOptions: GridOptions = {
    theme: 'legacy', // Use legacy theme for Firefox 102 ESR compatibility
    animateRows: true,
    enableCellTextSelection: true,
    rowSelection: 'single' as const,
    suppressColumnVirtualisation: false,
    suppressHorizontalScroll: false,
    suppressColumnMoveAnimation: true,
    suppressDragLeaveHidesColumns: true,
    suppressFieldDotNotation: true,
    suppressContextMenu: false,
    suppressScrollOnNewData: false,
    allowDragFromColumnsToolPanel: true,
    suppressAnimationFrame: false,
    suppressRowVirtualisation: false,
    onGridReady: (params) => {
      this.gridApi = params.api;
      // Don't auto-size columns on ready to preserve manual resizing
    },
    onCellValueChanged: (params) => {
      if (params.colDef.field === 'qty') {
        this.onQtyChanged(params);
      }
      // Handle new row value changes
      this.onNewRowValueChanged(params);
    },
    
    onFilterChanged: (params) => {
      console.log('Filter changed:', params);
    },
    
    onFilterModified: (params) => {
      console.log('Filter modified:', params);
    },
    
    onBodyScroll: (params) => {
      // Force redraw on scroll to prevent black areas
      setTimeout(() => {
        this.gridApi.redrawRows();
      }, 10);
    },


  };

  // Helper method to size columns to fit
  private sizeColumnsToFit() {
    if (!this.gridApi) return;
    
    this.gridApi.sizeColumnsToFit({
      defaultMinWidth: 140,
      columnLimits: [
        { key: 'part', minWidth: 140 },
        { key: 'supplier', minWidth: 160 },
        { key: 'color', minWidth: 140 },
        { key: 'feature', minWidth: 180 },
        { key: 'startDate', minWidth: 150 },
        { key: 'endDate', minWidth: 150 },
        { key: 'qty', minWidth: 100 }
      ]
    });
    
    // Ensure the last column is fully visible
    setTimeout(() => {
      const allColumns = this.gridApi.getColumns();
      if (allColumns && allColumns.length > 0) {
        const lastCol = allColumns[allColumns.length - 1];
        this.gridApi.autoSizeColumns([lastCol.getColId()]);
      }
    }, 100);
  }

  // Date formatter function for MM/DD/YYYY format
  private dateFormatter(params: any): string {
    if (!params.value) return '';
    const date = new Date(params.value);
    if (isNaN(date.getTime())) return params.value; // Return original if invalid date
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  }

  public defaultColDef = {
    sortable: true,
    filter: 'agTextColumnFilter',
    resizable: true,
    floatingFilter: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    headerClass: 'custom-header-with-border',
    filterParams: {
      suppressAndOrCondition: true,   // removes AND/OR + 2nd filter
      buttons: ['reset', 'apply'],    // shows Apply / Reset
      defaultOption: 'contains'       // sets default filter type
    },
    width: 140,
    minWidth: 120,
    wrapText: false,
    suppressSizeToFit: false,
    cellStyle: (params: any) => {
      const baseStyle = {
        padding: '8px 12px',
        borderRight: '1px solid #e2e8f0'
      };
      
      // Add new row styling
      if (params.data.isNewRow) {
        return {
          ...baseStyle,
          backgroundColor: '#f9fafb',
          fontStyle: 'italic'
        };
      }
      
      // Add edited row styling
      if (this.editedRows.has(params.data.part)) {
        return {
          ...baseStyle,
          backgroundColor: '#fef3c7',
          fontWeight: '500'
        };
      }
      
      return baseStyle;
    }
  };

  public columnDefs: ColDef[] = [];
  public skuColumns: any[] = []; // Dynamic SKU columns

  public rowData: any[] = [];
  public totalRows = 1000;

  constructor(private router: Router, public dataService: DataService) {
    this.loadData();
  }

  ngOnInit(): void { }

  loadData(): void {
    this.dataService.loadMockData().subscribe(data => {
      // Transform mock data to grid format
      const baseData = this.dataService.transformToGridData(data.mbom);
      const additionalData = this.dataService.generateAdditionalData(data.mbom, 1000);
      this.rowData = [...baseData, ...additionalData];
      
      // Initialize columns after data is loaded
      this.initializeColumns();
      
      // Make only some parts clickable (random selection from first 20 rows)
      this.initializeClickableParts();
      
      console.log('Loaded data:', this.rowData.length, 'rows');
    });
  }

  initializeClickableParts(): void {
    // Make approximately 30% of parts from first 20 rows clickable
    const first20Parts = this.rowData.slice(0, 20).map(row => row.part);
    const clickableCount = Math.floor(first20Parts.length * 0.3); // 30% of first 20
    
    // Randomly select parts to be clickable
    for (let i = 0; i < clickableCount; i++) {
      const randomIndex = Math.floor(Math.random() * first20Parts.length);
      this.clickableParts.add(first20Parts[randomIndex]);
    }
    
    console.log('Clickable parts:', Array.from(this.clickableParts));
  }

  initializeColumns(): void {
    // Get SKU columns from data service
    const skuColumns = this.dataService.getSkuInfo().map(sku => ({
      skuId: sku.sku,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size,
      fieldName: `sku${sku.sku}`,
      hasData: true
    }));
    
    // Build column definitions
    this.columnDefs = this.buildColumnDefinitions(skuColumns);
    console.log('Dynamic columns created:', this.columnDefs.length);
    console.log('SKU columns found:', skuColumns);
  }

  buildColumnDefinitions(skuColumns: any[]): ColDef[] {
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
          if (params.data.isNewRow) {
            return `<span class="delete-row-btn" data-part-id="${params.data.part}">−</span>`;
          }
          return `<span class="add-row-btn" data-part-id="${params.data.part}">+</span>`;
        },
        cellStyle: {
          textAlign: 'center',
          padding: '4px',
          borderRight: '1px solid #e2e8f0'
        }
      },
      {
        headerName: 'Part',
        field: 'part',
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          if (params.data.isNewRow) {
            return `<span class="new-row-text" style="color: #6b7280; font-style: italic;">New Row</span>`;
          }
          const isClickable = this.clickableParts.has(params.value);
          const className = isClickable ? 'part-link clickable' : 'part-text';
          return `<span class="${className}">${params.value}</span>`;
        },
        width: 140,
        minWidth: 120,
        maxWidth: 180,
        pinned: 'left',
        resizable: true,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agAutocompleteCellEditor',
        cellEditorParams: (params: any) => ({
          values: this.getAvailablePartNumbers(),
          maxResults: 5,
          filterList: true,
          searchDebounceDelay: 0
        })
      },
      {
        headerName: 'Supplier',
        field: 'supplier',
        filter: 'agTextColumnFilter',
        width: 160,
        minWidth: 140,
        maxWidth: 200,
        resizable: true,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agTextCellEditor'
      },
      {
        headerName: 'Color',
        field: 'color',
        filter: 'agTextColumnFilter',
        width: 140,
        minWidth: 120,
        maxWidth: 180,
        resizable: true,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agTextCellEditor'
      },
      {
        headerName: 'Feature',
        field: 'feature',
        filter: 'agTextColumnFilter',
        width: 180,
        minWidth: 160,
        maxWidth: 220,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => ({
          values: this.getUniqueFeatures()
        })
      },
      {
        headerName: 'Start Date',
        field: 'startDate',
        filter: 'agDateColumnFilter',
        width: 150,
        minWidth: 130,
        maxWidth: 170,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agDateCellEditor',
        valueFormatter: this.dateFormatter.bind(this),
        filterParams: {
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          }
        }
      },
      {
        headerName: 'End Date',
        field: 'endDate',
        filter: 'agDateColumnFilter',
        width: 150,
        minWidth: 130,
        maxWidth: 170,
        resizable: true,
        suppressSizeToFit: false,
        suppressAutoSize: false,
        editable: (params) => params.data.isNewRow,
        cellEditor: 'agDateCellEditor',
        valueFormatter: this.dateFormatter.bind(this),
        filterParams: {
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const [month, day, year] = cellValue.split('/').map(Number);
            const cellDate = new Date(year, month - 1, day);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return cellDate < filterLocalDateAtMidnight ? -1 : 1;
          }
        }
      },
      {
        headerName: 'Qty',
        field: 'qty',
        headerClass: 'qty-header',
        filter: 'agNumberColumnFilter',
        width: 100,
        minWidth: 80,
        maxWidth: 120,
        type: 'numericColumn',
        cellStyle: (params: any) => {
          const baseStyle = {
            textAlign: 'right',
            borderRight: '1px solid #e2e8f0',
            fontWeight: '500',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            padding: '6px 10px',
            fontSize: '12px'
          };
          
          // Add new row styling
          if (params.data.isNewRow) {
            return {
              ...baseStyle,
              backgroundColor: '#f9fafb',
              fontStyle: 'italic'
            };
          }
          
          // Add edited row styling
          if (this.editedRows.has(params.data.part)) {
            return {
              ...baseStyle,
              backgroundColor: '#f8fafc',
              fontWeight: '500'
            };
          }
          
          return baseStyle;
        },
        resizable: true,
        editable: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          max: 9999
        },
        valueFormatter: (params: any) => {
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          return params.value.toString();
        },
        cellRenderer: (params: any) => {
          if (params.value === null || params.value === undefined || params.value === '') {
            return '';
          }
          return `<span style="display: inline-block; width: 100%; text-align: right; font-weight: 500;">${params.value}</span>`;
        },
        filterParams: {
          filterOptions: ['equals', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'inRange']
        }
      }
    ];

    // Add dynamic SKU columns
    const dynamicSkuColumns: ColDef[] = skuColumns.map(sku => ({
      headerName: `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`,
      field: sku.fieldName,
      filter: 'agTextColumnFilter',
      width: 180,
      minWidth: 160,
      maxWidth: 220,
      resizable: true,

      cellStyle: (params: any) => {
        if (params.value) {
          return { 
            backgroundColor: '#f0f9ff', 
            fontWeight: 'bold', 
            color: '#000000',
            textAlign: 'left',
            padding: '0 8px'
          };
        } else {
          return { 
            backgroundColor: '#f9fafb', 
            color: '#9ca3af', 
            fontWeight: 'normal',
            textAlign: 'left',
            padding: '0 8px'
          };
        }
      },
      cellRenderer: (params: any) => params.value || ''
    }));

    return [...baseColumns, ...dynamicSkuColumns];
  }




  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.sizeColumnsToFit();
  }



  getColumnDisplayName(col: any): string {
    // Return the exact same header name as shown in the grid
    return col.headerName || col.field;
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      // Toggle single column
      const visible = (event.target as HTMLInputElement).checked;
      this.gridApi.setColumnsVisible([col.field], visible);
      
      // Update the column definition to reflect the change
      const columnDef = this.columnDefs.find(c => c.field === col.field);
      if (columnDef) {
        columnDef.hide = !visible;
      }
    } else {
      // Toggle visibility panel
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
      
      // Add click outside handler when panel opens
      if (this.showColumnVisibilityPanel) {
        setTimeout(() => {
          document.addEventListener('click', this.closePanelOnClickOutside.bind(this), true);
        }, 0);
      } else {
        document.removeEventListener('click', this.closePanelOnClickOutside.bind(this), true);
      }
    }
  }

  closePanelOnClickOutside(event: Event): void {
    const panel = document.querySelector('.column-visibility-panel');
    const toggleBtn = document.querySelector('.toggle-columns-btn');
    
    if (panel && !panel.contains(event.target as Node) && 
        toggleBtn && !toggleBtn.contains(event.target as Node)) {
      this.showColumnVisibilityPanel = false;
      document.removeEventListener('click', this.closePanelOnClickOutside.bind(this), true);
    }
  }

  onCellClicked(event: any): void {
    if (event.colDef.field === 'actions') {
      const target = event.event?.target as HTMLElement;
      if (target && target.classList.contains('add-row-btn')) {
        const partId = parseInt(target.getAttribute('data-part-id') || '0');
        if (partId) {
          this.addRowAfter(partId);
          return;
        }
      } else if (target && target.classList.contains('delete-row-btn')) {
        const partId = parseInt(target.getAttribute('data-part-id') || '0');
        if (partId) {
          this.deleteRow(partId);
          return;
        }
      }
    } else if (event.colDef.field === 'part') {
      // Check if it's a clickable part for modal
      if (this.clickableParts.has(event.value)) {
        this.openPartModal(event.value);
      }
    }
  }

  openPartModal(partId: number): void {
    // Find the part data from the current row data
    const partData = this.rowData.find(row => row.part === partId);
    if (partData) {
      this.selectedPartData = partData;
      this.selectedPartSkuData = this.dataService.getSkuDataForPart(partData);
      this.showPartModal = true;
    }
  }

  closePartModal(): void {
    this.showPartModal = false;
    this.selectedPartData = {};
    this.selectedPartSkuData = [];
  }

  onQtyChanged(params: any): void {
    const partId = params.data.part;
    
    // Mark row as edited
    this.editedRows.add(partId);
    
    // Refresh the row to apply styling
    this.gridApi.refreshCells({
      rowNodes: [params.node],
      force: true
    });
    
    console.log(`Qty changed for part ${partId}: ${params.oldValue} -> ${params.newValue}`);
  }

  saveChanges(): void {
    if (this.editedRows.size === 0) {
      this.showSaveMessage('No changes to save', 'info');
      return;
    }
    
    // Capture the number of changes before clearing
    const changesCount = this.editedRows.size;
    const changedParts = Array.from(this.editedRows);
    
    // Here you would typically send the changes to your API
    console.log('Saving changes for parts:', changedParts);
    
    // Show saving message
    this.showSaveMessage(`Saving ${changesCount} changes...`, 'info');
    
    // Simulate API call delay
    setTimeout(() => {
      // Clear the edited state
      this.editedRows.clear();
      
      // Refresh all rows to remove highlighting
      this.gridApi.refreshCells({
        force: true
      });
      
      // Show success message with correct count
      this.showSaveMessage(`Successfully saved ${changesCount} changes!`, 'success');
      
      console.log('Changes saved successfully!');
    }, 1000);
  }
  
  showSaveMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.saveMessage = message;
    this.saveMessageType = type;
    
    // Auto-clear success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.clearSaveMessage();
      }, 3000);
    }
  }
  
  clearSaveMessage(): void {
    this.saveMessage = '';
    this.saveMessageType = '';
  }



  addRowAfter(partId: number): void {
    const newRowId = this.nextRowId++;
    const newRow = {
      part: newRowId,
      supplier: '',
      color: '',
      feature: '',
      startDate: '',
      endDate: '',
      qty: 0,
      isNewRow: true,
      insertAfter: partId
    };

    // Add SKU columns with empty values
    const skuInfo = this.dataService.getSkuInfo();
    skuInfo.forEach(sku => {
      (newRow as any)[`sku${sku.sku}`] = '';
    });

    this.newRows.set(newRowId, newRow);
    
    // Add the new row to the data
    const currentData = [...this.rowData];
    const insertIndex = currentData.findIndex(row => row.part === partId);
    if (insertIndex !== -1) {
      currentData.splice(insertIndex + 1, 0, newRow);
      this.rowData = currentData;
      
      // Update the grid data and refresh
      this.gridApi.refreshCells({ force: true });
      
      // Logical scroll behavior: scroll to the new row with smooth animation
      setTimeout(() => {
        // Get the row index after insertion
        const newRowIndex = insertIndex + 1;
        
        // Check if the new row is currently visible
        const firstVisibleRow = this.gridApi.getFirstDisplayedRowIndex();
        const lastVisibleRow = this.gridApi.getLastDisplayedRowIndex();
        
        if (newRowIndex < firstVisibleRow || newRowIndex > lastVisibleRow) {
          // Row is not visible, scroll to it smoothly
          this.gridApi.ensureIndexVisible(newRowIndex, 'middle');
        } else {
          // Row is already visible, just ensure it's properly positioned
          this.gridApi.ensureIndexVisible(newRowIndex, 'middle');
        }
        
        // Add a subtle highlight effect by refreshing the specific row
        const rowNode = this.gridApi.getRowNode(newRowId.toString());
        if (rowNode) {
          this.gridApi.refreshCells({
            rowNodes: [rowNode],
            force: true
          });
        }
      }, 100);
    }
    
    console.log('Added new row after part:', partId, 'New row ID:', newRowId);
  }

  deleteRow(partId: number): void {
    // Remove from newRows if it exists
    this.newRows.delete(partId);
    
    // Remove from rowData
    const currentData = [...this.rowData];
    const rowIndex = currentData.findIndex(row => row.part === partId);
    if (rowIndex !== -1) {
      currentData.splice(rowIndex, 1);
      this.rowData = currentData;
      
      // Force complete grid refresh
      this.gridApi.refreshCells({ force: true });
      this.gridApi.refreshHeader();
      
      console.log('Deleted row with part ID:', partId);
    }
  }

  getUniqueFeatures(): string[] {
    const features = new Set<string>();
    this.rowData.forEach(row => {
      if (row.feature && !row.isNewRow) {
        features.add(row.feature);
      }
    });
    return Array.from(features).sort();
  }

  getAvailablePartNumbers(): string[] {
    // This method can be easily modified to make API calls later
    const partNumbers = new Set<string>();
    this.rowData.forEach(row => {
      if (!row.isNewRow) {
        partNumbers.add(row.part.toString());
      }
    });
    return Array.from(partNumbers).sort((a, b) => parseInt(a) - parseInt(b));
  }

  // Method for future API integration
  async searchPartNumbers(searchTerm: string): Promise<string[]> {
    // TODO: Replace with actual API call
    // Example: return this.dataService.searchParts(searchTerm);
    
    // For now, filter existing data
    const allParts = this.getAvailablePartNumbers();
    if (!searchTerm) {
      return allParts.slice(0, 5); // Return first 5 if no search term
    }
    
    return allParts
      .filter(part => part.includes(searchTerm))
      .slice(0, 5); // Limit to 5 results
  }

  onNewRowValueChanged(params: any): void {
    if (params.data.isNewRow) {
      const rowId = params.data.part;
      const updatedRow = { ...params.data };
      
      // If part number is changed, populate ONLY the feature from existing data
      if (params.field === 'part' && params.newValue) {
        const partNumber = parseInt(params.newValue);
        if (!isNaN(partNumber)) {
          const existingPart = this.rowData.find(row => row.part === partNumber && !row.isNewRow);
          if (existingPart) {
            // Only populate the feature field
            updatedRow.feature = existingPart.feature;
            
            // Update the grid to reflect the changes
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              force: true
            });
            
            console.log('Auto-populated feature for part', params.newValue, ':', existingPart.feature);
          }
        }
      }
      
      // Update the new row data
      this.newRows.set(rowId, updatedRow);
      
      console.log('New row value changed:', params.field, params.newValue);
    }
  }




}