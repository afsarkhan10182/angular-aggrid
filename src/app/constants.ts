/**
 * Application-wide constants. Manage all shared literals and field lists here.
 */

/** BOM types from API / data layer */
export const BOM_TYPE_EBOM = 'EBOM';
export const BOM_TYPE_MBOM = 'MBOM';
export const BOM_TYPE_SBOM = 'SBOM';

/** Default BOM type when API / JSP does not provide one (e.g. getBomType() || DEFAULT_BOM_TYPE) */
export const DEFAULT_BOM_TYPE = 'MBOM';

/** API payload key for BOM link object */
export const BOM_LINK_KEY = 'bom-link';

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

/** EBOM: core editable fields (Part #, Start Date, End Date, Quantity) */
export const EBOM_CORE_FIELDS: readonly string[] = [
  'partNumber',
  'bomLinkPart',
  'bomLinkStartDate',
  'bomLinkEndDate',
  'quantity',
];

/** Fields auto-populated from part search (material, supplier, color, etc.) */
export const EDITABLE_AUTOPOPULATED_FIELDS: readonly string[] = [
  'material',
  'materialDescription',
  'supplier',
  'color',
  'colorDescription',
];

/** Parts Edit Modal: columns that are not editable */
export const PARTS_EDIT_MODAL_DISABLED_FIELDS: readonly string[] = [
  'partNumber',
  'materialColorManufacturersPartNumber',
  'materialColorStatus',
];

/** Parts Edit Modal: service fields that use autocomplete (service search) */
export const PARTS_EDIT_MODAL_DROPDOWN_FIELDS: readonly string[] = [
  'materialColorServiceSubstituteOne',
  'materialColorServiceSubstituteTwo',
  'materialColorServiceEquivalent',
];

/** Required fields for save validation (all BOM types). Keys are checked against row data. */
export const REQUIRED_FIELDS_FOR_SAVE: readonly { keys: string[]; label: string }[] = [
  { keys: ['partNumber', 'part', 'bomLinkPart'], label: 'Part' },
  { keys: ['bomLinkFeature', 'feature'], label: 'Feature' },
  { keys: ['bomLinkStartDate', 'startDate'], label: 'Start Date' },
  { keys: ['bomLinkEndDate', 'endDate'], label: 'End Date' },
  { keys: ['quantity', 'qty'], label: 'Quantity' },
];

/** Payload transform: column name mapping from grid field to API column key */
export const COLUMN_RENAME_FOR_API: Readonly<Record<string, string>> = {
  materialColorThirtyCharacterDescription: 'partThirtyCharacterDescription',
  materialColorSixtyCharacterDescription: 'partSixtyCharacterDescription',
};
