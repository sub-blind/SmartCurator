from app.core.config import Settings


def _base_kwargs():
    return {
        "DATABASE_URL": "postgresql+psycopg2://postgres:postgres@localhost:5432/smartcurator",
        "SECRET_KEY": "test-secret",
        "OPENAI_API_KEY": "test-key",
    }


def test_allowed_origins_from_json_string():
    settings = Settings(
        **_base_kwargs(),
        ALLOWED_ORIGINS='["http://localhost:3000","https://demo.vercel.app"]',
    )
    assert settings.ALLOWED_ORIGINS == [
        "http://localhost:3000",
        "https://demo.vercel.app",
    ]


def test_allowed_origins_from_comma_separated_string():
    settings = Settings(
        **_base_kwargs(),
        ALLOWED_ORIGINS="http://localhost:3000, https://demo.vercel.app",
    )
    assert settings.ALLOWED_ORIGINS == [
        "http://localhost:3000",
        "https://demo.vercel.app",
    ]
