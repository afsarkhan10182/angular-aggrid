# Hardcoded Fields & Values – Full Codebase Audit

This document lists **every** hardcoded field name, value, label, and literal found in the codebase (excluding `constants.ts` and environment configs). Use it to move to property/constant entries.

---

## 1. `src/app/app.ts`

### Field names (column/row keys)
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 396-397 | `'actions'`, `'bomLinkFeature'` | `COL_ACTIONS`, `FIELD_BOM_LINK_FEATURE` |
| 410 | `'bomLinkFeature'` | `FIELD_BOM_LINK_FEATURE` |
| 481 | `'checkbox'` | `COL_CHECKBOX` |
| 533-536 | `ptcbomPartMarkUp`, `bomLinkSpecSheetExtra`, `'No'` | `ENUM_MBOM_LINE_ITEM`, `FIELD_SPEC_SHEET_EXTRA`, `VALUE_SPEC_NO` |
| 567 | `'feature'`, `'bomLinkFeature'` | `FIELD_FEATURE`, `FIELD_BOM_LINK_FEATURE` |
| 571 | `'bomLinkCountryOfOrigin'` | `FIELD_BOM_LINK_COUNTRY_OF_ORIGIN` |
| 615 | `'bomLinkCountryOfOrigin'` | (same) |
| 635 | `'bomLinkSpecSheetExtra'` | `FIELD_BOM_LINK_SPEC_SHEET_EXTRA` |
| 679 | `'bomLinkSpecSheetExtra'` | (same) |
| 689 | `['', 'Yes', 'No']` | Use constants for Yes/No + empty |
| 701 | `'bomLinkIncludeInSpecSheet'` | `FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET` |
| 745 | `'bomLinkIncludeInSpecSheet'` | (same) |
| 774 | `'ptcbomPartMarkUpDisplayName'` | `FIELD_PTCBOM_PART_MARK_UP_DISPLAY_NAME` |
| 825 | `'bomLinkPart'`, `'partNumber'` | `FIELD_BOM_LINK_PART`, `FIELD_PART_NUMBER` |
| 840 | `'partNumber'` | `FIELD_PART_NUMBER` |
| 854-856 | `materialColorServiceSubstituteOne/Two`, `materialColorServiceEquivalent` | Already in `PARTS_EDIT_MODAL_DROPDOWN_FIELDS` – use constant |
| 864 | `'material'`, `'materialDescription'` | `FIELD_MATERIAL`, `FIELD_MATERIAL_DESCRIPTION` |
| 873-874 | `'quantity'`, `'agNumberCellEditor'` | `FIELD_QUANTITY`, optional `CELL_EDITOR_NUMBER` |
| 919-922 | `'colorDescription'`, `'color'` | `FIELD_COLOR_DESCRIPTION`, `FIELD_COLOR` |
| 969 | `'bomLinkStartDate'`, `'bomLinkEndDate'` | `FIELD_BOM_LINK_START_DATE`, `FIELD_BOM_LINK_END_DATE` |
| 971 | `'agDateCellEditor'` | optional `CELL_EDITOR_DATE` |
| 1298 | `'sku'`, `'actions'` (startsWith) | `COL_ACTIONS`, prefix for sku |
| 1599, 1611, 1628 | `'bomLinkFeature'` | `FIELD_BOM_LINK_FEATURE` |
| 1821 | `'actions'` | `COL_ACTIONS` |
| 1826 | `'material'`, `'materialDescription'` | (same as above) |
| 1911-1915 | `'material'`, `'materialDescription'`, `'colorDescription'` | (same) |
| 1928 | `'bomLinkPart'`, `'partNumber'` | (same) |
| 2001 | `'actions'`, `'sku'` | `COL_ACTIONS` |
| 2003-2007 | `'bomLinkStartDate'`, `'bomLinkEndDate'`, `'bomLinkSpecSheetExtra'`, `'bomLinkIncludeInSpecSheet'`, `'materialDescription'`, `'material'` | Use field constants |
| 2086 | `'bomType'`, `'EBOM'` | URL param key + `BOM_TYPE_EBOM` |
| 2109, 2243 | `['actions']` | `[COL_ACTIONS]` or `EXCLUDED_COLUMNS_REFRESH` |
| 3354 | `['actions']` | `EXCLUDED_FIELDS_EXPORT` or same as above |

