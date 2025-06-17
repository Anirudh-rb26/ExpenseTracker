from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import enum
from collections import defaultdict

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./expense_tracker.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enums
class SplitType(str, enum.Enum):
    EQUAL = "equal"
    PERCENTAGE = "percentage"

# SQLAlchemy Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    
    # Relationships
    group_memberships = relationship("GroupMember", back_populates="user")
    expenses_paid = relationship("Expense", back_populates="paid_by_user")
    expense_splits = relationship("ExpenseSplit", back_populates="user")

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    members = relationship("GroupMember", back_populates="group")
    expenses = relationship("Expense", back_populates="group")

class GroupMember(Base):
    __tablename__ = "group_members"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=func.now())
    
    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")

class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    amount = Column(Float)
    group_id = Column(Integer, ForeignKey("groups.id"))
    paid_by = Column(Integer, ForeignKey("users.id"))
    split_type = Column(Enum(SplitType))
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    group = relationship("Group", back_populates="expenses")
    paid_by_user = relationship("User", back_populates="expenses_paid")
    splits = relationship("ExpenseSplit", back_populates="expense")

class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    percentage = Column(Float, nullable=True)
    
    # Relationships
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User", back_populates="expense_splits")

# Create tables
Base.metadata.create_all(bind=engine)

# Ensure default users exist
def ensure_default_users():
    db = SessionLocal()
    try:
        # Default users with exact IDs used by frontend
        default_users = [
            {"id": 1001, "name": "You", "email": "you@example.com"},
            {"id": 1002, "name": "Alice Johnson", "email": "alice@example.com"},
            {"id": 1003, "name": "Bob Smith", "email": "bob@example.com"},
            {"id": 1004, "name": "Charlie Brown", "email": "charlie@example.com"},
            {"id": 1005, "name": "David Wilson", "email": "david@example.com"},
            {"id": 1006, "name": "Eve Davis", "email": "eve@example.com"},
            {"id": 1007, "name": "Frank Miller", "email": "frank@example.com"},
            {"id": 1008, "name": "Grace Lee", "email": "grace@example.com"},
        ]
        
        for user_data in default_users:
            existing_user = db.query(User).filter(User.id == user_data["id"]).first()
            if not existing_user:
                user = User(**user_data)
                db.add(user)
                print(f"Created user: {user_data['name']} (ID: {user_data['id']})")
        
        db.commit()
        print("Default users ensured in database")
    except Exception as e:
        print(f"Error ensuring default users: {e}")
        db.rollback()
    finally:
        db.close()

# Call this function to ensure default users exist
ensure_default_users()

# Pydantic Models
class UserCreate(BaseModel):
    name: str
    email: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    
    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    user_ids: List[int]

class GroupResponse(BaseModel):
    id: int
    name: str
    users: List[UserResponse]
    total_expenses: float
    
    class Config:
        from_attributes = True

class ExpenseSplitCreate(BaseModel):
    user_id: int
    percentage: Optional[float] = None

class ExpenseCreate(BaseModel):
    description: str
    amount: float = Field(..., gt=0)
    paid_by: int
    split_type: SplitType
    splits: List[ExpenseSplitCreate]

class ExpenseResponse(BaseModel):
    id: int
    description: str
    amount: float
    paid_by: int
    split_type: SplitType
    created_at: datetime
    
    class Config:
        from_attributes = True

