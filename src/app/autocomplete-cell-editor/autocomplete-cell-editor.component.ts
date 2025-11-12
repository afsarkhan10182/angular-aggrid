import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { DataService } from '../services/data.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

@Component({
  selector: 'app-autocomplete-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    '[style.display]': '"block"',
    '[style.width]': '"100%"',
    '[style.height]': '"100%"',
    '[style.position]': '"relative"',
  },
  template: `
    <div class="autocomplete-container" style="position: relative; width: 100%; height: 100%;">
      <input
        #input
        type="text"
        [(ngModel)]="value"
        (input)="onInputChange($event)"
        (keydown)="onKeyDown($event)"
        (blur)="onBlur()"
        (click)="onInputClick()"
        (focus)="onInputFocus()"
        [placeholder]="placeholder"
        class="autocomplete-input"
        style="width: 100%; height: 100%; border: 1px solid #007bff; outline: none; padding: 4px 8px; font-size: 13px; background: white; box-sizing: border-box; border-radius: 2px;"
      />
      <div
        *ngIf="showDropdown && filteredOptions.length > 0"
        class="autocomplete-dropdown"
        #dropdown
        (click)="$event.stopPropagation()"
        (scroll)="onDropdownScroll($event)"
      >
        <div class="dropdown-header">
          {{
            isMaterialSearch
              ? 'Select material'
              : isPartNumberSearch
              ? 'Select part number'
              : 'Select option'
          }}
          ({{ filteredOptions.length }}
          available)
        </div>
        <div
          *ngFor="let option of filteredOptions; let i = index"
          [class.selected]="i === selectedIndex"
          class="dropdown-option"
          (click)="selectOption(option); $event.stopPropagation()"
          (mouseenter)="selectedIndex = i"
        >
          <div
            *ngIf="(isMaterialSearch || isPartNumberSearch) && materialOptions[i]"
            class="material-option"
          >
            <div class="material-name">{{ option }}</div>
            <div class="material-details" *ngIf="isMaterialSearch">
              <div *ngIf="materialOptions[i].supplier" class="detail-line">
                supplier: {{ materialOptions[i].supplier }}
              </div>
              <div *ngIf="materialOptions[i].color" class="detail-line">
                color: {{ materialOptions[i].color }}
              </div>
            </div>
            <div class="material-details" *ngIf="isPartNumberSearch">
              <div *ngIf="materialOptions[i].supplier" class="detail-line">
                Supplier: {{ materialOptions[i].supplier }}
              </div>
              <div *ngIf="materialOptions[i].color" class="detail-line">
                Color: {{ materialOptions[i].color }}
              </div>
              <div *ngIf="materialOptions[i].ptcmaterialName" class="detail-line">
                Material: {{ materialOptions[i].ptcmaterialName }}
              </div>
            </div>
          </div>
          <div *ngIf="!isMaterialSearch && !isPartNumberSearch">
            {{ option }}
          </div>
        </div>
        <div *ngIf="isLoadingMore" class="dropdown-loading">Loading more...</div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 150px !important;
        min-height: 30px !important;
        box-sizing: border-box !important;
      }

      .autocomplete-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: visible;
        /* Firefox compatibility */
        -moz-box-sizing: border-box;
      }

      .autocomplete-input {
        width: 100% !important;
        height: 100% !important;
        border: 1px solid #007bff !important;
        outline: none !important;
        padding: 4px 8px !important;
        font-size: 13px !important;
        background: white !important;
        box-sizing: border-box !important;
        border-radius: 2px !important;
        /* Firefox compatibility */
        -moz-box-sizing: border-box !important;
        -moz-border-radius: 2px !important;
      }

      .autocomplete-input:focus {
        border-color: #0056b3 !important;
        box-shadow: 0 0 3px rgba(0, 123, 255, 0.3) !important;
      }

      /* Text selection styling for autocomplete input */
      .autocomplete-input::selection {
        background-color: #007bff !important;
        color: white !important;
      }

      .autocomplete-input::-moz-selection {
        background-color: #007bff !important;
        color: white !important;
      }

      .autocomplete-dropdown {
        position: absolute !important;
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 4px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        max-height: 200px !important;
        overflow-y: auto !important;
        z-index: 999999 !important;
        min-width: 200px !important;
        max-width: 300px !important;
        /* Firefox compatibility */
        -moz-box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        -moz-border-radius: 4px !important;
      }

      .dropdown-header {
        padding: 8px 12px !important;
        background: #f8fafc !important;
        font-size: 12px !important;
        color: #64748b !important;
        border-bottom: 1px solid #e2e8f0 !important;
        font-weight: 500 !important;
        text-align: center !important;
      }

      .dropdown-option {
        padding: 8px 12px !important;
        cursor: pointer !important;
        border-bottom: 1px solid #f1f5f9 !important;
        font-size: 13px !important;
        color: #374151 !important;
        background: #ffffff !important;
        transition: all 0.2s ease !important;
        /* Firefox compatibility */
        -moz-transition: all 0.2s ease !important;
      }

      .dropdown-option:hover,
      .dropdown-option.selected {
        background: #f0f9ff !important;
        color: #1e40af !important;
      }

      .dropdown-option:last-child {
        border-bottom: none !important;
        border-radius: 0 0 4px 4px !important;
      }

      .dropdown-option:first-child {
        border-radius: 0 !important;
      }

      .material-option {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .material-name {
        font-weight: 500;
        color: #1f2937;
        font-size: 13px;
      }

      .material-details {
        font-size: 11px;
        color: #6b7280;
        font-style: italic;
        margin-top: 4px;
      }

      .detail-line {
        margin: 2px 0;
        line-height: 1.4;
      }

      .dropdown-loading {
        padding: 12px !important;
        text-align: center !important;
        color: #64748b !important;
        font-size: 12px !important;
        font-style: italic !important;
        background: #f8fafc !important;
        border-top: 1px solid #e2e8f0 !important;
      }
    `,
  ],
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
  public materialOptions: any[] = []; // Store full material objects from API
  public showDropdown: boolean = false;
  public selectedIndex: number = -1;
  public isMaterialSearch: boolean = false; // Flag to determine if this is material search
  public isPartNumberSearch: boolean = false; // Flag to determine if this is part number search
  public isLoadingMore: boolean = false; // Flag to show loading indicator

  private params: any;
  private originalValue: string = '';
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];
  private dataService: DataService;
  private searchSubject = new Subject<string>();
  private isDestroyed: boolean = false;
  private currentQuery: string = '';
  private fromIndex: number = 1;
  private toIndex: number = this.PAGE_SIZE; // Use PAGE_SIZE constant
  private hasMore: boolean = false;

  constructor() {
    // DataService will be set in agInit when params are available
    this.dataService = null as any;
  }

  ngOnInit() {
    this.originalValue = this.value;

    // Set up Material API search with debouncing
    this.searchSubject
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only search if query changed
        switchMap((query) => {
          // For material or part number search, use API search if DataService is available
          if ((this.isMaterialSearch || this.isPartNumberSearch) && this.dataService) {
            // Use API search (minimum 1 character for better UX)
            if (query && query.length >= 1) {
              // Reset pagination for new search
              this.currentQuery = query;
              this.fromIndex = 1;
              this.toIndex = this.PAGE_SIZE;
              this.isLoadingMore = false;
              return this.dataService.searchMaterials(
                query,
                this.fromIndex,
                this.toIndex,
                this.isPartNumberSearch
              );
            }
            // Reset state when query is cleared
            this.fromIndex = 1;
            this.toIndex = this.PAGE_SIZE;
            this.hasMore = false;
            return of({ results: [], resultCount: 0, hasMore: false });
          } else {
            if (query && query.length >= 2) {
              // Fallback to local filtering for non-material fields
              return of({
                results: this.filterLocalOptions(query),
                resultCount: 0,
                hasMore: false,
              });
            }
            return of({ results: [], resultCount: 0, hasMore: false });
          }
        }),
        catchError((error) => {
          console.error('[Part Search] API Error in searchMaterials:', error);
          if (error.error) {
            console.error('[Part Search] Error details:', error.error);
          }
          return of({ results: [], resultCount: 0, hasMore: false });
        })
      )
      .subscribe((response) => {
        if (!this.isDestroyed) {
          const materials = response.results || [];
          const resultCount = response.resultCount || 0;

          // Determine if there are more results to load
          // hasMore is true if resultCount > current toIndex
          this.hasMore = resultCount > this.toIndex;

          if (Array.isArray(materials) && materials.length > 0) {
            // API response format - extract display value based on search type
            if (this.fromIndex === 1) {
              // First page - replace existing results
              this.materialOptions = materials;
            } else {
              // Subsequent pages - append results (shouldn't happen in initial search, but handle it)
              this.materialOptions = [...this.materialOptions, ...materials];
            }

            // Extract display value based on search type
            this.filteredOptions = this.materialOptions
              .map((material) => {
                if (this.isPartNumberSearch) {
                  return material.partNumber || '';
                } else {
                  return material.ptcmaterialName || material.materialName || material.name || '';
                }
              })
              .filter((name) => name.length > 0);
          } else if (this.fromIndex === 1) {
            // First page with no results - clear everything
            this.materialOptions = [];
            this.filteredOptions = [];
            this.hasMore = false;
          }

          this.isLoadingMore = false;
          const shouldShow = this.filteredOptions.length > 0;
          this.showDropdown = shouldShow;

          // Position dropdown after showing
          if (this.showDropdown) {
            setTimeout(() => this.positionDropdown(), 0);
          }
        }
      });
  }

  ngAfterViewInit() {
    // Focus the input after view is initialized
    setTimeout(() => {
      this.input.nativeElement.focus();
      this.input.nativeElement.select();

      // Show dropdown immediately when focused
      if (this.isMaterialSearch || this.isPartNumberSearch) {
        // For material/part number search, show dropdown only after search results
        // Trigger initial search if value exists
        if (this.dataService && this.value && this.value.length >= 1) {
          this.searchSubject.next(this.value);
        }
      } else if (this.options.length > 0) {
        // For static options (color, supplier, etc.), show dropdown immediately
        this.filterOptions();
        this.showDropdown = this.filteredOptions.length > 0;
      }

      // Position dropdown if it's visible
      if (this.showDropdown) {
        this.positionDropdown();
      }
    }, 0);
  }

  ngOnDestroy() {
    // Clean up any potential memory leaks
    this.closeDropdown();
  }

  agInit(params: any): void {
    this.params = params;

    // Get DataService from multiple sources (with fallback to grid API context)
    this.dataService =
      params.context?.dataService ||
      params.params?.context?.dataService ||
      (params.api?.gridOptionsService?.get
        ? params.api.gridOptionsService.get('context')?.dataService
        : null) ||
      (params.api?.getContext ? params.api.getContext()?.dataService : null);

    // Ensure value is always a string
    this.value = params.value ? String(params.value) : '';
    this.placeholder = params.placeholder || 'Type to search materials...';

    // Determine if this is material or part number search
    const fieldName = params.column?.getColId() || params.colDef?.field || '';

    // Check for part number search first (higher priority)
    // Support both 'bomLinkPart' (local) and 'partNumber' (production) field names
    this.isPartNumberSearch =
      params.isPartNumberSearch === true ||
      fieldName === 'bomLinkPart' ||
      fieldName === 'partNumber' ||
      fieldName === 'part';

    // Material search should only be true if NOT part number search
    this.isMaterialSearch =
      !this.isPartNumberSearch &&
      (params.useApiSearch === true ||
        (this.dataService &&
          (this.placeholder.includes('material') || this.placeholder.includes('Material'))) ||
        (this.dataService && fieldName === 'material'));

    // Get options from params - support multiple formats
    // Note: cellEditorParams can be a function, but AG Grid calls it and passes the result as params
    // So params.values should already be the array if it exists
    let valuesParam = params.values;
    if (typeof valuesParam === 'function') {
      // If values is a function, call it with params to get the actual values
      valuesParam = valuesParam(params);
    }

    if (valuesParam && Array.isArray(valuesParam)) {
      this.options = valuesParam
        .map((opt: any) => String(opt))
        .filter((opt: string) => opt.length > 0);
    } else if (params.options && Array.isArray(params.options)) {
      // Alternative property name for options
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

    // Support custom filtering
    if (params.filterFunction && typeof params.filterFunction === 'function') {
      this.customFilterFunction = params.filterFunction;
    }

    // Only filter options if we have static options (not using Material API or Part Number search)
    // If using API search, don't filter static options
    if (this.options.length > 0 && !this.isMaterialSearch && !this.isPartNumberSearch) {
      this.filterOptions();
    }

    // If using API search for part numbers, ensure we trigger search when value exists
    if (this.isPartNumberSearch && this.dataService && this.value && this.value.length >= 1) {
      // Will be triggered in ngAfterViewInit
    }
  }

  getValue(): any {
    return this.value;
  }

  isPopup(): boolean {
    return false; // Render inline in the cell
  }

  onInputChange(event: any): void {
    this.value = event.target.value || '';

    // For material or part number search, trigger API search
    if (this.isMaterialSearch || this.isPartNumberSearch) {
      // Ensure dataService is available before triggering search
      if (this.dataService) {
        this.searchSubject.next(this.value);
      }
    } else {
      // For static options (color, supplier, etc.), filter locally
      this.filterOptions();
      this.showDropdown = this.filteredOptions.length > 0;
    }

    this.selectedIndex = -1;

    // Reposition dropdown when content changes
    if (this.showDropdown) {
      setTimeout(() => this.positionDropdown(), 0);
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
          // If no option is selected but we have a value, just close the dropdown
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

  onBlur(): void {
    // Don't close dropdown immediately to allow for clicks
    // The dropdown will be closed when an option is selected
  }

  onInputClick(): void {
    // Re-read options from node data for supplier/color fields to get latest filtered values
    this.refreshOptionsFromNodeData();

    // Show dropdown when input is clicked
    if (!this.isMaterialSearch && !this.isPartNumberSearch) {
      this.filterOptions();
      this.showDropdown = this.filteredOptions.length > 0;
    } else if (this.isPartNumberSearch || this.isMaterialSearch) {
      // For API search, trigger search if we have a value
      if (this.dataService && this.value && this.value.length >= 1) {
        this.searchSubject.next(this.value);
      }
    }

    if (this.showDropdown) {
      setTimeout(() => this.positionDropdown(), 0);
    }
  }

  onInputFocus(): void {
    // Re-read options from node data for supplier/color fields to get latest filtered values
    this.refreshOptionsFromNodeData();

    // Show dropdown when input is focused
    if (!this.isMaterialSearch && !this.isPartNumberSearch) {
      this.filterOptions();
      this.showDropdown = this.filteredOptions.length > 0;
    } else if (this.isPartNumberSearch || this.isMaterialSearch) {
      // For API search, trigger search if we have a value
      if (this.dataService && this.value && this.value.length >= 1) {
        this.searchSubject.next(this.value);
      }
    }

    if (this.showDropdown) {
      setTimeout(() => this.positionDropdown(), 0);
    }
  }

  /**
   * Refresh options from node data to get the latest filtered values
   * This is important for supplier/color fields that have filtered values based on material selection
   */
  private refreshOptionsFromNodeData(): void {
    if (!this.params || !this.params.node) return;

    const fieldName = this.params.column?.getColId() || this.params.colDef?.field || '';
    const nodeData = this.params.node.data || {};

    // Only refresh for supplier and color fields
    if (fieldName === 'supplier' || fieldName === 'color') {
      let filteredValues: string[] = [];

      if (
        fieldName === 'supplier' &&
        nodeData._availableSuppliers &&
        Array.isArray(nodeData._availableSuppliers)
      ) {
        filteredValues = nodeData._availableSuppliers;
      } else if (
        fieldName === 'color' &&
        nodeData._availableColors &&
        Array.isArray(nodeData._availableColors)
      ) {
        filteredValues = nodeData._availableColors;
      }

      // If we have filtered values, update the options
      if (filteredValues.length > 0) {
        this.options = filteredValues
          .map((opt: any) => String(opt))
          .filter((opt: string) => opt.length > 0);
        // Re-filter with current input value
        this.filterOptions();
      }
    }
  }

  onDropdownScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.isLoadingMore || !this.hasMore) return;

    // Check if scrolled near bottom (within 50px)
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 50) {
      this.loadMoreResults();
    }
  }

  private loadMoreResults(): void {
    if (this.isLoadingMore || !this.hasMore || !this.dataService || !this.currentQuery) return;

    this.isLoadingMore = true;

    // Calculate next page indices: fromIndex = previous toIndex + 1, toIndex = fromIndex + (PAGE_SIZE - 1)
    this.fromIndex = this.toIndex + 1;
    this.toIndex = this.fromIndex + (this.PAGE_SIZE - 1); // Load next PAGE_SIZE items (e.g., 11-20, 21-30, etc.)

    this.dataService
      .searchMaterials(this.currentQuery, this.fromIndex, this.toIndex, this.isPartNumberSearch)
      .subscribe({
        next: (response) => {
          if (!this.isDestroyed) {
            const materials = response.results || [];
            const resultCount = response.resultCount || 0;

            // Determine if there are more results to load
            // hasMore is true if resultCount > current toIndex
            this.hasMore = resultCount > this.toIndex;

            if (Array.isArray(materials) && materials.length > 0) {
              // Append new materials to existing results (both material and part number searches)
              this.materialOptions = [...this.materialOptions, ...materials];

              // Update filtered options
              this.filteredOptions = this.materialOptions
                .map((material) => {
                  if (this.isPartNumberSearch) {
                    return material.partNumber || '';
                  } else {
                    return material.ptcmaterialName || material.materialName || material.name || '';
                  }
                })
                .filter((name) => name.length > 0);
            } else {
              // No more results
              this.hasMore = false;
            }

            this.isLoadingMore = false;
          }
        },
        error: (error) => {
          console.error('Error loading more results:', error);
          this.isLoadingMore = false;
          this.hasMore = false;
        },
      });
  }

  selectOption(option: string): void {
    this.value = option;
    this.closeDropdown();

    // Find the selected material object for material or part number search
    const selectedMaterial =
      this.isMaterialSearch || this.isPartNumberSearch
        ? this.materialOptions.find((material) => {
            if (this.isPartNumberSearch) {
              return (material.partNumber || '') === option;
            } else {
              // For material search, match by material name
              return (
                (material.ptcmaterialName || material.materialName || material.name || '') ===
                option
              );
            }
          })
        : null;

    // Force the value to be set in AG Grid
    if (this.params && this.params.node) {
      this.params.node.setDataValue(this.params.column.getColId(), option);

      // Also update the data object directly
      if (this.params.node.data) {
        this.params.node.data[this.params.column.getColId()] = option;
      }

      // Auto-populate other fields from the selected material
      if (selectedMaterial) {
        // For grouped materials, pass the grouped material (which has colors/suppliers arrays)
        // The autoPopulateFields method will handle using the first variant for default values
        this.autoPopulateFields(selectedMaterial);
      } else if (!this.isMaterialSearch && !this.isPartNumberSearch) {
        // For part numbers, trigger feature auto-population
        this.triggerFeatureAutoPopulation(option);
      }
    }

    // Stop editing immediately to commit the value
    if (this.params && this.params.api) {
      this.params.api.stopEditing();

      // Force refresh of the cell to show the selected value
      setTimeout(() => {
        if (this.params && this.params.node) {
          this.params.api.refreshCells({
            rowNodes: [this.params.node],
            force: true,
          });
        }
      }, 50);
    }
  }

  /**
   * Filter local options as fallback when API is not available
   */
  private filterLocalOptions(query: string): string[] {
    if (!this.options || this.options.length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase();
    return this.options.filter((option) => option.toLowerCase().includes(searchTerm));
  }

  /**
   * Auto-populate other fields based on selected material
   */
  private autoPopulateFields(material: any): void {
    if (!this.params || !this.params.node) return;

    const originalData = { ...this.params.node.data };
    const fieldName = this.params.column?.getColId() || this.params.colDef?.field || '';

    // Populate based on search type
    if (this.isPartNumberSearch) {
      // For part number search, only populate the part number field itself
      // Don't auto-populate color or supplier - let user choose from dropdown
      // Support both 'bomLinkPart' (local) and 'partNumber' (production) field names
      const partFieldName =
        fieldName === 'bomLinkPart' || fieldName === 'partNumber' ? fieldName : 'part';

      // Try to get data from fullResult first (raw API response), then fallback to transformed material
      const fullResult = material.fullResult || {};
      const materialColor = fullResult['material-color'] || {};

      // Get part number value - prefer fullResult, then transformed material
      const partValue = materialColor.partNumber || material.partNumber || '';
      if (partValue && originalData[partFieldName] !== partValue) {
        this.params.node.setDataValue(partFieldName, partValue);
        if (this.params.node.data) {
          this.params.node.data[partFieldName] = partValue;
        }
      }

      // Populate material from material.ptcmaterialName (this is okay to auto-populate)
      const materialObj = fullResult.material || {};
      const materialValue =
        materialObj.ptcmaterialName || material.ptcmaterialName || material.materialName || '';

      if (materialValue && originalData.material !== materialValue) {
        this.params.node.setDataValue('material', materialValue);
        if (this.params.node.data) {
          this.params.node.data.material = materialValue;
        }
      }

      // Fetch ALL parts with the same part number to get all available colors and suppliers
      // Don't auto-populate - let user choose from dropdown
      if (partValue && this.dataService) {
        this.fetchAllPartsForDropdowns(partValue, material);
      }
    } else {
      // For material search, populate material and other fields
      // Since we're not grouping anymore, each material entry is a unique combination
      const materialValue = material.ptcmaterialName || material.materialName || '';

      if (materialValue && originalData.material !== materialValue) {
        this.params.node.setDataValue('material', materialValue);
        if (this.params.node.data) {
          this.params.node.data.material = materialValue;
        }
      }

      // Auto-populate part number from selected material
      // Extract part number from the selected material object
      const fullResult = material.fullResult || {};
      const materialColor = fullResult['material-color'] || {};
      const partNumberFromMaterial = materialColor.partNumber || material.partNumber || '';

      if (partNumberFromMaterial) {
        // Use the actual field name (could be 'bomLinkPart' or 'partNumber' depending on environment)
        const partFieldName =
          fieldName === 'bomLinkPart' || fieldName === 'partNumber' ? fieldName : 'bomLinkPart';
        const existingPartNumber =
          originalData[partFieldName] ||
          originalData.bomLinkPart ||
          originalData.partNumber ||
          originalData.part ||
          '';
        if (existingPartNumber !== partNumberFromMaterial) {
          this.params.node.setDataValue(partFieldName, partNumberFromMaterial);
          if (this.params.node.data) {
            this.params.node.data[partFieldName] = partNumberFromMaterial;
          }

          // Refresh the grid to show the updated value
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

      // Set filtered values from the selected material entry only (not all materials with same name)
      // This ensures supplier and color dropdowns show only the values linked to the selected material
      if (materialValue) {
        this.fetchAllMaterialsForDropdowns(materialValue, material);
      }
      // Note: If no dataService, we skip auto-population to avoid flicker
      // The dropdowns will still work with the values from the selected material
    }

    // Populate common fields (excluding supplier and color - they're handled by async call)
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

    // Auto-populate SKU columns if available
    if (material.skus && Array.isArray(material.skus)) {
      const skuInfo = this.dataService?.getSkuInfo();
      if (skuInfo && skuInfo.length > 0) {
        skuInfo.forEach((sku) => {
          const skuFieldName = `sku${sku.sku}`;
          const skuValue = material.skus.includes(sku.sku)
            ? material.name || material.materialName
            : '';

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
    // Get the data service from the grid context
    const dataService = (this.params as any).context?.dataService;

    if (dataService) {
      this.triggerFeatureAutoPopulationWithService(partNumber, dataService);
    } else {
      // Fallback: try to get data service from grid API
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

    if (apiData && apiData.mbom) {
      const existingPart = apiData.mbom.find((part: any) => part.part === partNumber);
      if (existingPart) {
        if (this.params && this.params.node) {
          // Auto-populate all available fields from the existing part
          const fieldsToPopulate = [
            'supplier',
            'color',
            'feature',
            'shortDesc',
            'longDesc',
            'startDate',
            'endDate',
            'qty',
          ];

          // Temporarily disable cell value changed events
          const oldData = { ...this.params.node.data };

          // Auto-populate base fields
          fieldsToPopulate.forEach((fieldName) => {
            if (existingPart[fieldName] !== undefined && existingPart[fieldName] !== null) {
              // Only update if value is different
              if (oldData[fieldName] !== existingPart[fieldName]) {
                this.params.node.setDataValue(fieldName, existingPart[fieldName]);
                if (this.params.node.data) {
                  this.params.node.data[fieldName] = existingPart[fieldName];
                }
              }
            }
          });

          // Auto-populate SKU columns based on the skus array in the existing part
          const skuInfo = dataService.getSkuInfo();
          if (skuInfo && skuInfo.length > 0) {
            skuInfo.forEach((sku: any) => {
              const skuFieldName = `sku${sku.sku}`;
              const newSkuValue =
                existingPart.skus && existingPart.skus.includes(sku.sku)
                  ? existingPart.part // If SKU is included, use part number
                  : ''; // If SKU is not included, use empty string

              // Only update if value is different
              if (oldData[skuFieldName] !== newSkuValue) {
                this.params.node.setDataValue(skuFieldName, newSkuValue);
                if (this.params.node.data) {
                  this.params.node.data[skuFieldName] = newSkuValue;
                }
              }
            });
          }

          // Refresh the row to show all updated values
          if (this.params.api) {
            this.params.api.refreshCells({
              rowNodes: [this.params.node],
              force: true,
            });
          }
        }
      }
    }
  }

  private filterOptions(): void {
    const searchValue = String(this.value || '')
      .toLowerCase()
      .trim();

    if (this.customFilterFunction) {
      // Use custom filtering function if provided
      this.filteredOptions = this.customFilterFunction(searchValue, this.options);
    } else {
      // Enhanced filtering behavior
      if (!searchValue) {
        // Show first 8 options when no search term
        this.filteredOptions = this.options.slice(0, 8);
      } else {
        // Filter options with priority: starts with, then contains
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
    this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1; // Auto-select first option
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
      // Get the input's position relative to its container
      const inputRect = inputElement.getBoundingClientRect();
      const container = inputElement.offsetParent || document.body;
      const containerRect = container.getBoundingClientRect();

      // Calculate position relative to container
      const relativeTop = inputRect.bottom - containerRect.top + 2;
      const relativeLeft = inputRect.left - containerRect.left;

      // Position dropdown below the input
      dropdownElement.style.top = `${relativeTop}px`;
      dropdownElement.style.left = `${relativeLeft}px`;

      // Set width to match input or be at least as wide
      const minWidth = Math.max(inputRect.width, 200);
      dropdownElement.style.width = `${minWidth}px`;

      // Check if dropdown would go off-screen and adjust if needed
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 200; // max-height from CSS

      if (inputRect.bottom + dropdownHeight > viewportHeight) {
        // Position above the input if there's not enough space below
        if (inputRect.top - dropdownHeight > 0) {
          const relativeTopAbove = inputRect.top - containerRect.top - dropdownHeight - 2;
          dropdownElement.style.top = `${relativeTopAbove}px`;
        }
      }

      // Ensure dropdown doesn't go off-screen horizontally
      const viewportWidth = window.innerWidth;
      const dropdownWidth = minWidth;

      if (inputRect.left + dropdownWidth > viewportWidth) {
        const adjustedLeft = Math.max(0, viewportWidth - dropdownWidth - 10);
        const relativeAdjustedLeft = adjustedLeft - containerRect.left;
        dropdownElement.style.left = `${relativeAdjustedLeft}px`;
      }

      // Force reflow for Firefox compatibility
      dropdownElement.offsetHeight;
    } catch (error) {
      console.warn('Error positioning dropdown, using fallback:', error);
      this.positionDropdownFallback();
    }
  }

  private positionDropdownFallback(): void {
    if (!this.dropdown || !this.input) {
      return;
    }

    const dropdownElement = this.dropdown.nativeElement;
    const inputElement = this.input.nativeElement;

    // Simple fallback positioning
    dropdownElement.style.top = '100%';
    dropdownElement.style.left = '0';
    dropdownElement.style.width = '100%';
    dropdownElement.style.position = 'absolute';
  }

  // Public method to refresh options (useful for dynamic data)
  public refreshOptions(newOptions: string[]): void {
    this.options = newOptions.map((opt) => String(opt));
    this.filterOptions();
  }

  // Public method to set custom filter function
  public setFilterFunction(filterFn: (searchTerm: string, options: string[]) => string[]): void {
    this.customFilterFunction = filterFn;
    this.filterOptions();
  }

  // Public method to get current value
  public getCurrentValue(): string {
    return this.value;
  }

  // Public method to set value programmatically
  public setValue(newValue: string): void {
    this.value = String(newValue);
    this.filterOptions();
  }

  /**
   * Set initial filtered values from the selected material for immediate dropdown filtering
   * This ensures dropdowns work instantly even before async fetch completes
   */
  private setInitialFilteredValues(selectedMaterial: any): void {
    if (!this.params || !this.params.node) return;

    const fullResult = selectedMaterial.fullResult || {};
    const colorObj = fullResult.color || {};
    const supplierObj = fullResult.supplier || {};

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

    // Set initial filtered values (will be updated when all materials are fetched)
    if (colorName) {
      this.params.node.setDataValue('_availableColors', [colorName]);
      if (this.params.node.data) {
        this.params.node.data._availableColors = [colorName];
      }
    }

    if (supplierName) {
      this.params.node.setDataValue('_availableSuppliers', [supplierName]);
      if (this.params.node.data) {
        this.params.node.data._availableSuppliers = [supplierName];
      }
    }
  }

  /**
   * Set filtered values from the selected material entry only
   * Only show the supplier and color that are linked to the selected material entry
   */
  private fetchAllMaterialsForDropdowns(materialName: string, selectedMaterial: any): void {
    if (!this.params || !this.params.node || !selectedMaterial) return;

    // Get supplier and color from the selected material entry only (not all materials with same name)
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
    // Extract part number from multiple possible locations
    const partNumber = materialColor.partNumber || selectedMaterial.partNumber || '';

    // Store only the selected material's supplier and color (not all from all materials)
    const availableColors = colorName ? [colorName] : [];
    const availableSuppliers = supplierName ? [supplierName] : [];
    const availablePartNumbers = partNumber ? [partNumber] : [];

    // Always set _availableColors (even if empty) to ensure filtered list is used
    this.params.node.setDataValue('_availableColors', availableColors);
    if (this.params.node.data) {
      this.params.node.data._availableColors = availableColors;
    }

    // Always set _availableSuppliers (even if empty) to ensure filtered list is used
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

    // Auto-populate supplier and color from selected material
    const currentData = this.params.node.data || {};
    const existingColor = currentData.color || '';
    const existingSupplier = currentData.supplier || '';

    // Auto-populate color if available
    if (colorName && existingColor !== colorName) {
      this.params.node.setDataValue('color', colorName);
      if (this.params.node.data) {
        this.params.node.data.color = colorName;
      }
    }

    // Auto-populate supplier if available
    if (supplierName && existingSupplier !== supplierName) {
      this.params.node.setDataValue('supplier', supplierName);
      if (this.params.node.data) {
        this.params.node.data.supplier = supplierName;
      }
    }

    // Auto-populate part number if available
    // Use the actual field name (could be 'bomLinkPart' or 'partNumber' depending on environment)
    const fieldName = this.params.column?.getColId() || this.params.colDef?.field || '';
    const partFieldName =
      fieldName === 'bomLinkPart' || fieldName === 'partNumber' ? fieldName : 'bomLinkPart';
    const existingPartNumber =
      currentData[partFieldName] ||
      currentData.bomLinkPart ||
      currentData.partNumber ||
      currentData.part ||
      '';
    if (partNumber && existingPartNumber !== partNumber) {
      // Populate the part number field using the actual field name
      this.params.node.setDataValue(partFieldName, partNumber);
      if (this.params.node.data) {
        this.params.node.data[partFieldName] = partNumber;
      }

      // Also refresh the grid to show the updated value
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

  /**
   * Fetch all parts with the same part number to collect all available colors and suppliers
   * This ensures the color and supplier dropdowns show all possible values for that part number
   */
  private fetchAllPartsForDropdowns(partNumber: string, selectedMaterial: any): void {
    if (!this.params || !this.params.node || !selectedMaterial || !this.dataService || !partNumber)
      return;

    // Immediately set initial filtered values from selected part for instant dropdown filtering
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

    // Set initial filtered values (will be updated when all parts are fetched)
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

    // Fetch all parts with this part number (use a large toIndex to get all results)
    this.dataService.searchMaterials(partNumber, 1, 1000, true).subscribe({
      next: (response) => {
        if (!this.isDestroyed && this.params && this.params.node) {
          const allParts = response.results || [];

          // Collect all unique colors and suppliers from all parts with this part number
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

          // Store available colors and suppliers arrays for dropdowns
          // Always set these (even if empty) so the cell editor knows to use filtered values
          const availableColors = Array.from(uniqueColors).sort();
          const availableSuppliers = Array.from(uniqueSuppliers).sort();

          // Always set _availableColors (even if empty) to ensure filtered list is used
          this.params.node.setDataValue('_availableColors', availableColors);
          if (this.params.node.data) {
            this.params.node.data._availableColors = availableColors;
          }

          // Always set _availableSuppliers (even if empty) to ensure filtered list is used
          this.params.node.setDataValue('_availableSuppliers', availableSuppliers);
          if (this.params.node.data) {
            this.params.node.data._availableSuppliers = availableSuppliers;
          }

          // Validate and update color field
          const currentData = this.params.node.data || {};
          const existingColor = currentData.color || '';
          const existingSupplier = currentData.supplier || '';

          // Validate color
          if (availableColors.length === 1 && initialColorValue) {
            // Only one color option - auto-populate it
            if (existingColor !== initialColorValue) {
              this.params.node.setDataValue('color', initialColorValue);
              if (this.params.node.data) {
                this.params.node.data.color = initialColorValue;
              }
            }
          } else if (availableColors.length > 1) {
            // Multiple colors available - validate existing value is in the list
            if (existingColor && !availableColors.includes(existingColor)) {
              this.params.node.setDataValue('color', '');
              if (this.params.node.data) {
                this.params.node.data.color = '';
              }
            }
          }

          // Validate supplier
          if (availableSuppliers.length === 1 && initialSupplierValue) {
            // Only one supplier option - auto-populate it
            if (existingSupplier !== initialSupplierValue) {
              this.params.node.setDataValue('supplier', initialSupplierValue);
              if (this.params.node.data) {
                this.params.node.data.supplier = initialSupplierValue;
              }
            }
          } else if (availableSuppliers.length > 1) {
            // Multiple suppliers available - validate existing value is in the list
            if (existingSupplier && !availableSuppliers.includes(existingSupplier)) {
              this.params.node.setDataValue('supplier', '');
              if (this.params.node.data) {
                this.params.node.data.supplier = '';
              }
            }
          }
        }
      },
      error: (error) => {
        console.error('Error fetching all parts for dropdowns:', error);
      },
    });
  }
}
