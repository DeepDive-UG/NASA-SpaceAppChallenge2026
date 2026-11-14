import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from api.environment import PILOT_STATIONS, active_alerts, usgs_features, current_fires


class Command(BaseCommand):
    help = "Archive California water observations and official NWS alerts outside the repository."

    def add_arguments(self, parser):
        parser.add_argument("--output", required=True)
        parser.add_argument("--history", action="store_true")
        parser.add_argument("--start", default="2021-11-14")
        parser.add_argument("--end", default="2026-11-13")
        parser.add_argument("--stations", nargs="+", default=list(PILOT_STATIONS))

    def handle(self, *args, **options):
        root = Path(options["output"]).resolve()
        repository = Path(__file__).resolve().parents[4]
        if root == repository or repository in root.parents:
            raise CommandError("Raw environmental data must be stored outside the repository")
        root.mkdir(parents=True, exist_ok=True)
        records = []

        def save(name, data, source):
            path = root / name
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_bytes(payload)
            temporary.replace(path)
            records.append({"file": name, "source": source, "record_count": len(data) if isinstance(data, list) else len(data.get("features", [])), "sha256": hashlib.sha256(payload).hexdigest()})
            self.stdout.write(f"Saved {name}")

        for station in options["stations"]:
            metadata = list(usgs_features("monitoring-locations", id=station))
            if not metadata or metadata[0]["properties"].get("state_code") != "06":
                raise CommandError(f"Station is not a confirmed California location: {station}")
            save(f"{station}-station.json", metadata, "USGS monitoring-locations")
            save(f"{station}-latest.json", list(usgs_features("latest-continuous", monitoring_location_id=station)), "USGS latest-continuous")
            if options["history"]:
                save(f"{station}-daily.json", list(usgs_features("daily", monitoring_location_id=station, parameter_code="00060", statistic_id="00003", time=f'{options["start"]}/{options["end"]}')), "USGS daily mean discharge; local calendar dates")
        save("alerts.json", active_alerts(), "NWS active California water and fire alerts")
        save("fires.json", current_fires(), "NIFC WFIGS current California wildfire incidents")
        save("manifest.json", {"retrieved_at": datetime.now(timezone.utc).isoformat(), "historical_range": [options["start"], options["end"]] if options["history"] else None, "scope": "California pilot stations; not statewide coverage", "files": records.copy()}, "CropTips provenance")
