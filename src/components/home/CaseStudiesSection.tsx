import { useEffect, useState } from 'react';
import { fetchCaseStudies } from '../../services/caseStudyService';
import type { CaseStudy } from '../../types';
import PublishedCaseStudiesList from './PublishedCaseStudiesList';
import { EditorWorkspaceBar } from '../editor';
import { useEditorAuth } from '../../context/EditorAuthContext';
import { useCaseStudyEditorActions } from '../../hooks/useCaseStudyEditorActions';

export type CaseStudiesSectionProps = {
  /** Larger cards and richer layout for the Publications page */
  variant?: 'default' | 'featured';
};

function CaseStudiesSection({ variant = 'default' }: CaseStudiesSectionProps) {
  const isFeatured = variant === 'featured';
  const { isLoggedIn } = useEditorAuth();
  const [items, setItems] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const result = await fetchCaseStudies();
    if (result.success) {
      setItems(result.caseStudies || []);
    } else {
      setLoadError(result.error || 'Could not load case studies right now.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const { canEdit, deletingId, actionError, actionMessage, handleDeleteCaseStudy } =
    useCaseStudyEditorActions(load);

  return (
    <section
      className={`relative overflow-hidden ${
        isFeatured
          ? 'pt-8 sm:pt-10 md:pt-12 pb-20 sm:pb-24 md:pb-28 bg-gradient-to-b from-white via-primary-soft/30 to-cream-dark/80'
          : 'py-16 sm:py-20 md:py-28 bg-white'
      }`}
      aria-labelledby="case-studies-heading"
    >
      <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden="true">
        <div
          className="absolute top-8 left-4 w-56 h-40 rounded-2xl bg-cover bg-center shadow-lg hidden md:block"
          style={{ backgroundImage: "url('/images/projects/project-1.jpg')" }}
        />
        <div
          className="absolute top-24 right-6 w-52 h-36 rounded-2xl bg-cover bg-center shadow-lg hidden lg:block"
          style={{ backgroundImage: "url('/images/projects/project-3.jpg')" }}
        />
        <div
          className="absolute bottom-10 left-10 w-60 h-40 rounded-2xl bg-cover bg-center shadow-lg hidden lg:block"
          style={{ backgroundImage: "url('/images/projects/project-5.jpg')" }}
        />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isFeatured && isLoggedIn ? <EditorWorkspaceBar className="mb-8 sm:mb-10" /> : null}

        <div className={`text-center ${isFeatured ? 'mb-8 sm:mb-10' : 'mb-10 sm:mb-12'}`}>
          <span
            className={`inline-block text-secondary font-semibold tracking-wider uppercase mb-3 ${
              isFeatured ? 'text-sm sm:text-base' : 'text-sm'
            }`}
          >
            Student Submissions
          </span>
          <h2
            id="case-studies-heading"
            className={`font-bold text-gray-900 tracking-tight ${
              isFeatured ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-2xl sm:text-3xl md:text-4xl'
            }`}
          >
            Case Studies
          </h2>
          <p
            className={`text-gray-600 max-w-3xl mx-auto mt-4 leading-relaxed ${
              isFeatured ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
            }`}
          >
            {isLoggedIn
              ? 'You are in editor mode — open any article to review it, or use Upload & manage to publish new work. Delete controls appear on each card when your session is unlocked.'
              : 'Programme-wise student case studies and field reflections — read full articles on-site and download original files.'}
          </p>
        </div>

        {actionError ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
        ) : null}
        {actionMessage ? (
          <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {actionMessage}
          </p>
        ) : null}

        <PublishedCaseStudiesList
          variant={variant}
          items={items}
          loading={loading}
          loadError={loadError}
          onRefresh={() => void load()}
          showDelete={canEdit}
          showEdit={canEdit}
          onDelete={handleDeleteCaseStudy}
          deletingId={deletingId}
        />

        {isLoggedIn && !canEdit ? (
          <p className="mt-6 text-center text-sm text-amber-800">
            Confirm your password in the editor bar above to delete publications from this page.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default CaseStudiesSection;
