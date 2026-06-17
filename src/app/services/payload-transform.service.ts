import { Injectable } from '@angular/core';
import {
  BOM_LINK_KEY,
  BOM_TYPE_PRODUCTMBOM,
  COLUMN_RENAME_FOR_API,
  DEFAULT_BOM_TYPE,
  VALUE_SPEC_YES,
  VALUE_SPEC_NO,
  API_TRUE,
  API_FALSE,
  ENUM_MBOM_LINE_ITEM,
  FIELD_PART_NUMBER,
  FIELD_BOM_LINK_PART,
  FIELD_PART,
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_START_DATE,
  FIELD_END_DATE,
  FIELD_QUANTITY,
  FIELD_QTY,
} from '../constants';
import { DataService } from './data.service';
import { GridConfigService } from './grid/grid-config.service';
import { SkuService } from './sku.service';
import { UtilService } from './util.service';

export interface TransformGridDataToApiOptions {
  skuInfoOverride?: any[];
  gridApi?: any;
  hasDisconnectEdits?: boolean;
  disconnectedSkuKeys?: Set<string>;
  getDisconnectedKey?: (row: any, skuField: string) => string;
}

@Injectable({
  providedIn: 'root',
})
export class PayloadTransformService {
  constructor(
    private readonly dataService: DataService,
    private readonly utilService: UtilService,
    private readonly gridConfigService: GridConfigService,
    private readonly skuService: SkuService,
  ) {}

  private resolveChildId(row: any): string | null {
    if (row?.childId !== undefined && row?.childId !== null && String(row.childId).trim() !== '') {
      return String(row.childId);
    }
    return null;
  }

  private resolveColorId(row: any): string | null {
    if (row?.colorId !== undefined && row?.colorId !== null && String(row.colorId).trim() !== '') {
      return String(row.colorId);
    }
    return null;
  }

