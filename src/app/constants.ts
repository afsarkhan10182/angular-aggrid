// Product BOM constants: centralizes BOM type, field names, labels, and validation keys used by the Product MBOM composer.
// BOM and API core values.
export const BOM_TYPE_PRODUCTMBOM = 'MBOM';
export const DEFAULT_BOM_TYPE = BOM_TYPE_PRODUCTMBOM;
export const BOM_LINK_KEY = 'bom-link';
export const ENUM_MBOM_LINE_ITEM = 'enumMBOM001';
export const VALUE_SPEC_YES = 'Yes';
export const VALUE_SPEC_NO = 'No';
export const API_TRUE = 'true';
export const API_FALSE = 'false';
export const DISPLAY_FALSE = API_FALSE;

// Notification and local storage keys.
export const NOTIFICATION_TYPE_SUCCESS = 'success';
export const NOTIFICATION_TYPE_ERROR = 'error';
export const NOTIFICATION_TYPE_ERROR_PERSISTENT = 'error-persistent';
export const NOTIFICATION_TYPE_INFO = 'info';
export const LS_KEY_SHOW_EXPIRED_DATA = 'showExpiredData';
export const LS_KEY_LAST_SAVED_AT = 'lastSavedAt';

// Grid column ids and shared field keys.
export const COL_ACTIONS = 'actions';
export const COL_CHECKBOX = 'checkbox';
export const FIELD_ACTIONS = COL_ACTIONS;
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
export const FIELD_MATERIAL_SUPPLIER_COUNTRY_OF_ORIGIN = 'materialSupplierCountryOfOrigin';
export const FIELD_MATERIAL = 'material';
export const FIELD_MATERIAL_DESCRIPTION = 'materialDescription';
export const FIELD_SUPPLIER = 'supplier';
export const FIELD_COLOR = 'color';
export const FIELD_COLOR_DESCRIPTION = 'colorDescription';
export const FIELD_HAS_LINKED_BOM = 'hasLinkedBom';
export const FIELD_MATERIAL_COLOR_STATUS = 'materialColorState';
export const FIELD_MATERIAL_COLOR_CREATIVE_OWNER = 'materialColorCreativeOwner';
export const FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT = 'materialColorServiceEquivalent';
export const FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE = 'materialColorServiceSubstituteOne';
export const FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO = 'materialColorServiceSubstituteTwo';
export const FIELD_MATERIAL_COLOR_THIRTY_CHARACTER_DESCRIPTION =
  'materialColorThirtyCharacterDescription';
export const FIELD_MATERIAL_COLOR_SIXTY_CHARACTER_DESCRIPTION =
  'materialColorSixtyCharacterDescription';
export const FIELD_MATERIAL_COLOR_SERVICE_DESCRIPTION = 'materialColorServiceDescription';
export const FIELD_MATERIAL_COLOR_SERVICE_MESSAGE = 'materialColorServiceMessage';
export const FIELD_MATERIAL_COLOR_MANUFACTURERS_PART_NUMBER =
  'materialColorManufacturersPartNumber';

// Request attributes and headers.
export const ATTR_PART_NUMBER = FIELD_PART_NUMBER;
export const ATTR_PTCMATERIAL_NAME = 'ptcmaterialName';
export const HEADER_CSRF_NONCE = 'CSRF_NONCE';
export const PARAM_BOM_TYPE = 'bomType';

// UI labels, placeholders, and titles.
export const ROW_ID_UNKNOWN = 'Unknown';
export const LABEL_ROW = 'row';
export const LABEL_ROWS = 'rows';
export const LABEL_ALL = 'All';
export const LABEL_QUANTITY = 'Quantity';
export const LABEL_PART = 'Part';
export const LABEL_FEATURE = 'Feature';
export const LABEL_START_DATE = 'Start Date';
export const LABEL_END_DATE = 'End Date';
export const HEADER_FEATURE = 'Feature';
export const PLACEHOLDER_SEARCH_BOM_FEATURES = 'Search BOM features...';
export const PLACEHOLDER_SEARCH_SERVICES = 'Search services...';
export const TITLE_EXPIRED = 'Expired';
export const TITLE_REQUIRED_FIELD = 'Required field';
export const TITLE_REQUIRED_FIELD_ERROR = 'Required field error';
export const TITLE_DELETE_ROW = 'Delete';
export const TITLE_ADD_ROW = 'Add';

