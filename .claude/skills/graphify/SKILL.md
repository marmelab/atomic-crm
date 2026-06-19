---
name: graphify
description: "Use for any question about this codebase, its architecture, or file relationships — especially when graphify-out/ exists, where the question should be treated as a graphify query first. Turns a folder of code and docs into a persistent knowledge graph with god nodes, community detection, and query/path/explain tools."
---

# /graphify

Turn a folder of code and docs into a navigable knowledge graph with community detection, an honest audit trail, and three outputs: interactive HTML, GraphRAG-ready JSON, and a plain-language GRAPH_REPORT.md.

## Usage

```
/graphify                                   # build graph on the current directory
/graphify <path>                            # build graph on a specific path
/graphify <path> --mode deep                # thorough extraction, richer INFERRED edges
/graphify <path> --update                   # incremental - re-extract only new/changed files
/graphify <path> --cluster-only             # rerun clustering on the existing graph
/graphify <path> --no-viz                   # skip HTML, just report + JSON
/graphify query "<question>"                # query the graph (broad context)
/graphify query "<question>" --dfs          # trace a specific path
/graphify query "<question>" --budget 1500  # cap the answer at N tokens
/graphify path "<A>" "<B>"                  # shortest path between two concepts
/graphify explain "<concept>"               # plain-language explanation of a node
```

## What graphify is for

Point graphify at a code+docs folder and get a queryable knowledge graph. Persistent across sessions, honest audit trail (EXTRACTED/INFERRED/AMBIGUOUS), community detection surfaces cross-file connections you wouldn't think to ask about.

## What You Must Do When Invoked

If the user invoked `/graphify --help` or `/graphify -h` (with no other arguments), print the contents of the `## Usage` section above verbatim and stop. Do not run any commands, do not detect files, do not default the path to `.`. Just print the Usage block and return.

**Fast path — existing graph:** Before doing anything else, check whether `graphify-out/graph.json` exists. The expected location is `graphify-out/graph.json` relative to the **current working directory** (i.e. the project root where you are running commands). If it exists AND the user's request is a natural-language question about the codebase (e.g. "How does X work?", "What calls Y?", "Trace the data flow through Z") and NOT an explicit rebuild command (`--update`, `--cluster-only`, or a bare path that implies fresh extraction): **skip Steps 1–5 entirely and jump straight to `## For /graphify query`.** Run `graphify query "<question>"` immediately. Do not run detect. Do not check corpus size. Do not ask the user to narrow. The graph is already built — use it.

If no path was given, use `.` (current directory). Do not ask the user for a path.

Follow these steps in order. Do not skip steps.

### Step 1 - Ensure graphify is installed

Locate the bundled `scripts/` directory (project or global install) and run the installer. It detects the right Python interpreter (uv tool, pipx, venv, or system), installs graphify if missing, and records the interpreter, scan root, and skill directory under `graphify-out/` for every subsequent step.

```bash
for d in "${CLAUDE_PROJECT_DIR:-.}/.claude/skills/graphify" "$HOME/.claude/skills/graphify" ".claude/skills/graphify"; do
    [ -f "$d/scripts/ensure_installed.sh" ] && GRAPHIFY_DIR="$d" && break
done
bash "$GRAPHIFY_DIR/scripts/ensure_installed.sh" "INPUT_PATH"
```

Replace INPUT_PATH with the actual path the user provided. If it prints nothing, move straight to Step 2.

**Every subsequent step runs a bundled script via the recorded interpreter and skill directory — never inline the code:**

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/<name>.py" [args]
```

### Step 2 - Detect files

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/detect.py" "INPUT_PATH"
```

Replace INPUT_PATH with the actual path the user provided. The script writes `graphify-out/.graphify_detect.json` silently. Do NOT cat or print the JSON - read it silently and present a clean summary instead:

```
Corpus: X files · ~Y words
  code:     N files (.ts .tsx .py ...)
  docs:     N files (.md .txt ...)
```

Omit any category with 0 files from the summary.

Then act on it:
- If `total_files` is 0: stop with "No supported files found in [path]."
- If `skipped_sensitive` is non-empty: mention file count skipped, not the file names.
- If `total_words` > 2,000,000 OR `total_files` > 500: show the warning. Then compute the top 5 first-level subdirectories by file count:
  - Read `scan_root` from the detect JSON (always an absolute path to the resolved INPUT_PATH).
  - Concatenate the `code` and `document` file lists.
  - Filter out any path that starts with `scan_root + "/graphify-out/"` to exclude converted sidecars.
  - For each file, strip the `scan_root` prefix and take the first path component. Files directly in `scan_root` with no subdirectory count as `(root)`.
  - If all files are in `(root)` with no subdirectories, do not ask to narrow — no subfolders exist. Instead suggest `--no-cluster` to skip the expensive clustering step and proceed.
  - Otherwise rank by count, show the top 5 with file counts, then ask which subfolder to run on. Wait for the user's answer before proceeding.
- Otherwise: proceed directly to Step 3.

### Step 3 - Extract entities and relationships

