// Product BOM SKU helper: maps Product MBOM SKU metadata to grid columns, filters, cell values, and SKU matching behavior.
import { Injectable } from '@angular/core';
import { BOM_TYPE_PRODUCTMBOM, FIELD_PART_NUMBER } from '../constants';

export interface SkuRowContext {
  section: string;
  feature: string;
  partNumber: string;
}

export interface DisconnectedSkuListItem {
  part: string;
  skuId: string;
  key: string;
  row: any;
  skuField: string;
}

export interface SkuSelectionSummary {
  count: number;
  skuIds: string[];
}

export interface SkuFieldUpdate {
  skuId: string;
  fieldName: string;
  value: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class SkuService {
  private static readonly SKU_FIELD_PREFIX = 'sku';
  private readonly partMatchRequirementByBomType: Readonly<
    Record<string, (rowPartNumber: string, instancePartNumber: string) => boolean>
  > = {
    [BOM_TYPE_PRODUCTMBOM]: (rowPartNumber, instancePartNumber) =>
      this.hasValue(rowPartNumber) && this.hasValue(instancePartNumber),
  };

  private hasItems<T>(items: T[] | null | undefined): items is T[] {
    return Array.isArray(items) && items.length > 0;
  }

  private collectUniqueNormalizedIds<T>(
    items: T[] | null | undefined,
    readId: (item: T) => unknown,
  ): string[] {
    if (!this.hasItems(items)) {
      return [];
    }

    const ids = new Set<string>();
    items.forEach((item) => {
      const normalizedId = this.normalizeSkuId(readId(item));
      if (normalizedId) {
        ids.add(normalizedId);
      }
    });

    return Array.from(ids);
  }

  normalizeSkuId(skuId: unknown): string {
    if (skuId === undefined || skuId === null) {
      return '';
    }
    return String(skuId).trim();
  }

  toFieldName(skuId: unknown): string {
    return `${SkuService.SKU_FIELD_PREFIX}${this.normalizeSkuId(skuId)}`;
  }

  getFieldNames(skuInfo: Array<{ skuId?: unknown }> | null | undefined): string[] {
    if (!this.hasItems(skuInfo)) {
      return [];
    }
    return skuInfo
      .map((sku) => this.toFieldName(sku?.skuId))
      .filter((fieldName) => fieldName !== SkuService.SKU_FIELD_PREFIX);
  }

  isSkuField(fieldName: unknown): boolean {
    return typeof fieldName === 'string' && fieldName.startsWith(SkuService.SKU_FIELD_PREFIX);
  }

  hasValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    return String(value).trim() !== '';
  }

  getValue(row: Record<string, unknown> | null | undefined, skuId: unknown): unknown {
    if (!row) {
      return undefined;
    }
    return row[this.toFieldName(skuId)];
  }

  hasRefSkuValue(row: Record<string, unknown> | null | undefined, refSkuId: unknown): boolean {
    const normalizedId = this.normalizeSkuId(refSkuId);
    if (!normalizedId) {
      return false;
    }
    return this.hasValue(this.getValue(row, normalizedId));
  }

  extractRowContext(row: any): SkuRowContext {
    return {
      section: row?.section || '',
      feature: String(row?.bomLinkFeature || '').trim(),
      partNumber: String(row?.[FIELD_PART_NUMBER] || '').trim(),
    };
  }

  extractInstanceContext(bomLink: any): SkuRowContext {
    return {
      section: bomLink?.sectionInternalName || bomLink?.section || '',
      feature: String(bomLink?.bomLinkFeature || '').trim(),
      partNumber: String(bomLink?.[FIELD_PART_NUMBER] || '').trim(),
    };
  }

  shouldRequirePartMatch(bomType: string, rowPartNumber: string, instancePartNumber: string): boolean {
    const checker = this.partMatchRequirementByBomType[bomType];
    return checker ? checker(rowPartNumber, instancePartNumber) : false;
  }

  instanceHasTargetSku(bomLink: any, targetSkuIds: Set<string>): boolean {
    if (!this.hasItems(bomLink?.skus)) {
      return false;
    }

    const instanceSkuIds = new Set(this.collectUniqueNormalizedIds(bomLink.skus, (sku: any) => sku?.skuId));

    for (const targetSkuId of targetSkuIds) {
      if (instanceSkuIds.has(this.normalizeSkuId(targetSkuId))) {
        return true;
      }
    }

    return false;
  }

