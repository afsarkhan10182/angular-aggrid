import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
} from '@angular/core';
import { BOM_LINK_KEY } from '../../constants';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './part-modal.component.html',
  styleUrls: ['./part-modal.component.css'],
})
export class PartModalComponent {
  readonly bomLinkKey = BOM_LINK_KEY;
  @Input() partData: any = {};
  @Input() skuData: any[] = [];
  @Output() modalClose = new EventEmitter<void>();

  private readonly displayedFields = new Set([
    'supplier',
    'feature',
    'qty',
    'color',
    'startDate',
    'endDate',
  ]);

  constructor() {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.modalClose.emit();
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
    const systemFields = this.getSystemFields();

    Object.keys(this.partData).forEach((key) => {
      if (!this.isValidKey(key, systemFields, seenKeys)) {
        return;
      }

      seenKeys.add(key);
      const displayValue = this.processFieldValue(this.partData[key]);
      
      if (displayValue !== null) {
        keyValuePairs.push({
          key: key,
          value: displayValue,
        });
      }
    });

    return keyValuePairs.sort((a, b) => a.key.localeCompare(b.key));
  }

  private getSystemFields(): Set<string> {
    return new Set([
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
      'instances',
      'columns',
    ]);
  }

  private isValidKey(key: string, systemFields: Set<string>, seenKeys: Set<string>): boolean {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      return false;
    }

    return (
      !systemFields.has(key) &&
      !key.startsWith('$') &&
      !key.startsWith('sku') &&
      !seenKeys.has(key) &&
      this.partData[key] !== null &&
      this.partData[key] !== undefined
    );
  }

  private processFieldValue(value: any): string | null {
    if (typeof value === 'object' && value !== null) {
      if (typeof value === 'function') {
        return null;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        try {
          return this.stringifyValue(value);
        } catch {
          return null;
        }
      }

      const objKeys = Object.keys(value);
      if (objKeys.length === 0) return null;
      try {
        return this.stringifyValue(value);
      } catch {
        return null;
      }
    }

    const stringValue = String(value).trim();
    if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined') {
      return null;
    }

    return stringValue;
  }

  private stringifyValue(value: any): string | null {
    return JSON.stringify(value, null, 2);
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
      if (!this.isValidSkuKey(key)) {
        return;
      }

      const skuValue = this.partData[key];
      const processedValue = this.processSkuValue(skuValue);
      
      if (processedValue) {
        const skuNumber = key.replaceAll('sku', '');
        if (this.isValidSkuNumber(skuNumber) && !seenSkuIds.has(skuNumber)) {
          seenSkuIds.add(skuNumber);
          skuData.push({
            id: skuNumber,
            value: processedValue,
          });
        }
      }
    });

    return this.sortSkuData(skuData);
  }

  private isValidSkuKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }
    return key.startsWith('sku') && key !== 'skus' && /^sku\d+$/.test(key);
  }

  private processSkuValue(skuValue: any): string | null {
    if (skuValue === null || skuValue === undefined) {
      return null;
    }

    if (typeof skuValue === 'object' || typeof skuValue === 'function') {
      return null;
    }

    const stringValue = String(skuValue).trim();
    if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined') {
      return null;
    }

    return stringValue;
  }

  private isValidSkuNumber(skuNumber: string): boolean {
    const skuNum = Number.parseInt(skuNumber, 10);
    if (Number.isNaN(skuNum) || skuNum <= 0) {
      return false;
    }
    return true;
  }

  private sortSkuData(skuData: Array<{ id: string; value: string }>): Array<{ id: string; value: string }> {
    return skuData.sort((a, b) => {
      const numA = Number.parseInt(a.id, 10) || 0;
      const numB = Number.parseInt(b.id, 10) || 0;
      return numA - numB;
    });
  }

  hasSkus(): boolean {
    return this.getSkuData().length > 0;
  }

  formatKeyName(key: string): string {
    return key
      .replaceAll(/([A-Z])/g, ' $1')
      .replaceAll('_', ' ')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  hasInstances(): boolean {
    return (
      this.partData &&
      Array.isArray(this.partData.instances) &&
      this.partData.instances.length > 0
    );
  }

  getInstances(): any[] {
    if (!this.hasInstances()) return [];
    
    return this.partData.instances.filter((instance: any) => {
      const partNumber = instance[BOM_LINK_KEY]?.partNumber || '';
      const material = instance[BOM_LINK_KEY]?.material || '';
      
      const hasPartNumber = partNumber && String(partNumber).trim() !== '';
      const hasMaterial = material && String(material).trim() !== '';
      
      return hasPartNumber || hasMaterial;
    });
  }

  getColumns(): { [key: string]: string } {
    return this.partData?.columns ?? {};
  }

  getColumnKeys(): string[] {
    const cols = this.getColumns();
    return Object.keys(cols);
  }
}
