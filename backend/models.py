from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import enum

DATABASE_URL = "sqlite:///./quests.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class QuestType(str, enum.Enum):
    main = "main"
    side = "side"

class QuestStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    failed = "failed"

class Quest(Base):
    __tablename__ = "quests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    raw_task = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    npc = Column(String(100), nullable=True)
    quest_type = Column(String(20), default="side")
    status = Column(String(20), default="active")
    xp_reward = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Player(Base):
    __tablename__ = "player"
    id = Column(Integer, primary_key=True, default=1)
    name = Column(String(100), default="V")
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    player = db.query(Player).filter(Player.id == 1).first()
    if not player:
        db.add(Player(id=1, name="V", total_xp=0, level=1))
        db.commit()
    db.close()
