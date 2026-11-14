"""Tests for temporal embargoes and spatial holdout isolation."""

from pathlib import Path
import sys
import unittest
import pandas as pd
from test_features import sample_history

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml"))
from train import build_samples


class SplitTests(unittest.TestCase):
    def test_all_100_day_labels_stay_inside_their_split(self):
        frames = []
        for cell in range(6):
            history = sample_history(1500)
            history["cell"] = cell
            history["spatial_split"] = "unseen" if cell == 5 else "known"
            frames.append(history)
        data = build_samples(pd.concat(frames, ignore_index=True))
        train = data[data.split.eq("train")]
        validation = data[data.split.eq("validation")]
        test = data[data.split.eq("test")]
        self.assertLess(train.label_end.max(), validation.issue_date.min())
        self.assertLess(validation.label_end.max(), test.issue_date.min())
        self.assertNotIn(5, set(train.cell) | set(validation.cell))
        self.assertIn(5, set(test.cell))


if __name__ == "__main__":
    unittest.main()
