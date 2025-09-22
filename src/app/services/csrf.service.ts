import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';

/**
 * A service which makes a GET request to get a nonce for the write access to the server.
 * This is to be used for POST, PUT and DELETE requests.
 */
@Injectable({
  providedIn: 'root',
})
export class CsrfService {
  private _csrfUrl = environment.useMockApi
    ? environment.mockApiEndpoints.csrf
    : `${environment.serverHostUrl}${environment.csrfUrl}`;

  csrfHeaderName = 'CSRF_NONCE';
  csrfNonce: string | null = null;

  constructor(private http: HttpClient) {}

  getNonce(): Observable<string> {
    return this.http
      .get(this._csrfUrl, { responseType: 'json' })
      .pipe(map((response: any) => response.items && response.items[0].attributes.nonce));
  }

  clearNonce(): void {
    this.csrfNonce = null;
  }
}
