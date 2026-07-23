"use client";

import { ClTotalPriceCell } from "@/components/cl-total-price-cell";
import {
  lineExtendedTotalBreakdownTitle,
  lineFinalPriceBreakdown,
  lineFinalPriceBreakdownTitle,
} from "@/lib/client/line-final-price";
import { CascadeColourSelect } from "@/components/cascade-style-colour-fields";
import {
  clFieldsGridClass,
  clFieldsGridStyle,
  clObjectNameRowClass,
  clObjectNameTextClass,
  clScopeLineStackClass,
  clScopeMeasureColClass,
  clScopeNonStdColClass,
  clScopeNotesColClass,
  clScopeCalculatorColClass,
  clScopeActionsColClass,
  clNotesCellClass,
  clCalculatorCellClass,
  clActionsCellClass,
  clScopeSkuColClass,
  clScopeUomColClass,
  clSkuFieldClass,
  clSkuPickerWrapClass,
  clMeasureFieldClass,
  clUomFieldClass,
} from "@/components/cl-checklist-layout";
import type { ReactNode } from "react";
import { WbLineRowMenu } from "@/components/wb-line-row-menu";
import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { ScopeLineSkuPicker } from "@/components/scope-line-sku-picker";
import { WbBuildingElementSkuCell } from "@/components/wb-building-element-sku-cell";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/client/format-money";
import { quoteObjectCategory } from "@/lib/client/quote-object-category";
import { bundledAppendSkuPickerHint } from "@/lib/client/resolve-append-child-sku-picks";
import { appendSpecForSlot } from "@/lib/sku/data-sku-append-slots";
import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import {
  resolveScopeLineSkuUnitPriceExcGst,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { ChecklistMeasureInput } from "@/components/checklist-measure-input";
import { ScopeLineMeasureTool } from "@/components/scope-tool-modal";
import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { WbLabourSiloRowCells } from "@/components/wb-labour-silo-row-cells";
import { WbLineSupplierCell } from "@/components/wb-line-supplier-cell";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import { WbObjectName } from "@/components/wb-object-name";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";

const wbHdrLabel =
  "block text-[10px] font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function BundledAppendSkuAlert({
  title,
}: {
  title: string;
}) {
  return (
    <span
      className="ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold leading-none text-amber-950 dark:bg-amber-900/70 dark:text-amber-100"
      title={title}
      aria-label={title}
    >
      !
    </span>
  );
}

type ChecklistProps = {
  mode: "checklist";
  parentLine: ProjectAreaObjectPublic;
  bundledLines: ProjectAreaObjectPublic[];
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  rowSavingId: string | null;
  clSkuInput: string;
  clMeasureInput: string;
  clUomInput: string;
  inputKey: (row: ProjectAreaObjectPublic, field: string) => string;
  objectLabel: (row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]) => string;
  onPatchLine: (id: string, body: Record<string, unknown>) => void;
  onValidationError: (message: string) => void;
  marginPct: number;
  colourLookupIndex?: ColourLookupIndex | null;
  contractLabourRates?: DataLabourRatePublic[];
};

