import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { PartModalComponent } from './part-modal/part-modal.component';
import { AutocompleteCellEditorComponent } from './autocomplete-cell-editor/autocomplete-cell-editor.component';
import { DataService } from './services/data.service';
import { GridCommonService } from './services/grid-common.service';
import { RowManagementService } from './services/row-management.service';
import { SessionService } from './services/session.service';
import { GroupByService, GroupConfig } from './services/group-by.service';
import { ColumnHeaderPinComponent } from './column-header-pin/column-header-pin.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, PartModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit {
  private gridApi!: GridApi;
  public showColumnVisibilityPanel = false;
  public showGroupByPanel = false;

  @ViewChild('columnPanel') columnPanel!: ElementRef;
  @ViewChild('toggleBtn') toggleBtn!: ElementRef;
  @ViewChild('groupByPanel') groupByPanel!: ElementRef;
  @ViewChild('groupByBtn') groupByBtn!: ElementRef;
  public showExpiredData = false;
  public showMaterialModal = false;
  public selectedMaterialData: any = {};
  public selectedMaterialSkuData: any[] = [];
  public searchText: string = '';
  public saveMessage: string = '';
  public saveMessageType: string = '';
  public editedRows = new Set<number>();
  public currentUser: any = null;
  public bomName: string = 'MBOM';
  public isLoading: boolean = true;

  public allColumns = [
    // Core Part Information
    { field: 'actions', headerName: '', hide: false, isVirtual: false },
    { field: 'part', headerName: 'Part Number', hide: false, isVirtual: false },
    { field: 'type', headerName: 'Type', hide: true, isVirtual: true },
    {
      field: 'manufacturerPartNumber',
      headerName: 'Manufacturer Part Number',
      hide: true,
      isVirtual: true,
    },

    // Descriptions
    { field: 'shortDesc', headerName: 'Short Description', hide: false, isVirtual: false },
    { field: 'longDesc', headerName: 'Long Description', hide: false, isVirtual: false },
    { field: 'serviceDescription', headerName: 'Service Description', hide: true, isVirtual: true },

    // Service Information
    { field: 'tcgEquivalent', headerName: 'TCG Equivalent', hide: true, isVirtual: true },
    { field: 'serviceSub1', headerName: 'Service Sub1', hide: true, isVirtual: true },
    { field: 'serviceSub2', headerName: 'Service Sub2', hide: true, isVirtual: true },
    { field: 'colorFinish', headerName: 'Color Finish', hide: true, isVirtual: true },

    // Supplier and Origin
    { field: 'supplier', headerName: 'Supplier', hide: false, isVirtual: false },
    { field: 'countryOfOrigin', headerName: 'Country Of Origin', hide: true, isVirtual: true },

    // Physical Properties
    { field: 'color', headerName: 'Color', hide: false, isVirtual: false },

    // Quantity and Units
    { field: 'qty', headerName: 'Qty', hide: false, isVirtual: false },
    { field: 'uom', headerName: 'UoM', hide: true, isVirtual: true },

    // Dates
    { field: 'startDate', headerName: 'Start Date', hide: false, isVirtual: false },
    { field: 'endDate', headerName: 'End Date', hide: false, isVirtual: false },
  ];

  public gridOptions: GridOptions = {} as GridOptions;

  public defaultColDef: any;

  public columnDefs: ColDef[] = [];

  public rowData: any[] = [];
  public displayData: any[] = []; // Flattened data for display
  public activeGroupFields: GroupConfig[] = []; // Currently active group fields
  public availableGroupFields: GroupConfig[] = []; // Available columns for grouping
  private groupExpandedState: Map<string, boolean> = new Map(); // Track group expand/collapse state

  constructor(
    public dataService: DataService,
    private gridCommonService: GridCommonService,
    private rowManagementService: RowManagementService,
    private sessionService: SessionService,
    private groupByService: GroupByService
  ) {
    this.gridOptions.context = {
      dataService: this.dataService,
    };

    const savedState = localStorage.getItem('showExpiredData');
    this.showExpiredData = savedState === 'true';

    this.defaultColDef = {
      ...this.gridCommonService.getDefaultColDef(),
      headerComponent: ColumnHeaderPinComponent,
    };
    const commonOptions = this.gridCommonService.getCommonGridOptions(this);
    this.gridOptions = {
      ...commonOptions,
      components: {
        ...(commonOptions.components || {}),
        AutocompleteCellEditorComponent: AutocompleteCellEditorComponent,
        ColumnHeaderPinComponent: ColumnHeaderPinComponent,
      },
      context: {
        ...(commonOptions.context || {}),
        dataService: this.dataService,
      },
      isFullWidthRow: (params: any) => {
        return params.rowNode.data.isGroupHeader;
      },
      fullWidthCellRenderer: (params: any) => {
        return this.renderGroupHeaderFullWidth(params);
      },
    };

    this.checkAuthentication();
  }

  ngOnInit(): void {
    (window as any).toggleSection = (section: string) => {
      this.toggleSection(section);
    };
    (window as any).toggleMaterial = (
      section: string,
      materialIdentifier: string,
      materialIndex?: number
    ) => {
      this.toggleMaterial(section, materialIdentifier, materialIndex);
    };
    (window as any).toggleGroup = (groupKey: string) => {
      this.toggleGroup(groupKey);
    };
  }

  public toggleSection(section: string): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    sectionRow.isExpanded = !sectionRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  public toggleMaterial(
    section: string,
    materialIdentifier?: string,
    materialIndex?: number
  ): void {
    if (!this.gridApi) return;

    const sectionRow = this.rowData.find(
      (row: any) => row.section === section && row.isSectionHeader
    );
    if (!sectionRow) return;

    let materialRow;

    if (materialIndex !== undefined) {
      materialRow = sectionRow.children.find(
        (child: any) => child.isMaterialHeader && child.materialIndex === materialIndex
      );
    }

    if (!materialRow && materialIdentifier) {
      materialRow = sectionRow.children.find((child: any) => {
        if (!child.isMaterialHeader) {
          return false;
        }

        const candidateValues = [
          child.materialKey,
          child.material,
          child.part,
          child.partNumber,
        ].filter((val) => val !== undefined && val !== null);

        return candidateValues.some((val) => val === materialIdentifier);
      });
    }

    if (!materialRow) return;
    materialRow.isExpanded = !materialRow.isExpanded;
    this.applyHierarchicalSearch();
  }

  private getInitialDisplayData(): any[] {
    let hierarchicalData = this.rowData;
    
    // Apply grouping if active
    if (this.activeGroupFields.length > 0) {
      hierarchicalData = this.groupByService.groupHierarchicalData(hierarchicalData, this.activeGroupFields);
    }
    
    return this.flattenHierarchicalData(hierarchicalData);
  }

  private flattenHierarchicalData(data: any[]): any[] {
    const result: any[] = [];

    const processNode = (node: any) => {
      result.push(node);

      // If expanded and has children, process them
      if (node.isExpanded && node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          processNode(child);
        });
      }
    };

    data.forEach((item) => {
      processNode(item);
    });

    return result;
  }

  private checkAuthentication(): void {
    if (!environment.enableHttpBasicAuth) {
      this.loadData();
      return;
    }

    const userName = this.dataService.getUserNameFromJsp();

    if (userName) {
      this.currentUser = {
        name: userName,
        fullName: userName,
        userName: userName,
      };
    }

    this.sessionService.getCsrfToken().subscribe({
      next: (csrfToken) => {
        this.loadData();
      },
      error: (error) => {
        this.showNotification(
          'This application must be accessed through FlexPLM. Please login to FlexPLM first.',
          'error'
        );
      },
    });
  }

  loadData(): void {
    this.isLoading = true;
    this.dataService.loadData().subscribe(
      (data) => {
        this.isLoading = false;
        const bomPartInfo = this.dataService.getBomPartInfo();
        if (bomPartInfo?.bomName) {
          this.bomName = bomPartInfo.bomName;
        }
        if (bomPartInfo?.modifyTimestamp) {
          this.rowManagementService.setLastSavedAt(new Date(bomPartInfo.modifyTimestamp));
        }

        this.rowData = this.transformToHierarchicalData(data);
        this.initializeColumns();

        if (this.gridApi) {
          this.gridApi.refreshHeader();
          this.applyHierarchicalSearch();
        } else {
          this.displayData = this.getInitialDisplayData();
        }

        if (this.gridApi) {
          setTimeout(() => {
            this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);
          }, 200);
        }
      },
      (error) => {
        this.isLoading = false;
        console.error('Error loading data:', error);
      }
    );
  }

  initializeColumns(): void {
    const columnMapping = this.dataService.getColumnMapping();
    this.columnDefs = this.createHierarchicalColumns(columnMapping);
    
    // Initialize available group fields from column definitions
    this.availableGroupFields = this.columnDefs
      .filter((col) => col.field && col.field !== 'actions' && col.sortable !== false)
      .map((col) => ({
        field: col.field!,
        headerName: col.headerName || col.field!,
      }));
  }

  createHierarchicalColumns(columnMapping: any): ColDef[] {
    const columns: ColDef[] = [];

    columns.push({
      headerName: '',
      field: 'actions',
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: true,
      cellRenderer: (params: any) => {
        if (params.data.isGroupHeader) {
          return '';
        }
        
        if (params.data.isExpired) {
          return `<span class="expired-indicator" title="Expired">e</span>`;
        }

        const partId = params.data.part || '';

        if (params.data.isNewRow) {
          const newRowId = params.data.newRowId;
          return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="Delete">−</span>`;
        }

        if ((params.data.isMaterialHeader && params.data.hasLinkedBom) || params.data.isDirectRow) {
          return `<span class="add-row-btn" data-part-id="${partId}" title="Add">+</span>`;
        }

        return '';
      },
      cellStyle: {
        textAlign: 'center',
        padding: '4px',
        borderRight: '1px solid #e2e8f0',
      },
    });

    columns.push({
      headerName: 'Feature',
      field: 'bomLinkFeature',
      width: 150,
      minWidth: 150,
      pinned: 'left',
      sortable: false,
      filter: true,
      tooltipValueGetter: (params: any) => {
        if (!params.data) return null;
        if (params.data.isSectionHeader) {
          return params.data.section || null;
        }
        const featureValue = this.getFeatureValue(params.data);
        if (!featureValue) return null;
        return String(featureValue);
      },
      cellRenderer: (params: any) => {
        return this.renderHierarchicalCell(params);
      },
      cellStyle: (params: any) => {
        return this.getHierarchicalCellStyle(params);
      },
      editable: (params: any) => {
        return params.data && params.data.isNewRow && !params.data.isSectionHeader;
      },
      cellEditor: AutocompleteCellEditorComponent,
      cellEditorParams: () => ({
        placeholder: 'search BOM features...',
        isBomFeatureSearch: true,
        context: {
          dataService: this.dataService,
        },
      }),
    });

    Object.keys(columnMapping).forEach((field) => {
      if (field === 'feature' || field === 'bomLinkFeature') {
        return;
      }

      if (field === 'bomLinkCountryOfOrigin') {
        const headerName = columnMapping[field];
        columns.push({
          headerName,
          field,
          width: 180,
          minWidth: 140,
          sortable: true,
          cellRenderer: (params: any) => {
            if (params.data.isSectionHeader || params.data.isBranchHeader || params.data.isGroupHeader) {
              return '';
            }
            const columnWidth = params.column?.getActualWidth() || 180;
            return this.createCellContentWithTooltip(params.value, columnWidth);
          },
          tooltipValueGetter: (params: any) => {
            if (params.value === null || params.value === undefined) return null;
            return String(params.value);
          },
          cellStyle: (params: any) => this.getDataCellStyle(params),
          editable: (params: any) => {
            return params.data && params.data.isNewRow && !params.data.isSectionHeader;
          },
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: () => ({
            placeholder: 'search countries...',
            isCountrySearch: true,
            context: {
              dataService: this.dataService,
            },
          }),
        });
        return;
      }

      const headerName = columnMapping[field];
      const columnDef: ColDef = {
        headerName: headerName,
        field: field,
        width: 150,
        minWidth: 100,
        sortable: true,
        cellRenderer: (params: any) => {
          if (params.data.isSectionHeader || params.data.isBranchHeader || params.data.isGroupHeader) {
            return '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
          return this.createCellContentWithTooltip(params.value, columnWidth);
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        editable: (params: any) => {
          return params.data && params.data.isNewRow && !params.data.isSectionHeader;
        },
      };

      if (field === 'bomLinkPart' || field === 'partNumber') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          placeholder: 'search part numbers...',
          useApiSearch: true,
          isPartNumberSearch: true,
          context: {
            dataService: this.dataService,
          },
        });
      } else if (field === 'material') {
        columnDef.cellEditor = AutocompleteCellEditorComponent;
        columnDef.cellEditorParams = (params: any) => ({
          placeholder: 'search materials...',
          useApiSearch: true,
          context: {
            dataService: this.dataService,
          },
        });
      } else if (field === 'qty' || field === 'quantity') {
        columnDef.cellEditor = 'agNumberCellEditor';
        columnDef.cellEditorParams = {
          min: 0,
          max: 9999,
        };
        columnDef.editable = (params: any) => {
          if (params.data && (params.data.isExpired || params.data.isSectionHeader)) {
            return false;
          }
          return true;
        };
      } else if (field === 'supplier' || field === 'color' || field === 'feature') {
        if (field === 'supplier' || field === 'color') {
          columnDef.cellEditor = AutocompleteCellEditorComponent;
          columnDef.cellEditorParams = (params: any) => {
            const nodeData = params.node?.data || params.data || {};
            let values: string[] = [];
            if (field === 'supplier') {
              if (
                nodeData._availableSuppliers !== undefined &&
                Array.isArray(nodeData._availableSuppliers)
              ) {
                values = nodeData._availableSuppliers;
              } else {
                values = this.gridCommonService.getUniqueSuppliers(this.rowData);
              }
            } else if (field === 'color') {
              if (
                nodeData._availableColors !== undefined &&
                Array.isArray(nodeData._availableColors)
              ) {
                values = nodeData._availableColors;
              } else {
                values = this.gridCommonService.getUniqueColors(this.rowData);
              }
            }
            return {
              values: values,
              placeholder: `search ${field}...`,
              context: {
                dataService: this.dataService,
              },
            };
          };
        } else {
          columnDef.cellEditor = 'agTextCellEditor';
          columnDef.cellEditorParams = (params: any) => {
            return {
              values: this.gridCommonService.getUniqueFeatures(this.rowData),
              placeholder: `search ${field}...`,
            };
          };
        }
      } else if (
        field === 'bomLinkStartDate' ||
        field === 'bomLinkEndDate' ||
        field === 'startDate' ||
        field === 'endDate'
      ) {
        columnDef.filter = false;
        columnDef.cellEditor = 'agDateCellEditor';
        columnDef.editable = (params: any) => {
          return params.data && params.data.isNewRow && !params.data.isSectionHeader;
        };
        columnDef.cellRenderer = (params: any) => {
          if (params.data.isSectionHeader || params.data.isBranchHeader || params.data.isGroupHeader) {
            return '';
          }
          let formattedValue = '';
          if (columnDef.valueFormatter && typeof columnDef.valueFormatter === 'function') {
            formattedValue = columnDef.valueFormatter(params) || '';
          }
          const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
          return this.createCellContentWithTooltip(formattedValue, columnWidth);
        };
        columnDef.valueGetter = (params: any) => {
          if (!params.data) return undefined;
          const value = params.data[field];
          if (!value || value === '') return undefined;
          if (value instanceof Date) return value;
          return this.gridCommonService.parseDateString(String(value)) || undefined;
        };
        columnDef.cellEditorParams = {
          browserDatePicker: true,
          minValidYear: 2000,
          maxValidYear: 2050,
          format: 'mm/dd/yyyy',
        };
        columnDef.valueFormatter = (params: any) => {
          if (!params.data) return '';
          const rawValue = params.data[field];
          return this.gridCommonService.formatDateToMMDDYYYY(rawValue);
        };
        columnDef.valueParser = (params: any) => {
          if (!params.newValue) return '';
          return this.gridCommonService.convertDateEditorValueToString(params.newValue);
        };
        columnDef.valueSetter = (params: any) => {
          if (!params.newValue) {
            params.data[params.colDef.field as string] = '';
            return true;
          }
          const dateStr = this.gridCommonService.convertDateEditorValueToString(params.newValue);
          params.data[params.colDef.field as string] = dateStr;
          return true;
        };
      }

      columns.push(columnDef);
    });

    const skuColumns = this.dataService.getSkuInfo().map((sku) => ({
      skuId: sku.sku,
      product: sku.product,
      manufacturer: sku.manufacturer,
      color: sku.color,
      size: sku.size,
      fieldName: `sku${sku.sku}`,
      hasData: true,
    }));

    const dynamicSkuColumns: ColDef[] = skuColumns.map((sku, index) => {
      const skuHeader = `SKU - ${sku.skuId}\nProduct - ${sku.product}\nManufacturer - ${sku.manufacturer}\nColor - ${sku.color}\nSize - ${sku.size}`;
      return {
        headerName: skuHeader,
        headerTooltip: skuHeader,
        field: sku.fieldName,
        width: 200,
        minWidth: 200,
        maxWidth: 350,
        resizable: true,
        suppressSizeToFit: true,
        suppressAutoSize: true,
        headerClass: index === 0 ? 'first-sku-column-header' : '',
        cellClass: index === 0 ? 'first-sku-column-cell' : '',
        cellRenderer: (params: any) => {
          const data = params.data || {};

          if (data.isSectionHeader || data.isBranchHeader || data.isGroupHeader) {
            return '';
          }

          if (data.isMaterialHeader || data.isDirectRow) {
            const value = params.value;
            if (!value && value !== 0) return '';
            
            // Convert value to string and preserve newlines
            const valueStr = String(value);
            // Replace newlines with <br> tags for HTML rendering
            const htmlValue = this.escapeHtml(valueStr).replace(/\n/g, '<br>');
            
            return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0;">${htmlValue}</div>`;
          }

          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return this.getDataCellStyle(params);
        },
        editable: false,
      };
    });

    const allColumns = [...columns, ...dynamicSkuColumns];
    return allColumns;
  }

  renderHierarchicalCell(params: any): string {
    const data = params.data;
    const level = data.level || 0;

    if (data.isGroupHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      const groupValue = data.groupValue !== null && data.groupValue !== undefined 
        ? String(data.groupValue) 
        : '(Empty)';
      const indent = '&nbsp;'.repeat(data.groupLevel * 16);
      const groupCount = this.groupByService.getGroupCount(data);
      const bgColor = data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      const borderColor = data.groupLevel === 0 ? '#3b82f6' : data.groupLevel === 1 ? '#10b981' : '#f59e0b';
      
      return `
        <div style="
          cursor: pointer;
          padding: 6px 8px;
          background: ${bgColor};
          border-left: 4px solid ${borderColor};
          font-weight: 600;
          display: flex;
          align-items: center;
        " 
             onclick="window.toggleGroup('${data.groupKey}')"
             onmouseover="this.style.background='${data.groupLevel === 0 ? '#e0f2fe' : data.groupLevel === 1 ? '#dcfce7' : '#fde68a'}'"
             onmouseout="this.style.background='${bgColor}'">
          <span style="
            margin-right: 6px;
            font-size: 12px;
            color: ${borderColor};
            font-weight: 700;
            width: 16px;
            text-align: center;
          ">${arrowIcon}</span>
          <span style="font-size: 13px; font-weight: 600; color: #1e293b;">${indent}${data.groupHeaderName}: ${this.escapeHtml(groupValue)}</span>
          <span style="margin-left: 8px; font-size: 11px; color: #64748b; font-weight: 500;">(${groupCount})</span>
        </div>
      `;
    }

    if (data.isSectionHeader) {
      const arrowIcon = data.isExpanded ? '▼' : '▶';
      return `
        <div style="
          cursor: pointer; 
        " 
             onclick="window.toggleSection('${data.section}')"
             onmouseover="this.style.background='#e0f2fe'; this.style.borderLeftColor='#1d4ed8'"
             onmouseout="this.style.background='#f8fafc'; this.style.borderLeftColor='#3b82f6'">
          <span style="
            margin-right: 4px; 
            font-size: 12px; 
            transition: transform 0.2s ease; 
            color: #1e40af;
            font-weight: 700;
            width: 16px;
            text-align: center;
          ">${arrowIcon}</span>
          <span style="font-size: 14px; font-weight: 600;">${data.section}</span>
        </div>
      `;
    }

    if (data.isMaterialHeader) {
      const materialIndex = data.materialIndex || 0;
      const linkIcon = data.hasLinkedBom ? '🔗' : '⧉';
      const materialIdentifier =
        data.materialKey || data.material || data.part || data.partNumber || '';
      return `
        <div style="
          cursor: pointer; 
        " 
             onclick="window.toggleMaterial('${data.section}', '${materialIdentifier}', ${materialIndex})"
             onmouseover="this.style.background='#dcfce7'; this.style.borderLeftColor='#059669'"
             onmouseout="this.style.background='#f0fdf4'; this.style.borderLeftColor='#10b981'">
          <span style="
              margin-right: 6px;
              font-size: 12px;
              color: #0f766e;
            ">${linkIcon}</span>
        </div>
      `;
    }

    if (data.isParentRow) {
      const parentIndent = '&nbsp;'.repeat(16);
      return `
        <div style="
          display: flex; 
          align-items: center; 
          color: #1e40af; 
          padding: 4px 6px; 
          background: #eff6ff;
          border-radius: 2px;
          margin: 1px 0;
          border-left: 3px solid #3b82f6;
          transition: all 0.2s ease;
          font-weight: 500;
        " 
             onmouseover="this.style.background='#dbeafe'; this.style.borderLeftColor='#1d4ed8'"
             onmouseout="this.style.background='#eff6ff'; this.style.borderLeftColor='#3b82f6'">
          <span style="
            font-size: 12px; 
            color: #1e40af;
            font-weight: 500;
          ">${parentIndent}${data.part || data.material || 'Item'}</span>
        </div>
      `;
    }

    if (data.isDirectRow) {
      const featureValue = this.getFeatureValue(data);
      if (!featureValue || featureValue.trim().length === 0) {
        return '';
      }
      const columnWidth = 220;
      return this.createCellContentWithTooltip(featureValue, columnWidth);
    }

    const featureValue = this.getFeatureValue(data);
    if (!featureValue || featureValue.trim().length === 0) {
      return '';
    }
    const columnWidth = 220;
    return this.createCellContentWithTooltip(featureValue, columnWidth);
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getFeatureValue(row: any): string {
    if (!row) return '';
    const rawValue =
      row.bomLinkFeature ??
      row.feature ??
      row.BOMFeature ??
      row.bomlinkfeature ??
      row.Feature ??
      '';
    if (rawValue === null || rawValue === undefined) {
      return '';
    }
    return String(rawValue);
  }

  private renderGroupHeaderFullWidth(params: any): string {
    const data = params.data;
    const arrowIcon = data.isExpanded ? '▼' : '▶';
    const groupValue = data.groupValue !== null && data.groupValue !== undefined 
      ? String(data.groupValue) 
      : '(Empty)';
    // Use padding for indent instead of &nbsp; for better alignment
    const indentPixels = data.groupLevel * 20;
    const groupCount = this.groupByService.getGroupCount(data);
    const bgColor = data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
    const borderColor = data.groupLevel === 0 ? '#3b82f6' : data.groupLevel === 1 ? '#10b981' : '#f59e0b';
    
    return `
      <div style="
        cursor: pointer;
        padding: 0 8px;
        padding-left: ${indentPixels + 8}px;
        background: ${bgColor};
        border-left: 4px solid ${borderColor};
        font-weight: 600;
        display: flex;
        align-items: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
      " 
           onclick="window.toggleGroup('${data.groupKey}')"
           onmouseover="this.style.background='${data.groupLevel === 0 ? '#e0f2fe' : data.groupLevel === 1 ? '#dcfce7' : '#fde68a'}'"
           onmouseout="this.style.background='${bgColor}'">
        <span style="
          margin-right: 6px;
          font-size: 12px;
          color: ${borderColor};
          font-weight: 700;
          width: 16px;
          text-align: center;
          display: inline-block;
        ">${arrowIcon}</span>
        <span style="font-size: 13px; font-weight: 600; color: #1e293b;">${data.groupHeaderName}: ${this.escapeHtml(groupValue)}</span>
        <span style="margin-left: 8px; font-size: 11px; color: #64748b; font-weight: 500;">(${groupCount})</span>
      </div>
    `;
  }

  private isTextLikelyTruncated(text: string | null | undefined, columnWidth: number): boolean {
    if (!text) return false;
    const textStr = String(text);
    const estimatedPixelsNeeded = textStr.length * 9 + 16;
    return estimatedPixelsNeeded > columnWidth;
  }

  private createCellContentWithTooltip(value: any, columnWidth: number): string {
    if (!value && value !== 0) return '';
    const textStr = String(value);
    const escapedText = this.escapeHtml(textStr);
    const shouldShowTooltip = this.isTextLikelyTruncated(textStr, columnWidth);

    if (shouldShowTooltip) {
      return `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; width: 100%;">${escapedText}</span>`;
    }
    return escapedText;
  }

  getHierarchicalCellStyle(params: any): any {
    const data = params.data;
    const isSectionHeader = data?.isSectionHeader;
    const isGroupHeader = data?.isGroupHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isGroupHeader) {
      const bgColor = data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      return {
        backgroundColor: bgColor,
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
        fontWeight: 'bold',
      };
    }

    if (isSectionHeader) {
      return {
        backgroundColor: '#eff6ff',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
        fontWeight: 'bold',
      };
    }

    if (data.isMaterialHeader) {
      return {
        backgroundColor: '#e5e7eb',
        borderLeft: '4px solid #10b981',
        fontWeight: '600',
      };
    }

    if (data.isParentRow) {
      return {
        backgroundColor: '#eff6ff',
        borderLeft: '3px solid #3b82f6',
        fontWeight: '500',
      };
    }

    if (data.isDirectRow) {
      return {
        backgroundColor: '#ffffff',
        borderLeft: '2px solid #d1d5db',
        fontWeight: '400',
      };
    }

    return {
      backgroundColor: '#ffffff',
      borderLeft: '2px solid #d1d5db',
    };
  }

  getDataCellStyle(params: any): any {
    const data = params.data;
    const isSectionHeader = data?.isSectionHeader;
    const isGroupHeader = data?.isGroupHeader;
    const isActionsColumn = this.isActionsColumn(params);

    if (isGroupHeader) {
      const bgColor = data.groupLevel === 0 ? '#f0f9ff' : data.groupLevel === 1 ? '#f0fdf4' : '#fef3c7';
      return {
        backgroundColor: bgColor,
        color: 'transparent',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
      };
    }

    if (isSectionHeader) {
      return {
        backgroundColor: '#eff6ff',
        color: 'transparent',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: isActionsColumn ? '1px solid #e2e8f0' : 'none',
        borderLeft: 'none',
      };
    }

    if (data.isMaterialHeader) {
      return {
        backgroundColor: 'transparent',
        color: 'transparent',
      };
    }

    if (data.isParentRow) {
      return {
        backgroundColor: '#ffffff',
        color: '#1e40af',
      };
    }

    if (data.isDirectRow) {
      return {
        backgroundColor: '#ffffff',
        color: '#374151',
      };
    }

    return {
      backgroundColor: '#ffffff',
      color: '#374151',
    };
  }

  onGridReady(params: any): void {
    this.gridApi = params.api;

    this.gridCommonService.sizeColumnsToFit(this.gridApi);
    this.gridCommonService.forceHorizontalScrollbarVisibility(this.gridApi);

    if (this.gridApi) {
      this.gridApi.refreshHeader();
    }

    if (this.rowData && this.rowData.length > 0) {
      this.applyHierarchicalSearch();
    }
  }

  isSkuColumn(col: any): boolean {
    return col.field && (col.field.startsWith('sku') || col.field.startsWith('actions'));
  }

  toggleExpiredData(): void {
    localStorage.setItem('showExpiredData', this.showExpiredData.toString());
    this.loadData();
  }

  toggleColumnVisibility(col?: any, event?: Event): void {
    if (col && event) {
      const visible = (event.target as HTMLInputElement).checked;

      if (col.isVirtual) {
        col.hide = !visible;
      } else {
        this.gridApi.setColumnsVisible([col.field], visible);
        col.hide = !visible;
      }
    } else {
      this.showColumnVisibilityPanel = !this.showColumnVisibilityPanel;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as Element;
    
    // Handle column visibility panel
    if (this.showColumnVisibilityPanel) {
      const panel = this.columnPanel?.nativeElement;
      const toggleBtn = this.toggleBtn?.nativeElement;
      const clickedOutside =
        panel && !panel.contains(target) && toggleBtn && !toggleBtn.contains(target);
      if (clickedOutside) {
        this.showColumnVisibilityPanel = false;
      }
    }
    
    // Handle group by panel
    if (this.showGroupByPanel) {
      const panel = this.groupByPanel?.nativeElement;
      const toggleBtn = this.groupByBtn?.nativeElement;
      const clickedOutside =
        panel && !panel.contains(target) && toggleBtn && !toggleBtn.contains(target);
      if (clickedOutside) {
        this.showGroupByPanel = false;
      }
    }
  }

  // Group By Methods
  toggleGroupByPanel(): void {
    this.showGroupByPanel = !this.showGroupByPanel;
  }

  addGroupField(field: GroupConfig): void {
    // Check if already grouped by this field
    if (this.activeGroupFields.some((g) => g.field === field.field)) {
      return;
    }
    
    this.activeGroupFields.push(field);
    this.applyGrouping();
  }

  removeGroupField(field: GroupConfig): void {
    this.activeGroupFields = this.activeGroupFields.filter((g) => g.field !== field.field);
    this.applyGrouping();
  }

  clearAllGroups(): void {
    this.activeGroupFields = [];
    this.applyGrouping();
  }

  isFieldGrouped(field: string): boolean {
    return this.activeGroupFields.some((g) => g.field === field);
  }

  toggleGroup(groupKey: string): void {
    // Toggle the expanded state
    const currentState = this.groupExpandedState.get(groupKey) ?? true;
    this.groupExpandedState.set(groupKey, !currentState);
    
    // Regenerate display data with updated state
    this.applyGrouping();
  }

  private applyGrouping(): void {
    // Start with the base hierarchical data (filtered if search is active)
    let hierarchicalData = this.rowData;
    if (this.searchText && this.searchText.trim() !== '') {
      hierarchicalData = this.filterHierarchicalData(this.rowData, this.searchText);
    }
    
    // Apply grouping if active
    if (this.activeGroupFields.length > 0) {
      // Group the hierarchical data (groups materials within sections)
      let groupedHierarchicalData = this.groupByService.groupHierarchicalData(hierarchicalData, this.activeGroupFields);
      
      // Apply saved expand/collapse state to group headers
      const applyGroupState = (items: any[]): any[] => {
        return items.map((item) => {
          const newItem = { ...item };
          
          if (newItem.isGroupHeader && newItem.groupKey) {
            const savedState = this.groupExpandedState.get(newItem.groupKey);
            // Default to expanded
            newItem.isExpanded = savedState !== undefined ? savedState : true;
          }
          
          if (newItem.children && Array.isArray(newItem.children)) {
            newItem.children = applyGroupState(newItem.children);
          }
          
          return newItem;
        });
      };
      
      groupedHierarchicalData = applyGroupState(groupedHierarchicalData);
      
      // Flatten the grouped hierarchical data
      this.displayData = this.flattenHierarchicalData(groupedHierarchicalData);
    } else {
      // No grouping: just flatten the base hierarchical data
      this.displayData = this.flattenHierarchicalData(hierarchicalData);
      // Clear group state when no grouping
      this.groupExpandedState.clear();
    }

    // Update grid if available
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.displayData);
      this.gridApi.refreshCells();
    }
  }

  onCellClicked(event: any): void {
    if (event.colDef.field === 'bomLinkPart' || event.colDef.field === 'partNumber') {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
      return;
    }

    if (event.event && event.event.target) {
      const target = event.event.target as HTMLElement;
      if (
        target.closest('.ag-header-cell-filter-button') ||
        target.closest('.ag-icon-filter') ||
        target.classList.contains('ag-header-cell-filter-button') ||
        target.classList.contains('ag-icon-filter')
      ) {
        return;
      }
    }
    const target = event.event?.target as HTMLElement;

    const pasteButton = target?.closest('[data-action="paste"]');
    if (pasteButton) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow
      ) {
        event.api.stopEditing(true);

        setTimeout(() => {
          this.rowManagementService.pasteSkuValue(event, this);
        }, 0);
      }
      return;
    }

    if (target && (target.closest('.copy-button') || target.matches('.copy-button'))) {
      event.event.preventDefault();
      event.event.stopPropagation();
      if (
        event.colDef.field &&
        event.colDef.field.startsWith('sku') &&
        event.data &&
        event.data.isNewRow &&
        event.value
      ) {
        this.rowManagementService.copySkuValue(event, this);
      }
      return;
    }

    if (event.data && event.data.isNewRow && !event.data.isSectionHeader) {
      const field = event.colDef.field;
      if (field && field !== 'actions' && !field.startsWith('sku')) {
        const isDateColumn =
          field === 'bomLinkStartDate' ||
          field === 'bomLinkEndDate' ||
          field === 'startDate' ||
          field === 'endDate';

        if (isDateColumn) {
          event.api.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: event.column.getId(),
            rowPinned: event.rowPinned,
          });
          setTimeout(() => {
            const editingCell = document.querySelector('.ag-cell-inline-editing') as HTMLElement;
            if (editingCell) {
              const dateInput =
                (editingCell.querySelector('input[type="date"]') as HTMLInputElement) ||
                (editingCell.querySelector('input.ag-date-input') as HTMLInputElement) ||
                (editingCell.querySelector('input') as HTMLInputElement);

              if (dateInput) {
                dateInput.focus();
                if (typeof dateInput.showPicker === 'function') {
                  dateInput.showPicker();
                } else {
                  dateInput.click();
                }
              }
            }
          }, 150);
        } else {
          event.api.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: event.column.getId(),
            rowPinned: event.rowPinned,
            keyPress: event.event?.key,
          });
        }
        return;
      }
    }

    if (event.colDef.field === 'actions') {
      const target = event.event?.target as HTMLElement;

      if (target && target.classList.contains('add-row-btn')) {
        const rowIndex = event.rowIndex;
        if (rowIndex !== null && rowIndex !== undefined) {
          this.addRowAfter(rowIndex);
          return;
        }
      } else if (target && target.classList.contains('delete-row-btn')) {
        const partId = target.getAttribute('data-part-id');
        const newRowId = target.getAttribute('data-new-row-id');

        if (newRowId !== null) {
          this.deleteRowById(parseInt(newRowId));
          return;
        } else if (partId) {
          this.deleteRow(partId);
          return;
        }
      }
    } else if (event.colDef.field === 'material' && event.colDef.headerName === 'Material') {
      event.api.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getId(),
        rowPinned: event.rowPinned,
        keyPress: event.event?.key,
      });
      if (event.data && event.data.isNewRow) {
        return;
      }

      if (
        event.data &&
        (event.data.isMaterialHeader || event.data.isDirectRow) &&
        event.data.material
      ) {
        this.openMaterialModal(event.data);
      }
    }
  }

  openMaterialModal(materialData: any): void {
    if (!materialData) return;

    const materialId = materialData.material || materialData.part;
    if (!materialId) return;

    this.dataService.getComplexBOM(materialId).subscribe({
      next: (complexBOMData: any) => {
        const keyValuePairs: any[] = [];

        if (
          complexBOMData &&
          typeof complexBOMData === 'object' &&
          !Array.isArray(complexBOMData)
        ) {
          Object.keys(complexBOMData).forEach((key) => {
            if (complexBOMData[key] !== null && complexBOMData[key] !== undefined) {
              keyValuePairs.push({
                key: key,
                value: complexBOMData[key],
              });
            }
          });
        } else if (Array.isArray(complexBOMData)) {
          keyValuePairs.push(...complexBOMData);
        }

        const allRowData =
          keyValuePairs.length > 0
            ? { ...materialData, ...this.convertKeyValuePairsToObject(keyValuePairs) }
            : materialData;

        this.selectedMaterialData = allRowData;
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
      error: (error) => {
        this.selectedMaterialData = materialData;
        this.selectedMaterialSkuData = this.dataService.getSkuDataForPart(materialData);
        this.showMaterialModal = true;
      },
    });
  }

  private convertKeyValuePairsToObject(keyValuePairs: any[]): any {
    const obj: any = {};
    keyValuePairs.forEach((pair) => {
      if (pair.key && pair.value !== null && pair.value !== undefined) {
        obj[pair.key] = pair.value;
      }
    });
    return obj;
  }

  closeMaterialModal(): void {
    this.showMaterialModal = false;
    this.selectedMaterialData = {};
    this.selectedMaterialSkuData = [];
  }

  saveChanges(): void {
    this.rowManagementService
      .saveChanges(this.rowData, this.editedRows, this.gridApi, this)
      .then((result) => {
        if (result.success) {
          this.rowManagementService.showSaveMessage(result.message, 'success', this);
        } else {
          this.rowManagementService.showSaveMessage(result.message, 'info', this);
        }
      });
  }

  addRowAfter(rowIndex: number): void {
    const result = this.rowManagementService.addRowAfter(
      rowIndex,
      this.displayData,
      this.gridApi,
      this.dataService
    );

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells({ force: true });
      }
    }, 100);
  }

  deleteRowById(newRowId: number): void {
    this.rowManagementService.deleteRowById(newRowId, this.displayData, this.gridApi);
  }

  deleteRow(partId: string): void {
    this.rowManagementService.deleteRow(partId, this.displayData, this.gridApi);
  }

  getLastSavedText(): string {
    const lastSavedAt = this.rowManagementService.getLastSavedAt();
    if (!lastSavedAt) {
      return 'No saves yet';
    }
    return 'Last Saved: ' + this.gridCommonService.formatLastSavedTime(lastSavedAt);
  }

  clearSaveMessage(): void {
    this.rowManagementService.clearSaveMessage(this);
  }

  private isActionsColumn(params: any): boolean {
    const fieldName = params.colDef?.field;
    const colId = params.column?.getColId() || params.colDef?.colId || fieldName;
    return fieldName === 'actions' || colId === 'actions';
  }

  onSearchTextChange(): void {
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }

    this.searchTextDebounceTimer = setTimeout(() => {
      this.applyHierarchicalSearch();
    }, 300);
  }

  private searchTextDebounceTimer: any;

  clearSearch(): void {
    this.searchText = '';
    this.applyHierarchicalSearch();
    if (this.searchTextDebounceTimer) {
      clearTimeout(this.searchTextDebounceTimer);
    }
  }

  private rowMatchesSearch(row: any, searchText: string): boolean {
    if (!searchText || searchText.trim() === '') {
      return true;
    }

    const searchLower = searchText.toLowerCase().trim();

    const visibleFields = this.getVisibleColumnFields();

    const fieldsToSearch =
      visibleFields.length > 0 ? visibleFields : this.getAllSearchableFields(row);

    const excludedFields = new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus',
      'materialKey',
      '_availablePartNumbers',
      '_availableSuppliers',
      '_availableColors',
      'newRowId',
      'actions',
    ]);

    for (const key of fieldsToSearch) {
      if (excludedFields.has(key)) {
        continue;
      }

      if (!row.hasOwnProperty(key)) {
        continue;
      }

      const value = row[key];

      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && item !== undefined) {
            const itemStr = String(item).toLowerCase();
            if (itemStr.includes(searchLower)) {
              return true;
            }
          }
        }
        continue;
      }

      if (typeof value === 'object') {
        continue;
      }

      const valueStr = String(value).toLowerCase();
      if (valueStr.includes(searchLower)) {
        return true;
      }
    }

    return false;
  }

  private getVisibleColumnFields(): string[] {
    if (!this.gridApi) {
      return [];
    }

    const visibleFields: string[] = [];
    const columns = this.gridApi.getColumns();

    if (columns) {
      columns.forEach((column) => {
        const colDef = column.getColDef();
        const field = colDef.field;

        if (field && column.isVisible()) {
          const isHidden = colDef.hide === true;
          if (!isHidden) {
            visibleFields.push(field);
          }
        }
      });
    }

    return visibleFields;
  }

  private getAllSearchableFields(row: any): string[] {
    const fields: string[] = [];
    const excludedFields = new Set([
      'isSectionHeader',
      'isMaterialHeader',
      'isDirectRow',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus',
      'materialKey',
      '_availablePartNumbers',
      '_availableSuppliers',
      '_availableColors',
      'newRowId',
      'actions',
    ]);

    for (const key in row) {
      if (row.hasOwnProperty(key) && !excludedFields.has(key)) {
        fields.push(key);
      }
    }

    return fields;
  }

  private filterHierarchicalData(data: any[], searchText: string): any[] {
    if (!searchText || searchText.trim() === '') {
      return data;
    }

    const filteredData: any[] = [];

    data.forEach((sectionRow) => {
      if (!sectionRow.isSectionHeader) {
        return;
      }

      const filteredSection: any = {
        ...sectionRow,
        children: [],
      };

      if (sectionRow.children && Array.isArray(sectionRow.children)) {
        sectionRow.children.forEach((child: any) => {
          if (child.isMaterialHeader) {
            const headerMatches = this.rowMatchesSearch(child, searchText);

            let hasMatchingChildren = false;
            const filteredChildren: any[] = [];

            if (child.children && Array.isArray(child.children)) {
              child.children.forEach((subChild: any) => {
                if (this.rowMatchesSearch(subChild, searchText)) {
                  hasMatchingChildren = true;
                  filteredChildren.push(subChild);
                }
              });
            }

            if (headerMatches || hasMatchingChildren) {
              const filteredMaterialHeader: any = {
                ...child,
                children: filteredChildren,
              };
              filteredSection.children.push(filteredMaterialHeader);
            }
          } else if (child.isDirectRow) {
            if (this.rowMatchesSearch(child, searchText)) {
              filteredSection.children.push(child);
            }
          }
        });
      }

      if (filteredSection.children.length > 0) {
        filteredData.push(filteredSection);
      }
    });

    return filteredData;
  }

  public applyHierarchicalSearch(): void {
    this.applyGrouping();
  }

  private getFieldNameFromColId(colId: string): string {
    if (!colId || !this.gridApi) return colId;

    const column = this.gridApi.getColumn(colId);
    if (column) {
      const field = column.getColDef().field;
      if (field) {
        return field;
      }
    }

    return colId;
  }

  private getSortValue(row: any, field: string): any {
    if (!row || !field) return null;

    const value = row[field];

    if (value === null || value === undefined) {
      return null;
    }

    return value;
  }

  private compareValues(a: any, b: any, sortDirection: 'asc' | 'desc'): number {
    if (a === null || a === undefined) {
      return b === null || b === undefined ? 0 : 1;
    }
    if (b === null || b === undefined) {
      return -1;
    }

    let aVal: any = a;
    let bVal: any = b;

    const aNum = typeof a === 'string' ? parseFloat(a) : a;
    const bNum = typeof b === 'string' ? parseFloat(b) : b;

    if (!isNaN(aNum) && !isNaN(bNum) && typeof a === 'string' && typeof b === 'string') {
      aVal = aNum;
      bVal = bNum;
    } else {
      aVal = String(a).toLowerCase();
      bVal = String(b).toLowerCase();
    }

    let result = 0;
    if (aVal < bVal) {
      result = -1;
    } else if (aVal > bVal) {
      result = 1;
    }

    return sortDirection === 'desc' ? -result : result;
  }

  private sortHierarchicalData(data: any[], sortModel: any[]): any[] {
    if (!sortModel || sortModel.length === 0) {
      return data;
    }

    const sortedData: any[] = [];
    const sortColId = sortModel[0].colId;
    const sortField = this.getFieldNameFromColId(sortColId) || sortModel[0].field || sortColId;
    const sortDirection = sortModel[0].sort as 'asc' | 'desc';

    data.forEach((sectionRow) => {
      if (!sectionRow.isSectionHeader) {
        return;
      }

      const sortedSection: any = {
        ...sectionRow,
        children: [],
      };

      if (
        sectionRow.children &&
        Array.isArray(sectionRow.children) &&
        sectionRow.children.length > 0
      ) {
        const sortedChildren = [...sectionRow.children].sort((a: any, b: any) => {
          const aValue = this.getSortValue(a, sortField);
          const bValue = this.getSortValue(b, sortField);

          return this.compareValues(aValue, bValue, sortDirection);
        });

        sortedChildren.forEach((child: any) => {
          if (child.isMaterialHeader) {
            const sortedMaterialHeader: any = {
              ...child,
              children: [],
            };

            if (child.children && Array.isArray(child.children) && child.children.length > 0) {
              const sortedSubChildren = [...child.children].sort((a: any, b: any) => {
                const aValue = this.getSortValue(a, sortField);
                const bValue = this.getSortValue(b, sortField);
                return this.compareValues(aValue, bValue, sortDirection);
              });
              sortedMaterialHeader.children = sortedSubChildren;
            }

            sortedSection.children.push(sortedMaterialHeader);
          } else if (child.isDirectRow) {
            sortedSection.children.push(child);
          }
        });
      }

      sortedData.push(sortedSection);
    });

    return sortedData;
  }

  public applyHierarchicalSort(params: any): void {
    if (!this.gridApi) return;

    setTimeout(() => {
      const sortModel = this.gridApi.getColumnState().filter((col: any) => col.sort);

      if (!sortModel || sortModel.length === 0) {
        this.applyHierarchicalSearch();
        return;
      }

      let dataToSort = this.rowData;
      if (this.searchText && this.searchText.trim() !== '') {
        dataToSort = this.filterHierarchicalData(this.rowData, this.searchText);
      }

      if (!dataToSort || dataToSort.length === 0) {
        return;
      }

      const sortedData = this.sortHierarchicalData(dataToSort, sortModel);
      const flatData = this.flattenHierarchicalData(sortedData);
      this.displayData = flatData;

      this.gridApi.setGridOption('rowData', flatData);

      this.gridApi.applyColumnState({
        state: sortModel,
        defaultState: { sort: null },
      });
    }, 10);
  }

  private buildMbomHierarchy(data: any): any[] {
    const sections: any = {};
    const items = data.mbom;

    for (const item of items) {
      const section = item.section || 'NA';
      if (!sections[section]) sections[section] = [];

      const materialKey = `${item.part}_${item.branchID}_${item.flexBomLinkID}`;

      let existingMaterial = sections[section].find((m: any) => m.materialKey === materialKey);

      if (!existingMaterial) {
        existingMaterial = {
          ...item,
          materialKey,
          allSkus: item.skus || [],
        };
        sections[section].push(existingMaterial);
      }
    }

    const buildTree = (branchID: string, allItems: any[]): any[] => {
      const children = allItems.filter((i: any) => i.masterBranchID == branchID);
      return children
        .sort((a: any, b: any) => Number(a.sortingNumber || 0) - Number(b.sortingNumber || 0))
        .map((c: any) => ({
          ...c,
          children: buildTree(c.branchID, allItems),
        }));
    };

    const result: any[] = [];
    const sectionOrder = data.sectionOrder || [];

    for (const sectionName of sectionOrder) {
      const sectionItems = sections[sectionName] || [];
      const roots = sectionItems.filter((i: any) => i.masterBranchID == '0');

      if (roots.length > 0) {
        const sectionObj = {
          section: sectionName,
          materials: roots
            .sort((a: any, b: any) => Number(a.sortingNumber || 0) - Number(b.sortingNumber || 0))
            .map((r: any) => ({
              ...r,
              children: buildTree(r.branchID, sectionItems),
            })),
        };
        result.push(sectionObj);
      }
    }

    return result;
  }

  transformToHierarchicalData(data: any): any[] {
    const hierarchicalData: any[] = [];

    const sections = this.buildMbomHierarchy(data);

    sections.forEach((section: any) => {
      const sectionRow: any = {
        section: section.section,
        isSectionHeader: true,
        isExpanded: true, // Start expanded to show materials
        children: [],
        level: 0,
      };

      section.materials.forEach((material: any, materialIndex: number) => {
        const hasChildren = material.children && material.children.length > 0;

        if (hasChildren) {
          const materialRow: any = {
            ...material,
            section: section.section,
            material: material.part,
            materialIndex: materialIndex,
            allSkus: material.allSkus,
            isMaterialHeader: true,
            isExpanded: true,
            children: [],
            level: 1,
            parent: sectionRow,
            hasLinkedBom: true,
          };

          this.addSkuDataToRow(materialRow, material);

          material.children.forEach((child: any) => {
            const childRow = {
              ...child,
              isSubRow: true,
              level: 2,
              parent: materialRow,
            };
            this.addSkuDataToRow(childRow, child);
            materialRow.children.push(childRow);
          });

          sectionRow.children.push(materialRow);
        } else {
          const directRow = {
            ...material,
            section: section.section,
            isDirectRow: true,
            level: 1,
            parent: sectionRow,
          };
          this.addSkuDataToRow(directRow, material);
          sectionRow.children.push(directRow);
        }
      });

      hierarchicalData.push(sectionRow);
    });

    if (hierarchicalData.length === 0) {
      return hierarchicalData;
    }

    return hierarchicalData;
  }

  private addSkuDataToRow(itemRow: any, originalItem: any): void {
    const skuInfo = this.dataService.getSkuInfo();

    if (originalItem.skus && Array.isArray(originalItem.skus)) {
      skuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        const matchingSku = originalItem.skus.find((s: any) => s.skuId === sku.sku);
        itemRow[fieldName] = matchingSku ? matchingSku.value : '';
      });
    } else {
      skuInfo.forEach((sku) => {
        const fieldName = `sku${sku.sku}`;
        itemRow[fieldName] = '';
      });
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.saveMessage = message;
    this.saveMessageType = type;

    setTimeout(() => {
      this.saveMessage = '';
      this.saveMessageType = '';
    }, 5000);
  }
}
