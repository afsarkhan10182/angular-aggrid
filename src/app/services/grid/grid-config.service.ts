import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { GridApi, GridOptions, IRowNode, getGridElement } from 'ag-grid-community';
import { SkuService } from '../sku.service';
import {
  EBOM_CORE_FIELDS,
  EBOM_SERVICE_FIELDS,
  EDITABLE_AUTOPOPULATED_FIELDS,
  ENUM_MBOM_LINE_ITEM,
  COL_ACTIONS,
  COL_CHECKBOX,
  FIELD_MATERIAL_COLOR_STATUS,
  FIELD_PART_NUMBER,
  FIELD_QUANTITY,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  SBOM_EDITABLE_FIELDS,
  NEW_ROW_EDITABLE_FIELDS,
} from '../../constants';

const ACTION_COLUMN_FIELDS = new Set<string>([COL_ACTIONS, COL_CHECKBOX]);
const FALLBACK_NON_SBOM_EDITABLE_FIELDS = new Set<string>([
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_QUANTITY,
]);
const SBOM_NEW_ROW_DISABLED_FIELDS = new Set<string>([
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
]);
const GROUP_LEVEL_CLASS_MAP: Readonly<Record<number, string>> = {
  0: 'group-level-0',
  1: 'group-level-1',
};

export interface GroupConfig {
  field: string;
  headerName: string;
}

@Injectable({
  providedIn: 'root',
})
export class GridConfigService {
  private readonly renderer: Renderer2;

