# Training round 3 on Kaggle

The comic text finder trains on Kaggle's free GPUs (about 30 GPU hours a week; the plan's budget is about 60 in all).
Claude prepares the data and the notebook; **the owner signs in, uploads and runs** (Claude never signs in to Kaggle or
keeps keys in the repo; the API token lives in `training/.env`, which git ignores).

The dataset holds publishers' pages, so it is **private** and never shared or made public.

## 1. Build and upload the private dataset (laptop)

From `training/`, after `python comic_split3.py`:

```
python kaggle/make_dataset.py ../../kaggle-comic3 <your kaggle username>
kaggle datasets create -p ../../kaggle-comic3 --dir-mode zip
```

After the data changes: `kaggle datasets version -p ../../kaggle-comic3 --dir-mode zip -m "what changed"`.

## 2. Run the notebook (kaggle.com)

1. New notebook. **Add input**: your dataset `comic-finder-round-3`.
2. Settings: **Accelerator: GPU T4 x2** (not P100: the pinned torch build doesn't run on it), **Internet: on** (the
   first run downloads D-FINE and its backbone weights; Kaggle asks for phone verification once), Persistence: files.
3. Paste `training/kaggle/comic_train_notebook.py` into one cell. Set `SIZE` (`m` or `l` for the short trials, about
   3 hours each; then the chosen size for the full run) and `EPOCHS`.
4. **Save Version → Save & Run All (Commit)**: it runs in the background up to 12 hours, and checkpoints
   (`runs/<run>/last.pth`, `best_stg*.pth`) are kept as the version's output.

## 3. When a run stops (12-hour limit or weekly hours used up)

- **Continue on Kaggle:** add the stopped version's output as an input, set `RESUME_FROM` to its `runs/<run>` folder,
  save and run again. It continues from the last finished epoch with the same settings.
- **Continue on the laptop:** download the output (`kaggle kernels output <you>/<notebook> -p runs/comic/`), then from
  `training/`: `python comic_train.py dfine <run> --data comic3 --resume`. The config is rewritten for the laptop's
  folders with the same settings (`settings.json`), and the same pinned versions are installed in `comictrain`.
- D-FINE saves `last.pth` after every epoch except the last 8 (its no-augmentation finishing stage). A run stopped in
  those 8 epochs resumes from just before them and redoes them (about a fifth of a 40-epoch run); its best checkpoint
  so far (`best_stg1.pth`) is kept either way.
