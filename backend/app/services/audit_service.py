from datetime import datetime, timezone
import uuid
from typing import Optional
from app.db import get_patient_db
from app.models_v2 import AuditLogRecord


def log_audit_event(
    actor_id: str,
    actor_role: str,
    action: str,
    target_patient_id: str,
    resource: str,
    details: Optional[str] = None,
) -> AuditLogRecord:
    """Records an audit log entry in the MongoDB audit_logs collection."""
    audit_entry = AuditLogRecord(
        id=f"audit_{uuid.uuid4().hex[:12]}",
        timestamp=datetime.now(timezone.utc).isoformat(),
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        target_patient_id=target_patient_id,
        resource=resource,
        details=details,
    )
    try:
        db = get_patient_db()
        db.audit_logs.insert_one(audit_entry.model_dump())
    except Exception as e:
        print(f"[AuditLog Error] Failed to write audit log: {e}")
    return audit_entry
