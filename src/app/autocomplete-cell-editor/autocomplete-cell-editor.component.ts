import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-autocomplete-cell-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="position: relative; width: 100%; height: 100%;">
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
        style="width: 100%; height: 100%; border: none; outline: none; padding: 8px 12px; font-size: 14px; background: transparent; box-sizing: border-box;"
      />
      <div 
        *ngIf="showDropdown && filteredOptions.length > 0" 
        class="autocomplete-dropdown"
        style="position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 2px solid #007bff; border-top: none; max-height: 200px; overflow-y: auto; z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-radius: 0 0 4px 4px;"
        (click)="$event.stopPropagation()"
      >
        <div style="padding: 6px 8px; background: #f8f9fa; font-size: 12px; color: #495057; border-bottom: 1px solid #dee2e6; font-weight: bold;">
          Select a part number ({{ filteredOptions.length }} available):
        </div>
        <div
          *ngFor="let option of filteredOptions; let i = index"
          [style.background-color]="i === selectedIndex ? '#007bff' : '#ffffff'"
          [style.color]="i === selectedIndex ? '#ffffff' : '#000000'"
          class="dropdown-option"
          style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #e9ecef; font-size: 14px; transition: background-color 0.2s;"
          (click)="selectOption(option); $event.stopPropagation()"
          (mouseenter)="selectedIndex = i"
        >
          {{ option }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .autocomplete-dropdown {
      position: absolute !important;
      z-index: 999999 !important;
      background: #ffffff !important;
      border: 2px solid #007bff !important;
      border-top: none !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
      border-radius: 0 0 4px 4px !important;
      max-height: 200px !important;
      overflow-y: auto !important;
      width: 100% !important;
    }
    
    .dropdown-option {
      padding: 8px 12px !important;
      cursor: pointer !important;
      border-bottom: 1px solid #e9ecef !important;
      font-size: 14px !important;
      transition: background-color 0.2s !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    
    .dropdown-option:hover {
      background: #007bff !important;
      color: #ffffff !important;
    }
    
    .dropdown-option:last-child {
      border-bottom: none !important;
    }
  `]
})
export class AutocompleteCellEditorComponent implements ICellEditorAngularComp, OnInit, AfterViewInit {
  @ViewChild('input') input!: ElementRef<HTMLInputElement>;
  @ViewChild('container') container!: ElementRef<HTMLDivElement>;

  public value: string = '';
  public placeholder: string = '';
  public options: string[] = [];
  public filteredOptions: string[] = [];
  public showDropdown: boolean = false;
  public selectedIndex: number = -1;

  private params: any;
  private originalValue: string = '';
  private customFilterFunction?: (searchTerm: string, options: string[]) => string[];

  ngOnInit() {
    this.originalValue = this.value;
  }

  ngAfterViewInit() {
    // Focus the input after view is initialized
    setTimeout(() => {
      this.input.nativeElement.focus();
      this.input.nativeElement.select();
      // Show dropdown immediately when focused
      this.showDropdown = this.filteredOptions.length > 0;
    }, 0);
  }

  agInit(params: any): void {
    this.params = params;
    
    // Ensure value is always a string
    this.value = params.value ? String(params.value) : '';
    this.placeholder = params.placeholder || 'Enter value...';
    
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
    
    this.filterOptions();
  }

  getValue(): any {
    return this.value;
  }

  isPopup(): boolean {
    return true;
  }

  onInputChange(event: any): void {
    this.value = event.target.value || '';
    this.filterOptions();
    this.showDropdown = this.filteredOptions.length > 0;
    this.selectedIndex = -1;
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
    this.filterOptions();
    this.showDropdown = this.filteredOptions.length > 0;
  }

  onInputFocus(): void {
    // Show dropdown when input is focused
    this.filterOptions();
    this.showDropdown = this.filteredOptions.length > 0;
  }

  selectOption(option: string): void {
    console.log('=== SELECTING OPTION ===', option);
    this.value = option;
    this.closeDropdown();
    
    // Force the value to be set in AG Grid
    if (this.params && this.params.node) {
      console.log('Setting data value in grid:', option);
      this.params.node.setDataValue(this.params.column.getColId(), option);
      
      // Also update the data object directly
      if (this.params.node.data) {
        this.params.node.data[this.params.column.getColId()] = option;
        console.log('Updated node data:', this.params.node.data);
      }
    }
    
    // Stop editing immediately to commit the value
    if (this.params && this.params.api) {
      console.log('Stopping editing with value:', this.value);
      this.params.api.stopEditing();
      
      // Force refresh of the cell to show the selected value
      setTimeout(() => {
        if (this.params && this.params.node) {
          this.params.api.refreshCells({
            rowNodes: [this.params.node],
            force: true
          });
        }
      }, 50);
    }
    
    // Trigger feature auto-population directly
    setTimeout(() => {
      this.triggerFeatureAutoPopulation(option);
    }, 100);
  }

  private triggerFeatureAutoPopulation(partNumber: string): void {
    console.log('=== TRIGGERING FEATURE AUTO-POPULATION ===', partNumber);
    
    // Get the data service from the grid context
    const dataService = (this.params as any).context?.dataService;
    console.log('Grid context:', (this.params as any).context);
    console.log('Data service from context:', !!dataService);
    
    if (dataService) {
      this.triggerFeatureAutoPopulationWithService(partNumber, dataService);
    } else {
      console.log('Data service not available in context');
      
      // Fallback: try to get data service from grid API
      if (this.params && this.params.api) {
        const gridContext = this.params.api.getGridOption('context');
        const fallbackDataService = gridContext?.dataService;
        if (fallbackDataService) {
          console.log('Found data service via grid API fallback');
          this.triggerFeatureAutoPopulationWithService(partNumber, fallbackDataService);
        } else {
          console.log('Data service not available via fallback either');
        }
      }
    }
  }

  private triggerFeatureAutoPopulationWithService(partNumber: string, dataService: any): void {
    const mockData = dataService.getMockData();
    console.log('Mock data from service:', !!mockData);
    
    if (mockData && mockData.mbom) {
      const existingPart = mockData.mbom.find((part: any) => part.part === partNumber);
      if (existingPart) {
        console.log('Found part for auto-population:', existingPart);
        console.log('Auto-populating feature:', existingPart.feature);
        
        // Update the feature field in the grid
        if (this.params && this.params.node) {
          this.params.node.setDataValue('feature', existingPart.feature);
          
          // Also update the data object directly
          if (this.params.node.data) {
            this.params.node.data.feature = existingPart.feature;
            console.log('Updated node data feature:', this.params.node.data.feature);
          }
          
          // Refresh the row to show the updated feature
          if (this.params.api) {
            this.params.api.refreshCells({
              rowNodes: [this.params.node],
              force: true
            });
            console.log('Refreshed cells to show feature value');
          }
        }
      } else {
        console.log('Part not found for auto-population:', partNumber);
      }
    } else {
      console.log('Mock data not available for auto-population');
    }
  }

  private filterOptions(): void {
    const searchValue = String(this.value || '').toLowerCase();
    
    if (this.customFilterFunction) {
      // Use custom filtering function if provided
      this.filteredOptions = this.customFilterFunction(searchValue, this.options);
    } else {
      // Default filtering behavior
      if (!searchValue) {
        this.filteredOptions = this.options.slice(0, 10); // Show first 10 if no input
      } else {
        this.filteredOptions = this.options
          .filter(option => String(option).toLowerCase().includes(searchValue))
          .slice(0, 10); // Limit to 10 results
      }
    }
    
    this.showDropdown = this.filteredOptions.length > 0;
  }

  private closeDropdown(): void {
    this.showDropdown = false;
    this.selectedIndex = -1;
  }

  // Public method to refresh options (useful for dynamic data)
  public refreshOptions(newOptions: string[]): void {
    this.options = newOptions.map(opt => String(opt));
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
