from collections.abc import Iterable
from typing import Any

from app.models import Question


class ValidationError(ValueError):
    pass


def _is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def validate_answers(questions: Iterable[Question], answers: dict[str, Any]) -> None:
    questions_by_key = {q.key: q for q in questions}

    for q in questions_by_key.values():
        if not q.required:
            continue
        if q.key not in answers or _is_missing(answers.get(q.key)):
            raise ValidationError(f"Missing required field: {q.label}")

    # Minimal type checks for the built-in question types
    for q in questions_by_key.values():
        if q.key not in answers:
            continue
        value = answers.get(q.key)

        if q.type == "boolean" and not isinstance(value, bool):
            raise ValidationError(f"Field '{q.label}' must be true/false")

        if q.type == "line_items":
            if not isinstance(value, list) or len(value) == 0:
                raise ValidationError(f"Field '{q.label}' must be a non-empty list")
            for idx, item in enumerate(value):
                if not isinstance(item, dict):
                    raise ValidationError(f"Item {idx + 1} in '{q.label}' must be an object")
                name = item.get("name")
                qty = item.get("quantity")
                if _is_missing(name) or _is_missing(qty):
                    raise ValidationError(f"Each item in '{q.label}' needs product name and quantity")
                can_fulfill = item.get("can_fulfill")
                if not isinstance(can_fulfill, bool):
                    raise ValidationError(f"Each item in '{q.label}' must include fulfill yes/no")

