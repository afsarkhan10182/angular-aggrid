export const environment = {
  production: true,
  baseHref: '/Windchill/rfa/trek/jsp/bomcomposer/',
  apiUrl: '/Windchill/rfa/trek/jsp/bomcomposer/api',
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  mockDataPath: '/Windchill/rfa/trek/jsp/bomcomposer/mock.json',
  serverHostUrl: 'https://flexplm.testing.com',
  /**
   * Credentials to be sent along with the Auth header.
   */
  credentials: {
    username: 'test',
    password: 'test',
  },
  enableHttpBasicAuth: true,
  appKey: 'sfsd-4bfb-bccf-ab7dea22c187',
  enableThingworx: false,
  isLoggerEnable: false,
  // Real API configuration for production
  useMockApi: false,
  mockApiEndpoints: {
    getUser: '/Windchill/servlet/rest/bomCreator/getUser',
    csrf: '/api/csrf.json',
  },
};
