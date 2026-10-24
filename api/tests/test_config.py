import os

from api.src import config


def test_project_root_is_repo_root():
    assert (config.PROJECT_ROOT / "api" / "src" / "config.py").is_file()
    assert config.BUILD_DIR == config.PROJECT_ROOT / "build"


def test_env_falls_back_to_backend_env(tmp_path, monkeypatch):
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / ".env").write_text("CENTRO_API_KEY=abc\n", encoding="utf-8")
    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    monkeypatch.delenv("CENTRO_API_KEY", raising=False)

    config.load_local_environment()

    assert os.environ["CENTRO_API_KEY"] == "abc"


def test_api_env_wins_over_backend_env(tmp_path, monkeypatch):
    for folder, value in (("api", "from-api"), ("backend", "from-backend")):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / ".env").write_text(f"CENTRO_API_KEY={value}\n", encoding="utf-8")
    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    monkeypatch.delenv("CENTRO_API_KEY", raising=False)

    config.load_local_environment()

    assert os.environ["CENTRO_API_KEY"] == "from-api"


def test_wsgi_imports():
    import api.src.wsgi as wsgi

    assert wsgi.app is not None
