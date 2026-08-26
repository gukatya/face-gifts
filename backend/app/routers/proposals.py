from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Proposal, ProposalMessage

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


class MessageCreate(BaseModel):
    author_label: str
    text: str


class MessageOut(BaseModel):
    id: int
    proposal_id: int
    author_label: str
    text: str
    created_at: datetime

    class Config:
        from_attributes = True


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
    messages_count: int = 0

    class Config:
        from_attributes = True


def _to_out(p: Proposal) -> ProposalOut:
    d = ProposalOut.model_validate(p)
    d.messages_count = len(p.messages) if p.messages else 0
    return d


@router.get("/", response_model=list[ProposalOut])
def list_proposals(db: Session = Depends(get_db)):
    proposals = db.query(Proposal).order_by(Proposal.created_at.desc()).all()
    return [_to_out(p) for p in proposals]


@router.get("/stats")
def proposal_stats(db: Session = Depends(get_db)):
    new_count = db.query(Proposal).filter(Proposal.status.in_(["new", "chat"])).count()
    return {"new_count": new_count}


@router.post("/", response_model=ProposalOut, status_code=201)
def create_proposal(payload: ProposalCreate, db: Session = Depends(get_db)):
    p = Proposal(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(proposal_id: int, payload: ProposalCreate, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_out(p)


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
    return _to_out(p)


@router.get("/{proposal_id}/messages", response_model=list[MessageOut])
def list_messages(proposal_id: int, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    return p.messages


@router.post("/{proposal_id}/messages", response_model=MessageOut, status_code=201)
def send_message(proposal_id: int, payload: MessageCreate, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    msg = ProposalMessage(
        proposal_id=proposal_id,
        author_label=payload.author_label,
        text=payload.text.strip(),
    )
    db.add(msg)
    # Если заявка ещё "new" → переходит в "chat" (в переписке)
    if p.status == "new":
        p.status = "chat"
    db.commit()
    db.refresh(msg)
    return msg


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(proposal_id: int, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(p)
    db.commit()
