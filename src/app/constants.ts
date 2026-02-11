/**
 * Application-wide constants. Manage all shared literals and field lists here.
 * Change keys or property values only in this file; all other files reference these.
 */

/** BOM types from API / data layer */
export const BOM_TYPE_EBOM = 'EBOM';
export const BOM_TYPE_MBOM = 'MBOM';
export const BOM_TYPE_SBOM = 'SBOM';
export const BOM_TYPE_MATERIALMBOM = 'MATERIALMBOM';

/** Default BOM type when API / JSP does not provide one */
export const DEFAULT_BOM_TYPE = BOM_TYPE_SBOM;

/** API payload key for BOM link object */
export const BOM_LINK_KEY = 'bom-link';

/** MBOM line item markup type (ptcbomPartMarkUp value) */
export const ENUM_MBOM_LINE_ITEM = 'enumMBOM001';

/** Spec Sheet / Include In Spec Sheet display values */
export const VALUE_SPEC_YES = 'Yes';
export const VALUE_SPEC_NO = 'No';
/** API boolean strings for payload; DISPLAY_FALSE used when comparing specSheetExtra from API */
export const API_TRUE = 'true';
export const API_FALSE = 'false';
export const DISPLAY_FALSE = 'false';

/** Notification types for save/export messages */
export const NOTIFICATION_TYPE_SUCCESS = 'success';
export const NOTIFICATION_TYPE_ERROR = 'error';
export const NOTIFICATION_TYPE_ERROR_PERSISTENT = 'error-persistent';
export const NOTIFICATION_TYPE_INFO = 'info';

/** LocalStorage keys */
export const LS_KEY_SHOW_EXPIRED_DATA = 'showExpiredData';
export const LS_KEY_LAST_SAVED_AT = 'lastSavedAt';

/** Column IDs / special columns (used in grid, export, CSS selectors) */
export const COL_ACTIONS = 'actions';
export const COL_CHECKBOX = 'checkbox';
export const COL_ERROR_INDICATOR = 'errorIndicator';

/** Grid field names – single source for column/row keys */
export const FIELD_ACTIONS = 'actions';
export const FIELD_CHECKBOX = 'checkbox';
/** Backend renamed `partNumber` field key in responses */
export const FIELD_PART_NUMBER = 'materialColorPartNumber';
export const FIELD_PART = 'part';
export const FIELD_BOM_LINK_PART = 'bomLinkPart';
export const FIELD_BOM_LINK_FEATURE = 'bomLinkFeature';
export const FIELD_FEATURE = 'feature';
export const FIELD_BOM_LINK_START_DATE = 'bomLinkStartDate';
export const FIELD_BOM_LINK_END_DATE = 'bomLinkEndDate';
export const FIELD_START_DATE = 'startDate';
export const FIELD_END_DATE = 'endDate';
export const FIELD_QUANTITY = 'quantity';
export const FIELD_QTY = 'qty';
export const FIELD_BOM_LINK_SPEC_SHEET_EXTRA = 'bomLinkSpecSheetExtra';
export const FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET = 'bomLinkIncludeInSpecSheet';
export const FIELD_BOM_LINK_COUNTRY_OF_ORIGIN = 'bomLinkCountryOfOrigin';
export const FIELD_MATERIAL = 'material';
export const FIELD_MATERIAL_DESCRIPTION = 'materialDescription';
export const FIELD_SUPPLIER = 'supplier';
export const FIELD_COLOR = 'color';
export const FIELD_COLOR_DESCRIPTION = 'colorDescription';
export const FIELD_HAS_LINKED_BOM = 'hasLinkedBom';
export const FIELD_PTCBOM_PART_MARK_UP_DISPLAY_NAME = 'ptcbomPartMarkUpDisplayName';
export const FIELD_MATERIAL_COLOR_STATUS = 'materialColorState';
export const FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT = 'materialColorServiceEquivalent';
export const FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE = 'materialColorServiceSubstituteOne';
export const FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO = 'materialColorServiceSubstituteTwo';

