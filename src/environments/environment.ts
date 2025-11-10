// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  csrfUrl: '/Windchill/servlet/rest/security/csrf',
  getUserUrl: '/Windchill/servlet/rest/trek/getUserDetails',
  dataApiPath: '/mock2.json',
  credentials: {
    username: 'wcadmin',
    password: 'wcadmin',
  },
  enableHttpBasicAuth: true,
  useMockApi: true,
  mockApiEndpoints: {
    csrf: '/api/csrf.json',
    getUser: '/api/getUser.json',
    material: '/api/material.json',
  },
};
