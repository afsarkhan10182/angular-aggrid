import { Injectable } from '@angular/core';
import {
  BOM_LINK_KEY,
  BOM_TYPE_PRODUCTMBOM,
  FIELD_HAS_LINKED_BOM,
  FIELD_PART_NUMBER,
} from '../../constants';
import type { SkuInfo } from '../data.service';
import { SkuService } from '../sku.service';

interface BomLinkLike extends Record<string, unknown> {
  sectionInternalName?: string;
  section?: string;
  sectionDisplayName?: string;
  skus?: SkuItemLike[];
  linkedBom?: unknown;
  children?: TreeRow[];
  bomLinkFeature?: string;
  qty?: unknown;
  quantity?: unknown;
  part?: string;
  ptcbomPartMarkUp?: string;
}

interface SkuItemLike extends Record<string, unknown> {
  skuId?: string | number;
  value?: unknown;
}

interface ApiInstanceLike extends Record<string, unknown> {
  [BOM_LINK_KEY]?: BomLinkLike;
}

interface ApiDataLike extends Record<string, unknown> {
  instances?: ApiInstanceLike[];
  sectionOrder?: string[];
}

interface TreeRow {
  [key: string]: unknown;
  section?: string;
  sectionDisplayName?: string;
  isSectionHeader?: boolean;
  isMaterialHeader?: boolean;
  isDirectRow?: boolean;
  isSubRow?: boolean;
  isExpanded?: boolean;
  level?: number;
  part?: unknown;
  skus?: SkuItemLike[];
  linkedBom?: unknown;
  material?: unknown;
  materialIndex?: number;
  allSkus?: SkuItemLike[];
  bomLinkFeature?: string;
  children?: TreeRow[];
  parent?: TreeRow;
}

interface SectionMaterialGroup {
  section: string;
  sectionDisplayName: string;
  materials: TreeRow[];
}

@Injectable({
  providedIn: 'root',
})
export class GridDataTransformService {
  constructor(private readonly skuService: SkuService) {}

  transformToTreeData(
    data: ApiDataLike,
    bomType: string | null | undefined,
    skuInfo: SkuInfo[],
  ): TreeRow[] {
    const treeData: TreeRow[] = [];
    const sections = this.buildMbomTreeData(data, bomType);

    sections.forEach((section) => {
      const sectionRow: TreeRow = {
        section: section.section,
        sectionDisplayName: section.sectionDisplayName,
        isSectionHeader: true,
        isExpanded: true,
        children: [],
        level: 0,
      };

      const sectionChildren = sectionRow.children ?? [];
      sectionRow.children = sectionChildren;

      section.materials.forEach((material, materialIndex) => {
        const hasChildren = Array.isArray(material.children) && material.children.length > 0;

        if (hasChildren) {
          const materialRow: TreeRow = {
            ...material,
            section: section.section,
            sectionDisplayName: section.sectionDisplayName,
            material: material.part,
            materialIndex,
            allSkus: material.allSkus,
            isMaterialHeader: true,
            isExpanded: true,
            children: [],
            level: 1,
            parent: sectionRow,
            [FIELD_HAS_LINKED_BOM]: this.hasLinkedBom(material.linkedBom),
          };

          this.addSkuDataToRow(materialRow, material, skuInfo);
          const materialChildren = materialRow.children ?? [];
          materialRow.children = materialChildren;

          material.children?.forEach((child) => {
            const childRow: TreeRow = {
              ...child,
              isSubRow: true,
              level: 2,
              parent: materialRow,
              section: section.section,
              sectionDisplayName: section.sectionDisplayName,
            };
            this.addSkuDataToRow(childRow, child, skuInfo);
            materialChildren.push(childRow);
          });

          sectionChildren.push(materialRow);
        } else {
          const directRow = {
            ...material,
            section: section.section,
            sectionDisplayName: section.sectionDisplayName,
            isDirectRow: true,
            level: 1,
            parent: sectionRow,
            [FIELD_HAS_LINKED_BOM]: this.hasLinkedBom(material.linkedBom),
          };
          this.addSkuDataToRow(directRow, material, skuInfo);
          sectionChildren.push(directRow);
        }
      });

      treeData.push(sectionRow);
    });

    return treeData;
  }

