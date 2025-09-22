// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  baseHref: '/',
  apiUrl: '/api',
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  mockDataPath: '/mock.json',
  serverHostUrl: '',
  /**
   * Credentials to be sent along with the Auth header.
   */
  credentials: {
    username: 'test',
    password: 'test',
  },
  enableHttpBasicAuth: true,
  appKey: '',
  enableThingworx: false,
  isLoggerEnable: false,
  // Mock API configuration for development
  useMockApi: true,
  mockApiEndpoints: {
    getUser: '/api/getUser.json',
    csrf: '/api/csrf.json',
  },
};