### UI / notification messages & types
| Line(s) | Literal | Suggested constant |
|--------|--------|--------------------|
| 155 | `'showExpiredData'` (localStorage key) | `LS_KEY_SHOW_EXPIRED_DATA` |
| 317 | `'error'` (notification type) | `NOTIFICATION_TYPE_ERROR` |
| 1893, 1895 | `'success'`, `'error'` | `NOTIFICATION_TYPE_*` |
| 2098 | `'Save is disabled in view-only mode.'`, `'info'` | Message key + `NOTIFICATION_TYPE_INFO` |
| 2205 | `'Unknown'` (rowId fallback) | `ROW_ID_UNKNOWN` |
| 2296, 2315 | `'error'` | `NOTIFICATION_TYPE_ERROR` |
| 3282, 3287 | `'success'`, `'error'`, `'error-persistent'`, `'info'` | Notification type constants |
| 3377 | `'rows'`, `'row'` | `LABEL_ROWS`, `LABEL_ROW` |
| 3382 | `'success'` | `NOTIFICATION_TYPE_SUCCESS` |
| 3385 | `'Error exporting to Excel. Please try again.'`, `'error'` | Message constant + type |

### Other
| Line(s) | Literal | Note |
|--------|--------|------|
| 2078-2086 | `'BOMComposer.jsp'`, `'ids'`, `'bomType'`, `'EBOM'` | JSP name + URL params; use `BOM_TYPE_EBOM` for value |

---

## 2. `src/app/services/data.service.ts`

### Field names / API attributes
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 136 | `'CSRF_NONCE'` (header) | `HEADER_CSRF_NONCE` |
| 237 | `'partNumber'`, `'ptcmaterialName'` | `ATTR_PART_NUMBER`, `ATTR_PTCMATERIAL_NAME` (search) |
| 267 | `String.raw\`Business Object\\bomFeature\`` | Flex type name – consider constant |
| 272 | `'bomLinkFeature'` | `FIELD_BOM_LINK_FEATURE` |
| 283 | `'Country'`, `'name'`, `'bomLinkCountryOfOrigin'` | Flex type + attribute + field |
| 298 | `'partNumber'` | `FIELD_PART_NUMBER` |
| 292-293 | `String.raw\`Revisable Entity\\sku...\`` | Flex type – constant |
| 338 | `/Windchill/servlet/rest/trek/instances` | API path (env or constant) |
| 394 | `getServiceHostUrl()` + path | (path segment constant) |
| 452 | `'/api/updateBom'` | Mock path – already env-related |
| 236, 582 | `'/api/serviceDataModal.json'` (fallback) | Move to `environment.mockApiEndpoints` or `MOCK_API_SERVICE_DATA_MODAL_PATH` |
| 441 | `500` (HTTP status compare) | Optional `HTTP_STATUS_INTERNAL_SERVER_ERROR` |
| 477 | `'partNumber'`, `'com.lcs.wc.material.LCSMaterialColor'` | Comment + typeId constant |
| 484 | `'com.lcs.wc.material.LCSMaterial'` | typeName in payload |
| 521-522 | `'partNumber'`, `'material'` (instance keys) | Response mapping |
| 571-575 | `materialColorServiceEquivalent`, `materialColorServiceSubstituteOne/Two` | Use `PARTS_EDIT_MODAL_DROPDOWN_FIELDS` or constant |
| 713 | `'api/IncludeInSpecSheet.json'` | Mock path |
| 714 | `/Windchill/servlet/rest/tm/types/.../bomLinkIncludeInSpecSheet` | API path constant |

### Messages & labels
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 404 | `'Failed to load BOM data. Please try again.'` | `MSG_LOAD_BOM_FAILED` |
| 411-422 | `'Failed to load BOM data: ...'`, `'Server error (500)'` | Message constants |
| 384 | `'Material colors saved (mock)'` | Mock message constant |
| 774-785 | SKU filter labels: `'ALL - View only'`, `'HD source - Editable'`, etc. | `MBOM_SKU_FILTER_LABELS`, `SBOM_SKU_FILTER_LABELS` |
| 814-824 | `emptyMessage` strings for HD / non-HD / editable | Same as above or message constants |
| 879-891 | `getSkuFilterEmptyMessage` messages | Message constants |
| 906 | `'All'` (fallback label) | `LABEL_ALL` |

### BOM type comparisons
| Line(s) | Literal | Use existing |
|--------|--------|--------------|
| 795 | `BOM_TYPE_EBOM`, `BOM_TYPE_MATERIALMBOM` | Already from constants |
| 804 | `'mbom'`, `'sbom'` (internal) | Optional `BOM_TYPE_MBOM_LOWER`, etc. |

