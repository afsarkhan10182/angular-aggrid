import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AppParamsInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Return the original request when thingworx is disabled
    if (!environment.enableThingworx) {
      return next.handle(req);
    }

    let params = req.params.append('appKey', environment.appKey);
    params = params.append('x-thingworx-session', 'true');

    const modifiedReq = req.clone({ params: params });

    return next.handle(modifiedReq).pipe(
      map((e) => {
        if (e instanceof HttpResponse) {
          e = e.clone({ body: e.body.array || e.body });
        }
        return e;
      })
    );
  }
}