  /**
   * Build SKUs array from a row for the API payload
   * For new rows: Attempts to reuse metadata from existing rows with matching section+feature+empty part
   * For existing rows: Preserves original SKU properties with updated values
   *
   * @param row - The grid row to process
   * @param skuInfo - Array of SKU info objects from the product
   * @param rowData - Hierarchical row data for finding matching rows
   * @returns Array of SKU objects ready for API payload
   */
  buildSkusArrayFromRow(
    row: any,
    skuInfo: any[],
    rowData: any[],
    apiData?: any,
    options?: { disconnectedSkuKeys?: Set<string>; getDisconnectedKey?: (row: any, skuField: string) => string }
  ): any[] {
    const skus: any[] = [];
    const allowedSkuIds = this.skuService.createAllowedSkuIdSet(skuInfo);
    const isNewRow = row.isNewRow;
    const disconnectedSkuKeys = options?.disconnectedSkuKeys;
    const getDisconnectedKey = options?.getDisconnectedKey;
    const getSkuValue = (skuFieldName: string): any => {
      const disconnectedKey =
        disconnectedSkuKeys && getDisconnectedKey ? getDisconnectedKey(row, skuFieldName) : undefined;
      return this.skuService.getSkuValueWithDisconnectState({
        row,
        skuFieldName,
        disconnectedSkuKeys,
        disconnectedKey,
      });
    };

    if (isNewRow) {
      let resolvedSection = row.section || '';
      resolvedSection = this.resolveSectionFromRow(row, apiData, resolvedSection);

      let matchingRows: any[] = [];
      const rowFeatureValue = row.bomLinkFeature || '';
      const rowPartNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();

      const bomType = this.dataService.getBomType() || DEFAULT_BOM_TYPE;
      const isAlternateBom = false;
      const isEmptyFeature = !rowFeatureValue || rowFeatureValue.trim() === '';
      
      const shouldSearchForMatches = resolvedSection && (isAlternateBom || rowFeatureValue);
      
      if (shouldSearchForMatches) {
        matchingRows = this.findAllMatchingRows(
          rowData,
          resolvedSection,
          rowFeatureValue,
          rowPartNumber,
          bomType,
          isAlternateBom,
          isEmptyFeature
        );
      }

      const hasMatchingRows = matchingRows.length > 0;
      const hasAnySkuValue = this.skuService.hasAnySelectedSku(row, skuInfo);

      skuInfo.forEach((sku) => {
        const skuFieldName = this.skuService.toFieldName(sku.skuId);
        const skuValue = getSkuValue(skuFieldName);

        if (!hasAnySkuValue || this.skuService.hasValue(skuValue)) {
          let existingSku: any = null;

          if (hasMatchingRows) {
            for (const matchRow of matchingRows) {
              if (matchRow.allSkus && Array.isArray(matchRow.allSkus)) {
                existingSku = this.skuService.findMatchingSku(matchRow.allSkus, sku.skuId);
                if (existingSku) {
                  break;
                }
              }
            }
          }

          if (!existingSku && apiData?.instances && Array.isArray(apiData.instances)) {
            const section = resolvedSection || '';
            const partNumber = String(row?.[FIELD_PART_NUMBER] || '').trim();
            const bomLinkFeature = String(row.bomLinkFeature || '').trim();
            
            const bomType = this.dataService.getBomType() || DEFAULT_BOM_TYPE;
            const isAlternateBom = false;
            const isEmptyFeature = !bomLinkFeature || bomLinkFeature === '';

            const shouldSearchApiInstances = section && (isAlternateBom || bomLinkFeature);

            if (shouldSearchApiInstances) {
              for (const instance of apiData.instances) {
                const bomLink = instance[BOM_LINK_KEY];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instancePart = String(bomLink?.[FIELD_PART_NUMBER] || '').trim();
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instancePtcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';

                const isSectionMatch = instanceSection === section;
                const instanceHasPartNumber = Boolean(instancePart && String(instancePart).trim() !== '');

                const isMbom = bomType === BOM_TYPE_PRODUCTMBOM;

                let isFeatureMatch = false;
                let requiresPartMatch = false;

                if (isAlternateBom) {
                  if (isEmptyFeature) {
                    isFeatureMatch = !instanceFeature || instanceFeature === '';
                    requiresPartMatch = true;
                  } else {
                    isFeatureMatch = instanceFeature === bomLinkFeature;
                    requiresPartMatch = true;
                  }
                } else if (isMbom) {
                  isFeatureMatch = instanceFeature === bomLinkFeature;
                  const instanceIsEnumMBOM001 = instancePtcbomPartMarkUp === ENUM_MBOM_LINE_ITEM;
                  requiresPartMatch = instanceHasPartNumber && Boolean(instanceIsEnumMBOM001);
                }

                const isPartMatch = requiresPartMatch
                  ? String(instancePart).trim() === String(partNumber || '').trim()
                  : true;

                if (isSectionMatch && isFeatureMatch && isPartMatch) {
                  existingSku = this.skuService.findMatchingSku(bomLink.skus, sku.skuId);
                  if (existingSku) {
                    break;
                  }
                }
              }
            }
          }

          if (existingSku) {
            skus.push({
              ...existingSku,
              value: String(skuValue || ''),
            });
          } else {
            skus.push({
              ...sku,
              value: String(skuValue || ''),
            });
          }
        }
      });
    } else {
      if (!row.allSkus || !Array.isArray(row.allSkus) || row.allSkus.length === 0) {
        skuInfo.forEach((sku) => {
          const skuFieldName = this.skuService.toFieldName(sku.skuId);
          const skuValue = getSkuValue(skuFieldName);

          if (this.skuService.hasValue(skuValue)) {
            skus.push({
              ...sku,
              value: String(skuValue),
              isActive: true,
            });
          }
        });
        return skus;
      }

      row.allSkus.forEach((originalSku: any) => {
        if (!allowedSkuIds.has(this.skuService.normalizeSkuId(originalSku.skuId))) {
          return;
        }
        const skuFieldName = this.skuService.toFieldName(originalSku.skuId);
        const currentValue = getSkuValue(skuFieldName);

        skus.push({
          ...originalSku,
          value:
            this.skuService.hasValue(currentValue)
              ? String(currentValue)
              : originalSku.value || '',
        });
      });
    }

    return skus;
  }

