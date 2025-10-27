import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap, map, mergeMap } from 'rxjs/operators';

export interface LoggedInUserModel {
  name: string;
  fullName: string;
  id: string;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  // Use CSRF API for authentication since it requires credentials
  static readonly authUrl = environment.useMockApi
    ? environment.mockApiEndpoints.csrf
    : `${environment.serverHostUrl}${environment.csrfUrl}`;

  // getUser API URL for getting user information after authentication
  static readonly getUserUrl = environment.useMockApi
    ? environment.mockApiEndpoints.getUser
    : `${environment.serverHostUrl}${environment.getUserUrl}`;

  private sessionSubject = new BehaviorSubject<LoggedInUserModel | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {}

  initSession(): Observable<LoggedInUserModel> {
    // First call CSRF API for authentication
    return this.http.get<any>(SessionService.authUrl).pipe(
      mergeMap((csrfResponse: any) => {
        // If CSRF API returns successfully, user is authenticated
        // Now call getUser API to get user information and chain it properly
        return this.getUserInfo();
      }),
      tap((user: LoggedInUserModel) => {
        // Update session state when both CSRF and getUser succeed
        this.sessionSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      }),
      catchError((error) => {
        console.log('Authentication failed:', error);
        this.sessionSubject.next(null);
        this.isAuthenticatedSubject.next(false);

        if (environment.useMockApi) {
          // Development: More lenient error handling
          console.warn('Development mode: Authentication failed, but continuing with fallback');
        } else {
          // Production: Strict error handling - no fallbacks
          console.error('Production mode: Authentication failed, user must re-authenticate');
        }

        // Throw the error so app.ts can handle it properly
        return throwError(() => error);
      })
    );
  }

  private getUserInfo(): Observable<LoggedInUserModel> {
    return this.http.get<any>(SessionService.getUserUrl).pipe(
      map((response: any) => {
        // Map the response to our user model
        if (environment.useMockApi) {
          // Development: Allow fallbacks for mock data
          const user: LoggedInUserModel = {
            name: response.name || 'test',
            fullName: response.fullName || 'test User',
            id: response.id || 'OR:wt.org.WTUser:123456789',
          };
          return user;
        } else {
          // Production: Strict validation - backend must provide all fields
          if (!response.name || !response.fullName || !response.id) {
            throw new Error('Invalid user data received from backend - missing required fields');
          }

          const user: LoggedInUserModel = {
            name: response.name,
            fullName: response.fullName,
            id: response.id,
          };
          return user;
        }
      }),
      catchError((error) => {
        console.log('getUser API failed:', error);

        if (environment.useMockApi) {
          // Development: Provide fallback for mock API failures
          console.warn('Mock API failed, using fallback user data');
          const fallbackUser: LoggedInUserModel = {
            name: 'test',
            fullName: 'test User',
            id: 'OR:wt.org.WTUser:123456789',
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
