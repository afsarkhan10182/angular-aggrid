import { Injectable } from '@angular/core';
import {
  BOM_LINK_KEY,
  BOM_TYPE_EBOM,
  BOM_TYPE_MBOM,
  BOM_TYPE_SBOM,
  COLUMN_RENAME_FOR_API,
  DEFAULT_BOM_TYPE,
} from '../constants';
import { DataService } from './data.service';
import { GridConfigService } from './grid-config.service';
import { UtilService } from './util.service';

@Injectable({
  providedIn: 'root',
})
export class PayloadTransformService {
  constructor(
    private readonly dataService: DataService,
    private readonly utilService: UtilService,
    private readonly gridConfigService: GridConfigService,
  ) {}

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
  buildSkusArrayFromRow(row: any, skuInfo: any[], rowData: any[], apiData?: any): any[] {
    const skus: any[] = [];
    const allowedSkuIds = new Set<string>(skuInfo.map((sku: any) => String(sku.skuId)));
    const isNewRow = row.isNewRow;

    if (isNewRow) {
      const hasSkuValue = (v: any) => {
        if (v === undefined || v === null) return false;
        const s = String(v).trim();
        return s !== '';
      };

      let resolvedSection = row.section || '';
      resolvedSection = this.resolveSectionFromRow(row, apiData, resolvedSection);

      let matchingRows: any[] = [];
      const rowFeatureValue = row.bomLinkFeature || '';
      const rowPartNumber = String(row.partNumber || '').trim();

      const bomType = this.dataService.getBomType() || DEFAULT_BOM_TYPE;
      const isSbom = bomType === BOM_TYPE_SBOM;
      const isEmptyFeature = !rowFeatureValue || rowFeatureValue.trim() === '';
      
      const shouldSearchForMatches = resolvedSection && (isSbom || rowFeatureValue);
      
      if (shouldSearchForMatches) {
        matchingRows = this.findAllMatchingRows(
          rowData,
          resolvedSection,
          rowFeatureValue,
          rowPartNumber,
          bomType,
          isSbom,
          isEmptyFeature
        );
      }

      const hasMatchingRows = matchingRows.length > 0;
      let hasAnySkuValue = false;
      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];
        if (hasSkuValue(skuValue)) {
          hasAnySkuValue = true;
        }
      });

      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];

        if (!hasAnySkuValue || hasSkuValue(skuValue)) {
          let existingSku: any = null;

          if (hasMatchingRows) {
            for (const matchRow of matchingRows) {
              if (matchRow.allSkus && Array.isArray(matchRow.allSkus)) {
                existingSku = matchRow.allSkus.find((s: any) => s.skuId === sku.skuId);
                if (existingSku) {
                  break;
                }
              }
            }
          }

          if (!existingSku && apiData?.instances && Array.isArray(apiData.instances)) {
            const section = resolvedSection || '';
            const partNumber = String(row.partNumber || '').trim();
            const bomLinkFeature = String(row.bomLinkFeature || '').trim();
            
            const bomType = this.dataService.getBomType() || DEFAULT_BOM_TYPE;
            const isSbom = bomType === BOM_TYPE_SBOM;
            const isEmptyFeature = !bomLinkFeature || bomLinkFeature === '';

            const shouldSearchApiInstances = section && (isSbom || bomLinkFeature);

            if (shouldSearchApiInstances) {
              for (const instance of apiData.instances) {
                const bomLink = instance[BOM_LINK_KEY];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instancePart = String(bomLink.partNumber || '').trim();
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instancePtcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';

                const isSectionMatch = instanceSection === section;
                const instanceHasPartNumber = Boolean(instancePart && String(instancePart).trim() !== '');

                const isMbom = bomType === BOM_TYPE_MBOM;

                let isFeatureMatch = false;
                let requiresPartMatch = false;

                if (isSbom) {
                  if (isEmptyFeature) {
                    isFeatureMatch = !instanceFeature || instanceFeature === '';
                    requiresPartMatch = true;
                  } else {
                    isFeatureMatch = instanceFeature === bomLinkFeature;
                    requiresPartMatch = true;
                  }
                } else if (isMbom) {
                  isFeatureMatch = instanceFeature === bomLinkFeature;
                  const instanceIsEnumMBOM001 = instancePtcbomPartMarkUp === 'enumMBOM001';
                  requiresPartMatch = instanceHasPartNumber && Boolean(instanceIsEnumMBOM001);
                }

                const isPartMatch = requiresPartMatch
                  ? String(instancePart).trim() === String(partNumber || '').trim()
                  : true;

                if (isSectionMatch && isFeatureMatch && isPartMatch) {
                  if (bomLink.skus && Array.isArray(bomLink.skus)) {
                    existingSku = bomLink.skus.find((s: any) => s.skuId === sku.skuId);
                    if (existingSku) {
                      break;
                    }
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
          const skuFieldName = `sku${sku.skuId}`;
          const skuValue = row[skuFieldName];

          if (skuValue !== undefined && skuValue !== null && skuValue !== '') {
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
        if (!allowedSkuIds.has(String(originalSku.skuId))) {
          return;
        }
        const skuFieldName = `sku${originalSku.skuId}`;
        const currentValue = row[skuFieldName];

        skus.push({
          ...originalSku,
          value:
            currentValue !== undefined && currentValue !== null
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
    isSbom: boolean,
    isEmptyFeature: boolean
  ): any[] {
    const matches: any[] = [];
    for (const r of rows) {
      if (r.section && r.section !== resolvedSection) {
        continue;
      }

      if ((r.isDirectRow || r.isSubRow) && !r.isNewRow) {
        if (this.isRowMatch(r, resolvedSection, rowFeatureValue, rowPartNumber, bomType, isSbom, isEmptyFeature)) {
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
          isSbom,
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
    isSbom: boolean,
    isEmptyFeature: boolean
  ): boolean {
    const isSectionMatch = r.section === resolvedSection;
    const existingFeature = String(r.bomLinkFeature || '').trim();
    const isMbom = bomType === BOM_TYPE_MBOM;

    const { isFeatureMatch, requiresPartMatch } = this.determineFeatureMatch(
      existingFeature,
      rowFeatureValue,
      isSbom,
      isMbom,
      isEmptyFeature,
      r
    );

    const existingPart = String(r.partNumber || '').trim();
    const isPartMatch = requiresPartMatch ? existingPart === rowPartNumber : true;

    return isSectionMatch && isFeatureMatch && isPartMatch;
  }

  private determineFeatureMatch(
    existingFeature: string,
    rowFeatureValue: string,
    isSbom: boolean,
    isMbom: boolean,
    isEmptyFeature: boolean,
    r: any
  ): { isFeatureMatch: boolean; requiresPartMatch: boolean } {
    if (isSbom) {
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
      const existingPart = String(r.partNumber || '').trim();
      const existingHasPartNumber = existingPart !== '';
      const existingIsEnumMBOM001 = r.ptcbomPartMarkUp === 'enumMBOM001';
      return {
        isFeatureMatch: existingFeature === rowFeatureValue.trim(),
        requiresPartMatch: existingHasPartNumber && existingIsEnumMBOM001,
      };
    }

    return { isFeatureMatch: false, requiresPartMatch: false };
  }

  /**
   * Transform grid row data to API payload format
   * Handles both new rows and edited rows with proper field mapping
   *
   * @param rowData - Hierarchical row data from grid
   * @param displayData - Flat display data (for new rows not yet in hierarchy)
   * @param editedRows - Set of edited row IDs
   * @param editedFields - Map of edited field names per row
   * @param originalRowValues - Map of original values before editing
   * @param constraintsData - Constraints data for mapping
   * @param options - Optional parameters (skuInfoOverride, gridApi)
   * @returns Complete API payload object
   */
  transformGridDataToApiFormat(
    rowData: any[],
    displayData: any[],
    editedRows: Set<string | number>,
    editedFields: Map<string | number, Set<string>>,
    originalRowValues: Map<string | number, any>,
    constraintsData: any,
    options?: { skuInfoOverride?: any[]; gridApi?: any }
  ): any {
    const skuInfoOverride = options?.skuInfoOverride;
    const gridApi = options?.gridApi;
    
    const instances: any[] = [];
    const skuInfo = Array.isArray(skuInfoOverride)
      ? skuInfoOverride
      : this.dataService.getSkuInfo();
    const allowedSkuIds = new Set<string>(skuInfo.map((sku: any) => String(sku.skuId)));
    const bomType = this.dataService.getBomTypeFromResponse() || this.dataService.getBomType();
    const isEbom = bomType === BOM_TYPE_EBOM;

    const ebomServiceFieldsSet = new Set(this.gridConfigService.getEbomServiceFieldNames());

    const originalApiData = this.dataService.getApiData();
    const includeInSpecSheetMap = this.dataService.getIncludeInSpecSheetMapping(constraintsData);

    const currentRowDataMap = new Map<string | number, any>();
    if (gridApi) {
      gridApi.forEachNode((node: any) => {
        if (node.data) {
          const nodeRowId = node.data.materialKey || node.data.newRowId || node.data.partNumber || node.data.part || '';
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

      const rowId = row.materialKey || row.newRowId || row.partNumber || row.part || '';
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

        if (bomType === BOM_TYPE_MBOM) {
          bomLink.ptcbomPartMarkUp = 'enumMBOM001';
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

        if (row.materialSupplierMasterId) {
          bomLink.childId = this.utilService.extractIdAfterLastColon(row.materialSupplierMasterId);
        } else if (row.materialSupplierVersionId) {
          bomLink.childId = this.utilService.extractIdAfterLastColon(row.materialSupplierVersionId);
        }

        if (row.colorId) {
          bomLink.colorId = this.utilService.extractIdAfterLastColon(row.colorId);
        }

        if (row.bomLinkSpecSheetExtra) {
          const val = String(row.bomLinkSpecSheetExtra);
          if (val === 'Yes') {
            bomLink.bomLinkSpecSheetExtra = 'true';
          } else if (val === 'No') {
            bomLink.bomLinkSpecSheetExtra = 'false';
          } else {
            bomLink.bomLinkSpecSheetExtra = val;
          }
        }

        if (row.bomLinkIncludeInSpecSheet) {
          const isSbom = bomType === BOM_TYPE_SBOM;
          const isNewRow = row.isNewRow;
          
          if (!(isSbom && isNewRow)) {
            const val = String(row.bomLinkIncludeInSpecSheet);
            bomLink.bomLinkIncludeInSpecSheet = includeInSpecSheetMap[val] || val;
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
          row.section && (row.partNumber || row.part)
            ? `${row.section}::${row.partNumber || row.part}`
            : null;
        
        const originalValues =
          originalRowValues.get(row.materialKey) ||
          originalRowValues.get(rowId) ||
          (compositeId ? originalRowValues.get(compositeId) : null) ||
          originalRowValues.get(row.partNumber) ||
          originalRowValues.get(row.part) ||
          {};

        if (row.section) {
          bomLink.section = row.section;
        }

        const editedFieldsForRow = editedFields.get(rowId) || new Set<string>();

        const partEdited =
          editedFieldsForRow.has('partNumber') ||
          editedFieldsForRow.has('bomLinkPart') ||
          editedFieldsForRow.has('part');
        if (partEdited) {
          if (currentRow.materialSupplierMasterId) {
            bomLink.childId = this.utilService.extractIdAfterLastColon(
              currentRow.materialSupplierMasterId,
            );
          } else if (currentRow.materialSupplierVersionId) {
            bomLink.childId = this.utilService.extractIdAfterLastColon(
              currentRow.materialSupplierVersionId,
            );
          }
          if (currentRow.colorId) {
            bomLink.colorId = this.utilService.extractIdAfterLastColon(currentRow.colorId);
          }
        }

        if (editedFieldsForRow.has('bomLinkSpecSheetExtra')) {
          const currentVal = String(originalValues.bomLinkSpecSheetExtra || '');
          const newVal = String(currentRow.bomLinkSpecSheetExtra || '');
          
          if (currentVal === 'Yes') {
            bomLink.bomLinkSpecSheetExtra_old = 'true';
          } else if (currentVal === 'No') {
            bomLink.bomLinkSpecSheetExtra_old = 'false';
          } else {
            bomLink.bomLinkSpecSheetExtra_old = currentVal;
          }
          
          if (newVal === 'Yes') {
            bomLink.bomLinkSpecSheetExtra_new = 'true';
          } else if (newVal === 'No') {
            bomLink.bomLinkSpecSheetExtra_new = 'false';
          } else {
            bomLink.bomLinkSpecSheetExtra_new = newVal;
          }
        }

        if (editedFieldsForRow.has('bomLinkIncludeInSpecSheet')) {
          const currentVal = String(originalValues.bomLinkIncludeInSpecSheet || '');
          const newVal = String(currentRow.bomLinkIncludeInSpecSheet || '');
          bomLink.bomLinkIncludeInSpecSheet_old = includeInSpecSheetMap[currentVal] || currentVal;
          bomLink.bomLinkIncludeInSpecSheet_new = includeInSpecSheetMap[newVal] || newVal;
        }

        if (editedFieldsForRow.has('bomLinkStartDate') || editedFieldsForRow.has('startDate')) {
          const currentStartDate =
            originalValues.bomLinkStartDate || originalValues.startDate || '';
          const newStartDate = currentRow.bomLinkStartDate || currentRow.startDate || '';
          bomLink.bomLinkStartDate_old =
            this.utilService.convertDateToApiFormat(currentStartDate);
          bomLink.bomLinkStartDate_new = this.utilService.convertDateToApiFormat(newStartDate);
        }

        if (editedFieldsForRow.has('bomLinkEndDate') || editedFieldsForRow.has('endDate')) {
          const currentEndDate = originalValues.bomLinkEndDate || originalValues.endDate || '';
          const newEndDate = currentRow.bomLinkEndDate || currentRow.endDate || '';
          bomLink.bomLinkEndDate_old = this.utilService.convertDateToApiFormat(currentEndDate);
          bomLink.bomLinkEndDate_new = this.utilService.convertDateToApiFormat(newEndDate);
        }

        if (editedFieldsForRow.has('quantity') || editedFieldsForRow.has('qty')) {
          const currentQuantityRaw = originalValues.quantity || originalValues.qty || '';
          const newQuantityRaw = currentRow.quantity || currentRow.qty || '';
          bomLink.quantity_old = this.utilService.formatQuantityToString(currentQuantityRaw);
          bomLink.quantity_new = this.utilService.formatQuantityToString(newQuantityRaw);
        }

        if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
          const filteredSkus = row.allSkus.filter((originalSku: any) =>
            allowedSkuIds.has(String(originalSku.skuId))
          );
          bomLink.skus = filteredSkus.map((originalSku: any) => {
            const skuFieldName = `sku${originalSku.skuId}`;
            const currentValue = row[skuFieldName];

            return {
              ...originalSku,
              value:
                currentValue !== undefined && currentValue !== null
                  ? String(currentValue)
                  : originalSku.value || '',
            };
          });
        } else {
          bomLink.skus = this.buildSkusArrayFromRow(
            row,
            skuInfo,
            rowData,
            originalApiData || undefined
          );
        }
      } else {
        return;
      }

      if (isEbom && isEdited) {
        const editedFieldsForRow = editedFields.get(rowId) || new Set<string>();
        const hasNonServiceEdit = [...editedFieldsForRow].some((f) => !ebomServiceFieldsSet.has(f));
        if (!hasNonServiceEdit) return;
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
      if (sku.skuId && allowedSkuIds.has(String(sku.skuId))) {
        uniqueSkusMap.set(sku.skuId, { ...sku });
      }
    });

    instances.forEach((instance) => {
      const bomLink = instance[BOM_LINK_KEY];
      if (bomLink.skus && Array.isArray(bomLink.skus)) {
        bomLink.skus.forEach((sku: any) => {
          if (sku.skuId && allowedSkuIds.has(String(sku.skuId))) {
            if (!uniqueSkusMap.has(sku.skuId)) {
              uniqueSkusMap.set(sku.skuId, { ...sku });
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
