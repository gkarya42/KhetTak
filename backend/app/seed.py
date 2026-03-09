from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Question


DEFAULT_QUESTIONS: list[dict] = [
    {
        "key": "customer_name",
        "label": "Customer name",
        "type": "text",
        "required": True,
        "order": 10,
        "config": {"placeholder": "Full name"},
    },
    {
        "key": "customer_phone",
        "label": "Customer contact number",
        "type": "phone",
        "required": True,
        "order": 20,
        "config": {"placeholder": "10-digit phone number"},
    },
    {
        "key": "customer_village",
        "label": "Customer village / address",
        "type": "textarea",
        "required": True,
        "order": 30,
        "config": {"placeholder": "Village, tehsil, district"},
    },
    {
        "key": "products",
        "label": "Product needs to buy",
        "type": "line_items",
        "required": True,
        "order": 40,
        "config": {
            "item_label": "Product",
            "fields": [
                {"key": "name", "label": "Product name", "type": "text", "required": True},
                {"key": "quantity", "label": "Quantity", "type": "text", "required": True},
                {
                    "key": "can_fulfill",
                    "label": "Can we fulfill this item?",
                    "type": "boolean",
                    "required": True,
                    "config": {"true_label": "Yes", "false_label": "No"},
                },
            ],
        },
    },
]


def seed_defaults(db: Session) -> None:
    # Upsert-like behavior for the known default keys so we can evolve the default form over time.
    existing = {q.key: q for q in db.scalars(select(Question)).all()}

    for q in DEFAULT_QUESTIONS:
        cur = existing.get(q["key"])
        if not cur:
            db.add(Question(**q))
            continue
        cur.label = q["label"]
        cur.type = q["type"]
        cur.required = q["required"]
        cur.order = q["order"]
        cur.config = q["config"]

    # Remove the old global fulfill question if it exists (fulfill is now per product item).
    legacy = existing.get("can_fulfill")
    if legacy:
        db.delete(legacy)

    db.commit()

