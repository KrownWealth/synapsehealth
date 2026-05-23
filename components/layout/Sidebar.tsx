'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Activity,
  FileText,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  fetchPatients,
  fetchActiveMedicationsAcrossPatients,
  fetchAllPreAuthClaimsForPatients,
} from '@/lib/fhirClient';
import { patientsFromBundle } from '@/lib/patientUtils';
import { buildWorklist } from '@/lib/dashboardUtils';

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  count,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-indigo-50 font-medium text-indigo-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 ${active ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-600'}`}
      />
      <span className="flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function useSidebarCounts() {
  const patientsQ = useQuery({
    queryKey: ['patients', 0],
    queryFn: () => fetchPatients(0),
  });
  const patientIds = patientsFromBundle(patientsQ.data)
    .map((p) => p.id)
    .filter((id): id is string => !!id);

  const medsQ = useQuery({
    queryKey: ['active-meds-across', patientIds.join(',')],
    queryFn: () => fetchActiveMedicationsAcrossPatients(patientIds),
    enabled: patientIds.length > 0,
  });

  const claimsQ = useQuery({
    queryKey: ['preauth-claims-for', patientIds.join(',')],
    queryFn: () => fetchAllPreAuthClaimsForPatients(patientIds),
    enabled: patientIds.length > 0,
  });

  const items = buildWorklist(patientsQ.data, medsQ.data, claimsQ.data);
  return {
    patientCount: patientIds.length,
    needsReview: items.filter((i) => !i.submitted).length,
    submitted: items.filter((i) => i.submitted).length,
  };
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useSidebarCounts();

  const isDashboard = pathname === '/';
  const isPatients = pathname === '/patients' || pathname.startsWith('/patients/');
  const isTaskList = pathname === '/medication/task-list';
  const isPriorAuth = pathname.startsWith('/medication/prior-auth');

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-slate-900">SepSofa</p>
          <p className="truncate text-[11px] leading-tight text-slate-500">PA Accelerator</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        <NavLink
          href="/"
          icon={LayoutDashboard}
          label="Dashboard"
          active={isDashboard}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/patients"
          icon={Users}
          label="Patient List"
          active={isPatients}
          count={counts.patientCount}
          onNavigate={onNavigate}
        />

        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Medication
        </p>
        <NavLink
          href="/medication/task-list"
          icon={ListTodo}
          label="Doctor Task List"
          active={isTaskList}
          count={counts.needsReview}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/medication/prior-auth"
          icon={FileText}
          label="Prior Auth"
          active={isPriorAuth}
          count={counts.submitted}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="space-y-2 border-t border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            DH
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-900">Dr. Georgianne Howe</p>
            <p className="truncate text-[10px] text-slate-500">Internal Medicine · Demo</p>
          </div>
        </div>
        <SignOutButton onNavigate={onNavigate} />
      </div>
    </aside>
  );
}

function SignOutButton({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    onNavigate?.();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the network call fails, force the client out — middleware will catch any
      // request that bypasses the cookie clear and redirect to /login.
    }
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden={true} />
      Sign out
    </button>
  );
}

export function SidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex lg:hidden">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden={true}
      />
      <div className="relative z-10 h-full">
        <Sidebar onNavigate={onClose} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-2 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
