import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, tap } from 'rxjs/operators';

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

  private sessionSubject = new BehaviorSubject<LoggedInUserModel | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {}

  initSession(): Observable<LoggedInUserModel> {
    // Call CSRF API which requires authentication
    return this.http.get<any>(SessionService.authUrl).pipe(
      tap((response: any) => {
        // If CSRF API returns successfully, user is authenticated
        // CSRF API only returns nonce, so we create a default authenticated user
        const user: LoggedInUserModel = {
          name: 'authenticated',
          fullName: 'Authenticated User',
          id: 'authenticated-user',
        };
        this.sessionSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      }),
      catchError((error) => {
        console.log('Authentication failed:', error);
        this.sessionSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        // Throw the error so app.ts can handle it properly
        return throwError(() => error);
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
