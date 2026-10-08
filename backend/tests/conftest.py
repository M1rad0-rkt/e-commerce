import os

# Variables posées AVANT l'import de l'application (elles priment sur un éventuel .env).
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "cle-de-test-uniquement-0123456789-abcdefghij"
os.environ["PASSWORD_HASH_ITERATIONS"] = "1000"
os.environ["LOG_RESET_LINKS"] = "false"
os.environ["SEED_ADMIN_PASSWORD"] = "AdminPass123"
os.environ["SEED_DEMO_PASSWORD"] = "DemoPass123"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.dependencies import get_db  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = ("admin@example.com", "AdminPass123")
DEMO = ("demo@example.com", "DemoPass123")


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        seed(db)
    yield factory
    engine.dispose()


@pytest.fixture()
def client(session_factory):
    def override():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def admin_h(client):
    return login(client, *ADMIN)


@pytest.fixture()
def demo_h(client):
    return login(client, *DEMO)
