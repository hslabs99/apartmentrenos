# Layout rules

Reference this file (or tell Cursor **layout rules**) when changing workbench table layout.

The enforced copy for the AI agent lives in [`.cursor/rules/layout-rules.mdc`](../.cursor/rules/layout-rules.mdc).

## Workbench table — ONLY these changes

- **Table width:** stay `w-full`. Do not use `w-max`.
- **Do not** add compact/overflow classes to other columns.
- **Space gained** from narrower columns goes to the **blank spacer column** on the far right (column 18).
- **Column edits:** change `<colgroup>` widths only unless the task says otherwise.
- **30% reduction:** new width = previous width × 0.7.

## Current column widths

See the table in `.cursor/rules/layout-rules.mdc` (kept in sync with `src/components/project-checklist-panel.tsx`).

## Code constants

- `WB_TABLE_COLS` = 18
- `wbSpacerCol` = spacer `<col>` width
- `wbSpacerCell` = empty `<td>` / `<th>` in spacer column