  private resolveSectionFromRow(row: any, apiData: any, defaultSection: string): string {
    let resolvedSection = defaultSection;
    const sectionDetails = this.getSectionDetails(apiData);
    const sectionDisplayName = this.getSectionDisplayName(row);

    if (sectionDisplayName && Object.keys(sectionDetails).length > 0) {
      const foundInternalId = Object.keys(sectionDetails).find(
        (internalId) => sectionDetails[internalId] === sectionDisplayName
      );
      if (foundInternalId) {
        resolvedSection = foundInternalId;
      }
    }

    return resolvedSection;
  }

  private getSectionDetails(apiData: any): { [key: string]: string } {
    let sectionDetails = apiData?.sectionDetails || {};
    if (Object.keys(sectionDetails).length === 0 && this.dataService) {
      const fullApiData = this.dataService.getApiData();
      sectionDetails = fullApiData?.sectionDetails || {};
    }
    return sectionDetails;
  }

  private getSectionDisplayName(row: any): string {
    let sectionDisplayName = row.sectionDisplayName || '';

    if (!sectionDisplayName && row.parent) {
      let currentParent: any = row.parent;
      while (currentParent && !sectionDisplayName) {
        if (currentParent.sectionDisplayName) {
          sectionDisplayName = currentParent.sectionDisplayName;
          break;
        }
        currentParent = currentParent.parent;
      }
    }

    return sectionDisplayName;
  }

  private findAllMatchingRows(
    rows: any[],
    resolvedSection: string,
    rowFeatureValue: string,
    rowPartNumber: string,
    bomType: string,
    isAlternateBom: boolean,
    isEmptyFeature: boolean
  ): any[] {
    const matches: any[] = [];
    for (const r of rows) {
      if (r.section && r.section !== resolvedSection) {
        continue;
      }

      if ((r.isDirectRow || r.isSubRow) && !r.isNewRow) {
        if (this.isRowMatch(r, resolvedSection, rowFeatureValue, rowPartNumber, bomType, isAlternateBom, isEmptyFeature)) {
          matches.push(r);
        }
      }

      if (r.children?.length > 0) {
        const childMatches = this.findAllMatchingRows(
          r.children,
          resolvedSection,
          rowFeatureValue,
          rowPartNumber,
          bomType,
          isAlternateBom,
          isEmptyFeature
        );
        matches.push(...childMatches);
      }
    }
    return matches;
  }

  private isRowMatch(
    r: any,
    resolvedSection: string,
    rowFeatureValue: string,
    rowPartNumber: string,
    bomType: string,
    isAlternateBom: boolean,
    isEmptyFeature: boolean
  ): boolean {
    const isSectionMatch = r.section === resolvedSection;
    const existingFeature = String(r.bomLinkFeature || '').trim();
    const isMbom = bomType === BOM_TYPE_PRODUCTMBOM;

    const { isFeatureMatch, requiresPartMatch } = this.determineFeatureMatch(
      existingFeature,
      rowFeatureValue,
      isAlternateBom,
      isMbom,
      isEmptyFeature,
      r
    );

    const existingPart = String(r?.[FIELD_PART_NUMBER] || '').trim();
    const isPartMatch = requiresPartMatch ? existingPart === rowPartNumber : true;

    return isSectionMatch && isFeatureMatch && isPartMatch;
  }

