import { Injectable, ComponentRef, ViewContainerRef, TemplateRef } from '@angular/core';
import { SigninModalComponent } from '../components/signin-modal/signin-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private modalComponentRef: ComponentRef<SigninModalComponent> | null = null;

  constructor() {}

  showSignInModal(
    viewContainerRef: ViewContainerRef
  ): Promise<{ username: string; password: string } | null> {
    return new Promise((resolve) => {
      // Remove existing modal if any
      this.closeModal();

      // Create the modal component
      this.modalComponentRef = viewContainerRef.createComponent(SigninModalComponent);

      // Handle sign in event
      this.modalComponentRef.instance.signIn.subscribe((credentials) => {
        this.closeModal();
        resolve(credentials);
      });

      // Handle cancel event
      this.modalComponentRef.instance.cancel.subscribe(() => {
        this.closeModal();
        resolve(null);
      });
    });
  }

  closeModal(): void {
    if (this.modalComponentRef) {
      this.modalComponentRef.destroy();
      this.modalComponentRef = null;
    }
  }
}
