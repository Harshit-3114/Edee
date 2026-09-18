import FloatingUserMenu from '@/components/shells/FloatingUserMenu';
import LinkButton from '@/components/ui/LinkButton';

export default function UnauthorisedPage() {
  return (
    <>
      <FloatingUserMenu />
    <main
      id="main"
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-5 px-6 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight">You cannot open that page</h1>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Your account does not have access to that part of the platform. If you think it
        should, ask the platform team to check your role.
      </p>
      <div className="flex justify-center">
        <LinkButton href="/login">Back to sign in</LinkButton>
      </div>
    </main>
    </>
  );
}
