import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ModuleRegistry,
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowSelectionModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
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
  HighlightChangesModule,
} from 'ag-grid-community';
import { AppComponent } from './app';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowSelectionModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
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
  HighlightChangesModule,
]);

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushEmptyBomResponse(request: TestRequest): void {
    request.flush({
      instances: [],
      columns: {},
      skuInfo: [],
      sectionOrder: [],
      bomType: 'MBOM',
    });
  }

  function flushInitialBomLoad(): void {
    const firstRequest = httpMock.expectOne(() => true);

    if (firstRequest.request.url.includes('csrf')) {
      firstRequest.flush({ nonce: 'test-csrf-token' });
      flushEmptyBomResponse(httpMock.expectOne(() => true));
      return;
    }

    flushEmptyBomResponse(firstRequest);
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    flushInitialBomLoad();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the composer controls and grid shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    flushInitialBomLoad();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input.search-input')?.getAttribute('placeholder')).toBe(
      'Search All Columns',
    );
    expect(compiled.querySelector('button.save-changes-btn')).not.toBeNull();
    expect(compiled.querySelector('ag-grid-angular')).not.toBeNull();
  });
});
