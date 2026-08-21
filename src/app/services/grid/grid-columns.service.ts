// Product BOM grid column builder: defines Product MBOM column definitions, cell editors, headers, and SKU columns used by the composer grid.
import { Injectable } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { AutocompleteCellEditorComponent } from '../../components/autocomplete-cell-editor/autocomplete-cell-editor.component';
import { HierarchicalCellRendererComponent } from '../../components/hierarchical-cell-renderer/hierarchical-cell-renderer.component';
import { GridConfigService } from './grid-config.service';
import { GridService } from './grid.service';
import { DataService } from '../data.service';
import { UtilService, ExtendedColDef } from '../util.service';
import {
  FIELD_FEATURE,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_PART,
  FIELD_BOM_LINK_COUNTRY_OF_ORIGIN,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_PART_NUMBER,
  FIELD_MATERIAL,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_QUANTITY,
  FIELD_SUPPLIER,
  FIELD_COLOR,
  FIELD_COLOR_DESCRIPTION,
} from '../../constants';

export interface GridColumnsBuildContext {
  constraintsData: any;
  actionsColumnWidth: number;
  rowData: any[];
  isAddRowEnabled: () => boolean;
  isSkuFilterReadOnly: () => boolean;
  isNonProductMbomMode: () => boolean;
  isProductMbomOnlyMode: () => boolean;
  isMaterialMbomMode: () => boolean;
  getDataCellStyle: (params: any) => any;
  getFeatureValue: (data: any) => any;
  getHierarchicalCellStyle: (params: any) => any;
  getFilteredSkuInfo: () => any[];
  selectedSkuFilter?: string;
  renderNewRowSkuCell: (params: any) => string;
  renderDataCellContent: (params: any, fallbackWidth: number, value?: any) => string;
  getCellTooltipValue: (params: any) => string | null;
  isFieldEditable: (field: string, params: any) => boolean;
  clearAutopopulateFieldsForRow: (data: any) => void;
}

export interface CollectNewRowsForGroupingConfig {
  displayData: any[];
  storedNewRows: Iterable<any>;
  resolveSectionInternalName: (row: any) => string | undefined;
  getRowAnchorId: (row: any) => string | number | null;
  sectionDetails: Record<string, string>;
}

export interface InsertNewRowsIntoDisplayDataConfig {
  displayData: any[];
  newRows: any[];
  getRowAnchorId: (row: any) => string | number | null;
}

@Injectable({
  providedIn: 'root',
})
export class GridColumnsService {
  constructor(
    private readonly gridService: GridService,
    private readonly gridConfigService: GridConfigService,
    private readonly dataService: DataService,
    private readonly utilService: UtilService,
  ) {}

