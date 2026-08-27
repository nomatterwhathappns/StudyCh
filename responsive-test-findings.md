# Responsive Test Findings

## Initial compact-layout checks

| Viewport | Result | Limitation |
|---|---|---|
| 344×882 | Compact Chat shows one panel; header, Ask Anything composer, and bottom Source/Chat/Watch navigation remain visible. | Sandbox session has no persisted Chat history, so it cannot prove wrapping for the user's real long responses. |
| 430×932 | Same compact structure remains visible without viewport overflow. | Sandbox session has no persisted Chat history, so it cannot prove wrapping for the user's real long responses. |
| 914×412 | Compact Chat keeps the header, Ask Anything composer, and bottom Source/Chat/Watch navigation in the viewport. | Empty Chat state only; long history scroll behavior still requires structural regression plus localhost acceptance testing. |
| 956×440 | Compact Chat keeps the header, Ask Anything composer, and bottom Source/Chat/Watch navigation in the viewport. | Empty Chat state only; long history scroll behavior still requires structural regression plus localhost acceptance testing. |
| 1199×800 | Compact workspace remains in one-panel mode with the switchable bottom navigation visible. | Empty Chat state only. |
| 1200×800 | Desktop workspace switches to the original three separately rounded and resizable panels. | Empty Chat state only. |

The user-provided localhost DevTools screenshots remain the acceptance reference for real Chat history content. Automated regression tests should cover structural width and height contracts at the named viewport sizes.