export type WorkbenchBundledContext = {
  wbSelectRow: string;
  wbInputMeasure: string;
  wbInputCurrency: string;
  wbInputLoad: string;
  wbCellMid: string;
  wbCellDesc: string;
  wbCellSku: string;
  wbCellUom: string;
  wbCellNum: string;
  wbCellLoad: string;
  wbSpacerCell: string;
  areaObjectBand: string;
  /** When false (Summary view), hide Source / Elevate / Style / Colour cells. */
  showCascadeDetailColumns: boolean;
  cascades: CascadeRow[];
  baseStyleOptions: { out: string[]; seen: Set<string> };
  marginPct: number;
  showIncludeAllSupplierOptions: boolean;
  paoDeleting: boolean;
  includeAllSuppliersForLine: (lineId: string) => boolean;
  setIncludeAllSuppliersForLine: (lineId: string, checked: boolean) => void;
  inputKey: (row: ProjectAreaObjectPublic, field: string) => string;
  objectLabel: (row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]) => string;
  lineSourceLabel: (row: ProjectAreaObjectPublic) => string;
  lineFinalPrice: (row: ProjectAreaObjectPublic, marginPct: number) => number | null;
  effectiveCascadeStyleForLine: (
    row: ProjectAreaObjectPublic,
    pa: ProjectAreaPublic,
    project: ProjectPublic | null,
  ) => string;
  wbLineColourEmptyLabel: (pa: ProjectAreaPublic, project: ProjectPublic | null) => string;
  formatMoney: (n: number | null | undefined) => string;
  renderObjectNotesButton: (
    row: ProjectAreaObjectPublic,
    label: string,
  ) => ReactNode;
  onDeleteLine: (lineId: string) => void;
  onCloneLine: (lineId: string) => void;
  wbCloningLineId: string | null;
  onValidationError: (message: string) => void;
  contractLabourRates: DataLabourRatePublic[];
  objectLabourRates: DataObjectLabourRatePublic[];
  buildingElementBySkuName: Map<string, DataBuildingElementPublic>;
  onOpenBuildingElementConsumption: (lineId: string) => void;
  paintingElementBySkuName: Map<string, DataPaintingElementPublic>;
  onOpenPaintingElementConsumption: (lineId: string) => void;
  colourLookupIndex?: ColourLookupIndex | null;
  blankLineSourceRowId: string | null;
  wbBlankLineSaving: boolean;
  onOpenBlankLineFromRow: (
    pa: ProjectAreaPublic,
    row: ProjectAreaObjectPublic,
    qObj: QuoteObjectPublic,
  ) => void;
};

type WorkbenchProps = {
  mode: "workbench";
  parentLine: ProjectAreaObjectPublic;
  bundledLines: ProjectAreaObjectPublic[];
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  supplierDiscountByKey: SupplierDiscountByKey;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  rowSavingId: string | null;
  workbench: WorkbenchBundledContext;
  onPatchLine: (id: string, body: Record<string, unknown>) => void;
  colourLookupIndex?: ColourLookupIndex | null;
};

type Props = ChecklistProps | WorkbenchProps;

function bundledLabel(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  objectLabel: (row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]) => string,
): string {
  return `↳ ${objectLabel(row, quoteObjects)}`;
}

