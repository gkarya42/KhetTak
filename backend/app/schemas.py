import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


QuestionType = Literal["text", "phone", "textarea", "boolean", "line_items"]


class QuestionBase(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    type: QuestionType
    required: bool = False
    order: int = 0
    config: dict[str, Any] = Field(default_factory=dict)


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    type: QuestionType | None = None
    required: bool | None = None
    order: int | None = None
    config: dict[str, Any] | None = None


class QuestionOut(QuestionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class FormOut(BaseModel):
    questions: list[QuestionOut]


class SubmissionCreate(BaseModel):
    answers: dict[str, Any]


class SubmissionOut(BaseModel):
    id: uuid.UUID
    answers: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

