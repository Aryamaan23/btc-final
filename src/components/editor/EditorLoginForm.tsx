import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../common';
import { useEditorAuth } from '../../context/EditorAuthContext';

type EditorLoginFormProps = {
  compact?: boolean;
  onSuccess?: () => void;
};

function EditorLoginForm({ compact = false, onSuccess }: EditorLoginFormProps) {
  const { login, email } = useEditorAuth();
  const [username, setUsername] = useState(email);

  useEffect(() => {
    if (email) setUsername(email);
  }, [email]);
  const [password, setPassword] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Enter username and password.');
      return;
    }

    setAuthenticating(true);
    const result = await login(username.trim(), password);
    setAuthenticating(false);

    if (!result.success) {
      setError(result.error || 'Invalid login credentials.');
      return;
    }

    setPassword('');
    onSuccess?.();
  };

  return (
    <div className={compact ? '' : 'rounded-2xl border border-primary/20 bg-cream p-6 sm:p-8 shadow-xl ring-1 ring-primary/10'}>
      {!compact ? (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Editor sign in</h2>
          <p className="text-sm text-gray-600 mb-6">
            Authorized editors can upload publications, manage attachments, and remove outdated case studies.
          </p>
        </>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="editor-login-username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="editor-login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label htmlFor="editor-login-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="editor-login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" size="md" variant="primary" disabled={authenticating}>
          {authenticating ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

export default EditorLoginForm;
