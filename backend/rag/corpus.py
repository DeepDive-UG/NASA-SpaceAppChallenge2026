import csv
import hashlib
import io
import json
from pathlib import Path

MISSING = {"", "NA", "N/A", "NULL", "NAN"}
LABELS = {
    "ScientificName": "Scientific name", "COMNAME": "Common names", "FAMNAME": "Botanical family",
    "TOPMN": "Optimal minimum temperature (deg C)", "TOPMX": "Optimal maximum temperature (deg C)",
    "TMIN": "Absolute minimum temperature (deg C; not a frost damage threshold)",
    "TMAX": "Absolute maximum temperature (deg C)",
    "ROPMN": "Optimal minimum annual rainfall (mm/year)", "ROPMX": "Optimal maximum annual rainfall (mm/year)",
    "RMIN": "Absolute minimum annual rainfall (mm/year)", "RMAX": "Absolute maximum annual rainfall (mm/year)",
    "PHOPMN": "Optimal minimum soil pH", "PHOPMX": "Optimal maximum soil pH",
    "PHMIN": "Absolute minimum soil pH", "PHMAX": "Absolute maximum soil pH",
}


def documents(root):
    root = Path(root)
    for path in sorted(root.rglob("*.csv")):
        raw = path.read_bytes()
        try:
            text, encoding = raw.decode("utf-8-sig"), "utf-8-sig"
        except UnicodeDecodeError:
            text, encoding = raw.decode("cp1252"), "cp1252"
        file_hash = hashlib.sha256(raw).hexdigest()
        reader = csv.DictReader(io.StringIO(text))
        line = 2
        for row in reader:
            row_start = line
            line = reader.line_num + 1
            row = {key: value.strip() for key, value in row.items() if key and value and value.strip().upper() not in MISSING}
            if not row:
                continue
            title = row.get("ScientificName") or " · ".join(row.get(key, "") for key in ("Condition", "Feedback", "Replicate") if row.get(key))
            if path.name == "EcoCrop_DB.csv":
                note = "EcoCrop ecological descriptor. Rainfall is an annual total, not irrigation demand or a 100-day total. Missing fields are unknown. Absolute temperature limits do not establish seedling frost survival."
                url = "https://cgiar-climate-data-hub.github.io/catalog/ecocrop/"
            else:
                note = "Experimental research observation, not a field recommendation. Units are only known where stated in the column header. Replicates must not be treated as separate general recommendations."
                url = "https://doi.org/10.5061/dryad.t76hdr8c7" if path.name in {"Effects_of_crop_species_on_soil_functions.csv", "Feedback_Data_for_Dryad.csv"} else None
            fields = [f"{LABELS.get(key, key) if path.name == 'EcoCrop_DB.csv' else key}: {value}" for key, value in row.items()]
            prefix = f"{title}\n{note}\n"
            body = "\n".join(fields)
            for part, start in enumerate(range(0, max(1, len(body)), 1800)):
                aliases = [row.get("ScientificName", ""), *row.get("COMNAME", "").split(",")] if path.name == "EcoCrop_DB.csv" else []
                yield {"id": f"{path.relative_to(root)}:{row_start}:{part}", "title": title, "aliases": [alias.strip().casefold() for alias in aliases if alias.strip()], "text": prefix + body[start:start + 2000], "file": str(path.relative_to(root)), "line": row_start, "url": url, "sha256": file_hash, "encoding": encoding}
    for path in sorted((root / "knowledge").glob("*.json")):
        raw = path.read_bytes()
        source = json.loads(raw)
        for number, section in enumerate(source["sections"]):
            yield {"id": f"{path.relative_to(root)}:{number}", "title": section["title"], "text": section["text"], "file": str(path.relative_to(root)), "line": None, "url": source["url"], "sha256": hashlib.sha256(raw).hexdigest(), "reviewed_on": source["reviewed_on"], "kind": "reviewed_source_summary"}
    for path in sorted((root / "knowledge").rglob("*")):
        if path.suffix not in {".txt", ".md"}:
            continue
        raw = path.read_bytes()
        text = raw.decode("utf-8-sig")
        for number, start in enumerate(range(0, len(text), 1800)):
            yield {"id": f"{path.relative_to(root)}:{number}", "title": path.stem, "text": text[start:start + 2000], "file": str(path.relative_to(root)), "line": text[:start].count("\n") + 1, "url": None, "sha256": hashlib.sha256(raw).hexdigest(), "kind": "local_document"}
