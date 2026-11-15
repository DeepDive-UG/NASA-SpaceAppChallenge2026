from django.core.management.base import BaseCommand, CommandError
from api.demo import ensure_demo


class Command(BaseCommand):
    help = 'Create the fictional California demo account and seed its field and equipment.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Replace only the public demo farm with the repository fixture.')

    def handle(self, *args, **options):
        try:
            user, field = ensure_demo(reset=options['reset'])
        except ValueError as error:
            raise CommandError(str(error)) from error
        self.stdout.write(self.style.SUCCESS(f'Demo account: {user.username}; field revision: {field.revision}'))
