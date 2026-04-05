'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Users, Edit3, Trash2, X, RefreshCw } from 'lucide-react';
import { UserAccount } from '@/types/auction';
import { toast } from 'sonner';
import { dataStore } from '@/services/dataStore';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UsersPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState<UserAccount[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [userListKey, setUserListKey] = useState(0);

    // Modal States
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

    // Delete Dialog State
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Edit Password State
    const [editPassword, setEditPassword] = useState('');
    const [editConfirmPassword, setEditConfirmPassword] = useState('');

    // Forms
    const [newUserForm, setNewUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'photographer' as 'researcher' | 'researcher2' | 'photographer',
        isActive: true,
        updatedAt: new Date()
    });

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Check authentication
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/auth/login');
        } else if (user && user.role !== 'admin') {
            router.push('/');
        }
    }, [user, isLoading, router]);

    // Load users
    useEffect(() => {
        if (user?.id) {
            refreshUserList();
        }
    }, [user]);

    const refreshUserList = async () => {
        if (!user?.id) return;
        setIsLoadingData(true);
        try {
            // Load all team members created by this admin
            const response = await fetch(`/api/users/list?adminId=${user.id}`);
            const data = await response.json();
            if (data.success) {
                setUsers(data.users || data.photographers);
                setUserListKey(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error refreshing user list:', error);
            toast.error('Failed to load users');
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingData(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch('/api/users/manage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userData: newUserForm,
                    createdBy: user?.id
                }),
            });

            const result = await response.json();

            if (result.success) {
                toast.success('Photographer created successfully!');
                setNewUserForm({
                    name: '',
                    email: '',
                    password: '',
                    role: 'researcher' as 'researcher' | 'researcher2' | 'photographer',
                    isActive: true,
                    updatedAt: new Date()
                });
                setIsAddUserModalOpen(false);
                await refreshUserList();
            } else {
                setError(result.error || 'Failed to create user');
                toast.error(result.error || 'Failed to create user');
            }
        } catch (error) {
            setError('An error occurred while creating user');
            toast.error('An error occurred while creating user');
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            // Update user details
            await dataStore.updateUser(editingUser.id, editingUser);

            // Handle password update if provided
            if (editPassword) {
                if (editPassword !== editConfirmPassword) {
                    toast.error('Passwords do not match');
                    return;
                }

                if (editPassword.length < 6) {
                    toast.error('Password must be at least 6 characters');
                    return;
                }

                const response = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        targetUserId: editingUser.id,
                        newPassword: editPassword
                    }),
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to update password');
                }
            }

            setIsEditUserModalOpen(false);
            setEditingUser(null);
            setEditPassword('');
            setEditConfirmPassword('');
            await refreshUserList();
            toast.success('User updated successfully!');
        } catch (error: any) {
            console.error('Error updating user:', error);
            toast.error(error.message || 'Failed to update user. Please try again.');
        }
    };

    const deleteUser = (userId: string) => {
        if (userId === user?.id) {
            toast.error('You cannot delete your own account.');
            return;
        }
        setUserToDelete(userId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            const result = await dataStore.deleteUser(userToDelete);
            if (result) {
                await refreshUserList();
                toast.success('User deleted successfully!');
            } else {
                toast.error('Failed to delete user. User not found.');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        }
    };

    const openEditUser = (user: UserAccount) => {
        setEditingUser(user);
        setEditPassword('');
        setEditConfirmPassword('');
        setIsEditUserModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading...</span>
            </div>
        );
    }

    if (user && user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-600">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-600">Manage photographers and other users</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={refreshUserList}
                        disabled={isLoadingData}
                        title="Refresh List"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => setIsAddUserModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">Photographers ({users.length})</h3>

                        <div className="space-y-3" key={userListKey}>
                            {users.map((userItem) => (
                                <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-gray-700">
                                                {userItem.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{userItem.name}</p>
                                            <p className="text-sm text-gray-500">{userItem.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className={
                                            userItem.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                userItem.role === 'researcher' ? 'bg-blue-100 text-blue-800' :
                                                    userItem.role === 'researcher2' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-purple-100 text-purple-800'
                                        }>
                                            {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                                        </Badge>
                                        <Badge variant={userItem.isActive ? "default" : "secondary"}>
                                            {userItem.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <div className="flex gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => openEditUser(userItem)}>
                                                            <Edit3 className="h-3 w-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Edit User</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => deleteUser(userItem.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Delete User</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {users.length === 0 && !isLoadingData && (
                            <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
                                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p className="font-medium text-gray-700 mb-2">No team members yet</p>
                                <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                                    Add team members to help with research, photography, and final review.
                                </p>
                                <Button variant="link" onClick={() => setIsAddUserModalOpen(true)}>
                                    Add your first team member
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-semibold text-gray-900">Add New User</h2>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAddUserModalOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={newUserForm.name}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                        className="mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newUserForm.email}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                        className="mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={newUserForm.password}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                        className="mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                                    <Select
                                        value={newUserForm.role}
                                        onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value as 'researcher' | 'researcher2' | 'photographer' })}
                                    >
                                        <SelectTrigger id="role" className="w-full">
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="researcher">Researcher</SelectItem>
                                            <SelectItem value="researcher2">Research 2</SelectItem>
                                            <SelectItem value="photographer">Photographer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={newUserForm.isActive}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, isActive: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                                        Is Active
                                    </label>
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoadingData}>
                                    {isLoadingData ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        'Add User'
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditUserModalOpen && editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-semibold text-gray-900">Edit User</h2>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsEditUserModalOpen(false);
                                        setEditingUser(null);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <form onSubmit={handleEditUser} className="space-y-4">
                                <div>
                                    <label htmlFor="editName" className="block text-sm font-medium text-gray-700">Name</label>
                                    <Input
                                        id="editName"
                                        type="text"
                                        value={editingUser.name}
                                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                        className="mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="editEmail" className="block text-sm font-medium text-gray-700">Email</label>
                                    <Input
                                        id="editEmail"
                                        type="email"
                                        value={editingUser.email}
                                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                        className="mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="editRole" className="block text-sm font-medium text-gray-700">Role</label>
                                    <Select
                                        value={editingUser.role}
                                        onValueChange={(value) => setEditingUser({ ...editingUser, role: value as any })}
                                    >
                                        <SelectTrigger id="editRole" className="w-full">
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="researcher">Researcher</SelectItem>
                                            <SelectItem value="researcher2">Research 2</SelectItem>
                                            <SelectItem value="photographer">Photographer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Change Password (Optional)</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="editPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                                            <Input
                                                id="editPassword"
                                                type="password"
                                                value={editPassword}
                                                onChange={(e) => setEditPassword(e.target.value)}
                                                className="mt-1"
                                                placeholder="Leave blank to keep current"
                                            />
                                        </div>
                                        {editPassword && (
                                            <div>
                                                <label htmlFor="editConfirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                                <Input
                                                    id="editConfirmPassword"
                                                    type="password"
                                                    value={editConfirmPassword}
                                                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                                                    className="mt-1"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="editIsActive"
                                        checked={editingUser.isActive}
                                        onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="editIsActive" className="ml-2 text-sm text-gray-700">
                                        Is Active
                                    </label>
                                </div>
                                <Button type="submit" className="w-full">
                                    Save Changes
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteUser} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
