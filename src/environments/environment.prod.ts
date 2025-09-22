export const environment = {
  production: true,
  baseHref: '/Windchill/rfa/trek/jsp/bomcomposer/',
  apiUrl: '/Windchill/rfa/trek/jsp/bomcomposer/api',
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  mockDataPath: '/Windchill/rfa/trek/jsp/bomcomposer/mock.json',
  serverHostUrl: 'http://plmctmig.plmtestlab.com:80',
  // Empty credentials - users enter their own in the modal
  credentials: {
    username: '',
    password: '',
  },
  enableHttpBasicAuth: true,
  appKey: 'sfsd-4bfb-bccf-ab7dea22c187',
  enableThingworx: false,
  isLoggerEnable: false,
  // Real API configuration for production
  useMockApi: false,
  mockApiEndpoints: {
    csrf: '/api/csrf.json',
  },
};
