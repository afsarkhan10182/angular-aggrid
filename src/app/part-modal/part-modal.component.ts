import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './part-modal.component.html',
  styleUrls: ['./part-modal.component.css']
})
export class PartModalComponent {
  @Input() partData: any = {};
  @Input() skuData: any[] = [];
  @Output() close = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }
}
