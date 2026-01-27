import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { IconComponent } from '../icon/icon.component';
import { AutocompleteCellEditorComponent } from '../autocomplete-cell-editor/autocomplete-cell-editor.component';
import { ColDef, GridApi, GridOptions, GridReadyEvent } from 'ag-grid-community';
import { DataService } from '../../services/data.service';
import { GridConfigService } from '../../services/grid-config.service';

@Component({
  selector: 'app-parts-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, IconComponent],
  templateUrl: './parts-edit-modal.component.html',
  styleUrls: ['./parts-edit-modal.component.css'],
})
export class PartsEditModalComponent implements OnInit {
  @Input() partsData: any[] = [];
  @Output() modalClose = new EventEmitter<void>();
  @Output() save = new EventEmitter<any[]>();

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  public columnDefs: ColDef[] = [];
  public gridOptions: GridOptions = {};
  public defaultColDef: Partial<ColDef> = {};
  public rowData: any[] = [];
  private gridApi!: GridApi;

  constructor(
    private readonly dataService: DataService,
    private readonly gridConfigService: GridConfigService
  ) {}

  ngOnInit(): void {
    this.rowData = [...this.partsData];
    this.initializeGrid();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  private initializeGrid(): void {
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
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: () => ({
          placeholder: 'search materials...',
          useApiSearch: true,
          context: {
            dataService: this.dataService,
          },
        }),
      },
      {
        headerName: 'Service Substitute Two',
        field: 'materialColorServiceSubstituteTwo',
        width: 200,
        minWidth: 150,
        editable: true,
        sortable: true,
        filter: true,
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: () => ({
          placeholder: 'search materials...',
          useApiSearch: true,
          context: {
            dataService: this.dataService,
          },
        }),
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
        cellEditor: AutocompleteCellEditorComponent,
        cellEditorParams: () => ({
          placeholder: 'search materials...',
          useApiSearch: true,
          context: {
            dataService: this.dataService,
          },
        }),
      },
    ];

    this.defaultColDef = {
      ...this.gridConfigService.getDefaultColDef(),
    };

    const commonOptions = this.gridConfigService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      components: commonOptions.components
        ? {
            ...commonOptions.components,
            AutocompleteCellEditorComponent,
          }
        : {
            AutocompleteCellEditorComponent,
          },
      context: commonOptions.context
        ? {
            ...commonOptions.context,
            dataService: this.dataService,
          }
        : {
            dataService: this.dataService,
          },
      onGridReady: (params) => {
        this.gridApi = params.api;
        this.gridConfigService.sizeColumnsToFit(this.gridApi);
        this.gridConfigService.forceHorizontalScrollbarVisibility(this.gridApi);
      },
      onCellValueChanged: (params) => {
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

  onGridReady(event: GridReadyEvent): void {}

  closeModal(): void {
    this.modalClose.emit();
  }

  saveModal(): void {
    if (!this.gridApi) return;

    const allRowData: any[] = [];
    this.gridApi.forEachNode((node) => {
      if (node.data) {
        allRowData.push({ ...node.data });
      }
    });
    this.save.emit(allRowData);
  }

  getSelectedRowsCount(): number {
    return this.gridApi ? this.gridApi.getSelectedNodes().length : 0;
  }
}
