"""Safety module — inspections, incidents, SOPs."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, MaintenanceWorkOrder, SafetyIncident, SafetyInspection, SopDocument, User
from app.models.enums import MaintenanceWorkOrderStatus
from app.services.pulse_notification_service import PulseNotificationService

_CLOSED_WO = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}

EMERGENCY_CONTACTS = [
    {"name": "Plant Safety Officer", "phone": "+91-98765-43210", "role": "Safety"},
    {"name": "Fire & Emergency", "phone": "101", "role": "Emergency"},
    {"name": "Plant Medical", "phone": "+91-98765-43211", "role": "Medical"},
]


class SafetyService:
    def __init__(self) -> None:
        self._notify = PulseNotificationService()

    async def dashboard(self, session: AsyncSession, plant_id: UUID) -> dict:
        under_maint = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.plant_id == plant_id,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
        )
        assets = await session.execute(select(Asset).where(Asset.plant_id == plant_id))
        unsafe = 0
        expired_certs = 0
        inspection_due = 0
        now = datetime.now(timezone.utc)
        for asset in assets.scalars():
            meta = asset.metadata_ or {}
            certs = meta.get("certificates") or []
            for cert in certs:
                exp = cert.get("expiry")
                if exp:
                    try:
                        exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
                        if exp_dt < now:
                            expired_certs += 1
                    except ValueError:
                        pass
            if asset.last_inspection_at and (now - asset.last_inspection_at).days > 90:
                inspection_due += 1
            health_cat = (meta.get("health_category") or "")
            if health_cat == "critical":
                unsafe += 1

        incidents = await session.execute(
            select(SafetyIncident)
            .where(SafetyIncident.plant_id == plant_id)
            .order_by(SafetyIncident.occurred_at.desc())
            .limit(10)
        )

        due_insp = await session.execute(
            select(func.count())
            .select_from(SafetyInspection)
            .where(
                SafetyInspection.plant_id == plant_id,
                SafetyInspection.next_due_at.isnot(None),
                SafetyInspection.next_due_at <= now,
            )
        )
        inspection_due += int(due_insp.scalar() or 0)

        return {
            "assets_under_maintenance": int(under_maint.scalar() or 0),
            "unsafe_assets": unsafe,
            "expired_certifications": expired_certs,
            "inspection_due": inspection_due,
            "recent_incidents": [
                {
                    "id": str(i.id),
                    "title": i.title,
                    "severity": i.severity,
                    "status": i.status,
                    "occurred_at": i.occurred_at.isoformat(),
                }
                for i in incidents.scalars()
            ],
            "safety_alerts": [],
            "emergency_contacts": EMERGENCY_CONTACTS,
        }

    async def list_inspections(self, session: AsyncSession, plant_id: UUID) -> list[SafetyInspection]:
        result = await session.execute(
            select(SafetyInspection)
            .where(SafetyInspection.plant_id == plant_id)
            .order_by(SafetyInspection.inspected_at.desc())
        )
        return list(result.scalars())

    async def create_inspection(
        self,
        session: AsyncSession,
        plant_id: UUID,
        inspector: User,
        *,
        asset_id: UUID | None,
        inspection_type: str,
        findings: str | None,
        next_due_at: datetime | None,
    ) -> SafetyInspection:
        insp = SafetyInspection(
            plant_id=plant_id,
            asset_id=asset_id,
            inspector_id=inspector.id,
            inspection_type=inspection_type,
            findings=findings,
            inspected_at=datetime.now(timezone.utc),
            next_due_at=next_due_at,
        )
        session.add(insp)
        if asset_id:
            asset = await session.get(Asset, asset_id)
            if asset:
                asset.last_inspection_at = datetime.now(timezone.utc)
        return insp

    async def list_incidents(self, session: AsyncSession, plant_id: UUID) -> list[SafetyIncident]:
        result = await session.execute(
            select(SafetyIncident)
            .where(SafetyIncident.plant_id == plant_id)
            .order_by(SafetyIncident.occurred_at.desc())
        )
        return list(result.scalars())

    async def create_incident(
        self,
        session: AsyncSession,
        plant_id: UUID,
        reporter: User,
        *,
        asset_id: UUID | None,
        title: str,
        description: str,
        severity: str,
        occurred_at: datetime,
    ) -> SafetyIncident:
        inc = SafetyIncident(
            plant_id=plant_id,
            asset_id=asset_id,
            reported_by=reporter.id,
            title=title,
            description=description,
            severity=severity,
            occurred_at=occurred_at,
        )
        session.add(inc)
        if reporter.organisation_id:
            await self._notify.notify_plant_leaders(
                session,
                reporter.organisation_id,
                notification_type="safety_alert",
                title=title,
                body=description[:200],
                entity_type="safety_incident",
                entity_id=inc.id,
            )
        return inc

    async def list_sops(self, session: AsyncSession, plant_id: UUID, asset_id: UUID | None = None) -> list[SopDocument]:
        q = select(SopDocument).where(SopDocument.plant_id == plant_id, SopDocument.is_active.is_(True))
        if asset_id:
            q = q.where((SopDocument.asset_id == asset_id) | (SopDocument.asset_id.is_(None)))
        result = await session.execute(q.order_by(SopDocument.title))
        return list(result.scalars())

    async def search_assets(
        self,
        session: AsyncSession,
        query: str,
        *,
        plant_id: UUID | None = None,
        limit: int = 10,
    ) -> list[dict]:
        term = query.strip()
        if not term:
            return []

        conditions = [
            Asset.asset_no.ilike(f"%{term}%"),
            Asset.name.ilike(f"%{term}%"),
        ]
        if term.startswith("asset:"):
            try:
                conditions.append(Asset.id == UUID(term.split(":", 1)[1]))
            except ValueError:
                pass
        else:
            try:
                conditions.append(Asset.id == UUID(term))
            except ValueError:
                pass

        q = select(Asset).where(or_(*conditions))
        if plant_id:
            q = q.where(Asset.plant_id == plant_id)
        q = q.order_by(Asset.asset_no).limit(limit)
        result = await session.execute(q)
        return [
            {
                "id": str(a.id),
                "asset_no": a.asset_no,
                "name": a.name,
                "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            }
            for a in result.scalars()
        ]

    async def resolve_qr(self, session: AsyncSession, payload: str) -> UUID | None:
        from app.db.models import QRAsset

        raw = payload.strip()
        if not raw:
            return None

        if raw.startswith("asset:"):
            try:
                return UUID(raw.split(":", 1)[1])
            except ValueError:
                return None

        try:
            return UUID(raw)
        except ValueError:
            pass

        result = await session.execute(select(QRAsset).where(QRAsset.qr_payload == raw))
        qr = result.scalar_one_or_none()
        if qr:
            return qr.asset_id

        asset_result = await session.execute(
            select(Asset.id).where(Asset.asset_no.ilike(raw)).limit(1)
        )
        asset_id = asset_result.scalar_one_or_none()
        return asset_id
