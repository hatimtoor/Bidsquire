'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Users,
  Search,
  Camera,
  ShieldAlert
} from 'lucide-react';
import { useUsers } from '@/hooks/queries';

export default function SuperAdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const { data: users = [], isLoading: isLoadingData } = useUsers();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'super_admin') {
      router.push('/admin');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-left space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-600">Overview of system users and activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {users.filter(u => u.role === 'super_admin').length} Super Admins
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Researchers</CardTitle>
            <Search className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'researcher' || u.role === 'researcher2').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {users.filter(u => u.role === 'researcher').length} Level 1, {users.filter(u => u.role === 'researcher2').length} Level 2
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Photographers</CardTitle>
            <Camera className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'photographer').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
