// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  getUserUrl: '/Windchill/servlet/rest/trek/getUserDetails',
  dataApiPath: '/mock.json',
  cooAnalysisApiPath: '/api/coo-analysis.json',
  credentials: {
    username: 'wcadmin',
    password: 'wcadmin',
  },
  enableHttpBasicAuth: false,
  useMockApi: true,
  mockApiEndpoints: {
    csrf: '/api/csrf.json',
    getUser: '/api/getUser.json',
    material: '/api/material.json',
    bomFeatures: '/api/feature.json',
    saveBomLinks: '/api/updateBom',
    complexMaterial: '/api/materialmodal.json',
    includeInSpecSheet: '/api/IncludeInSpecSheet.json',
    /** Single source for material-colors search: part search, material search, and search by IDs (same response structure). */
    materialColorsSearch: '/api/serviceDataModal.json',
    partEditSearch: '/api/parts-edit.json',
  },
};
