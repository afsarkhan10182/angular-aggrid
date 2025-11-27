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

  private displayedFields = new Set([
    'supplier',
    'feature',
    'qty',
    'color',
    'startDate',
    'endDate',
  ]);

  constructor() {}

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {}

  ngOnDestroy(): void {}

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
    const seenKeys = new Set<string>();

    const systemFields = new Set([
      '$',
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
      'skus',
    ]);

    Object.keys(this.partData).forEach((key) => {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        return;
      }

      if (
        !systemFields.has(key) &&
        !key.startsWith('$') &&
        !key.startsWith('sku') &&
        !seenKeys.has(key) &&
        this.partData[key] !== null &&
        this.partData[key] !== undefined
      ) {
        seenKeys.add(key);

        let displayValue = this.partData[key];

        if (typeof displayValue === 'object' && displayValue !== null) {
          if (typeof displayValue === 'function') {
            return;
          }

          if (Array.isArray(displayValue)) {
            if (displayValue.length === 0) return;
            try {
              displayValue = JSON.stringify(displayValue, null, 2);
            } catch (e) {
              return;
            }
          } else {
            const objKeys = Object.keys(displayValue);
            if (objKeys.length === 0) return;
            try {
              displayValue = JSON.stringify(displayValue, null, 2);
            } catch (e) {
              return;
            }
          }
        }

        const stringValue = String(displayValue).trim();

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
    const seenSkuIds = new Set<string>();

    Object.keys(this.partData).forEach((key) => {
      if (
        key &&
        typeof key === 'string' &&
        key.startsWith('sku') &&
        key !== 'skus' &&
        /^sku\d+$/.test(key)
      ) {
        const skuValue = this.partData[key];

        if (skuValue !== null && skuValue !== undefined) {
          if (typeof skuValue === 'object') {
            return;
          }

          if (typeof skuValue === 'function') {
            return;
          }

          const stringValue = String(skuValue).trim();

          if (stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined') {
            const skuNumber = key.replace('sku', '');

            const skuNum = parseInt(skuNumber);
            if (isNaN(skuNum) || skuNum <= 0) {
              return;
            }

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
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