---

## 3. `src/app/services/validation.service.ts`

### Field keys & labels (defaultRequiredFields)
| Line(s) | Literal | Note |
|--------|--------|------|
| 53-62 | `bomLinkFeature`, `materialDescription`, `supplier`, `colorDescription`, `partNumber`, `bomLinkStartDate`, `bomLinkEndDate`, `quantity`, `bomLinkSpecSheetExtra`, `bomLinkIncludeInSpecSheet` + labels | Align with `REQUIRED_FIELDS_FOR_SAVE` in constants or single source |

### Enum / duplicate types
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 23-28 | `'enumMBOM001'`, `'notEnumMBOM001'`, `'sbom'`, `'feature-uniqueness'`, `'duplicate-feature'`, `'duplicate-part'` | `DUPLICATE_TYPE_*`, `ENUM_MBOM_001` |
| 494, 500, 511, 546-551, 559, 709, 725, 744, 879-884, 926, 930, 936, 942, 982-983, 997, 1015, 1028-1029, 1035, 1043-1050, 1069, 1072-1077 | `'enumMBOM001'`, `'No'`, `'false'`, duplicateType values, error messages | Centralize in constants |

### Messages
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 189, 245, 314, 357, 365, 374, 385, 428, 1059, 1159, 1167 | `'Unknown'` | `ROW_ID_UNKNOWN` |
| 195, 434 | `'row'`, `'rows'` | `LABEL_ROW`, `LABEL_ROWS` |
| 252 | `'Cannot save: Some rows have missing required fields.'` | `MSG_VALIDATION_REQUIRED_FIELDS` |
| 348 | `'No SKUs selected in row'` | `MSG_NO_SKUS_SELECTED` |
| 378-379, 389 | SKU error message fragments | Message constants |
| 427 | `['SKU selection']` | `MISSING_FIELD_SKU_SELECTION` |
| 691 | `Duplicate feature "..."` template | Message template constant |
| 332-410, 458 | Template strings like `Row ${rowId}: ...` and `Cannot save: no SKU selected.` | Centralize as `MSG_*` templates or i18n keys |
| 983 | `'Duplicate part for the same SKU.'` | `MSG_DUPLICATE_PART_SKU` |
| 1029, 1044, 1050 | Duplicate feature/section messages | Message constants |
| 1069, 1076-1077 | `'Duplicate Part for the chosen Feature and SKU'`, etc. | Message constants |

---

## 4. `src/app/services/grid.service.ts`

### Column / field names
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 106 | `BOM_TYPE_SBOM` | Already from constants |
| 109 | `'enumMBOM001'` | `ENUM_MBOM_LINE_ITEM` or `PTCBOM_PART_MARK_UP_MBOM` |
| 112-113 | `'bomLinkSpecSheetExtra'`, `'No'` | Field + `VALUE_SPEC_NO` |
| 477-478 | `'checkbox'`, `'checkbox'` (field, colId) | `COL_CHECKBOX` |
| 502-503 | `'actions'`, `'actions'` | `COL_ACTIONS` |
| 584-585, 612, 620 | `'bomLinkFeature'` | `FIELD_BOM_LINK_FEATURE` |
| 651 | `'ptcbomPartMarkUpDisplayName'` | `FIELD_PTCBOM_PART_MARK_UP_DISPLAY_NAME` |
| 842, 881 | `'checkbox'` | `COL_CHECKBOX` |

### UI strings
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 520 | `'Expired'` (title) | `TITLE_EXPIRED` |
| 534 | `'Required field error'` | `TITLE_REQUIRED_FIELD_ERROR` |
| 535 | `'Required field'` (aria-label) | `ARIA_REQUIRED_FIELD` |
| 540, 556 | `'Delete'`, `'Add'` (title) | `TITLE_DELETE_ROW`, `TITLE_ADD_ROW` |
| 581 | `'Feature'` (headerName) | `HEADER_FEATURE` |
| 627 | `'search BOM features...'` | `PLACEHOLDER_SEARCH_BOM_FEATURES` |

---

## 5. `src/app/services/grid-config.service.ts`

