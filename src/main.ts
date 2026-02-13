import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import {
  ModuleRegistry,
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowSelectionModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  QuickFilterModule,
  CustomEditorModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  ColumnAutoSizeModule,
  ColumnApiModule,
  RowApiModule,
  RenderApiModule,
  ScrollApiModule,
  CellStyleModule,
  RowStyleModule,
  TooltipModule,
  ColumnHoverModule,
} from 'ag-grid-community';
import { environment } from './environments/environment';

// Register only required AG Grid modules for better tree-shaking.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowSelectionModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  QuickFilterModule,
  CustomEditorModule,
  TextEditorModule,
  NumberEditorModule,
  DateEditorModule,
  ColumnAutoSizeModule,
  ColumnApiModule,
  RowApiModule,
  RenderApiModule,
  ScrollApiModule,
  CellStyleModule,
  RowStyleModule,
  TooltipModule,
  ColumnHoverModule,
]);

bootstrapApplication(App, appConfig).catch((err) => {
  // Application bootstrap error - handle silently in production
  if (!environment.production) {
    throw err;
  }
});
