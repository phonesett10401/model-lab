# Correcting comic text boxes in Label Studio (owner steps)

Label Studio (Apache-2.0) runs on your own computer; no page goes online. You fix the drafted boxes, then export, and one command turns your work into training labels.

`DATA` below means the folder `training\data\comic` of the checkout that holds the data (today: this worktree, `C:\Ai Models Library Project\.claude\worktrees\friendly-shaw-952d0e\training\data\comic`).

## One-time setup (PowerShell)

```
conda create -y -n comiclabel python=3.12
conda activate comiclabel
pip install label-studio
```

## Each time

```
conda activate comiclabel
$env:LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED = "true"
$env:LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT = "<DATA>"
label-studio start
```

It opens http://localhost:8080. Make an account there the first time (it stays on your computer).

## A project per source

1. Make the drafts (Claude runs this, or you): `python comic_draft.py tasks pepper --from-coco pepper_draft.json --run <run>` (or `blackjack` / `commons` with `--run <run>`). It writes `DATA\labelstudio\<source>_tasks.json`.
2. In Label Studio: **Create project** → name it (e.g. "Comic boxes – Pepper&Carrot").
3. **Labeling setup → Custom template**, paste:

   ```xml
   <View>
     <Image name="image" value="$image" zoom="true"/>
     <RectangleLabels name="label" toName="image">
       <Label value="bubble" background="red"/>
       <Label value="caption" background="green"/>
       <Label value="sfx" background="blue"/>
       <Label value="art-text" background="orange"/>
     </RectangleLabels>
   </View>
   ```
4. **Settings → Cloud storage → Add source storage → Local files**, absolute path `<DATA>\images`, tick "Treat every bucket object as a source file" **off**, Save (don't Sync).
5. **Import** → upload `DATA\labelstudio\<source>_tasks.json`.
6. Open the first task. The drafts show up; fix them:
   - Only **English** gets a box. Japanese sound effects (katakana drawn into Black Jack's art) stay unboxed: the model must learn to find English, and we wouldn't translate those.
   - Every piece of English gets a box: speech **bubble** (the whole bubble), **caption** (narration boxes), **sfx** (sound effects, also the ones painted into the art), **art-text** (signs, labels, notes in the scene).
   - Delete wrong boxes; drag edges to fit.
   - Not a comic page (a cover, an ad, a text-only page)? Press **Skip** — skipped pages are left out.
   - Press **Submit** (or Ctrl+Enter) and go on.
7. When done (or to save progress): **Export → JSON** → save it, then:
   `python comic_draft.py labels <source> <path-to-export.json>` → writes `DATA\<source>_labels.json`, which training uses instead of the drafts.

Roughly a minute a page when the drafts are mostly right.

**Order, if time is short:** first the **test and validation pages** (they decide the report-card numbers; Label Studio can filter by the file name, and `python -c "import comic_common as c; print([p.file for p in c.load_attribution() if p.split != 'train'])"` lists them), then training pages. Untouched training pages keep their drafts.

## Keep the data safe

`training/data`, `training/runs`, `training/incoming` and `training/vendor` are git-ignored and live only in the checkout they were made in. Before this worktree is cleaned up, move those four folders to the main checkout (`C:\Ai Models Library Project\training\`).
