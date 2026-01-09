import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { UtilService } from './util.service';

@Injectable({
  providedIn: 'root',
})
export class PayloadTransformService {
  constructor(
    private dataService: DataService,
    private utilService: UtilService
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
  buildSkusArrayFromRow(row: any, skuInfo: any[], rowData: any[]): any[] {
    const skus: any[] = [];
    const isNewRow = row.isNewRow;

    if (isNewRow) {
      const hasSkuValue = (v: any) => {
        if (v === undefined || v === null) return false;
        const s = String(v).trim();
        return s !== '';
      };

      // NEW LOGIC: Check if same bomLinkFeature exists in same section
      let matchingRows: any[] = [];
      if (row.section && row.bomLinkFeature) {
        
        // Search through rowData hierarchy for ALL matching rows
        const findAllMatchingRows = (rows: any[]): any[] => {
          let matches: any[] = [];
          for (const r of rows) {
            // OPTIMIZATION: Prune search if this branch belongs to a different section
            if (r.section && r.section !== row.section) {
              continue;
            }

            // Check data rows (not headers)
            if ((r.isDirectRow || r.isSubRow) && !r.isNewRow) {
              const isSectionMatch = r.section === row.section;
              const isFeatureMatch = r.bomLinkFeature === row.bomLinkFeature;
              const isPartMatch = !r.partNumber || String(r.partNumber).trim() === '';

              if (isSectionMatch && isFeatureMatch && isPartMatch) {
                matches.push(r);
              }
            }
            // Recursively check children
            if (r.children && r.children.length > 0) {
              const childMatches = findAllMatchingRows(r.children);
              matches = matches.concat(childMatches);
            }
          }
          return matches;
        };

        matchingRows = findAllMatchingRows(rowData);
      }

      const hasMatchingRows = matchingRows.length > 0;
      if (hasMatchingRows) {
        console.log(`[SKU BUILDER] Found ${matchingRows.length} matching rows for new row.`);
      }

      // Check if any entered SKU value exists unconditionally
      let hasAnySkuValue = false;
      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];
        if (hasSkuValue(skuValue)) {
          hasAnySkuValue = true;
        }
      });

      // Process SKUs from the skuInfo list based on input values
      skuInfo.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const skuValue = row[skuFieldName];

