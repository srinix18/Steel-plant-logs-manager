from uuid import UUID

from app.models.template_field import TemplateField
from app.repositories.base import BaseRepository


class TemplateFieldRepository(BaseRepository[TemplateField]):
    def __init__(self):
        super().__init__(TemplateField)

    async def list_by_template(self, template_id: UUID) -> list[TemplateField]:
        fields = await TemplateField.find(TemplateField.template_id == template_id).to_list()
        return sorted(fields, key=lambda f: f.sort_order)

    async def delete_by_template(self, template_id: UUID) -> None:
        await TemplateField.find(TemplateField.template_id == template_id).delete()
