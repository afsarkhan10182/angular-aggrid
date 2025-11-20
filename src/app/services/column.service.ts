import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ColumnService {
  /**
   * Gets the default column definition for AG Grid
   * @returns Default column definition object
   */
  getDefaultColDef() {
    const defaultColDef = {
      sortable: true,
      // Custom comparator to maintain hierarchy during sorting
      // Note: This only affects sorting, not filtering
      comparator: () => 0,
      // Enable default AG Grid filtering & column menu features
      filter: true,
      resizable: true,
      suppressSizeToFit: false,
      suppressAutoSize: false,
      floatingFilter: false,
      wrapHeaderText: true,
      headerClass: 'custom-header-with-border',
      width: 140,
      minWidth: 100,
      maxWidth: 300,
      wrapText: false,
      autoHeight: false,
      cellStyle: (params: any) => {
        const baseStyle: any = {
          padding: '8px 12px',
        };
        // Don't add border for section headers - they should be seamless
        if (!params.data || !params.data.isSectionHeader) {
          baseStyle.borderRight = '1px solid #e2e8f0';
        }
        return baseStyle;
      },
    };

    return defaultColDef;
  }
}