  rowHasTargetSkuValue(row: any, targetSkuIds: Set<string>): boolean {
    for (const targetSkuId of targetSkuIds) {
      const skuFieldName = this.toFieldName(targetSkuId);
      if (this.hasValue(row?.[skuFieldName])) {
        return true;
      }
    }
    return false;
  }

  matchesRowCriteria(bomLink: any, rowContext: SkuRowContext, bomType: string): boolean {
    const instanceContext = this.extractInstanceContext(bomLink);

    if (instanceContext.section !== rowContext.section || instanceContext.feature !== rowContext.feature) {
      return false;
    }

    if (!this.shouldRequirePartMatch(bomType, rowContext.partNumber, instanceContext.partNumber)) {
      return true;
    }

    return instanceContext.partNumber === rowContext.partNumber;
  }

  findMatchingInstance(
    row: any,
    instances: any[] | null | undefined,
    targetSkuIds: Set<string>,
    bomType: string,
  ): any {
    if (!this.hasItems(instances)) {
      return null;
    }

    const rowContext = this.extractRowContext(row);
    for (const instance of instances) {
      const bomLink = instance?.['bom-link'];
      if (!bomLink) continue;

      if (!this.matchesRowCriteria(bomLink, rowContext, bomType)) {
        continue;
      }

      if (!this.instanceHasTargetSku(bomLink, targetSkuIds)) {
        continue;
      }

      return bomLink;
    }

    return null;
  }

  hasSkuInExistingResponse(options: {
    row: any;
    targetSkuIds: Set<string>;
    instances: any[] | null | undefined;
    bomType: string;
    isHeaderRow?: (row: any) => boolean;
  }): boolean {
    const { row, targetSkuIds, instances, bomType, isHeaderRow } = options;

    if (typeof isHeaderRow === 'function' && isHeaderRow(row)) {
      return true;
    }

    if (row?.isNewRow) {
      return false;
    }

    const matchedInstance = this.findMatchingInstance(row, instances, targetSkuIds, bomType);
    if (!matchedInstance) {
      return false;
    }

    return this.rowHasTargetSkuValue(row, targetSkuIds);
  }

  findMatchingSku<T extends Record<string, unknown> & { skuId?: unknown }>(
    skus: T[] | null | undefined,
    targetSkuId: unknown,
  ): T | undefined {
    if (!Array.isArray(skus)) {
      return undefined;
    }
    const normalizedTargetId = this.normalizeSkuId(targetSkuId);
    if (!normalizedTargetId) {
      return undefined;
    }
    return skus.find((sku) => this.normalizeSkuId(sku?.skuId) === normalizedTargetId);
  }

  createAllowedSkuIdSet(skuInfo: Array<{ skuId?: unknown }> | null | undefined): Set<string> {
    return new Set(this.collectUniqueNormalizedIds(skuInfo, (sku) => sku?.skuId));
  }

  getSkuIdsFromSkus(skus: Array<{ skuId?: unknown }> | null | undefined): string[] {
    return this.collectUniqueNormalizedIds(skus, (sku) => sku?.skuId);
  }

  getSkuIdsFromBomLink(bomLink: any): string[] {
    return this.getSkuIdsFromSkus(bomLink?.skus);
  }

  hasSkuIdInSkus(skus: Array<{ skuId?: unknown }> | null | undefined, targetSkuId: unknown): boolean {
    const normalizedTargetId = this.normalizeSkuId(targetSkuId);
    if (!normalizedTargetId || !Array.isArray(skus)) {
      return false;
    }

    return skus.some((sku) => this.normalizeSkuId(sku?.skuId) === normalizedTargetId);
  }

  bomLinkHasSkuId(bomLink: any, targetSkuId: unknown): boolean {
    return this.hasSkuIdInSkus(bomLink?.skus, targetSkuId);
  }

  getPayloadSkuIds(
    payloadSkus: Array<{ skuId?: unknown; skuNumber?: unknown }> | null | undefined,
  ): string[] {
    return this.collectUniqueNormalizedIds(
      payloadSkus,
      (sku) => sku?.skuId ?? sku?.skuNumber,
    );
  }

