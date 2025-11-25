import { Injectable } from '@angular/core';

export interface GroupConfig {
  field: string;
  headerName: string;
}

@Injectable({
  providedIn: 'root',
})
export class GroupByService {
  constructor() {}

  /**
   * Groups data by specified fields and creates group header rows
   * Preserves section headers and material headers while grouping data rows
   */
  groupData(data: any[], groupFields: GroupConfig[]): any[] {
    if (!groupFields || groupFields.length === 0) {
      return data;
    }

    const result: any[] = [];
    let currentDataGroup: any[] = [];

    // Process data while preserving section/material headers
    data.forEach((row) => {
      // Keep section headers and material headers as-is
      if (row.isSectionHeader || row.isMaterialHeader || row.isGroupHeader) {
        // If we have accumulated data rows, group them first
        if (currentDataGroup.length > 0) {
          const grouped = this.createNestedGroups(currentDataGroup, groupFields, 0);
          const flattened = this.flattenGroupedData(grouped);
          result.push(...flattened);
          currentDataGroup = [];
        }
        // Add the section/material/group header
        result.push(row);
      } else {
        // Accumulate data rows for grouping
        currentDataGroup.push(row);
      }
    });

    // Group any remaining data rows
    if (currentDataGroup.length > 0) {
      const grouped = this.createNestedGroups(currentDataGroup, groupFields, 0);
      const flattened = this.flattenGroupedData(grouped);
      result.push(...flattened);
    }

    return result;
  }

  /**
   * Creates nested group structure
   */
  private createNestedGroups(
    data: any[],
    groupFields: GroupConfig[],
    level: number
  ): any[] {
    if (level >= groupFields.length) {
      return data;
    }

    const groupField = groupFields[level];
    const groups = new Map<string | null, any[]>();

    // Group data by current field
    data.forEach((row) => {
      const groupValue = row[groupField.field];
      const key = groupValue !== null && groupValue !== undefined ? String(groupValue) : '__null__';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    // Process each group
    const result: any[] = [];
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      // Sort groups: null values last, then alphabetically
      if (a[0] === '__null__') return 1;
      if (b[0] === '__null__') return -1;
      const aKey = a[0] || '';
      const bKey = b[0] || '';
      return aKey.localeCompare(bKey);
    });

    sortedGroups.forEach(([key, groupRows]) => {
      const groupValue = key === '__null__' ? null : key;
      
      // Create group header
      const groupHeader: any = {
        isGroupHeader: true,
        groupLevel: level,
        groupField: groupField.field,
        groupHeaderName: groupField.headerName,
        groupValue: groupValue,
        groupKey: `${groupField.field}_${key}`,
        isExpanded: true, // Default to expanded
        children: [],
      };

      // Recursively group children if there are more group fields
      if (level < groupFields.length - 1) {
        groupHeader.children = this.createNestedGroups(groupRows, groupFields, level + 1);
      } else {
        groupHeader.children = groupRows;
      }

      // Only push the group header, children will be included when flattened
      result.push(groupHeader);
    });

    return result;
  }

  /**
   * Flattens grouped data structure respecting expand/collapse state
   */
  flattenGroupedData(grouped: any[]): any[] {
    const result: any[] = [];

    grouped.forEach((item) => {
      if (item.isGroupHeader) {
        result.push(item);
        // Only add children if group is expanded
        if (item.isExpanded && item.children) {
          item.children.forEach((child: any) => {
            if (child.isGroupHeader) {
              // Recursively flatten nested groups
              const nested = this.flattenGroupedData([child]);
              result.push(...nested);
            } else {
              result.push(child);
            }
          });
        }
      } else {
        result.push(item);
      }
    });

    return result;
  }

  /**
   * Toggles group expand/collapse state
   */
  toggleGroup(data: any[], groupKey: string): any[] {
    const findAndToggle = (items: any[]): any[] => {
      return items.map((item) => {
        if (item.isGroupHeader && item.groupKey === groupKey) {
          return {
            ...item,
            isExpanded: !item.isExpanded,
          };
        }
        if (item.children && Array.isArray(item.children)) {
          return {
            ...item,
            children: findAndToggle(item.children),
          };
        }
        return item;
      });
    };

    return findAndToggle(data);
  }

  /**
   * Removes grouping and returns original flat data
   */
  ungroupData(groupedData: any[]): any[] {
    return groupedData.filter((row) => !row.isGroupHeader);
  }

  /**
   * Gets unique values for a field (useful for group by dropdown)
   */
  getUniqueValues(data: any[], field: string): any[] {
    const values = new Set<any>();
    data.forEach((row) => {
      if (row[field] !== null && row[field] !== undefined && !row.isGroupHeader) {
        values.add(row[field]);
      }
    });
    return Array.from(values).sort((a, b) => {
      if (a === null || a === undefined) return 1;
      if (b === null || b === undefined) return -1;
      return String(a).localeCompare(String(b));
    });
  }

  /**
   * Gets count of items in a group
   */
  getGroupCount(groupHeader: any): number {
    if (!groupHeader.children) return 0;
    
    let count = 0;
    const countItems = (items: any[]): void => {
      items.forEach((item) => {
        if (item.isGroupHeader) {
          countItems(item.children || []);
        } else {
          count++;
        }
      });
    };
    
    countItems(groupHeader.children);
    return count;
  }

  /**
   * Groups hierarchical data (sections -> materials)
   * Groups the children of each section based on the group fields
   */
  groupHierarchicalData(sections: any[], groupFields: GroupConfig[]): any[] {
    if (!groupFields || groupFields.length === 0) {
      return sections;
    }

    // Clone sections to avoid mutating original data structure too much
    // (though we are creating new arrays for children)
    return sections.map(section => {
      if (!section.isSectionHeader || !section.children) {
        return section;
      }

      // Group the children of the section
      // This creates a new structure where children are GroupHeaders
      const groupedChildren = this.createNestedGroups(section.children, groupFields, 0);
      
      return {
        ...section,
        children: groupedChildren
      };
    });
  }
}

