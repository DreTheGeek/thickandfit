// Client form page. Requires auth; the form must be published and assigned to this client.
import { requireAuth } from '@/lib/auth/guards';
import { getForm } from '@/lib/forms/engine';
import { createServiceClient } from '@/lib/supabase/service';
import { FormRenderer } from '@/components/forms/form-renderer';

export const dynamic = 'force-dynamic';

export default async function ClientFormPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: assigned } = await supabase
    .from('form_assignments')
    .select('id')
    .eq('form_id', id)
    .eq('profile_id', ctx.userId)
    .maybeSingle();

  const loaded = ctx.companyId ? await getForm(ctx.companyId, id) : null;

  if (!assigned || !loaded || loaded.form.status !== 'published') {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-black">
        <p className="text-neutral-700">This form is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-black">
      <h1 className="mb-6 text-2xl font-bold uppercase tracking-tight">{loaded.form.title_en}</h1>
      <FormRenderer formId={id} fields={loaded.fields} />
    </main>
  );
}
