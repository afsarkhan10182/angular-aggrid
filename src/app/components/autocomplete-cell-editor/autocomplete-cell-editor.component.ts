// Product BOM autocomplete editor: supports Product MBOM part, material, feature, country, and SKU-aware lookup cells inside AG Grid.
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import {
  BOM_LINK_KEY,
  FIELD_COLOR_DESCRIPTION,
  FIELD_COLOR,
  FIELD_BOM_LINK_PART,
  FIELD_PART_NUMBER,
  FIELD_PART,
  FIELD_BOM_LINK_FEATURE,
  FIELD_BOM_LINK_COUNTRY_OF_ORIGIN,
  FIELD_MATERIAL,
  FIELD_MATERIAL_DESCRIPTION,
  FIELD_SUPPLIER,
  FIELD_FEATURE,
  COLUMNS_REFRESH_AFTER_PART,
  PART_FIELD_KEYS,
  EDITABLE_AUTOPOPULATED_FIELDS,
  PART_LOOKUP_POPULATED_FIELDS,
} from '../../constants';
import { DataService } from '../../services/data.service';
import { SkuService } from '../../services/sku.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';

type SearchMode = 'material' | 'partNumber' | 'bomFeature' | 'country' | 'service' | 'userList' | null;

@Component({
  selector: 'app-autocomplete-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete-cell-editor.component.html',
  styleUrl: './autocomplete-cell-editor.component.css',
  host: {
    '[style.display]': '"block"',
    '[style.width]': '"100%"',
    '[style.height]': '"100%"',
    '[style.position]': '"relative"',
  },
})
export class AutocompleteCellEditorComponent
  implements ICellEditorAngularComp, OnInit, AfterViewInit, OnDestroy
{
  private readonly PAGE_SIZE: number = 20;

  @ViewChild('input') input!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdown') dropdown!: ElementRef<HTMLDivElement>;

  public value: string = '';
  public placeholder: string = '';
  public options: string[] = [];
  public filteredOptions: string[] = [];
  public filteredMaterialOptions: any[] = [];
  public materialOptions: any[] = [];
  public genericOptions: any[] = [];
  public showDropdown: boolean = false;
  public selectedIndex: number = -1;
  public searchMode: SearchMode = null;
  public isLoadingMore: boolean = false;

  private params: any;
  private originalValue: string = '';
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private isDestroyed: boolean = false;
  private currentQuery: string = '';
  private fromIndex: number = 1;
  private toIndex: number = this.PAGE_SIZE;
  private hasMore: boolean = false;
  private userListAttributeName: string = '';
  private userListType: string = '';
  /** Total count from API (serviceDataModal resultCount) for part/material search pagination display */
  totalResultCount: number = 0;

  private _positionScheduled = false;
  private _searchRequestId = 0;
  private _loadMoreRequestId = 0;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly dataService: DataService,
    private readonly skuService: SkuService,
  ) {}

  public get isMaterialSearch(): boolean {
    return this.searchMode === 'material';
  }

  public get isPartNumberSearch(): boolean {
    return this.searchMode === 'partNumber';
  }

  public get isBomFeatureSearch(): boolean {
    return this.searchMode === 'bomFeature';
  }

  public get isCountrySearch(): boolean {
    return this.searchMode === 'country';
  }

  public get isServiceSearch(): boolean {
    return this.searchMode === 'service';
  }

  public get isUserListSearch(): boolean {
    return this.searchMode === 'userList';
  }

  private getFieldName(): string {
    let fieldName = '';
    if (this.params?.colDef?.field) {
      fieldName = this.params.colDef.field;
    } else if (this.params?.column?.getColId) {
      const colId = this.params.column.getColId();
      if (colId) {
        fieldName = colId;
      }
    }

    if (fieldName === FIELD_COLOR_DESCRIPTION) {
      return FIELD_COLOR;
    }

    return fieldName;
  }

  private getGridContext(): any {
    return (this.params?.context as any) ?? this.params?.api?.getGridOption?.('context');
  }

  private getSelectedGenericOptionId(option: string, optionIndex?: number): string | null {
    if (!this.genericOptions.length) {
      return null;
    }

    if (
      optionIndex !== undefined &&
      optionIndex >= 0 &&
      optionIndex < this.genericOptions.length
    ) {
      const selectedOption = this.genericOptions[optionIndex];
      return selectedOption.id || selectedOption.displayValue || option;
    }

    const selectedOption = this.genericOptions.find(
      (entry: any) => (entry.displayValue || entry.name || '') === option
    );
    return selectedOption ? selectedOption.id || selectedOption.displayValue || option : null;
  }

  private isIdBackedGenericSearch(): boolean {
    return this.isServiceSearch || this.isCountrySearch || this.isUserListSearch;
  }

  private syncGenericOptionIdFromCurrentValue(): void {
    if (!this.isIdBackedGenericSearch() || !this.params?.node) {
      return;
    }

    const fieldName = this.getFieldName();
    if (!fieldName) {
      return;
    }

    const idFieldName = `${fieldName}Id`;
    const matchedId = this.getSelectedGenericOptionId(this.value);
    if (this.params.node.data) {
      this.params.node.data[idFieldName] = matchedId || '';
    }
  }

  ngOnInit() {
    this.originalValue = this.value;

    const searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const effectiveQuery = query ?? '';
          const requestId = ++this._searchRequestId;
          const usesApiSearch =
            (this.isMaterialSearch ||
              this.isPartNumberSearch ||
              this.isBomFeatureSearch ||
              this.isCountrySearch ||
              this.isServiceSearch ||
              this.isUserListSearch) &&
            this.dataService;

          const emptyResponse = { results: [], resultCount: 0, hasMore: false };
          const wrap = (obs: any) =>
            obs.pipe(
              map((res: any) => ({ requestId, response: res })),
              catchError(() => of({ requestId, response: emptyResponse }))
            );

          if (usesApiSearch) {
            if (this.isBomFeatureSearch) {
              if (effectiveQuery.length >= 1) {
                this.currentQuery = effectiveQuery;
                this.isLoadingMore = false;
                return wrap(this.dataService.searchBomFeatures(this.currentQuery, this.PAGE_SIZE));
              }

              this.hasMore = false;
              this.genericOptions = [];
              return of({ requestId, response: { results: [], resultCount: 0, hasMore: false } });
            }

            if (this.isCountrySearch) {
              if (effectiveQuery.length >= 1) {
                this.currentQuery = effectiveQuery;
                this.isLoadingMore = false;
                return wrap(this.dataService.searchCountriesOfOrigin(this.currentQuery, this.PAGE_SIZE));
              }

              this.hasMore = false;
              this.genericOptions = [];
              return of({ requestId, response: { results: [], resultCount: 0, hasMore: false } });
            }

            if (this.isServiceSearch) {
              if (effectiveQuery.length >= 1) {
                this.currentQuery = effectiveQuery;
                this.isLoadingMore = false;
                return wrap(this.dataService.searchServices(this.currentQuery, this.PAGE_SIZE));
              }

              this.hasMore = false;
              this.genericOptions = [];
              return of({ requestId, response: { results: [], resultCount: 0, hasMore: false } });
            }

            if (this.isUserListSearch) {
              this.currentQuery = effectiveQuery;
              this.isLoadingMore = false;
              return wrap(
                this.dataService.searchUserList(
                  this.userListType,
                  this.userListAttributeName,
                  this.currentQuery,
                  this.PAGE_SIZE,
                ),
              );
            }

            if (effectiveQuery.length >= 1) {
              this.currentQuery = effectiveQuery;
              this.fromIndex = 1;
              this.toIndex = this.PAGE_SIZE;
              this.isLoadingMore = false;
              this._loadMoreRequestId++;
              return wrap(
                this.dataService.searchMaterials(
                  effectiveQuery,
                  this.fromIndex,
                  this.toIndex,
                  this.isPartNumberSearch
                )
              );
            }

            this.fromIndex = 1;
            this.toIndex = this.PAGE_SIZE;
            this.hasMore = false;
            return of({ requestId, response: { results: [], resultCount: 0, hasMore: false } });
          }

          if (effectiveQuery.length >= 2) {
            return of({
              requestId,
              response: {
                results: this.filterLocalOptions(effectiveQuery),
                resultCount: 0,
                hasMore: false,
              },
            });
          }

          return of({ requestId, response: { results: [], resultCount: 0, hasMore: false } });
        }),
        catchError(() => {
          return of({ requestId: 0, response: { results: [], resultCount: 0, hasMore: false } });
        })
      )
      .subscribe((payload: any) => {
        this.applySearchResponse(payload);
      });
    this.subscriptions.push(searchSub);
  }

  private applySearchResponse(payload: any): void {
    if (this.isDestroyed || payload.requestId !== this._searchRequestId) {
      return;
    }

    const response = payload.response;
    const results = response.results || [];
    const resultCount = response.resultCount || 0;

    if (this.usesGenericSearchResults()) {
      this.applyGenericSearchResults(results, response.hasMore);
    } else {
      this.applyMaterialSearchResults(results, resultCount, response.hasMore);
    }

    this.finishSearchResponse();
  }

  private usesGenericSearchResults(): boolean {
    return (
      this.isBomFeatureSearch ||
      this.isCountrySearch ||
      this.isServiceSearch ||
      this.isUserListSearch
    );
  }

  private applyGenericSearchResults(results: any[], hasMore: boolean): void {
    this.genericOptions = Array.isArray(results) ? results : [];
    this.hasMore = hasMore || false;
    this.filteredOptions = this.genericOptions
      .map((feature) => feature.displayValue || feature.name || '')
      .filter((name) => name.length > 0);
  }

  private applyMaterialSearchResults(results: any[], resultCount: number, hasMore?: boolean): void {
    this.totalResultCount = resultCount;
    this.hasMore = hasMore ?? resultCount > this.toIndex;

    if (Array.isArray(results) && results.length > 0) {
      this.materialOptions =
        this.fromIndex === 1 ? results : [...this.materialOptions, ...results];
      this.buildFilteredOptionsFromMaterials();
      return;
    }

    if (this.fromIndex === 1) {
      this.materialOptions = [];
      this.filteredOptions = [];
      this.filteredMaterialOptions = [];
      this.totalResultCount = 0;
      this.hasMore = false;
    }
  }

  private finishSearchResponse(): void {
    this.isLoadingMore = false;
    this.showDropdown = this.filteredOptions.length > 0;

    if (this.showDropdown) {
      this.schedulePositionDropdown();
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.input.nativeElement.focus();
      this.input.nativeElement.select();
      this.handleInputOpen();
    }, 0);
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.closeDropdown();

    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    this.searchSubject.complete();
  }

  agInit(params: any): void {
    this.resetEditorState();
    this.params = params;
    this.initializeEditorValue(params);

    const fieldName = this.getFieldName();
    this.searchMode = this.resolveSearchMode(params, fieldName);
    this.userListAttributeName = params.userListAttributeName || fieldName || '';
    this.userListType = params.userListType || '';
    this.options = this.resolveInitialOptions(params);

    if (params.filterFunction && typeof params.filterFunction === 'function') {
      this.customFilterFunction = params.filterFunction;
    }

    this.initializeOptionsForField(fieldName);
  }

  private resetEditorState(): void {
    this.value = '';
    this.options = [];
    this.filteredOptions = [];
    this.filteredMaterialOptions = [];
    this.materialOptions = [];
    this.genericOptions = [];
    this.showDropdown = false;
    this.selectedIndex = -1;
    this.searchMode = null;
    this.isLoadingMore = false;
    this.currentQuery = '';
    this.fromIndex = 1;
    this.toIndex = this.PAGE_SIZE;
    this.hasMore = false;
    this.userListAttributeName = '';
    this.userListType = '';
    this.totalResultCount = 0;
    this.isDestroyed = false;
    this.originalValue = '';
    this.customFilterFunction = undefined;
  }

  private initializeEditorValue(params: any): void {
    this.value = params.value !== null && params.value !== undefined ? String(params.value) : '';
    this.originalValue = this.value;
    this.placeholder = params.placeholder || 'search materials...';
  }

  private resolveSearchMode(params: any, fieldName: string): SearchMode {
    if (
      params.isPartNumberSearch === true ||
      fieldName === FIELD_BOM_LINK_PART ||
      fieldName === FIELD_PART_NUMBER ||
      fieldName === FIELD_PART
    ) {
      return 'partNumber';
    }

    if (params.isBomFeatureSearch === true || fieldName === FIELD_BOM_LINK_FEATURE) {
      return 'bomFeature';
    }

    if (params.isCountrySearch === true || fieldName === FIELD_BOM_LINK_COUNTRY_OF_ORIGIN) {
      return 'country';
    }

    if (this.isServiceField(params, fieldName)) {
      return 'service';
    }

    if (params.isUserListSearch === true) {
      return 'userList';
    }

    return this.shouldUseMaterialSearch(params, fieldName) ? 'material' : null;
  }

  private isServiceField(params: any, fieldName: string): boolean {
    return (
      params.isServiceSearch === true ||
      fieldName === 'materialColorServiceSubstituteOne' ||
      fieldName === 'materialColorServiceSubstituteTwo' ||
      fieldName === 'materialColorServiceEquivalent'
    );
  }

  private shouldUseMaterialSearch(params: any, fieldName: string): boolean {
    return (
      params.useApiSearch === true ||
      (this.dataService &&
        (this.placeholder.includes('material') || this.placeholder.includes('Material'))) ||
      (this.dataService && (fieldName === FIELD_MATERIAL || fieldName === FIELD_MATERIAL_DESCRIPTION))
    );
  }

  private resolveInitialOptions(params: any): string[] {
    let valuesParam = params.values;
    if (typeof valuesParam === 'function') {
      valuesParam = valuesParam(params);
    }

    if (Array.isArray(valuesParam)) {
      return this.normalizeOptions(valuesParam);
    }

    if (Array.isArray(params.options)) {
      return this.normalizeOptions(params.options);
    }

    if (typeof params.options === 'function') {
      return this.normalizeOptions(params.options());
    }

    return [];
  }

  private normalizeOptions(options: any[]): string[] {
    return options.map((opt: any) => String(opt)).filter((opt: string) => opt.length > 0);
  }

  private initializeOptionsForField(fieldName: string): void {
    if (this.isColorOrSupplierField(fieldName)) {
      this.refreshOptionsFromNodeData();
      return;
    }

    if (this.options.length > 0 && !this.usesApiSearch()) {
      this.filterOptions();
    }
  }

  getValue(): any {
    this.syncGenericOptionIdFromCurrentValue();
    return this.value;
  }

  isPopup(): boolean {
    return false;
  }

  onInputChange(event: any): void {
    this.value = event.target.value || '';
    this.refreshDependentOptionsWhenCleared();
    this.syncGenericIdIfNeeded();
    this.updateOptionsForInputValue();
    this.selectedIndex = -1;
    this.scheduleDropdownIfVisible();
  }

  private refreshDependentOptionsWhenCleared(): void {
    if (this.isColorOrSupplierField(this.getFieldName()) && !this.value) {
      this.refreshOptionsFromNodeData();
    }
  }

  private syncGenericIdIfNeeded(): void {
    if (this.isIdBackedGenericSearch()) {
      this.syncGenericOptionIdFromCurrentValue();
    }
  }

  private updateOptionsForInputValue(): void {
    if (this.usesApiSearch()) {
      this.searchSubject.next(this.value);
      return;
    }

    if (!this.value && this.options.length > 0) {
      this.filteredOptions = this.options.slice(0, 50);
      this.showDropdown = this.filteredOptions.length > 0;
      return;
    }

    this.filterOptions();
    this.showDropdown = this.filteredOptions.length > 0;
  }

  private usesApiSearch(): boolean {
    return this.searchMode !== null && !!this.dataService;
  }

  private isColorOrSupplierField(fieldName: string): boolean {
    return fieldName === FIELD_COLOR || fieldName === FIELD_SUPPLIER;
  }

  private scheduleDropdownIfVisible(): void {
    if (this.showDropdown) {
      this.schedulePositionDropdown();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredOptions.length) {
          this.selectOption(this.filteredOptions[this.selectedIndex], this.selectedIndex);
        } else if (this.filteredOptions.length === 1) {
          this.selectOption(this.filteredOptions[0], 0);
        } else {
          this.closeDropdown();
          setTimeout(() => {
            if (this.params && this.params.api) {
              this.params.api.stopEditing();
            }
          }, 10);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.value = this.originalValue;
        this.closeDropdown();
        break;
      case 'Tab':
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredOptions.length) {
          event.preventDefault();
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        }
        break;
    }
  }

  onBlur(): void {}

  onInputClick(): void {
    this.handleInputOpen();
  }

  onInputFocus(): void {
    this.handleInputOpen();
  }

  private refreshOptionsFromNodeData(): void {
    if (!this.params || !this.params.node) return;

    const fieldName = this.getFieldName();
    const nodeData = this.params.node.data || {};

    if (fieldName !== FIELD_SUPPLIER && fieldName !== FIELD_COLOR) return;

    const filteredValues =
      (fieldName === FIELD_SUPPLIER && Array.isArray(nodeData._availableSuppliers)
        ? nodeData._availableSuppliers
        : fieldName === FIELD_COLOR && Array.isArray(nodeData._availableColors)
        ? nodeData._availableColors
        : null) || [];

    // Use filtered values or refresh from cellEditorParams
    if (filteredValues.length > 0) {
      this.options = filteredValues
        .map((opt: any) => String(opt))
        .filter((opt: string) => opt.length > 0);
    } else {
      let valuesParam = this.params.values;
      if (typeof valuesParam === 'function') {
        valuesParam = valuesParam(this.params);
      }
      if (Array.isArray(valuesParam)) {
        this.options = valuesParam
          .map((opt: any) => String(opt))
          .filter((opt: string) => opt.length > 0);
      }
    }

    if (this.options.length > 0) {
      this.filterOptions();
    }
  }

  onDropdownScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.isLoadingMore || !this.hasMore) return;

    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 50) {
      this.loadMoreResults();
    }
  }

  private loadMoreResults(): void {
    if (!this.canLoadMoreMaterialResults()) {
      return;
    }

    this.isLoadingMore = true;
    const queryForThisLoad = this.currentQuery;
    const loadMoreId = ++this._loadMoreRequestId;
    this.advanceMaterialPagination();

    const loadMoreSub = this.dataService
      .searchMaterials(queryForThisLoad, this.fromIndex, this.toIndex, this.isPartNumberSearch)
      .subscribe({
        next: (response) => this.applyLoadMoreResponse(response, queryForThisLoad, loadMoreId),
        error: () => this.failLoadMoreRequest(),
      });
    this.subscriptions.push(loadMoreSub);
  }

  private canLoadMoreMaterialResults(): boolean {
    return (
      (this.isMaterialSearch || this.isPartNumberSearch) &&
      !this.isLoadingMore &&
      this.hasMore &&
      !!this.dataService &&
      !!this.currentQuery
    );
  }

  private advanceMaterialPagination(): void {
    this.fromIndex = this.toIndex + 1;
    this.toIndex = this.fromIndex + (this.PAGE_SIZE - 1);
  }

  private applyLoadMoreResponse(response: any, queryForThisLoad: string, loadMoreId: number): void {
    if (this.isStaleLoadMoreResponse(queryForThisLoad, loadMoreId)) {
      this.isLoadingMore = false;
      return;
    }

    const materials = response.results || [];
    const resultCount = response.resultCount || 0;
    this.hasMore = resultCount > this.toIndex;

    if (Array.isArray(materials) && materials.length > 0) {
      this.materialOptions = [...this.materialOptions, ...materials];
      this.buildFilteredOptionsFromMaterials();
    } else {
      this.hasMore = false;
    }

    this.isLoadingMore = false;
  }

  private isStaleLoadMoreResponse(queryForThisLoad: string, loadMoreId: number): boolean {
    return (
      this.isDestroyed ||
      queryForThisLoad !== this.currentQuery ||
      loadMoreId !== this._loadMoreRequestId
    );
  }

  private failLoadMoreRequest(): void {
    this.isLoadingMore = false;
    this.hasMore = false;
  }

  selectOption(option: string, optionIndex?: number): void {
    this.value = option;
    this.closeDropdown();

    if (!this.params?.node) {
      return;
    }

    const fieldName = this.getFieldName();
    const selectedMaterial = this.findSelectedMaterial(option, optionIndex);
    const clearSkuOnPartChange = this.shouldClearSkuOnPartChange(fieldName, option);

    this.applySelectedValueToRow(fieldName, option, optionIndex);
    this.applySelectionSideEffects(fieldName, option, selectedMaterial, clearSkuOnPartChange);
    this.refreshSelectionCells(fieldName, selectedMaterial);
    this.markNewRowAsEditedIfNeeded(fieldName);
    this.stopEditingAsync();
  }

  private findSelectedMaterial(option: string, optionIndex?: number): any {
    if (!this.isMaterialSearch && !this.isPartNumberSearch) {
      return null;
    }

    if (
      optionIndex !== undefined &&
      optionIndex >= 0 &&
      optionIndex < this.filteredMaterialOptions.length
    ) {
      return this.filteredMaterialOptions[optionIndex];
    }

    return this.materialOptions.find((material) => this.materialMatchesOption(material, option));
  }

  private materialMatchesOption(material: any, option: string): boolean {
    if (this.isPartNumberSearch) {
      return (material.materialColorPartNumber || '') === option;
    }

    const materialLabel =
      material.material || material.ptcmaterialName || material.materialName || material.name || '';
    return materialLabel === option;
  }

  private shouldClearSkuOnPartChange(fieldName: string, option: string): boolean {
    if (!PART_FIELD_KEYS.includes(fieldName)) {
      return false;
    }

    const data = this.params.node.data || {};
    const previousPart = data[FIELD_PART_NUMBER] ?? data[FIELD_BOM_LINK_PART] ?? data[FIELD_PART] ?? '';
    return !!data.isNewRow && String(previousPart ?? '').trim() !== String(option ?? '').trim();
  }

  private applySelectedValueToRow(fieldName: string, option: string, optionIndex?: number): void {
    if (!fieldName) {
      return;
    }

    this.params.node.setDataValue(fieldName, option);
    this.applyFeatureSelection(fieldName, option, optionIndex);
    this.applyGenericSelectionId(fieldName, option, optionIndex);
    this.applyPartSelection(fieldName, option);
  }

  private applyFeatureSelection(fieldName: string, option: string, optionIndex?: number): void {
    if (fieldName !== FIELD_BOM_LINK_FEATURE) {
      return;
    }

    this.params.node.setDataValue(FIELD_FEATURE, option);
    const selectedFeatureId = this.isBomFeatureSearch
      ? this.getSelectedGenericOptionId(option, optionIndex)
      : null;
    if (this.params.node?.data) {
      this.params.node.data.bomLinkFeatureId = selectedFeatureId ? String(selectedFeatureId) : '';
    }
  }

  private applyGenericSelectionId(fieldName: string, option: string, optionIndex?: number): void {
    if (!this.isIdBackedGenericSearch() || this.genericOptions.length === 0) {
      return;
    }

    const selectedGenericId = this.getSelectedGenericOptionId(option, optionIndex);
    if (this.params.node.data) {
      this.params.node.data[`${fieldName}Id`] = selectedGenericId || '';
    }
  }

  private applyPartSelection(fieldName: string, option: string): void {
    if (fieldName !== FIELD_PART_NUMBER && fieldName !== FIELD_BOM_LINK_PART) {
      return;
    }

    this.params.node.setDataValue(FIELD_PART, option);
    if (!option || String(option).trim() === '') {
      this.clearAutopopulatedFieldsWhenPartCleared();
    }
  }

  private applySelectionSideEffects(
    fieldName: string,
    option: string,
    selectedMaterial: any,
    clearSkuOnPartChange: boolean,
  ): void {
    if (selectedMaterial) {
      this.autoPopulateFields(selectedMaterial, { clearSkuOnPartChange });
      this.markPartChangeAsEditedIfNeeded(fieldName);
      return;
    }

    if (!this.usesApiSearch()) {
      this.triggerFeatureAutoPopulation(option);
    }

    if (clearSkuOnPartChange && PART_FIELD_KEYS.includes(fieldName)) {
      this.clearSkuValuesForRow();
    }
  }

  private markPartChangeAsEditedIfNeeded(fieldName: string): void {
    if (PART_FIELD_KEYS.includes(fieldName)) {
      this.markExistingRowAsEditedForPartChange(fieldName);
    }
  }

  private refreshSelectionCells(fieldName: string, selectedMaterial: any): void {
    if (!this.params.api) {
      return;
    }

    this.params.api.refreshCells({
      rowNodes: [this.params.node],
      columns: this.getSelectionRefreshColumns(fieldName, selectedMaterial),
      force: true,
    });
  }

  private getSelectionRefreshColumns(fieldName: string, selectedMaterial: any): string[] {
    const columnsToRefresh = [fieldName];
    if (selectedMaterial && this.isMaterialOrPartSearch() && this.isMaterialOrPartField(fieldName)) {
      columnsToRefresh.push(...COLUMNS_REFRESH_AFTER_PART);
    }
    return columnsToRefresh;
  }

  private isMaterialOrPartSearch(): boolean {
    return this.isMaterialSearch || this.isPartNumberSearch;
  }

  private isMaterialOrPartField(fieldName: string): boolean {
    return (
      fieldName === FIELD_MATERIAL ||
      fieldName === FIELD_MATERIAL_DESCRIPTION ||
      fieldName === FIELD_PART_NUMBER ||
      fieldName === FIELD_BOM_LINK_PART
    );
  }

  private stopEditingAsync(): void {
    setTimeout(() => {
      this.params?.api?.stopEditing();
    }, 0);
  }

  private markNewRowAsEditedIfNeeded(fieldName: string): void {
    const data = this.params?.node?.data;
    if (!data?.isNewRow) return;
    const ctx = this.getGridContext();
    const rowManagementService = (ctx as any)?.rowManagementService;
    const editedRows = (ctx as any)?.editedRows as Set<string | number> | undefined;
    const editedFields = (ctx as any)?.editedFields as Map<string | number, Set<string>> | undefined;
    if (!rowManagementService || !editedRows || !editedFields) return;

    rowManagementService.syncRowFieldEditState({
      rowData: data,
      fieldName,
      newValue: data?.[fieldName],
      editedRows,
      editedFields,
      originalRowValues: (ctx as any)?.originalRowValues,
    });

    if (fieldName === FIELD_PART_NUMBER || fieldName === FIELD_BOM_LINK_PART) {
      rowManagementService.syncRowFieldEditState({
        rowData: data,
        fieldName: FIELD_PART,
        newValue: data?.[FIELD_PART],
        editedRows,
        editedFields,
        originalRowValues: (ctx as any)?.originalRowValues,
      });
    }
  }

  private markExistingRowAsEditedForPartChange(fieldName: string): void {
    const data = this.params?.node?.data;
    if (!data || data.isNewRow) return;
    const ctx = this.getGridContext();
    const rowManagementService = (ctx as any)?.rowManagementService;
    const editedRows = (ctx as any)?.editedRows as Set<string | number> | undefined;
    const editedFields = (ctx as any)?.editedFields as Map<string | number, Set<string>> | undefined;
    if (!rowManagementService || !editedRows || !editedFields) return;

    const originalRowValues = (ctx as any)?.originalRowValues;
    const fieldsToMark = new Set<string>([
      fieldName,
      FIELD_PART_NUMBER,
      FIELD_BOM_LINK_PART,
      FIELD_PART,
    ]);

    fieldsToMark.forEach((f) => {
      rowManagementService.syncRowFieldEditState({
        rowData: data,
        fieldName: f,
        newValue: data?.[f],
        editedRows,
        editedFields,
        originalRowValues,
      });
    });
  }

  private filterLocalOptions(query: string): string[] {
    if (!this.options || this.options.length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase();
    return this.options.filter((option) => option.toLowerCase().includes(searchTerm));
  }

  private clearSkuValuesForRow(): void {
    if (!this.params?.node || !this.dataService) return;
    const node = this.params.node;
    const skuFieldNames = this.skuService.getFieldNames(this.dataService.getSkuInfo());
    skuFieldNames.forEach((fieldName) => {
      const currentValue = node.data?.[fieldName];
      if (currentValue !== '' && currentValue !== null && currentValue !== undefined) {
        node.setDataValue(fieldName, '');
      }
    });
  }

  private clearAutopopulatedFieldsWhenPartCleared(): void {
    if (!this.params?.node?.data) return;
    const node = this.params.node;
    const data = node.data;
    const fieldsToClear = [
      ...EDITABLE_AUTOPOPULATED_FIELDS,
      'colorId',
      'materialSupplierMasterId',
      '_availablePartNumbers',
    ];
    fieldsToClear.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        node.setDataValue(field, field === '_availablePartNumbers' ? [] : '');
      }
    });
    this.clearSkuValuesForRow();
    if (this.params.api) {
      this.params.api.refreshCells({ rowNodes: [node], force: true });
    }
  }

  /**
   * Populate row from dropdown selection using only serviceDataModal.json / API structure:
   * - responseColumns: which fields exist in the response (single source of truth)
   * - flatInstance: flat key-value for the selected row (materialColorPartNumber, material, supplier, color, colorId, childId, etc.)
   * For each column in responseColumns, set row[key] = flatInstance[key]. If a column is in the grid but not in
   * responseColumns, it is not filled (no error). Internal IDs (colorId, materialSupplierMasterId) are set for save.
   */
  private autoPopulateFields(material: any, options?: { clearSkuOnPartChange?: boolean }): void {
    if (!this.params?.node) {
      return;
    }

    const flatInstance = material?.flatInstance;
    if (!flatInstance || typeof flatInstance !== 'object') {
      return;
    }

    const originalData = { ...this.params.node.data };
    const setSkip = this.getGridContext()?.setSkipEditTracking;

    try {
      setSkip?.(true);
      this.applyMaterialColorId(material);
      this.applyFlatInstanceColumns(flatInstance, material?.responseColumns, originalData);
      this.applyFlatInstanceIdentifiers(flatInstance, originalData);
      this.refreshDependentDropdownData(flatInstance, material);
      this.applySkuUpdatesFromMaterial(material, originalData, options?.clearSkuOnPartChange === true);
    } finally {
      setTimeout(() => setSkip?.(false), 0);
    }
  }

  private applyMaterialColorId(material: any): void {
    if (!material?.materialColorId || !this.params.node?.data) {
      return;
    }

    this.params.node.data.materialColorId = material.materialColorId;
    this.params.node.setDataValue('materialColorId', material.materialColorId);
  }

  private applyFlatInstanceColumns(flatInstance: any, responseColumns: any, originalData: any): void {
    const columnKeys = this.resolveResponseColumnKeys(flatInstance, responseColumns);
    columnKeys.forEach((key) => {
      if (!(key in flatInstance) || originalData[key] === flatInstance[key]) {
        return;
      }
      this.params.node.setDataValue(key, flatInstance[key]);
    });
  }

  private resolveResponseColumnKeys(flatInstance: any, responseColumns: any): string[] {
    return responseColumns && typeof responseColumns === 'object'
      ? Object.keys(responseColumns)
      : Object.keys(flatInstance);
  }

  private applyFlatInstanceIdentifiers(flatInstance: any, originalData: any): void {
    this.setStringValueIfPresent('colorId', flatInstance.colorId);
    this.setStringValueIfPresent('childId', flatInstance.childId);

    const partValue = this.toNonEmptyString(flatInstance.materialColorPartNumber);
    const materialValue = this.toNonEmptyString(flatInstance.material);

    if (partValue) {
      this.setPartIdentifiers(partValue);
    }
    if (partValue && originalData[FIELD_PART] !== partValue) {
      this.params.node.setDataValue(FIELD_PART, partValue);
    }
    if (materialValue && originalData[FIELD_MATERIAL_DESCRIPTION] !== materialValue) {
      this.params.node.setDataValue(FIELD_MATERIAL_DESCRIPTION, materialValue);
    }
    if (flatInstance.color != null && originalData[FIELD_COLOR_DESCRIPTION] !== flatInstance.color) {
      this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, String(flatInstance.color));
    }
  }

  private setStringValueIfPresent(fieldName: string, value: any): void {
    if (value == null || String(value) === '') {
      return;
    }

    const stringValue = String(value);
    this.params.node.data[fieldName] = stringValue;
    this.params.node.setDataValue(fieldName, stringValue);
  }

  private toNonEmptyString(value: any): string {
    return value != null ? String(value) : '';
  }

  private refreshDependentDropdownData(flatInstance: any, material: any): void {
    const partValue = this.toNonEmptyString(flatInstance.materialColorPartNumber);
    const materialValue = this.toNonEmptyString(flatInstance.material);

    if (this.isPartNumberSearch && partValue && this.dataService) {
      this.fetchAllPartsForDropdowns(partValue, material);
    }
    if (!this.isPartNumberSearch && materialValue) {
      this.fetchAllMaterialsForDropdowns(material);
    }
  }

  private applySkuUpdatesFromMaterial(
    material: any,
    originalData: any,
    clearSkuOnPartChange: boolean,
  ): void {
    if (clearSkuOnPartChange) {
      this.clearSkuValuesForRow();
      return;
    }

    const skuInfoPart = this.dataService?.getSkuInfo();
    if (!material.skus || !Array.isArray(material.skus) || !skuInfoPart?.length) {
      return;
    }

    const skuUpdates = this.skuService.buildSkuFieldUpdates({
      skuInfo: skuInfoPart,
      sourceSkus: material.skus,
    });
    this.skuService.applySkuFieldUpdates({
      row: this.params?.node?.data,
      updates: skuUpdates,
      setDataValue: (fieldName, value) => this.params.node.setDataValue(fieldName, value),
      shouldApply: (update) => originalData[update.fieldName] !== update.value,
    });
  }

  private triggerFeatureAutoPopulation(partNumber: string): void {
    const dataService = this.getGridContext()?.dataService;

    if (dataService) {
      this.triggerFeatureAutoPopulationWithService(partNumber, dataService);
    } else {
      if (this.params && this.params.api) {
        const gridContext = this.params.api.getGridOption('context');
        const fallbackDataService = gridContext?.dataService;
        if (fallbackDataService) {
          this.triggerFeatureAutoPopulationWithService(partNumber, fallbackDataService);
        }
      }
    }
  }

  private triggerFeatureAutoPopulationWithService(partNumber: string, dataService: any): void {
    const apiData = dataService.getApiData();
    const items = Array.isArray(apiData?.instances) ? apiData.instances : [];
    if (items.length === 0) {
      return;
    }
    const existingPart = items.find((item: any) => {
      const bomLink = item[BOM_LINK_KEY];
      return bomLink?.[FIELD_PART_NUMBER] === partNumber;
    });
    if (existingPart) {
      const partData = existingPart[BOM_LINK_KEY];
      if (this.params && this.params.node) {
        const fieldsToPopulate = PART_LOOKUP_POPULATED_FIELDS;

        const oldData = { ...this.params.node.data };

        fieldsToPopulate.forEach((fieldName) => {
          if (partData[fieldName] !== undefined && partData[fieldName] !== null) {
            if (oldData[fieldName] !== partData[fieldName]) {
              this.params.node.setDataValue(fieldName, partData[fieldName]);
            }
          }
        });

        const skuInfo = dataService.getSkuInfo();
        const skuUpdates = this.skuService.buildSkuFieldUpdates({
          skuInfo,
          sourceSkus: partData.skus,
        });
        this.skuService.applySkuFieldUpdates({
          row: this.params?.node?.data,
          updates: skuUpdates,
          setDataValue: (fieldName, value) => this.params.node.setDataValue(fieldName, value),
          shouldApply: (update) => oldData[update.fieldName] !== update.value,
        });

        const partIdentifier = partData?.[FIELD_PART_NUMBER];
        if (partIdentifier) {
          this.setPartIdentifiers(partIdentifier);
        }

        if (this.params.api) {
          this.params.api.refreshCells({
            rowNodes: [this.params.node],
            force: true,
          });
        }
      }
    }
  }

  private filterOptions(): void {
    const searchValue = String(this.value || '')
      .toLowerCase()
      .trim();

    if (this.customFilterFunction) {
      this.filteredOptions = this.customFilterFunction(searchValue, this.options);
    } else {
      if (!searchValue) {
        this.filteredOptions = this.options.slice(0, 8);
      } else {
        const startsWith: string[] = [];
        const contains: string[] = [];
        const maxStartsWith = 6;
        const maxContains = 4;
        for (let i = 0; i < this.options.length; i++) {
          const option = this.options[i];
          const optionLower = String(option).toLowerCase();
          if (optionLower.startsWith(searchValue)) {
            if (startsWith.length < maxStartsWith) startsWith.push(option);
          } else if (optionLower.includes(searchValue)) {
            if (contains.length < maxContains) contains.push(option);
          }
          if (startsWith.length >= maxStartsWith && contains.length >= maxContains) break;
        }
        this.filteredOptions = [...startsWith, ...contains];
      }
    }

    this.showDropdown = this.filteredOptions.length > 0;
    this.setInitialSelectedIndex();
  }

  private setInitialSelectedIndex(): void {
    if (this.filteredOptions.length === 0) {
      this.selectedIndex = -1;
      return;
    }

    // Try to find exact match first
    const currentValue = String(this.value || '');
    let index = this.filteredOptions.findIndex((opt) => opt === currentValue);

    // If no exact match (and not empty), try case-insensitive
    if (index === -1 && currentValue) {
      const lowerValue = currentValue.toLowerCase();
      index = this.filteredOptions.findIndex((opt) => String(opt).toLowerCase() === lowerValue);
    }

    // If still not found, default to 0
    this.selectedIndex = index >= 0 ? index : 0;
  }

  private buildFilteredOptionsFromMaterials(): void {
    if (!this.materialOptions || this.materialOptions.length === 0) {
      this.filteredOptions = [];
      this.filteredMaterialOptions = [];
      return;
    }

    const labels: string[] = [];
    const materials: any[] = [];

    this.materialOptions.forEach((material: any) => {
      const label = this.isPartNumberSearch
        ? (material.materialColorPartNumber || '')
        : (material.material || material.ptcmaterialName || material.materialName || material.name || '');

      if (label.length > 0) {
        labels.push(label);
        materials.push(material);
      }
    });

    this.filteredOptions = labels;
    this.filteredMaterialOptions = materials;
  }

  private setPartIdentifiers(partValue: string): void {
    if (!partValue || !this.params || !this.params.node) {
      return;
    }

    const targetFields = [...PART_FIELD_KEYS];
    const updatedColumns: string[] = [];

    targetFields.forEach((field) => {
      const currentValue = this.params.node.data ? this.params.node.data[field] : undefined;
      if (currentValue !== partValue) {
        this.params.node.setDataValue(field, partValue);
        updatedColumns.push(field);
      }
    });

    if (updatedColumns.length > 0 && this.params.api) {
      const existingColumns = updatedColumns.filter(
        (field) => !!this.params.api.getColumn(field)
      );
      if (existingColumns.length > 0) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: existingColumns,
          force: true,
        });
      }
    }
  }

  private closeDropdown(): void {
    this.showDropdown = false;
    this.selectedIndex = -1;
  }

  /** Single rAF throttle for dropdown positioning to avoid layout thrash from focus/click/init. */
  private schedulePositionDropdown(): void {
    if (this._positionScheduled || !this.showDropdown) return;
    this._positionScheduled = true;
    requestAnimationFrame(() => {
      this._positionScheduled = false;
      if (this.showDropdown) {
        this.positionDropdown();
      }
    });
  }

  /** Shared logic for focus, click, and init: refresh options and schedule positioning. */
  private handleInputOpen(): void {
    this.refreshOptionsFromNodeData();

    const usesApiSearch =
      this.isMaterialSearch ||
      this.isPartNumberSearch ||
      this.isBomFeatureSearch ||
      this.isCountrySearch ||
      this.isServiceSearch ||
      this.isUserListSearch;

    if (usesApiSearch) {
      if (this.dataService) {
        if (this.isUserListSearch) {
          this.searchSubject.next('');
        } else if (this.value && this.value.length >= 1) {
          this.searchSubject.next(this.value);
        }
      }
    } else {
      if (this.options.length > 0) {
        this.filteredOptions = this.options.slice(0, 50);
        this.showDropdown = this.filteredOptions.length > 0;
        this.setInitialSelectedIndex();
      }
    }

    if (this.showDropdown) {
      this.schedulePositionDropdown();
    }
  }

  private positionDropdown(): void {
    if (!this.dropdown || !this.input) {
      return;
    }

    const dropdownElement = this.dropdown.nativeElement;
    const inputElement = this.input.nativeElement;

    try {
      // Explicitly set visibility properties
      dropdownElement.style.display = 'block';
      dropdownElement.style.visibility = 'visible';
      dropdownElement.style.opacity = '1';

      const inputRect = inputElement.getBoundingClientRect();
      const container = inputElement.offsetParent || this.document.body;
      const containerRect = container.getBoundingClientRect();

      const relativeTop = inputRect.bottom - containerRect.top + 2;
      const relativeLeft = inputRect.left - containerRect.left;

      dropdownElement.style.top = `${relativeTop}px`;
      dropdownElement.style.left = `${relativeLeft}px`;

      dropdownElement.style.width = `${inputRect.width}px`;
      dropdownElement.style.minWidth = `${inputRect.width}px`;

      const actualDropdownHeight =
        dropdownElement.offsetHeight || dropdownElement.scrollHeight || 200;
      const viewportHeight = this.document.defaultView?.innerHeight || 0;
      const dropdownHeight = Math.min(actualDropdownHeight, 200);

      if (inputRect.bottom + dropdownHeight > viewportHeight) {
        if (inputRect.top - dropdownHeight > 0) {
          const relativeTopAbove = inputRect.top - containerRect.top - dropdownHeight - 2;
          dropdownElement.style.top = `${relativeTopAbove}px`;
        }
      }

      const viewportWidth = this.document.defaultView?.innerWidth || 0;
      const dropdownWidth = inputRect.width;

      if (inputRect.left + dropdownWidth > viewportWidth) {
        const adjustedLeft = Math.max(0, viewportWidth - dropdownWidth - 10);
        const relativeAdjustedLeft = adjustedLeft - containerRect.left;
        dropdownElement.style.left = `${relativeAdjustedLeft}px`;
      }

      // Force reflow to ensure positioning is applied
      dropdownElement.offsetHeight;
    } catch {
      this.positionDropdownFallback();
    }
  }

  private positionDropdownFallback(): void {
    if (!this.dropdown || !this.input) {
      return;
    }

    const dropdownElement = this.dropdown.nativeElement;
    dropdownElement.style.top = '100%';
    dropdownElement.style.left = '0';
    dropdownElement.style.width = '100%';
    dropdownElement.style.position = 'absolute';
  }

  private fetchAllMaterialsForDropdowns(selectedMaterial: any): void {
    if (!this.params?.node || !selectedMaterial?.flatInstance) {
      return;
    }

    const values = this.getSelectedMaterialDropdownValues(selectedMaterial);
    this.applyAvailableDropdownValues(values);
    this.syncColorAndSupplierValues(values);
    this.syncPartNumberValue(values.partNumber);
  }

  private getSelectedMaterialDropdownValues(selectedMaterial: any): {
    colorName: string;
    supplierName: string;
    partNumber: string;
  } {
    const flatInstance = selectedMaterial.flatInstance;
    return {
      colorName: flatInstance.color ?? '',
      supplierName: flatInstance.supplier ?? '',
      partNumber: flatInstance.materialColorPartNumber ?? selectedMaterial.materialColorPartNumber ?? '',
    };
  }

  private applyAvailableDropdownValues(values: {
    colorName: string;
    supplierName: string;
    partNumber: string;
  }): void {
    this.params.node.setDataValue('_availableColors', values.colorName ? [values.colorName] : []);
    this.params.node.setDataValue(
      '_availableSuppliers',
      values.supplierName ? [values.supplierName] : [],
    );

    if (values.partNumber) {
      this.params.node.setDataValue('_availablePartNumbers', [values.partNumber]);
    }
  }

  private syncColorAndSupplierValues(values: { colorName: string; supplierName: string }): void {
    const currentData = this.params.node.data || {};
    const existingColor = currentData[FIELD_COLOR] || currentData[FIELD_COLOR_DESCRIPTION] || '';
    const existingSupplier = currentData[FIELD_SUPPLIER] || '';

    if (values.colorName && existingColor !== values.colorName) {
      this.params.node.setDataValue(FIELD_COLOR, values.colorName);
      this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, values.colorName);
    }

    if (values.supplierName && existingSupplier !== values.supplierName) {
      this.params.node.setDataValue(FIELD_SUPPLIER, values.supplierName);
    }
  }

  private syncPartNumberValue(partNumber: string): void {
    const partFieldName = this.resolvePartFieldName();
    const existingPartNumber = this.getExistingPartNumber(partFieldName);
    if (!partNumber || existingPartNumber === partNumber) {
      return;
    }

    this.params.node.setDataValue(partFieldName, partNumber);
    this.params.api?.refreshCells({
      rowNodes: [this.params.node],
      columns: [partFieldName],
      force: true,
    });
  }

  private resolvePartFieldName(): string {
    const fieldName = this.getFieldName();
    return fieldName === FIELD_BOM_LINK_PART || fieldName === FIELD_PART_NUMBER
      ? fieldName
      : FIELD_BOM_LINK_PART;
  }

  private getExistingPartNumber(partFieldName: string): string {
    const currentData = this.params.node.data || {};
    return (
      currentData[partFieldName] ||
      currentData[FIELD_BOM_LINK_PART] ||
      currentData[FIELD_PART_NUMBER] ||
      currentData[FIELD_PART] ||
      ''
    );
  }

  private fetchAllPartsForDropdowns(partNumber: string, selectedMaterial: any): void {
    if (!this.canFetchPartDropdownOptions(partNumber, selectedMaterial)) {
      return;
    }

    const initialValues = this.getInitialPartDropdownValues(selectedMaterial);
    this.applyInitialPartDropdownValues(initialValues);

    const materialsSub = this.dataService.searchMaterials(partNumber, 1, 1000, true).subscribe({
      next: (response) => this.applyPartDropdownOptions(response, initialValues),
      error: () => {},
    });
    this.subscriptions.push(materialsSub);
  }

  private canFetchPartDropdownOptions(partNumber: string, selectedMaterial: any): boolean {
    return !!this.params?.node && !!selectedMaterial && !!this.dataService && !!partNumber;
  }

  private getInitialPartDropdownValues(selectedMaterial: any): {
    colorName: string;
    supplierName: string;
  } {
    const flatInstance = selectedMaterial.flatInstance;
    return {
      colorName: flatInstance?.color ?? selectedMaterial.color ?? '',
      supplierName: flatInstance?.supplier ?? selectedMaterial.supplier ?? '',
    };
  }

  private applyInitialPartDropdownValues(values: { colorName: string; supplierName: string }): void {
    if (values.colorName) {
      this.params.node.setDataValue('_availableColors', [values.colorName]);
    }

    if (values.supplierName) {
      this.params.node.setDataValue('_availableSuppliers', [values.supplierName]);
    }
  }

  private applyPartDropdownOptions(
    response: any,
    initialValues: { colorName: string; supplierName: string },
  ): void {
    if (this.isDestroyed || !this.params?.node) {
      return;
    }

    const availableOptions = this.buildPartDropdownOptions(response.results || [], initialValues);
    this.params.node.setDataValue('_availableColors', availableOptions.colors);
    this.params.node.setDataValue('_availableSuppliers', availableOptions.suppliers);

    this.reconcileColorSelection(availableOptions.colors, initialValues.colorName);
    this.reconcileSupplierSelection(availableOptions.suppliers, initialValues.supplierName);
    this.refreshPartDependentCells();
  }

  private buildPartDropdownOptions(
    parts: any[],
    initialValues: { colorName: string; supplierName: string },
  ): { colors: string[]; suppliers: string[] } {
    const colors = new Set<string>();
    const suppliers = new Set<string>();

    parts.forEach((part: any) => {
      const flatInstance = part.flatInstance;
      const colorName = flatInstance?.color ?? part.color ?? '';
      const supplierName = flatInstance?.supplier ?? part.supplier ?? '';
      if (colorName) colors.add(colorName);
      if (supplierName) suppliers.add(supplierName);
    });

    if (initialValues.colorName) {
      colors.add(initialValues.colorName);
    }
    if (initialValues.supplierName) {
      suppliers.add(initialValues.supplierName);
    }

    return {
      colors: Array.from(colors).sort(),
      suppliers: Array.from(suppliers).sort(),
    };
  }

  private reconcileColorSelection(availableColors: string[], initialColorValue: string): void {
    const currentData = this.params.node.data || {};
    const existingColor = currentData[FIELD_COLOR] || currentData[FIELD_COLOR_DESCRIPTION] || '';

    if (availableColors.length === 1 && initialColorValue && existingColor !== initialColorValue) {
      this.params.node.setDataValue(FIELD_COLOR, initialColorValue);
      this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, initialColorValue);
      return;
    }

    if (availableColors.length > 1 && existingColor && !availableColors.includes(existingColor)) {
      this.params.node.setDataValue(FIELD_COLOR, '');
      this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, '');
    }
  }

  private reconcileSupplierSelection(availableSuppliers: string[], initialSupplierValue: string): void {
    const currentData = this.params.node.data || {};
    const existingSupplier = currentData[FIELD_SUPPLIER] || '';

    if (availableSuppliers.length === 1 && initialSupplierValue && existingSupplier !== initialSupplierValue) {
      this.params.node.setDataValue(FIELD_SUPPLIER, initialSupplierValue);
      return;
    }

    if (
      availableSuppliers.length > 1 &&
      existingSupplier &&
      !availableSuppliers.includes(existingSupplier)
    ) {
      this.params.node.setDataValue(FIELD_SUPPLIER, '');
    }
  }

  private refreshPartDependentCells(): void {
    this.params.api?.refreshCells({
      rowNodes: [this.params.node],
      columns: [...COLUMNS_REFRESH_AFTER_PART],
      force: true,
    });
  }

}
