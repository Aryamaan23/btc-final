import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authenticateCaseStudyEditor } from '../services/caseStudyService';
import {
  EDITOR_AUTH_EVENT,
  clearEditorSession,
  getEditorCredentials,
  persistEditorSession,
  readEditorEmail,
  readEditorLoggedInFlag,
} from '../lib/editorAuth';

type EditorAuthContextValue = {
  isLoggedIn: boolean;
  hasActiveSession: boolean;
  email: string;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  unlockSession: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getCredentials: () => { editorEmail: string; editorPassword: string } | null;
};

const EditorAuthContext = createContext<EditorAuthContextValue | null>(null);

function syncStateFromStorage() {
  return {
    isLoggedIn: readEditorLoggedInFlag(),
    email: readEditorEmail(),
    hasActiveSession: Boolean(getEditorCredentials()),
  };
}

export function EditorAuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const refreshFromStorage = useCallback(() => {
    const next = syncStateFromStorage();
    setIsLoggedIn(next.isLoggedIn);
    setEmail(next.email);
    setHasActiveSession(next.hasActiveSession);
  }, []);

  useEffect(() => {
    refreshFromStorage();

    const handleAuthChange = () => refreshFromStorage();
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener(EDITOR_AUTH_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener(EDITOR_AUTH_EVENT, handleAuthChange);
    };
  }, [refreshFromStorage]);

  const login = useCallback(async (nextEmail: string, password: string) => {
    const trimmedEmail = nextEmail.trim();
    const result = await authenticateCaseStudyEditor({
      editorEmail: trimmedEmail,
      editorPassword: password,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Invalid login credentials.' };
    }

    persistEditorSession(trimmedEmail, password);
    refreshFromStorage();
    return { success: true };
  }, [refreshFromStorage]);

  const unlockSession = useCallback(
    async (password: string) => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return { success: false, error: 'Editor username not found. Please sign in again.' };
      }
      return login(trimmedEmail, password);
    },
    [email, login]
  );

  const logout = useCallback(() => {
    clearEditorSession();
    refreshFromStorage();
  }, [refreshFromStorage]);

  const getCredentials = useCallback(() => getEditorCredentials(), []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      hasActiveSession,
      email,
      login,
      unlockSession,
      logout,
      getCredentials,
    }),
    [email, getCredentials, hasActiveSession, isLoggedIn, login, logout, unlockSession]
  );

  return <EditorAuthContext.Provider value={value}>{children}</EditorAuthContext.Provider>;
}

export function useEditorAuth(): EditorAuthContextValue {
  const context = useContext(EditorAuthContext);
  if (!context) {
    throw new Error('useEditorAuth must be used within EditorAuthProvider');
  }
  return context;
}

/** Safe hook for optional editor UI outside provider (should not happen). */
export function useEditorAuthOptional(): EditorAuthContextValue | null {
  return useContext(EditorAuthContext);
}
