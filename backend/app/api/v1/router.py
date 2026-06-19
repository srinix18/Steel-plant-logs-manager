from fastapi import APIRouter

from app.api.v1 import auth, dashboard, departments, organisations, records, templates, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(organisations.router, prefix="/organisations", tags=["Organisations"])
api_router.include_router(departments.router, prefix="/departments", tags=["Departments"])
api_router.include_router(templates.router, prefix="/templates", tags=["Templates"])
api_router.include_router(records.router, prefix="/records", tags=["Records"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
