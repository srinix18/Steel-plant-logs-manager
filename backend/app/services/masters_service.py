from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Contractor,
    Customer,
    DelayCode,
    MaterialCatalog,
    ProductCatalog,
    SteelGrade,
    User,
)
from app.schemas.foundation import (
    CustomerAdminResponse,
    CustomerCreate,
    CustomerUpdate,
    DelayCodeAdminResponse,
    DelayCodeCreate,
    DelayCodeUpdate,
    MaterialAdminResponse,
    MaterialCreate,
    MaterialUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SteelGradeAdminResponse,
    SteelGradeCreate,
    SteelGradeUpdate,
)


def _org_id(user: User) -> UUID:
    if not user.organisation_id:
        raise HTTPException(status_code=400, detail="User has no organisation")
    return user.organisation_id


class MastersService:
    async def list_grades(self, session: AsyncSession, user: User) -> list[SteelGradeAdminResponse]:
        org_id = _org_id(user)
        result = await session.execute(
            select(SteelGrade).where(SteelGrade.organisation_id == org_id).order_by(SteelGrade.code)
        )
        return [SteelGradeAdminResponse.model_validate(g) for g in result.scalars()]

    async def create_grade(
        self, session: AsyncSession, data: SteelGradeCreate
    ) -> SteelGradeAdminResponse:
        grade = SteelGrade(
            organisation_id=data.organisation_id,
            code=data.code.upper(),
            description=data.description,
        )
        session.add(grade)
        await session.flush()
        return SteelGradeAdminResponse.model_validate(grade)

    async def update_grade(
        self, session: AsyncSession, grade_id: UUID, data: SteelGradeUpdate
    ) -> SteelGradeAdminResponse:
        grade = await session.get(SteelGrade, grade_id)
        if not grade:
            raise HTTPException(status_code=404, detail="Grade not found")
        if data.description is not None:
            grade.description = data.description
        await session.flush()
        return SteelGradeAdminResponse.model_validate(grade)

    async def list_materials(self, session: AsyncSession, user: User) -> list[MaterialAdminResponse]:
        org_id = _org_id(user)
        result = await session.execute(
            select(MaterialCatalog)
            .where(MaterialCatalog.organisation_id == org_id)
            .order_by(MaterialCatalog.code)
        )
        return [MaterialAdminResponse.model_validate(m) for m in result.scalars()]

    async def create_material(
        self, session: AsyncSession, data: MaterialCreate
    ) -> MaterialAdminResponse:
        mat = MaterialCatalog(
            organisation_id=data.organisation_id,
            type=data.type,
            code=data.code.upper(),
            name=data.name,
        )
        session.add(mat)
        await session.flush()
        return MaterialAdminResponse.model_validate(mat)

    async def update_material(
        self, session: AsyncSession, material_id: UUID, data: MaterialUpdate
    ) -> MaterialAdminResponse:
        mat = await session.get(MaterialCatalog, material_id)
        if not mat:
            raise HTTPException(status_code=404, detail="Material not found")
        if data.name is not None:
            mat.name = data.name
        if data.type is not None:
            mat.type = data.type
        await session.flush()
        return MaterialAdminResponse.model_validate(mat)

    async def list_products(self, session: AsyncSession, user: User) -> list[ProductResponse]:
        org_id = _org_id(user)
        result = await session.execute(
            select(ProductCatalog)
            .where(ProductCatalog.organisation_id == org_id)
            .order_by(ProductCatalog.code)
        )
        return [ProductResponse.model_validate(p) for p in result.scalars()]

    async def create_product(self, session: AsyncSession, data: ProductCreate) -> ProductResponse:
        product = ProductCatalog(
            organisation_id=data.organisation_id,
            code=data.code.upper(),
            name=data.name,
            department_id=data.department_id,
        )
        session.add(product)
        await session.flush()
        return ProductResponse.model_validate(product)

    async def update_product(
        self, session: AsyncSession, product_id: UUID, data: ProductUpdate
    ) -> ProductResponse:
        product = await session.get(ProductCatalog, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if data.name is not None:
            product.name = data.name
        if data.department_id is not None:
            product.department_id = data.department_id
        if data.is_active is not None:
            product.is_active = data.is_active
        await session.flush()
        return ProductResponse.model_validate(product)

    async def list_customers(
        self, session: AsyncSession, plant_id: UUID | None = None
    ) -> list[CustomerAdminResponse]:
        query = select(Customer).order_by(Customer.name)
        if plant_id:
            query = query.where(Customer.plant_id == plant_id)
        result = await session.execute(query)
        return [CustomerAdminResponse.model_validate(c) for c in result.scalars()]

    async def create_customer(self, session: AsyncSession, data: CustomerCreate) -> CustomerAdminResponse:
        customer = Customer(plant_id=data.plant_id, name=data.name, code=data.code)
        session.add(customer)
        await session.flush()
        return CustomerAdminResponse.model_validate(customer)

    async def update_customer(
        self, session: AsyncSession, customer_id: UUID, data: CustomerUpdate
    ) -> CustomerAdminResponse:
        customer = await session.get(Customer, customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        if data.name is not None:
            customer.name = data.name
        if data.code is not None:
            customer.code = data.code
        if data.is_active is not None:
            customer.is_active = data.is_active
        await session.flush()
        return CustomerAdminResponse.model_validate(customer)

    async def list_delay_codes(
        self, session: AsyncSession, plant_id: UUID | None = None
    ) -> list[DelayCodeAdminResponse]:
        query = select(DelayCode).order_by(DelayCode.code)
        if plant_id:
            query = query.where(DelayCode.plant_id == plant_id)
        result = await session.execute(query)
        return [DelayCodeAdminResponse.model_validate(d) for d in result.scalars()]

    async def create_delay_code(
        self, session: AsyncSession, data: DelayCodeCreate
    ) -> DelayCodeAdminResponse:
        dc = DelayCode(
            plant_id=data.plant_id,
            code=data.code.upper(),
            description=data.description,
            category=data.category,
        )
        session.add(dc)
        await session.flush()
        return DelayCodeAdminResponse.model_validate(dc)

    async def update_delay_code(
        self, session: AsyncSession, code_id: UUID, data: DelayCodeUpdate
    ) -> DelayCodeAdminResponse:
        dc = await session.get(DelayCode, code_id)
        if not dc:
            raise HTTPException(status_code=404, detail="Delay code not found")
        if data.description is not None:
            dc.description = data.description
        if data.category is not None:
            dc.category = data.category
        if data.is_active is not None:
            dc.is_active = data.is_active
        await session.flush()
        return DelayCodeAdminResponse.model_validate(dc)

    async def list_contractors(self, session: AsyncSession, user: User) -> list:
        from app.schemas.foundation import ContractorReadResponse

        org_id = _org_id(user)
        result = await session.execute(
            select(Contractor)
            .where(Contractor.organisation_id == org_id)
            .order_by(Contractor.code)
        )
        return [ContractorReadResponse.model_validate(c) for c in result.scalars()]

    async def seed_default_products(self, session: AsyncSession, org_id: UUID) -> None:
        defaults = [
            ("RND", "Round Bar"),
            ("HEX", "Hex Bar"),
            ("SQR", "Square Bar"),
            ("WR", "Wire Rod"),
        ]
        for code, name in defaults:
            exists = (
                await session.execute(
                    select(ProductCatalog).where(
                        ProductCatalog.organisation_id == org_id,
                        ProductCatalog.code == code,
                    )
                )
            ).scalar_one_or_none()
            if not exists:
                session.add(ProductCatalog(organisation_id=org_id, code=code, name=name))