  private determineFeatureMatch(
    existingFeature: string,
    rowFeatureValue: string,
    isAlternateBom: boolean,
    isMbom: boolean,
    isEmptyFeature: boolean,
    r: any
  ): { isFeatureMatch: boolean; requiresPartMatch: boolean } {
    if (isAlternateBom) {
      if (isEmptyFeature) {
        return {
          isFeatureMatch: !existingFeature || existingFeature === '',
          requiresPartMatch: true,
        };
      }
      return {
        isFeatureMatch: existingFeature === rowFeatureValue.trim(),
        requiresPartMatch: true,
      };
    }

    if (isMbom) {
      const existingPart = String(r?.[FIELD_PART_NUMBER] || '').trim();
      const existingHasPartNumber = existingPart !== '';
      const existingIsEnumMBOM001 = r.ptcbomPartMarkUp === ENUM_MBOM_LINE_ITEM;
      return {
        isFeatureMatch: existingFeature === rowFeatureValue.trim(),
        requiresPartMatch: existingHasPartNumber && existingIsEnumMBOM001,
      };
    }

    return { isFeatureMatch: false, requiresPartMatch: false };
  }

  /**
   * Transform grid row data to API payload format.
   * Handles both new rows and edited rows with proper field mapping.
   * @param options - Optional: skuInfoOverride, gridApi, hasDisconnectEdits, disconnectedSkuKeys, getDisconnectedKey
   */
  transformGridDataToApiFormat(
    rowData: any[],
    displayData: any[],
    editedRows: Set<string | number>,
    editedFields: Map<string | number, Set<string>>,
    originalRowValues: Map<string | number, any>,
    constraintsData: any,
    options?: TransformGridDataToApiOptions
  ): any {
    const skuInfoOverride = options?.skuInfoOverride;
    const gridApi = options?.gridApi;
    const disconnectedSkuKeys = options?.disconnectedSkuKeys;
    const getDisconnectedKey = options?.getDisconnectedKey;
    
    const instances: any[] = [];
    const skuInfo = Array.isArray(skuInfoOverride)
      ? skuInfoOverride
      : this.dataService.getSkuInfo();
    const allowedSkuIds = this.skuService.createAllowedSkuIdSet(skuInfo);
    const bomType = this.dataService.getBomTypeFromResponse() || this.dataService.getBomType();

    const originalApiData = this.dataService.getApiData();
    const includeInSpecSheetMap = this.dataService.getIncludeInSpecSheetMapping(constraintsData);

    const currentRowDataMap = new Map<string | number, any>();
    if (gridApi) {
      gridApi.forEachNode((node: any) => {
        if (node.data) {
          const nodeRowId =
            node.data.materialKey ||
            node.data.newRowId ||
            node.data[FIELD_PART_NUMBER] ||
            node.data.part ||
            '';
          if (nodeRowId && editedRows.has(nodeRowId)) {
            currentRowDataMap.set(nodeRowId, node.data);
          }
        }
      });
    }

    const processRow = (row: any): void => {
      if (row.isSectionHeader || row.isMaterialHeader || row.isGroupHeader) {
        if (row.children && Array.isArray(row.children)) {
          row.children.forEach((child: any) => processRow(child));
        }
        return;
      }

      if (!row.isDirectRow && !row.isSubRow && !row.isNewRow) {
        return;
      }

      const rowId = row.materialKey || row.newRowId || row[FIELD_PART_NUMBER] || row.part || '';
      const isNewRow = row.isNewRow === true;
      const isEdited = editedRows.has(rowId);
      
      const currentRow = isEdited && currentRowDataMap.has(rowId) 
        ? currentRowDataMap.get(rowId) 
        : row;

      const bomLink: any = {};

      if (isNewRow) {
        let resolvedSection = row.section || '';

        if (resolvedSection?.startsWith('__missing_section__')) {
          const apiData = this.dataService.getApiData();
          const sectionDetails = apiData?.sectionDetails ?? {};
          const sectionDisplayName = this.getSectionDisplayName(row);

          if (sectionDisplayName) {
            const foundInternalId = Object.keys(sectionDetails).find(
              (internalId) => sectionDetails[internalId] === sectionDisplayName
            );
            if (foundInternalId) {
              resolvedSection = foundInternalId;
            }
          }
        }

        if (resolvedSection) {
          bomLink.section = resolvedSection;
        }

        if (bomType === BOM_TYPE_PRODUCTMBOM) {
          bomLink.ptcbomPartMarkUp = ENUM_MBOM_LINE_ITEM;
        }

        let quantityValue: any = null;
        if (row.quantity !== undefined && row.quantity !== null && row.quantity !== '') {
          quantityValue = row.quantity;
        } else if (row.qty !== undefined && row.qty !== null && row.qty !== '') {
          quantityValue = row.qty;
        }

        if (quantityValue !== null && quantityValue !== 0 && quantityValue !== '0') {
          const formattedQuantity = this.utilService.formatQuantityToString(quantityValue);
          if (formattedQuantity !== '') {
            bomLink.quantity = formattedQuantity;
          }
        }

        if (row.bomLinkFeatureId) {
          bomLink.bomLinkFeature = String(row.bomLinkFeatureId);
        } else if (row.bomLinkFeature) {
          bomLink.bomLinkFeature = String(row.bomLinkFeature);
        }

        if (row.bomLinkStartDate) {
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(
            String(row.bomLinkStartDate)
          );
        } else if (row.startDate) {
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(String(row.startDate));
        }

        if (row.bomLinkEndDate) {
          bomLink.bomLinkEndDate = this.utilService.convertDateToApiFormat(
            String(row.bomLinkEndDate)
          );
        } else if (row.endDate) {
          bomLink.bomLinkEndDate = this.utilService.convertDateToApiFormat(String(row.endDate));
        }

        const resolvedChildId = this.resolveChildId(row);
        if (resolvedChildId) {
          bomLink.childId = resolvedChildId;
        }

        const resolvedColorId = this.resolveColorId(row);
        if (resolvedColorId) {
          bomLink.colorId = resolvedColorId;
        }

        if (row.bomLinkSpecSheetExtra) {
          const val = String(row.bomLinkSpecSheetExtra);
          if (val === VALUE_SPEC_YES) {
            bomLink.bomLinkSpecSheetExtra = API_TRUE;
          } else if (val === VALUE_SPEC_NO) {
            bomLink.bomLinkSpecSheetExtra = API_FALSE;
          } else {
            bomLink.bomLinkSpecSheetExtra = val;
          }
        }

        if (row.bomLinkIncludeInSpecSheet) {
          const isAlternateBom = false;
          const isNewRow = row.isNewRow;
          
          if (!(isAlternateBom && isNewRow)) {
            const val = String(row.bomLinkIncludeInSpecSheet);
            bomLink.bomLinkIncludeInSpecSheet = includeInSpecSheetMap[val] || val;
          }
        }

        if (row.bomLinkCountryOfOriginId) {
          const val = String(row.bomLinkCountryOfOriginId).trim();
          if (val !== '') {
            bomLink.bomLinkCountryOfOrigin = val;
          }
        }

        bomLink.skus = this.buildSkusArrayFromRow(
          row,
          skuInfo,
          rowData,
          originalApiData || undefined
        );
      } else if (isEdited) {
        const compositeId =
          row.section && (row[FIELD_PART_NUMBER] || row.part)
            ? `${row.section}::${row[FIELD_PART_NUMBER] || row.part}`
            : null;
        
        const originalValues =
          originalRowValues.get(row.materialKey) ||
          originalRowValues.get(rowId) ||
          (compositeId ? originalRowValues.get(compositeId) : null) ||
          originalRowValues.get(row[FIELD_PART_NUMBER]) ||
          originalRowValues.get(row.part) ||
          {};

        if (row.section) {
          bomLink.section = row.section;
        }

        const editedFieldsForRow = editedFields.get(rowId) || new Set<string>();

        const partEdited =
          editedFieldsForRow.has(FIELD_PART_NUMBER) ||
          editedFieldsForRow.has(FIELD_BOM_LINK_PART) ||
          editedFieldsForRow.has(FIELD_PART);
        if (partEdited) {
          const resolvedChildId = this.resolveChildId(currentRow);
          if (resolvedChildId) {
            bomLink.childId = resolvedChildId;
          }
          const resolvedColorId = this.resolveColorId(currentRow);
          if (resolvedColorId) {
            bomLink.colorId = resolvedColorId;
          }
        }

        if (editedFieldsForRow.has(FIELD_BOM_LINK_SPEC_SHEET_EXTRA)) {
          const currentVal = String(originalValues.bomLinkSpecSheetExtra || '');
          const newVal = String(currentRow.bomLinkSpecSheetExtra || '');
          
          if (currentVal === VALUE_SPEC_YES) {
            bomLink.bomLinkSpecSheetExtra_old = API_TRUE;
          } else if (currentVal === VALUE_SPEC_NO) {
            bomLink.bomLinkSpecSheetExtra_old = API_FALSE;
          } else {
            bomLink.bomLinkSpecSheetExtra_old = currentVal;
          }
          
          if (newVal === VALUE_SPEC_YES) {
            bomLink.bomLinkSpecSheetExtra_new = API_TRUE;
          } else if (newVal === VALUE_SPEC_NO) {
            bomLink.bomLinkSpecSheetExtra_new = API_FALSE;
          } else {
            bomLink.bomLinkSpecSheetExtra_new = newVal;
          }
        }

        if (editedFieldsForRow.has(FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET)) {
          const currentVal = String(originalValues.bomLinkIncludeInSpecSheet || '');
          const newVal = String(currentRow.bomLinkIncludeInSpecSheet || '');
          bomLink.bomLinkIncludeInSpecSheet_old = includeInSpecSheetMap[currentVal] || currentVal;
          bomLink.bomLinkIncludeInSpecSheet_new = includeInSpecSheetMap[newVal] || newVal;
        }

        if (editedFieldsForRow.has(FIELD_BOM_LINK_START_DATE) || editedFieldsForRow.has(FIELD_START_DATE)) {
          const currentStartDate =
            originalValues.bomLinkStartDate || originalValues.startDate || '';
          const newStartDate = currentRow.bomLinkStartDate || currentRow.startDate || '';
          bomLink.bomLinkStartDate_old =
            this.utilService.convertDateToApiFormat(currentStartDate);
          bomLink.bomLinkStartDate_new = this.utilService.convertDateToApiFormat(newStartDate);
        }

        if (editedFieldsForRow.has(FIELD_BOM_LINK_END_DATE) || editedFieldsForRow.has(FIELD_END_DATE)) {
          const currentEndDate = originalValues.bomLinkEndDate || originalValues.endDate || '';
          const newEndDate = currentRow.bomLinkEndDate || currentRow.endDate || '';
          bomLink.bomLinkEndDate_old = this.utilService.convertDateToApiFormat(currentEndDate);
          bomLink.bomLinkEndDate_new = this.utilService.convertDateToApiFormat(newEndDate);
        }

        if (editedFieldsForRow.has(FIELD_QUANTITY) || editedFieldsForRow.has(FIELD_QTY)) {
          const currentQuantityRaw = originalValues.quantity || originalValues.qty || '';
          const newQuantityRaw = currentRow.quantity || currentRow.qty || '';
          bomLink.quantity_old = this.utilService.formatQuantityToString(currentQuantityRaw);
          bomLink.quantity_new = this.utilService.formatQuantityToString(newQuantityRaw);
        }

        if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
          const filteredSkus = row.allSkus.filter((originalSku: any) =>
            allowedSkuIds.has(this.skuService.normalizeSkuId(originalSku.skuId))
          );
          bomLink.skus = filteredSkus.map((originalSku: any) => {
            const skuFieldName = this.skuService.toFieldName(originalSku.skuId);
            const disconnectedKey =
              disconnectedSkuKeys && getDisconnectedKey
                ? getDisconnectedKey(currentRow, skuFieldName)
                : undefined;
            const rawValue = this.skuService.getSkuValueWithDisconnectState({
              row: currentRow,
              skuFieldName,
              disconnectedSkuKeys,
              disconnectedKey,
            });
            const currentValue =
              rawValue !== undefined && rawValue !== null ? String(rawValue) : originalSku.value || '';

            return {
              ...originalSku,
              value: currentValue,
            };
          });
        } else {
          bomLink.skus = this.buildSkusArrayFromRow(row, skuInfo, rowData, originalApiData || undefined, {
            disconnectedSkuKeys,
            getDisconnectedKey,
          });
        }
      } else {
        return;
      }

      const rowHasDisconnect =
        !!disconnectedSkuKeys &&
        disconnectedSkuKeys.size > 0 &&
        ((!!getDisconnectedKey &&
          this.skuService.hasDisconnectedSkuForRow({
            row: currentRow,
            skuInfo,
            disconnectedSkuKeys,
            getDisconnectedKey,
          })) ||
          [...disconnectedSkuKeys].some((k) => k.startsWith(String(rowId) + '|')));
      if (rowHasDisconnect) {
        bomLink.disconnect = true;
      }

      instances.push({
        [BOM_LINK_KEY]: bomLink,
      });
    };

