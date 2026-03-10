from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Question

PRODUCT_OPTIONS = ["Corn Seeds", "Potato Seeds", "Pesticides"]

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
        "key": "state",
        "label": "State",
        "type": "text",
        "required": True,
        "order": 25,
        "config": {"placeholder": "State"},
    },
    {
        "key": "district",
        "label": "District",
        "type": "text",
        "required": True,
        "order": 26,
        "config": {"placeholder": "District"},
    },
    {
        "key": "city",
        "label": "City",
        "type": "text",
        "required": True,
        "order": 27,
        "config": {"placeholder": "City"},
    },
    {
        "key": "village",
        "label": "Village",
        "type": "text",
        "required": True,
        "order": 30,
        "config": {"placeholder": "Village"},
    },
    {
        "key": "products",
        "label": "Products to buy",
        "type": "line_items",
        "required": True,
        "order": 40,
        "config": {
            "item_label": "Product",
            "product_options": PRODUCT_OPTIONS,
            "fields": [
                {"key": "product", "label": "Product", "type": "select", "options": PRODUCT_OPTIONS, "required": True},
                {"key": "quantity", "label": "Quantity", "type": "text", "required": True},
                {"key": "mrp", "label": "MRP", "type": "number", "required": True},
                {"key": "selling_price", "label": "Selling price", "type": "number", "required": True},
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

    # Remove legacy questions replaced by new form
    for key in ("can_fulfill", "customer_village"):
        legacy = existing.get(key)
        if legacy:
            db.delete(legacy)

    db.commit()


def ensure_order_id_column(engine):  # noqa: ANN001
    """Add order_id column to submissions if missing (e.g. existing DB)."""
    from sqlalchemy import inspect
    insp = inspect(engine)
    if "submissions" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("submissions")]
    if "order_id" in cols:
        return
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE submissions ADD COLUMN order_id VARCHAR(20) UNIQUE"))
        conn.commit()

