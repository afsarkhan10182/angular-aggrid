import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { UtilService } from './util.service';

@Injectable({
  providedIn: 'root',
})
export class PayloadTransformService {
  constructor(private dataService: DataService, private utilService: UtilService) {}

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

      // Resolve section: Use sectionDetails to map display name to internal ID
      // This ensures we use the correct internal section ID from mock.json/API response
      let resolvedSection = row.section || '';

      // Get sectionDetails from apiData if provided, otherwise try to get from dataService
      let sectionDetails = apiData?.sectionDetails || {};
      if (Object.keys(sectionDetails).length === 0 && this.dataService) {
        const fullApiData = this.dataService.getApiData();
        sectionDetails = fullApiData?.sectionDetails || {};
      }

      let sectionDisplayName = row.sectionDisplayName || '';

      // If not found on row, check parent chain
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

      // Map display name to internal ID using sectionDetails
      if (sectionDisplayName && Object.keys(sectionDetails).length > 0) {
        const foundInternalId = Object.keys(sectionDetails).find(
          (internalId) => sectionDetails[internalId] === sectionDisplayName
        );
        if (foundInternalId) {
          resolvedSection = foundInternalId;
        }
      }

      // PRIMARY SKU RESOLUTION: Match using Section + bomLinkFeature + partNumber + skuId
      // This matches against ALL responses in mock.json/API, including hidden SKUs and same section
      // Different sections can legally have the same bomLinkFeature, partNumber, and skuId
      // Section is part of the uniqueness boundary
      let matchingRows: any[] = [];

      // Get the feature value for matching (use display value, not ID)
      // bomLinkFeature should contain the display value like "150 | Fuselage : Compliance Label 1"
      // bomLinkFeatureId contains the ID like "bomLinkFeature-1" (used for payload only)
      const rowFeatureValue = row.bomLinkFeature || '';
      const rowPartNumber = String(row.partNumber || '').trim();
      const isEmptyPartNumber = !rowPartNumber || rowPartNumber === '';

