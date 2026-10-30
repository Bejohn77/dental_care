import Link from "next/link";
import LoginForm from "@/app/(auth)/login/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Login to Medico Dental Care
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Access your patient, doctor, compounder, or admin dashboard.
        </p>

        {params?.error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {params?.message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {params.message}
          </div>
        )}

        <LoginForm />

        <p className="mt-6 text-center text-sm text-slate-600">
          New patient?{" "}
          <Link href="/register" className="font-semibold text-teal-700">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}