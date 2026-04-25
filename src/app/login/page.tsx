import { AuthForm } from "@/components/auth/auth-form";

type LoginPageProps = {
  searchParams?: {
    message?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <AuthForm mode="login" initialMessage={searchParams?.message} />
    </div>
  );
}
