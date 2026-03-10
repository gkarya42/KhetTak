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
            cfg = q.config or {}
            allowed_products = list(cfg.get("product_options") or [])
            if not allowed_products and cfg.get("fields"):
                for f in cfg["fields"]:
                    if isinstance(f, dict) and f.get("key") == "product":
                        allowed_products = list(f.get("options") or [])
                        break
            for idx, item in enumerate(value):
                if not isinstance(item, dict):
                    raise ValidationError(f"Item {idx + 1} in '{q.label}' must be an object")
                product = item.get("product")
                qty = item.get("quantity")
                mrp = item.get("mrp")
                selling_price = item.get("selling_price")
                if _is_missing(product):
                    raise ValidationError(f"Each item in '{q.label}' needs a product")
                if allowed_products and isinstance(product, str) and product.strip() not in allowed_products:
                    raise ValidationError(f"Item {idx + 1}: product must be one of {allowed_products}")
                if _is_missing(qty):
                    raise ValidationError(f"Each item in '{q.label}' needs quantity")
                try:
                    m = float(mrp) if mrp not in (None, "") else float("nan")
                    if (m != m) or m < 0:  # NaN or negative
                        raise ValidationError(f"Each item in '{q.label}' needs MRP (non-negative number)")
                except (TypeError, ValueError):
                    raise ValidationError(f"Each item in '{q.label}' needs MRP (number)")
                try:
                    s = float(selling_price) if selling_price not in (None, "") else float("nan")
                    if (s != s) or s < 0:
                        raise ValidationError(f"Each item in '{q.label}' needs selling price (non-negative number)")
                except (TypeError, ValueError):
                    raise ValidationError(f"Each item in '{q.label}' needs selling price (number)")
                can_fulfill = item.get("can_fulfill")
                if not isinstance(can_fulfill, bool):
                    raise ValidationError(f"Each item in '{q.label}' must include fulfill yes/no")

