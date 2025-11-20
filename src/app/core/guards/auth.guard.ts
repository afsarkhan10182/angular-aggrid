import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { SessionService } from '../../services/session.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private sessionService: SessionService, private router: Router) {}

  canActivate(): Observable<boolean> {
    if (!environment.enableHttpBasicAuth) {
      return of(true);
    }

    if (this.sessionService.isAuthenticated()) {
      return of(true);
    }

    return of(false);
  }
}
