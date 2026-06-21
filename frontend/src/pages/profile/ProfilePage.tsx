import { useEffect, useState } from 'react';
import { getMe, updateProfile } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(authUser);
  const [fullName, setFullName] = useState(authUser?.full_name ?? '');
  const [phone, setPhone] = useState(authUser?.phone ?? '');
  const [designation, setDesignation] = useState(authUser?.designation ?? '');
  const [dateOfJoining, setDateOfJoining] = useState(authUser?.date_of_joining?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setFullName(u.full_name);
        setPhone(u.phone ?? '');
        setDesignation(u.designation ?? '');
        setDateOfJoining(u.date_of_joining?.slice(0, 10) ?? '');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateProfile({
        full_name: fullName,
        phone: phone || undefined,
        designation: designation || undefined,
        date_of_joining: dateOfJoining || undefined,
      });
      setUser(updated);
      setMessage('Profile saved.');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Profile</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
      <Card>
        <div className="space-y-4">
          <Input label="Email" value={user?.email ?? ''} disabled />
          {user?.employee_uid && (
            <Input label="Employee UID" value={user.employee_uid} disabled />
          )}
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Melter" />
          <Input
            label="Date of joining"
            type="date"
            value={dateOfJoining}
            onChange={(e) => setDateOfJoining(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Employee UID is generated when you save your designation for the first time.
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