  private buildMbomTreeData(
    data: ApiDataLike,
    bomType: string | null | undefined,
  ): SectionMaterialGroup[] {
    const sections: Record<string, TreeRow[]> = {};
    const sectionDisplayNameMap: Record<string, string> = {};
    const instances = Array.isArray(data.instances) ? data.instances : [];

    const processedItems = instances
      .filter((item: ApiInstanceLike) => {
        const bomLink = item[BOM_LINK_KEY];
        if (!bomLink) return false;

        const partNumber = bomLink?.[FIELD_PART_NUMBER];
        const hasPartNumber = !!(partNumber && String(partNumber).trim() !== '');

        let isCorrectMarkup = true;
        if (bomType === BOM_TYPE_PRODUCTMBOM) {
          isCorrectMarkup = bomLink.ptcbomPartMarkUp === 'enumMBOM001';
        }

        return hasPartNumber && isCorrectMarkup;
      })
      .map((item: ApiInstanceLike): TreeRow => {
        const bomLink = item[BOM_LINK_KEY] as BomLinkLike;
        const sectionInternalName = String(bomLink.sectionInternalName || bomLink.section || '');
        const sectionDisplayName = String(bomLink.sectionDisplayName || '');

        if (sectionInternalName && sectionDisplayName) {
          sectionDisplayNameMap[sectionInternalName] = sectionDisplayName;
        }

        return {
          ...bomLink,
          part: bomLink[FIELD_PART_NUMBER] as string,
          [FIELD_PART_NUMBER]: bomLink[FIELD_PART_NUMBER],
          skus: bomLink.skus,
          linkedBom: bomLink.linkedBom,
          quantity: this.formatQuantityField(bomLink.quantity),
          qty: this.formatQuantityField(bomLink.qty),
          section: sectionInternalName,
          sectionDisplayName,
        };
      });

    processedItems.forEach((item, index) => {
      const sectionInternalName = String(item.section || '');
      if (!sections[sectionInternalName]) {
        sections[sectionInternalName] = [];
      }

      const partNumber = item[FIELD_PART_NUMBER];
      const material: TreeRow = {
        ...item,
        materialKey: `${item[FIELD_PART_NUMBER]}_${index}`,
        allSkus: item.skus,
        part: partNumber,
        [FIELD_PART_NUMBER]: partNumber,
        linkedBom: item.linkedBom,
        section: sectionInternalName,
        sectionDisplayName: item.sectionDisplayName,
      };
      sections[sectionInternalName].push(material);
    });

    const result: SectionMaterialGroup[] = [];
    const sectionOrder: string[] = Array.isArray(data.sectionOrder) ? data.sectionOrder : [];

    const displayToInternalMap = new Map<string, string[]>();
    Object.keys(sectionDisplayNameMap).forEach((internalName) => {
      const displayName = sectionDisplayNameMap[internalName];
      if (!displayName) return;
      const current = displayToInternalMap.get(displayName) ?? [];
      if (!current.includes(internalName)) {
        current.push(internalName);
      }
      displayToInternalMap.set(displayName, current);
    });

    const sortMaterials = (a: TreeRow, b: TreeRow): number => {
      const featureA = String(a['bomLinkFeature'] || '').toLowerCase().trim();
      const featureB = String(b['bomLinkFeature'] || '').toLowerCase().trim();

      if (featureA !== featureB) {
        return featureA.localeCompare(featureB);
      }

      const partA = String(a?.[FIELD_PART_NUMBER] ?? '').toLowerCase().trim();
      const partB = String(b?.[FIELD_PART_NUMBER] ?? '').toLowerCase().trim();
      return partA.localeCompare(partB);
    };

    sectionOrder.forEach((sectionDisplayName, idx) => {
      const internalNames = displayToInternalMap.get(sectionDisplayName) ?? [];
      const resolvedInternalNames =
        internalNames.length > 0 ? internalNames : [`__missing_section__${idx}`];

      resolvedInternalNames.forEach((sectionInternalName) => {
        const sectionItems = sections[sectionInternalName] || [];
        const sortedMaterials = [...sectionItems].sort(sortMaterials);
        result.push({
          section: sectionInternalName,
          sectionDisplayName,
          materials: sortedMaterials,
        });
      });
    });

    Object.keys(sections).forEach((sectionInternalName) => {
      const sectionDisplayName = sectionDisplayNameMap[sectionInternalName] || sectionInternalName;
      if (!sectionOrder.includes(sectionDisplayName)) {
        const sectionItems = sections[sectionInternalName];
        if (sectionItems && sectionItems.length > 0) {
          const sortedMaterials = [...sectionItems].sort(sortMaterials);
          result.push({
            section: sectionInternalName,
            sectionDisplayName,
            materials: sortedMaterials,
          });
        }
      }
    });

    return result;
  }