// Duplicate validation categories.
export const DUPLICATE_TYPE_ENUM_MBOM_001 = ENUM_MBOM_LINE_ITEM;
export const DUPLICATE_TYPE_NOT_ENUM_MBOM_001 = 'notEnumMBOM001';
export const DUPLICATE_TYPE_FEATURE_UNIQUENESS = 'feature-uniqueness';
export const DUPLICATE_TYPE_DUPLICATE_FEATURE = 'duplicate-feature';
export const DUPLICATE_TYPE_DUPLICATE_PART = 'duplicate-part';

// User-facing messages.
export const MSG_SAVE_DISABLED_VIEW_ONLY = 'Save is disabled in view-only mode.';
export const MSG_LOAD_BOM_FAILED = 'Failed to load BOM data. Please try again.';
export const MSG_LOAD_BOM_SERVER_ERROR = 'Failed to load BOM data: Server error (500).';
export const MSG_BOM_SEARCH_RESULTS_EXCEEDED =
  'Search Results exceeded 1000. Minimize SKU selection';
export const MSG_VALIDATION_REQUIRED_FIELDS = 'Missing required fields. Hover over ⓘ to see details.';
export const MSG_NO_SKUS_SELECTED = 'No SKUs selected in row';
export const MSG_SKU_SELECTION = 'SKU selection';
export const MSG_MISSING = 'Missing';
export const MSG_SKU_ERROR = 'SKU Error';
export const MSG_DUPLICATE_FEATURE_SKU_SECTION = 'Duplicate feature for the same SKU and section.';
export const MSG_DUPLICATE_SECTION_PART_SKU = 'Duplicate part for the same SKU on the same section.';
export const MSG_DUPLICATE_FEATURE_SKU_SECTION_ONE =
  'Duplicate feature for the same SKU and section. One SKU should not have more than one feature for the same section.';
export const MSG_DUPLICATE_FEATURE_FOR_SKU = 'Duplicate Feature for the chosen SKU';
export const MSG_DUPLICATE_FEATURE_AND_PART_FOR_SKU = 'Duplicate Feature and Part for the chosen SKU';
export const MSG_NO_DUPLICATE_FOUND = 'No duplicate Feature+Part+SKU combinations found.';
export const MSG_DUPLICATE_PART_FEATURE_COMBO =
  'Duplicate Part + Feature combination found. Each Part + Feature must be unique.';
export const MSG_NO_DUPLICATE_PART_FEATURE = 'No duplicate Part + Feature combinations found.';

// SKU filter labels and empty-state messages.
export const SKU_FILTER_LABEL_ALL = 'ALL - View only';
export const SKU_FILTER_LABEL_HD_EDITABLE = 'HD source - Editable';
export const SKU_FILTER_LABEL_HD_VIEW_ONLY = 'HD source - View only';
export const SKU_FILTER_LABEL_NON_HD = 'Non HD source - View only';
export const SKU_FILTER_EMPTY_HD_EDITABLE = 'No HD editable SKUs found. Editing is disabled.';
export const SKU_FILTER_EMPTY_HD_VIEW_ONLY = 'No HD source view-only SKUs found.';
export const SKU_FILTER_EMPTY_NON_HD = 'No non-HD source SKUs found.';

// Field groups for grid edit and validation behavior.
export const EDITABLE_AUTOPOPULATED_FIELDS: readonly string[] = [
  FIELD_MATERIAL,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_SUPPLIER,
  FIELD_COLOR,
  FIELD_COLOR_DESCRIPTION,
];

export const PART_LOOKUP_POPULATED_FIELDS: readonly string[] = [
  FIELD_SUPPLIER,
  FIELD_COLOR_DESCRIPTION,
  FIELD_BOM_LINK_FEATURE,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
  FIELD_QUANTITY,
];

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

