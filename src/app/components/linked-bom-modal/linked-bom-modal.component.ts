// Product BOM linked BOM modal: displays linked BOM details opened from Product MBOM part rows without changing the main composer data.
import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { BOM_LINK_KEY, FIELD_PART_NUMBER } from '../../constants';
import { CommonModule } from '@angular/common';
import type { BomLink, BomLinkSku } from '../../services/data.service';

export type LinkedBomLink = Partial<BomLink> & Record<string, unknown>;

export interface LinkedBomInstance extends Record<string, unknown> {
  'bom-link'?: LinkedBomLink;
}

export interface LinkedBomData extends Record<string, unknown> {
  instances: LinkedBomInstance[];
  columns: Record<string, string>;
  material?: string;
  materialDescription?: string;
  materialMasterId?: string;
}


@Component({
  selector: 'app-linked-bom-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './linked-bom-modal.component.html',
  styleUrl: './linked-bom-modal.component.css',
})
export class LinkedBomModalComponent {
  readonly bomLinkKey = BOM_LINK_KEY;

  @Input() partData: LinkedBomData = { instances: [], columns: {} };
  // Kept for parent-template compatibility even though this modal view doesn't render SKU cards now.
  @Input() skuData: BomLinkSku[] = [];
  @Input() isLoading = false;
  @Output() modalClose = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.modalClose.emit();
  }

  hasInstances(): boolean {
    return this.getInstances().length > 0;
  }

  getInstances(): LinkedBomInstance[] {
    const rawInstances = Array.isArray(this.partData?.instances) ? this.partData.instances : [];
    if (rawInstances.length === 0) return [];

    return rawInstances.filter((instance: LinkedBomInstance) => {
      if (!instance || typeof instance !== 'object' || !instance[BOM_LINK_KEY]) {
        return false;
      }
      const partNumber = instance[BOM_LINK_KEY][FIELD_PART_NUMBER];
      return partNumber != null && String(partNumber).trim() !== '';
    });
  }

  getColumns(): { [key: string]: string } {
    return this.partData?.columns ?? {};
  }

  getColumnKeys(): string[] {
    return Object.keys(this.getColumns());
  }

  getMaterialTitle(): string {
    for (const instance of this.getInstances()) {
      const materialValue = instance?.[BOM_LINK_KEY]?.['material'];
      if (materialValue != null && String(materialValue).trim() !== '') {
        return String(materialValue);
      }
    }

    const topLevelMaterial = this.partData?.material;
    if (topLevelMaterial != null && String(topLevelMaterial).trim() !== '') {
      return String(topLevelMaterial);
    }

    const topLevelMaterialDescription = this.partData?.materialDescription;
    if (topLevelMaterialDescription != null && String(topLevelMaterialDescription).trim() !== '') {
      return String(topLevelMaterialDescription);
    }

    const materialMasterId = this.partData?.materialMasterId;
    if (materialMasterId != null && String(materialMasterId).trim() !== '') {
      return String(materialMasterId);
    }

    return 'Material Details';
  }

  getCellValue(instance: LinkedBomInstance, key: string): string {
    const bomLink = instance?.[BOM_LINK_KEY] ?? {};
    const value = bomLink[key] ?? instance?.[key];
    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  }
}
