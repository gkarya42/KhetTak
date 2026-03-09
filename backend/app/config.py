from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    allowed_origins: str = "http://localhost:5173,http://localhost:19006"
    admin_username: str = "admin"
    admin_password: str = "admin123"
    jwt_secret: str = "change_me"
    jwt_exp_minutes: int = 60 * 24 * 30

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()

