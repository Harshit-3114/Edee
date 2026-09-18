import FloatingUserMenu from '@/components/shells/FloatingUserMenu';
import LinkButton from '@/components/ui/LinkButton';

export default function NotFound() {
  return (
    <>
      <FloatingUserMenu />
    <main
      id="main"
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-5 px-6 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="flex justify-center">
        <LinkButton href="/">Go to the home page</LinkButton>
      </div>
    </main>
    </>
  );
}
