import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { CsrfService } from './csrf.service';
import { environment } from '../../environments/environment';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

@Injectable({
  providedIn: 'root',
})
export class BaseService {
  constructor(protected http: HttpClient, protected csrfService: CsrfService) {}

  /**
   * Common request function with basic mapping.
   * @param url Request URL.
   * @param body Body of the request if any
   * @param method Request method.
   * @param options An optional extra information object as per the request method.
   */
  _makeRequest<T>(
    url: string,
    body?: any,
    method: HttpMethod = 'GET',
    options?: {
      skipMap?: boolean;
      responseType?: string;
      headers?: HttpHeaders;
      params?: HttpParams;
      observe?: 'body' | 'events' | 'response';
    }
  ): Observable<T> {
    const http = this.http;
    const mapper = (res: any) => <T>res;
    let request: Observable<any>;

    switch (method) {
      case 'POST':
      case 'PUT':
      case 'DELETE':
        const requestOptions = {
          responseType: (options && (options.responseType as any)) || 'json',
          headers: (options && options.headers) || new HttpHeaders(),
          params: (options && options.params) || undefined,
          observe: (options && options.observe) || 'body',
        };

        if (environment.production || !environment.useMockApi) {
          if (!this.csrfService.csrfNonce) {
            request = this.csrfService.getNonce().pipe(
              mergeMap((nonce) => {
                requestOptions.headers = requestOptions.headers.set(
                  this.csrfService.csrfHeaderName,
                  nonce
                );
                this.csrfService.csrfNonce = nonce;
                return this._makeHttpRequest(method, url, body, requestOptions);
              })
            );
          } else {
            requestOptions.headers = requestOptions.headers.set(
              this.csrfService.csrfHeaderName,
              this.csrfService.csrfNonce
            );
            request = this._makeHttpRequest(method, url, body, requestOptions);
          }
        } else {
          // Mock API - no CSRF needed
          request = this._makeHttpRequest(method, url, body, requestOptions);
        }
        break;
      case 'GET':
      default:
        request = http.get(url, options as any);
        break;
    }

    return options && options.skipMap ? request : request.pipe(map(mapper));
  }

  private _makeHttpRequest(
    method: HttpMethod,
    url: string,
    body: any,
    options: any
  ): Observable<any> {
    const http = this.http;

    switch (method) {
      case 'POST':
        return http.post(url, body, options);
      case 'PUT':
        return http.put(url, body, options);
      case 'DELETE':
        return http.delete(url, options);
      default:
        return http.get(url, options);
    }
  }
}
