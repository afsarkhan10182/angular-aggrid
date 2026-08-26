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

  function flushPendingOptions(): void {
    httpMock
      .match((request) => request.url.includes('bomLinkIncludeInSpecSheet'))
      .forEach((request) => request.flush({ items: [] }));
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
    expect(compiled.querySelector('select.sku-filter-select')).not.toBeNull();
    expect(compiled.querySelector('button.action-dropdown-btn')).not.toBeNull();
    expect(compiled.querySelector('ag-grid-angular')).not.toBeNull();
    flushPendingOptions();
  });

  it('should open Mass Edit with values shared by the selected rows', () => {
    const fixture = TestBed.createComponent(AppComponent);
    flushInitialBomLoad();
    const component = fixture.componentInstance;
    const massEditService = (component as any).massEditService;
    spyOn(massEditService, 'populateMassEditFields').and.returnValue({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      quantity: 2,
      includeInSpecSheet: '',
    });
    component.selectedSkuFilter = 'hdEditable';
    component.selectedRows.add({ materialKey: 'one' });
    component.selectedRows.add({ materialKey: 'two' });

    component.openMassEdit();

    expect(component.massEditMode).toBeTrue();
    expect(component.massEditStartDate).toBe('2026-01-01');
    expect(component.massEditEndDate).toBe('2026-12-31');
    expect(component.massEditQuantity).toBe(2);
  });

});