  createColumns(
    columnMapping: { [key: string]: string },
    context: GridColumnsBuildContext,
  ): ColDef[] {
    const columns: ExtendedColDef[] = [];

    const checkboxSelection = (params: any) => {
      const data = params?.data;
      if (!data) {
        return false;
      }
      return !(
        data.isSectionHeader ||
        data.isGroupHeader ||
        data.isMaterialHeader ||
        data.isBranchHeader
      );
    };

    const actionsCol = this.gridService.createActionsColumn(
      () => context.isAddRowEnabled(),
      (params) => this.gridService.hasVisibleChildren(params.data),
      checkboxSelection,
    );
    actionsCol.width = context.actionsColumnWidth;
    actionsCol.minWidth = context.actionsColumnWidth;
    actionsCol.maxWidth = 76;
    actionsCol.headerCheckboxSelection = () => true;
    actionsCol.headerCheckboxSelectionFilteredOnly = true;
    actionsCol.checkboxSelection = checkboxSelection;
    columns.push(actionsCol);

    const featureCol = this.gridService.createFeatureColumn({
      columnMapping,
      constraintsData: context.constraintsData,
      isSkuFilterReadOnly: () => context.isSkuFilterReadOnly(),
      isNonProductMbomMode: () => context.isNonProductMbomMode(),
      isProductMbomOnlyMode: () => context.isProductMbomOnlyMode(),
      isMaterialMbomMode: () => context.isMaterialMbomMode(),
      getDataCellStyle: (params) => context.getDataCellStyle(params),
      getFeatureValue: (data) => context.getFeatureValue(data),
      renderHierarchicalCell: () => '',
      getHierarchicalCellStyle: (params) => context.getHierarchicalCellStyle(params),
      getFilteredSkuInfo: () => context.getFilteredSkuInfo(),
      shouldHighlightRow: (data) => this.gridService.shouldHighlightRow(data),
      renderNewRowSkuCell: (params) => context.renderNewRowSkuCell(params),
      utilService: this.utilService,
    });
    featureCol.cellRenderer = HierarchicalCellRendererComponent;
    featureCol.cellRendererParams = {};
    columns.push(featureCol);

    const specialColumnBuilders: Partial<Record<string, () => ColDef>> = {
      [FIELD_BOM_LINK_COUNTRY_OF_ORIGIN]: () =>
        this.createAutocompleteColumn({
          headerName: columnMapping[FIELD_BOM_LINK_COUNTRY_OF_ORIGIN],
          field: FIELD_BOM_LINK_COUNTRY_OF_ORIGIN,
          width: 180,
          minWidth: 140,
          context,
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: () => ({
            placeholder: 'search countries...',
            isCountrySearch: true,
            context: {
              dataService: this.dataService,
            },
          }),
        }),
      [FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET]: () =>
        this.createAutocompleteColumn({
          headerName: columnMapping[FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET],
          field: FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
          width: 150,
          minWidth: 100,
          context,
          cellEditor: AutocompleteCellEditorComponent,
          cellEditorParams: () => {
            const values = [
              '',
              ...this.dataService.getIncludeInSpecSheetOptions(context.constraintsData),
            ];
            return {
              values,
              placeholder: 'Select...',
              filterFunction: this.utilService.createAutocompleteFilter(),
            };
          },
        }),
    };

    Object.keys(columnMapping).forEach((field) => {
      if (field === FIELD_FEATURE || field === FIELD_BOM_LINK_FEATURE) {
        return;
      }

      const specialColumnBuilder = specialColumnBuilders[field];
      if (specialColumnBuilder) {
        columns.push(specialColumnBuilder());
        return;
      }

      const headerName = columnMapping[field];
      const columnDef: ColDef = {
        headerName,
        field,
        width: 150,
        minWidth: 100,
        sortable: true,
        resizable: true,
        hide: field === 'ptcBomPartMarkupDisplayName',
        cellRenderer: (params: any) =>
          context.renderDataCellContent(params, Number(columnDef.width ?? 150)),
        tooltipValueGetter: (params: any) => context.getCellTooltipValue(params),
        cellStyle: (params: any) => context.getDataCellStyle(params),
        editable: (params: any) => context.isFieldEditable(field, params),
      };

      const fieldCustomizers: Partial<Record<string, () => void>> = {
        [FIELD_BOM_LINK_PART]: () => this.configurePartNumberColumn(columnDef, context),
        [FIELD_PART_NUMBER]: () => this.configurePartNumberColumn(columnDef, context),
        [FIELD_MATERIAL]: () => this.configureMaterialSearchColumn(columnDef),
        [FIELD_MATERIAL_DESCRIPTION]: () => this.configureMaterialSearchColumn(columnDef),
        [FIELD_QUANTITY]: () => this.configureQuantityColumn(columnDef, field, context),
        [FIELD_SUPPLIER]: () => this.configureSupplierColorFeatureColumn(columnDef, field, context),
        [FIELD_COLOR]: () => this.configureSupplierColorFeatureColumn(columnDef, field, context),
        [FIELD_COLOR_DESCRIPTION]: () => this.configureSupplierColorFeatureColumn(columnDef, field, context),
        [FIELD_FEATURE]: () => this.configureSupplierColorFeatureColumn(columnDef, field, context),
        [FIELD_BOM_LINK_START_DATE]: () => this.configureDateColumn(columnDef, field, context),
        [FIELD_BOM_LINK_END_DATE]: () => this.configureDateColumn(columnDef, field, context),
      };
      const customizeField = fieldCustomizers[field];
      if (customizeField) {
        customizeField();
      }

      columns.push(columnDef);
    });

    const dynamicSkuColumns = this.gridService.createSkuColumns({
      columnMapping,
      constraintsData: context.constraintsData,
      isSkuFilterReadOnly: () => context.isSkuFilterReadOnly(),
      isNonProductMbomMode: () => context.isNonProductMbomMode(),
      isProductMbomOnlyMode: () => context.isProductMbomOnlyMode(),
      isMaterialMbomMode: () => context.isMaterialMbomMode(),
      getDataCellStyle: (params) => context.getDataCellStyle(params),
      getFeatureValue: (data) => context.getFeatureValue(data),
      renderHierarchicalCell: () => '',
      getHierarchicalCellStyle: (params) => context.getHierarchicalCellStyle(params),
      getFilteredSkuInfo: () => context.getFilteredSkuInfo(),
      selectedSkuFilter: context.selectedSkuFilter,
      shouldHighlightRow: (data) => this.gridService.shouldHighlightRow(data),
      renderNewRowSkuCell: (params) => context.renderNewRowSkuCell(params),
      utilService: this.utilService,
    });

    return [...columns, ...dynamicSkuColumns];
  }