    rowData.forEach((row) => processRow(row));

    if (displayData && Array.isArray(displayData)) {
      displayData.forEach((flatRow: any) => {
        if (flatRow.isNewRow && flatRow.newRowId) {
          let alreadyProcessed = false;
          const checkProcessed = (node: any) => {
            if (node.newRowId === flatRow.newRowId) {
              alreadyProcessed = true;
              return;
            }
            if (node.children && Array.isArray(node.children)) {
              node.children.forEach((child: any) => checkProcessed(child));
            }
          };
          rowData.forEach((sectionRow: any) => checkProcessed(sectionRow));

          if (!alreadyProcessed) {
            processRow(flatRow);
          }
        }
      });
    }

    const apiData = this.dataService.getApiData();
    const bomPartInfo = this.dataService.getBomPartInfo();
    const columnsRaw = this.dataService.getColumnMapping();
    const sectionOrder = apiData?.sectionOrder || [];
    const skuInfoData = Array.isArray(apiData?.skuInfo) ? apiData.skuInfo : [];

    const columns: { [key: string]: string } = {};
    if (columnsRaw) {
      Object.keys(columnsRaw).forEach((key) => {
        const apiKey = COLUMN_RENAME_FOR_API[key] ?? key;
        columns[apiKey] = columnsRaw[key];
      });
    }

