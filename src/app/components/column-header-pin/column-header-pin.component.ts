import {
  Component,
  OnInit,
  OnDestroy,
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
import { IconComponent } from '../icon/icon.component';
import { COL_ACTIONS, COL_CHECKBOX } from '../../constants';

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
  imports: [CommonModule, IconComponent],
  template: `
    <div class="simple-pin-header">
      <div class="header-content-wrapper">
        <div class="header-text ag-header-cell-text" (click)="onSortClick($event)">
          {{ displayName }}
        </div>
        <div class="header-controls">
          <div class="sort-indicator" *ngIf="sortState">
            <span *ngIf="sortState === 'asc'" class="modern-arrow">
              <svg
                width="10"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
            <span *ngIf="sortState === 'desc'" class="modern-arrow">
              <svg
                width="10"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
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
                  ><app-icon name="thumbtack" size="14" [style.transform]="'rotate(-45deg)'"></app-icon
                ></span>
                <span class="menu-text">Pin Left</span>
                <span class="menu-check" *ngIf="pinnedSide === 'left'">✓</span>
              </div>
              <div class="menu-item" (click)="pinColumn('right', $event)">
                <span class="menu-icon"
                  ><app-icon name="thumbtack" size="14" [style.transform]="'rotate(45deg)'"></app-icon
                ></span>
                <span class="menu-text">Pin Right</span>
                <span class="menu-check" *ngIf="pinnedSide === 'right'">✓</span>
              </div>
              <div class="menu-item" (click)="pinColumn(null, $event)">
                <span class="menu-icon"><app-icon name="ban" size="14"></app-icon></span>
                <span class="menu-text">No Pin</span>
                <span class="menu-check" *ngIf="!pinnedSide">✓</span>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item" (click)="autosizeColumn($event)">
                <span class="menu-icon"><app-icon name="arrows-alt-h" size="14"></app-icon></span>
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
        padding: 0 6px;
        position: relative;
      }

      /* Show menu button on header hover - more prominent */
      .simple-pin-header:hover .menu-button {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
        background: rgba(55, 65, 81, 0.12);
        border-color: rgba(55, 65, 81, 0.25);
      }

      .header-content-wrapper {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 4px;
      }

      .header-text {
        flex: 1;
        min-width: 0; /* Critical for truncation in flex container */
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap; /* Default for non-SKU columns, overridden by styles.css for SKUs */
        cursor: pointer;
        user-select: none;
        font-weight: 700;
        color: inherit;
        font-size: 13px;
        padding: 2px 4px;
        border-radius: 4px;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
      }

      .sort-indicator {
        display: flex;
        align-items: center;
        color: #64748b;
        margin-right: 4px;
        padding: 2px 0;
        height: 100%;
      }

      .modern-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #374151; /* Darker gray matching header */
        transition: transform 0.2s ease;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
        padding: 1px;
      }

      .menu-container {
        position: relative;
        display: flex;
        align-items: center;
      }

      .menu-button {
        min-width: 24px;
        width: 24px;
        height: 24px;
        padding: 0;
        font-size: 12px;
        border: 1.5px solid transparent;
        background: rgba(55, 65, 81, 0.1);
        color: #374151;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        visibility: hidden;
        transform: scale(0.85);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .menu-button:hover {
        background-color: rgba(55, 65, 81, 0.18);
        border-color: rgba(55, 65, 81, 0.3);
        color: #1f2937;
        transform: scale(1);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(55, 65, 81, 0.15);
      }

      .menu-button:active {
        transform: scale(0.95);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .menu-button.active {
        background-color: rgba(55, 65, 81, 0.22);
        border-color: rgba(55, 65, 81, 0.35);
        color: #111827;
        opacity: 1;
        visibility: visible;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      /* Solid Hamburger Icon - more prominent */
      .hamburger-icon {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2.5px;
        width: 14px;
        height: 12px;
      }

      .hamburger-icon .bar {
        width: 100%;
        height: 2px;
        background-color: currentColor;
        border-radius: 2px;
        transition: all 0.2s ease;
        box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.1);
      }

      .custom-menu-dropdown {
        position: fixed; /* Fixed to escape grid overflow */
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(55, 65, 81, 0.08);
        min-width: 200px;
        max-width: 200px;
        z-index: 99999; /* High z-index to float over everything */
        padding: 6px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: menuPopup 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        transform-origin: top left;
        pointer-events: auto;
        backdrop-filter: blur(8px);
      }

      @keyframes menuPopup {
        from {
          opacity: 0;
          transform: scale(0.96) translateY(-4px);
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
        color: #374151;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        border-radius: 6px;
        margin-bottom: 2px;
        position: relative;
        overflow: hidden;
      }

      .menu-item:last-child {
        margin-bottom: 0;
      }

      .menu-item:hover {
        background: linear-gradient(90deg, rgba(55, 65, 81, 0.12) 0%, rgba(55, 65, 81, 0.06) 100%);
        color: #111827;
        transform: translateX(3px);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .menu-item:active {
        transform: scale(0.98) translateX(3px);
        background: linear-gradient(90deg, rgba(55, 65, 81, 0.18) 0%, rgba(55, 65, 81, 0.1) 100%);
      }

      .menu-icon {
        width: 18px;
        margin-right: 10px;
        color: #6b7280;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 13px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .menu-item:hover .menu-icon {
        color: #374151;
        transform: scale(1.15);
      }

      .menu-text {
        flex: 1;
      }

      .menu-check {
        color: #374151;
        font-weight: 700;
        margin-left: auto;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, rgba(55, 65, 81, 0.15) 0%, rgba(31, 41, 55, 0.1) 100%);
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .menu-divider {
        height: 1px;
        background: linear-gradient(to right, transparent, rgba(226, 232, 240, 1), transparent);
        margin: 6px 10px;
        border-radius: 1px;
      }
    `,
  ],
})
export class ColumnHeaderPinComponent
  implements IHeaderAngularComp, OnInit, OnDestroy, AfterViewInit, AfterViewChecked
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

  ngOnDestroy(): void {
    this.closeMenu();
    MenuStateService.clearOpenMenu(this);
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
    const colId = params.column?.getColId();
    this.showMenuButton = field !== COL_ACTIONS && field !== COL_CHECKBOX && colId !== COL_ACTIONS && colId !== COL_CHECKBOX;
  }

  refresh(params: IHeaderParams): boolean {
    this.params = params;
    this.updateDisplayName();
    this.updatePinnedState();
    
    const field = params.column?.getColDef()?.field;
    const colId = params.column?.getColId();
    this.showMenuButton = field !== COL_ACTIONS && field !== COL_CHECKBOX && colId !== COL_ACTIONS && colId !== COL_CHECKBOX;
    
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

    if (colDef.sortable === false) {
      return;
    }

    const currentSort = column.getSort();

    let newSort: 'asc' | 'desc' | null = null;
    if (!currentSort) {
      newSort = 'asc';
    } else if (currentSort === 'asc') {
      newSort = 'desc';
    } else {
      newSort = null;
    }

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

    MenuStateService.setOpenMenu(this);
    this.isMenuOpen = true;
    this.cdr.detectChanges();

    if (this.menuButton && this.menuButton.nativeElement) {
      const buttonRect = this.menuButton.nativeElement.getBoundingClientRect();

      this.dropdownStyle = {
        top: `${buttonRect.bottom + 4}px`,
        left: `${buttonRect.left}px`,
        position: 'fixed',
        zIndex: '99999',
        display: 'block',
      };

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