  sortTreeDataByField(
    data: TreeRow[],
    sortField: string,
    sortDirection: 'asc' | 'desc',
    compareValues: (a: unknown, b: unknown, direction: 'asc' | 'desc') => number,
  ): TreeRow[] {
    const sortedData: TreeRow[] = [];

    data.forEach((sectionRow) => {
      if (!sectionRow.isSectionHeader) {
        return;
      }

      const sortedSection: TreeRow = {
        ...sectionRow,
        children: [],
      };
      const sortedSectionChildren = sortedSection.children ?? [];
      sortedSection.children = sortedSectionChildren;

      if (Array.isArray(sectionRow.children) && sectionRow.children.length > 0) {
        const sortedChildren = [...sectionRow.children].sort((a, b) => {
          const aValue = this.getSortValue(a, sortField);
          const bValue = this.getSortValue(b, sortField);
          return compareValues(aValue, bValue, sortDirection);
        });

        sortedChildren.forEach((child) => {
          if (child.isMaterialHeader) {
            const sortedMaterialHeader: TreeRow = {
              ...child,
              children: [],
            };

            if (Array.isArray(child.children) && child.children.length > 0) {
              const sortedSubChildren = [...child.children].sort((a, b) => {
                const aValue = this.getSortValue(a, sortField);
                const bValue = this.getSortValue(b, sortField);
                return compareValues(aValue, bValue, sortDirection);
              });
              sortedMaterialHeader.children = sortedSubChildren;
            }

            sortedSectionChildren.push(sortedMaterialHeader);
          } else if (child.isDirectRow) {
            sortedSectionChildren.push(child);
          }
        });
      }

      sortedData.push(sortedSection);
    });

    return sortedData;
  }

  private addSkuDataToRow(itemRow: TreeRow, originalItem: TreeRow, skuInfo: SkuInfo[]): void {
    const skus = Array.isArray(originalItem?.skus) ? originalItem.skus : [];
    const skuUpdates = this.skuService.buildSkuFieldUpdates({
      skuInfo,
      sourceSkus: skus,
    });
    this.skuService.applySkuFieldUpdates({
      row: itemRow,
      updates: skuUpdates,
      setDataValue: (fieldName, value) => {
        itemRow[fieldName] = value;
      },
      syncRowObject: true,
    });
  }

  private formatQuantityField(value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber.toFixed(1) : value;
  }

  private hasLinkedBom(linkedBom: unknown): boolean {
    return (
      linkedBom === '1' ||
      linkedBom === 1 ||
      linkedBom === true ||
      (!!linkedBom && linkedBom !== '')
    );
  }

  private getSortValue(row: Record<string, unknown>, field: string): unknown {
    if (!row || !field) return null;

    const value = row[field];
    if (value === null || value === undefined) {
      return null;
    }

    return value;
  }
}
