import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { downloadFoundationDocument, fetchFoundationDocuments, uploadFoundationDocument } from '../../api/foundation';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentUploadModal } from '../../components/foundation/DocumentUploadModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { isHodTier } from '../../utils/roles';

export function DocumentsPage() {
  const { user } = useAuth();
  const canUpload = user ? isHodTier(user.role) || user.role === 'hr' : false;
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof fetchFoundationDocuments>>>([]);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    const plants = await fetchPlants();
    const pid = plantId || plants[0]?.id || '';
    if (!plantId && pid) setPlantId(pid);
    const [d, dept] = await Promise.all([
      fetchFoundationDocuments({ plant_id: pid || undefined }),
      fetchDepartments(pid || undefined),
    ]);
    setDocs(d);
    setDepartments(dept);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const handleUpload = async (form: FormData) => {
    await uploadFoundationDocument(form);
    setShowUpload(false);
    await load();
  };

  const download = (docId: string, fileName: string) => {
    downloadFoundationDocument(docId, fileName).catch((e) => setError(getErrorMessage(e)));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Department Documents</h1>
          <p className="mt-1 text-sm text-slate-500">SOPs, work instructions, and safety documents.</p>
        </div>
        {canUpload && <Button onClick={() => setShowUpload(true)}>Upload document</Button>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={docs}
          emptyMessage="No documents uploaded."
          columns={[
            { key: 'title', header: 'Title', render: (d) => d.title },
            { key: 'category', header: 'Category', render: (d) => d.category.replace(/_/g, ' ') },
            { key: 'version', header: 'Version', render: (d) => d.version },
            { key: 'file', header: 'File', render: (d) => d.file_name },
            { key: 'by', header: 'Uploaded by', render: (d) => d.uploader_name || '—' },
            {
              key: 'dl',
              header: '',
              render: (d) => (
                <button type="button" className="text-sm text-brand-600" onClick={() => download(d.id, d.file_name)}>
                  Download
                </button>
              ),
            },
          ]}
        />
      </Card>

      {showUpload && plantId && (
        <DocumentUploadModal
          plantId={plantId}
          departments={departments}
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}
