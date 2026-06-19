from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    ProcessRun,
    WorkflowDefinition,
    WorkflowState,
    WorkflowTransitionDef,
    WorkflowTransitionLog,
)
from app.db.models import User
from app.models.enums import UserRole
from app.schemas.moi import TransitionRequest, WorkflowStatusResponse, WorkflowTransitionDefResponse


ADMIN_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.PLANT_ADMIN,
    UserRole.ADMIN,
}


def _role_key(role: UserRole) -> str:
    if role == UserRole.ADMIN:
        return UserRole.SUPER_ADMIN.value
    if role == UserRole.DEPARTMENT:
        return UserRole.SUPERVISOR.value
    if role == UserRole.MEMBER:
        return UserRole.WORKER.value
    return role.value


class WorkflowService:
    async def get_definition(self, session: AsyncSession, definition_id: UUID) -> WorkflowDefinition:
        result = await session.execute(
            select(WorkflowDefinition)
            .where(WorkflowDefinition.id == definition_id)
            .options(
                selectinload(WorkflowDefinition.states),
                selectinload(WorkflowDefinition.transitions),
            )
        )
        definition = result.scalar_one_or_none()
        if not definition:
            raise HTTPException(status_code=404, detail="Workflow definition not found")
        return definition

    async def get_status(
        self, session: AsyncSession, run: ProcessRun, user: User
    ) -> WorkflowStatusResponse:
        definition = await self.get_definition(session, run.workflow_definition_id)
        role = _role_key(user.role)
        available = [
            WorkflowTransitionDefResponse.model_validate(t)
            for t in definition.transitions
            if t.from_state == run.current_state and (not t.allowed_roles or role in t.allowed_roles)
        ]
        return WorkflowStatusResponse(
            current_state=run.current_state,
            available_transitions=available,
            states=[{"key": s.key, "label": s.label, "is_terminal": s.is_terminal, "color": s.color} for s in definition.states],  # type: ignore[arg-type]
        )

    async def execute_transition(
        self,
        session: AsyncSession,
        run: ProcessRun,
        user: User,
        data: TransitionRequest,
        trigger: str = "manual",
    ) -> ProcessRun:
        definition = await self.get_definition(session, run.workflow_definition_id)
        transition = next(
            (
                t
                for t in definition.transitions
                if t.from_state == run.current_state and t.to_state == data.to_state
            ),
            None,
        )
        if not transition:
            raise HTTPException(status_code=400, detail="Invalid workflow transition")

        role = _role_key(user.role)
        if transition.allowed_roles and role not in transition.allowed_roles:
            raise HTTPException(status_code=403, detail="Role not permitted for this transition")

        target_state = next((s for s in definition.states if s.key == data.to_state), None)
        if not target_state:
            raise HTTPException(status_code=400, detail="Target state not defined")

        log = WorkflowTransitionLog(
            run_id=run.id,
            from_state=run.current_state,
            to_state=data.to_state,
            actor_id=user.id,
            trigger=trigger,
            notes=data.notes,
        )
        session.add(log)

        run.current_state = data.to_state
        now = datetime.now(timezone.utc)
        if data.to_state == "in_progress" and not run.started_at:
            run.started_at = now
        if data.to_state == "completed":
            run.completed_at = now
        if data.to_state in ("closed", "approved"):
            if data.to_state == "closed":
                run.closed_at = now

        await session.flush()
        return run

    async def try_auto_transition(
        self, session: AsyncSession, run: ProcessRun, event_type: str, user: User | None
    ) -> ProcessRun | None:
        definition = await self.get_definition(session, run.workflow_definition_id)
        transition = next(
            (
                t
                for t in definition.transitions
                if t.from_state == run.current_state and t.auto_trigger_event_type == event_type
            ),
            None,
        )
        if not transition:
            return None
        actor = user
        if not actor:
            from app.db.models import User as UserModel

            result = await session.execute(select(UserModel).limit(1))
            actor = result.scalar_one_or_none()
        if not actor:
            return None
        return await self.execute_transition(
            session,
            run,
            actor,
            TransitionRequest(to_state=transition.to_state, notes=f"Auto: {event_type}"),
            trigger="auto",
        )
