"""Attach held-out quality metadata and packaged source hashes to trained artifacts."""

from pathlib import Path
import argparse
import hashlib
import json
import sys

REPOSITORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY / "backend"))
from analytics.quality import evaluate_metrics


def main(artifacts: Path, reports: Path):
    path = artifacts / "manifest.json"
    manifest = json.loads(path.read_text())
    metrics = json.loads((reports / "metrics.json").read_text())
    manifest["quality"] = evaluate_metrics(metrics)
    manifest["operational_ready"] = False
    files = [*sorted((REPOSITORY / "backend/analytics").glob("*.py")), *sorted((REPOSITORY / "ml").glob("*.py"))]
    manifest["packaged_code_sha256"] = {str(source.relative_to(REPOSITORY)): hashlib.sha256(source.read_bytes()).hexdigest() for source in files}
    manifest["evaluation_sha256"] = hashlib.sha256((reports / "metrics.json").read_bytes()).hexdigest()
    path.write_text(json.dumps(manifest, indent=2, allow_nan=False))
    print("Attached held-out quality metadata and packaged source hashes", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", type=Path, default=REPOSITORY / "backend/analytics/artifacts")
    parser.add_argument("--reports", type=Path, default=REPOSITORY / "ml/reports")
    arguments = parser.parse_args()
    main(arguments.artifacts, arguments.reports)
