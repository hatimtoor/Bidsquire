'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileText, Camera, Users, ArrowRight, Gavel } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const getDashboardInfo = (role: string) => {
    switch (role) {
      case 'super_admin': return { href: '/super-admin' };
      case 'admin': return { href: '/admin' };
      case 'researcher': return { href: '/researcher' };
      case 'photographer': return { href: '/photographer' };
      case 'researcher2': return { href: '/researcher2' };
      case 'metro_manager': return { href: '/metro' };
      case 'operator': return { href: '/operator' };
      default: return { href: '/' };
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
      } else {
        // Redirect to role-specific dashboard
        const dashboardInfo = getDashboardInfo(user.role);
        router.push(dashboardInfo.href);
      }
    }
  }, [user, isLoading, router]);

  // Loading state (centering improved)
  if (isLoading || user) { // Show loading also while redirecting if user is present
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {user ? 'Redirecting to your dashboard...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}