function ChecklistBundledLine({
  parentLine,
  child,
  quoteObjects,
  catalogSkus,
  suppliersBySkuId,
  priceLevels,
  cascades,
  pa,
  project,
  lineSaving,
  clSkuInput,
  clMeasureInput,
  clUomInput,
  inputKey,
  objectLabel,
  onPatchLine,
  onValidationError,
  marginPct,
  supplierDiscountByKey,
  colourLookupIndex = null,
  contractLabourRates,
}: {
  parentLine: ProjectAreaObjectPublic;
  child: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  lineSaving: boolean;
  clSkuInput: string;
  clMeasureInput: string;
  clUomInput: string;
  inputKey: (row: ProjectAreaObjectPublic, field: string) => string;
  objectLabel: (row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]) => string;
  onPatchLine: (id: string, body: Record<string, unknown>) => void;
  onValidationError: (message: string) => void;
  marginPct: number;
  supplierDiscountByKey?: SupplierDiscountByKey;
  colourLookupIndex?: ColourLookupIndex | null;
  contractLabourRates?: DataLabourRatePublic[];
}) {
  const qObj = quoteObjects.find((o) => o.objectid === child.objectid);
  const parentSku = parentLine.skuId
    ? catalogSkus.find((s) => s.skuId === parentLine.skuId)
    : undefined;
  const parentCategory = quoteObjectCategory(parentLine, quoteObjects) ?? "";
  const appendProductSpec =
    parentSku && child.bundledAppendSlot != null
      ? appendSpecForSlot(parentSku, child.bundledAppendSlot)
      : "";
  const appendHint = bundledAppendSkuPickerHint({
    parentLine,
    childLine: child,
    parentSku,
    parentCategory,
    catalogSkus,
    suppliersBySkuId,
    priceLevels,
    cascades,
    quoteObjects,
    pa,
    project,
    preferredSupplierOption: parentLine.supplierOption ?? null,
    supplierDiscountByKey,
    colourLookupIndex,
  });
  const measureKey =
    child.custommeasure != null
      ? inputKey(child, "bundled-m")
      : `${inputKey(child, "bundled-m")}-ctx-${pa.aream2 ?? ""}-${project?.projectm2 ?? ""}-${project?.projectm2soft ?? ""}-${project?.projectm2hard ?? ""}`;

  return (
    <div
      className={`${clScopeLineStackClass} rounded-md border border-dashed border-sf-border/80 bg-sf-page/60 py-2 dark:border-zinc-600 dark:bg-zinc-900/30`}
    >
      <div className={clObjectNameRowClass}>
        <span className={`${clObjectNameTextClass} text-sf-text-secondary dark:text-zinc-400`}>
          {bundledLabel(child, quoteObjects, objectLabel)}
        </span>
        <span className="ml-2 shrink-0 text-[10px] uppercase text-sf-text-weak">Bundled</span>
      </div>
      <div className={clFieldsGridClass} style={clFieldsGridStyle}>
        <div className={`${clSkuFieldClass} ${clScopeSkuColClass}`}>
          <span className={wbHdrLabel}>SKU</span>
          <div className={`${clSkuPickerWrapClass} flex items-center gap-0.5`}>
            {qObj ? (
              <ScopeLineSkuPicker
                line={child}
                quoteObject={qObj}
                catalogSkus={catalogSkus}
                suppliersBySkuId={suppliersBySkuId}
                priceLevels={priceLevels}
                cascades={cascades}
                pa={pa}
                project={project}
                disabled={lineSaving}
                selectClassName={clSkuInput}
                variant="compact"
                showSupplierPrice={false}
                shortMatchLabels
                inlineRow
                autoApplySingleMatch
                autoApplyOnlyWhenEmptySku
                onSelectSku={(pick: ScopeLineSkuPick) => {
                  onPatchLine(child.id, patchBodyForScopeLineSku(child, pick));
                }}
                colourLookupIndex={colourLookupIndex}
                appendProductSpec={appendProductSpec}
                appendParentCategory={parentCategory}
              />
            ) : (
              <span className="text-xs text-sf-text-weak">No quote object</span>
            )}
            {appendHint ? <BundledAppendSkuAlert title={appendHint} /> : null}
          </div>
        </div>
        <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
          <span className={wbHdrLabel}>Measure</span>
          <ChecklistMeasureInput
            line={child}
            quoteObject={qObj}
            pa={pa}
            project={project}
            scopeMeasureExtras={{ catalogSkus }}
            measureKey={measureKey}
            inputClassName={clMeasureInput}
            disabled={lineSaving}
            ynMeasureDropdown
            onPatch={(custommeasure) => {
              onPatchLine(child.id, { custommeasure });
            }}
            onValidationError={onValidationError}
          />
        </label>
        <label className={`${clUomFieldClass} ${clScopeUomColClass}`}>
          <span className={wbHdrLabel}>UOM</span>
          <input
            key={inputKey(child, "bundled-u")}
            type="text"
            className={clUomInput}
            defaultValue={child.customuom}
            disabled={lineSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              const next = e.target.value;
              if (next === child.customuom) return;
              onPatchLine(child.id, { customuom: next });
            }}
          />
        </label>
        <div className={`${clScopeNonStdColClass}`} aria-hidden />
        <ClTotalPriceCell
          line={child}
          marginPct={marginPct}
          contractLabourRates={contractLabourRates}
        />
        <div className={`${clNotesCellClass} ${clScopeNotesColClass}`} aria-hidden />
        <div className={`${clCalculatorCellClass} ${clScopeCalculatorColClass}`}>
          <ScopeLineMeasureTool
            line={child}
            quoteObjects={quoteObjects}
            objectLabel={objectLabel(child, quoteObjects)}
            disabled={lineSaving}
            onApplyMeasure={(payload) => {
              onPatchLine(child.id, {
                custommeasure: payload.m2,
                ...(payload.scopeToolBenchSections !== undefined
                  ? { scopeToolBenchSections: payload.scopeToolBenchSections }
                  : {}),
                ...(payload.scopeToolWallMm !== undefined
                  ? { scopeToolWallMm: payload.scopeToolWallMm }
                  : {}),
              });
            }}
          />
        </div>
        <div className={`${clActionsCellClass} ${clScopeActionsColClass}`} aria-hidden />
      </div>
    </div>
  );
}

