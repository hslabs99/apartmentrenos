# Archived UI components

Components here are **not mounted** in the app. They are kept for reference or one-off recovery.

## `project-areas-panel.tsx`

**Archived:** May 2026  
**Former route:** `/projects/project/areas`  
**Replaced by:** Check List (`/projects/project/checklist`) and Workbench (`/projects/project/workbench`)

The legacy **Project areas** tab was a single-area sidebar UI (Details / Objects / Questions) over the same `projectareas` and `projectareaobjects` data. All runtime editing now uses `ProjectChecklistPanel` (checklist + workbench modes). APIs and Firestore collections are unchanged.

Old bookmarks to `/projects/project/areas` redirect to Workbench.
