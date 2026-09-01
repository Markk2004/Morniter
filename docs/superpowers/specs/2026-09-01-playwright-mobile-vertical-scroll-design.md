# Playwright mobile vertical scroll design

## Goal

Make `/monitor/tests` usable on narrow and short screens without changing the bounded desktop workspace.

## Design

- Keep the existing fixed-height, internally scrolling workspace at widths of 900px and above.
- Below 900px, allow the monitor shell and workspace to grow vertically and let the document scroll.
- Keep the three-tab interface and give its selected panel at least 320px of usable height.
- Keep overflow inside the selected Explorer, Code, or Terminal panel when its content exceeds that panel.
- Preserve zero horizontal overflow.

## Acceptance

- At 534x752, the document can scroll vertically when controls exceed the viewport.
- The selected tab panel has a client height of at least 320px.
- The selected panel keeps `overflow-y: auto` and can scroll its content.
- At 900px and wider, the workspace remains bounded to the viewport with no document vertical scroll introduced by this change.

