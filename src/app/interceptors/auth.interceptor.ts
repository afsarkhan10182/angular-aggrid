import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Return the original request when http basic auth is disabled
    if (!environment.enableHttpBasicAuth) {
      return next.handle(req);
    }

    const credentials = environment.credentials;

    const token = btoa(`${credentials.username}:${credentials.password}`);
    const authHeader = `Basic ${token}`;

    const reqWithAuth = req.clone({
      headers: req.headers.set('Authorization', authHeader),
    });

    return next.handle(reqWithAuth);
  }
}
