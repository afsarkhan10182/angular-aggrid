import {
  BOM_TYPE_SBOM,
  ENUM_MBOM_LINE_ITEM,
  VALUE_SPEC_NO,
  COL_CHECKBOX,
  COL_ACTIONS,
  TITLE_EXPIRED,
  TITLE_REQUIRED_FIELD_ERROR,
  TITLE_REQUIRED_FIELD,
  TITLE_DELETE_ROW,
  TITLE_ADD_ROW,
  MSG_MISSING,
  MSG_SKU_ERROR,
  HEADER_FEATURE,
  FIELD_BOM_LINK_FEATURE,
  FIELD_PART_NUMBER,
  FIELD_PTCBOM_PART_MARK_UP_DISPLAY_NAME,
  FIELD_HAS_LINKED_BOM,
  PLACEHOLDER_SEARCH_BOM_FEATURES,
} from '../constants';
import { Injectable } from '@angular/core';
import { ColDef, GridApi } from 'ag-grid-community';
import { DataService } from './data.service';
import { GridConfigService } from './grid-config.service';
import { UtilService, ExtendedColDef } from './util.service';
import { AutocompleteCellEditorComponent } from '../components/autocomplete-cell-editor/autocomplete-cell-editor.component';

export interface HierarchicalDataConfig {
  getBomType: () => string;
  getFilteredSkuInfo: () => any[];
  selectedSkuFilter: string;
  hasSkuInExistingResponse: (row: any, targetSkuIds: Set<string>) => boolean;
  rowMatchesSearch: (row: any, searchText: string) => boolean;
}

export interface CellRenderingConfig {
  shouldHighlightRow: (data: any) => boolean;
  getPartNumberValue: (row: any) => string;
  isSkuFilterReadOnly: () => boolean;
  isEbomMode?: () => boolean;
  utilService: UtilService;
  gridConfigService: GridConfigService;
}

export interface ColumnDefinitionConfig {
  columnMapping: { [key: string]: string };
  constraintsData?: any;
  isSkuFilterReadOnly: () => boolean;
  isSbomMode: () => boolean;
  isEbomMode?: () => boolean;
  isMaterialMbomMode?: () => boolean;
  getDataCellStyle: (params: any) => any;
  getFeatureValue: (data: any) => any;
  renderHierarchicalCell: (params: any) => string;
  getHierarchicalCellStyle: (params: any) => any;
  getFilteredSkuInfo: () => any[];
  shouldHighlightRow: (data: any) => boolean;
  renderNewRowSkuCell: (params: any) => string;
  utilService: UtilService;
}

export interface ColumnVisibilityConfig {
  gridApi: GridApi | undefined;
  allColumns: ExtendedColDef[];
  isSkuColumn: (col: any) => boolean;
  isFieldGrouped: (field: string) => boolean;
  panelColumnOrder: ExtendedColDef[];
  setPanelColumnOrder: (order: ExtendedColDef[]) => void;
}

@Injectable({
  providedIn: 'root',
})
export class GridService {
  constructor(
    private readonly dataService: DataService,
    private readonly gridConfigService: GridConfigService,
    private readonly utilService: UtilService,
  ) {}

  flattenHierarchicalData(data: any[], config: HierarchicalDataConfig): any[] {
    const result: any[] = [];
    const bomType = config.getBomType();
    const isSbom = bomType === BOM_TYPE_SBOM;

    const processNode = (node: any) => {
      if (node.isSectionHeader) {
        this.processSectionHeader(node, result, processNode);
        return;
      }

      if (this.shouldSkipSbomNode(node, isSbom)) {
        this.processChildrenIfExpanded(node, processNode);
        return;
      }

      if (this.shouldIncludeNode(node)) {
        result.push(node);
      }

      this.processChildrenIfExpanded(node, processNode);
    };

    data.forEach((item) => {
      processNode(item);
    });

    return result;
  }

  private processSectionHeader(node: any, result: any[], processNode: (node: any) => void): void {
    result.push(node);
    const isExpanded = node.isExpanded ?? true;
    if (isExpanded && Array.isArray(node.children)) {
      node.children.forEach((child: any) => processNode(child));
    }
  }

