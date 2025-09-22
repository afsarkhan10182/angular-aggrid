import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signin-modal.component.html',
  styleUrls: ['./signin-modal.component.css'],
})
export class SigninModalComponent {
  @Output() signIn = new EventEmitter<{ username: string; password: string }>();
  @Output() cancel = new EventEmitter<void>();

  username: string = '';
  password: string = '';
  isLoading: boolean = false;

  onSubmit(): void {
    if (!this.username || !this.password) {
      alert('Both username and password are required.');
      return;
    }

    this.isLoading = true;
    this.signIn.emit({
      username: this.username,
      password: this.password,
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  resetForm(): void {
    this.username = '';
    this.password = '';
    this.isLoading = false;
  }
}