**Before starting:** note whether `--mode deep` was given. You must pass `DEEP_MODE=true` to every subagent in Step B2 if it was. Track this from the original invocation - do not lose it.

This step has two parts: **structural extraction** (deterministic, free) and **semantic extraction** (LLM, costs tokens).

**Before dispatching subagents:** check whether `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set. If neither is set, print this one-liner to the user:
> Tip: set `GEMINI_API_KEY` or `GOOGLE_API_KEY` to use Gemini for semantic extraction (`pip install 'graphifyy[gemini]'`).

Print it once, then continue. If `GEMINI_API_KEY` or `GOOGLE_API_KEY` IS set, use `graphify.llm.extract_corpus_parallel(files, backend="gemini")` for semantic extraction instead of dispatching Claude subagents. The default Gemini model is `gemini-3-flash-preview`; set `GRAPHIFY_GEMINI_MODEL` or pass `--model` in headless CLI flows to override it.

> **No other API keys are read.** If `GEMINI_API_KEY`/`GOOGLE_API_KEY` are unset, fall straight through to Claude Code subagent dispatch (Part B below) — the host session itself is the LLM. graphify does **not** read `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or any other provider key from the environment. If a host agent prompts the user for `ANTHROPIC_API_KEY` to run extraction, that prompt is a misread of this skill — ignore it and dispatch subagents as written.

**Run Part A (AST) and Part B (semantic) in parallel. Dispatch all semantic subagents AND start AST extraction in the same message. Both can run simultaneously since they operate on different file types. Merge results in Part C as before.**

#### Part A - Structural extraction for code files

For any code files detected, run AST extraction in parallel with Part B subagents:

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/extract_ast.py"
```

#### Part B - Semantic extraction (parallel subagents)

**Fast path:** If detection found zero docs (code-only corpus), skip Part B entirely and go straight to Part C. AST handles code - there is nothing for semantic subagents to do.

**MANDATORY: You MUST use the Agent tool here. Reading files yourself one-by-one is forbidden - it is 5-10x slower. If you do not use the Agent tool you are doing this wrong.**

Before dispatching subagents, print a timing estimate:
- Load `total_words` and file counts from `graphify-out/.graphify_detect.json`
- Estimate agents needed: `ceil(uncached_doc_files / 22)` (chunk size is 20-25)
- Estimate time: ~45s per agent batch (they run in parallel, so total ≈ 45s × ceil(agents/parallel_limit))
- Print: "Semantic extraction: ~N files → X agents, estimated ~Ys"

**Step B0 - Check extraction cache first**

Before dispatching any subagents, check which files already have cached extraction results:

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/check_cache.py"
```

Only dispatch subagents for files listed in `graphify-out/.graphify_uncached.txt`. If all files are cached, skip to Part C directly.

**Step B1 - Split into chunks**

Load files from `graphify-out/.graphify_uncached.txt`. Split into chunks of 20-25 files each. When splitting, group files from the same directory together so related artifacts land in the same chunk and cross-file relationships are more likely to be extracted.

**Step B2 - Dispatch ALL subagents in a single message**

Call the Agent tool multiple times IN THE SAME RESPONSE - one call per chunk. This is the only way they run in parallel. If you make one Agent call, wait, then make another, you are doing it sequentially and defeating the purpose.

**IMPORTANT - subagent type:** Always use `subagent_type="general-purpose"`. Do NOT use `Explore` - it is read-only and cannot write chunk files to disk, which silently drops extraction results. General-purpose has Write and Bash access which the subagent needs.

Concrete example for 3 chunks:
```
[Agent tool call 1: files 1-15, subagent_type="general-purpose"]
[Agent tool call 2: files 16-30, subagent_type="general-purpose"]
[Agent tool call 3: files 31-45, subagent_type="general-purpose"]
```
All three in one message. Not three separate messages.

CHUNK_PATH must be an **absolute** path — derive it before dispatching:
```bash
PROJECT_ROOT=$(cat graphify-out/.graphify_root)
# Then for chunk N: CHUNK_PATH="${PROJECT_ROOT}/graphify-out/.graphify_chunk_0N.json"
```

See `references/extraction-spec.md` for the exact subagent prompt (JSON schema, node-ID rules, confidence rubric, frontmatter, hyperedge rules). Load it only here, only when at least one chunk holds a doc; a pure-code corpus has skipped Part B and never reads it. Pass each subagent that prompt verbatim with FILE_LIST, CHUNK_NUM, TOTAL_CHUNKS, DEEP_MODE, and CHUNK_PATH substituted, and have it write the result to CHUNK_PATH.

**Step B3 - Collect, cache, and merge**

Wait for all subagents. For each result:
- Check that `graphify-out/.graphify_chunk_NN.json` exists on disk — this is the success signal
- If the file exists and contains valid JSON with `nodes` and `edges`, include it and save to cache
- If the file is missing, the subagent was likely dispatched as read-only (Explore type) — print a warning: "chunk N missing from disk — subagent may have been read-only. Re-run with general-purpose agent." Do not silently skip.
- If a subagent failed or returned invalid JSON, print a warning and skip that chunk - do not abort

