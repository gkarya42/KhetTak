from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, require_user
from app.config import settings
from app.db import Base, engine, get_db
from app.models import Question, Submission
from app.schemas import (
    FormOut,
    LoginRequest,
    LoginResponse,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    SubmissionCreate,
    SubmissionOut,
)
from app.seed import seed_defaults
from app.validation import ValidationError, validate_answers


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

    for s in submissions:
        a = s.answers or {}

        village = a.get("customer_village")
        if isinstance(village, str) and village.strip():
            key = norm(village).lower()
            village_counts[key] = village_counts.get(key, 0) + 1

        products = a.get("products")
        if isinstance(products, list):
            for item in products:
                if not isinstance(item, dict):
                    continue
                name = item.get("name")
                qty = item.get("quantity")
                item_fulfill = item.get("can_fulfill")
                if item_fulfill is True:
                    fulfill_yes += 1
                elif item_fulfill is False:
                    fulfill_no += 1
                if isinstance(name, str) and name.strip():
                    p = norm(name).lower()
                    q = parse_qty(qty)
                    product_total_qty[p] = product_total_qty.get(p, 0.0) + q
                    if item_fulfill is True:
                        product_fulfilled_qty[p] = product_fulfilled_qty.get(p, 0.0) + q
                    elif item_fulfill is False:
                        product_unfulfilled_qty[p] = product_unfulfilled_qty.get(p, 0.0) + q

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
    with Session(engine) as db:
        seed_defaults(db)


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


@app.post("/api/submissions", response_model=SubmissionOut)
def create_submission(
    payload: SubmissionCreate,
    _user: str = Depends(require_user),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    questions = db.scalars(select(Question).order_by(Question.order.asc(), Question.created_at.asc())).all()
    try:
        validate_answers(questions, payload.answers)
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

    submission = Submission(answers=payload.answers, form_snapshot={"questions": form_snapshot})
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


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


@app.get("/api/admin/submissions", response_model=list[SubmissionOut])
def admin_list_submissions(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> list[SubmissionOut]:
    return db.scalars(select(Submission).order_by(Submission.created_at.desc())).all()


@app.get("/api/admin/analytics")
def admin_analytics(_user: str = Depends(require_user), db: Session = Depends(get_db)) -> dict:
    submissions = db.scalars(select(Submission).order_by(Submission.created_at.desc())).all()
    return _compute_analytics(submissions)

