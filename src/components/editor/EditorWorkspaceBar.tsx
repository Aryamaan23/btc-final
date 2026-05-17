import { FormEvent, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../common';
import { useEditorAuth } from '../../context/EditorAuthContext';

type EditorWorkspaceBarProps = {
  className?: string;
};

function EditorWorkspaceBar({ className = '' }: EditorWorkspaceBarProps) {
  const { isLoggedIn, hasActiveSession, email, unlockSession, logout } = useEditorAuth();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  if (!isLoggedIn) return null;

  const onUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setUnlockError('');
    if (!password.trim()) {
      setUnlockError('Enter your password to continue editing.');
      return;
    }
    setUnlocking(true);
    const result = await unlockSession(password);
    setUnlocking(false);
    if (!result.success) {
      setUnlockError(result.error || 'Could not verify password.');
      return;
    }
    setPassword('');
  };

  const isOnUploadPage = location.pathname === '/publications/editor';

  return (
    <div
      className={`rounded-2xl border border-primary/20 bg-gradient-to-r from-primary-soft/80 via-white to-cream/90 p-4 sm:p-5 shadow-soft ${className}`}
      role="region"
      aria-label="Editor workspace"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Editor workspace</p>
          <p className="mt-1 text-sm sm:text-base text-gray-800">
            Signed in as <span className="font-semibold text-gray-900">{email}</span>
            {hasActiveSession ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                Ready to edit
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Confirm password to upload or delete
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            variant={isOnUploadPage ? 'primary' : 'outline'}
            href="/publications/editor"
          >
            Upload & manage
          </Button>
          <Button size="sm" variant="outline" href="/publications">
            All publications
          </Button>
          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm('Log out of the editor workspace?');
              if (confirmed) logout();
            }}
            className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      {!hasActiveSession ? (
        <form
          onSubmit={onUnlock}
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end border-t border-primary/10 pt-4"
        >
          <div className="flex-1">
            <label htmlFor="editor-unlock-password" className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="editor-unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Re-enter editor password"
            />
          </div>
          <Button type="submit" size="sm" variant="primary" disabled={unlocking}>
            {unlocking ? 'Verifying...' : 'Unlock editing'}
          </Button>
          {unlockError ? <p className="text-sm text-red-600 w-full">{unlockError}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

export default EditorWorkspaceBar;