function WorkbenchBundledLine({
  parentLine,
  child,
  quoteObjects,
  catalogSkus,
  suppliersBySkuId,
  priceLevels,
  supplierDiscountByKey,
  pa,
  project,
  lineSaving,
  wb,
  onPatchLine,
}: {
  parentLine: ProjectAreaObjectPublic;
  child: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  supplierDiscountByKey: SupplierDiscountByKey;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  lineSaving: boolean;
  wb: WorkbenchBundledContext;
  onPatchLine: (id: string, body: Record<string, unknown>) => void;
}) {
  const included = child.included !== false;
  const rowDisabledForBlankLine = wb.blankLineSourceRowId === child.id;
  const childSaving = lineSaving || rowDisabledForBlankLine;
  const qObj = quoteObjects.find((o) => o.objectid === child.objectid);
  const parentSku = parentLine.skuId
    ? catalogSkus.find((s) => s.skuId === parentLine.skuId)
    : undefined;
  const parentCategory = quoteObjectCategory(parentLine, quoteObjects) ?? "";
  const appendProductSpec =
    parentSku && child.bundledAppendSlot != null
      ? appendSpecForSlot(parentSku, child.bundledAppendSlot)
      : "";
  const appendHint = bundledAppendSkuPickerHint({
    parentLine,
    childLine: child,
    parentSku,
    parentCategory,
    catalogSkus,
    suppliersBySkuId,
    priceLevels,
    cascades: wb.cascades,
    quoteObjects,
    pa,
    project,
    preferredSupplierOption: parentLine.supplierOption ?? null,
    supplierDiscountByKey,
    colourLookupIndex: wb.colourLookupIndex ?? null,
  });
  const lfBreakdown = lineFinalPriceBreakdown(
    child,
    wb.marginPct,
    undefined,
    undefined,
    undefined,
    wb.contractLabourRates,
  );
  const lf = lfBreakdown?.finalExcGst ?? null;

  return (
    <tr
      className={`${wb.areaObjectBand} text-sf-text-secondary dark:text-zinc-400${rowDisabledForBlankLine ? " opacity-50" : ""}`}
    >
      <td className={`${wb.wbCellMid} text-center`}>
        <input
          type="checkbox"
          checked={included}
          disabled={childSaving}
          aria-label={`Include bundled “${wb.objectLabel(child, quoteObjects)}” in cost totals`}
          onChange={(e) => {
            onPatchLine(child.id, { included: e.target.checked });
          }}
          className="size-4 cursor-pointer rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-500"
        />
      </td>
      <td className={`${wb.wbCellDesc} pl-6`}>
        <span className="flex min-w-0 items-center gap-0.5 text-xs">
          <span className="shrink-0 text-sf-text-secondary dark:text-zinc-400">↳</span>
          <WbObjectName
            row={child}
            quoteObjects={quoteObjects}
            catalogSkus={catalogSkus}
            included={included}
            className="text-xs"
          />
        </span>
      </td>
      {wb.showCascadeDetailColumns ? (
        <>
      <td className={`${wb.wbCellMid} truncate text-xs`}>{wb.lineSourceLabel(child)}</td>
      <td className={wb.wbCellMid}>
        <CascadeElevateSelect
          cascades={wb.cascades}
          priceLevels={priceLevels}
          priceLevelId={child.pricelevelid ?? null}
          projectFinish={project?.projectfinish}
          onChange={({ priceLevelId }) => {
            onPatchLine(child.id, { pricelevelid: priceLevelId });
          }}
          className={wb.wbSelectRow}
          disabled={childSaving}
          emptyLabel="Area default"
        />
      </td>
      <td className={wb.wbCellMid}>
        <select
          className={wb.wbSelectRow}
          disabled={childSaving}
          value={child.style ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPatchLine(child.id, { style: v ? v : null, colour: null });
          }}
        >
          <option value="">
            {`Area default${pa.style?.trim() ? ` · ${pa.style.trim()}` : project?.defaultstyle?.trim() ? ` · ${project.defaultstyle.trim()}` : ""}`}
          </option>
          {wb.baseStyleOptions.out.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          {(() => {
            const saved = (child.style ?? "").trim();
            if (!saved || wb.baseStyleOptions.seen.has(saved)) return null;
            return <option value={saved}>{saved} (saved)</option>;
          })()}
        </select>
      </td>
      <td className={wb.wbCellMid}>
        <CascadeColourSelect
          cascades={wb.cascades}
          level={cascadeLevelFromPriceLevel(
            priceLevels,
            child.pricelevelid ?? pa.pricelevelid ?? project?.defaultpricelevelid,
            project?.projectfinish,
            wb.cascades,
          )}
          styleForFilter={wb.effectiveCascadeStyleForLine(child, pa, project)}
          colour={child.colour ?? ""}
          disabled={childSaving}
          selectClassName={wb.wbSelectRow}
          emptyLabel={wb.wbLineColourEmptyLabel(pa, project)}
          onColourChange={(v) => onPatchLine(child.id, { colour: v ? v : null })}
        />
      </td>
        </>
      ) : null}
      <td className={wb.wbCellSku}>
        {qObj ? (
          <div className="flex min-w-0 items-center gap-0.5">
          <WbBuildingElementSkuCell
            line={child}
            catalogSkus={catalogSkus}
            buildingElementBySkuName={wb.buildingElementBySkuName}
            paintingElementBySkuName={wb.paintingElementBySkuName}
            disabled={childSaving}
            onOpenConsumption={wb.onOpenBuildingElementConsumption}
            onOpenPaintingConsumption={wb.onOpenPaintingElementConsumption}
          >
            <ScopeLineSkuPicker
              line={child}
              quoteObject={qObj}
              catalogSkus={catalogSkus}
              suppliersBySkuId={suppliersBySkuId}
              priceLevels={priceLevels}
              cascades={wb.cascades}
              supplierDiscountByKey={supplierDiscountByKey}
              pa={pa}
              project={project}
              disabled={childSaving || wb.wbBlankLineSaving}
              selectClassName={wb.wbSelectRow}
              variant="compact"
              showSupplierPrice
              shortMatchLabels
              inlineRow
              skuPickerUi="popup"
              autoApplySingleMatch
              autoApplyOnlyWhenEmptySku
              syncUnitPriceFromPick
              showIncludeAllSupplierOptions={wb.showIncludeAllSupplierOptions}
              includeAllSupplierOptions={wb.includeAllSuppliersForLine(child.id)}
              onIncludeAllSupplierOptionsChange={(checked) =>
                wb.setIncludeAllSuppliersForLine(child.id, checked)
              }
              lockToSkuId={child.scopeShowAllSku ? child.skuId : null}
              showAddBlankLineOption
              onAddBlankLine={() => {
                if (qObj) wb.onOpenBlankLineFromRow(pa, child, qObj);
              }}
              onSelectSku={(pick: ScopeLineSkuPick) => {
                onPatchLine(child.id, patchBodyForScopeLineSku(child, pick));
              }}
              colourLookupIndex={wb.colourLookupIndex ?? null}
              appendProductSpec={appendProductSpec}
              appendParentCategory={parentCategory}
            />
          </WbBuildingElementSkuCell>
          {appendHint ? <BundledAppendSkuAlert title={appendHint} /> : null}
          </div>
        ) : (
          <span className="text-xs">—</span>
        )}
      </td>
      <td className={wb.wbCellMid}>
        <input
          key={wb.inputKey(child, "m")}
          type="text"
          inputMode="decimal"
          className={wb.wbInputMeasure}
          defaultValue={child.custommeasure ?? ""}
          disabled={childSaving}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (raw !== "" && parseOptionalNumber(raw) === null) {
              wb.onValidationError("Measure must be a valid number (or empty).");
              e.target.value = child.custommeasure != null ? String(child.custommeasure) : "";
              return;
            }
            const next = parseOptionalNumber(raw);
            const prev = child.custommeasure ?? null;
            if (next === prev) return;
            onPatchLine(child.id, { custommeasure: next });
          }}
        />
      </td>
      <td className={wb.wbCellUom}>
        <input
          key={wb.inputKey(child, "u")}
          type="text"
          className={wb.wbSelectRow}
          defaultValue={child.customuom}
          disabled={childSaving}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            const next = e.target.value;
            if (next === child.customuom) return;
            onPatchLine(child.id, { customuom: next });
          }}
        />
      </td>
      <td className={wb.wbCellNum}>
        <input
          key={wb.inputKey(child, "p")}
          type="text"
          inputMode="decimal"
          className={wb.wbInputCurrency}
          defaultValue={formatCurrencyInput(
            resolveScopeLineSkuUnitPriceExcGst(
              child,
              suppliersBySkuId,
              supplierDiscountByKey,
            ),
          )}
          disabled={childSaving}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (raw !== "" && parseCurrencyInput(raw) === null) {
              wb.onValidationError("Unit price must be a valid amount (or empty).");
              e.target.value = formatCurrencyInput(
                resolveScopeLineSkuUnitPriceExcGst(
              child,
              suppliersBySkuId,
              supplierDiscountByKey,
            ),
              );
              return;
            }
            const next = parseCurrencyInput(raw);
            const prev = child.customumprice ?? null;
            e.target.value = formatCurrencyInput(next);
            if (next === prev) return;
            onPatchLine(child.id, { customumprice: next });
          }}
        />
      </td>
      <td
        className={wb.wbCellNum}
        title={lfBreakdown ? lineExtendedTotalBreakdownTitle(lfBreakdown) : undefined}
      >
        {wb.formatMoney(lfBreakdown?.baseExcGst ?? child.totalprice)}
      </td>
      <WbLabourSiloRowCells
        row={child}
        quoteObjects={quoteObjects}
        contractRates={wb.contractLabourRates}
        objectLabourRates={wb.objectLabourRates}
        objectLabel={wb.objectLabel(child, quoteObjects)}
        saving={lineSaving}
        wbCellLoad={wb.wbCellLoad}
        wbInputLoad={wb.wbInputLoad}
        inputKey={wb.inputKey}
        onPatch={onPatchLine}
      />
      <td
        className={`${wb.wbCellNum} font-medium text-emerald-800 dark:text-emerald-200`}
        title={
          lfBreakdown ? lineFinalPriceBreakdownTitle(lfBreakdown) : undefined
        }
      >
        {lf != null ? wb.formatMoney(lf) : "—"}
      </td>
      <WbLineSupplierCell
        row={child}
        suppliersBySkuId={suppliersBySkuId}
        supplierDiscountByKey={supplierDiscountByKey}
        cellClassName={wb.wbCellMid}
      />
      <td className={wb.wbCellMid}>
        <div className="flex items-center justify-end gap-0.5">
          {wb.renderObjectNotesButton(child, wb.objectLabel(child, quoteObjects))}
          <WbLineRowMenu
            lineLabel={wb.objectLabel(child, quoteObjects)}
            disabled={
              lineSaving ||
              wb.paoDeleting ||
              wb.wbCloningLineId === child.id
            }
            onClone={() => wb.onCloneLine(child.id)}
            onDelete={() => wb.onDeleteLine(child.id)}
          />
        </div>
      </td>
      <td className={wb.wbSpacerCell} />
    </tr>
  );
}

