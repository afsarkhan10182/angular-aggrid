import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AppParamsInterceptor } from './interceptors/app-params.interceptor';
import { SessionService } from './services/session.service';
import { CsrfService } from './services/csrf.service';
import { BaseService } from './services/base.service';
import { ModalService } from './services/modal.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),

    // Services
    SessionService,
    CsrfService,
    BaseService,
    ModalService,

    // Interceptors
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AppParamsInterceptor,
      multi: true,
    },
  ],
};
