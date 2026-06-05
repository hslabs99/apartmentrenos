"use client";

import { WbLabourSiloCell } from "@/components/wb-labour-silo-cell";
import {
  objectLabourDuplicateForName,
  objectLabourRatesLookupName,
} from "@/lib/client/labour-rate-index";
import {
  LABOUR_SILO_KEYS,
  WB_WORKBENCH_LABOUR_SILO_HEADERS,
} from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

type Props = {
  row: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  contractRates: DataLabourRatePublic[];
  objectLabourRates: DataObjectLabourRatePublic[];
  objectLabel: string;
  saving: boolean;
  wbCellLoad: string;
  wbInputLoad: string;
  inputKey: (row: ProjectAreaObjectPublic, field: string) => string;
  onPatch: (id: string, body: Record<string, unknown>) => void;
};

export function WbLabourSiloRowCells({
  row,
  quoteObjects,
  contractRates,
  objectLabourRates,
  objectLabel,
  saving,
  wbCellLoad,
  wbInputLoad,
  inputKey,
  onPatch,
}: Props) {
  const qObj = quoteObjects.find((o) => o.objectid === row.objectid);
  const objectLabourMatchName = objectLabourRatesLookupName(
    qObj?.objectname ?? objectLabel,
  );
  const skuProduct = row.skuProduct?.trim() || null;
  const dup = objectLabourDuplicateForName(
    objectLabourRates,
    objectLabourMatchName,
    skuProduct,
  );

  return (
    <>
      {WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key }) => (
        <WbLabourSiloCell
          key={key}
          siloKey={key}
          hours={row[key]}
          contractRates={contractRates}
          objectLabourDuplicate={dup}
          objectLabourMatchName={objectLabourMatchName}
          skuProduct={skuProduct}
          editable={false}
          disabled={saving}
          cellClassName={wbCellLoad}
          inputClassName={wbInputLoad}
          inputKey={inputKey(row, key)}
          displayKey={`${inputKey(row, key)}-${row[key] ?? "n"}`}
        />
      ))}
    </>
  );
}

export function sumLabourHours(
  rows: ProjectAreaObjectPublic[],
  key: (typeof LABOUR_SILO_KEYS)[number],
): number {
  return rows.reduce((sum, row) => {
    if (row.included === false) return sum;
    const v = row[key];
    return sum + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}
