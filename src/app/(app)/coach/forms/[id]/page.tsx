// Coach form builder page. Coach-guarded. id === 'new' starts blank, otherwise loads the form.
import { requireCoach } from '@/lib/auth/guards';
import { getForm } from '@/lib/forms/engine';
import { FormBuilder } from '@/components/forms/form-builder';

export const dynamic = 'force-dynamic';

type Initial = {
  id?: string;
  title_en: string;
  title_es?: string;
  fields: { type: string; label_en: string; label_es?: string; required: boolean }[];
};

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCoach();
  const { id } = await params;

  let initial: Initial = { title_en: '', fields: [] };
  if (id !== 'new' && ctx.companyId) {
    const loaded = await getForm(ctx.companyId, id);
    if (loaded) {
      initial = {
        id: loaded.form.id,
        title_en: loaded.form.title_en,
        title_es: loaded.form.title_es ?? undefined,
        fields: loaded.fields.map((f) => ({
          type: f.type,
          label_en: f.label_en,
          label_es: f.label_es ?? undefined,
          required: f.required,
        })),
      };
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-black">
      <h1 className="mb-6 text-2xl font-bold uppercase tracking-tight">Form builder</h1>
      <FormBuilder initial={initial} />
    </main>
  );
}