  private createAutocompleteColumn(options: {
    headerName: string;
    field: string;
    width: number;
    minWidth: number;
    context: GridColumnsBuildContext;
    cellEditor: any;
    cellEditorParams: any;
  }): ColDef {
    const { headerName, field, width, minWidth, context, cellEditor, cellEditorParams } = options;
    return {
      headerName,
      field,
      width,
      minWidth,
      sortable: true,
      cellRenderer: (params: any) => context.renderDataCellContent(params, width),
      tooltipValueGetter: (params: any) => context.getCellTooltipValue(params),
      cellStyle: (params: any) => context.getDataCellStyle(params),
      editable: (params: any) => context.isFieldEditable(field, params),
      cellEditor,
      cellEditorParams,
    };
  }

  private configurePartNumberColumn(
    columnDef: ColDef,
    context: GridColumnsBuildContext,
  ): void {
    columnDef.cellEditor = AutocompleteCellEditorComponent;
    columnDef.cellEditorParams = () => ({
      placeholder: 'search part numbers...',
      useApiSearch: true,
      isPartNumberSearch: true,
      context: {
        dataService: this.dataService,
      },
    });
    columnDef.valueSetter = (params: any) => {
      if (!params.data || !params.colDef?.field) {
        return false;
      }
      const fieldName = params.colDef.field;
      const newVal = params.newValue == null || params.newValue === '' ? '' : String(params.newValue).trim();
      params.data[fieldName] = newVal;
      if (fieldName === FIELD_PART_NUMBER) {
        params.data.part = newVal;
        params.data.bomLinkPart = newVal;
      } else {
        params.data.part = newVal;
        params.data[FIELD_PART_NUMBER] = newVal;
      }
      if (newVal === '') {
        context.clearAutopopulateFieldsForRow(params.data);
        params.api?.refreshCells({ rowNodes: [params.node], force: true });
      }
      return true;
    };
  }

  private configureMaterialSearchColumn(columnDef: ColDef): void {
    columnDef.cellEditor = AutocompleteCellEditorComponent;
    columnDef.cellEditorParams = () => ({
      placeholder: 'search materials...',
      useApiSearch: true,
      context: {
        dataService: this.dataService,
      },
    });
  }