  buildSkuFieldUpdates(options: {
    skuInfo: Array<{ skuId?: unknown }> | null | undefined;
    fillWithPartNumber?: boolean;
    partNumberValue?: unknown;
    sourceSkus?: Array<Record<string, unknown> & { skuId?: unknown; value?: unknown }> | null | undefined;
  }): SkuFieldUpdate[] {
    const { skuInfo, fillWithPartNumber, partNumberValue, sourceSkus } = options;
    if (!this.hasItems(skuInfo)) {
      return [];
    }

    const updates: SkuFieldUpdate[] = [];
    skuInfo.forEach((sku) => {
      const skuId = this.normalizeSkuId(sku?.skuId);
      if (!skuId) {
        return;
      }

      const fieldName = this.toFieldName(skuId);
      const value = fillWithPartNumber
        ? String(partNumberValue ?? '')
        : this.findMatchingSku(sourceSkus, skuId)?.['value'] ?? '';

      updates.push({ skuId, fieldName, value });
    });

    return updates;
  }

  applySkuFieldUpdates(options: {
    row?: Record<string, unknown> | null | undefined;
    updates: SkuFieldUpdate[] | null | undefined;
    setDataValue: (fieldName: string, value: unknown) => void;
    shouldApply?: (update: SkuFieldUpdate, currentValue: unknown) => boolean;
    syncRowObject?: boolean;
  }): string[] {
    const { row, updates, setDataValue, shouldApply, syncRowObject } = options;
    if (!this.hasItems(updates)) {
      return [];
    }

    const changedFields: string[] = [];
    updates.forEach((update) => {
      const currentValue = row?.[update.fieldName];
      if (typeof shouldApply === 'function' && !shouldApply(update, currentValue)) {
        return;
      }
      if (currentValue === update.value) {
        return;
      }

      setDataValue(update.fieldName, update.value);
      if (syncRowObject && row) {
        row[update.fieldName] = update.value;
      }
      changedFields.push(update.fieldName);
    });

    return changedFields;
  }

  countSkusWithValues(
    row: Record<string, unknown> | null | undefined,
    skuInfo: Array<{ skuId?: unknown }> | null | undefined,
  ): SkuSelectionSummary {
    if (!row || !this.hasItems(skuInfo)) {
      return { count: 0, skuIds: [] };
    }

    const skuIds = this.getSelectedSkuIds(row, skuInfo);
    return {
      count: skuIds.length,
      skuIds,
    };
  }

  hasAnySelectedSku(
    row: Record<string, unknown> | null | undefined,
    skuInfo: Array<{ skuId?: unknown }> | null | undefined,
  ): boolean {
    return this.countSkusWithValues(row, skuInfo).count > 0;
  }

  populateRowSkuFieldsFromSkus(
    row: Record<string, unknown>,
    skus: Array<{ skuId?: unknown; value?: unknown }> | null | undefined,
    options?: { includeEmptyValues?: boolean; mergeOnlyWhenTargetEmpty?: boolean },
  ): string[] {
    if (!row || !this.hasItems(skus)) {
      return [];
    }

    const includeEmptyValues = options?.includeEmptyValues === true;
    const mergeOnlyWhenTargetEmpty = options?.mergeOnlyWhenTargetEmpty === true;
    const allSkuIds: string[] = [];

    skus.forEach((sku) => {
      const skuId = this.normalizeSkuId(sku?.skuId);
      if (!skuId) {
        return;
      }

      allSkuIds.push(skuId);
      const skuFieldName = this.toFieldName(skuId);
      const value = sku?.value;
      const hasSourceValue = this.hasValue(value);

      if (!includeEmptyValues && !hasSourceValue) {
        return;
      }

      if (mergeOnlyWhenTargetEmpty && this.hasValue(row[skuFieldName])) {
        return;
      }

      row[skuFieldName] = hasSourceValue ? value : '';
    });

    return Array.from(new Set(allSkuIds));
  }

  getSkuValueWithDisconnectState(options: {
    row: Record<string, unknown> | null | undefined;
    skuFieldName: string;
    disconnectedSkuKeys?: Set<string>;
    disconnectedKey?: string;
  }): unknown {
    const { row, skuFieldName, disconnectedSkuKeys, disconnectedKey } = options;
    if (!row) {
      return undefined;
    }

    if (
      disconnectedSkuKeys &&
      disconnectedKey &&
      disconnectedSkuKeys.has(disconnectedKey)
    ) {
      return '';
    }

    return row[skuFieldName];
  }

