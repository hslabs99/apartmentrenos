"use client";

import { ClTotalPriceCell } from "@/components/cl-total-price-cell";
import { CascadeColourSelect } from "@/components/cascade-style-colour-fields";
import {
  clFieldsGridClass,
  clFieldsGridStyle,
  clObjectNameRowClass,
  clObjectNameTextClass,
  clScopeLineStackClass,
  clScopeMeasureColClass,
  clScopeNonStdColClass,
  clScopeToolColClass,
  clToolCellClass,
  clScopeSkuColClass,
  clScopeUomColClass,
  clSkuFieldClass,
  clSkuPickerWrapClass,
  clMeasureFieldClass,
  clUomFieldClass,
} from "@/components/cl-checklist-layout";
import { IconNotes } from "@/components/icons/lightning-icons";
import { WbLineRowMenu } from "@/components/wb-line-row-menu";
import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { ScopeLineSkuPicker } from "@/components/scope-line-sku-picker";
import { WbBuildingElementSkuCell } from "@/components/wb-building-element-sku-cell";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/client/format-money";
import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import {
  resolveScopeLineSkuUnitPriceExcGst,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { ChecklistMeasureInput } from "@/components/checklist-measure-input";
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
import { WbObjectName } from "@/components/wb-object-name";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
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

type ChecklistProps = {
  mode: "checklist";
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
  cascades: CascadeRow[];
  baseStyleOptions: { out: string[]; seen: Set<string> };
  marginPct: number;
  isAdminMode: boolean;
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
  lineHasNotes: (row: ProjectAreaObjectPublic) => boolean;
  lineNotesTooltip: (row: ProjectAreaObjectPublic) => string;
  lineNotesIconBtnClass: (hasNotes: boolean) => string;
  onOpenLineNotes: (lineId: string, label: string, draft: string) => void;
  lineNotesCombined: (row: ProjectAreaObjectPublic) => string;
  onDeleteLine: (lineId: string) => void;
  onCloneLine: (lineId: string) => void;
  wbCloningLineId: string | null;
  onValidationError: (message: string) => void;
  contractLabourRates: DataLabourRatePublic[];
  objectLabourRates: DataObjectLabourRatePublic[];
  buildingElementBySkuName: Map<string, DataBuildingElementPublic>;
  onOpenBuildingElementConsumption: (lineId: string) => void;
};

type WorkbenchProps = {
  mode: "workbench";
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
}: {
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
}) {
  const qObj = quoteObjects.find((o) => o.objectid === child.objectid);
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
          <div className={clSkuPickerWrapClass}>
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
                onSelectSku={(pick: ScopeLineSkuPick) => {
                  onPatchLine(child.id, patchBodyForScopeLineSku(child, pick));
                }}
              />
            ) : (
              <span className="text-xs text-sf-text-weak">No quote object</span>
            )}
          </div>
        </div>
        <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
          <span className={wbHdrLabel}>Measure</span>
          <ChecklistMeasureInput
            line={child}
            quoteObject={qObj}
            pa={pa}
            project={project}
            measureKey={measureKey}
            inputClassName={clMeasureInput}
            disabled={lineSaving}
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
        <ClTotalPriceCell line={child} marginPct={marginPct} />
        <div className={`${clToolCellClass} ${clScopeToolColClass}`} aria-hidden />
      </div>
    </div>
  );
}

function WorkbenchBundledLine({
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
  const qObj = quoteObjects.find((o) => o.objectid === child.objectid);
  const lf = wb.lineFinalPrice(child, wb.marginPct);

  return (
    <tr
      className={`${wb.areaObjectBand} text-sf-text-secondary dark:text-zinc-400`}
    >
      <td className={`${wb.wbCellMid} text-center`}>
        <input
          type="checkbox"
          checked={included}
          disabled={lineSaving}
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
          disabled={lineSaving}
          emptyLabel="Area default"
        />
      </td>
      <td className={wb.wbCellMid}>
        <select
          className={wb.wbSelectRow}
          disabled={lineSaving}
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
          disabled={lineSaving}
          selectClassName={wb.wbSelectRow}
          emptyLabel={wb.wbLineColourEmptyLabel(pa, project)}
          onColourChange={(v) => onPatchLine(child.id, { colour: v ? v : null })}
        />
      </td>
      <td className={wb.wbCellSku}>
        {qObj ? (
          <WbBuildingElementSkuCell
            line={child}
            catalogSkus={catalogSkus}
            buildingElementBySkuName={wb.buildingElementBySkuName}
            disabled={lineSaving}
            onOpenConsumption={wb.onOpenBuildingElementConsumption}
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
              disabled={lineSaving}
              selectClassName={wb.wbSelectRow}
              variant="compact"
              showSupplierPrice
              shortMatchLabels
              inlineRow
              syncUnitPriceFromPick
              showIncludeAllSupplierOptions={wb.isAdminMode}
              includeAllSupplierOptions={wb.includeAllSuppliersForLine(child.id)}
              onIncludeAllSupplierOptionsChange={(checked) =>
                wb.setIncludeAllSuppliersForLine(child.id, checked)
              }
              lockToSkuId={child.scopeShowAllSku ? child.skuId : null}
              onSelectSku={(pick: ScopeLineSkuPick) => {
                onPatchLine(child.id, patchBodyForScopeLineSku(child, pick));
              }}
            />
          </WbBuildingElementSkuCell>
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
          disabled={lineSaving}
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
          disabled={lineSaving}
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
      <td className={wb.wbCellNum}>{wb.formatMoney(child.totalprice)}</td>
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
      <td className={`${wb.wbCellNum} font-medium text-emerald-800 dark:text-emerald-200`}>
        {lf != null ? wb.formatMoney(lf) : "—"}
      </td>
      <td className={wb.wbCellMid}>
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            className={wb.lineNotesIconBtnClass(wb.lineHasNotes(child))}
            disabled={lineSaving || wb.paoDeleting}
            title={wb.lineNotesTooltip(child)}
            aria-label={`Notes for ${wb.objectLabel(child, quoteObjects)}`}
            onClick={() =>
              wb.onOpenLineNotes(child.id, wb.objectLabel(child, quoteObjects), wb.lineNotesCombined(child))
            }
          >
            <IconNotes
              className={`h-4 w-4 ${wb.lineHasNotes(child) ? "text-sf-destructive dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
            />
          </button>
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
      <WbLineSupplierCell
        row={child}
        suppliersBySkuId={suppliersBySkuId}
        supplierDiscountByKey={supplierDiscountByKey}
        cellClassName={wb.wbCellMid}
      />
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
