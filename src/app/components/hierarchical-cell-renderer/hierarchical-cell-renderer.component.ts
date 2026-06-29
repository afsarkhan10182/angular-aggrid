// Product BOM hierarchy renderer: renders Product MBOM section, material, group, and part rows inside the AG Grid hierarchy.
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { GridService } from '../../services/grid/grid.service';
import { GridConfigService } from '../../services/grid/grid-config.service';
import { UtilService } from '../../services/util.service';
import { DataService } from '../../services/data.service';
import { SkuService } from '../../services/sku.service';

@Component({
  selector: 'app-hierarchical-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hier-cell-renderer" [innerHTML]="html" (click)="handleClick($event)"></div>
  `,
})
export class HierarchicalCellRendererComponent implements ICellRendererAngularComp {
  private params: any;
  public html: SafeHtml = '';

  constructor(
    private readonly gridService: GridService,
    private readonly gridConfigService: GridConfigService,
    private readonly utilService: UtilService,
    private readonly dataService: DataService,
    private readonly skuService: SkuService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  agInit(params: any): void {
    this.params = params;
    this.updateHtml();
  }

  refresh(params: any): boolean {
    this.params = params;
    this.updateHtml();
    return true;
  }

  handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    const actionEl = target.closest('[data-action]') as HTMLElement | null;
    if (!actionEl) {
      return;
    }

    const action = actionEl.getAttribute('data-action');
    const parent = this.params?.context?.componentParent as any;
    if (!action || !parent) {
      return;
    }

    const handlers: Record<string, () => void> = {
      'add-row': () => {
        const section = actionEl.getAttribute('data-section');
        if (section) {
          parent.addRowForSection(section);
        }
      },
      'toggle-section': () => {
        const section = actionEl.getAttribute('data-section');
        if (section) {
          parent.toggleSection(section);
        }
      },
      'toggle-group': () => {
        const groupKey = actionEl.getAttribute('data-group-key');
        if (groupKey) {
          parent.toggleGroup(groupKey);
        }
      },
      'toggle-material': () => {
        const section = actionEl.getAttribute('data-section') || undefined;
        const materialIdentifier = actionEl.getAttribute('data-material-identifier') || undefined;
        const materialIndexRaw = actionEl.getAttribute('data-material-index');
        const materialIndex = materialIndexRaw ? Number(materialIndexRaw) : undefined;
        parent.toggleMaterial(section, materialIdentifier, materialIndex);
      },
    };

    handlers[action]?.();

    event.preventDefault();
    event.stopPropagation();
  }

  private updateHtml(): void {
    const parent = this.params?.context?.componentParent as any;
    const shouldHighlightRow = (data: any) =>
      typeof parent?.shouldHighlightRow === 'function'
        ? parent.shouldHighlightRow(data)
        : this.shouldHighlightRow(data);
    const isSkuFilterReadOnly = () =>
      typeof parent?.isSkuFilterReadOnly === 'function' ? parent.isSkuFilterReadOnly() : false;

    const isFullWidth = !this.params?.colDef;
    const data = this.params?.data;

    if (isFullWidth && data?.isSectionHeader) {
      const isAddRowEnabled =
        typeof parent?.isAddRowEnabled === 'function' ? parent.isAddRowEnabled() : !isSkuFilterReadOnly();
      const showAdd = isAddRowEnabled && !this.gridService.hasVisibleChildren(data);
      const rawHtml = this.gridService.renderSectionHeaderFullWidth(
        this.params,
        {
          shouldHighlightRow,
          getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
          isSkuFilterReadOnly,
          utilService: this.utilService,
          gridConfigService: this.gridConfigService,
        },
        { showAdd },
      );
      this.html = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
      return;
    }

    if (isFullWidth && data?.isGroupHeader) {
      const rawHtml = this.gridService.renderGroupHeaderFullWidth(this.params, {
        shouldHighlightRow,
        getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
        isSkuFilterReadOnly,
        utilService: this.utilService,
        gridConfigService: this.gridConfigService,
      });
      this.html = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
      return;
    }

    const rawHtml = this.gridService.renderHierarchicalCell(this.params, {
      shouldHighlightRow,
      getPartNumberValue: (row) => this.utilService.getPartNumberValue(row),
      isSkuFilterReadOnly,
      utilService: this.utilService,
      gridConfigService: this.gridConfigService,
    });
    this.html = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  private shouldHighlightRow(data: any): boolean {
    if (!data) {
      return false;
    }
    const refSkuId = this.dataService.getRefSkuId();
    return this.skuService.hasRefSkuValue(data, refSkuId);
  }
}