class BalanceResponse(BaseModel):
    user_id: int
    user_name: str
    owes: Dict[int, float]  # user_id -> amount
    owed_by: Dict[int, float]  # user_id -> amount
    net_balance: float

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# FastAPI app
app = FastAPI(title="Expense Splitting API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to create users if they don't exist
@app.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = User(name=user.name, email=user.email)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

# Group Management
@app.post("/groups", response_model=GroupResponse)
def create_group(group: GroupCreate, db: Session = Depends(get_db)):
    print(f"🏗️ Creating group: {group.name} with users: {group.user_ids}")
    
    # Validate all user IDs exist
    users = db.query(User).filter(User.id.in_(group.user_ids)).all()
    if len(users) != len(group.user_ids):
        print(f"❌ User validation failed: requested {len(group.user_ids)} users, found {len(users)}")
        raise HTTPException(status_code=404, detail="One or more users not found")
    
    print(f"✅ User validation passed: found {len(users)} users")
    
    # Create group
    db_group = Group(name=group.name)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    print(f"✅ Created group with ID: {db_group.id}")
    
    # Add members
    for user_id in group.user_ids:
        membership = GroupMember(group_id=db_group.id, user_id=user_id)
        db.add(membership)
        print(f"➕ Added user {user_id} to group {db_group.id}")
    
    db.commit()
    print(f"✅ Group members added successfully")
    
    # Return group with users and total expenses
    result = get_group_details(db_group.id, db)
    print(f"✅ Returning group details: {result}")
    return result

@app.get("/groups/{group_id}", response_model=GroupResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    return get_group_details(group_id, db)

@app.get("/groups", response_model=List[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).all()
    return [get_group_details(group.id, db) for group in groups]

def get_group_details(group_id: int, db: Session):
    print(f"🔍 Getting details for group {group_id}")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        print(f"❌ Group {group_id} not found")
        raise HTTPException(status_code=404, detail="Group not found")
    
    print(f"✅ Found group: {group.name}")
    
    # Get users in group
    users = db.query(User).join(GroupMember).filter(GroupMember.group_id == group_id).all()
    print(f"✅ Found {len(users)} users in group: {[u.name for u in users]}")
    
    # Calculate total expenses
    total_expenses = db.query(func.sum(Expense.amount)).filter(Expense.group_id == group_id).scalar() or 0
    print(f"✅ Total expenses for group: ${total_expenses}")
    
    result = GroupResponse(
        id=group.id,
        name=group.name,
        users=users,
        total_expenses=total_expenses
    )
    print(f"✅ Returning group details: {result}")
    return result

# Expense Management
@app.post("/groups/{group_id}/expenses", response_model=ExpenseResponse)
def add_expense(group_id: int, expense: ExpenseCreate, db: Session = Depends(get_db)):
    # Validate group exists
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Validate paid_by user is in group
    paid_by_user = db.query(User).join(GroupMember).filter(
        GroupMember.group_id == group_id,
        User.id == expense.paid_by
    ).first()
    if not paid_by_user:
        raise HTTPException(status_code=400, detail="Paid by user not in group")
    
    # Validate splits
    if expense.split_type == SplitType.PERCENTAGE:
        total_percentage = sum(split.percentage or 0 for split in expense.splits)
        if abs(total_percentage - 100) > 0.01:
            raise HTTPException(status_code=400, detail="Percentages must sum to 100")
    
    # Create expense
    db_expense = Expense(
        description=expense.description,
        amount=expense.amount,
        group_id=group_id,
        paid_by=expense.paid_by,
        split_type=expense.split_type
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # Create splits
    if expense.split_type == SplitType.EQUAL:
        # Equal split among ALL group members (including the payer)
        members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
        split_amount = expense.amount / len(members)
        
        print(f"🔍 Creating equal splits for expense ${expense.amount} among {len(members)} members (including payer)")
        print(f"🔍 Split amount per person: ${split_amount}")
        
        for member in members:
            split = ExpenseSplit(
                expense_id=db_expense.id,
                user_id=member.user_id,
                amount=split_amount
            )
            db.add(split)
            print(f"🔍 Added split: User {member.user_id} owes ${split_amount}")
    else:  # PERCENTAGE
        print(f"🔍 Creating percentage splits for expense ${expense.amount}")
        for split_data in expense.splits:
            split_amount = expense.amount * (split_data.percentage / 100)
            split = ExpenseSplit(
                expense_id=db_expense.id,
                user_id=split_data.user_id,
                amount=split_amount,
                percentage=split_data.percentage
            )
            db.add(split)
            print(f"🔍 Added split: User {split_data.user_id} owes ${split_amount} ({split_data.percentage}%)")
    
    db.commit()
    return db_expense

@app.get("/groups/{group_id}/expenses", response_model=List[ExpenseResponse])
def get_group_expenses(group_id: int, db: Session = Depends(get_db)):
    # Validate group exists
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()
    return expenses

# Balance Tracking
@app.get("/groups/{group_id}/balances")
def get_group_balances(group_id: int, db: Session = Depends(get_db)):
    # Validate group exists
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return calculate_group_balances(group_id, db)

@app.get("/users/{user_id}/balances")
def get_user_balances(user_id: int, db: Session = Depends(get_db)):
    # Validate user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all groups user is part of
    user_groups = db.query(GroupMember.group_id).filter(GroupMember.user_id == user_id).all()
    group_ids = [g.group_id for g in user_groups]
    
    all_balances = []
    for group_id in group_ids:
        group_balances = calculate_group_balances(group_id, db)
        user_balance = next((b for b in group_balances if b["user_id"] == user_id), None)
        if user_balance:
            user_balance["group_id"] = group_id
            all_balances.append(user_balance)
    
    return all_balances

def calculate_group_balances(group_id: int, db: Session):
    print(f"🔍 Calculating balances for group {group_id}")
    
    # Get all expenses for the group (separate from splits to avoid duplicates)
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()
    
    # Get all splits for the group
    splits = db.query(ExpenseSplit).join(Expense).filter(Expense.group_id == group_id).all()
    
    print(f"🔍 Found {len(expenses)} expenses and {len(splits)} splits for group {group_id}")
    
    # Calculate how much each user paid (from expenses)
    user_paid = defaultdict(float)
    for expense in expenses:
        user_paid[expense.paid_by] += expense.amount
        print(f"🔍 User {expense.paid_by} paid ${expense.amount} for expense '{expense.description}'")
    
    # Calculate how much each user owes (from splits)
    user_owes = defaultdict(float)
    for split in splits:
        user_owes[split.user_id] += split.amount
        print(f"🔍 User {split.user_id} owes ${split.amount} from expense {split.expense_id}")
    
    # Get all users in group
    users = db.query(User).join(GroupMember).filter(GroupMember.group_id == group_id).all()
    print(f"🔍 Found {len(users)} users in group {group_id}: {[u.name for u in users]}")
    
    # Calculate net balances for all users
    user_net_balances = {}
    for user in users:
        paid = user_paid[user.id]
        owes = user_owes[user.id]
        net_balance = paid - owes
        user_net_balances[user.id] = net_balance
        print(f"🔍 User {user.name}: paid=${paid}, owes=${owes}, net=${net_balance}")
    
    # Prepare lists for settlement algorithm
    creditors = []  # Users with positive net balance (owed money)
    debtors = []    # Users with negative net balance (owe money)
    
    for user_id, net in user_net_balances.items():
        if round(net, 2) > 0:
            creditors.append([user_id, round(net, 2)])
        elif round(net, 2) < 0:
            debtors.append([user_id, round(net, 2)])
    
    print(f"🔍 Creditors: {creditors}")
    print(f"🔍 Debtors: {debtors}")
    
    # Initialize settlements for all users
    settlements = {user.id: {"owes": {}, "owed_by": {}} for user in users}
    
    # Settle debts using a proper algorithm
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debtor_amt = debtors[i]
        creditor_id, creditor_amt = creditors[j]
        
        # Calculate settlement amount
        settle_amt = min(-debtor_amt, creditor_amt)
        
        # Record the settlement
        settlements[debtor_id]["owes"][creditor_id] = settle_amt
        settlements[creditor_id]["owed_by"][debtor_id] = settle_amt
        
        # Update remaining amounts
        debtors[i][1] += settle_amt
        creditors[j][1] -= settle_amt
        
        print(f"🔍 Settlement: User {debtor_id} pays User {creditor_id} ${settle_amt}")
        print(f"🔍 Remaining: Debtor {debtor_id} owes ${debtors[i][1]}, Creditor {creditor_id} is owed ${creditors[j][1]}")
        
        # Move to next debtor/creditor if fully settled
        if abs(debtors[i][1]) < 0.01:  # Use small epsilon for floating point comparison
            i += 1
        if abs(creditors[j][1]) < 0.01:
            j += 1
    
    # Build final balance output
    balances = []
    for user in users:
        net_balance = user_net_balances[user.id]
        balances.append({
            "user_id": user.id,
            "user_name": user.name,
            "owes": settlements[user.id]["owes"],
            "owed_by": settlements[user.id]["owed_by"],
            "net_balance": round(net_balance, 2)
        })
        print(f"🔍 Final balance for {user.name}: {balances[-1]}")
    
    print(f"🔍 Returning {len(balances)} balance entries for group {group_id}")
    return balances

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)