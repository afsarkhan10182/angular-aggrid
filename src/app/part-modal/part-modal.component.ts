import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../services/data.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './part-modal.component.html',
  styleUrls: ['./part-modal.component.css'],
})
export class PartModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() partData: any = {};
  @Input() skuData: any[] = [];
  @Output() close = new EventEmitter<void>();

  // Autocomplete properties
  materialSearchInput: string = '';
  filteredMaterials: any[] = [];
  showAutocompleteDropdown: boolean = false;
  selectedMaterialIndex: number = -1;
  private searchSubject = new Subject<string>();

  // Fields that are already displayed in overview (excluding 'part' which is in title, and dates which are in timeline)
  private displayedFields = new Set([
    'supplier',
    'feature',
    'qty',
    'color',
    'startDate',
    'endDate',
  ]);

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    // Initialize material search input with current material value
    this.materialSearchInput = this.partData?.material || this.partData?.part || '';

    // Set up material search with debouncing
    this.searchSubject
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only search if query changed
        switchMap((query) => {
          if (query && query.trim().length >= 1) {
            // Use mock2.json search - later will be replaced with API call
            return this.dataService.searchMaterials(query.trim()).pipe(
              catchError((error) => {
                return of([]);
              })
            );
          }
          return of([]);
        }),
        catchError((error) => {
          return of([]);
        })
      )
      .subscribe({
        next: (materials) => {
          this.filteredMaterials = materials || [];
          const shouldShow: boolean =
            this.filteredMaterials.length > 0 &&
            !!this.materialSearchInput &&
            this.materialSearchInput.trim().length >= 1;
          this.showAutocompleteDropdown = shouldShow;
          this.selectedMaterialIndex = -1;
          // Debug logging
        },
        error: (error) => {
          this.filteredMaterials = [];
          this.showAutocompleteDropdown = false;
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update material search input when partData changes
    if (changes['partData'] && changes['partData'].currentValue) {
      this.materialSearchInput = this.partData?.material || this.partData?.part || '';
    }
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  /**
   * Get all row data as key-value pairs for table display
   * Excludes SKU fields (they are displayed separately in widget format)
   * Validates and filters out invalid/wrong data
   */
  getAllRowData(): Array<{ key: string; value: any }> {
    if (!this.partData || typeof this.partData !== 'object') return [];

    const keyValuePairs: Array<{ key: string; value: any }> = [];
    const seenKeys = new Set<string>(); // Prevent duplicates

    // Exclude only Angular internal properties and system-level properties
    const systemFields = new Set([
      '$', // Angular internal
      'isMaterialHeader',
      'isDirectRow',
      'isSectionHeader',
      'isSubRow',
      'isBranchHeader',
      'isNewRow',
      'hasLinkedBom',
      'isExpanded',
      'level',
      'parent',
      'children',
      'materialIndex',
      'section',
      'allSkus',
      'skus', // Exclude SKU array
    ]);

    Object.keys(this.partData).forEach((key) => {
      // Validate key is a valid string
      if (!key || typeof key !== 'string' || key.trim() === '') {
        return;
      }

      // Skip system/internal fields, Angular properties, and SKU fields
      if (
        !systemFields.has(key) &&
        !key.startsWith('$') &&
        !key.startsWith('sku') && // Exclude SKU fields - they're shown in widget
        !seenKeys.has(key) && // Prevent duplicates
        this.partData[key] !== null &&
        this.partData[key] !== undefined
      ) {
        seenKeys.add(key);

        let displayValue = this.partData[key];

        // Handle different value types
        if (typeof displayValue === 'object' && displayValue !== null) {
          // Skip functions
          if (typeof displayValue === 'function') {
            return;
          }

          // Convert arrays/objects to readable format
          if (Array.isArray(displayValue)) {
            if (displayValue.length === 0) return; // Skip empty arrays
            // Try to stringify arrays with valid data
            try {
              displayValue = JSON.stringify(displayValue, null, 2);
            } catch (e) {
              return; // Skip if can't stringify
            }
          } else {
            // For objects, only stringify if they have meaningful properties
            const objKeys = Object.keys(displayValue);
            if (objKeys.length === 0) return; // Skip empty objects
            try {
              displayValue = JSON.stringify(displayValue, null, 2);
            } catch (e) {
              return; // Skip if can't stringify
            }
          }
        }

        // Convert to string and validate
        const stringValue = String(displayValue).trim();

        // Only include if value is meaningful (not empty, not just whitespace)
        if (stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined') {
          keyValuePairs.push({
            key: key,
            value: displayValue,
          });
        }
      }
    });

    // Sort fields alphabetically
    return keyValuePairs.sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Get SKU data for widget display
   * Returns array of SKU objects with id and value
   * Only includes numeric SKU fields (e.g., sku100, sku100150) - excludes 'skus' array field
   * Validates SKU data to ensure proper display
   */
  getSkuData(): Array<{ id: string; value: string }> {
    if (!this.partData || typeof this.partData !== 'object') return [];

    const skuData: Array<{ id: string; value: string }> = [];
    const seenSkuIds = new Set<string>(); // Prevent duplicate SKU IDs

    // Extract SKU fields from partData
    Object.keys(this.partData).forEach((key) => {
      // Only process fields that match pattern: "sku" followed by digits (e.g., sku100, sku100150)
      // Exclude "skus" (plural array) and any non-numeric SKU fields
      if (
        key &&
        typeof key === 'string' &&
        key.startsWith('sku') &&
        key !== 'skus' &&
        /^sku\d+$/.test(key)
      ) {
        const skuValue = this.partData[key];

        // Validate SKU value exists and is valid
        if (skuValue !== null && skuValue !== undefined) {
          // Skip if value is an object or array (these show as [object Object])
          if (typeof skuValue === 'object') {
            return; // Skip object/array values
          }

          // Skip functions
          if (typeof skuValue === 'function') {
            return;
          }

          const stringValue = String(skuValue).trim();

          // Validate the value is meaningful
          if (stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined') {
            // Extract SKU number from field name (e.g., "sku100" -> "100")
            const skuNumber = key.replace('sku', '');

            // Validate SKU number is actually a number
            const skuNum = parseInt(skuNumber);
            if (isNaN(skuNum) || skuNum <= 0) {
              return; // Skip invalid SKU numbers
            }

            // Prevent duplicate SKU IDs
            if (!seenSkuIds.has(skuNumber)) {
              seenSkuIds.add(skuNumber);
              skuData.push({
                id: skuNumber,
                value: stringValue,
              });
            }
          }
        }
      }
    });

    // Sort SKU fields by SKU number (numeric sort)
    return skuData.sort((a, b) => {
      const numA = parseInt(a.id) || 0;
      const numB = parseInt(b.id) || 0;
      return numA - numB;
    });
  }

  hasSkus(): boolean {
    return this.getSkuData().length > 0;
  }

  formatKeyName(key: string): string {
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  // Autocomplete methods
  onMaterialSearchChange(value: string): void {
    this.materialSearchInput = value || '';
    if (value && value.length >= 1) {
      this.searchSubject.next(value);
    } else {
      this.filteredMaterials = [];
      this.showAutocompleteDropdown = false;
    }
  }

  onMaterialSearchInput(event: any): void {
    const value = event.target.value || '';
    this.materialSearchInput = value;
    if (value && value.length >= 1) {
      this.searchSubject.next(value);
    } else {
      this.filteredMaterials = [];
      this.showAutocompleteDropdown = false;
    }
  }

  onMaterialSearchFocus(): void {
    // If we have existing filtered results and text, show dropdown
    if (this.filteredMaterials.length > 0 && this.materialSearchInput.length >= 1) {
      this.showAutocompleteDropdown = true;
    } else if (this.materialSearchInput.length >= 1) {
      // If we have text but no results yet, trigger a search
      this.searchSubject.next(this.materialSearchInput);
    }
  }

  onMaterialSearchBlur(): void {
    // Delay closing dropdown to allow click events to fire
    setTimeout(() => {
      this.showAutocompleteDropdown = false;
    }, 300);
  }

  onMaterialSearchKeyDown(event: KeyboardEvent): void {
    if (!this.showAutocompleteDropdown || this.filteredMaterials.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedMaterialIndex = Math.min(
          this.selectedMaterialIndex + 1,
          this.filteredMaterials.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedMaterialIndex = Math.max(this.selectedMaterialIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (
          this.selectedMaterialIndex >= 0 &&
          this.selectedMaterialIndex < this.filteredMaterials.length
        ) {
          this.selectMaterial(this.filteredMaterials[this.selectedMaterialIndex]);
        }
        break;
      case 'Escape':
        this.showAutocompleteDropdown = false;
        this.selectedMaterialIndex = -1;
        break;
    }
  }

  selectMaterial(material: any): void {
    if (!material) return;

    // Use fullData if available, otherwise use the material object itself
    const materialData = material.fullData || material;

    // Populate partData with the selected material's data
    // This will update the modal display immediately
    Object.keys(materialData).forEach((key) => {
      if (
        materialData[key] !== null &&
        materialData[key] !== undefined &&
        materialData[key] !== ''
      ) {
        this.partData[key] = materialData[key];
      }
    });

    // Update the search input with the selected material name
    this.materialSearchInput =
      materialData.material || materialData.part || this.materialSearchInput;

    // Close dropdown
    this.showAutocompleteDropdown = false;
    this.selectedMaterialIndex = -1;

    // Update SKU data if available
    if (materialData.skus && Array.isArray(materialData.skus)) {
      // Note: SKU data transformation would happen here if needed
      // For now, skuData is passed as input, but we could emit an event to update it
    }
  }

  onMaterialOptionMouseEnter(index: number): void {
    this.selectedMaterialIndex = index;
  }
}
