import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap, map, mergeMap } from 'rxjs/operators';

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
  // Common method to get data attributes from JSP
  private getJspDataAttribute(attributeName: string): string | null {
    const angularRoot = document.getElementById('angular-root');
    return angularRoot?.getAttribute(attributeName) || null;
  }

  // Get service host URL from JSP data attribute (passed from Windchill)
  private getServiceHostUrl(): string {
    const hostFromJsp = this.getJspDataAttribute('data-host');

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

  // Use CSRF API for authentication since it requires credentials
  getAuthUrl(): string {
    return environment.useMockApi
      ? environment.mockApiEndpoints.csrf
      : `${this.getServiceHostUrl()}${environment.csrfUrl}`;
  }

  // getUser API URL for getting user information after authentication
  getUserApiUrl(): string {
    return environment.useMockApi
      ? environment.mockApiEndpoints.getUser
      : `${this.getServiceHostUrl()}${environment.getUserUrl}`;
  }

  private sessionSubject = new BehaviorSubject<LoggedInUserModel | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Store CSRF token
  private csrfToken: string | null = null;

  constructor(private http: HttpClient) {}

  // Call CSRF API to get token (before showing login modal)
  getCsrfToken(): Observable<string> {
    return this.http.get<any>(this.getAuthUrl()).pipe(
      map((csrfResponse: any) => {
        // Extract CSRF token from response
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

  // Authenticate user with credentials (after modal)
  initSession(): Observable<LoggedInUserModel> {
    return this.getUserInfo().pipe(
      tap((user: LoggedInUserModel) => {
        // Update session state when getUserDetails succeeds
        this.sessionSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      }),
      catchError((error) => {
        this.sessionSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        // Throw the error so app.ts can handle it properly
        return throwError(() => error);
      })
    );
  }

  // Get stored CSRF token
  getCsrfNonce(): string | null {
    return this.csrfToken;
  }

  private getUserInfo(): Observable<LoggedInUserModel> {
    // Prepare request body with username from credentials
    const requestBody = {
      userName: environment.credentials.username,
    };

    // Prepare headers with CSRF token
    let headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.csrfToken) {
      headers['CSRF_NONCE'] = this.csrfToken;
    }

    return this.http.post<any>(this.getUserApiUrl(), requestBody, { headers }).pipe(
      map((response: any) => {
        // Map the response to our user model
        if (environment.useMockApi) {
          // Development: Allow fallbacks for mock data
          const user: LoggedInUserModel = {
            name: response.name || response.userName || 'wcadmin',
            fullName: response.fullName || 'Administrator',
            userName: response.userName || 'wcadmin',
            last: response.last,
            emailId: response.emailId,
          };
          return user;
        } else {
          // Production: Strict validation - backend must provide all fields
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
          // Development: Provide fallback for mock API failures
          const fallbackUser: LoggedInUserModel = {
            name: 'wcadmin',
            fullName: 'Administrator',
            userName: 'wcadmin',
          };
          return of(fallbackUser);
        } else {
          // Production: No fallbacks - authentication must fail
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