// Field groups for mass edit actions.
export const MASS_EDIT_DATE_START_FIELDS: readonly string[] = [FIELD_BOM_LINK_START_DATE];
export const MASS_EDIT_DATE_END_FIELDS: readonly string[] = [FIELD_BOM_LINK_END_DATE];
export const MASS_EDIT_QUANTITY_FIELDS: readonly string[] = [FIELD_QUANTITY];
export const MASS_EDIT_INCLUDE_IN_SPEC_SHEET_FIELDS: readonly string[] = [
  FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET,
];

// Refresh and required-field configuration.
export const COLUMNS_REFRESH_ACTIONS: readonly string[] = [COL_ACTIONS];
export const PART_FIELD_KEYS: readonly string[] = [FIELD_PART_NUMBER, FIELD_BOM_LINK_PART, FIELD_PART];
export const COLUMNS_REFRESH_AFTER_PART: readonly string[] = [
  FIELD_COLOR,
  FIELD_COLOR_DESCRIPTION,
  FIELD_SUPPLIER,
];

type RequiredFieldConfig = {
  keys: string[];
  label: string;
};

export const REQUIRED_FIELDS_FOR_SAVE: readonly RequiredFieldConfig[] = [
  { keys: [FIELD_PART_NUMBER, FIELD_PART, FIELD_BOM_LINK_PART], label: LABEL_PART },
  { keys: [FIELD_BOM_LINK_FEATURE, FIELD_FEATURE], label: LABEL_FEATURE },
  { keys: [FIELD_BOM_LINK_START_DATE, FIELD_START_DATE], label: LABEL_START_DATE },
  { keys: [FIELD_BOM_LINK_END_DATE, FIELD_END_DATE], label: LABEL_END_DATE },
  { keys: [FIELD_QUANTITY, FIELD_QTY], label: LABEL_QUANTITY },
];

export const DEFAULT_REQUIRED_FIELDS: readonly RequiredFieldConfig[] = [
  { keys: [FIELD_BOM_LINK_FEATURE], label: LABEL_FEATURE },
  { keys: [FIELD_MATERIAL_DESCRIPTION], label: 'Material' },
  { keys: [FIELD_SUPPLIER], label: 'Supplier' },
  { keys: [FIELD_COLOR_DESCRIPTION], label: 'Color' },
  { keys: [FIELD_PART_NUMBER], label: LABEL_PART },
  { keys: [FIELD_BOM_LINK_START_DATE], label: LABEL_START_DATE },
  { keys: [FIELD_BOM_LINK_END_DATE], label: LABEL_END_DATE },
  { keys: [FIELD_QUANTITY], label: LABEL_QUANTITY },
  { keys: [FIELD_BOM_LINK_SPEC_SHEET_EXTRA], label: 'Spec Sheet Extra' },
  { keys: [FIELD_BOM_LINK_INCLUDE_IN_SPEC_SHEET], label: 'Include In Spec Sheet' },
];

// Service Data Manager modal field configuration.
export const SERVICE_DATA_MANAGER_MODAL_DISABLED_FIELDS: readonly string[] = [
  FIELD_PART_NUMBER,
  FIELD_MATERIAL_COLOR_MANUFACTURERS_PART_NUMBER,
  FIELD_MATERIAL_COLOR_STATUS,
  FIELD_MATERIAL,
  FIELD_COLOR,
  FIELD_SUPPLIER,
];

export const SERVICE_DATA_MANAGER_MODAL_DROPDOWN_FIELDS: readonly string[] = [
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_ONE,
  FIELD_MATERIAL_COLOR_SERVICE_SUBSTITUTE_TWO,
  FIELD_MATERIAL_COLOR_SERVICE_EQUIVALENT,
];

// Part Edit modal field configuration.
export const PART_EDIT_MODAL_DISABLED_FIELDS: readonly string[] = [
  FIELD_PART_NUMBER,
  FIELD_MATERIAL,
  FIELD_SUPPLIER,
  FIELD_COLOR,
  FIELD_MATERIAL_COLOR_STATUS,
];

// Payload field rename map for API submission.
export const COLUMN_RENAME_FOR_API: Readonly<Record<string, string>> = {
  [FIELD_MATERIAL_COLOR_THIRTY_CHARACTER_DESCRIPTION]: 'partThirtyCharacterDescription',
  [FIELD_MATERIAL_COLOR_SIXTY_CHARACTER_DESCRIPTION]: 'partSixtyCharacterDescription',
};