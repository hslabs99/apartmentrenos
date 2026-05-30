export type TradeSnapshot = { lookupid: number; lookupvalue: string };

export type ProjectAreaAnswerPublic = {
  id: string;
  projectid: number;
  /** Firestore doc id of the parent row in `projectareas`. */
  projectAreaDocId: string;
  areaid: number;
  /** Setup `areasquestions.questionId`. */
  areaQuestionId: number;
  questionTextSnapshot: string;
  applicableTradesSnapshot: TradeSnapshot[];
  answer: string;
  sortOrder?: number | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