      // Search for matching rows to find existing SKU objects
      // MATCHING RULES:
      // For SBOM: Always match by Section + Feature + PartNumber + SKU ID (all 4 must match)
      // For MBOM:
      //   1. If existing row has partNumber NOT empty AND ptcbomPartMarkUp == 'enumMBOM001'
      //      → Match by Section + Feature + SKU ID + PartNumber (all 4 must match)
      //   2. Otherwise (empty partNumber OR ptcbomPartMarkUp != 'enumMBOM001')
      //      → Match by Section + Feature + SKU ID only (no partNumber requirement)
      if (resolvedSection && rowFeatureValue) {
        const searchPart = isEmptyPartNumber ? '(empty)' : rowPartNumber;
        // Search through rowData hierarchy for ALL matching rows
        const findAllMatchingRows = (rows: any[]): any[] => {
          let matches: any[] = [];
          for (const r of rows) {
            // OPTIMIZATION: Prune search if this branch belongs to a different section
            if (r.section && r.section !== resolvedSection) {
              continue;
            }

            // Check data rows (not headers)
            if ((r.isDirectRow || r.isSubRow) && !r.isNewRow) {
              const isSectionMatch = r.section === resolvedSection;
              // Normalize bomLinkFeature for comparison (trim whitespace, handle null/undefined)
              // Existing rows have display value like "150 | Fuselage : Compliance Label 1"
              const existingFeature = String(r.bomLinkFeature || '').trim();
              const newRowFeature = String(rowFeatureValue).trim();
              const isFeatureMatch = existingFeature === newRowFeature && existingFeature !== '';

              // Determine if we need to match partNumber
              // For SBOM: Always match by Section + Feature + PartNumber + SKU ID (all 4 must match)
              // For MBOM: Match by Section + Feature + PartNumber + SKU ID only if ptcbomPartMarkUp === 'enumMBOM001'
              const existingPart = String(r.partNumber || '').trim();
              const existingHasPartNumber = existingPart !== '';
              const bomType = this.dataService.getBomType();
              const isSbom = bomType === 'SBOM';
              const isMbom = bomType === 'MBOM';

              let requiresPartMatch = false;
              if (isSbom) {
                // SBOM: Always require partNumber match
                requiresPartMatch = true;
              } else if (isMbom) {
                // MBOM: Require partNumber match only if ptcbomPartMarkUp === 'enumMBOM001'
                const existingIsEnumMBOM001 = r.ptcbomPartMarkUp === 'enumMBOM001';
                requiresPartMatch = existingHasPartNumber && existingIsEnumMBOM001;
              }

              const isPartMatch = requiresPartMatch ? existingPart === rowPartNumber : true; // Skip partNumber check for MBOM rows with ptcbomPartMarkUp !== 'enumMBOM001'

              // Match using Section + bomLinkFeature (+ PartNumber if required)
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
          // RULE: Hidden rows (ptcbomPartMarkUp === "enumMBOM001" OR empty partNumber) are backend-existing records
          // Payload must reuse existing SKU object (matched by SKU ID) for hidden rows
          // First check filtered rowData, then check original API data (including hidden rows)
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

          // If not found in filtered rows, check ALL API instances (including hidden rows)
          // Hidden rows represent existing backend records and must reuse SKU objects
          if (!existingSku && apiData && apiData.instances && Array.isArray(apiData.instances)) {
            const section = resolvedSection || '';
            const partNumber = String(row.partNumber || '').trim();
            const bomLinkFeature = String(row.bomLinkFeature || '').trim();
            const isEmptyPartNumber = !partNumber || partNumber === '';

            if (section && bomLinkFeature) {
              for (const instance of apiData.instances) {
                const bomLink = instance['bom-link'];
                if (!bomLink) continue;

                const instanceSection = bomLink.sectionInternalName || bomLink.section || '';
                const instancePart = String(bomLink.partNumber || '').trim();
                const instanceFeature = String(bomLink.bomLinkFeature || '').trim();
                const instancePtcbomPartMarkUp = bomLink.ptcbomPartMarkUp || '';

                // MATCHING RULES:
                // For SBOM: Always match by Section + Feature + PartNumber + SKU ID (all 4 must match)
                // For MBOM:
                //   1. If existing row has partNumber NOT empty AND ptcbomPartMarkUp == 'enumMBOM001'
                //      → Match by Section + Feature + SKU ID + PartNumber (all 4 must match)
                //   2. Otherwise (empty partNumber OR ptcbomPartMarkUp != 'enumMBOM001')
                //      → Match by Section + Feature + SKU ID only (no partNumber requirement)
                const isSectionMatch = instanceSection === section;
                const isFeatureMatch = instanceFeature === bomLinkFeature;
                const instanceHasPartNumber =
                  instancePart && String(instancePart).trim() !== '' ? true : false;

                // Get bomType to determine matching rules
                const bomType = this.dataService.getBomType();
                const isSbom = bomType === 'SBOM';
                const isMbom = bomType === 'MBOM';

                let requiresPartMatch = false;
                if (isSbom) {
                  // SBOM: Always require partNumber match
                  requiresPartMatch = true;
                } else if (isMbom) {
                  // MBOM: Require partNumber match only if ptcbomPartMarkUp === 'enumMBOM001'
                  const instanceIsEnumMBOM001 = instancePtcbomPartMarkUp === 'enumMBOM001';
                  requiresPartMatch = instanceHasPartNumber && instanceIsEnumMBOM001;
                }

                const isPartMatch = requiresPartMatch
                  ? String(instancePart).trim() === String(partNumber || '').trim()
                  : true; // Skip partNumber check for MBOM rows with ptcbomPartMarkUp !== 'enumMBOM001'

                // Match by Section + Feature (+ PartNumber if required)
                if (isSectionMatch && isFeatureMatch && isPartMatch) {
                  // Check if this instance has the SKU we're looking for
                  // Include hidden rows (ptcbomPartMarkUp === "enumMBOM001" OR empty partNumber)
                  if (bomLink.skus && Array.isArray(bomLink.skus)) {
                    existingSku = bomLink.skus.find((s: any) => s.skuId === sku.skuId);
                    if (existingSku) {
                      const isHiddenRow =
                        (this.dataService.getBomType() === 'MBOM' &&
                          bomLink.ptcbomPartMarkUp === 'enumMBOM001') ||
                        !instancePart ||
                        String(instancePart).trim() === '';
                      console.log(
                        `   SKU ${sku.skuId}: Found in API data (${
                          isHiddenRow ? 'hidden' : 'visible'
                        } row, Part: ${instancePart || '(empty)'}, ptcbomPartMarkUp: ${
                          instancePtcbomPartMarkUp || '(empty)'
                        })`
                      );
                      console.log(
                        `   SKU ${sku.skuId}: Reusing SKU object with attributes:`,
                        JSON.stringify(existingSku, null, 2)
                      );
                      break;
                    } else {
                    }
                  } else {
                    console.log(`   SKU ${sku.skuId}: Matched row found but no skus array present`);
                  }
                }
              }
            }
          }

          if (existingSku) {
            console.log(`   SKU ${sku.skuId}: Reusing attributes from matching row.`);
            skus.push({
              ...existingSku,
              value: String(skuValue || ''),
            });
          } else {
            if (hasSkuValue(skuValue)) {
              console.log(
                `   SKU ${sku.skuId}: No matching existing SKU found. Using default attributes.`
              );
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
    constraintsData: any,
    skuInfoOverride?: any[],
    gridApi?: any
  ): any {
    
    const instances: any[] = [];
    const skuInfo = Array.isArray(skuInfoOverride)
      ? skuInfoOverride
      : this.dataService.getSkuInfo();
    const allowedSkuIds = new Set<string>(skuInfo.map((sku: any) => String(sku.skuId)));
    const bomType = this.dataService.getBomTypeFromResponse() || this.dataService.getBomType();

    // Get original API data to check ALL rows including hidden ones for SKU matching
    const originalApiData = this.dataService.getApiData();

    // Get mapping for IncludeInSpecSheet (Display -> Internal)
    const includeInSpecSheetMap = this.dataService.getIncludeInSpecSheetMapping(constraintsData);

    // Build a map of current row data from grid API (if available) for edited rows
    const currentRowDataMap = new Map<string | number, any>();
    if (gridApi) {
      gridApi.forEachNode((node: any) => {
        if (node.data) {
          const nodeRowId = node.data.materialKey || node.data.newRowId || node.data.partNumber || node.data.part || '';
          if (nodeRowId && editedRows.has(nodeRowId)) {
            // Store the current data from grid (has latest edited values)
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

      // Use same ID resolution order as trackFieldChange
      const rowId = row.materialKey || row.newRowId || row.partNumber || row.part || '';
      const isNewRow = row.isNewRow === true;
      const isEdited = editedRows.has(rowId);
      
      // For edited rows, get current data from grid API (has latest values)
      const currentRow = isEdited && currentRowDataMap.has(rowId) 
        ? currentRowDataMap.get(rowId) 
        : row;

      const bomLink: any = {};

      if (isNewRow) {
        // NEW ROW: Include all required fields
        // Resolve section: Use sectionDetails to map display name to internal ID for missing sections
        // Backend provides sectionDetails specifically for frontend to map sectionDisplayName to internal section ID
        let resolvedSection = row.section || '';

        if (resolvedSection && resolvedSection.startsWith('__missing_section__')) {
          // Missing section detected - resolve using sectionDetails from backend
          const apiData = this.dataService.getApiData();
          const sectionDetails = apiData?.sectionDetails || {};

          // Get sectionDisplayName from row, or traverse parent chain
          let sectionDisplayName = row.sectionDisplayName || '';

          // If not found on row, check parent chain
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

          // Map display name to internal ID using sectionDetails
          // sectionDetails format: { "enumSection001": "Fuselage", "enumSection002": "Cockpit", ... }
          // We need: displayName "Cockpit" -> internalId "enumSection002"
          if (sectionDisplayName) {
            const foundInternalId = Object.keys(sectionDetails).find(
              (internalId) => sectionDetails[internalId] === sectionDisplayName
            );
            if (foundInternalId) {
              resolvedSection = foundInternalId;
              console.log(
                `[SECTION RESOLVE] Mapped "${sectionDisplayName}" -> "${foundInternalId}"`
              );
            } else {
              console.error(
                `[SECTION RESOLVE] Could not find internal ID for display name "${sectionDisplayName}" in sectionDetails. Available mappings:`,
                sectionDetails
              );
            }
          } else {
            console.error(
              `[SECTION RESOLVE] Could not determine sectionDisplayName for section "${resolvedSection}". Row:`,
              row
            );
          }
        }

        if (resolvedSection) {
          bomLink.section = resolvedSection;
        }

        // For MBOM bomType, include ptcbomPartMarkUp field in payload
        if (bomType === 'MBOM') {
          bomLink.ptcbomPartMarkUp = 'enumMBOM001';
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
          bomLink.bomLinkSpecSheetExtra = val === 'Yes' ? 'true' : val === 'No' ? 'false' : val;
        }

        if (row.bomLinkIncludeInSpecSheet) {
          const val = String(row.bomLinkIncludeInSpecSheet);
          bomLink.bomLinkIncludeInSpecSheet = includeInSpecSheetMap[val] || val;
        }

        bomLink.skus = this.buildSkusArrayFromRow(
          row,
          skuInfo,
          rowData,
          originalApiData || undefined
        );
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
          const newVal = String(currentRow.bomLinkSpecSheetExtra || '');
          bomLink.bomLinkSpecSheetExtra_old =
            currentVal === 'Yes' ? 'true' : currentVal === 'No' ? 'false' : currentVal;
          bomLink.bomLinkSpecSheetExtra_new =
            newVal === 'Yes' ? 'true' : newVal === 'No' ? 'false' : newVal;
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
      if (sku.skuId && allowedSkuIds.has(String(sku.skuId))) {
        uniqueSkusMap.set(sku.skuId, { ...sku });
      }
    });

    instances.forEach((instance) => {
      const bomLink = instance['bom-link'];
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