  hasDisconnectedSkuForRow(options: {
    row: any;
    skuInfo: Array<{ skuId?: unknown }> | null | undefined;
    disconnectedSkuKeys: Set<string>;
    getDisconnectedKey: (row: any, skuField: string) => string;
  }): boolean {
    const { row, skuInfo, disconnectedSkuKeys, getDisconnectedKey } = options;
    if (!row || !this.hasItems(skuInfo) || disconnectedSkuKeys.size === 0) {
      return false;
    }

    return skuInfo.some((sku) => {
      const skuField = this.toFieldName(sku?.skuId);
      return disconnectedSkuKeys.has(getDisconnectedKey(row, skuField));
    });
  }

  findSkuInfoByFieldName<T extends { skuId?: unknown }>(
    skuInfo: T[] | null | undefined,
    skuField: string,
  ): T | undefined {
    if (!Array.isArray(skuInfo) || !skuField) {
      return undefined;
    }
    return skuInfo.find((sku) => this.toFieldName(sku?.skuId) === skuField);
  }

  isSkuEditableForDisconnect(
    skuInfo: Array<{ skuId?: unknown; isEditable?: unknown }> | null | undefined,
    skuField: string,
  ): boolean {
    const sku = this.findSkuInfoByFieldName(skuInfo || [], skuField);
    return sku?.isEditable === true;
  }

  getConnectedSkuLabelsForRow(
    row: any,
    skuInfo: Array<{ skuId?: unknown; skuName?: unknown; name?: unknown }> | null | undefined,
  ): string[] {
    if (!row || !this.hasItems(skuInfo)) {
      return [];
    }

    const labels: string[] = [];
    skuInfo.forEach((sku: any) => {
      const skuField = this.toFieldName(sku?.skuId);
      if (this.hasValue(row[skuField])) {
        const fallbackId = this.normalizeSkuId(sku?.skuId);
        const label = String(sku?.skuName || sku?.name || fallbackId || skuField);
        labels.push(label);
      }
    });

    return labels;
  }

  buildDisconnectedKey(rowToken: string, skuField: string): string {
    return `${String(rowToken || '')}|${String(skuField || '')}`;
  }

  getDisconnectedSkuList(options: {
    gridApi: any;
    skuInfo: Array<{ skuId?: unknown }> | null | undefined;
    disconnectedSkuKeys: Set<string>;
    getDisconnectedKey: (row: any, skuField: string) => string;
    isEligibleRow?: (row: any) => boolean;
  }): DisconnectedSkuListItem[] {
    const { gridApi, skuInfo, disconnectedSkuKeys, getDisconnectedKey, isEligibleRow } = options;
    const list: DisconnectedSkuListItem[] = [];

    if (!gridApi || !this.hasItems(skuInfo) || disconnectedSkuKeys.size === 0) {
      return list;
    }

    gridApi.forEachNode((node: any) => {
      const row = node?.data;
      if (!row) return;
      if (typeof isEligibleRow === 'function' && !isEligibleRow(row)) return;

      const part = String(row?.[FIELD_PART_NUMBER] ?? row?.part ?? '—').trim() || '—';
      skuInfo.forEach((sku: any) => {
        const skuField = this.toFieldName(sku?.skuId);
        const key = getDisconnectedKey(row, skuField);
        if (disconnectedSkuKeys.has(key)) {
          list.push({
            part,
            skuId: this.normalizeSkuId(sku?.skuId),
            key,
            row,
            skuField,
          });
        }
      });
    });

    return list;
  }

  getSelectedSkuIds(
    row: Record<string, unknown> | null | undefined,
    skuInfo: Array<{ skuId?: unknown }>,
  ): string[] {
    if (!row || !Array.isArray(skuInfo) || skuInfo.length === 0) {
      return [];
    }

    const selectedSkuIds: string[] = [];
    skuInfo.forEach((sku) => {
      const normalizedId = this.normalizeSkuId(sku?.skuId);
      if (!normalizedId) {
        return;
      }
      if (this.hasValue(this.getValue(row, normalizedId))) {
        selectedSkuIds.push(normalizedId);
      }
    });

    return selectedSkuIds;
  }
}
