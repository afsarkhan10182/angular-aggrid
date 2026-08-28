import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AgGridEditModalComponent } from '../ag-grid-edit-modal/ag-grid-edit-modal.component';

@Component({
  selector: 'app-service-data-manager-modal',
  standalone: true,
  imports: [AgGridEditModalComponent],
  templateUrl: './service-data-manager-modal.component.html',
})
export class ServiceDataManagerModalComponent {
  @Input() materialColorIds: string[] = [];
  @Output() modalClose = new EventEmitter<void>();
  @Output() dataSaved = new EventEmitter<void>();
}

