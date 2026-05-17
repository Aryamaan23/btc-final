import { useCallback, useState } from 'react';
import { deleteCaseStudy } from '../services/caseStudyService';
import { useEditorAuth } from '../context/EditorAuthContext';

export function useCaseStudyEditorActions(onAfterChange?: () => void | Promise<void>) {
  const { hasActiveSession, getCredentials } = useEditorAuth();
  const [deletingId, setDeletingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const handleDeleteCaseStudy = useCallback(
    async (caseStudyId: string, caseStudyTitle: string) => {
      setActionError('');
      setActionMessage('');

      if (!hasActiveSession) {
        setActionError('Unlock editing with your password before deleting publications.');
        return;
      }

      const credentials = getCredentials();
      if (!credentials) {
        setActionError('Editor session expired. Please sign in again.');
        return;
      }

      const confirmed = window.confirm(
        `Delete "${caseStudyTitle}"? This cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingId(caseStudyId);
      const result = await deleteCaseStudy({
        caseStudyId,
        ...credentials,
      });
      setDeletingId('');

      if (!result.success) {
        setActionError(result.error || 'Delete failed. Please try again.');
        return;
      }

      setActionMessage('Publication deleted.');
      await onAfterChange?.();
    },
    [getCredentials, hasActiveSession, onAfterChange]
  );

  return {
    canEdit: hasActiveSession,
    deletingId,
    actionError,
    actionMessage,
    setActionError,
    setActionMessage,
    handleDeleteCaseStudy,
  };
}