  private configureQuantityColumn(
    columnDef: ColDef,
    field: string,
    context: GridColumnsBuildContext,
  ): void {
    columnDef.cellEditor = 'agNumberCellEditor';
    columnDef.cellEditorParams = {
      min: 0,
      step: 'any',
    };
    columnDef.editable = (params: any) => {
      if (
        params.data &&
        (params.data.isExpired ||
          params.data.isSectionHeader ||
          params.data.isGroupHeader ||
          params.data.isMaterialHeader ||
          params.data.isBranchHeader)
      ) {
        return false;
      }
      return context.isFieldEditable(field, params);
    };
    columnDef.valueSetter = (params: any) => {
      if (!params.data || !params.colDef?.field) {
        return false;
      }
      const v = params.newValue;
      params.data[params.colDef.field] = v === null || v === undefined || v === '' ? '' : String(v);
      return true;
    };
  }

  private configureSupplierColorFeatureColumn(
    columnDef: ColDef,
    field: string,
    context: GridColumnsBuildContext,
  ): void {
    const isColorField = field === FIELD_COLOR || field === FIELD_COLOR_DESCRIPTION;
    if (field !== FIELD_SUPPLIER && !isColorField) {
      columnDef.cellEditor = 'agTextCellEditor';
      columnDef.cellEditorParams = () => ({
        values: this.gridConfigService.getUniqueFeatures(context.rowData),
        placeholder: `search ${field}...`,
      });
      return;
    }

    columnDef.cellEditor = AutocompleteCellEditorComponent;

    if (isColorField) {
      columnDef.valueGetter = (params: any) =>
        params.data?.colorDescription || params.data?.color || '';
      columnDef.valueSetter = (params: any) => {
        if (!params.data) {
          return false;
        }
        params.data.color = params.newValue || '';
        params.data.colorDescription = params.newValue || '';
        return true;
      };
    }

    columnDef.cellEditorParams = (params: any) => {
      const nodeData = params.node?.data || params.data || {};
      let values: string[] = [];

      if (field === FIELD_SUPPLIER) {
        values =
          nodeData._availableSuppliers && Array.isArray(nodeData._availableSuppliers)
            ? nodeData._availableSuppliers
            : this.gridConfigService.getUniqueSuppliers(context.rowData);
      } else if (isColorField) {
        values =
          nodeData._availableColors && Array.isArray(nodeData._availableColors)
            ? nodeData._availableColors
            : this.gridConfigService.getUniqueColors(context.rowData);
      }

      return {
        values,
        placeholder: `search ${isColorField ? 'color' : field}...`,
        context: { dataService: this.dataService },
      };
    };
  }

  private configureDateColumn(
    columnDef: ColDef,
    field: string,
    context: GridColumnsBuildContext,
  ): void {
    columnDef.filter = false;
    columnDef.cellEditor = 'agDateCellEditor';
    columnDef.editable = (params: any) => {
      if (
        params.data &&
        (params.data.isSectionHeader ||
          params.data.isGroupHeader ||
          params.data.isBranchHeader ||
          params.data.isMaterialHeader)
      ) {
        return false;
      }
      return context.isFieldEditable(field, params);
    };
    columnDef.cellRenderer = (params: any) => {
      let formattedValue = '';
      if (columnDef.valueFormatter && typeof columnDef.valueFormatter === 'function') {
        formattedValue = columnDef.valueFormatter(params) || '';
      }
      return context.renderDataCellContent(
        params,
        Number(columnDef.width ?? 150),
        formattedValue,
      );
    };
    columnDef.valueGetter = (params: any) => {
      if (!params.data) {
        return undefined;
      }
      const value = params.data[field];
      if (!value || value === '') {
        return undefined;
      }
      if (value instanceof Date) {
        return value;
      }
      return this.gridConfigService.parseDateString(String(value)) || undefined;
    };
    columnDef.cellEditorParams = {
      browserDatePicker: true,
      minValidYear: 2000,
      maxValidYear: 2050,
      format: 'mm/dd/yyyy',
    };
    columnDef.valueFormatter = (params: any) => {
      if (!params.data) {
        return '';
      }
      const rawValue = params.data[field];
      return this.gridConfigService.formatDateToMMDDYYYY(rawValue);
    };
    columnDef.valueParser = (params: any) => {
      if (!params.newValue) {
        return '';
      }
      return this.gridConfigService.convertDateEditorValueToString(params.newValue);
    };
    columnDef.valueSetter = (params: any) => {
      const fieldName = params.colDef.field as string;
      const dateStr = params.newValue
        ? this.gridConfigService.convertDateEditorValueToString(params.newValue)
        : '';
      params.data[fieldName] = dateStr;
      return true;
    };
  }

