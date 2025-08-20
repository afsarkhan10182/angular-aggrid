import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Part Details - {{ partData.part }}</h2>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="part-info-grid">
            <div class="info-section basic-info">
              <h3>Basic Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <label>Part Number:</label>
                  <span class="value">{{ partData.part }}</span>
                </div>
                <div class="info-item">
                  <label>Supplier:</label>
                  <span class="value">{{ partData.supplier }}</span>
                </div>
                <div class="info-item">
                  <label>Color:</label>
                  <span class="value">{{ partData.color }}</span>
                </div>
                <div class="info-item">
                  <label>Feature:</label>
                  <span class="value">{{ partData.feature }}</span>
                </div>
                <div class="info-item">
                  <label>Quantity:</label>
                  <span class="value quantity">{{ partData.qty }}</span>
                </div>
                <div class="info-item">
                  <label>Start Date:</label>
                  <span class="value">{{ partData.startDate }}</span>
                </div>
                <div class="info-item">
                  <label>End Date:</label>
                  <span class="value">{{ partData.endDate }}</span>
                </div>
              </div>
            </div>

            <div class="info-section sku-info">
              <h3>SKU Information</h3>
              <div class="sku-grid" *ngIf="skuData.length > 0">
                <div class="sku-card" *ngFor="let sku of skuData">
                  <div class="sku-header">SKU-{{ sku.skuNumber }}</div>
                  <div class="sku-details">
                    <div class="sku-detail-item">
                      <strong>Product:</strong> {{ sku.product }}
                    </div>
                    <div class="sku-detail-item">
                      <strong>Manufacturer:</strong> {{ sku.manufacturer }}
                    </div>
                    <div class="sku-detail-item">
                      <strong>Color:</strong> {{ sku.color }}
                    </div>
                    <div class="sku-detail-item">
                      <strong>Size:</strong> {{ sku.size }}
                    </div>
                    <div class="sku-detail-item" *ngIf="sku.partNumber">
                      <strong>Part Number:</strong> {{ sku.partNumber }}
                    </div>
                  </div>
                </div>
              </div>
              <div *ngIf="skuData.length === 0" class="no-sku">
                <div class="no-data-icon">📦</div>
                <p>No SKU data available for this part.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 800px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h2 {
      margin: 0;
      color: #1e293b;
      font-size: 1.5rem;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #64748b;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-btn:hover {
      background-color: #f1f5f9;
      color: #475569;
    }

    .modal-body {
      padding: 20px;
    }

    .part-info-grid {
      display: grid;
      gap: 20px;
    }

    .info-section {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #e2e8f0;
    }

    .info-section h3 {
      margin: 0 0 15px 0;
      color: #1e293b;
      font-size: 1.2rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .info-item label {
      font-weight: 600;
      color: #64748b;
      font-size: 0.9rem;
    }

    .info-item .value {
      color: #1e293b;
      font-size: 1rem;
    }

    .info-item .value.quantity {
      font-weight: 600;
      color: #059669;
    }

    .sku-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }

    .sku-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 15px;
    }

    .sku-header {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }

    .sku-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sku-detail-item {
      font-size: 0.9rem;
      color: #475569;
    }

    .sku-detail-item strong {
      color: #1e293b;
    }

    .no-sku {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
    }

    .no-data-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }
  `]
})
export class PartModalComponent {
  @Input() partData: any = {};
  @Input() skuData: any[] = [];
  @Output() close = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }
}
