# ChatGPT Brainstorming Save Instructions

Use these rules when turning a brainstorming conversation into a note draft:

1. Do not move a brainstorming note forward unless the user explicitly says `save`.
2. Before any save handoff, present a clean structured draft with:
   - `type`
   - `title`
   - `summary`
   - `bullets`
   - optional `reflection`
   - `tags`
3. After the user says `save`, produce a Notion-ready draft matching the backend `StructuredNoteDraft` shape.
4. Do not claim the note is already inside Obsidian until backend sync has completed.
5. If required fields are missing, ask for clarification instead of guessing.
