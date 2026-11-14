"""Prepare, train, validate, and publish a reproducible local model bundle."""

from pathlib import Path
import argparse
from datetime import datetime, timezone
import json
import shutil
import subprocess
import sys
import time

REPOSITORY = Path(__file__).resolve().parents[1]
DOWNLOAD_SUMMARIES = ("smap-download-summary.json", "merra2_hourly-summary.json", "imerg_final_daily-summary.json", "imerg_late_daily-summary.json")


def main(data_root: Path, work: Path, wait: bool):
    work.mkdir(parents=True, exist_ok=True)
    status_path = work / "pipeline-status.json"
    status = {"started_at": datetime.now(timezone.utc).isoformat(), "state": "waiting_for_data"}
    def save(state: str):
        status["state"] = state
        status["updated_at"] = datetime.now(timezone.utc).isoformat()
        status_path.write_text(json.dumps(status, indent=2))
        print(f"Pipeline: {state}", flush=True)
    previous = None
    while True:
        missing = [name for name in DOWNLOAD_SUMMARIES if not (data_root / name).exists()]
        if not missing:
            for name in DOWNLOAD_SUMMARIES:
                summary = json.loads((data_root / name).read_text())
                if summary["failed"] or summary["successful"] != summary["planned"]:
                    raise RuntimeError(f"Incomplete download: {name}")
            break
        if not wait:
            raise RuntimeError(f"Download summaries not available: {missing}")
        if missing != previous:
            status["waiting_for"] = missing
            save("waiting_for_data")
            previous = missing
        time.sleep(30)
    staged_artifacts = work / "artifacts"
    staged_reports = work / "reports"
    commands = [
        ("preparing_data", ["ml/prepare_data.py", "--data-root", str(data_root), "--work", str(work)]),
        ("training", ["ml/train.py", "--work", str(work), "--artifacts", str(staged_artifacts), "--reports", str(staged_reports)]),
        ("evaluating_cold_proxy", ["ml/evaluate_cold.py", "--work", str(work), "--artifacts", str(staged_artifacts), "--reports", str(staged_reports)]),
        ("finalizing_metadata", ["ml/finalize.py", "--artifacts", str(staged_artifacts), "--reports", str(staged_reports)]),
        ("rendering_report", ["ml/report.py", "--reports", str(staged_reports)]),
        ("validating", ["ml/validate_artifacts.py", "--artifacts", str(staged_artifacts), "--examples", str(work / "validation")]),
    ]
    try:
        for state, command in commands:
            save(state)
            subprocess.run([sys.executable, *command], cwd=REPOSITORY, check=True)
        save("publishing")
        target = REPOSITORY / "backend/analytics/artifacts"
        target.mkdir(parents=True, exist_ok=True)
        for path in sorted(staged_artifacts.iterdir(), key=lambda item: item.name == "manifest.json"):
            if path.is_file():
                temporary = target / f".{path.name}.tmp"
                shutil.copyfile(path, temporary)
                temporary.replace(target / path.name)
        reports = REPOSITORY / "ml/reports"
        reports.mkdir(parents=True, exist_ok=True)
        for path in staged_reports.iterdir():
            if path.is_file() and path.suffix in (".json", ".md"):
                shutil.copyfile(path, reports / path.name)
        status["model_directory"] = str(target)
        save("completed")
    except Exception as error:
        status["error_type"] = type(error).__name__
        save("failed")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    main(args.data_root.resolve(), args.work.resolve(), args.wait)
