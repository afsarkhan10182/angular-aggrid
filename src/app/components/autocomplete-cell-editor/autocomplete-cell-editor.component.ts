import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { DataService } from '../../services/data.service';
import { UtilService } from '../../services/util.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
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
  // Page size for pagination
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
  public isLoadingMore: boolean = false;

  private params: any;
  private originalValue: string = '';
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];
  private dataService: DataService;
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private isDestroyed: boolean = false;
  private currentQuery: string = '';
  private fromIndex: number = 1;
  private toIndex: number = this.PAGE_SIZE;
  private hasMore: boolean = false;

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

    // Normalize colorDescription to 'color' for consistent handling
    if (fieldName === 'colorDescription') {
      return 'color';
    }

    return fieldName;
  }

  ngOnInit() {
    this.originalValue = this.value;

    const searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const effectiveQuery = query ?? '';
          const usesApiSearch =
            (this.isMaterialSearch ||
              this.isPartNumberSearch ||
              this.isBomFeatureSearch ||
              this.isCountrySearch) &&
            this.dataService;

          if (usesApiSearch) {
            if (this.isBomFeatureSearch) {
              if (effectiveQuery.length >= 1) {
                this.currentQuery = effectiveQuery;
                this.isLoadingMore = false;
                return this.dataService.searchBomFeatures(this.currentQuery, this.PAGE_SIZE);
              }

              this.hasMore = false;
              this.genericOptions = [];
              return of({ results: [], resultCount: 0, hasMore: false });
            }

            if (this.isCountrySearch) {
              if (effectiveQuery.length >= 1) {
                this.currentQuery = effectiveQuery;
                this.isLoadingMore = false;
                return this.dataService.searchCountriesOfOrigin(this.currentQuery, this.PAGE_SIZE);
              }

              this.hasMore = false;
              this.genericOptions = [];
              return of({ results: [], resultCount: 0, hasMore: false });
            }

            if (effectiveQuery.length >= 1) {
              this.currentQuery = effectiveQuery;
              this.fromIndex = 1;
              this.toIndex = this.PAGE_SIZE;
              this.isLoadingMore = false;
              return this.dataService.searchMaterials(
                effectiveQuery,
                this.fromIndex,
                this.toIndex,
                this.isPartNumberSearch
              );
            }

            this.fromIndex = 1;
            this.toIndex = this.PAGE_SIZE;
            this.hasMore = false;
            return of({ results: [], resultCount: 0, hasMore: false });
          }

          if (effectiveQuery.length >= 2) {
            return of({
              results: this.filterLocalOptions(effectiveQuery),
              resultCount: 0,
              hasMore: false,
            });
          }

          return of({ results: [], resultCount: 0, hasMore: false });
        }),
        catchError(() => {
          return of({ results: [], resultCount: 0, hasMore: false });
        })
      )
      .subscribe((response) => {
        if (!this.isDestroyed) {
          const results = response.results || [];
          const resultCount = response.resultCount || 0;

          if (this.isBomFeatureSearch || this.isCountrySearch) {
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
            this.hasMore = resultCount > this.toIndex;

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
              this.hasMore = false;
            }
          }

          this.isLoadingMore = false;
          const shouldShow = this.filteredOptions.length > 0;
          this.showDropdown = shouldShow;

          if (this.showDropdown) {
            // Use double requestAnimationFrame to ensure DOM is ready, especially for single-item dropdowns
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.positionDropdown();
              });
            });
          }
        }
      });
    this.subscriptions.push(searchSub);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.input.nativeElement.focus();
      this.input.nativeElement.select();

      const usesApiSearch =
        this.isMaterialSearch ||
        this.isPartNumberSearch ||
        this.isBomFeatureSearch ||
        this.isCountrySearch;

      if (usesApiSearch) {
        if (this.dataService && this.value && this.value.length >= 1) {
          this.searchSubject.next(this.value);
        }
      } else if (this.options.length > 0) {
        // For ALL fields with static options, show all options when initialized
        this.filteredOptions = this.options.slice(0, 50);
        this.showDropdown = this.filteredOptions.length > 0;
        this.setInitialSelectedIndex();
      }

      if (this.showDropdown) {
        this.positionDropdown();
      }
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
    this.isLoadingMore = false;
    this.currentQuery = '';
    this.fromIndex = 1;
    this.toIndex = this.PAGE_SIZE;
    this.hasMore = false;
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

    // Handle value - valueGetter already handles colorDescription mapping, so just use params.value
    this.value = params.value !== null && params.value !== undefined ? String(params.value) : '';
    this.originalValue = this.value;
    this.placeholder = params.placeholder || 'search materials...';

    const fieldName = this.getFieldName();

    this.isPartNumberSearch =
      params.isPartNumberSearch === true ||
      fieldName === 'bomLinkPart' ||
      fieldName === 'partNumber' ||
      fieldName === 'part';

    this.isBomFeatureSearch = params.isBomFeatureSearch === true || fieldName === 'bomLinkFeature';
    this.isCountrySearch =
      params.isCountrySearch === true || fieldName === 'bomLinkCountryOfOrigin';

    this.isMaterialSearch =
      !this.isPartNumberSearch &&
      !this.isBomFeatureSearch &&
      !this.isCountrySearch &&
      (params.useApiSearch === true ||
        (this.dataService &&
          (this.placeholder.includes('material') || this.placeholder.includes('Material'))) ||
        (this.dataService && (fieldName === 'material' || fieldName === 'materialDescription')));

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

    // For color and supplier fields, refresh options from node data
    const isColorOrSupplier = fieldName === 'color' || fieldName === 'supplier';
    if (isColorOrSupplier) {
      this.refreshOptionsFromNodeData();
    } else if (
      this.options.length > 0 &&
      !this.isMaterialSearch &&
      !this.isPartNumberSearch &&
      !this.isBomFeatureSearch &&
      !this.isCountrySearch
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
    const isColorOrSupplier = fieldName === 'color' || fieldName === 'supplier';

    // Refresh options when value is cleared for color/supplier fields
    if (isColorOrSupplier && !this.value) {
      this.refreshOptionsFromNodeData();
    }

    const usesApiSearch =
      this.isMaterialSearch ||
      this.isPartNumberSearch ||
      this.isBomFeatureSearch ||
      this.isCountrySearch;

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
      // Use double requestAnimationFrame to ensure DOM is ready, especially for single-item dropdowns
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.positionDropdown();
        });
      });
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
    this.refreshOptionsFromNodeData();

    const usesApiSearch =
      this.isMaterialSearch ||
      this.isPartNumberSearch ||
      this.isBomFeatureSearch ||
      this.isCountrySearch;

    if (usesApiSearch) {
      if (this.dataService && this.value && this.value.length >= 1) {
        this.searchSubject.next(this.value);
      }
    } else {
      // For ALL fields with static options, show all items when clicking
      if (this.options.length > 0) {
        this.filteredOptions = this.options.slice(0, 50);
        this.showDropdown = this.filteredOptions.length > 0;
        this.setInitialSelectedIndex();
      }
    }

    if (this.showDropdown) {
      // Use double requestAnimationFrame to ensure DOM is ready, especially for single-item dropdowns
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.positionDropdown();
        });
      });
    }
  }

  onInputFocus(): void {
    this.refreshOptionsFromNodeData();

    const usesApiSearch =
      this.isMaterialSearch ||
      this.isPartNumberSearch ||
      this.isBomFeatureSearch ||
      this.isCountrySearch;

    if (usesApiSearch) {
      if (this.dataService && this.value && this.value.length >= 1) {
        this.searchSubject.next(this.value);
      }
    } else {
      // For ALL fields with static options, show all items when focusing
      if (this.options.length > 0) {
        this.filteredOptions = this.options.slice(0, 50);
        this.showDropdown = this.filteredOptions.length > 0;
        this.setInitialSelectedIndex();
      }
    }

    if (this.showDropdown) {
      // Use double requestAnimationFrame to ensure DOM is ready, especially for single-item dropdowns
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.positionDropdown();
        });
      });
    }
  }

  private refreshOptionsFromNodeData(): void {
    if (!this.params || !this.params.node) return;

    const fieldName = this.getFieldName();
    const nodeData = this.params.node.data || {};

    if (fieldName !== 'supplier' && fieldName !== 'color') return;

    // Get filtered values from node data if available
    const filteredValues =
      (fieldName === 'supplier' && Array.isArray(nodeData._availableSuppliers)
        ? nodeData._availableSuppliers
        : fieldName === 'color' && Array.isArray(nodeData._availableColors)
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
      this.isLoadingMore ||
      !this.hasMore ||
      !this.dataService ||
      !this.currentQuery
    ) {
      return;
    }

    this.isLoadingMore = true;

    this.fromIndex = this.toIndex + 1;
    this.toIndex = this.fromIndex + (this.PAGE_SIZE - 1);

    const loadMoreSub = this.dataService
      .searchMaterials(this.currentQuery, this.fromIndex, this.toIndex, this.isPartNumberSearch)
      .subscribe({
        next: (response) => {
          if (!this.isDestroyed) {
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
        },
        error: (error) => {
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
            return (material.partNumber || '') === option;
          } else {
            return (
              (material.ptcmaterialName || material.materialName || material.name || '') === option
            );
          }
        });
      }
    }

    if (this.params && this.params.node) {
      const fieldName = this.getFieldName();
      if (fieldName) {
        this.params.node.setDataValue(fieldName, option);

        if (this.params.node.data) {
          this.params.node.data[fieldName] = option;
        }

        if (fieldName === 'bomLinkFeature') {
          // Store display value for UI
          this.params.node.setDataValue('feature', option);
          if (this.params.node.data) {
            this.params.node.data.feature = option;
          }

          // Store ID from API response for payload (production and dev)
          // Find the selected option object to get its ID
          let selectedFeatureId: string | null = null;
          if (this.isBomFeatureSearch && this.genericOptions.length > 0) {
            // Try to find by optionIndex first (more reliable)
            if (
              optionIndex !== undefined &&
              optionIndex >= 0 &&
              optionIndex < this.genericOptions.length
            ) {
              const selectedFeature = this.genericOptions[optionIndex];
              selectedFeatureId = selectedFeature.id || selectedFeature.displayValue || option;
            } else {
              // Fallback: find by matching displayValue/name
              const selectedFeature = this.genericOptions.find(
                (feature: any) => (feature.displayValue || feature.name || '') === option
              );
              if (selectedFeature) {
                // Use id field from API response (production) or mock id (dev)
                selectedFeatureId = selectedFeature.id || selectedFeature.displayValue || option;
              }
            }
          }

          // Store the ID separately for payload generation
          if (selectedFeatureId) {
            this.params.node.setDataValue('bomLinkFeatureId', selectedFeatureId);
            if (this.params.node.data) {
              this.params.node.data.bomLinkFeatureId = selectedFeatureId;
            }
          }
        }

        if (fieldName === 'partNumber' || fieldName === 'bomLinkPart') {
          this.params.node.setDataValue('part', option);
          if (this.params.node.data) {
            this.params.node.data.part = option;
          }
        }
      }

      if (selectedMaterial) {
        this.autoPopulateFields(selectedMaterial);
      } else if (
        !this.isMaterialSearch &&
        !this.isPartNumberSearch &&
        !this.isBomFeatureSearch &&
        !this.isCountrySearch
      ) {
        this.triggerFeatureAutoPopulation(option);
      }

      // Stop editing after selection to allow immediate re-editing
      if (this.params.api) {
        // Refresh the edited field and related fields (color, supplier, etc.)
        const columnsToRefresh = [fieldName];
        if (selectedMaterial && (this.isMaterialSearch || this.isPartNumberSearch)) {
          // Add color and supplier columns to refresh list
          if (
            fieldName === 'material' ||
            fieldName === 'materialDescription' ||
            fieldName === 'partNumber' ||
            fieldName === 'bomLinkPart'
          ) {
            columnsToRefresh.push('color', 'colorDescription', 'supplier');
          }
        }
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: columnsToRefresh,
          force: true,
        });
      }

      // Stop editing after selection to allow immediate re-editing (for supplier/color fields)
      setTimeout(() => {
        if (this.params && this.params.api) {
          this.params.api.stopEditing();
        }
      }, 0);
    }
  }

  private filterLocalOptions(query: string): string[] {
    if (!this.options || this.options.length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase();
    return this.options.filter((option) => option.toLowerCase().includes(searchTerm));
  }

  private autoPopulateFields(material: any): void {
    if (!this.params || !this.params.node) return;

    const originalData = { ...this.params.node.data };
    const fieldName = this.getFieldName();

    if (this.isPartNumberSearch) {
      const fullResult = material.fullResult || {};
      const materialColor = fullResult['material-color'] || {};
      const supplierObj = fullResult.supplier || {};
      const colorObj = fullResult.color || {};
      const materialObj = fullResult.material || {};

      const partValue = materialColor.partNumber || material.partNumber || '';
      if (partValue) {
        this.setPartIdentifiers(partValue);
      }

      let materialValue =
        materialObj.ptcmaterialName || material.ptcmaterialName || material.materialName || '';
      if (!materialValue && partValue) {
        materialValue = partValue;
      }

      if (materialValue && originalData.material !== materialValue) {
        this.params.node.setDataValue('material', materialValue);
        if (this.params.node.data) {
          this.params.node.data.material = materialValue;
        }
      }
      // Also set materialDescription field (used in grid columns)
      if (materialValue && originalData.materialDescription !== materialValue) {
        this.params.node.setDataValue('materialDescription', materialValue);
        if (this.params.node.data) {
          this.params.node.data.materialDescription = materialValue;
        }
      }

      const supplierName =
        supplierObj.supplierName ||
        supplierObj.name ||
        material.supplier ||
        material.supplierName ||
        '';
      if (supplierName && originalData.supplier !== supplierName) {
        this.params.node.setDataValue('supplier', supplierName);
        if (this.params.node.data) {
          this.params.node.data.supplier = supplierName;
        }
      }

      const colorName =
        colorObj.colorName || colorObj.name || material.color || material.colorName || '';
      if (colorName && originalData.color !== colorName) {
        this.params.node.setDataValue('color', colorName);
        if (this.params.node.data) {
          this.params.node.data.color = colorName;
        }
      }
      // Also set colorDescription field (actual column field name)
      if (colorName && originalData.colorDescription !== colorName) {
        this.params.node.setDataValue('colorDescription', colorName);
        if (this.params.node.data) {
          this.params.node.data.colorDescription = colorName;
        }
      }

      // Store childId from material-supplier.materialSupplierMaster (take value after colon)
      const materialSupplier = fullResult['material-supplier'] || {};
      const materialSupplierMaster = materialSupplier.materialSupplierMaster || '';
      const childId = materialSupplierMaster
        ? this.utilService.extractIdAfterLastColon(materialSupplierMaster)
        : '';
      if (childId && originalData.materialSupplierMasterId !== childId) {
        this.params.node.setDataValue('materialSupplierMasterId', childId);
        if (this.params.node.data) {
          this.params.node.data.materialSupplierMasterId = childId;
        }
      }

      // Store colorId from color.iterationId (take value after LAST colon)
      const colorIterationId = colorObj.iterationId || '';
      const colorId = colorIterationId
        ? this.utilService.extractIdAfterLastColon(colorIterationId)
        : '';
      if (colorId && originalData.colorId !== colorId) {
        this.params.node.setDataValue('colorId', colorId);
        if (this.params.node.data) {
          this.params.node.data.colorId = colorId;
        }
      }

      if (partValue && this.dataService) {
        this.fetchAllPartsForDropdowns(partValue, material);
      }
    } else {
      let materialValue = material.ptcmaterialName || material.materialName || '';

      if (materialValue && originalData.material !== materialValue) {
        this.params.node.setDataValue('material', materialValue);
        if (this.params.node.data) {
          this.params.node.data.material = materialValue;
        }
      }
      // Also set materialDescription field (used in grid columns)
      if (materialValue && originalData.materialDescription !== materialValue) {
        this.params.node.setDataValue('materialDescription', materialValue);
        if (this.params.node.data) {
          this.params.node.data.materialDescription = materialValue;
        }
      }

      const fullResult = material.fullResult || {};
      const materialColor = fullResult['material-color'] || {};
      const partNumberFromMaterial = materialColor.partNumber || material.partNumber || '';

      if (!materialValue && partNumberFromMaterial) {
        this.params.node.setDataValue('material', partNumberFromMaterial);
        if (this.params.node.data) {
          this.params.node.data.material = partNumberFromMaterial;
        }
        // Also set materialDescription when using partNumber as fallback
        this.params.node.setDataValue('materialDescription', partNumberFromMaterial);
        if (this.params.node.data) {
          this.params.node.data.materialDescription = partNumberFromMaterial;
        }
      }

      if (partNumberFromMaterial) {
        this.setPartIdentifiers(partNumberFromMaterial);
      }

      // Store childId from material-supplier.materialSupplierMaster (take value after LAST colon)
      const materialSupplier = fullResult['material-supplier'] || {};
      const materialSupplierMaster = materialSupplier.materialSupplierMaster || '';
      const childId = materialSupplierMaster
        ? this.utilService.extractIdAfterLastColon(materialSupplierMaster)
        : '';
      if (childId && originalData.materialSupplierMasterId !== childId) {
        this.params.node.setDataValue('materialSupplierMasterId', childId);
        if (this.params.node.data) {
          this.params.node.data.materialSupplierMasterId = childId;
        }
      }

      // Store colorId from color.iterationId (take value after LAST colon)
      const colorObj = fullResult.color || {};
      const colorIterationId = colorObj.iterationId || '';
      const colorId = colorIterationId
        ? this.utilService.extractIdAfterLastColon(colorIterationId)
        : '';
      if (colorId && originalData.colorId !== colorId) {
        this.params.node.setDataValue('colorId', colorId);
        if (this.params.node.data) {
          this.params.node.data.colorId = colorId;
        }
      }

      if (materialValue) {
        this.fetchAllMaterialsForDropdowns(materialValue, material);
      }
    }

    const fieldsToPopulate = [
      'feature',
      'startDate',
      'endDate',
      'qty',
      'description',
      'shortDesc',
      'longDesc',
    ];

    fieldsToPopulate.forEach((field) => {
      const value = material[field];
      if (value !== undefined && value !== null && originalData[field] !== value) {
        this.params.node.setDataValue(field, value);
        if (this.params.node.data) {
          this.params.node.data[field] = value;
        }
      }
    });

    if (material.skus && Array.isArray(material.skus)) {
      const skuInfo = this.dataService?.getSkuInfo();
      if (skuInfo && skuInfo.length > 0) {
        skuInfo.forEach((sku) => {
          const skuFieldName = `sku${sku.skuId}`;
          const matchingSku = material.skus.find((s: any) => s.skuId === sku.skuId);
          const skuValue = matchingSku ? matchingSku.value : '';

          if (originalData[skuFieldName] !== skuValue) {
            this.params.node.setDataValue(skuFieldName, skuValue);
            if (this.params.node.data) {
              this.params.node.data[skuFieldName] = skuValue;
            }
          }
        });
      }
    }
  }

  private triggerFeatureAutoPopulation(partNumber: string): void {
    const dataService = (this.params as any).context?.dataService;

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

    const items = apiData!.instances;
    const existingPart = items.find((item: any) => {
      const bomLink = item['bom-link'];
      return bomLink.partNumber === partNumber;
    });
    if (existingPart) {
      const partData = existingPart['bom-link'];
      if (this.params && this.params.node) {
        const fieldsToPopulate = [
          'supplier',
          'colorDescription',
          'bomLinkFeature',
          'materialDescription',
          'bomLinkStartDate',
          'bomLinkEndDate',
          'quantity',
        ];

        const oldData = { ...this.params.node.data };

        fieldsToPopulate.forEach((fieldName) => {
          if (partData[fieldName] !== undefined && partData[fieldName] !== null) {
            if (oldData[fieldName] !== partData[fieldName]) {
              this.params.node.setDataValue(fieldName, partData[fieldName]);
              if (this.params.node.data) {
                this.params.node.data[fieldName] = partData[fieldName];
              }
            }
          }
        });

        const skuInfo = dataService.getSkuInfo();
        skuInfo.forEach((sku: any) => {
          const skuFieldName = `sku${sku.skuId}`;
          const matchingSku = partData.skus.find((s: any) => s.skuId === sku.skuId);
          const newSkuValue = matchingSku ? matchingSku.value : '';

          if (oldData[skuFieldName] !== newSkuValue) {
            this.params.node.setDataValue(skuFieldName, newSkuValue);
            if (this.params.node.data) {
              this.params.node.data[skuFieldName] = newSkuValue;
            }
          }
        });

        const partIdentifier = partData.partNumber;
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
        const startsWithMatches = this.options
          .filter((option) => String(option).toLowerCase().startsWith(searchValue))
          .slice(0, 6);

        const containsMatches = this.options
          .filter((option) => {
            const optionLower = String(option).toLowerCase();
            return optionLower.includes(searchValue) && !optionLower.startsWith(searchValue);
          })
          .slice(0, 4);

        this.filteredOptions = [...startsWithMatches, ...containsMatches];
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
        ? material.partNumber || ''
        : material.ptcmaterialName || material.materialName || material.name || '';

      if (label && label.length > 0) {
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

    const targetFields = ['partNumber', 'bomLinkPart', 'part'];
    const updatedColumns: string[] = [];

    targetFields.forEach((field) => {
      const currentValue = this.params.node.data ? this.params.node.data[field] : undefined;
      if (currentValue !== partValue) {
        this.params.node.setDataValue(field, partValue);
        if (this.params.node.data) {
          this.params.node.data[field] = partValue;
        }
        updatedColumns.push(field);
      }
    });

    if (updatedColumns.length > 0 && this.params.api) {
      setTimeout(() => {
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
      }, 50);
    }
  }

  private closeDropdown(): void {
    this.showDropdown = false;
    this.selectedIndex = -1;
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

      // Calculate actual dropdown height (important for single-item dropdowns)
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
    if (!this.params || !this.params.node || !selectedMaterial) return;

    const fullResult = selectedMaterial.fullResult || {};
    const colorObj = fullResult.color || {};
    const supplierObj = fullResult.supplier || {};
    const materialColor = fullResult['material-color'] || {};

    const colorName =
      colorObj.colorName ||
      colorObj.name ||
      selectedMaterial.colorName ||
      selectedMaterial.color ||
      '';
    const supplierName =
      supplierObj.supplierName ||
      supplierObj.name ||
      selectedMaterial.supplier ||
      selectedMaterial.supplierName ||
      '';
    const partNumber = materialColor.partNumber || selectedMaterial.partNumber || '';

    const availableColors = colorName ? [colorName] : [];
    const availableSuppliers = supplierName ? [supplierName] : [];
    const availablePartNumbers = partNumber ? [partNumber] : [];

    this.params.node.setDataValue('_availableColors', availableColors);
    if (this.params.node.data) {
      this.params.node.data._availableColors = availableColors;
    }

    this.params.node.setDataValue('_availableSuppliers', availableSuppliers);
    if (this.params.node.data) {
      this.params.node.data._availableSuppliers = availableSuppliers;
    }

    if (availablePartNumbers.length > 0) {
      this.params.node.setDataValue('_availablePartNumbers', availablePartNumbers);
      if (this.params.node.data) {
        this.params.node.data._availablePartNumbers = availablePartNumbers;
      }
    }

    const currentData = this.params.node.data || {};
    const existingColor = currentData.color || currentData.colorDescription || '';
    const existingSupplier = currentData.supplier || '';

    if (colorName && existingColor !== colorName) {
      this.params.node.setDataValue('color', colorName);
      if (this.params.node.data) {
        this.params.node.data.color = colorName;
      }
      // Also set colorDescription field (actual column field name)
      this.params.node.setDataValue('colorDescription', colorName);
      if (this.params.node.data) {
        this.params.node.data.colorDescription = colorName;
      }
    }

    if (supplierName && existingSupplier !== supplierName) {
      this.params.node.setDataValue('supplier', supplierName);
      if (this.params.node.data) {
        this.params.node.data.supplier = supplierName;
      }
    }

    const fieldName = this.getFieldName();
    const partFieldName =
      fieldName === 'bomLinkPart' || fieldName === 'partNumber' ? fieldName : 'bomLinkPart';
    const existingPartNumber =
      currentData[partFieldName] ||
      currentData.bomLinkPart ||
      currentData.partNumber ||
      currentData.part ||
      '';
    if (partNumber && existingPartNumber !== partNumber) {
      this.params.node.setDataValue(partFieldName, partNumber);
      if (this.params.node.data) {
        this.params.node.data[partFieldName] = partNumber;
      }

      if (this.params.api) {
        setTimeout(() => {
          this.params.api.refreshCells({
            rowNodes: [this.params.node],
            columns: [partFieldName],
            force: true,
          });
        }, 50);
      }
    }
  }

  private fetchAllPartsForDropdowns(partNumber: string, selectedMaterial: any): void {
    if (!this.params || !this.params.node || !selectedMaterial || !this.dataService || !partNumber)
      return;

    const fullResult = selectedMaterial.fullResult || {};
    const colorObj = fullResult.color || {};
    const supplierObj = fullResult.supplier || {};

    const initialColorValue =
      colorObj.colorName ||
      colorObj.name ||
      selectedMaterial.colorName ||
      selectedMaterial.color ||
      '';
    const initialSupplierValue =
      supplierObj.supplierName ||
      supplierObj.name ||
      selectedMaterial.supplier ||
      selectedMaterial.supplierName ||
      '';

    if (initialColorValue) {
      this.params.node.setDataValue('_availableColors', [initialColorValue]);
      if (this.params.node.data) {
        this.params.node.data._availableColors = [initialColorValue];
      }
    }

    if (initialSupplierValue) {
      this.params.node.setDataValue('_availableSuppliers', [initialSupplierValue]);
      if (this.params.node.data) {
        this.params.node.data._availableSuppliers = [initialSupplierValue];
      }
    }

    const materialsSub = this.dataService.searchMaterials(partNumber, 1, 1000, true).subscribe({
      next: (response) => {
        if (!this.isDestroyed && this.params && this.params.node) {
          const allParts = response.results || [];

          const uniqueColors = new Set<string>();
          const uniqueSuppliers = new Set<string>();

          allParts.forEach((part: any) => {
            const fullResult = part.fullResult || {};
            const colorObj = fullResult.color || {};
            const supplierObj = fullResult.supplier || {};

            const colorName =
              colorObj.colorName || colorObj.name || part.colorName || part.color || '';
            const supplierName =
              supplierObj.supplierName ||
              supplierObj.name ||
              part.supplier ||
              part.supplierName ||
              '';

            if (colorName) {
              uniqueColors.add(colorName);
            }
            if (supplierName) {
              uniqueSuppliers.add(supplierName);
            }
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
          if (this.params.node.data) {
            this.params.node.data._availableColors = availableColors;
          }

          this.params.node.setDataValue('_availableSuppliers', availableSuppliers);
          if (this.params.node.data) {
            this.params.node.data._availableSuppliers = availableSuppliers;
          }

          const currentData = this.params.node.data || {};
          const existingColor = currentData.color || currentData.colorDescription || '';
          const existingSupplier = currentData.supplier || '';

          if (availableColors.length === 1 && initialColorValue) {
            if (existingColor !== initialColorValue) {
              this.params.node.setDataValue('color', initialColorValue);
              if (this.params.node.data) {
                this.params.node.data.color = initialColorValue;
              }
              // Also set colorDescription field (actual column field name)
              this.params.node.setDataValue('colorDescription', initialColorValue);
              if (this.params.node.data) {
                this.params.node.data.colorDescription = initialColorValue;
              }
            }
          } else if (availableColors.length > 1) {
            if (existingColor && !availableColors.includes(existingColor)) {
              this.params.node.setDataValue('color', '');
              if (this.params.node.data) {
                this.params.node.data.color = '';
              }
              // Also clear colorDescription field
              this.params.node.setDataValue('colorDescription', '');
              if (this.params.node.data) {
                this.params.node.data.colorDescription = '';
              }
            }
          }

          if (availableSuppliers.length === 1 && initialSupplierValue) {
            if (existingSupplier !== initialSupplierValue) {
              this.params.node.setDataValue('supplier', initialSupplierValue);
              if (this.params.node.data) {
                this.params.node.data.supplier = initialSupplierValue;
              }
            }
          } else if (availableSuppliers.length > 1) {
            if (existingSupplier && !availableSuppliers.includes(existingSupplier)) {
              this.params.node.setDataValue('supplier', '');
              if (this.params.node.data) {
                this.params.node.data.supplier = '';
              }
            }
          }

          // Refresh color and supplier columns after populating
          if (this.params.api) {
            setTimeout(() => {
              this.params.api.refreshCells({
                rowNodes: [this.params.node],
                columns: ['color', 'colorDescription', 'supplier'],
                force: true,
              });
            }, 50);
          }
        }
      },
      error: (error) => {
      },
    });
    this.subscriptions.push(materialsSub);
  }
}
