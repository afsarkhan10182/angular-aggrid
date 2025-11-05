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
      >
        <div class="dropdown-header">
          {{ isMaterialSearch ? 'Select material' : 'Select part number' }} ({{
            filteredOptions.length
          }}
          available)
        </div>
        <div
          *ngFor="let option of filteredOptions; let i = index"
          [class.selected]="i === selectedIndex"
          class="dropdown-option"
          (click)="selectOption(option); $event.stopPropagation()"
          (mouseenter)="selectedIndex = i"
        >
          <div *ngIf="isMaterialSearch && materialOptions[i]" class="material-option">
            <div class="material-name">{{ option }}</div>
            <div class="material-details">
              <span *ngIf="materialOptions[i].supplier"
                >Supplier: {{ materialOptions[i].supplier }}</span
              >
              <span *ngIf="materialOptions[i].color"> | Color: {{ materialOptions[i].color }}</span>
            </div>
          </div>
          <div *ngIf="!isMaterialSearch || !materialOptions[i]">
            {{ option }}
          </div>
        </div>
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
      }
    `,
  ],
})
export class AutocompleteCellEditorComponent
  implements ICellEditorAngularComp, OnInit, AfterViewInit, OnDestroy
{
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

  private params: any;
  private originalValue: string = '';
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];
  private dataService: DataService;
  private searchSubject = new Subject<string>();
  private isDestroyed: boolean = false;

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
          // For material search, use API search if DataService is available
          if (this.isMaterialSearch && this.dataService) {
            // Use API search for materials (minimum 1 character for better UX)
            if (query && query.length >= 1) {
              return this.dataService.searchMaterials(query);
            }
            return of([]);
          } else if (query && query.length >= 2) {
            // Fallback to local filtering for non-material fields
            return of(this.filterLocalOptions(query));
          }
          return of([]);
        }),
        catchError((error) => {
          return of([]);
        })
      )
      .subscribe((materials) => {
        if (!this.isDestroyed) {
          if (Array.isArray(materials) && materials.length > 0) {
            // API response format - extract ptcmaterialName from material object
            this.materialOptions = materials;
            this.filteredOptions = materials
              .map(
                (material) =>
                  material.ptcmaterialName || material.materialName || material.name || ''
              )
              .filter((name) => name.length > 0); // Filter out empty strings
          } else {
            // Local filtering fallback
            this.materialOptions = [];
            this.filteredOptions = Array.isArray(materials)
              ? materials.filter((m) => m && m.length > 0)
              : [];
          }

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
      this.showDropdown = this.filteredOptions.length > 0;

      // Position dropdown if it's visible
      if (this.showDropdown) {
        this.positionDropdown();
      }

      // For material search with API, trigger initial search if value exists
      if (this.isMaterialSearch && this.dataService && this.value && this.value.length >= 1) {
        // Trigger search for existing value
        this.searchSubject.next(this.value);
      }
    }, 0);
  }

  ngOnDestroy() {
    // Clean up any potential memory leaks
    this.closeDropdown();
  }

  agInit(params: any): void {
    this.params = params;

    // Get DataService from grid context or params context
    this.dataService = params.context?.dataService || params.params?.context?.dataService;

    // Ensure value is always a string
    this.value = params.value ? String(params.value) : '';
    this.placeholder = params.placeholder || 'Type to search materials...';

    // Determine if this is material search
    this.isMaterialSearch =
      params.useApiSearch ||
      (this.dataService &&
        (this.placeholder.includes('material') || this.placeholder.includes('Material')));

    // Get options from params - support multiple formats
    if (params.values && Array.isArray(params.values)) {
      this.options = params.values.map((opt: any) => String(opt));
    } else if (typeof params.values === 'function') {
      this.options = params.values().map((opt: any) => String(opt));
    } else if (params.options && Array.isArray(params.options)) {
      // Alternative property name for options
      this.options = params.options.map((opt: any) => String(opt));
    } else if (typeof params.options === 'function') {
      this.options = params.options().map((opt: any) => String(opt));
    } else {
      this.options = [];
    }

    // Support custom filtering
    if (params.filterFunction && typeof params.filterFunction === 'function') {
      this.customFilterFunction = params.filterFunction;
    }

    // Only filter options if we have static options (not using Material API)
    if (this.options.length > 0 && !this.isMaterialSearch) {
      this.filterOptions();
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

    // For material search, trigger API search
    if (this.isMaterialSearch) {
      this.searchSubject.next(this.value);
    } else {
      // For static options, filter locally
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
    // Show dropdown when input is clicked
    if (!this.isMaterialSearch) {
      this.filterOptions();
      this.showDropdown = this.filteredOptions.length > 0;
    }

    if (this.showDropdown) {
      setTimeout(() => this.positionDropdown(), 0);
    }
  }

  onInputFocus(): void {
    // Show dropdown when input is focused
    if (!this.isMaterialSearch) {
      this.filterOptions();
      this.showDropdown = this.filteredOptions.length > 0;
    }

    if (this.showDropdown) {
      setTimeout(() => this.positionDropdown(), 0);
    }
  }

  selectOption(option: string): void {
    this.value = option;
    this.closeDropdown();

    // Find the selected material object for material search
    const selectedMaterial = this.isMaterialSearch
      ? this.materialOptions.find(
          (material) =>
            (material.ptcmaterialName || material.materialName || material.name || '') === option
        )
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
        this.autoPopulateFields(selectedMaterial);
      } else if (!this.isMaterialSearch) {
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

    const fieldsToPopulate = [
      'supplier',
      'color',
      'feature',
      'startDate',
      'endDate',
      'qty',
      'description',
      'shortDesc',
      'longDesc',
    ];

    // Store original data to avoid infinite loops
    const originalData = { ...this.params.node.data };

    fieldsToPopulate.forEach((fieldName) => {
      const value = material[fieldName];
      if (value !== undefined && value !== null && originalData[fieldName] !== value) {
        this.params.node.setDataValue(fieldName, value);
        if (this.params.node.data) {
          this.params.node.data[fieldName] = value;
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
}
