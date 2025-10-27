import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { environment } from './environments/environment';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

bootstrapApplication(App, appConfig).catch((err) => {
  // Application bootstrap error - handle silently in production
  if (!environment.production) {
    throw err;
  }
});