### Field names (arrays and comparisons)
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 718 | `['bomLinkStartDate', 'bomLinkEndDate', 'quantity']` | Use `EBOM_CORE_FIELDS` or new list |
| 721 | `'enumMBOM001'` | `ENUM_MBOM_LINE_ITEM` |
| 725 | `'bomLinkIncludeInSpecSheet'` | `FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET` |
| 729-737 | Same + editableFields array | Centralize editable field list |
| 753 | `'bomLinkFeature'` | `FIELD_BOM_LINK_FEATURE` |
| 759, 763, 768 | `'bomLinkSpecSheetExtra'`, `'bomLinkFeature'`, `'bomLinkIncludeInSpecSheet'` | Field constants |
| 771-785 | Full list of editable fields for new row | Already partially in constants – use `EDITABLE_*` / new list |

---

## 6. `src/app/services/payload-transform.service.ts`

### Yes/No and boolean mapping
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 497-502 | `'Yes'` → `'true'`, `'No'` → `'false'` | `VALUE_SPEC_YES`, `VALUE_SPEC_NO`, `API_TRUE`, `API_FALSE` |
| 565-578 | Same for _old / _new | (same) |
| 573-575 | `'Yes'`, `'No'` | (same) |

### Field names
| Line(s) | Literal | Use constants |
|--------|--------|---------------|
| 119, 139 | `ptcbomPartMarkUp`, `'enumMBOM001'` | `ENUM_MBOM_LINE_ITEM` |
| 341 | `'enumMBOM001'` | (same) |
| 446 | `'enumMBOM001'` (assignment) | (same) |
| 543-544, 561-562, 582-586, 589, 598, 605 | `partNumber`, `bomLinkPart`, `bomLinkSpecSheetExtra`, `bomLinkIncludeInSpecSheet`, `bomLinkStartDate`, `bomLinkEndDate`, `quantity`, `qty` | Field constants |

---

## 7. `src/app/services/mass-edit.service.ts`

### Field names
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 94, 100 | `['bomLinkStartDate']`, `['bomLinkEndDate']` | Use date/quantity field constants |
| 133, 208, 237, 397 | `'enumMBOM001'` (ptcbomPartMarkUp) | `ENUM_MBOM_LINE_ITEM` |
| 148 | `['bomLinkIncludeInSpecSheet']` | `FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET` |
| 160 | `['quantity']` | `FIELD_QUANTITY` |
| 291, 299, 302 | `'checkbox'`, `'actions'` | `COL_CHECKBOX`, `COL_ACTIONS` |
| 329, 338 | `['bomLinkStartDate']`, `['bomLinkEndDate']` | (same as above) |
| 374, 407, 439-441, 446-448, 450 | `['quantity']`, `['bomLinkIncludeInSpecSheet']`, date fields | Use shared field arrays |

---

## 8. `src/app/services/row-management.service.ts`

### Field names & default values
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 16 | `'lastSavedAt'` (localStorage) | `LS_KEY_LAST_SAVED_AT` |
| 48, 723 | Same | (same) |
| 98-99 | `'Yes'`, `''` (bomLinkSpecSheetExtra, bomLinkIncludeInSpecSheet) | `VALUE_SPEC_YES` + empty |
| 327, 334 | `'quantity'`, `'qty'` | `FIELD_QUANTITY`, alias |
| 347-350 | `'startDate'`, `'endDate'`, `'bomLinkStartDate'`, `'bomLinkEndDate'` | Date field constants |
| 371-379 | `partNumber`, `part`, `bomLinkPart`, `bomLinkFeature`, etc. | Use `REQUIRED_FIELDS_FOR_SAVE` keys / field constants |
| 518-522, 523, 531 | Columns to refresh / date fields | Field constants |

### Notification types
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 827, 832 | `'success'`, `'error'`, `'error-persistent'`, `'info'` | Notification type constants |

### Status codes, messages, and timing "magic numbers"
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 36 | `nextRowId = 10000` | `NEW_ROW_START_ID` (or keep as-is if not reused) |
| 142-150, 245-255 | `setTimeout(..., 50)` | `UI_REFRESH_DELAY_MS` |
| 509-518, 588-594, 757-763 | `setTimeout(..., 100)` | `UI_REFRESH_DELAY_MS_LONG` |
| 858-861 | `setTimeout(..., 3000)` | `NOTIFICATION_AUTO_CLEAR_MS` |
| 143 | `currentFirstVisibleRow - 2`, `currentLastVisibleRow + 2` | `VISIBLE_ROW_BUFFER` |
| 783-798 | `400/401/403/404/500` and hardcoded `Failed to save: ...` strings | Optional `HTTP_STATUS_*` constants + `MSG_SAVE_FAILED_*` |
| 613, 646, 676, 698 | `'No changes to save'`, `'No payload to save'`, `'Successfully saved changes!'` | `MSG_SAVE_*` constants (if user-facing) |

