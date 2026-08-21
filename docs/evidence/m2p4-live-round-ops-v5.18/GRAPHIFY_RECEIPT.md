# GRAPHIFY_RECEIPT

- Tool: local Graphify
- Current run: AST extraction completed for 1,187 uncached files with 12 workers.
- Limitation: 148 JSON source files produced zero AST nodes; 7 SQL files were skipped because `tree_sitter_sql` is unavailable.
- `cluster-only` result: failed closed with `no graph found at graphify-out\\graph.json`.
- Interpretation: `PARTIAL_AST_EXTRACTION`; this is not claimed as a complete graph pass.
- Temporary `graphify-out` was not committed and was removed after the receipt was captured.
