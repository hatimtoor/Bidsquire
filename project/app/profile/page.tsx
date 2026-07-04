'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Lock, Save, CheckCircle, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/layout/navbar';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayUserId, setEbayUserId] = useState<string | null>(null);
  const [isEbayLoading, setIsEbayLoading] = useState(false);
  const [isEbayStatusLoading, setIsEbayStatusLoading] = useState(true);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  // Load eBay connection status
  useEffect(() => {
    if (!user) return;
    setIsEbayStatusLoading(true);
    fetch('/api/ebay/status', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setEbayConnected(data.connected || false);
        setEbayUserId(data.ebayUserId || null);
      })
      .catch(() => {})
      .finally(() => setIsEbayStatusLoading(false));
  }, [user]);

  // Handle redirect back from eBay OAuth
  useEffect(() => {
    const ebayParam = searchParams?.get('ebay');
    if (ebayParam === 'connected') {
      toast.success('eBay account connected successfully!');
      setEbayConnected(true);
    } else if (ebayParam === 'denied') {
      toast.error('eBay connection was cancelled.');
    } else if (ebayParam === 'error') {
      toast.error('Failed to connect eBay account. Please try again.');
    }
  }, [searchParams]);

  // Load user profile data
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoadingProfile(true);

    try {
      console.log('Sending profile update request...');
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(profileForm),
      });

      console.log('Profile response status:', response.status);
      const data = await response.json();
      console.log('Profile response data:', data);

      if (response.ok && data.success) {
        toast.success('Profile updated successfully!');
        // Update localStorage with new user data
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      toast.error('An error occurred while updating profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleConnectEbay = async () => {
    setIsEbayLoading(true);
    try {
      const response = await fetch('/api/ebay/auth-url', { credentials: 'include' });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not generate eBay authorization URL.');
      }
    } catch {
      toast.error('Failed to connect to eBay.');
    } finally {
      setIsEbayLoading(false);
    }
  };

  const handleDisconnectEbay = async () => {
    setIsEbayLoading(true);
    try {
      await fetch('/api/ebay/disconnect', { method: 'POST', credentials: 'include' });
      setEbayConnected(false);
      setEbayUserId(null);
      toast.success('eBay account disconnected.');
    } catch {
      toast.error('Failed to disconnect eBay account.');
    } finally {
      setIsEbayLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate passwords
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setIsLoadingPassword(true);

    try {
      console.log('Sending password change request...');
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok && data.success) {
        toast.success('Password changed successfully!');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        toast.error(data.error || 'Current password is incorrect');
      }
    } catch (err) {
      toast.error('An error occurred while changing password');
    } finally {
      setIsLoadingPassword(false);
    }
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Show access denied if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Profile & Settings</h1>
          <p className="text-gray-600">Manage your account information and security</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="Enter your email address"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Role cannot be changed</p>
                </div>

                <Button type="submit" disabled={isLoadingProfile} className="w-full">
                  {isLoadingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Profile...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Profile
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter your new password"
                    required
                  />
                  <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm your new password"
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoadingPassword} className="w-full">
                  {isLoadingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* eBay Account Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                eBay Account
              </CardTitle>
              <CardDescription>
                Connect your eBay seller account to create draft listings directly from finalized items
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEbayStatusLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Checking connection status...</span>
                </div>
              ) : ebayConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-md px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      eBay account connected{ebayUserId ? ` (${ebayUserId})` : ''}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDisconnectEbay}
                    disabled={isEbayLoading}
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  >
                    {isEbayLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Disconnect eBay Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    No eBay account connected. Connect your seller account to push finalized items as draft listings.
                  </p>
                  <Button
                    onClick={handleConnectEbay}
                    disabled={isEbayLoading}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                  >
                    {isEbayLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingBag className="mr-2 h-4 w-4" />
                    )}
                    Connect eBay Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Additional account management options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={() => logout()}
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
