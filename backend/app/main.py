from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, require_user
from app.config import settings
from app.db import Base, engine, get_db
from app.models import Product, Question, Submission, generate_order_id
from app.schemas import (
    FormOut,
    LoginRequest,
    LoginResponse,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    SubmissionCreate,
    SubmissionOut,
)
from app.seed import ensure_order_id_column, ensure_product_columns, seed_defaults, seed_products
from app.validation import ValidationError, validate_answers


def _order_total_amount(answers: dict) -> float:
    """Sum of (selling_price * fulfilled_quantity) for each product line.

    Falls back to quantity if fulfilled_quantity is missing (legacy data).
    """
    total = 0.0
    products = answers.get("products") or []
    for item in products:
        if not isinstance(item, dict):
            continue
        qty = item.get("fulfilled_quantity", item.get("quantity"))
        sp = item.get("selling_price")
        if sp is not None and qty is not None:
            try:
                q = float(qty) if not isinstance(qty, (int, float)) else float(qty)
                p = float(sp) if not isinstance(sp, (int, float)) else float(sp)
                total += p * q
            except (TypeError, ValueError):
                pass
    return round(total, 2)


def _parse_quantity(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        import re

        m = re.search(r"(-?\d+(?:\.\d+)?)", value)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                return 0.0
        return 0.0
    return 0.0


def _apply_fulfill_quantities(db: Session, answers: dict) -> None:
    """Set fulfilled_quantity, unfulfilled_quantity and fulfillment_status per line item based on stock."""
    products = answers.get("products") or []
    if not isinstance(products, list) or not products:
        return
    # Collect unique product names from answers
    names: set[str] = set()
    for item in products:
        if not isinstance(item, dict):
            continue
        name = item.get("product") or item.get("name")
        if isinstance(name, str) and name.strip():
            names.add(name.strip())
    if not names:
        return
    db_products = db.scalars(select(Product).where(Product.name.in_(list(names)))).all()
    stock_by_name: dict[str, float] = {p.name: float(p.stock or 0) for p in db_products}
    for item in products:
        if not isinstance(item, dict):
            continue
        name = item.get("product") or item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        qty_raw = item.get("quantity")
        requested = _parse_quantity(qty_raw)
        current_stock = stock_by_name.get(name, 0.0)
        fulfilled = min(requested, current_stock) if requested > 0 else 0.0
        unfulfilled = max(requested - fulfilled, 0.0) if requested > 0 else 0.0
        item["fulfilled_quantity"] = fulfilled
        item["unfulfilled_quantity"] = unfulfilled
        # Derive human-readable fulfillment status: Yes | No | Partially
        status: str
        if requested <= 0:
            status = "No"
        elif fulfilled >= requested:
            status = "Yes"
        elif fulfilled <= 0:
            status = "No"
        else:
            status = "Partially"
        item["fulfillment_status"] = status


def _submission_to_out(s: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=s.id,
        order_id=s.order_id,
        answers=s.answers,
        created_at=s.created_at,
        total_amount=_order_total_amount(s.answers or {}),
    )


def _compute_analytics(submissions: list[Submission]) -> dict:
    total = len(submissions)
    fulfill_yes = 0
    fulfill_no = 0
    village_counts: dict[str, int] = {}
    product_total_qty: dict[str, float] = {}
    product_fulfilled_qty: dict[str, float] = {}
    product_unfulfilled_qty: dict[str, float] = {}

    def norm(s: str) -> str:
        return " ".join(s.strip().split())

    def parse_qty(qty: object) -> float:
        if isinstance(qty, (int, float)):
            return float(qty)
        if isinstance(qty, str):
            import re

            m = re.search(r"(-?\d+(?:\.\d+)?)", qty)
            if m:
                try:
                    return float(m.group(1))
                except ValueError:
                    return 1.0
            return 1.0 if qty.strip() else 1.0
        return 1.0

    orders_with_totals = []
    for s in submissions:
        a = s.answers or {}
        orders_with_totals.append({"order_id": s.order_id or "—", "total_amount": _order_total_amount(a)})

        # Address: prefer new fields, fallback to legacy customer_village
        village = a.get("village") or a.get("customer_village")
        if isinstance(village, str) and village.strip():
            key = norm(village).lower()
            village_counts[key] = village_counts.get(key, 0) + 1

        products = a.get("products")
        if isinstance(products, list):
            for item in products:
                if not isinstance(item, dict):
                    continue
                name = item.get("product") or item.get("name")
                requested = item.get("quantity")
                fulfilled = item.get("fulfilled_quantity")
                unfulfilled = item.get("unfulfilled_quantity")
                status = item.get("fulfillment_status")
                if status == "Yes":
                    fulfill_yes += 1
                elif status in {"No", "Partially"}:
                    fulfill_no += 1
                if isinstance(name, str) and name.strip():
                    p = norm(name).lower()
                    total_q = parse_qty(requested)
                    fulfilled_q = parse_qty(fulfilled)
                    unfulfilled_q = parse_qty(unfulfilled)
                    product_total_qty[p] = product_total_qty.get(p, 0.0) + total_q
                    product_fulfilled_qty[p] = product_fulfilled_qty.get(p, 0.0) + fulfilled_q
                    product_unfulfilled_qty[p] = product_unfulfilled_qty.get(p, 0.0) + unfulfilled_q

    top_villages = sorted(village_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_products = sorted(product_total_qty.items(), key=lambda x: x[1], reverse=True)[:10]

    product_fulfillment = []
    for product, total_qty in product_total_qty.items():
        product_fulfillment.append(
            {
                "product": product,
                "fulfilled_qty": round(product_fulfilled_qty.get(product, 0.0), 3),
                "unfulfilled_qty": round(product_unfulfilled_qty.get(product, 0.0), 3),
                "total_qty": round(total_qty, 3),
            }
        )
    product_fulfillment.sort(key=lambda r: r["total_qty"], reverse=True)

    return {
        "total_submissions": total,
        "fulfill_yes": fulfill_yes,
        "fulfill_no": fulfill_no,
        "top_villages": [{"village": v, "count": c} for v, c in top_villages],
        "top_products": [{"product": p, "count": c} for p, c in top_products],
        "product_fulfillment_qty": product_fulfillment,
        "orders_with_totals": orders_with_totals,
    }


app = FastAPI(title="KhetTak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_DIR = "app/web"
app.mount("/web", StaticFiles(directory=WEB_DIR, html=True), name="web")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/web/", status_code=302)

    

@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_order_id_column(engine)
    ensure_product_columns(engine)
    with Session(engine) as db:
        seed_defaults(db)
        seed_products(db)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    if payload.username != settings.admin_username or payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return LoginResponse(access_token=create_access_token(payload.username))


@app.get("/api/form", response_model=FormOut)
def get_form(
    _user: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> FormOut:
    questions = db.scalars(select(Question).order_by(Question.order.asc(), Question.created_at.asc())).all()
    return FormOut(questions=questions)


def _active_product_names(db: Session) -> list[str]:
    return [p.name for p in db.scalars(select(Product).where(Product.active).order_by(Product.name)).all()]


@app.get("/api/products", response_model=list[ProductOut])
def list_products(
    _user: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[ProductOut]:
    """Active products for the capture form dropdown (with default MRP/selling price)."""
    return db.scalars(select(Product).where(Product.active).order_by(Product.name)).all()


@app.post("/api/submissions", response_model=SubmissionOut)
def create_submission(
    payload: SubmissionCreate,
    _user: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    questions = db.scalars(select(Question).order_by(Question.order.asc(), Question.created_at.asc())).all()
    answers = payload.answers or {}
    # Compute fulfilled/unfulfilled quantities and can_fulfill from stock and requested quantity
    _apply_fulfill_quantities(db, answers)
    allowed_products = _active_product_names(db)
    try:
        validate_answers(questions, answers, allowed_product_names=allowed_products)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    form_snapshot = [
        {
            "key": q.key,
            "label": q.label,
            "type": q.type,
            "required": q.required,
            "order": q.order,
            "config": q.config,
        }
        for q in questions
    ]

    # Decrement product stock based on fulfilled quantities in this order
    products = answers.get("products") or []
    qty_by_name: dict[str, float] = {}
    if isinstance(products, list):
        for item in products:
            if not isinstance(item, dict):
                continue
            name = item.get("product") or item.get("name")
            fulfilled = item.get("fulfilled_quantity")
            if isinstance(name, str) and name.strip():
                qty = float(fulfilled) if isinstance(fulfilled, (int, float)) else _parse_quantity(fulfilled)
                if qty > 0:
                    qty_by_name[name] = qty_by_name.get(name, 0.0) + qty
    if qty_by_name:
        db_products = db.scalars(select(Product).where(Product.name.in_(list(qty_by_name.keys())))).all()
        for p in db_products:
            used = qty_by_name.get(p.name, 0.0)
            if used > 0:
                current = p.stock or 0
                new_stock = current - used
                p.stock = int(new_stock) if new_stock > 0 else 0

    submission = Submission(
        order_id=generate_order_id(),
        answers=answers,
        form_snapshot={"questions": form_snapshot},
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _submission_to_out(submission)


# --- Admin endpoints (no auth in v1) ---


@app.get("/api/admin/questions", response_model=list[QuestionOut])
def admin_list_questions(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> list[QuestionOut]:
    return db.scalars(select(Question).order_by(Question.order.asc(), Question.created_at.asc())).all()


@app.post("/api/admin/questions", response_model=QuestionOut)
def admin_create_question(
    payload: QuestionCreate, _user: str = Depends(require_user), db: Session = Depends(get_db)
) -> QuestionOut:
    exists = db.scalar(select(Question).where(Question.key == payload.key))
    if exists:
        raise HTTPException(status_code=409, detail="Question key already exists")
    q = Question(**payload.model_dump())
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@app.put("/api/admin/questions/{question_id}", response_model=QuestionOut)
def admin_update_question(
    question_id: str, payload: QuestionUpdate, _user: str = Depends(require_user), db: Session = Depends(get_db)
) -> QuestionOut:
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(q, k, v)
    db.commit()
    db.refresh(q)
    return q


@app.delete("/api/admin/questions/{question_id}")
def admin_delete_question(question_id: str, _user: str = Depends(require_user), db: Session = Depends(get_db)) -> dict:
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"deleted": True}


@app.get("/api/admin/products", response_model=list[ProductOut])
def admin_list_products(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> list[ProductOut]:
    return db.scalars(select(Product).order_by(Product.name)).all()


@app.post("/api/admin/products", response_model=ProductOut)
def admin_create_product(
    payload: ProductCreate, _user: str = Depends(require_user), db: Session = Depends(get_db)
) -> ProductOut:
    exists = db.scalar(select(Product).where(Product.name == payload.name))
    if exists:
        raise HTTPException(status_code=409, detail="Product name already exists")
    p = Product(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.put("/api/admin/products/{product_id}", response_model=ProductOut)
def admin_update_product(
    product_id: str, payload: ProductUpdate, _user: str = Depends(require_user), db: Session = Depends(get_db)
) -> ProductOut:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@app.delete("/api/admin/products/{product_id}")
def admin_delete_product(product_id: str, _user: str = Depends(require_user), db: Session = Depends(get_db)) -> dict:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()
    return {"deleted": True}


@app.get("/api/admin/submissions", response_model=list[SubmissionOut])
def admin_list_submissions(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> list[SubmissionOut]:
    rows = db.scalars(select(Submission).order_by(Submission.created_at.desc())).all()
    return [_submission_to_out(s) for s in rows]


@app.get("/api/admin/analytics")
def admin_analytics(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> dict:
    submissions = db.scalars(select(Submission).order_by(Submission.created_at.desc())).all()
    return _compute_analytics(submissions)

