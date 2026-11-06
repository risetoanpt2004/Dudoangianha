import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import PredictionRecord, User, get_db
from app.main import app, get_current_user


class PredictionHistoryIsolationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        User.__table__.create(self.engine)
        PredictionRecord.__table__.create(self.engine)
        with self.session_factory() as db:
            self.first_user = User(
                name="Người dùng một",
                email="one@example.com",
                password_hash="unused",
            )
            self.second_user = User(
                name="Người dùng hai",
                email="two@example.com",
                password_hash="unused",
            )
            db.add_all([self.first_user, self.second_user])
            db.flush()
            self.first_record = PredictionRecord(
                user_id=self.first_user.id,
                payload={"Area": 60},
                prediction_billion=2.5,
            )
            self.second_record = PredictionRecord(
                user_id=self.second_user.id,
                payload={"Area": 90},
                prediction_billion=4.2,
            )
            db.add_all([self.first_record, self.second_record])
            db.commit()
            self.first_user_id = self.first_user.id
            self.second_user_id = self.second_user.id
            self.second_record_id = self.second_record.id

        self.active_user_id = self.first_user_id

        def override_db():
            with self.session_factory() as db:
                yield db

        def override_user():
            with self.session_factory() as db:
                user = db.get(User, self.active_user_id)
                assert user is not None
                return user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_history_lists_only_the_authenticated_users_records(self) -> None:
        response = self.client.get("/api/history")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["area"], 60)

    def test_switching_accounts_returns_a_separate_history(self) -> None:
        self.active_user_id = self.second_user_id

        response = self.client.get("/api/history")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["area"], 90)

    def test_user_cannot_view_or_delete_another_users_prediction(self) -> None:
        detail = self.client.get(f"/api/history/{self.second_record_id}")
        delete = self.client.delete(f"/api/history/{self.second_record_id}")

        self.assertEqual(detail.status_code, 404)
        self.assertEqual(delete.status_code, 404)

        with self.session_factory() as db:
            self.assertIsNotNone(db.get(PredictionRecord, self.second_record_id))


if __name__ == "__main__":
    unittest.main()
