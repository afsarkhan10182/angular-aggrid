import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap, map, mergeMap } from 'rxjs/operators';
import { UtilService } from './util.service';

export interface LoggedInUserModel {
  name: string;
  fullName: string;
  userName: string;
  last?: string;
  emailId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  // Get service host URL from JSP data attribute (passed from Windchill)
  private getServiceHostUrl(): string {
    const hostFromJsp = this.utilService.getJspDataAttribute('data-host');

    if (!hostFromJsp) {
      return '';
    }

    // If host already includes protocol (http:// or https://), return as-is
    if (hostFromJsp.startsWith('http://') || hostFromJsp.startsWith('https://')) {
      return hostFromJsp;
    }

    // Otherwise, use the current page's protocol (http or https)
    const protocol = window.location.protocol; // Returns "http:" or "https:"
    return `${protocol}//${hostFromJsp}`;
  }

  getAuthUrl(): string {
    return environment.useMockApi
      ? environment.mockApiEndpoints.csrf
      : `${this.getServiceHostUrl()}${environment.csrfUrl}`;
  }

  getUserApiUrl(): string {
    return environment.useMockApi
      ? environment.mockApiEndpoints.getUser
      : `${this.getServiceHostUrl()}${environment.getUserUrl}`;
  }

  private sessionSubject = new BehaviorSubject<LoggedInUserModel | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private csrfToken: string | null = null;

  constructor(private http: HttpClient, private utilService: UtilService) {}

  getCsrfToken(): Observable<string> {
    return this.http.get<any>(this.getAuthUrl()).pipe(
      map((csrfResponse: any) => {
        const token = csrfResponse?.items?.[0]?.attributes?.nonce || csrfResponse?.nonce || '';
        this.csrfToken = token;
        return token;
      }),
      catchError((error) => {
        this.csrfToken = null;
        return throwError(() => error);
      })
    );
  }

  initSession(): Observable<LoggedInUserModel> {
    return this.getUserInfo().pipe(
      tap((user: LoggedInUserModel) => {
        this.sessionSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      }),
      catchError((error) => {
        this.sessionSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  getCsrfNonce(): string | null {
    return this.csrfToken;
  }

  private getUserInfo(): Observable<LoggedInUserModel> {
    const requestBody = {
      userName: environment.credentials.username,
    };

    let headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.csrfToken) {
      headers['CSRF_NONCE'] = this.csrfToken;
    }

    return this.http.post<any>(this.getUserApiUrl(), requestBody, { headers }).pipe(
      map((response: any) => {
        if (environment.useMockApi) {
          const user: LoggedInUserModel = {
            name: response.name || response.userName || 'wcadmin',
            fullName: response.fullName || 'Administrator',
            userName: response.userName || 'wcadmin',
            last: response.last,
            emailId: response.emailId,
          };
          return user;
        } else {
          if (!response.name || !response.fullName || !response.userName) {
            throw new Error('Invalid user data received from backend - missing required fields');
          }

          const user: LoggedInUserModel = {
            name: response.name,
            fullName: response.fullName,
            userName: response.userName,
            last: response.last,
            emailId: response.emailId,
          };
          return user;
        }
      }),
      catchError((error) => {
        if (environment.useMockApi) {
          const fallbackUser: LoggedInUserModel = {
            name: 'wcadmin',
            fullName: 'Administrator',
            userName: 'wcadmin',
          };
          return of(fallbackUser);
        } else {
          return throwError(() => error);
        }
      })
    );
  }

  getSession(): Observable<LoggedInUserModel | null> {
    return this.session$;
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  clearSession(): void {
    this.sessionSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  setAuthenticated(user: LoggedInUserModel): void {
    this.sessionSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }
}
