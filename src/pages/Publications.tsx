import { CaseStudiesSection } from '../components/home';
import { PageHero, PageTransition } from '../components/common';
import { useSearchParams } from 'react-router-dom';

function Publications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const showDeletedPublicationAlert = searchParams.get('publicationDeleted') === '1';

  const dismissDeletedPublicationAlert = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('publicationDeleted');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <PageTransition>
      <div className="Publications min-h-screen bg-gradient-to-b from-slate-50/90 via-white to-primary-soft/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-4">
          <PageHero
            eyebrow="Publications & field documentation"
            title="Stories from the ground"
            description="Programme-wise student case studies, district immersions, and reflections — published as readable articles with downloadable sources. Editors upload and manage content from Editor login in the navigation bar."
            primaryCta={{ label: 'Browse case studies', href: '#case-studies-heading' }}
            secondaryCta={{ label: 'Contact team', href: '/contact' }}
            className="mb-6 sm:mb-8"
          />
          {showDeletedPublicationAlert ? (
            <div
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-red-800 shadow-soft"
              role="alert"
              aria-live="polite"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm sm:text-base font-medium">
                  This publication was deleted by an editor and is no longer available.
                </p>
                <button
                  type="button"
                  onClick={dismissDeletedPublicationAlert}
                  className="self-start rounded-lg border border-red-200 px-3 py-1.5 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-10 sm:mb-12">
            <div className="rounded-2xl border border-primary/15 bg-white/90 p-5 shadow-soft text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary">Articles</p>
              <p className="mt-1 text-sm text-gray-600">Full reads on-site</p>
            </div>
            <div className="rounded-2xl border border-secondary/25 bg-gradient-to-br from-secondary-soft/80 to-amber-50/60 p-5 shadow-soft text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-secondary-dark">Field</p>
              <p className="mt-1 text-sm text-gray-700">District & programme focus</p>
            </div>
            <div className="rounded-2xl border border-teal-500/20 bg-white/90 p-5 shadow-soft text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-teal-700">Sources</p>
              <p className="mt-1 text-sm text-gray-600">Original files & attachments</p>
            </div>
          </div>
        </div>

        <CaseStudiesSection variant="featured" />
      </div>
    </PageTransition>
  );
}

export default Publications;
