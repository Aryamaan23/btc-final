import { FormEvent, useState } from 'react';
import { Button } from '../common';
import { useEditorAuth } from '../../context/EditorAuthContext';
import { updateCaseStudy } from '../../services/caseStudyService';
import type { CaseStudy } from '../../types';

type CaseStudyEditFormProps = {
  article: CaseStudy;
  onSaved: (updated: CaseStudy) => void;
  onCancel: () => void;
};

function CaseStudyEditForm({ article, onSaved, onCancel }: CaseStudyEditFormProps) {
  const { getCredentials } = useEditorAuth();
  const [form, setForm] = useState({
    title: article.title,
    studentName: article.studentName,
    program: article.program,
    summary: article.summary,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const credentials = getCredentials();
    if (!credentials) {
      setError('Unlock editing with your password before saving changes.');
      return;
    }

    if (form.summary.trim().length < 20) {
      setError('Summary should be at least 20 characters.');
      return;
    }

    setSaving(true);
    const result = await updateCaseStudy({
      caseStudyId: article.id,
      title: form.title.trim(),
      studentName: form.studentName.trim(),
      program: form.program.trim(),
      summary: form.summary.trim(),
      ...credentials,
    });
    setSaving(false);

    if (!result.success || !result.caseStudy) {
      setError(result.error || 'Could not save changes.');
      return;
    }

    onSaved(result.caseStudy);
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-cream/50 p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Edit publication</h2>
      <p className="text-sm text-gray-600 mb-6">
        Update the article text shown on the site. File attachments are unchanged — upload a new publication to
        replace files.
      </p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="edit-student" className="block text-sm font-medium text-gray-700 mb-1">
            Student name
          </label>
          <input
            id="edit-student"
            type="text"
            value={form.studentName}
            onChange={(e) => setForm((prev) => ({ ...prev, studentName: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="edit-program" className="block text-sm font-medium text-gray-700 mb-1">
            Programme
          </label>
          <input
            id="edit-program"
            type="text"
            value={form.program}
            onChange={(e) => setForm((prev) => ({ ...prev, program: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="edit-summary" className="block text-sm font-medium text-gray-700 mb-1">
            Article / summary
          </label>
          <textarea
            id="edit-summary"
            value={form.summary}
            onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
            rows={8}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" size="md" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button type="button" size="md" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CaseStudyEditForm;
