import unittest
from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient

from app.database import User
from app.main import app, get_current_user


class MarketFiltersAndAdminToolsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.data = pd.DataFrame(
            {
                "Address": ["First street", "Second street", "=1+1"],
                "Area": [40, 80, 120],
                "Price": [2.0, 5.0, 10.0],
                "Floors": [1, 2, 3],
            }
        )

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_market_filters_restrict_every_aggregate_to_matching_properties(self) -> None:
        with patch("app.main.load_dataset", return_value=self.data):
            response = self.client.get(
                "/api/stats/market",
                params={"min_area": 50, "max_price": 6},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(
            result["average_by_area"],
            [{"name": "50–80 m²", "price_billion": 5.0}],
        )
        self.assertEqual(result["average_by_floors"], [{"name": "2 tầng", "price_billion": 5.0}])
        self.assertEqual(sum(item["count"] for item in result["price_distribution"]), 1)

    def test_map_search_and_numeric_filters_return_only_matching_addresses(self) -> None:
        with patch("app.main.load_dataset", return_value=self.data):
            response = self.client.get(
                "/api/map/properties",
                params={
                    "search": "second",
                    "min_area": 50,
                    "max_price": 6,
                },
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["total"], 1)
        self.assertEqual([item["address"] for item in result["items"]], ["Second street"])

    def test_market_rejects_reversed_filter_ranges(self) -> None:
        response = self.client.get(
            "/api/stats/market",
            params={"min_area": 100, "max_area": 50},
        )

        self.assertEqual(response.status_code, 422)

    def test_admin_dataset_export_is_protected_and_safe_for_spreadsheet_formulas(self) -> None:
        user = User(
            name="User",
            email="user@example.com",
            password_hash="unused",
            role="user",
        )
        app.dependency_overrides[get_current_user] = lambda: user
        denied = self.client.get("/api/admin/dataset.csv")
        self.assertEqual(denied.status_code, 403)

        admin = User(
            name="Admin",
            email="admin@example.com",
            password_hash="unused",
            role="admin",
        )
        app.dependency_overrides[get_current_user] = lambda: admin

        with patch("app.main.load_dataset", return_value=self.data):
            response = self.client.get("/api/admin/dataset.csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment; filename=", response.headers["content-disposition"])
        self.assertIn("\ufeffAddress,Area,Price,Floors", response.text)
        self.assertIn("'=1+1", response.text)

    def test_map_serializes_missing_area_and_price_as_null(self) -> None:
        incomplete = self.data.copy()
        incomplete.loc[0, "Area"] = float("nan")
        incomplete.loc[0, "Price"] = float("nan")

        with patch("app.main.load_dataset", return_value=incomplete):
            response = self.client.get("/api/map/properties")

        self.assertEqual(response.status_code, 200)
        first = response.json()["items"][0]
        self.assertIsNone(first["area"])
        self.assertIsNone(first["price_billion"])

    def test_public_listing_scanner_routes_are_removed(self) -> None:
        response = self.client.post("/api/admin/scrapes/jobs", json={"urls": []})

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
