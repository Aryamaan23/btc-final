export const EDITOR_AUTH_STORAGE_KEY = 'btc_editor_logged_in';
export const EDITOR_EMAIL_STORAGE_KEY = 'btc_editor_email';
export const EDITOR_PASSWORD_SESSION_KEY = 'btc_editor_session_password';
export const EDITOR_AUTH_EVENT = 'btc-editor-auth-changed';

export function readEditorLoggedInFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(EDITOR_AUTH_STORAGE_KEY) === 'true';
}

export function readEditorEmail(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(EDITOR_EMAIL_STORAGE_KEY) || '';
}

export function readEditorSessionPassword(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(EDITOR_PASSWORD_SESSION_KEY) || '';
}

export function persistEditorSession(email: string, password: string): void {
  localStorage.setItem(EDITOR_AUTH_STORAGE_KEY, 'true');
  localStorage.setItem(EDITOR_EMAIL_STORAGE_KEY, email);
  sessionStorage.setItem(EDITOR_PASSWORD_SESSION_KEY, password);
  window.dispatchEvent(new Event(EDITOR_AUTH_EVENT));
}

export function clearEditorSession(): void {
  localStorage.removeItem(EDITOR_AUTH_STORAGE_KEY);
  localStorage.removeItem(EDITOR_EMAIL_STORAGE_KEY);
  sessionStorage.removeItem(EDITOR_PASSWORD_SESSION_KEY);
  window.dispatchEvent(new Event(EDITOR_AUTH_EVENT));
}

export function getEditorCredentials(): { editorEmail: string; editorPassword: string } | null {
  const editorEmail = readEditorEmail().trim();
  const editorPassword = readEditorSessionPassword();
  if (!readEditorLoggedInFlag() || !editorEmail || !editorPassword) {
    return null;
  }
  return { editorEmail, editorPassword };
}
