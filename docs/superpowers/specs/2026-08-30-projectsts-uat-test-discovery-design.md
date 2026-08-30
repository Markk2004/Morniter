# ProjectSTS UAT Test Discovery Design

## Decision

Morniter will discover tests from the local ProjectSTS workspace through the Windows Local Agent. It will not read Google Sheets at runtime. ProjectSTS owns `test-automation-map.json`, which defines the FN-STS-01 through FN-STS-11 taxonomy, scan roots, explicit mappings, coverage targets, and safe generation recipes.

## Data flow

```text
ProjectSTS manifest + local files
        ↓
Local Agent discovery
        ↓
runner classification + source metadata extraction
        ↓
deterministic UAT matching
        ↓
recipe-backed Playwright generation, if enabled
        ↓
relative-path catalog
        ↓
Morniter Test Explorer
```

Existing files remain the source of truth. Playwright files can be selected and executed. Frontend Node, backend Jest, and backend Jest E2E files appear as read-only coverage references and cannot be sent to the Playwright execution endpoint.

## Safety boundaries

The Agent is the only component allowed to read ProjectSTS or write generated files. Generated output is contained under `frontend/e2e/generated`; manual files cannot be overwritten. The browser receives only relative paths and metadata. Commands are selected from server/Agent allowlists, never supplied as raw browser input. Missing coverage without a recipe is shown as a gap instead of being guessed into executable code.

## Matching

Matching is deterministic and local: explicit manifest path, embedded FN/TC/TS IDs, path tokens, test titles, and keywords. Each file receives one primary FN-STS function so the Explorer does not duplicate rows. Confidence and match method are published for review.

## Generation

Generation is template-based and recipe-backed. A recipe contains a contained output path, route, and allowlisted assertions. Generated files contain trace metadata and are validated with Playwright `--list`. Generation is bounded to one pass and one re-scan per catalog refresh; unchanged idle polls do not rewrite files.

## UI

The Explorer groups by FN-STS function and runner. Playwright and generated Playwright rows have checkboxes. Node/Jest rows show a runner badge and source metadata but no checkbox. Search covers function, title, path, runner, and target ID. Switching projects replaces the catalog and clears stale selections.

## Verification

Unit tests cover manifest validation, containment, discovery, matching, safe generation, and selection filtering. Integration tests cover catalog publication and bounded generation. A real ProjectSTS smoke test verifies the catalog and realtime Terminal output. Production sign-off separately requires installed Chrome/Edge PWA verification.

