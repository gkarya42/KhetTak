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
    order_id: str | None = None
    answers: dict[str, Any]
    created_at: datetime
    total_amount: float | None = None

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str
    default_mrp: float = 0.0
    default_selling_price: float = 0.0
    order: int = 0
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    default_mrp: float | None = None
    default_selling_price: float | None = None
    order: int | None = None
    active: bool | None = None


class ProductOut(ProductBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

