import {
  Component,
  OnInit,
  AfterViewInit,
  AfterViewChecked,
  ElementRef,
  ViewChild,
  HostListener,
  Injectable,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeaderParams } from 'ag-grid-community';
import { IHeaderAngularComp } from 'ag-grid-angular';

// Static service to ensure only one menu is open at a time
class MenuStateService {
  private static currentOpenMenu: ColumnHeaderPinComponent | null = null;

  static setOpenMenu(component: ColumnHeaderPinComponent | null): void {
    if (this.currentOpenMenu && this.currentOpenMenu !== component) {
      this.currentOpenMenu.closeMenu();
    }
    this.currentOpenMenu = component;
  }

  static clearOpenMenu(component: ColumnHeaderPinComponent): void {
    if (this.currentOpenMenu === component) {
      this.currentOpenMenu = null;
    }
  }
}

@Component({
  selector: 'app-column-header-pin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="simple-pin-header">
      <div class="header-content-wrapper">
        <div class="header-text" (click)="onSortClick($event)">{{ displayName }}</div>
        <div class="header-controls">
          <div class="sort-indicator" *ngIf="sortState">
            <span *ngIf="sortState === 'asc'" class="modern-arrow">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
            <span *ngIf="sortState === 'desc'" class="modern-arrow">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </span>
          </div>

          <div class="menu-container" #menuContainer>
            <button
              class="menu-button"
              [class.active]="isMenuOpen"
              (click)="toggleMenu($event)"
              title="Column Menu"
              *ngIf="showMenuButton"
              #menuButton
            >
              <span class="hamburger-icon">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
              </span>
            </button>

            <div
              class="custom-menu-dropdown portal-dropdown"
              *ngIf="isMenuOpen"
              [ngStyle]="dropdownStyle"
              #dropdown
            >
              <div class="menu-item" (click)="pinColumn('left', $event)">
                <span class="menu-icon"
                  ><i class="fas fa-thumbtack" style="transform: rotate(-45deg)"></i
                ></span>
                <span class="menu-text">Pin Left</span>
                <span class="menu-check" *ngIf="pinnedSide === 'left'">✓</span>
              </div>
              <div class="menu-item" (click)="pinColumn('right', $event)">
                <span class="menu-icon"
                  ><i class="fas fa-thumbtack" style="transform: rotate(45deg)"></i
                ></span>
                <span class="menu-text">Pin Right</span>
                <span class="menu-check" *ngIf="pinnedSide === 'right'">✓</span>
              </div>
              <div class="menu-item" (click)="pinColumn(null, $event)">
                <span class="menu-icon"><i class="fas fa-ban"></i></span>
                <span class="menu-text">No Pin</span>
                <span class="menu-check" *ngIf="!pinnedSide">✓</span>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item" (click)="autosizeColumn($event)">
                <span class="menu-icon"><i class="fas fa-arrows-alt-h"></i></span>
                <span class="menu-text">Autosize This Column</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Ensure header cells don't clip the dropdown */
      :host ::ng-deep .ag-header-cell {
        overflow: visible !important;
        z-index: 10;
      }

      /* Increase z-index when menu is open to float above other headers */
      :host ::ng-deep .ag-header-cell:has(.custom-menu-dropdown) {
        z-index: 1000 !important;
      }

      /* Hide default AG Grid sort icons to avoid duplication */
      :host .ag-header-cell-sortable .ag-sort-indicator-container {
        display: none !important;
      }

      .simple-pin-header {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        padding: 0 8px;
        position: relative;
      }

      /* Show menu button on header hover */
      .simple-pin-header:hover .menu-button {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
      }

      .header-content-wrapper {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 8px;
      }

      .header-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        font-weight: 600;
        color: #374151;
        font-size: 13px;
        padding: 4px 6px;
        border-radius: 4px;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .sort-indicator {
        display: flex;
        align-items: center;
        color: #64748b;
        margin-right: 4px;
        padding: 0;
        height: 100%;
      }

      .modern-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #3b82f6; /* Modern blue color */
        transition: transform 0.2s ease;
      }

      .menu-container {
        position: relative;
        display: flex;
        align-items: center;
      }

      .menu-button {
        min-width: 28px;
        height: 28px;
        padding: 0;
        font-size: 15px;
        border: 1px solid transparent;
        background: rgba(0, 0, 0, 0.04);
        color: #000000;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        visibility: hidden;
        transform: scale(0.9);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .menu-button:hover {
        background-color: rgba(0, 0, 0, 0.08);
        border-color: rgba(0, 0, 0, 0.12);
        color: #000000;
        transform: scale(1.05);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .menu-button:active {
        transform: scale(0.98);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .menu-button.active {
        background-color: rgba(0, 0, 0, 0.1);
        border-color: rgba(0, 0, 0, 0.15);
        color: #000000;
        opacity: 1;
        visibility: visible;
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      /* Solid Hamburger Icon */
      .hamburger-icon {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 16px;
        height: 14px;
      }

      .hamburger-icon .bar {
        width: 100%;
        height: 2px;
        background-color: currentColor;
        border-radius: 1px;
        transition: all 0.2s ease;
      }

      .custom-menu-dropdown {
        position: fixed; /* Fixed to escape grid overflow */
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05),
          0 0 0 1px rgba(0, 0, 0, 0.05);
        min-width: 220px;
        max-width: 220px;
        z-index: 99999; /* High z-index to float over everything */
        padding: 6px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: menuPopup 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: top left;
        pointer-events: auto;
      }

      @keyframes menuPopup {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-8px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .menu-item {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        cursor: pointer;
        color: #4b5563;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        border-radius: 8px;
        margin-bottom: 2px;
        position: relative;
        overflow: hidden;
      }

      .menu-item:last-child {
        margin-bottom: 0;
      }

      .menu-item:hover {
        background-color: rgba(243, 244, 246, 0.8);
        color: #111827;
        transform: translateX(2px);
      }

      .menu-item:active {
        transform: scale(0.98) translateX(2px);
        background-color: rgba(229, 231, 235, 0.8);
      }

      .menu-icon {
        width: 20px;
        margin-right: 10px;
        color: #9ca3af;
        display: flex;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .menu-item:hover .menu-icon {
        color: #3b82f6;
        transform: scale(1.1);
      }

      .menu-text {
        flex: 1;
      }

      .menu-check {
        color: #2563eb;
        font-weight: bold;
        margin-left: 8px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: rgba(37, 99, 235, 0.1);
        border-radius: 50%;
      }

      .menu-divider {
        height: 1px;
        background: linear-gradient(to right, transparent, rgba(229, 231, 235, 0.8), transparent);
        margin: 6px 12px;
      }
    `,
  ],
})
export class ColumnHeaderPinComponent
  implements IHeaderAngularComp, OnInit, AfterViewInit, AfterViewChecked
{
  params!: IHeaderParams;
  displayName: string = '';
  isPinned: boolean = false;
  pinnedSide: 'left' | 'right' | null = null;
  showMenuButton: boolean = true;
  sortState: 'asc' | 'desc' | null = null;
  isMenuOpen: boolean = false;
  dropdownStyle: any = {};

  @ViewChild('menuContainer') menuContainer!: ElementRef;
  @ViewChild('menuButton') menuButton!: ElementRef;
  @ViewChild('dropdown') dropdown!: ElementRef;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateDisplayName();
    this.updatePinnedState();
  }

  ngAfterViewInit(): void {
    this.moveDropdownToBody();
  }

  ngAfterViewChecked(): void {
    if (this.isMenuOpen) {
      this.moveDropdownToBody();
    }
  }

  moveDropdownToBody(): void {
    if (this.dropdown && this.isMenuOpen) {
      const el = this.dropdown.nativeElement;
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    }
  }

  agInit(params: IHeaderParams): void {
    this.params = params;
    this.updateDisplayName();
    this.updatePinnedState();

    const field = params.column?.getColDef()?.field;
    this.showMenuButton = field !== 'actions';
  }

  refresh(params: IHeaderParams): boolean {
    this.params = params;
    this.updateDisplayName();
    this.updatePinnedState();
    return true;
  }

  updateDisplayName(): void {
    if (this.params?.displayName) {
      this.displayName = this.params.displayName;
    } else if (this.params?.column?.getColDef()?.headerName) {
      this.displayName = this.params.column.getColDef().headerName || '';
    } else {
      this.displayName = '';
    }
  }

  updatePinnedState(): void {
    if (this.params?.column) {
      const pinned = this.params.column.getPinned();
      this.isPinned = pinned === 'left' || pinned === 'right';
      this.pinnedSide = pinned === 'left' ? 'left' : pinned === 'right' ? 'right' : null;

      // Update sort state
      const sort = this.params.column.getSort();
      this.sortState = sort === 'asc' ? 'asc' : sort === 'desc' ? 'desc' : null;
    }
  }

  onSortClick(event: MouseEvent): void {
    if (!this.params?.column || !this.params?.api) {
      return;
    }

    const column = this.params.column;
    const colDef = column.getColDef();

    // Only allow sorting if column is sortable
    if (colDef.sortable === false) {
      return;
    }

    // Get current sort state
    const currentSort = column.getSort();

    // Toggle sort: none -> asc -> desc -> none
    let newSort: 'asc' | 'desc' | null = null;
    if (!currentSort) {
      newSort = 'asc';
    } else if (currentSort === 'asc') {
      newSort = 'desc';
    } else {
      newSort = null;
    }

    // Use AG Grid's API to set sort via column state
    const columnId = column.getColId();
    if (newSort) {
      this.params.api.applyColumnState({
        state: [{ colId: columnId, sort: newSort }],
        defaultState: { sort: null },
      });
    } else {
      this.params.api.applyColumnState({
        state: [{ colId: columnId, sort: null }],
        defaultState: { sort: null },
      });
    }

    // Update sort state
    setTimeout(() => {
      this.updatePinnedState();
    }, 0);
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (this.isMenuOpen) {
      this.closeMenu();
      return;
    }

    // Close any other open menus
    MenuStateService.setOpenMenu(this);

    // Set menu open
    this.isMenuOpen = true;

    // Force update to ensure element is created in DOM
    this.cdr.detectChanges();

    // Calculate position immediately using viewport coordinates
    if (this.menuButton && this.menuButton.nativeElement) {
      const buttonRect = this.menuButton.nativeElement.getBoundingClientRect();

      // Use fixed positioning relative to viewport
      this.dropdownStyle = {
        top: `${buttonRect.bottom + 4}px`,
        left: `${buttonRect.left}px`, // Align left edge of menu with left edge of button
        position: 'fixed',
        zIndex: '99999',
        display: 'block',
      };

      // Force update again to apply styles
      this.cdr.detectChanges();
    }
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    if (
      this.dropdown?.nativeElement &&
      this.dropdown.nativeElement.parentElement === document.body
    ) {
      document.body.removeChild(this.dropdown.nativeElement);
    }
    this.dropdownStyle = {};
    MenuStateService.clearOpenMenu(this);
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    if (this.isMenuOpen) {
      const target = event.target as Node;
      const isClickInsideMenuContainer = this.menuContainer?.nativeElement?.contains(target);
      const isClickInsideDropdown = this.dropdown?.nativeElement?.contains(target);

      if (!isClickInsideMenuContainer && !isClickInsideDropdown) {
        this.closeMenu();
      }
    }
  }

  @HostListener('window:scroll', ['$event'])
  @HostListener('window:resize', ['$event'])
  handleScrollOrResize(event: Event): void {
    // Close menu on scroll or resize to avoid positioning issues
    if (this.isMenuOpen) {
      this.closeMenu();
    }
  }

  pinColumn(side: 'left' | 'right' | null, event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();

    if (!this.params?.column || !this.params?.api) {
      return;
    }

    const column = this.params.column;
    this.params.api.setColumnsPinned([column], side);

    setTimeout(() => {
      this.updatePinnedState();
      this.params.api.refreshHeader();
    }, 0);
  }

  autosizeColumn(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();

    if (!this.params?.column || !this.params?.api) {
      return;
    }

    const column = this.params.column;
    this.params.api.autoSizeColumns([column]);
  }
}