---

## 9. `src/app/services/util.service.ts`

### Field names & export
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 232 | `['actions']` (excludedFields) | `EXCLUDED_FIELDS_EXPORT` |
| 248 | `'Section'` (Excel header) | `EXCEL_HEADER_SECTION` |
| 259 | `'!cols'` | XLSX internal – can stay |
| 282 | `'hasLinkedBom'` (excluded search) | Optional constant |
| 296 | `'actions'` | `COL_ACTIONS` |
| 505 | `BOM_TYPE_SBOM`, `BOM_TYPE_MBOM` (comment) | Already constants |
| 565 | `'actions'` | `COL_ACTIONS` |

### Defaults
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 234 | `'BOM Export'` (sheetName) | `EXCEL_SHEET_NAME` |
| 261 | `BOM_Composer_Export_...` (fileName pattern) | `EXCEL_FILE_NAME_PREFIX` or keep in one place |

### Style tokens & "magic numbers"
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 130 | `textStr.length * 9 + 16` | `AVG_CHAR_WIDTH_PX`, `CELL_PADDING_PX` (or document why) |
| 150-154 | Inline `<span style="...">` string fragments | Consider a small helper or CSS class if reused |
| 330-448 | Hex colors, border widths, fontWeight strings in row style helpers | Consider shared style constants or move to CSS theme tokens |
| 852-854 | `{ wch: 20 }`, `{ wch: 15 }` | `EXCEL_COL_WIDTH_SECTION`, `EXCEL_COL_WIDTH_DEFAULT` |
| 284-306 | `getExcludedSearchFields()` has many hardcoded row meta keys | Optional `EXCLUDED_SEARCH_FIELDS` constant (Set) |

---

## 10. `src/app/services/session.service.ts`

| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 100 | `'CSRF_NONCE'` (header) | `HEADER_CSRF_NONCE` (shared with data.service) |

---

## 11. `src/app/components/autocomplete-cell-editor/autocomplete-cell-editor.component.ts`

### Field names
| Line(s) | Literal | Use constants |
|--------|--------|---------------|
| 77 | `'colorDescription'` | `FIELD_COLOR_DESCRIPTION` |
| 302-303, 306, 308 | `'bomLinkPart'`, `'partNumber'`, `'bomLinkFeature'`, `'bomLinkCountryOfOrigin'` | Field constants |
| 311-313 | `materialColorServiceSubstituteOne/Two`, `materialColorServiceEquivalent` | Already in constants |
| 323 | `'material'`, `'materialDescription'` | Field constants |
| 648, 675 | `'bomLinkFeature'`, `'bomLinkFeatureId'`, `'feature'` | Field constants |
| 712 | `'partNumber'`, `'bomLinkPart'` | (same) |
| 740-742, 744 | `'materialDescription'`, `'partNumber'`, `'bomLinkPart'`, `'color'`, `'colorDescription'`, `'supplier'` | (same) |
| 777, 780 | `'materialDescription'`, `'colorDescription'` | (same) |
| 862, 866, 931-935, 1067, 1210, 1225, 1319, 1331 | Various field names for setDataValue / refresh | Use same field constants |
| 1359 | `['color', 'colorDescription', 'supplier']` | Array constant |

### Placeholders / UI
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 177 | `'search services...'` (parts-edit-modal) | Already in parts-edit-modal – share constant |

---

## 12. `src/app/components/part-modal/part-modal.component.ts`

| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 27, 30-31 | `'feature'`, `'startDate'`, `'endDate'` | Field constants (for display keys) |
| 85 | `'hasLinkedBom'` | Optional constant |

---

## 13. `src/app/components/parts-edit-modal/parts-edit-modal.component.ts`

### Field names
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 147-148 | `'partNumber'`, `'materialColorStatus'` | `FIELD_PART_NUMBER`, `FIELD_MATERIAL_COLOR_STATUS` |
| 191 | `'partNumber'` | `FIELD_PART_NUMBER` |
| 276-278 | `materialColorServiceEquivalent`, `materialColorServiceSubstituteOne/Two` | Use `PARTS_EDIT_MODAL_DROPDOWN_FIELDS` |
| 441, 940, 955 | `'errorIndicator'` | `COL_ERROR_INDICATOR` (if used elsewhere) |