export function ScopeLineBundledChildren(props: Props) {
  if (props.bundledLines.length === 0) return null;

  if (props.mode === "checklist") {
    return (
      <div className="mt-1 space-y-1 border-l-2 border-emerald-200/80 pl-2 dark:border-emerald-800/60">
        {props.bundledLines.map((child) => (
          <ChecklistBundledLine
            key={child.id}
            parentLine={props.parentLine}
            child={child}
            quoteObjects={props.quoteObjects}
            catalogSkus={props.catalogSkus}
            suppliersBySkuId={props.suppliersBySkuId}
            priceLevels={props.priceLevels}
            cascades={props.cascades}
            pa={props.pa}
            project={props.project}
            lineSaving={props.rowSavingId === child.id}
            clSkuInput={props.clSkuInput}
            clMeasureInput={props.clMeasureInput}
            clUomInput={props.clUomInput}
            inputKey={props.inputKey}
            objectLabel={props.objectLabel}
            onPatchLine={props.onPatchLine}
            onValidationError={props.onValidationError}
            marginPct={props.marginPct}
            colourLookupIndex={props.colourLookupIndex ?? null}
            contractLabourRates={props.contractLabourRates}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {props.bundledLines.map((child) => (
        <WorkbenchBundledLine
          key={child.id}
          parentLine={props.parentLine}
          child={child}
          quoteObjects={props.quoteObjects}
          catalogSkus={props.catalogSkus}
          suppliersBySkuId={props.suppliersBySkuId}
          priceLevels={props.priceLevels}
          supplierDiscountByKey={props.supplierDiscountByKey}
          pa={props.pa}
          project={props.project}
          lineSaving={props.rowSavingId === child.id}
          wb={props.workbench}
          onPatchLine={props.onPatchLine}
        />
      ))}
    </>
  );
}