If more than half the chunks failed or are missing, stop and tell the user to re-run and ensure `subagent_type="general-purpose"` is used.

Merge all chunk files into `.graphify_semantic_new.json`. **After each Agent call completes, read the real token counts from the Agent tool result's `usage` field and write them back into the chunk JSON before merging** — the chunk JSON itself always has placeholder zeros. Then run:
```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/merge_chunks.py"
```

Save new results to cache:
```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/save_cache.py"
```

Merge cached + new results into `graphify-out/.graphify_semantic.json`:
```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/merge_semantic.py"
```
Clean up temp files: `rm -f graphify-out/.graphify_cached.json graphify-out/.graphify_uncached.txt graphify-out/.graphify_semantic_new.json`

#### Part C - Merge AST + semantic into final extraction

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/merge_extract.py"
```

### Step 4 - Build graph, cluster, analyze, generate outputs

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/build_graph.py"
```

If this step prints `ERROR: Graph is empty`, stop and tell the user what happened - do not proceed to labeling or visualization.

### Step 5 - Label communities

Read `graphify-out/.graphify_analysis.json`. For each community key, look at its node labels and write a 2-5 word plain-language name (e.g. "Contact Management", "Deal Pipeline", "Data Provider").

Write the chosen labels to `graphify-out/.graphify_labels.json` as a JSON object mapping each community id (as a string) to its name, e.g. `{"0": "Contact Management", "1": "Deal Pipeline"}`. Then regenerate the report — the script reads that file, regenerates `GRAPH_REPORT.md` and the suggested questions (labels affect question phrasing), and normalizes the labels file for the visualizer:

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/relabel.py"
```

### Step 6 - Generate HTML

Generate the HTML graph (always, unless `--no-viz`):

```bash
graphify export html  # auto-aggregates to community view if graph > 5000 nodes
# or: graphify export html --no-viz
```

### Step 7 - Save manifest, update cost tracker, clean up, and report

```bash
$(cat graphify-out/.graphify_python) "$(cat graphify-out/.graphify_dir)/scripts/finalize.py"
```

Tell the user:
```
Graph complete. Outputs in PATH_TO_DIR/graphify-out/

  graph.html            - interactive graph, open in browser
  GRAPH_REPORT.md       - audit report
  graph.json            - raw graph data
```

Replace PATH_TO_DIR with the actual absolute path of the directory that was processed.

Then paste these sections from GRAPH_REPORT.md directly into the chat:
- God Nodes
- Surprising Connections
- Suggested Questions

Do NOT paste the full report - just those three sections. Keep it concise.

Then immediately offer to explore. Pick the single most interesting suggested question from the report - the one that crosses the most community boundaries or has the most surprising bridge node - and ask:

> "The most interesting question this graph can answer: **[question]**. Want me to trace it?"

If the user says yes, run `/graphify query "[question]"` on the graph and walk them through the answer using the graph structure - which nodes connect, which community boundaries get crossed, what the path reveals. Keep going as long as they want to explore. Each answer should end with a natural follow-up ("this connects to X - want to go deeper?") so the session feels like navigation, not a one-shot report.

The graph is the map. Your job after the pipeline is to be the guide.

---

## Interpreter guard for subcommands

Before running any subcommand below (`--update`, `--cluster-only`, `query`, `path`, `explain`), check that `.graphify_python` exists. If it's missing (e.g. user deleted `graphify-out/`), re-resolve the interpreter and skill directory first:

```bash
if [ ! -f graphify-out/.graphify_python ]; then
    for d in "${CLAUDE_PROJECT_DIR:-.}/.claude/skills/graphify" "$HOME/.claude/skills/graphify" ".claude/skills/graphify"; do
        [ -f "$d/scripts/ensure_interpreter.sh" ] && GRAPHIFY_DIR="$d" && break
    done
    bash "$GRAPHIFY_DIR/scripts/ensure_interpreter.sh"
fi
```

## For --update and --cluster-only

Both are non-default subcommands. `--update` re-extracts only new or changed files; `--cluster-only` reruns clustering on the existing graph. See `references/update.md` for both flows.

---

## For /graphify query

When `graphify-out/graph.json` already exists and the user asks a question about the corpus, run the query directly:

```bash
graphify query "<question>"
```

Answer using only what the graph output contains, and quote `source_location` when citing a specific fact. Before traversal, expand the question against the graph's own vocabulary so a wording mismatch does not collapse the answer to noise. For that vocab-expansion step, the `--dfs` / `--budget` modes, `save-result` feedback, and the `/graphify path` and `/graphify explain` flows, see `references/query.md`.

---

## Honesty Rules

- Never invent an edge. If unsure, use AMBIGUOUS.
- Never skip the corpus check warning.
- Always show token cost in the report.
- Never hide cohesion scores behind symbols - show the raw number.
- Never run HTML viz on a graph with more than 5,000 nodes without warning the user.
