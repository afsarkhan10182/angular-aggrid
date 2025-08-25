import { Component } from '@angular/core';
import { IHeaderParams } from 'ag-grid-community';

@Component({
  selector: 'app-sku-header',
  template: `
    <div class="ag-header-cell-text">
      <span class="sku-line">SKU - {{ skuId }}</span>
      <span class="sku-line">Product - {{ product }}</span>
      <span class="sku-line">Manufacturer - {{ manufacturer }}</span>
      <span class="sku-line">Color - {{ color }}</span>
      <span class="sku-line">Size - {{ size }}</span>
    </div>
  `,
  styles: [`
    .ag-header-cell-text {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    
    .sku-line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class SkuHeaderComponent {
  public skuId: string = '';
  public product: string = '';
  public manufacturer: string = '';
  public color: string = '';
  public size: string = '';

  agInit(params: IHeaderParams): void {
    // Extract SKU info from the column definition
    const skuInfo = params.column.getColDef().headerTooltip;
    if (skuInfo) {
      // Parse the tooltip to extract individual values
      const lines = skuInfo.split('\n');
      this.skuId = this.extractValue(lines[0], 'SKU:');
      this.product = this.extractValue(lines[1], 'Product:');
      this.manufacturer = this.extractValue(lines[2], 'Manufacturer:');
      this.color = this.extractValue(lines[3], 'Color:');
      this.size = this.extractValue(lines[4], 'Size:');
    }
  }

  private extractValue(line: string, prefix: string): string {
    if (line && line.includes(prefix)) {
      return line.replace(prefix, '').trim();
    }
    return '';
  }
}
