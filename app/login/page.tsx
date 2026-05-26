import { LoginForm } from '@/components/auth/LoginForm';
import { Activity } from 'lucide-react';

export const metadata = { title: 'Sign in — PriorAuth' };
export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <p className="text-lg font-semibold text-slate-900">Synapse Health</p>
          <p className="text-xs text-slate-500">Prior Authorization Accelerator</p>
        </div>

        <LoginForm redirectTo={searchParams.redirect ?? '/'} />

        <p className="text-center text-[11px] text-slate-400">
          Demo credentials <strong>username: synapse</strong> and <strong>password: synapse123</strong>
        </p>
      </div>
    </div>
  );
}
