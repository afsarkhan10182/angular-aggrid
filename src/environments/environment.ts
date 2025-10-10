// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  baseHref: '/',
  apiUrl: '/api',
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  dataApiPath: '/mock2.json',
  serverHostUrl: '',
  // Development credentials for mock API validation
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
    csrf: '/api/csrf.json',
  },
};
