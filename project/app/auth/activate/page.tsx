'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ActivatePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>}>
            <ActivateForm />
        </Suspense>
    );
}

function ActivateForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Invalid activation link. Please check your email.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Activation failed');
            }

            setSuccess(true);
            // specific logic: redirect after short delay
            setSuccess(true);
            // specific logic: redirect after short delay
            setTimeout(() => {
                const loginUrl = data.hibid_url
                    ? `/auth/login?prefillUrl=${encodeURIComponent(data.hibid_url)}`
                    : '/auth/login';
                router.push(loginUrl);
            }, 2000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <div className="mx-auto flex justify-center">
                            <img
                                src="/images/bidsquire-logo.png"
                                alt="Bidsquire"
                                className="h-16 w-auto"
                            />
                        </div>
                    </div>
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
                            <p className="text-gray-600">This activation link appears to be missing required information.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <div className="mx-auto flex justify-center">
                            <img
                                src="/images/bidsquire-logo.png"
                                alt="Bidsquire"
                                className="h-16 w-auto"
                            />
                        </div>
                        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                            Account Activated!
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Your password has been set successfully
                        </p>
                    </div>
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="text-gray-600 mb-4">You can now access your dashboard.</p>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to login...
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto flex justify-center">
                        <img
                            src="/images/bidsquire-logo.png"
                            alt="Bidsquire"
                            className="h-16 w-auto"
                        />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Activate Your Account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Set a secure password to access your dashboard
                    </p>
                </div>

                {/* Activation Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Set Password</CardTitle>
                        <CardDescription>
                            Create a password for your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Activating...
                                    </>
                                ) : (
                                    'Set Password & Activate'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
