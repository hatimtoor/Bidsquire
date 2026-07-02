'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Settings, CreditCard, ClipboardCheck } from 'lucide-react';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();

    const { user } = useAuth();

    const routes = [
        {
            label: 'Dashboard',
            icon: LayoutDashboard,
            href: '/admin',
            active: pathname === '/admin',
            show: true
        },
        ...(user?.role === 'super_admin' ? [
            {
                label: 'User Management',
                icon: Users,
                href: '/super-admin/users',
                active: pathname?.startsWith('/super-admin/users'),
                show: true
            },
            {
                label: 'Review Queue',
                icon: ClipboardCheck,
                href: '/super-admin/review-queue',
                active: pathname?.startsWith('/super-admin/review-queue'),
                show: true
            },
            {
                label: 'Credit Management',
                icon: CreditCard,
                href: '/super-admin/credits',
                active: pathname?.startsWith('/super-admin/credits'),
                show: true
            },
            {
                label: 'System Settings',
                icon: Settings,
                href: '/super-admin/settings',
                active: pathname?.startsWith('/super-admin/settings'),
                show: true
            }
        ] : [
            {
                label: 'User Management',
                icon: Users,
                href: '/admin/users',
                active: pathname?.startsWith('/admin/users'),
                show: true
            }
        ]),
    ];

    return (
        <div className={cn("pb-12 w-64 border-r min-h-screen bg-white", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Admin Portal
                    </h2>
                    <div className="space-y-1">
                        {routes.map((route) => (
                            <Button
                                key={route.href}
                                variant={route.active ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start",
                                    route.active && "bg-slate-100"
                                )}
                                asChild
                            >
                                <Link href={route.href}>
                                    <route.icon className="mr-2 h-4 w-4" />
                                    {route.label}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