        // Apply standard logic: Include matches only if they have a value, OR if no values were entered at all
        if (!hasAnySkuValue || hasSkuValue(skuValue)) {
          
          let existingSku: any = null;

          // Condition 4: SKU ID Match (Search in ALL matching rows)
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

          if (existingSku) {
            console.log(`   SKU ${sku.skuId}: Reusing attributes from matching row.`);
            skus.push({
              ...existingSku,
              value: String(skuValue || '')
            });
          } else {
             if (hasSkuValue(skuValue)) {
                 console.log(`   SKU ${sku.skuId}: No matching existing SKU found. Using default attributes.`);
             }
            skus.push({
              ...sku,
              value: String(skuValue || ''),
            });
          }
        }
      });
    } else {
      // For existing/edited rows: Use original SKUs from row.allSkus (from API/mock.json)
      if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
        row.allSkus.forEach((originalSku: any) => {
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
      } else {
        // Fallback: Build from skuInfo if allSkus not available
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
      }
    }

    return skus;
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
   * @returns Complete API payload object
   */
  transformGridDataToApiFormat(
    rowData: any[],
    displayData: any[],
    editedRows: Set<string | number>,
    editedFields: Map<string | number, Set<string>>,
    originalRowValues: Map<string | number, any>,
    constraintsData: any
  ): any {
    const instances: any[] = [];
    const skuInfo = this.dataService.getSkuInfo();
    const bomType =
      this.dataService.getBomTypeFromResponse() || this.dataService.getBomType() || 'MBOM';
    
    // Get mapping for IncludeInSpecSheet (Display -> Internal)
    const includeInSpecSheetMap = this.dataService.getIncludeInSpecSheetMapping(constraintsData);

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

      const rowId = row.newRowId || row.materialKey || row.partNumber || row.part || '';
      const isNewRow = row.isNewRow === true;
      const isEdited = editedRows.has(rowId);

      const bomLink: any = {};

      if (isNewRow) {
        // NEW ROW: Include all required fields
        if (row.section) {
          bomLink.section = row.section;
        }

        const quantityValue =
          row.quantity !== undefined && row.quantity !== null && row.quantity !== ''
            ? row.quantity
            : row.qty !== undefined && row.qty !== null && row.qty !== ''
            ? row.qty
            : null;

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
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(String(row.bomLinkStartDate));
        } else if (row.startDate) {
          bomLink.bomLinkStartDate = this.utilService.convertDateToApiFormat(String(row.startDate));
        }

        if (row.bomLinkEndDate) {
          bomLink.bomLinkEndDate = this.utilService.convertDateToApiFormat(String(row.bomLinkEndDate));
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
          bomLink.bomLinkSpecSheetExtra = val === 'Yes' ? 'true' : val === 'No' ? 'false' : val;
        }

        if (row.bomLinkIncludeInSpecSheet) {
          const val = String(row.bomLinkIncludeInSpecSheet);
          bomLink.bomLinkIncludeInSpecSheet = includeInSpecSheetMap[val] || val;
        }

        bomLink.skus = this.buildSkusArrayFromRow(row, skuInfo, rowData);
      } else if (isEdited) {
        // EXISTING ROW WITH EDITS
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

        if (editedFieldsForRow.has('bomLinkSpecSheetExtra')) {
          const currentVal = String(originalValues.bomLinkSpecSheetExtra || '');
          const newVal = String(row.bomLinkSpecSheetExtra || '');
          
          if (currentVal !== newVal) {
            bomLink.bomLinkSpecSheetExtra_old = currentVal === 'Yes' ? 'true' : currentVal === 'No' ? 'false' : currentVal;
            bomLink.bomLinkSpecSheetExtra_new = newVal === 'Yes' ? 'true' : newVal === 'No' ? 'false' : newVal;
          }
        }

        if (editedFieldsForRow.has('bomLinkIncludeInSpecSheet')) {
          const currentVal = String(originalValues.bomLinkIncludeInSpecSheet || '');
          const newVal = String(row.bomLinkIncludeInSpecSheet || '');
          
          if (currentVal !== newVal) {
            bomLink.bomLinkIncludeInSpecSheet_old = includeInSpecSheetMap[currentVal] || currentVal;
            bomLink.bomLinkIncludeInSpecSheet_new = includeInSpecSheetMap[newVal] || newVal;
          }
        }

        if (editedFieldsForRow.has('bomLinkStartDate') || editedFieldsForRow.has('startDate')) {
          const currentStartDate = originalValues.bomLinkStartDate || originalValues.startDate || '';
          const newStartDate = row.bomLinkStartDate || row.startDate || '';
          if (currentStartDate !== newStartDate) {
            bomLink.bomLinkStartDate_old = this.utilService.convertDateToApiFormat(currentStartDate);
            bomLink.bomLinkStartDate_new = this.utilService.convertDateToApiFormat(newStartDate);
          }
        }

        if (editedFieldsForRow.has('bomLinkEndDate') || editedFieldsForRow.has('endDate')) {
          const currentEndDate = originalValues.bomLinkEndDate || originalValues.endDate || '';
          const newEndDate = row.bomLinkEndDate || row.endDate || '';
          if (currentEndDate !== newEndDate) {
            bomLink.bomLinkEndDate_old = this.utilService.convertDateToApiFormat(currentEndDate);
            bomLink.bomLinkEndDate_new = this.utilService.convertDateToApiFormat(newEndDate);
          }
        }

        if (editedFieldsForRow.has('quantity') || editedFieldsForRow.has('qty')) {
          const currentQuantity = originalValues.quantity || '';
          const newQuantity = row.quantity || row.qty || '';
          if (currentQuantity !== newQuantity) {
            bomLink.quantity_old = this.utilService.formatQuantityToString(currentQuantity);
            bomLink.quantity_new = this.utilService.formatQuantityToString(newQuantity);
          }
        }

        if (row.allSkus && Array.isArray(row.allSkus) && row.allSkus.length > 0) {
          bomLink.skus = row.allSkus.map((originalSku: any) => {
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
          bomLink.skus = this.buildSkusArrayFromRow(row, skuInfo, rowData);
        }
      } else {
        return;
      }

      instances.push({
        'bom-link': bomLink,
      });
    };

    rowData.forEach((row) => processRow(row));

    // Process new rows from displayData not yet in hierarchy
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

    // Build final payload
    const apiData = this.dataService.getApiData();
    const bomPartInfo = this.dataService.getBomPartInfo();
    const columnsRaw = this.dataService.getColumnMapping();
    const sectionOrder = apiData?.sectionOrder || [];
    const skuInfoData = Array.isArray(apiData?.skuInfo) ? apiData!.skuInfo : [];

    const columns: { [key: string]: string } = {};
    if (columnsRaw) {
      Object.keys(columnsRaw).forEach((key) => {
        if (key === 'materialColorThirtyCharacterDescription') {
          columns['partThirtyCharacterDescription'] = columnsRaw[key];
        } else if (key === 'materialColorSixtyCharacterDescription') {
          columns['partSixtyCharacterDescription'] = columnsRaw[key];
        } else {
          columns[key] = columnsRaw[key];
        }
      });
    }

    const uniqueSkusMap = new Map<string, any>();

    skuInfoData.forEach((sku: any) => {
      if (sku.skuId) {
        uniqueSkusMap.set(sku.skuId, { ...sku });
      }
    });

    instances.forEach((instance) => {
      const bomLink = instance['bom-link'];
      if (bomLink.skus && Array.isArray(bomLink.skus)) {
        bomLink.skus.forEach((sku: any) => {
          if (sku.skuId) {
            if (!uniqueSkusMap.has(sku.skuId)) {
              uniqueSkusMap.set(sku.skuId, { ...sku });
            }
          }
        });
      }
    });

    const finalSkuInfo = Array.from(uniqueSkusMap.values());

    const skuIds = apiData?.skuIds || '';

    return {
      bomCheckIn: 'true',
      bomType: bomType,
      bomPartInfo: Array.isArray(bomPartInfo) ? bomPartInfo : bomPartInfo ? [bomPartInfo] : [],
      instances: instances,
      columns: columns,
      sectionOrder: sectionOrder,
      skuIds: skuIds,
      skuInfo: finalSkuInfo,
    };
  }
}