/** Search/API attribute names (material-colors/search request body: attributeParameters) */
export const ATTR_PART_NUMBER = 'materialColorPartNumber';
export const ATTR_PTCMATERIAL_NAME = 'ptcmaterialName';

/** HTTP header for CSRF */
export const HEADER_CSRF_NONCE = 'CSRF_NONCE';

/** JSP and URL param names */
export const JSP_BOM_COMPOSER = 'BOMComposer.jsp';
export const PARAM_BOM_TYPE = 'bomType';
export const PARAM_IDS = 'ids';

/** Row ID fallback when no key available */
export const ROW_ID_UNKNOWN = 'Unknown';

/** Export: excluded columns and defaults */
export const EXCLUDED_FIELDS_EXPORT: readonly string[] = [COL_ACTIONS];
export const EXCEL_HEADER_SECTION = 'Section';
export const EXCEL_SHEET_NAME = 'BOM Export';
export const EXCEL_FILE_NAME_PREFIX = 'BOM_Composer_Export_';

/** Duplicate validation types */
export const DUPLICATE_TYPE_ENUM_MBOM_001 = 'enumMBOM001';
export const DUPLICATE_TYPE_NOT_ENUM_MBOM_001 = 'notEnumMBOM001';
export const DUPLICATE_TYPE_SBOM = 'sbom';
export const DUPLICATE_TYPE_FEATURE_UNIQUENESS = 'feature-uniqueness';
export const DUPLICATE_TYPE_DUPLICATE_FEATURE = 'duplicate-feature';
export const DUPLICATE_TYPE_DUPLICATE_PART = 'duplicate-part';

/** Labels (row/rows, All, field labels) */
export const LABEL_ROW = 'row';
export const LABEL_ROWS = 'rows';
export const LABEL_ALL = 'All';
export const LABEL_QUANTITY = 'Quantity';

/** Feature column header */
export const HEADER_FEATURE = 'Feature';

/** Placeholders */
export const PLACEHOLDER_SEARCH_BOM_FEATURES = 'search BOM features...';
export const PLACEHOLDER_SEARCH_SERVICES = 'search services...';

/** Action cell titles */
export const TITLE_EXPIRED = 'Expired';
export const TITLE_REQUIRED_FIELD = 'Required field';
export const TITLE_REQUIRED_FIELD_ERROR = 'Required field error';
export const TITLE_DELETE_ROW = 'Delete';
export const TITLE_ADD_ROW = 'Add';

/** User-facing messages – change text here only */
export const MSG_SAVE_DISABLED_VIEW_ONLY = 'Save is disabled in view-only mode.';
export const MSG_LOAD_BOM_FAILED = 'Failed to load BOM data. Please try again.';
export const MSG_LOAD_BOM_SERVER_ERROR = 'Failed to load BOM data: Server error (500).';
export const MSG_VALIDATION_REQUIRED_FIELDS = 'Missing required fields. Hover over ⓘ to see details.';
export const MSG_NO_SKUS_SELECTED = 'No SKUs selected in row';
export const MSG_SKU_SELECTION = 'SKU selection';
export const MSG_MISSING = 'Missing';
export const MSG_SKU_ERROR = 'SKU Error';
export const MSG_DUPLICATE_PART_SKU = 'Duplicate part for the same SKU.';
export const MSG_DUPLICATE_FEATURE_SKU_SECTION = 'Duplicate feature for the same SKU and section.';
export const MSG_DUPLICATE_PART_FEATURE_SKU = 'Duplicate part for the chosen Feature and SKU';
export const MSG_DUPLICATE_FEATURE_AND_PART = 'Duplicate feature and part for the same SKU and section.';
export const MSG_DUPLICATE_PART_NUMBER_SKU = 'Duplicate part number for the same SKU. A record with the same part and SKU already exists when feature is not present.';
export const MSG_DUPLICATE_PART_NUMBER_SKU_MULTIPLE = 'Duplicate part number for the same SKU. Multiple records found with the same part and SKU when feature is not present.';
/** SBOM: duplicate Section+Part+SKU in multiple new rows (feature not used in UI) */
export const MSG_DUPLICATE_SECTION_PART_SKU = 'Duplicate part for the same SKU on the same section.';
export const MSG_DUPLICATE_FEATURE_SKU_SECTION_ONE = 'Duplicate feature for the same SKU and section. One SKU should not have more than one feature for the same section.';
export const MSG_DUPLICATE_FEATURE_FOR_SKU = 'Duplicate Feature for the chosen SKU';
export const MSG_DUPLICATE_FEATURE_AND_PART_FOR_SKU = 'Duplicate Feature and Part for the chosen SKU';
export const MSG_NO_DUPLICATE_FOUND = 'No duplicate Feature+Part+SKU combinations found.';
export const MSG_DUPLICATE_PART_FEATURE_COMBO = 'Duplicate Part + Feature combination found. Each Part + Feature must be unique.';
export const MSG_NO_DUPLICATE_PART_FEATURE = 'No duplicate Part + Feature combinations found.';
export const MSG_EXPORT_EXCEL_ERROR = 'Error exporting to Excel. Please try again.';
export const MSG_EXPORT_EXCEL_SUCCESS = 'Excel file exported successfully';
export const MSG_EXPORT_EXCEL_SUCCESS_SELECTED = 'Excel file exported successfully (';
export const MSG_MATERIAL_COLORS_SAVED_MOCK = 'Material colors saved (mock)';

