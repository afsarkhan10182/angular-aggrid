import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { IconComponent } from '../icon/icon.component';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';

@Component({
  selector: 'app-parts-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './parts-edit-modal.component.html',
  styleUrls: ['./parts-edit-modal.component.css'],
})
export class PartsEditModalComponent implements OnInit, OnDestroy {
  @Input() partsData: any[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any[]>();

  private gridApi!: GridApi;
  public gridOptions: GridOptions = {};
  public columnDefs: ColDef[] = [];
  public rowData: any[] = [];

  constructor() {}

  ngOnInit(): void {
    this.initializeGrid();
    this.rowData = [...this.partsData];
  }

  ngOnDestroy(): void {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  initializeGrid(): void {
    this.columnDefs = [
      {
        headerName: '',
        field: 'isSelected',
        colId: 'checkbox',
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        pinned: 'left',
        resizable: false,
        sortable: false,
        filter: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: false,
      },
      {
        headerName: 'Part Number',
        field: 'partNumber',
        width: 150,
        minWidth: 120,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: '30 Char Description',
        field: 'materialColorThirtyCharacterDescription',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: '60 Char Description',
        field: 'materialColorSixtyCharacterDescription',
        width: 250,
        minWidth: 200,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Status',
        field: 'materialColorStatus',
        width: 120,
        minWidth: 100,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Manufacturer Part #',
        field: 'materialColorManufacturersPartNumber',
        width: 180,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Service Description',
        field: 'materialColorServiceDescription',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Service Substitute One',
        field: 'materialColorServiceSubstituteOne',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Service Substitute Two',
        field: 'materialColorServiceSubstituteTwo',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Service Message',
        field: 'materialColorServiceMessage',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'Service Equivalent',
        field: 'materialColorServiceEquivalent',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
      },
    ];

    this.gridOptions = {
      defaultColDef: {
        resizable: true,
        sortable: true,
        filter: true,
      },
      rowSelection: 'multiple',
      suppressRowClickSelection: true,
      enableRangeSelection: true,
      animateRows: true,
      onGridReady: (params) => {
        this.gridApi = params.api;
        this.gridApi.sizeColumnsToFit();
      },
      onCellValueChanged: (params) => {
        // Update the row data when cell value changes
        if (params.data) {
          const rowIndex = this.rowData.findIndex(
            (row) => row.partNumber === params.data.partNumber
          );
          if (rowIndex >= 0) {
            this.rowData[rowIndex] = { ...params.data };
          }
        }
      },
    };
  }

  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
  }

  closeModal(): void {
    this.close.emit();
  }

  saveModal(): void {
    // Get all row data (including selected state)
    const allRowData: any[] = [];
    this.gridApi.forEachNode((node) => {
      if (node.data) {
        allRowData.push({ ...node.data });
      }
    });
    this.save.emit(allRowData);
  }

  getSelectedRowsCount(): number {
    if (!this.gridApi) return 0;
    return this.gridApi.getSelectedNodes().length;
  }
}
