"""
Router for analytics-dashboard service
Auto-extracted from main.py for unified gateway registration
"""

from fastapi import APIRouter

router = APIRouter(prefix="/analytics-dashboard", tags=["analytics-dashboard"])

@router.get("/health")
async def health_check(db: Session = Depends(get_db):
    return {"status": "ok"}

@router.post("/token")
async def login_for_access_token(form_data: security.OAuth2PasswordRequestForm = Depends():
    return {"status": "ok"}

@router.post("/user-activities/")
def create_user_activity(
    activity: schemas.UserActivityCreate,
    db: Session = Depends(get_db):
    activity: schemas.UserActivityCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["write"])),

@router.get("/user-activities/")
def read_user_activities(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db):
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.get("/user-activities/{activity_id}")
def read_user_activity(
    activity_id: int, 
    db: Session = Depends(get_db):
    activity_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.post("/transactions/")
def create_transaction(
    transaction: schemas.TransactionCreate, 
    db: Session = Depends(get_db):
    transaction: schemas.TransactionCreate, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["write"])),

@router.get("/transactions/")
def read_transactions(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db):
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.get("/transactions/{transaction_id}")
def read_transaction(
    transaction_id: int, 
    db: Session = Depends(get_db):
    transaction_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.post("/metrics/")
def create_metric(
    metric: schemas.MetricCreate, 
    db: Session = Depends(get_db):
    metric: schemas.MetricCreate, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["write"])),

@router.get("/metrics/")
def read_metrics(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db):
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.get("/metrics/{metric_id}")
def read_metric(
    metric_id: int, 
    db: Session = Depends(get_db):
    metric_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.post("/alerts/")
def create_alert(
    alert: schemas.AlertCreate, 
    db: Session = Depends(get_db):
    alert: schemas.AlertCreate, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["write"])),

@router.get("/alerts/")
def read_alerts(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db):
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

@router.get("/alerts/{alert_id}")
def read_alert(
    alert_id: int, 
    db: Session = Depends(get_db):
    alert_id: int, 
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(security.get_current_active_user),
    api_key: str = Depends(lambda k=Depends(security.get_api_key_with_scopes): k(["read"])),

