import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  canActivate(): boolean {
    if (!environment.enableHttpBasicAuth) {
      return true;
    }

    return this.sessionService.isAuthenticated();
  }
}
