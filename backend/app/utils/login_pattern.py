"""One consistent pattern for the demo logins: ``<role>.<department>@chandansteel.com`` with ``<Role>@123``.

Servers seeded before the pattern have the old addresses. This renames those users in place (so their history,
runs and approvals keep working) and resets their passwords to the new ones, once. The old addresses stop working.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.models import DemoSeedState, User

log = logging.getLogger("login_pattern")
MARKER = "login_pattern_v1"
D = "chandansteel.com"

# old address -> (new address, new password). Addresses that did not change are listed to reset their password.
RENAMES: dict[str, tuple[str, str]] = {
    "admin@logbook.app": (f"admin@{D}", "Admin@123"),
    f"hod@{D}": (f"hod.sms@{D}", "Hod@123"),
    f"iaf.supervisor@{D}": (f"sup.iaf@{D}", "Sup@123"),
    f"aod.supervisor@{D}": (f"sup.aod@{D}", "Sup@123"),
    f"ccm.supervisor@{D}": (f"sup.ccm@{D}", "Sup@123"),
    f"supervisor@{D}": (f"sup.sms@{D}", "Sup@123"),
    f"supervisor.rolling@{D}": (f"sup.rolling@{D}", "Sup@123"),
    f"supervisor.wire@{D}": (f"sup.wire@{D}", "Sup@123"),
    f"supervisor.bbd@{D}": (f"sup.bbd@{D}", "Sup@123"),
    f"supervisor.forge@{D}": (f"sup.forge@{D}", "Sup@123"),
    f"melter@{D}": (f"op.sms@{D}", "Op@123"),
    f"worker.rolling@{D}": (f"op.rolling@{D}", "Op@123"),
    f"worker.wire@{D}": (f"op.wire@{D}", "Op@123"),
    f"worker.bbd@{D}": (f"op.bbd@{D}", "Op@123"),
    f"worker.forge@{D}": (f"op.forge@{D}", "Op@123"),
    f"ceo@{D}": (f"ceo@{D}", "Ceo@123"),
    f"hr@{D}": (f"hr@{D}", "Hr@123"),
    **{f"hod.{d}@{D}": (f"hod.{d}@{D}", "Hod@123") for d in ("rolling", "wire", "bbd", "forge")},
    **{f"maint.{d}@{D}": (f"maint.{d}@{D}", "Maint@123") for d in ("quality", "safety", "energy", "equipment", "process")},
}


async def migrate_logins(session: AsyncSession) -> int:
    """Rename and re-password the existing demo users once. Returns how many were changed."""
    if await session.get(DemoSeedState, MARKER):
        return 0
    changed = 0
    for old, (new, password) in RENAMES.items():
        user = (await session.execute(select(User).where(User.email == old))).scalar_one_or_none()
        if user is None:
            continue
        if new != old:
            taken = (await session.execute(select(User.id).where(User.email == new))).first()
            if taken:
                log.warning("login pattern: %s already exists, leaving %s as is", new, old)
                continue
            user.email = new
        user.hashed_password = get_password_hash(password)
        changed += 1
    session.add(DemoSeedState(name=MARKER))
    await session.commit()
    log.info("login pattern: %s accounts updated", changed)
    return changed
