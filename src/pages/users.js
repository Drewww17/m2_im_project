import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

const emptyForm = {
  username: '',
  fullName: '',
  password: '',
  role: 'CASHIER'
};

const roleDescriptions = {
  CASHIER: 'Can access POS and the read-only product catalog.',
  CLERK: 'Can manage inventory, customers, suppliers, sales history, and purchasing.',
  MANAGER: 'Has full access including reports, users, and day closing.'
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch users');
        return;
      }

      setUsers(data.users || []);
    } catch {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create user');
        return;
      }

      toast.success(`${formData.role} account created`);
      setFormData(emptyForm);
      await fetchUsers();
    } catch {
      toast.error('Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="MANAGER">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create cashier accounts here. Cashier users only see POS and the product catalog in the app.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.4fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Create User</h2>
            <p className="mt-1 text-sm text-gray-500">{roleDescriptions[formData.role]}</p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(event) => setFormData((current) => ({ ...current, fullName: event.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={formData.role}
                  onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-green-500"
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="CLERK">Clerk</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Existing Users</h2>
              <p className="mt-1 text-sm text-gray-500">{users.length} account(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-5 text-center text-sm text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-5 text-center text-sm text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.role === 'MANAGER'
                              ? 'bg-purple-100 text-purple-800'
                              : user.role === 'CLERK'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {user.is_active ? 'Active' : 'Inactive'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(user.created_at, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
