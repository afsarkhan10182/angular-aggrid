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
  static readonly userUrl = environment.useMockApi
    ? environment.mockApiEndpoints.getUser
    : `${environment.apiUrl}/getUser`;

  private sessionSubject = new BehaviorSubject<LoggedInUserModel | null>(null);
  public session$ = this.sessionSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {}

  initSession(): Observable<LoggedInUserModel> {
    return this.http.get<LoggedInUserModel>(SessionService.userUrl).pipe(
      tap((user: LoggedInUserModel) => {
        this.sessionSubject.next(user);
        // Consider successful response as authenticated
        this.isAuthenticatedSubject.next(true);
      }),
      catchError((error) => {
        console.log('Session initialization error:', error);
        // Don't throw the error, just log it like the old app
        this.sessionSubject.next(null);
        this.isAuthenticatedSubject.next(false);
        // Return a default user object to prevent the error from propagating
        return of({
          name: '',
          fullName: '',
          id: '',
        });
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