/** SKU filter option labels */
export const SKU_FILTER_LABEL_ALL = 'ALL - View only';
export const SKU_FILTER_LABEL_HD_EDITABLE = 'HD source - Editable';
export const SKU_FILTER_LABEL_HD_VIEW_ONLY = 'HD source - View only';
export const SKU_FILTER_LABEL_NON_HD = 'Non HD source - View only';
export const SKU_FILTER_LABEL_EDITABLE_SKUS = 'Editable SKUs';
export const SKU_FILTER_EMPTY_HD_EDITABLE = 'No HD editable SKUs found. Editing is disabled.';
export const SKU_FILTER_EMPTY_HD_VIEW_ONLY = 'No HD source view-only SKUs found.';
export const SKU_FILTER_EMPTY_NON_HD = 'No non-HD source SKUs found.';
export const SKU_FILTER_EMPTY_EDITABLE = 'No editable SKUs found. Editing is disabled.';

/** EBOM: editable service-only fields (Material Color Save; not Part/Start/End/Quantity) */
export const EBOM_SERVICE_FIELDS: readonly string[] = [
  'materialColorThirtyCharacterDescription',
  'materialColorSixtyCharacterDescription',
  'materialColorServiceSubstituteOne',
  'materialColorServiceSubstituteTwo',
  'materialColorServiceEquivalent',
  'materialColorServiceDescription',
  'materialColorServiceMessage',
];

/** Fields auto-populated from part search (material, supplier, color, etc.) */
export const EDITABLE_AUTOPOPULATED_FIELDS: readonly string[] = [
  FIELD_MATERIAL,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_SUPPLIER,
  FIELD_COLOR,
  FIELD_COLOR_DESCRIPTION,
];

/** EBOM: core editable fields (Part #, Start Date, End Date, Quantity) */
export const EBOM_CORE_FIELDS: readonly string[] = [
  FIELD_PART_NUMBER,
  FIELD_BOM_LINK_PART,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_QUANTITY,
];

/** SBOM editable fields for existing rows (dates, quantity, include in spec sheet) */
export const SBOM_EDITABLE_FIELDS: readonly string[] = [
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_QUANTITY,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
];

/** Fields editable for new row (all BOM types – used in grid-config) */
export const NEW_ROW_EDITABLE_FIELDS: readonly string[] = [
  FIELD_BOM_LINK_FEATURE,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_MATERIAL,
  FIELD_SUPPLIER,
  FIELD_COLOR_DESCRIPTION,
  FIELD_COLOR,
  FIELD_PART_NUMBER,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_QUANTITY,
  FIELD_BOM_LINK_SPEC_SHEET_EXTRA,
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
  FIELD_BOM_LINK_COUNTRY_OF_ORIGIN,
];

