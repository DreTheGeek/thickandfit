'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';

export type ClientUrl = {
  sp: ReadonlyURLSearchParams;
  pending: boolean;
  setParam: (key: string, value: string | null) => void;
  setSort: (field: string) => void;
  toggleMulti: (key: string, value: string) => void;
  removeValue: (key: string, value: string) => void;
  clearAll: () => void;
  applyFilterSet: (def: Record<string, unknown>, segment?: string) => void;
};

/** Shared URL-as-state helpers for the Clients CRM. All filter state lives in the URL. */
export function useClientFilterUrl(): ClientUrl {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const commit = useCallback(
    (next: URLSearchParams, keepPage = false) => {
      if (!keepPage) next.delete('page');
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(sp.toString());
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
      // a filter change (anything but sort/dir/page) invalidates the active smart list
      if (key !== 'sort' && key !== 'dir' && key !== 'page' && key !== 'segment') next.delete('segment');
      commit(next, key === 'sort' || key === 'dir' || key === 'page');
    },
    [sp, commit],
  );

  const setSort = useCallback(
    (field: string) => {
      const next = new URLSearchParams(sp.toString());
      const curField = next.get('sort') ?? 'name';
      const curDir = next.get('dir') ?? 'asc';
      if (curField === field) next.set('dir', curDir === 'asc' ? 'desc' : 'asc');
      else {
        next.set('sort', field);
        next.set('dir', 'asc');
      }
      commit(next, true);
    },
    [sp, commit],
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      const cur = next.getAll(key);
      next.delete(key);
      if (cur.includes(value)) cur.filter((v) => v !== value).forEach((v) => next.append(key, v));
      else [...cur, value].forEach((v) => next.append(key, v));
      next.delete('segment');
      commit(next);
    },
    [sp, commit],
  );

  const removeValue = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      const cur = next.getAll(key);
      next.delete(key);
      cur.filter((v) => v !== value).forEach((v) => next.append(key, v));
      next.delete('segment');
      commit(next);
    },
    [sp, commit],
  );

  const clearAll = useCallback(() => {
    start(() => router.replace(pathname, { scroll: false }));
  }, [router, pathname]);

  const applyFilterSet = useCallback(
    (def: Record<string, unknown>, segment?: string) => {
      const next = new URLSearchParams();
      for (const [key, val] of Object.entries(def)) {
        if (Array.isArray(val)) val.forEach((v) => next.append(key, String(v)));
        else if (val != null && val !== '' && val !== false) next.set(key, String(val));
      }
      if (segment) next.set('segment', segment);
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  return { sp, pending, setParam, setSort, toggleMulti, removeValue, clearAll, applyFilterSet };
}
