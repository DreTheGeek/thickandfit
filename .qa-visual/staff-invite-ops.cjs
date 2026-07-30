// Staff invite ops: the same steps /admin/team's inviteTeammateAction performs, runnable without an
// operator browser session. Used to provision the launch team and to VERIFY the invite -> set
// password -> login chain end to end.
//
// Subcommands:
//   link <email>              generate the EXACT set-password URL the branded email contains
//                             (no email is sent; for verifying the chain in a browser)
//   invite <email> <role> <full name...>   create-or-update a staff account AND send the real email
//   role <email> <role>       change an existing teammate's role only
//   delete <email>            delete an auth user outright (frees the address for a clean re-invite)
//   status                    print the staff roster with invite/active state
//
// Roles: coach | assistant_coach | operator
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@supabase/supabase-js'));

const env = {};
fs.readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  });

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://www.teamthickandfit.com').replace(/\/+$/, '');
const ROLES = ['coach', 'assistant_coach', 'operator'];
const COMPANY_ID = 'c0ffee00-0000-4000-8000-000000000001';

async function serviceKey() {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase/) || [])[1];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`api-keys ${res.status}`);
  const k = (await res.json()).find((x) => x.name === 'service_role');
  if (!k?.api_key) throw new Error('service_role key not returned');
  return k.api_key;
}

(async () => {
  const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, await serviceKey(), {
    auth: { persistSession: false },
  });
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'status') {
    const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
    const pending = new Set(users.users.filter((u) => !u.last_sign_in_at).map((u) => u.id));
    const { data: staff } = await svc
      .from('profiles')
      .select('id, email, full_name, role')
      .in('role', ROLES)
      .order('role');
    for (const s of staff ?? []) {
      console.log(
        (pending.has(s.id) ? 'INVITE PENDING' : 'Active       ') +
          ` | ${s.role.padEnd(16)} | ${String(s.email).padEnd(38)} | ${s.full_name ?? ''}`,
      );
    }
    return;
  }

  if (cmd === 'delete') {
    const email = rest[0];
    const { data: prof } = await svc.from('profiles').select('id, role').ilike('email', email).maybeSingle();
    if (!prof) return console.log('no such profile:', email);
    const { error } = await svc.auth.admin.deleteUser(prof.id);
    if (error) throw new Error('deleteUser: ' + error.message);
    console.log(`deleted ${email} (was ${prof.role}, id ${prof.id})`);
    return;
  }

  if (cmd === 'role') {
    const [email, role] = rest;
    if (!ROLES.includes(role)) throw new Error('bad role: ' + role);
    const { data: prof } = await svc.from('profiles').select('id, role').ilike('email', email).maybeSingle();
    if (!prof) return console.log('no such profile:', email);
    if (prof.role === role) return console.log(`${email} is already ${role}; no change`);
    const { error } = await svc.from('profiles').update({ role }).eq('id', prof.id);
    if (error) throw new Error('role update: ' + error.message);
    console.log(`${email}: ${prof.role} -> ${role}`);
    return;
  }

  // The exact URL the branded recovery email renders, built from the real hashed token. Lets the
  // whole click-through be verified in a browser without waiting on an inbox.
  if (cmd === 'link') {
    const email = rest[0];
    const { data, error } = await svc.auth.admin.generateLink({ type: 'recovery', email });
    if (error) throw new Error('generateLink: ' + error.message);
    const tokenHash = data.properties.hashed_token;
    console.log(`${SITE}/auth/callback?token_hash=${tokenHash}&type=recovery&next=/auth/reset-password`);
    return;
  }

  // provision = invite MINUS the email. Needed while the Resend sending domain is unverified: the
  // account and role are correct, and the set-password link is handed over out of band via `link`.
  if (cmd === 'invite' || cmd === 'provision') {
    const sendEmail = cmd === 'invite';
    const [email, role, ...nameParts] = rest;
    const fullName = nameParts.join(' ');
    if (!ROLES.includes(role)) throw new Error('bad role: ' + role);
    if (!fullName) throw new Error('full name required');
    const [firstName, ...tail] = fullName.split(/\s+/);
    const lastName = tail.join(' ') || firstName;

    let { data: existing } = await svc
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .eq('company_id', COMPANY_ID)
      .maybeSingle();
    let userId = existing?.id ?? null;
    const status = userId ? 'updated' : 'created';

    if (!userId) {
      const { data: created, error: cErr } = await svc.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
      });
      if (cErr || !created?.user) throw new Error('createUser: ' + (cErr?.message ?? 'unknown'));
      userId = created.user.id;
      await new Promise((r) => setTimeout(r, 1500)); // let the on_auth_user_created trigger land
    }

    const { error: upErr } = await svc
      .from('profiles')
      .update({ role, full_name: fullName, company_id: COMPANY_ID })
      .eq('id', userId);
    if (upErr) throw new Error('profile update: ' + upErr.message);

    if (!sendEmail) {
      console.log(`${status}: ${email} as ${role} (${fullName}) -> NO email sent (provision)`);
      return;
    }

    const { error: mailErr } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE}/auth/callback?next=/auth/reset-password`,
    });
    if (mailErr) throw new Error('email: ' + mailErr.message);

    console.log(`${status}: ${email} as ${role} (${fullName}) -> set-password email sent`);
    return;
  }

  console.log('usage: status | link <email> | invite <email> <role> <name...> | role <email> <role> | delete <email>');
})().catch((e) => {
  console.error('FATAL', e.message || e);
  process.exit(1);
});