  collectNewRowsForGrouping(config: CollectNewRowsForGroupingConfig): any[] {
    const newRows: any[] = [];
    const seenNewRowIds = new Set<number>();

    if (Array.isArray(config.displayData)) {
      let currentSection: { section?: string; sectionDisplayName?: string } = {};
      const lastRowIdBySection = new Map<string, string | number>();

      config.displayData.forEach((row) => {
        if (row?.isSectionHeader) {
          currentSection = {
            section: row.section,
            sectionDisplayName: row.sectionDisplayName,
          };
          return;
        }

        if (this.isDisplayBodyRow(row) && !row.isNewRow) {
          const resolvedSection = row.section || currentSection.section;
          const anchorId = config.getRowAnchorId(row);
          if (resolvedSection && anchorId !== null && anchorId !== undefined && anchorId !== '') {
            lastRowIdBySection.set(resolvedSection, anchorId);
          }
        }
      });

      currentSection = {};
      config.displayData.forEach((row) => {
        if (row?.isSectionHeader) {
          currentSection = {
            section: row.section,
            sectionDisplayName: row.sectionDisplayName,
          };
          return;
        }

        const resolvedSection = row?.section || currentSection.section;
        const resolvedSectionDisplay = row?.sectionDisplayName || currentSection.sectionDisplayName;

        if (this.isDisplayBodyRow(row) && row.isNewRow) {
          const resolvedInternalSection =
            row.insertAfterSection ||
            config.resolveSectionInternalName(row) ||
            resolvedSection;

          if (resolvedInternalSection) {
            row.section = resolvedInternalSection;
          }

          if (!row.insertAfterSection && resolvedInternalSection) {
            row.insertAfterSection = resolvedInternalSection;
          }

          if (!row.sectionDisplayName) {
            if (resolvedInternalSection && config.sectionDetails[resolvedInternalSection]) {
              row.sectionDisplayName = config.sectionDetails[resolvedInternalSection];
            } else if (resolvedSectionDisplay) {
              row.sectionDisplayName = resolvedSectionDisplay;
            }
          }

          if (
            !row.insertAfterRowId &&
            row.insertAfterSection &&
            lastRowIdBySection.has(row.insertAfterSection)
          ) {
            row.insertAfterRowId = lastRowIdBySection.get(row.insertAfterSection);
          }

          newRows.push(row);
          if (row.newRowId !== undefined && row.newRowId !== null) {
            seenNewRowIds.add(row.newRowId);
          }
        }
      });
    }

    for (const row of config.storedNewRows) {
      if (
        row?.isNewRow &&
        !row.isSectionHeader &&
        !row.isGroupHeader &&
        !row.isMaterialHeader &&
        row.newRowId !== undefined &&
        row.newRowId !== null &&
        !seenNewRowIds.has(row.newRowId)
      ) {
        newRows.push(row);
        seenNewRowIds.add(row.newRowId);
      }
    }

    return newRows;
  }

