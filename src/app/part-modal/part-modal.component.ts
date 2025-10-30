import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './part-modal.component.html',
  styleUrls: ['./part-modal.component.css']
})
export class PartModalComponent implements OnInit, OnDestroy {
  @Input() partData: any = {};
  @Input() skuData: any[] = [];
  @Output() close = new EventEmitter<void>();

  // Fields that are already displayed in overview (excluding 'part' which is in title, and dates which are in timeline)
  private displayedFields = new Set([
    'supplier',
    'feature',
    'qty',
    'color',
    'startDate',
    'endDate',
  ]);

  ngOnInit(): void {
    // Modal initialized
  }

  ngOnDestroy(): void {
    // Modal destroyed
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  getAllOverviewFields(): Array<{ label: string; value: any }> {
    if (!this.partData) return [];
    
    const overviewFields: Array<{ label: string; value: any }> = [];
    
    // Fields to exclude - already shown in title or redundant
    const excludedFields = new Set([
      'part', // Shown in modal title
      'material', // Shown in modal title
      'materialDescription', // Redundant description
      'supplierDescription', // Redundant description
    ]);
    
    Object.keys(this.partData).forEach((key) => {
      if (
        !this.displayedFields.has(key) &&
        !excludedFields.has(key) &&
        this.partData[key] !== null &&
        this.partData[key] !== undefined &&
        this.partData[key] !== '' &&
        !key.startsWith('$') && // Exclude Angular internal properties
        !key.startsWith('sku') && // Exclude SKU fields (shown separately)
        key !== 'isMaterialHeader' &&
        key !== 'isDirectRow' &&
        key !== 'isSectionHeader' &&
        key !== 'isSubRow' &&
        key !== 'isNewRow' &&
        key !== 'hasLinkedBom' &&
        key !== 'isExpanded' &&
        key !== 'level' &&
        key !== 'parent' &&
        key !== 'children' &&
        key !== 'materialIndex' &&
        key !== 'allSkus' &&
        key !== 'section' &&
        typeof this.partData[key] !== 'object' // Exclude complex objects
      ) {
        // Format field name: convert camelCase to Title Case
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        
        overviewFields.push({
          label: label,
          value: this.partData[key],
        });
      }
    });
    
    return overviewFields.sort((a, b) => a.label.localeCompare(b.label));
  }
}
