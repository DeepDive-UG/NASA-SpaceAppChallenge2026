from pathlib import Path
from django.core.management.base import BaseCommand
from rag.engine import INDEX_PATH, build_index


class Command(BaseCommand):
    help = "Build a local, source-attributed retrieval index from the data directory."

    def add_arguments(self, parser):
        parser.add_argument("--data", default=str(Path(__file__).resolve().parents[4] / "data"))
        parser.add_argument("--output", default=str(INDEX_PATH))
        parser.add_argument("--lexical-only", action="store_true")

    def handle(self, *args, **options):
        result = build_index(options["data"], options["output"], options["lexical_only"])
        self.stdout.write(self.style.SUCCESS(f'Indexed {result["documents"]} documents'))
