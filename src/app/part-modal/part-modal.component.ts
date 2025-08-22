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
}
