import yaml
from pydantic import BaseModel, Field
from pathlib import Path


def find_project_root(start: Path = Path(__file__).resolve()):
    for parent in [start] + list(start.parents):
        if (parent / "pyproject.toml").exists():
            return parent
    return None


PROJECT_ROOT = find_project_root()


class AppConfig(BaseModel):
    base_url: str = Field(description="app base url")
    user_id: str = Field(description="user id")


class MongodbConfig(BaseModel):
    url: str = Field(description="mongodb_client url")


class Config(BaseModel):
    app: AppConfig
    mongodb: MongodbConfig


def load_config():
    with open(f"{PROJECT_ROOT}/config/env/base.yaml") as base_file:
        base = yaml.safe_load(base_file)
        return Config(**base)
