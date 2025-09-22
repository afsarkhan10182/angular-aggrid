import { Routes } from '@angular/router';
import { SbomComponent } from './sbom/sbom.component';
import { App } from './app';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: App,
    canActivate: [AuthGuard],
  },
  {
    path: 'sbom',
    component: SbomComponent,
    canActivate: [AuthGuard],
  },
];
