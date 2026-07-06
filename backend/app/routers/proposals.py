from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Proposal

router = APIRouter(prefix="/proposals", tags=["proposals"])


class ProposalCreate(BaseModel):
    name: str
    date_text: Optional[str] = None
    city: Optional[str] = None
    social_link: Optional[str] = None
    organizer_name: Optional[str] = None
    organizer_contact: Optional[str] = None
    expected_min: Optional[int] = None
    expected_max: Optional[int] = None
    perks: Optional[List[str]] = None
    requirements: Optional[str] = None
    raw_text: Optional[str] = None


class ProposalDecide(BaseModel):
    decision: str          # "approved" | "rejected"
    comment: Optional[str] = None


class ProposalOut(BaseModel):
    id: int
    name: str
    date_text: Optional[str]
    city: Optional[str]
    social_link: Optional[str]
    organizer_name: Optional[str]
    organizer_contact: Optional[str]
    expected_min: Optional[int]
    expected_max: Optional[int]
    perks: Optional[List[str]]
    requirements: Optional[str]
    raw_text: Optional[str]
    status: str
    decision_comment: Optional[str]
    decided_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ProposalOut])
def list_proposals(db: Session = Depends(get_db)):
    return db.query(Proposal).order_by(Proposal.created_at.desc()).all()


@router.get("/stats")
def proposal_stats(db: Session = Depends(get_db)):
    new_count = db.query(Proposal).filter(Proposal.status == "new").count()
    return {"new_count": new_count}


@router.post("/", response_model=ProposalOut, status_code=201)
def create_proposal(payload: ProposalCreate, db: Session = Depends(get_db)):
    p = Proposal(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(proposal_id: int, payload: ProposalCreate, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{proposal_id}/decide", response_model=ProposalOut)
def decide_proposal(proposal_id: int, payload: ProposalDecide, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")
    p.status = payload.decision
    p.decision_comment = payload.comment
    p.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(p)
    db.commit()