### UI
| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 177 | `'search services...'` | `PLACEHOLDER_SEARCH_SERVICES` |

---

## 14. `src/app/components/column-header-pin/column-header-pin.component.ts`

| Line(s) | Literal | Suggested constant |
|--------|---------|--------------------|
| 442, 452 | `'actions'`, `'checkbox'` | `COL_ACTIONS`, `COL_CHECKBOX` |

---

## 15. `src/app/app.html`

All user-facing strings (placeholders, labels, titles, aria-labels) are in HTML. Examples to consider for i18n or constants:

- `"Search All Columns"`, `"Clear search"`, `"Search"`
- `"SKU Views:"`, `"SKU filter dropdown"`, `"SKU filter options"`
- `"Show Expired:"`, `"Actions"`, `"Export"`, `"Mass Edit Selected Rows"`, etc.
- `"Start Date"`, `"End Date"`, `"Quantity"`, `"Include In Spec Sheet"`
- `"Select more than 1 row to enable Mass Edit"`

These can stay in template or move to a labels/constants file for consistency.

---

## 16. `src/styles.css` & `src/app/app.css` & component CSS

- Selectors use `col-id='actions'`, `col-id='checkbox'`, `col-id='bomLinkPart'`, `col-id='material'`, `col-id='feature'`, `col-id='startDate'`, `data-column="partNumber"`, etc.
- **Recommendation:** If you introduce column ID constants (e.g. `COL_ACTIONS`), use them when generating dynamic classes or avoid duplicating string in CSS (e.g. via data attributes from TS). Otherwise CSS can keep string selectors as-is for clarity.

---

## 17. `src/environments/environment.ts` & `environment.prod.ts`

- API paths and config live here; no change needed for “property entry” except ensuring all env-dependent URLs are in environment (already the case).

---

## Summary: Suggested New Constants (to add to `constants.ts` or a new file)

1. **Column IDs / special columns**  
   `COL_ACTIONS`, `COL_CHECKBOX`, `COL_ERROR_INDICATOR` (if needed).

2. **Field names (grid/API)**  
   Single source for: `partNumber`, `bomLinkPart`, `bomLinkFeature`, `bomLinkStartDate`, `bomLinkEndDate`, `quantity`, `bomLinkSpecSheetExtra`, `bomLinkIncludeInSpecSheet`, `bomLinkCountryOfOrigin`, `material`, `materialDescription`, `color`, `colorDescription`, `ptcbomPartMarkUpDisplayName`, etc. (many already in `REQUIRED_FIELDS_FOR_SAVE` / `EBOM_CORE_FIELDS` – reuse keys).

3. **Yes/No and API booleans**  
   `VALUE_SPEC_YES`, `VALUE_SPEC_NO`, `API_TRUE` (`'true'`), `API_FALSE` (`'false'`) for Spec Sheet / Include In Spec Sheet.

4. **MBOM enum**  
   `ENUM_MBOM_LINE_ITEM = 'enumMBOM001'` (and optionally `PTCBOM_PART_MARK_UP_MBOM`).

5. **Notification types**  
   `NOTIFICATION_TYPE_SUCCESS`, `NOTIFICATION_TYPE_ERROR`, `NOTIFICATION_TYPE_ERROR_PERSISTENT`, `NOTIFICATION_TYPE_INFO`.

6. **LocalStorage keys**  
   `LS_KEY_SHOW_EXPIRED_DATA`, `LS_KEY_LAST_SAVED_AT`.

7. **Messages**  
   All validation, save, export, and SKU filter messages in one place (or keys for i18n).

8. **Duplicate types**  
   `DUPLICATE_TYPE_ENUM_MBOM_001`, `DUPLICATE_TYPE_DUPLICATE_PART`, etc., if you want type-safe usage.

9. **Export**  
   `EXCLUDED_FIELDS_EXPORT = ['actions']`, `EXCEL_HEADER_SECTION`, `EXCEL_SHEET_NAME`, `EXCEL_FILE_NAME_PREFIX`.

10. **Misc**  
    `ROW_ID_UNKNOWN`, `HEADER_CSRF_NONCE`, `JSP_BOM_COMPOSER`, URL param names (`PARAM_BOM_TYPE`, `PARAM_IDS`).

This audit is a detailed pass over the main grid/services/components for hardcoded keys, messages, and static values. Re-run it whenever new logic is added, especially for **timeouts**, **HTTP status handling**, **mock endpoint fallbacks**, and **inline style tokens**.
