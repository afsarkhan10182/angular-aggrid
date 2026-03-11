import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AgGridEditModalComponent } from '../ag-grid-edit-modal/ag-grid-edit-modal.component';

@Component({
  selector: 'app-part-edit-modal',
  standalone: true,
  imports: [AgGridEditModalComponent],
  templateUrl: './part-edit-modal.component.html',
})
export class PartEditModalComponent {
  @Input() materialColorIds: string[] = [];
  @Output() modalClose = new EventEmitter<void>();
  @Output() dataSaved = new EventEmitter<void>();
}