    const uniqueSkusMap = new Map<string, any>();

    skuInfoData.forEach((sku: any) => {
      const normalizedSkuId = this.skuService.normalizeSkuId(sku?.skuId);
      if (normalizedSkuId && allowedSkuIds.has(normalizedSkuId)) {
        uniqueSkusMap.set(normalizedSkuId, { ...sku });
      }
    });

    instances.forEach((instance) => {
      const bomLink = instance[BOM_LINK_KEY];
      if (bomLink.skus && Array.isArray(bomLink.skus)) {
        bomLink.skus.forEach((sku: any) => {
          const normalizedSkuId = this.skuService.normalizeSkuId(sku?.skuId);
          if (normalizedSkuId && allowedSkuIds.has(normalizedSkuId)) {
            if (!uniqueSkusMap.has(normalizedSkuId)) {
              uniqueSkusMap.set(normalizedSkuId, { ...sku });
            }
          }
        });
      }
    });

    const finalSkuInfo = Array.from(uniqueSkusMap.values());

    const skuIds = apiData?.skuIds || '';

    let finalBomPartInfo: any[] = [];
    if (Array.isArray(bomPartInfo)) {
      finalBomPartInfo = bomPartInfo;
    } else if (bomPartInfo) {
      finalBomPartInfo = [bomPartInfo];
    }

    return {
      bomCheckIn: 'true',
      bomType: bomType,
      bomPartInfo: finalBomPartInfo,
      instances: instances,
      columns: columns,
      sectionOrder: sectionOrder,
      skuIds: skuIds,
      skuInfo: finalSkuInfo,
    };
  }
}
