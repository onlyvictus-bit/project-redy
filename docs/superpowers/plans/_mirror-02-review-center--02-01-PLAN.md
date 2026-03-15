<!-- Generated from .planning/phases/02-review-center/02-01-PLAN.md -->
<!-- Do not edit here; edit the canonical .planning file -->
# Phase 2: Review Center — Implementation Plan

**Goal:** Turn the current dashboard into a true code-review workstation with artifact inspection, patch viewing, findings actions, and approval controls.

**Architecture:** Extract the monolithic `App.tsx` into focused components. Add a `selectedTaskId` / `selectedArtifactId` selection model in Zustand. The center area becomes a two-layer workspace: agent grid on top, task detail panel below. The right rail becomes the review rail with findings, approvals, and handoff actions.

**Tech Stack:** React 19, Zustand 5, xterm.js, TypeScript, Vite, existing IPC contract (no backend changes needed).

## Deliverables

### New Components (8 files)
| File | Responsibility |
|------|---------------|
| `TerminalPane.tsx` | Extracted xterm terminal pane |
| `AgentPanel.tsx` | Single-agent card with terminal + artifact summary |
| `TaskCard.tsx` | Task card with stage badge + promote actions |
| `TaskDetailPanel.tsx` | Full task inspection: summary, steps timeline, agent assignments |
| `ArtifactViewer.tsx` | Tabbed artifact viewer: Overview, Prompt, Patch, Logs, Findings, Commands |
| `DiffViewer.tsx` | Monospace patch/diff viewer with add/remove line highlighting |
| `FindingsPanel.tsx` | Rich findings list with severity badges |
| `HandoffActions.tsx` | Cross-agent handoff buttons (disabled until backend support exists) |

### Modified Files (3 files)
| File | Changes |
|------|---------|
| `App.tsx` | Replace inline components with imports; restructure layout |
| `store.ts` | Add `selectedTaskId`, `selectedArtifactId`, selection actions |
| `styles.css` | Add styles for new components |

### Test Files (4 files)
| File | Coverage |
|------|---------|
| `DiffViewer.test.tsx` | Diff line rendering |
| `ArtifactViewer.test.tsx` | Tab switching |
| `FindingsPanel.test.tsx` | Findings display + disabled handoff |
| `TaskDetailPanel.test.tsx` | Promote actions + artifact selection |

## Execution Chunks

### Chunk 1: Store + Component Extraction
1. Add selection state to Zustand store
2. Extract TerminalPane from App.tsx
3. Extract AgentPanel from App.tsx
4. Extract TaskCard from App.tsx

### Chunk 2: New Review Components
5. Create DiffViewer
6. Create ArtifactViewer (depends on DiffViewer)
7. Create FindingsPanel + HandoffActions
8. Create TaskDetailPanel (depends on ArtifactViewer)

### Chunk 3: Integration + Verification
9. Restructure App.tsx with all new components
10. Final verification and cleanup

## Constraints
- Zero backend changes
- All data sourced from existing `WorkbenchSnapshot`
- `src/shared/types.ts` is the source of truth
