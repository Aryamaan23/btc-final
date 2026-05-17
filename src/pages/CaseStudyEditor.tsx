import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageHero, PageTransition } from '../components/common';
import { EditorLoginForm, EditorWorkspaceBar } from '../components/editor';
import PublishedCaseStudiesList from '../components/home/PublishedCaseStudiesList';
import { useEditorAuth } from '../context/EditorAuthContext';
import { useCaseStudyEditorActions } from '../hooks/useCaseStudyEditorActions';
import { uploadCaseStudy, fetchCaseStudies } from '../services/caseStudyService';
import type { CaseStudy } from '../types';

const FALLBACK_PROGRAM = 'Dholpur District Immersion Plan';

function CaseStudyEditor() {
  const { isLoggedIn, hasActiveSession, getCredentials, email } = useEditorAuth();
  const [items, setItems] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({
    title: '',
    studentName: '',
    program: FALLBACK_PROGRAM,
    summary: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

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

  const {
    canEdit,
    deletingId,
    actionError,
    actionMessage,
    setActionError,
    setActionMessage,
    handleDeleteCaseStudy,
  } = useCaseStudyEditorActions(load);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.title.trim() &&
        form.studentName.trim() &&
        form.program.trim() &&
        form.summary.trim() &&
        file &&
        hasActiveSession
    );
  }, [file, form, hasActiveSession]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitMessage('');
    setActionError('');
    setActionMessage('');

    if (!hasActiveSession) {
      setSubmitError('Unlock editing with your password before uploading.');
      return;
    }

    const credentials = getCredentials();
    if (!credentials) {
      setSubmitError('Editor session expired. Please sign in again.');
      return;
    }

    if (!canSubmit || !file) {
      setSubmitError('Please fill all fields and attach the case study file.');
      return;
    }

    setSubmitting(true);

    const result = await uploadCaseStudy({
      title: form.title.trim(),
      studentName: form.studentName.trim(),
      program: form.program.trim(),
      summary: form.summary.trim(),
      file,
      attachments,
      ...credentials,
    });

    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error || 'Upload failed. Please try again.');
      return;
    }

    setForm({
      title: '',
      studentName: '',
      program: FALLBACK_PROGRAM,
      summary: '',
    });
    setFile(null);
    setAttachments([]);
    setSubmitMessage('Case study uploaded successfully.');
    await load();
  };

  const statusMessage = submitMessage || actionMessage;
  const statusError = submitError || actionError;

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-slate-50/90 via-white to-primary-soft/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-6">
          <PageHero
            eyebrow="Editors only"
            title="Upload & manage publications"
            description="Sign in once to publish case studies, manage attachments, and remove outdated articles. Your session stays active as you move across Publications pages."
            className="mb-6"
          />
          <p className="text-center text-sm text-gray-600 mb-6">
            <Link to="/publications" className="font-semibold text-primary hover:underline">
              ← Back to Publications
            </Link>
          </p>
          {isLoggedIn ? <EditorWorkspaceBar className="mb-8" /> : null}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12">
            <div className="lg:col-span-2">
              {!isLoggedIn ? (
                <EditorLoginForm />
              ) : !hasActiveSession ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-950">
                  <p className="font-semibold mb-2">Almost ready</p>
                  <p>
                    You are signed in as <span className="font-medium">{email}</span>. Confirm your password in the
                    workspace bar above to upload or delete publications.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-primary/20 bg-cream p-6 sm:p-8 shadow-xl ring-1 ring-primary/10">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload a case study</h2>
                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="case-title" className="block text-sm font-medium text-gray-700 mb-1">
                        Case study title
                      </label>
                      <input
                        id="case-title"
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="case-student" className="block text-sm font-medium text-gray-700 mb-1">
                        Student name
                      </label>
                      <input
                        id="case-student"
                        type="text"
                        value={form.studentName}
                        onChange={(e) => setForm((prev) => ({ ...prev, studentName: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="case-program" className="block text-sm font-medium text-gray-700 mb-1">
                        Programme
                      </label>
                      <input
                        id="case-program"
                        type="text"
                        value={form.program}
                        onChange={(e) => setForm((prev) => ({ ...prev, program: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="case-summary" className="block text-sm font-medium text-gray-700 mb-1">
                        Summary
                      </label>
                      <textarea
                        id="case-summary"
                        value={form.summary}
                        onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="case-file" className="block text-sm font-medium text-gray-700 mb-1">
                        Main file (PDF / DOC / DOCX)
                      </label>
                      <input
                        id="case-file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary file:font-semibold hover:file:bg-primary/20"
                        required
                      />
                      {file ? <p className="mt-1 text-xs text-gray-500">Selected: {file.name}</p> : null}
                    </div>
                    <div>
                      <label htmlFor="case-attachments" className="block text-sm font-medium text-gray-700 mb-1">
                        Attachments (optional)
                      </label>
                      <input
                        id="case-attachments"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary/20 file:px-3 file:py-1.5 file:text-primary-dark file:font-semibold hover:file:bg-secondary/30"
                      />
                      {attachments.length > 0 ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {attachments.length} attachment{attachments.length === 1 ? '' : 's'} selected
                        </p>
                      ) : null}
                    </div>
                    {statusError ? <p className="text-sm text-red-600">{statusError}</p> : null}
                    {statusMessage ? <p className="text-sm text-green-700">{statusMessage}</p> : null}
                    <Button type="submit" size="md" variant="primary" disabled={submitting || !canSubmit}>
                      {submitting ? 'Uploading...' : 'Upload case study'}
                    </Button>
                  </form>
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <PublishedCaseStudiesList
                variant="featured"
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
                <p className="mt-4 text-sm text-amber-800 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  Unlock editing to delete publications from this list.
                </p>
              ) : null}
              {statusError && isLoggedIn ? <p className="mt-4 text-sm text-red-600">{statusError}</p> : null}
              {statusMessage && isLoggedIn && !submitMessage ? (
                <p className="mt-4 text-sm text-green-700">{statusMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default CaseStudyEditor;
