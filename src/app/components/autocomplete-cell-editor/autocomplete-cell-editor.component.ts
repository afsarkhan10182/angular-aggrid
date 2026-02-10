import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import {
  BOM_LINK_KEY,
  BOM_TYPE_EBOM,
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
  FIELD_QUANTITY,
  FIELD_BOM_LINK_START_DATE,
  FIELD_BOM_LINK_END_DATE,
} from '../../constants';
import { DataService } from '../../services/data.service';
import { UtilService } from '../../services/util.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-autocomplete-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autocomplete-cell-editor.component.html',
  styleUrls: ['./autocomplete-cell-editor.component.css'],
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
  public isMaterialSearch: boolean = false;
  public isPartNumberSearch: boolean = false;
  public isBomFeatureSearch: boolean = false;
  public isCountrySearch: boolean = false;
  public isServiceSearch: boolean = false;
  public isLoadingMore: boolean = false;

  private params: any;
  private originalValue: string = '';
  private lastPartValueBeforeSelection: string | null = null;
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];
  private dataService: DataService;
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private isDestroyed: boolean = false;
  private currentQuery: string = '';
  private fromIndex: number = 1;
  private toIndex: number = this.PAGE_SIZE;
  private hasMore: boolean = false;
  /** Total count from API (serviceDataModal resultCount) for part/material search pagination display */
  totalResultCount: number = 0;

  private _positionScheduled = false;
  private _searchRequestId = 0;
  private _loadMoreRequestId = 0;

  constructor(private utilService: UtilService) {
    this.dataService = null as any;
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
              this.isServiceSearch) &&
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
        if (this.isDestroyed || payload.requestId !== this._searchRequestId) return;
        const response = payload.response;
        if (!this.isDestroyed) {
          const results = response.results || [];
          const resultCount = response.resultCount || 0;

          if (this.isBomFeatureSearch || this.isCountrySearch || this.isServiceSearch) {
            this.genericOptions = Array.isArray(results) ? results : [];
            this.hasMore = response.hasMore || false;

            if (this.genericOptions.length > 0) {
              this.filteredOptions = this.genericOptions
                .map((feature) => feature.displayValue || feature.name || '')
                .filter((name) => name.length > 0);
            } else {
              this.filteredOptions = [];
            }
          } else {
            this.totalResultCount = resultCount;
            this.hasMore = response.hasMore ?? resultCount > this.toIndex;

            if (Array.isArray(results) && results.length > 0) {
              if (this.fromIndex === 1) {
                this.materialOptions = results;
              } else {
                this.materialOptions = [...this.materialOptions, ...results];
              }
              this.buildFilteredOptionsFromMaterials();
            } else if (this.fromIndex === 1) {
              this.materialOptions = [];
              this.filteredOptions = [];
              this.filteredMaterialOptions = [];
              this.totalResultCount = 0;
              this.hasMore = false;
            }
          }

          this.isLoadingMore = false;
          const shouldShow = this.filteredOptions.length > 0;
          this.showDropdown = shouldShow;

          if (this.showDropdown) {
            this.schedulePositionDropdown();
          }
        }
      });
    this.subscriptions.push(searchSub);
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
    this.value = '';
    this.options = [];
    this.filteredOptions = [];
    this.filteredMaterialOptions = [];
    this.materialOptions = [];
    this.genericOptions = [];
    this.showDropdown = false;
    this.selectedIndex = -1;
    this.isMaterialSearch = false;
    this.isPartNumberSearch = false;
    this.isBomFeatureSearch = false;
    this.isCountrySearch = false;
    this.isServiceSearch = false;
    this.isLoadingMore = false;
    this.currentQuery = '';
    this.fromIndex = 1;
    this.toIndex = this.PAGE_SIZE;
    this.hasMore = false;
    this.totalResultCount = 0;
    this.isDestroyed = false;
    this.originalValue = '';

    this.params = params;

    this.dataService =
      params.context?.dataService ||
      params.params?.context?.dataService ||
      (params.api?.gridOptionsService?.get
        ? params.api.gridOptionsService.get('context')?.dataService
        : null) ||
      (params.api?.getContext ? params.api.getContext()?.dataService : null);

    this.value = params.value !== null && params.value !== undefined ? String(params.value) : '';
    this.originalValue = this.value;
    this.placeholder = params.placeholder || 'search materials...';

    const fieldName = this.getFieldName();

    this.isPartNumberSearch =
      params.isPartNumberSearch === true ||
      fieldName === FIELD_BOM_LINK_PART ||
      fieldName === FIELD_PART_NUMBER ||
      fieldName === FIELD_PART;

    this.isBomFeatureSearch = params.isBomFeatureSearch === true || fieldName === FIELD_BOM_LINK_FEATURE;
    this.isCountrySearch =
      params.isCountrySearch === true || fieldName === FIELD_BOM_LINK_COUNTRY_OF_ORIGIN;
    this.isServiceSearch =
      params.isServiceSearch === true ||
      fieldName === 'materialColorServiceSubstituteOne' ||
      fieldName === 'materialColorServiceSubstituteTwo' ||
      fieldName === 'materialColorServiceEquivalent';

    this.isMaterialSearch =
      !this.isPartNumberSearch &&
      !this.isBomFeatureSearch &&
      !this.isCountrySearch &&
      !this.isServiceSearch &&
      (params.useApiSearch === true ||
        (this.dataService &&
          (this.placeholder.includes('material') || this.placeholder.includes('Material'))) ||
        (this.dataService && (fieldName === FIELD_MATERIAL || fieldName === FIELD_MATERIAL_DESCRIPTION)));

    let valuesParam = params.values;
    if (typeof valuesParam === 'function') {
      valuesParam = valuesParam(params);
    }

    if (valuesParam && Array.isArray(valuesParam)) {
      this.options = valuesParam
        .map((opt: any) => String(opt))
        .filter((opt: string) => opt.length > 0);
    } else if (params.options && Array.isArray(params.options)) {
      this.options = params.options
        .map((opt: any) => String(opt))
        .filter((opt: string) => opt.length > 0);
    } else if (typeof params.options === 'function') {
      this.options = params
        .options()
        .map((opt: any) => String(opt))
        .filter((opt: string) => opt.length > 0);
    } else {
      this.options = [];
    }

    if (params.filterFunction && typeof params.filterFunction === 'function') {
      this.customFilterFunction = params.filterFunction;
    }

    const isColorOrSupplier = fieldName === FIELD_COLOR || fieldName === FIELD_SUPPLIER;
    if (isColorOrSupplier) {
      this.refreshOptionsFromNodeData();
    } else if (
      this.options.length > 0 &&
      !this.isMaterialSearch &&
      !this.isPartNumberSearch &&
      !this.isBomFeatureSearch &&
      !this.isCountrySearch &&
      !this.isServiceSearch
    ) {
      this.filterOptions();
    }
  }

  getValue(): any {
    return this.value;
  }

  isPopup(): boolean {
    return false;
  }

  onInputChange(event: any): void {
    this.value = event.target.value || '';

    const fieldName = this.getFieldName();
    const isColorOrSupplier = fieldName === FIELD_COLOR || fieldName === FIELD_SUPPLIER;

    if (isColorOrSupplier && !this.value) {
      this.refreshOptionsFromNodeData();
    }

    const usesApiSearch =
      this.isMaterialSearch ||
      this.isPartNumberSearch ||
      this.isBomFeatureSearch ||
      this.isCountrySearch ||
      this.isServiceSearch;

    if (usesApiSearch) {
      if (this.dataService) {
        this.searchSubject.next(this.value);
      }
    } else {
      // If value is cleared, or if it's a static list, optimize UX by showing all
      if (!this.value && this.options.length > 0) {
        this.filteredOptions = this.options.slice(0, 50);
        this.showDropdown = this.filteredOptions.length > 0;
      } else {
        this.filterOptions();
        this.showDropdown = this.filteredOptions.length > 0;
      }
    }

    this.selectedIndex = -1;

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
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        } else if (this.filteredOptions.length === 1) {
          this.selectOption(this.filteredOptions[0]);
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
    if (
      this.isBomFeatureSearch ||
      this.isCountrySearch ||
      this.isServiceSearch ||
      this.isLoadingMore ||
      !this.hasMore ||
      !this.dataService ||
      !this.currentQuery
    ) {
      return;
    }

    this.isLoadingMore = true;
    const queryForThisLoad = this.currentQuery;
    const loadMoreId = ++this._loadMoreRequestId;

    this.fromIndex = this.toIndex + 1;
    this.toIndex = this.fromIndex + (this.PAGE_SIZE - 1);

    const loadMoreSub = this.dataService
      .searchMaterials(this.currentQuery, this.fromIndex, this.toIndex, this.isPartNumberSearch)
      .subscribe({
        next: (response) => {
          if (
            this.isDestroyed ||
            queryForThisLoad !== this.currentQuery ||
            loadMoreId !== this._loadMoreRequestId
          ) {
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
        },
        error: () => {
          this.isLoadingMore = false;
          this.hasMore = false;
        },
      });
    this.subscriptions.push(loadMoreSub);
  }

  selectOption(option: string, optionIndex?: number): void {
    this.value = option;
    this.closeDropdown();

    let selectedMaterial: any = null;
    if (this.isMaterialSearch || this.isPartNumberSearch) {
      if (
        optionIndex !== undefined &&
        optionIndex >= 0 &&
        optionIndex < this.filteredMaterialOptions.length
      ) {
        selectedMaterial = this.filteredMaterialOptions[optionIndex];
      } else {
        selectedMaterial = this.materialOptions.find((material) => {
          if (this.isPartNumberSearch) {
            return (material.materialColorPartNumber || '') === option;
          }
          const matLabel =
            material.material ||
            material.ptcmaterialName ||
            material.materialName ||
            material.name ||
            '';
          return matLabel === option;
        });
      }
    }

    if (this.params && this.params.node) {
      const fieldName = this.getFieldName();
      if (fieldName) {
        if (PART_FIELD_KEYS.includes(fieldName)) {
          const data = this.params.node.data || {};
          const prevPart =
            data[FIELD_PART_NUMBER] ??
            data[FIELD_BOM_LINK_PART] ??
            data[FIELD_PART] ??
            '';
          this.lastPartValueBeforeSelection = String(prevPart ?? '').trim();
        } else {
          this.lastPartValueBeforeSelection = null;
        }

        this.params.node.setDataValue(fieldName, option);

        if (fieldName === FIELD_BOM_LINK_FEATURE) {
          // Store display value for UI
          this.params.node.setDataValue(FIELD_FEATURE, option);
          const selectedFeatureId = this.isBomFeatureSearch
            ? this.getSelectedGenericOptionId(option, optionIndex)
            : null;
          if (selectedFeatureId) {
            this.params.node.setDataValue('bomLinkFeatureId', selectedFeatureId);
          }
        }

        // Handle service search fields (similar to bomLinkFeature pattern)
        if (this.isServiceSearch && this.genericOptions.length > 0) {
          const selectedServiceId = this.getSelectedGenericOptionId(option, optionIndex);
          if (selectedServiceId && fieldName) {
            // Store ID in a separate field (e.g., materialColorServiceEquivalentId)
            const idFieldName = `${fieldName}Id`;
            this.params.node.setDataValue(idFieldName, selectedServiceId);
          }
        }

        if (this.isCountrySearch && this.genericOptions.length > 0) {
          const selectedCountryId = this.getSelectedGenericOptionId(option, optionIndex);
          if (fieldName) {
            const idFieldName = `${fieldName}Id`;
            this.params.node.setDataValue(idFieldName, selectedCountryId || '');
          }
        }

        if (fieldName === FIELD_PART_NUMBER || fieldName === FIELD_BOM_LINK_PART) {
          this.params.node.setDataValue(FIELD_PART, option);
          if (!option || String(option).trim() === '') {
            this.clearAutopopulatedFieldsWhenPartCleared();
          }
        }
      }

      if (selectedMaterial) {
        this.autoPopulateFields(selectedMaterial);
        if (
          fieldName === FIELD_PART_NUMBER ||
          fieldName === FIELD_BOM_LINK_PART ||
          fieldName === FIELD_PART
        ) {
          this.markExistingRowAsEditedForPartChange(fieldName);
        }
      } else if (
        !this.isMaterialSearch &&
        !this.isPartNumberSearch &&
        !this.isBomFeatureSearch &&
        !this.isCountrySearch &&
        !this.isServiceSearch
      ) {
        this.triggerFeatureAutoPopulation(option);
      }

      if (this.params.api) {
        const columnsToRefresh = [fieldName];
        if (selectedMaterial && (this.isMaterialSearch || this.isPartNumberSearch)) {
          if (
            fieldName === FIELD_MATERIAL ||
            fieldName === FIELD_MATERIAL_DESCRIPTION ||
            fieldName === FIELD_PART_NUMBER ||
            fieldName === FIELD_BOM_LINK_PART
          ) {
            columnsToRefresh.push(...COLUMNS_REFRESH_AFTER_PART);
          }
        }
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: columnsToRefresh,
          force: true,
        });
      }

      this.markNewRowAsEditedIfNeeded(fieldName);
      setTimeout(() => {
        if (this.params && this.params.api) {
          this.params.api.stopEditing();
        }
      }, 0);
    }
  }

  /**
   * When editing a new row in the main grid, part/material selection updates the row via setDataValue.
   * AG Grid may not fire onCellValueChanged for that commit, so the row is never added to editedRows
   * and the Save button stays disabled. Explicitly mark the new row as edited when part/material is selected.
   */
  private markNewRowAsEditedIfNeeded(fieldName: string): void {
    const data = this.params?.node?.data;
    if (!data?.isNewRow) return;
    const rowId = data.newRowId;
    if (rowId == null) return;
    const ctx = this.getGridContext();
    const editedRows = ctx?.editedRows;
    if (!editedRows) return;
    editedRows.add(rowId);
    const editedFields = ctx?.editedFields;
    if (editedFields) {
      if (!editedFields.has(rowId)) editedFields.set(rowId, new Set<string>());
      editedFields.get(rowId)!.add(fieldName);
      if (fieldName === FIELD_PART_NUMBER || fieldName === FIELD_BOM_LINK_PART) {
        editedFields.get(rowId)!.add(FIELD_PART);
      }
    }
  }

  private markExistingRowAsEditedForPartChange(fieldName: string): void {
    const data = this.params?.node?.data;
    if (!data || data.isNewRow) return;
    const rowId =
      data.materialKey || data.newRowId || data[FIELD_PART_NUMBER] || data.part || null;
    if (rowId == null) return;
    const ctx = this.getGridContext();
    const editedRows = ctx?.editedRows;
    const editedFields = ctx?.editedFields;
    if (editedRows) editedRows.add(rowId);
    if (editedFields) {
      if (!editedFields.has(rowId)) editedFields.set(rowId, new Set<string>());
      const set = editedFields.get(rowId)!;
      set.add(fieldName);
      if (fieldName !== FIELD_PART_NUMBER) set.add(FIELD_PART_NUMBER);
      if (fieldName !== FIELD_BOM_LINK_PART) set.add(FIELD_BOM_LINK_PART);
      set.add(FIELD_PART);
    }
  }

  private filterLocalOptions(query: string): string[] {
    if (!this.options || this.options.length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase();
    return this.options.filter((option) => option.toLowerCase().includes(searchTerm));
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
  private autoPopulateFields(material: any): void {
    if (!this.params || !this.params.node) return;

    const originalData = { ...this.params.node.data };
    const flatInstance = material?.flatInstance;
    const responseColumns = material?.responseColumns;

    if (!flatInstance || typeof flatInstance !== 'object') return;

    if (material?.materialColorId && this.params.node?.data) {
      this.params.node.data.materialColorId = material.materialColorId;
      this.params.node.setDataValue('materialColorId', material.materialColorId);
    }

    const ctx = this.getGridContext();
    const setSkip = ctx?.setSkipEditTracking;
    try {
      setSkip?.(true);

    const columnKeys =
      responseColumns && typeof responseColumns === 'object'
        ? Object.keys(responseColumns)
        : Object.keys(flatInstance);

    columnKeys.forEach((key) => {
      if (!(key in flatInstance)) return;
      const value = flatInstance[key];
      if (originalData[key] === value) return;
      this.params.node.setDataValue(key, value);
    });

    if (flatInstance.colorId != null && String(flatInstance.colorId) !== '') {
      const colorId = String(flatInstance.colorId);
      this.params.node.data.colorId = colorId;
      this.params.node.setDataValue('colorId', colorId);
    }
    if (flatInstance.childId != null && String(flatInstance.childId) !== '') {
      const childId = String(flatInstance.childId);
      this.params.node.data.childId = childId;
      this.params.node.setDataValue('childId', childId);
    }

    const partValue = flatInstance.materialColorPartNumber != null ? String(flatInstance.materialColorPartNumber) : '';
    const materialValue = flatInstance.material != null ? String(flatInstance.material) : '';

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

    if (this.isPartNumberSearch && partValue && this.dataService) {
      this.fetchAllPartsForDropdowns(partValue, material);
    }
    if (!this.isPartNumberSearch && materialValue) {
      this.fetchAllMaterialsForDropdowns(materialValue, material);
    }

    const skuInfoPart = this.dataService?.getSkuInfo();
    const isEbom = this.dataService?.getBomType() === BOM_TYPE_EBOM;
    if (skuInfoPart?.length > 0 && isEbom && partValue) {
      const isExistingRow = !this.params?.node?.data?.isNewRow;
      const shouldLimitSkuUpdate = isExistingRow && this.isPartNumberSearch;
      const previousPartValue = (this.lastPartValueBeforeSelection || '').trim();

      skuInfoPart.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        if (shouldLimitSkuUpdate) {
          if (!previousPartValue) return;
          const currentSkuValue = String(originalData[skuFieldName] ?? '').trim();
          if (currentSkuValue !== previousPartValue) {
            return;
          }
        }
        if (originalData[skuFieldName] !== partValue) {
          this.params.node.setDataValue(skuFieldName, partValue);
        }
      });
    } else if (material.skus && Array.isArray(material.skus) && skuInfoPart?.length > 0) {
      skuInfoPart.forEach((sku) => {
        const skuFieldName = `sku${sku.skuId}`;
        const matchingSku = material.skus.find((s: any) => s.skuId === sku.skuId);
        const skuValue = matchingSku ? matchingSku.value : '';
        if (originalData[skuFieldName] !== skuValue) {
          this.params.node.setDataValue(skuFieldName, skuValue);
        }
      });
    }
    } finally {
      this.lastPartValueBeforeSelection = null;
      setTimeout(() => setSkip?.(false), 0);
    }
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
        const fieldsToPopulate = [
          FIELD_SUPPLIER,
          FIELD_COLOR_DESCRIPTION,
          FIELD_BOM_LINK_FEATURE,
          FIELD_MATERIAL_DESCRIPTION,
          FIELD_BOM_LINK_START_DATE,
          FIELD_BOM_LINK_END_DATE,
          FIELD_QUANTITY,
        ];

        const oldData = { ...this.params.node.data };

        fieldsToPopulate.forEach((fieldName) => {
          if (partData[fieldName] !== undefined && partData[fieldName] !== null) {
            if (oldData[fieldName] !== partData[fieldName]) {
              this.params.node.setDataValue(fieldName, partData[fieldName]);
            }
          }
        });

        const skuInfo = dataService.getSkuInfo();
        const skuAutoFillWithPartNumber = dataService.getBomType() === BOM_TYPE_EBOM;
        const partNumberForSkus = partData?.[FIELD_PART_NUMBER] ?? '';
        skuInfo.forEach((sku: any) => {
          const skuFieldName = `sku${sku.skuId}`;
          const newSkuValue = skuAutoFillWithPartNumber
            ? partNumberForSkus
            : (() => {
                const matchingSku = partData.skus?.find((s: any) => s.skuId === sku.skuId);
                return matchingSku ? matchingSku.value : '';
              })();

          if (oldData[skuFieldName] !== newSkuValue) {
            this.params.node.setDataValue(skuFieldName, newSkuValue);
          }
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
      this.isServiceSearch;

    if (usesApiSearch) {
      if (this.dataService && this.value && this.value.length >= 1) {
        this.searchSubject.next(this.value);
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
      const container = inputElement.offsetParent || document.body;
      const containerRect = container.getBoundingClientRect();

      const relativeTop = inputRect.bottom - containerRect.top + 2;
      const relativeLeft = inputRect.left - containerRect.left;

      dropdownElement.style.top = `${relativeTop}px`;
      dropdownElement.style.left = `${relativeLeft}px`;

      dropdownElement.style.width = `${inputRect.width}px`;
      dropdownElement.style.minWidth = `${inputRect.width}px`;

      const actualDropdownHeight =
        dropdownElement.offsetHeight || dropdownElement.scrollHeight || 200;
      const viewportHeight = window.innerHeight;
      const dropdownHeight = Math.min(actualDropdownHeight, 200);

      if (inputRect.bottom + dropdownHeight > viewportHeight) {
        if (inputRect.top - dropdownHeight > 0) {
          const relativeTopAbove = inputRect.top - containerRect.top - dropdownHeight - 2;
          dropdownElement.style.top = `${relativeTopAbove}px`;
        }
      }

      const viewportWidth = window.innerWidth;
      const dropdownWidth = inputRect.width;

      if (inputRect.left + dropdownWidth > viewportWidth) {
        const adjustedLeft = Math.max(0, viewportWidth - dropdownWidth - 10);
        const relativeAdjustedLeft = adjustedLeft - containerRect.left;
        dropdownElement.style.left = `${relativeAdjustedLeft}px`;
      }

      // Force reflow to ensure positioning is applied
      dropdownElement.offsetHeight;
    } catch (error) {
      this.positionDropdownFallback();
    }
  }

  private positionDropdownFallback(): void {
    if (!this.dropdown || !this.input) {
      return;
    }

    const dropdownElement = this.dropdown.nativeElement;
    const inputElement = this.input.nativeElement;

    dropdownElement.style.top = '100%';
    dropdownElement.style.left = '0';
    dropdownElement.style.width = '100%';
    dropdownElement.style.position = 'absolute';
  }

  private fetchAllMaterialsForDropdowns(materialName: string, selectedMaterial: any): void {
    if (!this.params || !this.params.node || !selectedMaterial?.flatInstance) return;

    const fi = selectedMaterial.flatInstance;
    const colorName = fi.color ?? '';
    const supplierName = fi.supplier ?? '';
    const partNumber = fi.materialColorPartNumber ?? selectedMaterial.materialColorPartNumber ?? '';

    const availableColors = colorName ? [colorName] : [];
    const availableSuppliers = supplierName ? [supplierName] : [];
    const availablePartNumbers = partNumber ? [partNumber] : [];

    this.params.node.setDataValue('_availableColors', availableColors);
    this.params.node.setDataValue('_availableSuppliers', availableSuppliers);

    if (availablePartNumbers.length > 0) {
      this.params.node.setDataValue('_availablePartNumbers', availablePartNumbers);
    }

    const currentData = this.params.node.data || {};
    const existingColor = currentData[FIELD_COLOR] || currentData[FIELD_COLOR_DESCRIPTION] || '';
    const existingSupplier = currentData[FIELD_SUPPLIER] || '';

    if (colorName && existingColor !== colorName) {
      this.params.node.setDataValue(FIELD_COLOR, colorName);
      this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, colorName);
    }

    if (supplierName && existingSupplier !== supplierName) {
      this.params.node.setDataValue(FIELD_SUPPLIER, supplierName);
    }

    const fieldName = this.getFieldName();
    const partFieldName =
      fieldName === FIELD_BOM_LINK_PART || fieldName === FIELD_PART_NUMBER ? fieldName : FIELD_BOM_LINK_PART;
    const existingPartNumber =
      currentData[partFieldName] ||
      currentData[FIELD_BOM_LINK_PART] ||
      currentData[FIELD_PART_NUMBER] ||
      currentData[FIELD_PART] ||
      '';
    if (partNumber && existingPartNumber !== partNumber) {
      this.params.node.setDataValue(partFieldName, partNumber);
      if (this.params.api) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: [partFieldName],
          force: true,
        });
      }
    }
  }

  private fetchAllPartsForDropdowns(partNumber: string, selectedMaterial: any): void {
    if (!this.params || !this.params.node || !selectedMaterial || !this.dataService || !partNumber)
      return;

    const fi = selectedMaterial.flatInstance;
    const initialColorValue = fi?.color ?? selectedMaterial.color ?? '';
    const initialSupplierValue = fi?.supplier ?? selectedMaterial.supplier ?? '';

    if (initialColorValue) {
      this.params.node.setDataValue('_availableColors', [initialColorValue]);
    }

    if (initialSupplierValue) {
      this.params.node.setDataValue('_availableSuppliers', [initialSupplierValue]);
    }

    const materialsSub = this.dataService.searchMaterials(partNumber, 1, 1000, true).subscribe({
      next: (response) => {
        if (!this.isDestroyed && this.params && this.params.node) {
          const allParts = response.results || [];

          const uniqueColors = new Set<string>();
          const uniqueSuppliers = new Set<string>();

          allParts.forEach((part: any) => {
            const fi = part.flatInstance;
            const colorName = fi?.color ?? part.color ?? '';
            const supplierName = fi?.supplier ?? part.supplier ?? '';
            if (colorName) uniqueColors.add(colorName);
            if (supplierName) uniqueSuppliers.add(supplierName);
          });

          if (initialColorValue && !uniqueColors.has(initialColorValue)) {
            uniqueColors.add(initialColorValue);
          }
          if (initialSupplierValue && !uniqueSuppliers.has(initialSupplierValue)) {
            uniqueSuppliers.add(initialSupplierValue);
          }

          const availableColors = Array.from(uniqueColors).sort();
          const availableSuppliers = Array.from(uniqueSuppliers).sort();

          this.params.node.setDataValue('_availableColors', availableColors);
          this.params.node.setDataValue('_availableSuppliers', availableSuppliers);

          const currentData = this.params.node.data || {};
          const existingColor = currentData[FIELD_COLOR] || currentData[FIELD_COLOR_DESCRIPTION] || '';
          const existingSupplier = currentData[FIELD_SUPPLIER] || '';

          if (availableColors.length === 1 && initialColorValue) {
            if (existingColor !== initialColorValue) {
              this.params.node.setDataValue(FIELD_COLOR, initialColorValue);
              this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, initialColorValue);
            }
          } else if (availableColors.length > 1) {
            if (existingColor && !availableColors.includes(existingColor)) {
              this.params.node.setDataValue(FIELD_COLOR, '');
              this.params.node.setDataValue(FIELD_COLOR_DESCRIPTION, '');
            }
          }

          if (availableSuppliers.length === 1 && initialSupplierValue) {
            if (existingSupplier !== initialSupplierValue) {
              this.params.node.setDataValue(FIELD_SUPPLIER, initialSupplierValue);
            }
          } else if (availableSuppliers.length > 1) {
            if (existingSupplier && !availableSuppliers.includes(existingSupplier)) {
              this.params.node.setDataValue(FIELD_SUPPLIER, '');
            }
          }

          if (this.params.api) {
            this.params.api.refreshCells({
              rowNodes: [this.params.node],
              columns: [...COLUMNS_REFRESH_AFTER_PART],
              force: true,
            });
          }
        }
      },
      error: (error) => {
      },
    });
    this.subscriptions.push(materialsSub);
  }
}
