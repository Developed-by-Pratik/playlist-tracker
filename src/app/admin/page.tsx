'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/Admin/AdminHeader';
import { AdminMetricsCard } from '@/components/Admin/AdminMetricsCard';
import { UserDirectory } from '@/components/Admin/UserDirectory';
import { adminService, AdminSystemMetrics, AdminUserRecord } from '@/lib/admin/admin-service';
import { getUser, isUserAdmin } from '@/lib/auth';
import { logger } from '@/lib/observability/logger';
import { ShieldAlert } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<AdminSystemMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    const [fetchedMetrics, fetchedUsers] = await Promise.all([
      adminService.getSystemMetrics(),
      adminService.getUserDirectory(),
    ]);
    setMetrics(fetchedMetrics);
    setUsers(fetchedUsers);
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    let isCancelled = false;

    // Strict access gate: only pratikkakade.in@gmail.com or pratikkakade4618@gmail.com
    getUser().then(user => {
      if (isCancelled) return;

      const authorized = isUserAdmin(user?.email);

      if (!authorized) {
        logger.warn('admin', 'Unauthorized admin page access attempt. Redirecting to /', {
          email: user?.email || 'unauthenticated',
        });
        router.replace('/');
        return;
      }

      setIsAuthorized(true);

      // User is verified admin: load platform metrics & directory
      Promise.all([
        adminService.getSystemMetrics(),
        adminService.getUserDirectory(),
      ]).then(([fetchedMetrics, fetchedUsers]) => {
        if (!isCancelled) {
          setMetrics(fetchedMetrics);
          setUsers(fetchedUsers);
          setIsLoading(false);
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const handleExport = () => {
    adminService.exportUsersCsv(users);
  };

  // While verifying authorization or redirecting, show access gate screen
  if (!isAuthorized) {
    return (
      <main
        className="container"
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}
        >
          <ShieldAlert style={{ width: 28, height: 28 }} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          Verifying Administrator Privileges...
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          Checking access permissions. Unauthorized requests are redirected to home.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '2rem clamp(1.25rem, 3.5vw, 4rem)',
        paddingBottom: '8rem',
      }}
    >
      <AdminHeader
        onRefresh={handleRefresh}
        onExport={handleExport}
        isRefreshing={isLoading}
      />

      <AdminMetricsCard
        metrics={metrics}
        isLoading={isLoading}
      />

      <UserDirectory
        users={users}
        isLoading={isLoading}
      />
    </main>
  );
}
