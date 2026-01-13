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

    data.forEach((row) => {
      if (row.isSectionHeader || row.isMaterialHeader || row.isGroupHeader) {
        if (currentDataGroup.length > 0) {
          const grouped = this.createNestedGroups(currentDataGroup, groupFields, 0);
          const flattened = this.flattenGroupedData(grouped);
          result.push(...flattened);
          currentDataGroup = [];
        }
        result.push(row);
      } else {
        currentDataGroup.push(row);
      }
    });

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

    // First, flatten material headers - extract their children for grouping
    // Material headers don't have group field values, so we need to group their children directly
    const rowsToGroup: any[] = [];
    
    data.forEach((row) => {
      // Preserve section headers - they should never be grouped (handled at higher level)
      if (row.isSectionHeader) {
        return;
      }

      // Flatten material headers: extract their children for grouping
      // This ensures material headers don't interfere with grouping by Feature or other fields
      if (row.isMaterialHeader && row.children && Array.isArray(row.children)) {
        row.children.forEach((child: any) => {
          rowsToGroup.push(child);
        });
      } else {
        // Keep other rows as-is
        rowsToGroup.push(row);
      }
    });

    // Now group the flattened rows
    rowsToGroup.forEach((row) => {
      // Skip rows that are empty/invalid (no part number)
      const isHeader = row.isGroupHeader;
      if (!isHeader) {
        const partNumber = row.partNumber || row.part;
        if (!partNumber || String(partNumber).trim() === '') {
          return;
        }
      }

      // Get group value - for bomLinkFeature, use display value
      let groupValue = row[groupField.field];
      if (groupField.field === 'bomLinkFeature' && !groupValue && row.feature) {
        groupValue = row.feature;
      }
      const key = groupValue !== null && groupValue !== undefined ? String(groupValue).trim() : '__null__';
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    const result: any[] = [];
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === '__null__') return 1;
      if (b[0] === '__null__') return -1;
      const aKey = a[0] || '';
      const bKey = b[0] || '';
      return aKey.localeCompare(bKey);
    });

    sortedGroups.forEach(([key, groupRows]) => {
      const groupValue = key === '__null__' ? null : key;
      
      const groupHeader: any = {
        isGroupHeader: true,
        groupLevel: level,
        groupField: groupField.field,
        groupHeaderName: groupField.headerName,
        groupValue: groupValue,
        groupKey: `${groupField.field}_${key}`,
        isExpanded: true,
        children: [],
      };

      if (level < groupFields.length - 1) {
        groupHeader.children = this.createNestedGroups(groupRows, groupFields, level + 1);
      } else {
        groupHeader.children = groupRows;
      }

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

    // IMPORTANT: Always preserve sections, even if they have no children after grouping
    // This ensures sections are always shown at the top level, with Feature groups nested inside
    return sections.map(section => {
      // Always preserve section headers
      if (!section.isSectionHeader) {
        return section;
      }

      // Ensure section is expanded by default
      const sectionWithExpanded = {
        ...section,
        isExpanded: section.isExpanded !== undefined ? section.isExpanded : true
      };

      // If section has no children, preserve it with empty children array
      if (!section.children || !Array.isArray(section.children) || section.children.length === 0) {
        return {
          ...sectionWithExpanded,
          children: []
        };
      }

      // Group the children of the section
      // This creates a new structure where children are GroupHeaders (Feature groups)
      const groupedChildren = this.createNestedGroups(section.children, groupFields, 0);
      
      // Always preserve section, even if grouping resulted in empty children
      return {
        ...sectionWithExpanded,
        children: groupedChildren || []
      };
    });
  }
}

