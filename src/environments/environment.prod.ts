export const environment = {
  production: true,
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  getUserUrl: '/Windchill/servlet/rest/trek/getUserDetails',
  dataApiPath: '/Windchill/servlet/rest/trek/bomlink',
  cooAnalysisApiPath: '/Windchill/servlet/rest/trek/cooanalysis',
  credentials: {
    username: '',
    password: '',
  },
  enableHttpBasicAuth: true,
  useMockApi: false,
  mockApiEndpoints: {
    csrf: '/api/csrf.json',
    getUser: '/api/getUser.json',
    material: '/api/material.json',
    bomFeatures: '/api/feature.json',
    saveBomLinks: '/api/updateBom',
    complexMaterial: '/api/materialmodal.json',
    includeInSpecSheet: '/api/IncludeInSpecSheet.json',
    materialColorsSearch: '/api/serviceDataModal.json',
    partEditSearch: '/api/parts-edit.json',
  },
};
