export const environment = {
  production: true,
  baseHref: '/Windchill/rfa/trek/jsp/bomcomposer/',
  apiUrl: '/Windchill/rfa/trek/jsp/bomcomposer/api',
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  getUserUrl: '/Windchill/servlet/rest/security/getUser',
  dataApiPath: '/Windchill/servlet/rest/trek/bomlink',
  serverHostUrl: 'http://plmcntimg.plmtestlab.com',
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
    getUser: '/api/getUser.json',
  },
};