  constructor(
    rendererFactory: RendererFactory2,
    private readonly skuService: SkuService,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  private getGridContainer(gridApi: GridApi): HTMLElement | null {
    const gridRoot = getGridElement(gridApi) as HTMLElement | undefined;
    if (!gridRoot) {
      return null;
    }
    return (gridRoot.closest('.ag-theme-alpine') as HTMLElement | null) || gridRoot;
  }

  private addCaptureListener(
    container: Element,
    type: string,
    handler: EventListener
  ): () => void {
    container.addEventListener(type, handler, true);
    return () => container.removeEventListener(type, handler, true);
  }

  getDefaultColDef() {
    const defaultColDef = {
      sortable: true,
      comparator: () => 0,
      filter: true,
      resizable: true,
      suppressSizeToFit: false,
      suppressAutoSize: false,
      floatingFilter: false,
      wrapHeaderText: true,
      headerClass: 'custom-header-with-border',
      width: 140,
      minWidth: 100,
      maxWidth: 300,
      wrapText: false,
      autoHeight: false,
      cellStyle: (params: any) => {
        const baseStyle: any = {
          padding: '8px 12px',
        };
        if (!params.data?.isSectionHeader) {
          baseStyle.borderRight = '1px solid #e2e8f0';
        }
        return baseStyle;
      },
    };

    return defaultColDef;
  }

  /**
   * Helper method to size columns to fit with improved experience
   */
  sizeColumnsToFit(gridApi: GridApi): void {
    if (!gridApi) return;
    gridApi.autoSizeAllColumns();
    gridApi.refreshHeader();
  }

  /**
   * Force horizontal scrollbar visibility - Simple and reliable
   */
  forceHorizontalScrollbarVisibility(gridApi: GridApi): void {
    if (!gridApi) return;

    setTimeout(() => {
      const gridContainer = this.getGridContainer(gridApi);
      if (!gridContainer) {
        return;
      }

      const horizontalScrollViewport = gridContainer.querySelector(
        '.ag-body-horizontal-scroll-viewport',
      ) as HTMLElement | null;

      if (horizontalScrollViewport) {
        this.renderer.setStyle(horizontalScrollViewport, 'overflowX', 'auto');
        this.renderer.setStyle(horizontalScrollViewport, 'overflowY', 'hidden');
      }

      const bodyViewport = gridContainer.querySelector('.ag-body-viewport') as HTMLElement | null;
      if (bodyViewport) {
        this.renderer.setStyle(bodyViewport, 'overflowX', 'auto');
      }
    }, 100);
  }

  /**
   * Parse MM/DD/YYYY format string to Date object
   * @param dateStr - Date string in MM/DD/YYYY format or any parseable date format
   * @returns Date object or null if invalid
   */
  parseDateString(dateStr: string): Date | null {
    if (!dateStr || dateStr === '') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = Number.parseInt(parts[0], 10) - 1;
      const day = Number.parseInt(parts[1], 10);
      const year = Number.parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    // Fallback to standard Date parsing
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Format Date object to MM/DD/YYYY string format
   * @param date - Date object to format
   * @returns Formatted string in MM/DD/YYYY format (e.g., "10/31/2025")
   */
  formatDateToString(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Convert any date value (Date object, string, etc.) to MM/DD/YYYY format string
   * @param value - Date value (Date object, string, or any parseable date)
   * @returns Formatted string in MM/DD/YYYY format or empty string if invalid
   */
  formatDateToMMDDYYYY(value: any): string {
    if (!value) return '';

    if (value instanceof Date) {
      return this.formatDateToString(value);
    }

    if (typeof value === 'string') {
      const mmddyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
      if (mmddyyyyPattern.test(value)) {
        return value;
      }
      const date = this.parseDateString(value);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return this.formatDateToString(date);
  }

  /**
   * Convert Date object from editor to MM/DD/YYYY format string for storage
   * @param dateValue - Date object or any value from date editor
   * @returns Formatted string in MM/DD/YYYY format or empty string
   */
  convertDateEditorValueToString(dateValue: any): string {
    if (!dateValue) return '';

    if (dateValue && typeof dateValue === 'object' && 'toLocaleDateString' in dateValue) {
      return this.formatDateToString(dateValue as Date);
    }

    if (typeof dateValue === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        return dateValue;
      }
      const date = this.parseDateString(dateValue);
      if (date) {
        return this.formatDateToString(date);
      }
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';

    return this.formatDateToString(date);
  }

  /**
   * Format last saved time
   */
  formatLastSavedTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Get unique features from row data
   */
  getUniqueFeatures(rowData: any[]): string[] {
    return this.getUniqueLookupValues(rowData, 'feature');
  }

  /**
   * Get unique suppliers
   */
  getUniqueSuppliers(rowData: any[]): string[] {
    return this.getUniqueLookupValues(rowData, 'supplier');
  }

  /**
   * Get unique colors
   */
  getUniqueColors(rowData: any[]): string[] {
    return this.getUniqueLookupValues(rowData, 'color');
  }

  private getUniqueLookupValues(rowData: any[], field: string): string[] {
    const uniqueValues = new Set<string>();
    rowData.forEach((row) => {
      const value = row?.[field];
      if (
        value &&
        !row.isNewRow &&
        !row.isSectionHeader &&
        !row.isMaterialHeader &&
        !row.isBranchHeader
      ) {
        uniqueValues.add(String(value));
      }
    });
    return Array.from(uniqueValues).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get common grid options configuration
   */
  getCommonGridOptions(componentInstance: any): GridOptions {
    return {
      theme: 'legacy',
      animateRows: false,
      enableCellTextSelection: true,
      rowSelection: 'multiple',
      suppressRowClickSelection: true,
      isRowSelectable: (rowNode: IRowNode) => {
        const data: any = rowNode?.data;
        return !!(
          data &&
          !data.isSectionHeader &&
          !data.isGroupHeader &&
          !data.isMaterialHeader &&
          !data.isBranchHeader
        );
      },
      suppressColumnVirtualisation: false,
      suppressHorizontalScroll: false,
      enableCharts: false,
      enableBrowserTooltips: true,
      suppressColumnMoveAnimation: false,
      suppressDragLeaveHidesColumns: false,
      suppressFieldDotNotation: true,
      suppressContextMenu: false,
      suppressScrollOnNewData: true,
      allowDragFromColumnsToolPanel: true,
      suppressRowVirtualisation: false,
      domLayout: 'normal',
      rowModelType: 'clientSide',
      navigateToNextCell: (params) => {
        return params.nextCellPosition;
      },
      tabToNextCell: (params) => {
        return params.nextCellPosition || false;
      },
      enterNavigatesVertically: false,
      enterNavigatesVerticallyAfterEdit: false,
      stopEditingWhenCellsLoseFocus: true,
      suppressClickEdit: false,
      singleClickEdit: true,
      getRowClass: (params) => {
        return this.buildRowClasses(params, componentInstance);
      },
      suppressAnimationFrame: true,
      context: {
        dataService: null,
      },
      onGridReady: (params) => {
        componentInstance.gridApi = params.api;
        this.forceHorizontalScrollbarVisibility(params.api);
      },
      onFirstDataRendered: (params) => {
        this.setupRowHoverSync(params.api);
      },
      onRowSelected: () => {},
      onSelectionChanged: (params) => {
        if (componentInstance.onSelectionChanged) {
          componentInstance.onSelectionChanged(params);
        }
      },
      onCellValueChanged: (params) => {
        if (componentInstance.rowManagementService?.isSkipEditTracking()) return;
        if (componentInstance.rowManagementService && componentInstance.editedRows) {
          componentInstance.rowManagementService.trackFieldChange(
            params,
            componentInstance.editedRows,
            componentInstance.editedFields,
            componentInstance.originalRowValues
          );
        }

        if (params.data?.isNewRow) {
          params.api.redrawRows({ rowNodes: [params.node] });
        }

        if (componentInstance.validateRowLive && params.data?.isNewRow) {
          componentInstance.validateRowLive(params.data);
        }

        if (params.data?.isNewRow) {
          if (
            componentInstance.rowManagementService &&
            componentInstance.dataService &&
            componentInstance.editedRows
          ) {
            componentInstance.rowManagementService.onNewRowValueChanged(
              params,
              componentInstance.dataService,
              componentInstance.editedRows
            );
          }

          setTimeout(() => {
            params.api.refreshCells({
              rowNodes: [params.node],
              force: true,
            });
          }, 100);
        }

        if (
          params.data?.isNewRow &&
          params.colDef.field &&
          params.colDef.field !== 'part' &&
          params.node.data
        ) {
          params.node.data[params.colDef.field] = params.newValue;
        }
      },
      onCellEditingStarted: () => {},
      onCellMouseOver: () => {},
      onCellEditingStopped: (params) => {
        if (
          params.data &&
          params.newValue !== undefined &&
          params.colDef.field &&
          params.newValue !== params.oldValue &&
          !params.colDef.field?.includes('Date') &&
          params.colDef.field !== FIELD_QUANTITY
        ) {
          params.data[params.colDef.field] = params.newValue;
        }
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: [params.column],
          force: true,
        });
      },
      onCellClicked: (params) => {
        if (ACTION_COLUMN_FIELDS.has(String(params.colDef.field || ''))) {
          return;
        }

        if (params.event) {
          const target = params.event.target as HTMLElement;
          if (
            target &&
            (target.closest('button') ||
              target.closest('[data-action]') ||
              target.closest('.ag-selection-checkbox') ||
              target.closest('input[type="checkbox"]') ||
              target.tagName === 'INPUT' ||
              target.closest('.ag-checkbox'))
          ) {
            return;
          }
        }
      },
      onCellKeyDown: (params) => {
        if (!params.event) return;
        
        const event = params.event as KeyboardEvent;
        const colDef = 'colDef' in params ? params.colDef : undefined;
        if (
          event.ctrlKey &&
          event.key === 'v' &&
          this.skuService.isSkuField(colDef?.field) &&
          params.data?.isNewRow
        ) {
          // Prevent paste if SKU column is disabled (not editable)
          const colDefAny = colDef as any;
          if (colDefAny?.isDisabled) {
            event.preventDefault();
            return;
          }
          
          if (componentInstance.rowManagementService) {
            componentInstance.rowManagementService.pasteSkuValue(params as any, componentInstance);
          }
          event.preventDefault();
        }
      },
      onFilterChanged: () => {},
      onFilterModified: () => {},
      onSortChanged: (params) => {
        if (componentInstance.applyGridSort) {
          componentInstance.applyGridSort(params);
        }
      },
    };
  }

  /**
   * Setup row hover synchronization across pinned columns
   *
   * NOTE: AG Grid doesn't provide a built-in API for synchronizing hover states
   * across pinned columns. This is a common limitation that requires DOM manipulation.
   *
   * This implementation:
   * - Uses AG Grid's stable `row-index` attribute (used internally by AG Grid)
   * - Uses `getDisplayedRowAtIndex()` API for row state checks
   * - Properly cleans up event listeners
   * - Works with AG Grid's virtual scrolling and row updates
   */
  private setupRowHoverSync(gridApi: GridApi): void {
    const previousCleanup = (gridApi as any)._hoverSyncCleanup as (() => void) | undefined;
    if (typeof previousCleanup === 'function') {
      previousCleanup();
    }

    const gridElement = this.getGridContainer(gridApi);
    if (!gridElement) return;

    const mainBody = gridElement.querySelector('.ag-body-viewport');
    const pinnedLeft = gridElement.querySelector('.ag-pinned-left-cols-viewport');
    const pinnedRight = gridElement.querySelector('.ag-pinned-right-cols-viewport');

    if (!mainBody) return;

    const cleanupFns: Array<() => void> = [];

    const syncHover = (rowIndex: number | null, add: boolean) => {
      if (rowIndex === null || rowIndex === undefined) return;

      const rowNode = gridApi.getDisplayedRowAtIndex(rowIndex);
      const allRows = gridElement.querySelectorAll(`.ag-row[row-index="${rowIndex}"]`);

      allRows.forEach((rowElement) => {
        const shouldAddHoverClass = rowNode
          ? add && !rowNode.isSelected() && !rowNode.data?.isSectionHeader
          : add;
        rowElement.classList.toggle('ag-row-hover', shouldAddHoverClass);
      });
    };

    const createMouseEnterHandler = (): EventListener => {
      return (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const cell = target.closest('.ag-cell');
        const row = target.closest('.ag-row') || cell?.closest('.ag-row') || null;

        if (row) {
          const rowIndexAttr = row.getAttribute('row-index');
          if (rowIndexAttr !== null) {
            const rowIndex = Number.parseInt(rowIndexAttr, 10);
            if (!Number.isNaN(rowIndex)) {
              syncHover(rowIndex, true);
            }
          }
        }
      };
    };

    const createMouseLeaveHandler = (): EventListener => {
      return (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const cell = target.closest('.ag-cell');
        const row = target.closest('.ag-row') || cell?.closest('.ag-row') || null;

        if (row) {
          const rowIndexAttr = row.getAttribute('row-index');
          if (rowIndexAttr !== null) {
            const rowIndex = Number.parseInt(rowIndexAttr, 10);
            if (!Number.isNaN(rowIndex)) {
              syncHover(rowIndex, false);
            }
          }
        }
      };
    };

    [mainBody, pinnedLeft, pinnedRight].forEach((container) => {
      if (!container) return;

      const mouseEnterHandler = createMouseEnterHandler();
      const mouseLeaveHandler = createMouseLeaveHandler();

      cleanupFns.push(this.addCaptureListener(container, 'mouseenter', mouseEnterHandler));
      cleanupFns.push(this.addCaptureListener(container, 'mouseleave', mouseLeaveHandler));
    });

    (gridApi as any)._hoverSyncCleanup = () => {
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns.length = 0;
    };
  }

  getEbomServiceFieldNames(): string[] {
    return [...EBOM_SERVICE_FIELDS];
  }

  /**
   * EBOM/MATERIALMBOM: released rows are non-editable; non-released rows are editable.
   * Mixed selection: only non-released rows are editable; updates apply per row (released part not changed).
   */
  private isRowReleasedState(rowData: any): boolean {
    const state = String(rowData?.[FIELD_MATERIAL_COLOR_STATUS] ?? '').trim().toLowerCase();
    if (!state) return false;
    return state === 'released' || state === 'release' || state.startsWith('release');
  }

  isFieldEditableInSbom(
    field: string,
    rowData: any,
    isSkuFilterReadOnly: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode?: () => boolean,
    isMaterialMbomMode?: () => boolean
  ): boolean {
    if (isSkuFilterReadOnly()) {
      return false;
    }

    if (isEbomMode?.() || isMaterialMbomMode?.()) {
      if (this.isRowReleasedState(rowData)) {
        return false;
      }
      const core = EBOM_CORE_FIELDS.includes(field);
      const serviceField = EBOM_SERVICE_FIELDS.includes(field);
      return core || serviceField;
    }

    if (!isSbomMode()) {
      return FALLBACK_NON_SBOM_EDITABLE_FIELDS.has(field);
    }

    const isMbomLineItem = rowData?.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM;

    // For MBOM line items: bomLinkIncludeInSpecSheet is always editable
    if (isMbomLineItem) {
      return field === FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET;
    }

    // For SBOM: Disable bomLinkIncludeInSpecSheet if bomLinkSpecSheetExtra exists
    if (field === FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET) {
      const specSheetExtra = rowData?.bomLinkSpecSheetExtra;
      if (this.hasDisplayValue(specSheetExtra)) {
        return false;
      }
    }

    // For regular SBOM rows
    return SBOM_EDITABLE_FIELDS.includes(field);
  }

  isFieldEditableForNewRow(
    field: string,
    isSkuFilterReadOnly: () => boolean,
    isSbomMode: () => boolean,
    isEbomMode?: () => boolean,
    isMaterialMbomMode?: () => boolean
  ): boolean {
    if (isSkuFilterReadOnly()) {
      return false;
    }

    if (isEbomMode?.() || isMaterialMbomMode?.()) {
      const core = EBOM_CORE_FIELDS.includes(field) || field === FIELD_BOM_LINK_FEATURE;
      const autopopulated = EDITABLE_AUTOPOPULATED_FIELDS.includes(field);
      const serviceField = EBOM_SERVICE_FIELDS.includes(field);
      return core || autopopulated || serviceField;
    }

    if (isSbomMode() && SBOM_NEW_ROW_DISABLED_FIELDS.has(field)) {
      return false;
    }

    return NEW_ROW_EDITABLE_FIELDS.includes(field);
  }

  /**
   * Creates nested group structure
   */
  private createNestedGroups(
    data: any[],
    groupFields: GroupConfig[],
    level: number,
    sectionKey?: string,
    sectionDisplayName?: string
  ): any[] {
    if (level >= groupFields.length) {
      return data;
    }

    const groupField = groupFields[level];
    const groups = new Map<string | null, any[]>();

    const rowsToGroup: any[] = [];
    
    data.forEach((row) => {
      if (row.isSectionHeader) {
        return;
      }

      if (row.isMaterialHeader && row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => {
          rowsToGroup.push(child);
        });
      } else {
        rowsToGroup.push(row);
      }
    });

    rowsToGroup.forEach((row) => {
      const isHeader = row.isGroupHeader;
      if (!isHeader) {
        const partNumber = row?.[FIELD_PART_NUMBER] || row.part;
        if (!partNumber || String(partNumber).trim() === '') {
          return;
        }
      }

      let groupValue = row[groupField.field];
      if (groupField.field === FIELD_BOM_LINK_FEATURE && !groupValue && row.feature) {
        groupValue = row.feature;
      }
      const key = groupValue !== null && groupValue !== undefined ? String(groupValue).trim() : '__null__';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    const result: any[] = [];
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === '__null__') return 1;
      if (b[0] === '__null__') return -1;
      const aKey = a[0] || '';
      const bKey = b[0] || '';
      return aKey.localeCompare(bKey);
    });

    sortedGroups.forEach(([key, groupRows]) => {
      const groupValue = key === '__null__' ? null : key;
      
      const groupHeader: any = {
        isGroupHeader: true,
        groupLevel: level,
        groupField: groupField.field,
        groupHeaderName: groupField.headerName,
        groupValue: groupValue,
        groupKey: `${groupField.field}_${key}`,
        isExpanded: true,
        section: sectionKey,
        sectionDisplayName: sectionDisplayName,
        children: [],
      };

      if (level < groupFields.length - 1) {
        groupHeader.children = this.createNestedGroups(
          groupRows,
          groupFields,
          level + 1,
          sectionKey,
          sectionDisplayName
        );
      } else {
        groupHeader.children = groupRows;
      }

      result.push(groupHeader);
    });

    return result;
  }

  private hasDisplayValue(value: any): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  /**
   * Gets count of items in a group
   */
  getGroupCount(groupHeader: any): number {
    if (!groupHeader.children) return 0;
    
    let count = 0;
    const countItems = (items: any[]): void => {
      items.forEach((item) => {
        if (item.isGroupHeader) {
          countItems(item.children || []);
        } else {
          count++;
        }
      });
    };
    
    countItems(groupHeader.children);
    return count;
  }

  /**
   * Groups tree data (sections -> materials)
   * Groups the children of each section based on the group fields
   */
  groupHierarchicalData(sections: any[], groupFields: GroupConfig[]): any[] {
    if (!groupFields || groupFields.length === 0) {
      return sections;
    }

    return sections.map(section => {
      if (!section.isSectionHeader) {
        return section;
      }

      const sectionWithExpanded = {
        ...section,
        isExpanded: section.isExpanded ?? true
      };

      if (!Array.isArray(section.children) || section.children.length === 0) {
        return {
          ...sectionWithExpanded,
          children: []
        };
      }

      const groupedChildren = this.createNestedGroups(
        section.children,
        groupFields,
        0,
        section.section,
        section.sectionDisplayName
      );
      
      return {
        ...sectionWithExpanded,
        children: groupedChildren || []
      };
    });
  }

  /**
   * Build row classes for AG Grid rows
   * Extracted from getRowClass to reduce cognitive complexity
   */
  private buildRowClasses(params: any, componentInstance: any): string {
    const classes: string[] = [];
    const data = params.data;

    if (!data) {
      return classes.join(' ');
    }

    this.addHeaderRowClasses(classes, data);
    this.addGroupRowClasses(classes, data);
    this.addStatusRowClasses(classes, data);
    this.addEditedRowClass(classes, data, componentInstance);

    return classes.join(' ');
  }

  private addHeaderRowClasses(classes: string[], data: any): void {
    if (data.isSectionHeader) {
      classes.push('section-header-row');
    }
  }

  private addGroupRowClasses(classes: string[], data: any): void {
    if (data.isGroupHeader) {
      classes.push('group-header-row');
      classes.push(GROUP_LEVEL_CLASS_MAP[data.groupLevel] || 'group-level-2');
    }
  }

  private addStatusRowClasses(classes: string[], data: any): void {
    if (data.isExpired) {
      classes.push('expired-row');
    }
    if (data.isParent) {
      classes.push('parent-row');
      if (data.isExpanded) {
        classes.push('expanded');
      }
    }
    if (data.isSubRow) {
      classes.push('subrow');
    }
  }

  private addEditedRowClass(classes: string[], data: any, componentInstance: any): void {
    if (!componentInstance.editedRows) {
      return;
    }

    const candidates = this.getEditedRowCandidates(data);
    const isEdited = this.isRowEdited(candidates, componentInstance.editedRows);

    if (isEdited) {
      classes.push('row-edited');
    }
  }

  private getEditedRowCandidates(data: any): any[] {
    const isNewRow = data.isNewRow === true;

    if (isNewRow) {
      return data.newRowId ? [data.newRowId] : [];
    }

    if (data.materialKey) {
      return [data.materialKey];
    }

    return [
      data[FIELD_PART_NUMBER],
      data.part,
      data.section && (data[FIELD_PART_NUMBER] || data.part)
        ? `${data.section}::${data[FIELD_PART_NUMBER] || data.part}`
        : null,
    ].filter((v) => v !== null && v !== undefined && `${v}`.trim() !== '');
  }

  private isRowEdited(candidates: any[], editedRows: Set<any>): boolean {
    return candidates.some((id) => {
      return (
        editedRows.has(id) ||
        editedRows.has(`${id}`) ||
        editedRows.has(Number(id))
      );
    });
  }

}
