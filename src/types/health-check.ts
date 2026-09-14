export type HealthCheckAnswerIssue = {
  answerid: string;
  answerLabel: string;
  missingIds: string[];
  missingNames: string[];
};

export type HealthCheckScopeIssue = {
  scopeDocId: string;
  scopeid: number | null;
  question: string;
  areaNames: string;
  answers: HealthCheckAnswerIssue[];
  href: string;
};

export type HealthCheckAreaObjectIssue = {
  areaObjectDocId: string;
  areaid: number;
  areaName: string;
  objectid: number;
  href: string;
};

export type HealthCheckProjectLineIssue = {
  lineId: string;
  objectid: number;
  objectname: string;
  skuId: string | null;
  skuProduct: string | null;
  areaName: string;
  kind: "object" | "sku";
  href: string;
};

export type HealthCheckProjectIssue = {
  projectDocId: string;
  projectid: number | null;
  projectname: string;
  template: boolean;
  href: string;
  missingObjects: HealthCheckProjectLineIssue[];
  missingSkus: HealthCheckProjectLineIssue[];
};

export type HealthCheckReport = {
  generatedAt: string;
  deepScan: boolean;
  quoteObjectCount: number;
  skuCount: number;
  scopesScanned: number;
  areaObjectsScanned: number;
  projectsScanned: number;
  linesScanned: number;
  scopes: HealthCheckScopeIssue[];
  areaObjects: HealthCheckAreaObjectIssue[];
  projects: HealthCheckProjectIssue[];
};

export type HealthCheckDeepPhase =
  | "catalog"
  | "skus"
  | "projects"
  | "lines"
  | "scanning"
  | "done"
  | "error";

export type HealthCheckDeepProgress = {
  phase: HealthCheckDeepPhase;
  message: string;
  percent: number;
  report?: HealthCheckReport;
  error?: string;
};
