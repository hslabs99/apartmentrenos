"use client";

import { BuildingElementsPanel } from "@/components/building-elements-panel";
import { CascadesTablePanel } from "@/components/cascades-table-panel";
import { DataBlindsTablePanel } from "@/components/data-blinds-table-panel";
import { PaintingElementsPanel } from "@/components/painting-elements-panel";
import { PriceLevelsPanel } from "@/components/price-levels-panel";
import { LabTypeLabourRatesPanel } from "@/components/lab-type-labour-rates-panel";
import { LabourRatesPanel } from "@/components/labour-rates-panel";
import { SupplierDiscountsPanel } from "@/components/supplier-discounts-panel";
import { SystemLookupsPanel } from "@/components/system-lookups-panel";
import { SalesStaffPanel } from "@/components/sales-staff-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { useState } from "react";

type SystemTab =
  | "sales-staff"
  | "labour-rates"
  | "building-elements"
  | "painting-elements"
  | "lab-type-labour-rates"
  | "supplier-discounts"
  | "price-levels"
  | "cascades"
  | "blinds"
  | "lookups"
  | "settings";

export function SystemPanel() {
  const [tab, setTab] = useState<SystemTab>("sales-staff");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          System
        </h1>
        <div
          className={sfTabStripClass}
          role="tablist"
          aria-label="System sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sales-staff"}
            onClick={() => setTab("sales-staff")}
            className={sfUnderlineTabClass(tab === "sales-staff")}
          >
            Sales Staff
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "labour-rates"}
            onClick={() => setTab("labour-rates")}
            className={sfUnderlineTabClass(tab === "labour-rates")}
          >
            Labour Rates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "building-elements"}
            onClick={() => setTab("building-elements")}
            className={sfUnderlineTabClass(tab === "building-elements")}
          >
            Building Elements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "painting-elements"}
            onClick={() => setTab("painting-elements")}
            className={sfUnderlineTabClass(tab === "painting-elements")}
          >
            Painting Elements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lab-type-labour-rates"}
            onClick={() => setTab("lab-type-labour-rates")}
            className={sfUnderlineTabClass(tab === "lab-type-labour-rates")}
          >
            Lab Type Labour Rates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "supplier-discounts"}
            onClick={() => setTab("supplier-discounts")}
            className={sfUnderlineTabClass(tab === "supplier-discounts")}
          >
            Supplier Discounts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "price-levels"}
            onClick={() => setTab("price-levels")}
            className={sfUnderlineTabClass(tab === "price-levels")}
          >
            Price Levels
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cascades"}
            onClick={() => setTab("cascades")}
            className={sfUnderlineTabClass(tab === "cascades")}
          >
            Cascades
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "blinds"}
            onClick={() => setTab("blinds")}
            className={sfUnderlineTabClass(tab === "blinds")}
          >
            Blinds
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lookups"}
            onClick={() => setTab("lookups")}
            className={sfUnderlineTabClass(tab === "lookups")}
          >
            System Lookups
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "settings"}
            onClick={() => setTab("settings")}
            className={sfUnderlineTabClass(tab === "settings")}
          >
            Settings
          </button>
        </div>
      </div>

      {tab === "sales-staff" ? <SalesStaffPanel /> : null}
      {tab === "labour-rates" ? <LabourRatesPanel /> : null}
      {tab === "building-elements" ? <BuildingElementsPanel /> : null}
      {tab === "painting-elements" ? <PaintingElementsPanel /> : null}
      {tab === "lab-type-labour-rates" ? <LabTypeLabourRatesPanel /> : null}
      {tab === "supplier-discounts" ? <SupplierDiscountsPanel /> : null}
      {tab === "price-levels" ? <PriceLevelsPanel /> : null}
      {tab === "cascades" ? <CascadesTablePanel /> : null}
      {tab === "blinds" ? <DataBlindsTablePanel /> : null}
      {tab === "lookups" ? <SystemLookupsPanel /> : null}
      {tab === "settings" ? <SettingsPanel /> : null}
    </div>
  );
}
