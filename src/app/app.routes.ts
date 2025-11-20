import { Routes } from '@angular/router';
import { App } from './app';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: App,
    canActivate: [AuthGuard],
  },
];
