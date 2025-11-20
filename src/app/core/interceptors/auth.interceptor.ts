import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
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