  private shouldSkipSbomNode(node: any, isSbom: boolean): boolean {
    if (!isSbom) return false;

    const isDataRow = node.isDirectRow || node.isSubRow;
    const partNumber = node?.[FIELD_PART_NUMBER] || node.part || '';
    const hasPartNumber = partNumber && String(partNumber).trim() !== '';

    if (!isDataRow || !hasPartNumber) return false;

    const isMbomLineItem = node.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM;
    if (isMbomLineItem) return false;

    const specSheetExtra = String(node.bomLinkSpecSheetExtra || '').trim();
    return specSheetExtra === VALUE_SPEC_NO;
  }

  private shouldIncludeNode(node: any): boolean {
    const isDataRow = node.isDirectRow || node.isSubRow;
    const partNumber = node?.[FIELD_PART_NUMBER] || node.part || '';
    const hasPartNumber = partNumber && String(partNumber).trim() !== '';
    return !isDataRow || hasPartNumber;
  }

  private processChildrenIfExpanded(node: any, processNode: (node: any) => void): void {
    if (node.isExpanded && Array.isArray(node.children)) {
      node.children.forEach((child: any) => processNode(child));
    }
  }

  filterHierarchicalData(
    data: any[],
    searchText: string,
    config: HierarchicalDataConfig,
  ): any[] {
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
            const headerMatches = config.rowMatchesSearch(child, searchText);

            let hasMatchingChildren = false;
            const filteredChildren: any[] = [];

            if (child.children && Array.isArray(child.children)) {
              child.children.forEach((subChild: any) => {
                if (config.rowMatchesSearch(subChild, searchText)) {
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
            if (config.rowMatchesSearch(child, searchText)) {
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

  filterHierarchicalDataBySkuFilter(
    data: any[],
    config: HierarchicalDataConfig,
  ): any[] {
    if (config.selectedSkuFilter === 'all') {
      return data;
    }

    const visibleSkus = config.getFilteredSkuInfo();
    const visibleSkuIds = new Set<string>(
      visibleSkus.map((sku) => String(sku.skuId || '').trim()).filter((id: string) => id !== ''),
    );

    if (visibleSkuIds.size === 0) {
      return data;
    }

    const filterRows = (rows: any[]): any[] => {
      return rows
        .map((row) => {
          if (
            row.isSectionHeader ||
            row.isGroupHeader ||
            row.isMaterialHeader ||
            row.isBranchHeader
          ) {
            const filteredRow = { ...row };
            if (row.children && Array.isArray(row.children)) {
              filteredRow.children = filterRows(row.children);
            }
            return filteredRow;
          }

          if (config.hasSkuInExistingResponse(row, visibleSkuIds)) {
            const filteredRow = { ...row };
            if (row.children && Array.isArray(row.children)) {
              filteredRow.children = filterRows(row.children);
            }
            return filteredRow;
          }

          return null;
        })
        .filter((row) => row !== null);
    };

    return filterRows(data);
  }

  renderHierarchicalCell(params: any, config: CellRenderingConfig): string {
    const data = params.data;

    if (data.isGroupHeader) {
      return this.renderGroupHeader(data, config);
    }

    if (data.isSectionHeader) {
      return this.renderSectionHeader(data, config);
    }

    if (data.isMaterialHeader) {
      return this.renderMaterialHeader(data, config);
    }

    if (data.isParentRow) {
      return this.renderParentRow(data, config);
    }

    if (data.isDirectRow) {
      return this.renderDirectRow(data, config);
    }

    return this.renderDefaultCell(data, config);
  }

  private renderGroupHeader(data: any, config: CellRenderingConfig): string {
    const arrowIcon = data.isExpanded ? '▼' : '▶';
    const groupValue = data.groupValue !== null && data.groupValue !== undefined ? String(data.groupValue) : '(Empty)';
    const groupLevel = data.groupLevel ?? 0;
    const groupCount = this.gridConfigService.getGroupCount(data);
    const bgColor = this.getGroupBackgroundColor(groupLevel);
    const borderColor = this.getGroupBorderColor(groupLevel);
    const hoverBg = this.getGroupHoverBackgroundColor(groupLevel);
    const indentPx = groupLevel * 16;

    return `
      <div
        class="hier-header hier-clickable"
        style="--bg:${bgColor};--bg-hover:${hoverBg};--border:${borderColor};--arrow-color:${borderColor};--indent:${indentPx}px;"
        onclick="globalThis.toggleGroup('${data.groupKey}')"
      >
        <span class="hier-arrow">${arrowIcon}</span>
        <span class="hier-title">
          <span class="hier-indent"></span>${config.utilService.escapeHtml(data.groupHeaderName)}: ${config.utilService.escapeHtml(groupValue)}
        </span>
        <span class="hier-count">(${groupCount})</span>
      </div>
    `;
  }

  private renderSectionHeader(data: any, config: CellRenderingConfig): string {
    const arrowIcon = data.isExpanded ? '▼' : '▶';
    const displayName = data.sectionDisplayName;
    const internalName = data.section;
    return `
      <div
        class="hier-header hier-clickable section-header"
        title="${config.utilService.escapeHtml(displayName)}"
        onclick="globalThis.toggleSection('${internalName}')"
      >
        <span class="hier-arrow">${arrowIcon}</span>
        <span class="hier-title">${config.utilService.escapeHtml(displayName)}</span>
      </div>
    `;
  }

  private renderMaterialHeader(data: any, config: CellRenderingConfig): string {
    const materialIdentifier = data.materialKey || '';
    const materialIndex = data.materialIndex ?? '';
    const linkIcon = data[FIELD_HAS_LINKED_BOM] ? '🔗' : '';
    const textColor = config.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

    return `
      <div class="hier-header hier-clickable material-header" onclick="globalThis.toggleMaterial('${data.section}', '${materialIdentifier}', ${materialIndex})">
        ${linkIcon ? `<span class="material-link-icon">${linkIcon}</span>` : ''}
        <span class="hier-title" style="${textColor}">${config.utilService.escapeHtml(String(data.material || data.part || data[FIELD_PART_NUMBER] || ''))}</span>
      </div>
    `;
  }

  private renderParentRow(data: any, config: CellRenderingConfig): string {
    const textColor = config.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

    return `
      <div class="hier-header parent-row-header">
        <span class="hier-title" style="${textColor}"><span class="hier-indent" style="--indent:16px;"></span>${config.utilService.escapeHtml(String(data.part || ''))}</span>
      </div>
    `;
  }

  private renderDirectRow(data: any, config: CellRenderingConfig): string {
    const linkIcon = data[FIELD_HAS_LINKED_BOM] ? '🔗' : '';
    const featureValue = data.bomLinkFeature || '';
    const textColor = config.shouldHighlightRow(data) ? 'color: #ff0000;' : '';

    return `
      <div class="hier-row direct-row">
        ${linkIcon ? `<span class="direct-link-icon">${linkIcon}</span>` : ''}
        <span class="direct-text" style="${textColor}">${config.utilService.escapeHtml(featureValue)}</span>
      </div>
    `;
  }

  private renderDefaultCell(data: any, config: CellRenderingConfig): string {
    const featureValue = data.bomLinkFeature;
    const columnWidth = 220;
    const textColor = this.getHighlightColor(data, config);
    return config.utilService.createCellContentWithTooltip(featureValue, columnWidth, textColor);
  }

  renderGroupHeaderFullWidth(params: any, config: CellRenderingConfig): string {
    const data = params.data;
    const arrowIcon = data.isExpanded ? '▼' : '▶';
    const groupValue =
      data.groupValue !== null && data.groupValue !== undefined
        ? String(data.groupValue)
        : '(Empty)';
    const groupLevel = data.groupLevel ?? 0;
    const indentPixels = groupLevel * 20;
    const groupCount = this.gridConfigService.getGroupCount(data);
    const bgColor = this.getGroupBackgroundColor(groupLevel);
    const borderColor = this.getGroupBorderColor(groupLevel);
    const hoverBg = this.getGroupHoverBackgroundColor(groupLevel);

    return `
      <div
        class="hier-header hier-clickable"
        style="height:100%;padding:0 8px;--bg:${bgColor};--bg-hover:${hoverBg};--border:${borderColor};--arrow-color:${borderColor};--indent:${indentPixels}px;"
          onclick="globalThis.toggleGroup('${data.groupKey}')"
      >
        <span class="hier-arrow">${arrowIcon}</span>
        <span class="hier-title">
          <span class="hier-indent"></span>${config.utilService.escapeHtml(
            data.groupHeaderName,
          )}: ${config.utilService.escapeHtml(groupValue)}
        </span>
        <span class="hier-count">(${groupCount})</span>
      </div>
    `;
  }

  renderNewRowSkuCell(params: any, config: CellRenderingConfig): string {
    if (params.colDef?.isDisabled) {
      return '<div class="sku-cell-disabled-placeholder" style="color: #9ca3af; font-style: italic; text-align: center; padding: 4px;">Not Available</div>';
    }

    const rowData = params.data || {};
    const partNumber = config.getPartNumberValue(rowData);
    const hasValue = params.value !== null && params.value !== undefined && params.value !== '';
    const isEbom = config.isEbomMode?.();

    if (isEbom) {
      if (!partNumber) return '';
      if (hasValue) {
        const valueText = config.utilService.escapeHtml(String(params.value));
        return `
          <div class="sku-cell-action-wrapper filled">
            <span class="sku-cell-value" title="${valueText}">${valueText}</span>
          </div>
        `;
      }
      return '';
    }

    if (!partNumber) {
      return '';
    }

    const partLabel = config.utilService.escapeHtml(partNumber);
    const isReadOnly = config.isSkuFilterReadOnly();

    if (isReadOnly) {
      if (!hasValue) {
        return '';
      }
      const valueText = config.utilService.escapeHtml(String(params.value));
      return `
        <div class="sku-cell-action-wrapper filled">
          <span class="sku-cell-value" title="${valueText}">${valueText}</span>
        </div>
      `;
    }

    if (!hasValue) {
      return `
        <div class="sku-cell-action-wrapper empty">
          <button type="button" class="sku-paste-part-btn" data-action="paste-part" title="Paste Part # ${partLabel}">
             Paste Part #
          </button>
        </div>
      `;
    }

    const valueText = config.utilService.escapeHtml(String(params.value));
    return `
      <div class="sku-cell-action-wrapper filled">
        <span class="sku-cell-value" title="${valueText}">${valueText}</span>
        <button type="button" class="sku-delete-btn" data-action="clear-sku" title="Remove value">
          ✕
        </button>
      </div>
    `;
  }

  shouldHighlightRow(data: any): boolean {
    if (!data) return false;
    const refSkuId = this.dataService.getRefSkuId();
    if (!refSkuId) return false;
    const refSkuFieldName = `sku${refSkuId}`;
    return !!(data[refSkuFieldName] && String(data[refSkuFieldName]).trim() !== '');
  }

  getHighlightColor(data: any, config: CellRenderingConfig): string | undefined {
    return config.shouldHighlightRow(data) ? '#ff0000' : undefined;
  }

  getGroupBackgroundColor(groupLevel: number): string {
    if (groupLevel === 0) return '#f0f9ff';
    if (groupLevel === 1) return '#f0fdf4';
    return '#fef3c7';
  }

  getGroupBorderColor(groupLevel: number): string {
    if (groupLevel === 0) return '#3b82f6';
    if (groupLevel === 1) return '#10b981';
    return '#f59e0b';
  }

  getGroupHoverBackgroundColor(groupLevel: number): string {
    if (groupLevel === 0) return '#e0f2fe';
    if (groupLevel === 1) return '#dcfce7';
    return '#fde68a';
  }

  createCheckboxColumn(): ExtendedColDef {
    return {
      headerName: '',
      field: COL_CHECKBOX,
      colId: COL_CHECKBOX,
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      suppressMovable: true,
      context: {
        excludeFromExport: true,
      },
    };
  }

  createActionsColumn(
    isAddRowEnabled: () => boolean,
    getGroupCount: (data: any) => number,
    hasVisibleChildren: (params: any) => boolean,
    getBomType: () => string,
  ): ExtendedColDef {
    return {
      headerName: '',
      field: COL_ACTIONS,
      colId: COL_ACTIONS,
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: true,
      suppressMovable: true,
      context: {
        excludeFromExport: true,
      },
      cellRenderer: (params: any) => {
        if (params.data.isGroupHeader) {
          return '';
        }

        if (params.data.isExpired) {
          return `<span class="expired-indicator" title="${TITLE_EXPIRED}">e</span>`;
        }

        const partId = params.data?.[FIELD_PART_NUMBER];
        const row = params.data;

        const renderValidationIcon = () => {
          if (!row.validation || row.validation.isValid) return '';
          const missing = (row.validation.missingFields || []).join(', ');
          const skuErrors = (row.validation.skuErrors || []).join(', ');
          const tooltipParts = [
            missing ? `${MSG_MISSING}: ${missing}` : null,
            skuErrors ? `${MSG_SKU_ERROR}: ${skuErrors}` : null,
          ].filter(Boolean);
          const escaped = (tooltipParts.join('\n') || TITLE_REQUIRED_FIELD_ERROR).replace(/"/g, '&quot;');
          return `<span class="validation-error-icon" style="width:40px; display:inline-block; color:#ef4444; position:absolute; left:-18px; top:0px; cursor: pointer; font-size: 20px" title="${escaped}" aria-label="${TITLE_REQUIRED_FIELD}">&#8505;</span>`;
        };

        if (row.validation && !row.validation.isValid) {
          const icon = renderValidationIcon();
          if (row.isNewRow) {
            return `${icon}<span class="delete-row-btn" data-new-row-id="${row.newRowId}" title="${TITLE_DELETE_ROW}">−</span>`;
          }
          if (
            (params.data.isMaterialHeader && params.data[FIELD_HAS_LINKED_BOM]) ||
            params.data.isDirectRow ||
            (params.data.isSectionHeader && !hasVisibleChildren(params))
          ) {
            const addBtn = isAddRowEnabled() ? `<span class="add-row-btn" data-part-id="${partId || ''}" title="${TITLE_ADD_ROW}">+</span>` : '';
            return `${icon}${addBtn}`;
          }
          return icon;
        }

        if (params.data.isNewRow) {
          const newRowId = params.data.newRowId;
          return `<span class="delete-row-btn" data-new-row-id="${newRowId}" title="${TITLE_DELETE_ROW}">−</span>`;
        }

        if (
          (params.data.isMaterialHeader && params.data[FIELD_HAS_LINKED_BOM]) ||
          params.data.isDirectRow ||
          (params.data.isSectionHeader && !hasVisibleChildren(params))
        ) {
          if (isAddRowEnabled()) {
            return `<span class="add-row-btn" data-part-id="${partId}" title="${TITLE_ADD_ROW}">+</span>`;
          }
          return '';
        }

        return '';
      },
      cellStyle: {
        textAlign: 'center',
        padding: '4px',
        borderRight: '1px solid #e2e8f0',
      },
    };
  }

  createFeatureColumn(config: ColumnDefinitionConfig): ExtendedColDef {
    return {
      headerName: HEADER_FEATURE,
      field: FIELD_BOM_LINK_FEATURE,
      colId: FIELD_BOM_LINK_FEATURE,
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
        const featureValue = config.getFeatureValue(params.data);
        if (!featureValue) return null;
        return String(featureValue);
      },
      cellRenderer: (params: any) => {
        return config.renderHierarchicalCell(params);
      },
      cellStyle: (params: any) => {
        return config.getHierarchicalCellStyle(params);
      },
      editable: (params: any) => {
        if (!params.data || params.data.isSectionHeader) {
          return false;
        }
        if (params.data.isNewRow) {
          return this.gridConfigService.isFieldEditableForNewRow(
            FIELD_BOM_LINK_FEATURE,
            config.isSkuFilterReadOnly,
            config.isSbomMode,
            config.isEbomMode,
            config.isMaterialMbomMode,
          );
        }
        return this.gridConfigService.isFieldEditableInSbom(
          FIELD_BOM_LINK_FEATURE,
          params.data,
          config.isSkuFilterReadOnly,
          config.isSbomMode,
          config.isEbomMode,
          config.isMaterialMbomMode,
        );
      },
      cellEditor: AutocompleteCellEditorComponent,
      cellEditorParams: () => ({
        placeholder: PLACEHOLDER_SEARCH_BOM_FEATURES,
        isBomFeatureSearch: true,
        context: {
          dataService: this.dataService,
        },
      }),
    };
  }

  createStandardColumn(
    field: string,
    headerName: string,
    config: ColumnDefinitionConfig,
  ): ColDef {
    const columnDef: ColDef = {
      headerName: headerName,
      field: field,
      width: 150,
      minWidth: 100,
      sortable: true,
      resizable: true,
      hide: field === FIELD_PTCBOM_PART_MARK_UP_DISPLAY_NAME,
      cellRenderer: (params: any) => {
        if (
          params.data.isSectionHeader ||
          params.data.isBranchHeader ||
          params.data.isGroupHeader
        ) {
          return '';
        }
        const columnWidth = params.column?.getActualWidth() || columnDef.width || 150;
        const cellStyle = config.getDataCellStyle(params);
        const textColor = cellStyle?.color || undefined;

        return config.utilService.createCellContentWithTooltip(
          params.value,
          columnWidth,
          textColor,
        );
      },
      tooltipValueGetter: (params: any) => {
        if (params.value === null || params.value === undefined) return null;
        return String(params.value);
      },
      cellStyle: (params: any) => {
        return config.getDataCellStyle(params);
      },
      editable: (params: any) => {
        if (!params.data || params.data.isSectionHeader) {
          return false;
        }
        if (params.data.isNewRow) {
          return this.gridConfigService.isFieldEditableForNewRow(
            field,
            config.isSkuFilterReadOnly,
            config.isSbomMode,
            config.isEbomMode,
            config.isMaterialMbomMode,
          );
        }
        return this.gridConfigService.isFieldEditableInSbom(
          field,
          params.data,
          config.isSkuFilterReadOnly,
          config.isSbomMode,
          config.isEbomMode,
          config.isMaterialMbomMode,
        );
      },
    };

    return columnDef;
  }

  createSkuColumns(config: ColumnDefinitionConfig): ColDef[] {
    const originalSkuInfo = this.dataService.getSkuInfo();
    const skuInfoMap = new Map<string, any>();
    originalSkuInfo.forEach((sku) => {
      skuInfoMap.set(sku.skuId, sku);
    });

    const skuColumns = config.getFilteredSkuInfo().map((sku) => {
      const originalSku = skuInfoMap.get(sku.skuId);
      const isDisabled = originalSku?.isEditable === false;

      return {
        skuId: sku.skuId,
        product: sku.product,
        material: sku.material,
        bomName: sku.bomName,
        manufacturer: sku.manufacturer,
        color: sku.color,
        size: sku.size1,
        destination: sku.destination,
        fieldName: `sku${sku.skuId}`,
        hasData: true,
        isDisabled: isDisabled,
      };
    });

    class SkuHeaderComponent {
      private eGui!: HTMLDivElement;
      private params: any;

      init(params: any) {
        this.params = params;
        const lines = params.lines || [];
        const bomName = params.bomName || '';
        const fullText = lines.join('\n');

        this.eGui = document.createElement('div');
        this.eGui.className = 'sku-header-wrapper';
        const tooltipText =
          bomName && bomName.trim() !== '' ? `${fullText}\nBOM Name - ${bomName}` : fullText;
        this.eGui.setAttribute('title', tooltipText);
        this.eGui.style.userSelect = 'none';

        lines.forEach((line: string) => {
          const div = document.createElement('div');
          div.className = 'sku-line';
          div.textContent = line;
          div.removeAttribute('title');
          this.eGui.appendChild(div);
        });
      }

      getGui() {
        return this.eGui;
      }

      refresh(params: any) {
        return false;
      }

      destroy(): void {
        // No cleanup needed
      }
    }

    return skuColumns.map((sku, index) => {
      const lines = [`SKU - ${sku.skuId}`];

      if (sku.product !== undefined && sku.product !== null && sku.product !== '') {
        lines.push(`Product - ${sku.product}`);
      }
      if (sku.material !== undefined && sku.material !== null && sku.material !== '') {
        lines.push(`Material - ${sku.material}`);
      }
      if (sku.manufacturer !== undefined && sku.manufacturer !== null && sku.manufacturer !== '') {
        lines.push(`Manufacturer - ${sku.manufacturer}`);
      }
      if (sku.color !== undefined && sku.color !== null && sku.color !== '') {
        lines.push(`Color - ${sku.color}`);
      }
      if (sku.size !== undefined && sku.size !== null && sku.size !== '') {
        lines.push(`Size - ${sku.size}`);
      }
      if (sku.destination && sku.destination.trim() !== '') {
        lines.push(`Destination - ${sku.destination}`);
      }

      const fullHeader = lines.join('\n');
      const headerClasses = [index === 0 ? 'first-sku-column-header' : ''];
      const cellClasses = [index === 0 ? 'first-sku-column-cell' : ''];

      if (sku.isDisabled) {
        headerClasses.push('sku-column-disabled-header');
        cellClasses.push('sku-column-disabled-cell');
      }

      return {
        headerName: fullHeader,
        headerTooltip: fullHeader,
        headerComponent: SkuHeaderComponent,
        headerComponentParams: {
          lines: lines,
          fullText: fullHeader,
          bomName: sku.bomName || '',
        },
        field: sku.fieldName,
        width: 200,
        minWidth: 200,
        maxWidth: 350,
        resizable: true,
        suppressSizeToFit: true,
        suppressAutoSize: true,
        skuId: sku.skuId,
        isDisabled: sku.isDisabled,
        headerClass: headerClasses.filter(Boolean).join(' '),
        cellClass: cellClasses.filter(Boolean).join(' '),
        cellRenderer: (params: any) => {
          return this.renderSkuCell(params, config);
        },
        tooltipValueGetter: (params: any) => {
          if (params.value === null || params.value === undefined) return null;
          return String(params.value);
        },
        cellStyle: (params: any) => {
          return config.getDataCellStyle(params);
        },
        editable: false,
      };
    });
  }

  getVisibleColumnsForPanel(config: ColumnVisibilityConfig): ExtendedColDef[] {
    if (config.panelColumnOrder.length > 0) {
      return config.panelColumnOrder.filter(
        (col) =>
          col?.field &&
          !config.isSkuColumn(col) &&
          !config.isFieldGrouped(col.field) &&
          col.field !== COL_CHECKBOX,
      );
    }

    if (!config.gridApi) {
      const columns = config.allColumns.filter(
        (col) => col.field && !config.isSkuColumn(col) && !config.isFieldGrouped(col.field),
      );
      config.setPanelColumnOrder([...columns]);
      return columns;
    }

    const gridColumns = config.gridApi.getColumns();
    if (!gridColumns || gridColumns.length === 0) {
      const columns = config.allColumns.filter(
        (col) => col.field && !config.isSkuColumn(col) && !config.isFieldGrouped(col.field),
      );
      config.setPanelColumnOrder([...columns]);
      return columns;
    }

    const colDefMap = new Map<string, ExtendedColDef>();
    config.allColumns.forEach((colDef) => {
      const field = colDef.field || colDef.colId;
      if (field) {
        colDefMap.set(field, colDef);
      }
    });

    const orderedColumns = gridColumns
      .map((gridCol) => {
        const colId = gridCol.getColId();
        return colDefMap.get(colId);
      })
      .filter((colDef): colDef is ExtendedColDef => {
        if (!colDef?.field) return false;
        return (
          !config.isSkuColumn(colDef) &&
          !config.isFieldGrouped(colDef.field) &&
          colDef.field !== COL_CHECKBOX
        );
      });

    config.setPanelColumnOrder([...orderedColumns]);
    return orderedColumns;
  }

  selectAllColumns(config: ColumnVisibilityConfig): void {
    if (!config.gridApi) return;

    const columnsToShow = config.allColumns.filter(
      (col) => col.field && !config.isSkuColumn(col) && !config.isFieldGrouped(col.field),
    );
    const fieldsToShow = columnsToShow
      .map((col) => col.field)
      .filter((field): field is string => field !== undefined && field !== null);

    if (fieldsToShow.length > 0) {
      config.gridApi.setColumnsVisible(fieldsToShow, true);
      columnsToShow.forEach((col) => {
        col.hide = false;
      });
    }
  }

  clearAllColumns(config: ColumnVisibilityConfig): void {
    if (!config.gridApi) return;

    const columnsToHide = config.allColumns.filter(
      (col) => col.field && !config.isSkuColumn(col) && !config.isFieldGrouped(col.field),
    );
    const fieldsToHide = columnsToHide
      .map((col) => col.field)
      .filter((field): field is string => field !== undefined && field !== null);

    if (fieldsToHide.length > 0) {
      config.gridApi.setColumnsVisible(fieldsToHide, false);
      columnsToHide.forEach((col) => {
        col.hide = true;
      });
    }
  }

  toggleColumnVisibility(
    col: ExtendedColDef,
    visible: boolean,
    config: ColumnVisibilityConfig,
  ): void {
    if (!config.gridApi) return;

    if (col.isVirtual) {
      col.hide = !visible;
    } else if (col.field) {
      config.gridApi.setColumnsVisible([col.field], visible);
      col.hide = !visible;
    }
  }

  moveColumn(
    draggedCol: ExtendedColDef,
    targetCol: ExtendedColDef,
    draggedIndex: number,
    targetIndex: number,
    config: ColumnVisibilityConfig,
  ): void {
    if (!config.gridApi || !draggedCol.field || !targetCol.field) return;

    const allColumns = config.gridApi.getColumns();
    if (!allColumns || allColumns.length === 0) return;

    const draggedColObj = config.gridApi.getColumn(draggedCol.field);
    const targetColObj = config.gridApi.getColumn(targetCol.field);

    if (!draggedColObj || !targetColObj) return;

    const draggedIndexInGrid = allColumns.indexOf(draggedColObj);
    const targetIndexInGrid = allColumns.indexOf(targetColObj);

    if (draggedIndexInGrid === -1 || targetIndexInGrid === -1) return;

    const newIndex =
      draggedIndexInGrid < targetIndexInGrid
        ? targetIndexInGrid + 1
        : targetIndexInGrid;

    config.gridApi.moveColumns([draggedColObj], newIndex);

    const newPanelOrder = [...config.panelColumnOrder];
    const draggedItem = newPanelOrder[draggedIndex];
    newPanelOrder.splice(draggedIndex, 1);
    newPanelOrder.splice(targetIndex, 0, draggedItem);
    config.setPanelColumnOrder(newPanelOrder);
  }

  private renderSkuCell(params: any, config: any): string {
    const data = params.data || {};

    if (data.isSectionHeader || data.isBranchHeader || data.isGroupHeader) {
      return '';
    }

    if (data.isNewRow) {
      return this.renderNewRowSkuCellInternal(params, config);
    }

    const value = params.value;
    if (!value && value !== 0) return '';

    const textColor = config.shouldHighlightRow(data) ? 'color: #ff0000;' : '';
    const valueStr = String(value);
    const htmlValue = config.utilService.escapeHtml(valueStr).replaceAll('\n', '<br>');
    const skuField = params.colDef.field;
    const canDisconnect = !config.isSkuFilterReadOnly();

    if (data.isMaterialHeader || data.isDirectRow) {
      return this.renderSkuCellWithDelete(htmlValue, textColor, skuField, canDisconnect);
    }

    return this.renderSkuCellWithDelete(htmlValue, textColor, skuField, canDisconnect);
  }

  private renderNewRowSkuCellInternal(params: any, config: any): string {
    if (params.colDef?.isDisabled) {
      return '<div class="sku-cell-disabled-placeholder" style="color: #9ca3af; font-style: italic; text-align: center; padding: 4px;">Not Available</div>';
    }
    return config.renderNewRowSkuCell(params);
  }

  private renderSkuCellWithDelete(htmlValue: string, textColor: string, skuField: string, canDisconnect: boolean): string {
    const deleteIcon = '';

    return `<div style="white-space: pre-line; line-height: 1.5; padding: 4px 0; display: flex; align-items: center;">
      <span style="${textColor}flex: 1;">${htmlValue}</span>
      ${deleteIcon}
    </div>`;
  }
}