/** Date/quantity field names for mass edit and payload */
export const MASS_EDIT_DATE_START_FIELDS: readonly string[] = [FIELD_BOM_LINK_START_DATE];
export const MASS_EDIT_DATE_END_FIELDS: readonly string[] = [FIELD_BOM_LINK_END_DATE];
export const MASS_EDIT_QUANTITY_FIELDS: readonly string[] = [FIELD_QUANTITY];
export const MASS_EDIT_INCLUDE_IN_SPEC_SHEET_FIELDS: readonly string[] = [FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET];

/** Columns to refresh after validation (actions) */
export const COLUMNS_REFRESH_ACTIONS: readonly string[] = [COL_ACTIONS];

/** Part number / part field keys for autocomplete and row identity */
export const PART_FIELD_KEYS: readonly string[] = [FIELD_PART_NUMBER, FIELD_BOM_LINK_PART, FIELD_PART];

/** Columns to refresh after part/material/color autocomplete (color, colorDescription, supplier) */
export const COLUMNS_REFRESH_AFTER_PART: readonly string[] = [FIELD_COLOR, FIELD_COLOR_DESCRIPTION, FIELD_SUPPLIER];

/** Required fields for save validation (all BOM types). Keys are checked against row data. */
export const REQUIRED_FIELDS_FOR_SAVE: readonly { keys: string[]; label: string }[] = [
  { keys: [FIELD_PART_NUMBER, FIELD_PART, FIELD_BOM_LINK_PART], label: 'Part' },
  { keys: [FIELD_BOM_LINK_FEATURE, FIELD_FEATURE], label: 'Feature' },
  { keys: [FIELD_BOM_LINK_START_DATE, FIELD_START_DATE], label: 'Start Date' },
  { keys: [FIELD_BOM_LINK_END_DATE, FIELD_END_DATE], label: 'End Date' },
  { keys: [FIELD_QUANTITY, FIELD_QTY], label: 'Quantity' },
];

/** Default required fields for new BOM rows (validation service) */
export const DEFAULT_REQUIRED_FIELDS: readonly { keys: string[]; label: string }[] = [
  { keys: [FIELD_BOM_LINK_FEATURE], label: 'Feature' },
  { keys: [FIELD_MATERIAL_DESCRIPTION], label: 'Material' },
  { keys: [FIELD_SUPPLIER], label: 'Supplier' },
  { keys: [FIELD_COLOR_DESCRIPTION], label: 'Color' },
  { keys: [FIELD_PART_NUMBER], label: 'Part' },
  { keys: [FIELD_BOM_LINK_START_DATE], label: 'Start Date' },
  { keys: [FIELD_BOM_LINK_END_DATE], label: 'End Date' },
  { keys: [FIELD_QUANTITY], label: 'Quantity' },
  { keys: [FIELD_BOM_LINK_SPEC_SHEET_EXTRA], label: 'Spec Sheet Extra' },
  { keys: [FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET], label: 'Include In Spec Sheet' },
];

/** Service Data Manager Modal: columns that are not editable */
export const SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS: readonly string[] = [
  FIELD_PART_NUMBER,
  'materialColorManufacturersPartNumber',
  FIELD_MATERIAL_COLOR_STATUS,
  FIELD_MATERIAL,
  FIELD_COLOR,
  FIELD_SUPPLIER,
];

/** Service Data Manager Modal: service fields that use autocomplete (service search) */
export const SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS: readonly string[] = [
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO,
  FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT,
];

/** Payload transform: column name mapping from grid field to API column key */
export const COLUMN_RENAME_FOR_API: Readonly<Record<string, string>> = {
  materialColorThirtyCharacterDescription: 'partThirtyCharacterDescription',
  materialColorSixtyCharacterDescription: 'partSixtyCharacterDescription',
};