  applySavedGroupState(items: any[], groupExpandedState: Map<string, boolean>): any[] {
    return items.map((item) => {
      const newItem = { ...item };

      if (newItem.isSectionHeader) {
        newItem.isExpanded = newItem.isExpanded ?? true;
      }

      if (newItem.isGroupHeader && newItem.groupKey) {
        const savedState = groupExpandedState.get(newItem.groupKey);
        newItem.isExpanded = savedState ?? true;
      }

      if (newItem.children && Array.isArray(newItem.children)) {
        newItem.children = this.applySavedGroupState(newItem.children, groupExpandedState);
      }

      return newItem;
    });
  }

  insertNewRowsIntoDisplayData(config: InsertNewRowsIntoDisplayDataConfig): void {
    const lastInsertIndexByAnchor = new Map<string, number>();

    config.newRows.forEach((newRow) => {
      const sectionKey = newRow.insertAfterSection || newRow.section;
      const anchorId = newRow.insertAfterRowId;

      if (anchorId !== undefined && anchorId !== null && anchorId !== '') {
        const anchorIndex = this.findAnchorIndex(
          config.displayData,
          sectionKey,
          anchorId,
          config.getRowAnchorId,
        );
        if (anchorIndex !== -1) {
          const anchorKey = `${sectionKey ?? ''}::${anchorId}`;
          const insertAt = lastInsertIndexByAnchor.get(anchorKey) ?? anchorIndex;
          config.displayData.splice(insertAt + 1, 0, newRow);
          lastInsertIndexByAnchor.set(anchorKey, insertAt + 1);
          return;
        }
      }

      if (sectionKey) {
        const headerIndex = config.displayData.findIndex(
          (row) => row?.isSectionHeader && row.section === sectionKey,
        );
        if (headerIndex === -1) {
          return;
        }
        const headerRow = config.displayData[headerIndex];
        if (headerRow?.isExpanded === false) {
          return;
        }

        let insertIndex = headerIndex;
        while (insertIndex + 1 < config.displayData.length) {
          const nextRow = config.displayData[insertIndex + 1];
          if (nextRow?.isNewRow && nextRow.section === sectionKey) {
            insertIndex++;
            continue;
          }
          break;
        }
        config.displayData.splice(insertIndex + 1, 0, newRow);
        return;
      }

      const insertAfter = newRow.insertAfter;
      if (insertAfter !== undefined && insertAfter >= 0 && insertAfter < config.displayData.length) {
        config.displayData.splice(insertAfter + 1, 0, newRow);
      }
    });
  }

  private findAnchorIndex(
    displayData: any[],
    sectionKey: string | undefined,
    anchorId: string | number,
    getRowAnchorId: (row: any) => string | number | null,
  ): number {
    let headerIndex = -1;
    if (sectionKey) {
      headerIndex = displayData.findIndex(
        (row) => row?.isSectionHeader && row.section === sectionKey,
      );
    }

    if (headerIndex !== -1) {
      let nextHeaderIndex = displayData.length;
      for (let i = headerIndex + 1; i < displayData.length; i++) {
        if (displayData[i]?.isSectionHeader) {
          nextHeaderIndex = i;
          break;
        }
      }

      for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
        const row = displayData[i];
        if (!this.isDisplayBodyRow(row)) {
          continue;
        }
        const candidateId = getRowAnchorId(row);
        if (candidateId === null || candidateId === undefined || candidateId === '') {
          continue;
        }
        if (`${candidateId}` !== `${anchorId}`) {
          continue;
        }
        return i;
      }
    }

    return displayData.findIndex((row) => {
      if (!this.isDisplayBodyRow(row)) {
        return false;
      }
      const candidateId = getRowAnchorId(row);
      if (candidateId === null || candidateId === undefined || candidateId === '') {
        return false;
      }
      return `${candidateId}` === `${anchorId}`;
    });
  }

  private isDisplayBodyRow(row: any): boolean {
    return (
      !!row &&
      !row.isSectionHeader &&
      !row.isGroupHeader &&
      !row.isMaterialHeader &&
      !row.isBranchHeader
    );
  }

}
