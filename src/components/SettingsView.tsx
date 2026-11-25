import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Shield, Trash2, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { UserDTO, UserRole } from '../types/inventory.ts';
import { apiRequest } from '../utils/apiClient.ts';
import { Modal } from './ui/Modal.tsx';

export function SettingsView() {
  const { user, token, updateSessionUser } = useAuth();
  const { showToast } = useToast();

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [team, setTeam] = useState<UserDTO[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as UserRole,
  });

  const loadTeam = useCallback(async () => {
    if (user?.role !== 'admin' || !token) return;
    setTeamLoading(true);
    try {
      const list = await apiRequest<UserDTO[]>('/users', { token });
      setTeam(list);
    } catch {
      // Ignore if unauthorized
    } finally {
      setTeamLoading(false);
    }
  }, [user?.role, token]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: UserDTO; token: string }>('/auth/profile', {
        method: 'PATCH',
        token,
        body: { name: profileName, email: profileEmail },
      });
      updateSessionUser(res.user, res.token);
      showToast('Profile details updated.', 'success');
      await loadTeam();
    } catch (err) {
      showToast((err as Error).message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await apiRequest('/auth/password', {
        method: 'POST',
        token,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password rotated successfully.', 'success');
    } catch (err) {
      showToast((err as Error).message || 'Password update failed.', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/users', {
        method: 'POST',
        token,
        body: inviteForm,
      });
      showToast(`Created ${inviteForm.role} account for ${inviteForm.name}.`, 'success');
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', password: '', role: 'staff' });
      await loadTeam();
    } catch (err) {
      showToast((err as Error).message || 'Failed to create team member.', 'error');
    }
  }

  async function handleUpdateMember(member: UserDTO, patch: { role?: UserRole; active?: boolean }) {
    try {
      await apiRequest(`/users/${member.id}`, {
        method: 'PATCH',
        token,
        body: patch,
      });
      showToast(`Updated ${member.name}.`, 'success');
      await loadTeam();
    } catch (err) {
      showToast((err as Error).message || 'Update failed.', 'error');
    }
  }

  async function handleDeleteMember(member: UserDTO) {
    try {
      await apiRequest(`/users/${member.id}`, {
        method: 'DELETE',
        token,
      });
      showToast(`Removed ${member.name}.`, 'success');
      await loadTeam();
    } catch (err) {
      showToast((err as Error).message || 'Delete failed.', 'error');
    }
  }

  const permissionsMatrix = [
    { capability: 'View Dashboard, Inventory & Reports', admin: true, staff: true },
    { capability: 'Create & Edit Products, Categories, Suppliers', admin: true, staff: true },
    { capability: 'Record Stock In / Stock Out & Sales Invoices', admin: true, staff: true },
    { capability: 'Delete Products, Categories & Suppliers', admin: true, staff: false },
    { capability: 'Manage Team Accounts & Role Assignments', admin: true, staff: false },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 mb-5">
            <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Account Profile
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Assigned Role: <strong className="uppercase font-mono">{user?.role}</strong>
              </span>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
              >
                {savingProfile ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Password Rotation */}
        <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 mb-5">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Security &amp; Password Rotation
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-60 cursor-pointer"
              >
                {savingPassword ? 'Updating...' : 'Rotate Password'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Admin Team Management */}
      {user?.role === 'admin' && (
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Team &amp; Access Management
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Provision staff or administrator accounts and manage session status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Team Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {teamLoading && team.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-6 text-center text-xs text-slate-500">
                      Loading team directory...
                    </td>
                  </tr>
                ) : (
                  team.map((member) => {
                    const isSelf = member.id === user.id;
                    return (
                      <tr key={member.id}>
                        <td className="py-3 px-6">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {member.name} {isSelf ? '(You)' : ''}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            disabled={isSelf}
                            value={member.role}
                            onChange={(e) =>
                              handleUpdateMember(member, { role: e.target.value as UserRole })
                            }
                            aria-label={`Role for ${member.name}`}
                            className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleUpdateMember(member, { active: !member.active })}
                            className={`text-xs font-medium disabled:opacity-50 cursor-pointer ${
                              member.active
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {member.active ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {new Date(member.createdAt).toLocaleDateString('en-US')}
                        </td>
                        <td className="py-3 px-6 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(member)}
                              aria-label={`Remove ${member.name}`}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Role Permissions Matrix */}
      <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Role Permissions Matrix
          </h2>
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-6">Permission</th>
              <th className="py-2.5 px-4 text-center">Administrator</th>
              <th className="py-2.5 px-6 text-center">Staff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {permissionsMatrix.map((row) => (
              <tr key={row.capability}>
                <td className="py-3 px-6 text-slate-700 dark:text-slate-300">{row.capability}</td>
                <td className="py-3 px-4 text-center">
                  {row.admin ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 px-6 text-center">
                  {row.staff ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add Team Member"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={inviteForm.name}
              onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Temporary Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={inviteForm.password}
              onChange={(e) => setInviteForm((p) => ({ ...p, password: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Role
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
