from django.test import SimpleTestCase
from .market import financial_rank, market_context, price_catalogue


class MarketTests(SimpleTestCase):
    def test_price_conversion_and_missing_coverage(self):
        data, records = price_catalogue()
        corn = market_context({'name': 'Maize (corn)'}, data, records)
        wheat = market_context({'name': 'Wheat'}, data, records)
        rice = market_context({'name': 'Rice'}, data, records)
        self.assertAlmostEqual(corn['usd_per_tonne'], 175.19, places=2)
        self.assertAlmostEqual(wheat['usd_per_tonne'], 210.17, places=2)
        self.assertAlmostEqual(rice['usd_per_tonne'], 343.92, places=2)
        self.assertTrue(corn['is_example'])
        self.assertEqual(corn['as_of'], '2026-11-13')
        self.assertIsNone(market_context({'name': 'Broccoli'}, data, records))

    def test_high_price_cannot_promote_worse_field_fit(self):
        red = {'status': 'red', 'ranking_score': 1000, 'crop': {'name': 'Rice'}}
        green = {'status': 'green', 'ranking_score': 0, 'crop': {'name': 'Wheat'}}
        self.assertLess(financial_rank(green), financial_rank(red))
