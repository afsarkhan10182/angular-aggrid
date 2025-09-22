import { Injectable, ViewContainerRef } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SessionService } from '../services/session.service';
import { ModalService } from '../services/modal.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private sessionService: SessionService,
    private router: Router,
    private modalService: ModalService
  ) {}

  canActivate(): Observable<boolean> {
    // If authentication is disabled, allow access
    if (!environment.enableHttpBasicAuth) {
      return of(true);
    }

    // Check if user is already authenticated
    if (this.sessionService.isAuthenticated()) {
      return of(true);
    }

    // For now, return false to prevent navigation
    // The modal will be shown by the main app component
    return of(false);
  }
}
