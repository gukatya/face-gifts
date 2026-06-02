from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MonthlyBudget
from ..schemas import MonthlyBudgetIn, MonthlyBudgetOut

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/", response_model=list[MonthlyBudgetOut])
def list_budgets(db: Session = Depends(get_db)):
    return db.query(MonthlyBudget).order_by(MonthlyBudget.month).all()


@router.put("/{month}", response_model=MonthlyBudgetOut)
def set_budget(month: str, payload: MonthlyBudgetIn, db: Session = Depends(get_db)):
    """Upsert planned budget for a month (format: YYYY-MM)."""
    budget = db.query(MonthlyBudget).filter(MonthlyBudget.month == month).first()
    if budget:
        budget.planned = payload.planned
    else:
        budget = MonthlyBudget(month=month, planned=payload.planned)
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget
