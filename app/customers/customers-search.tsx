"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SEARCH_PARAM } from "@/lib/quotations/search";

/**
 * Search box for the customers index.
 *
 * Same shape as the quotations one: a real `<form method="get">`, so it still
 * narrows the list if the JS bundle never arrives, and once it has, `onSubmit`
 * navigates client-side while `useTransition` reports the pending state.
 */
export function CustomersSearch({ term }: { term: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(term);
  const [appliedTerm, setAppliedTerm] = useState(term);

  /*
   * Follow the URL when the term changes from outside the box — Clear, the back
   * button — rather than stranding a stale value in it.
   */
  if (term !== appliedTerm) {
    setAppliedTerm(term);
    setValue(term);
  }

  function search(next: string) {
    const query = next.trim();

    startTransition(() => {
      router.push(
        query
          ? `/customers?${SEARCH_PARAM}=${encodeURIComponent(query)}`
          : "/customers",
      );
    });
  }

  return (
    <form
      action="/customers"
      method="get"
      role="search"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        search(value);
      }}
      className="mb-5 flex flex-wrap items-center gap-2.5"
    >
      <input
        type="search"
        name={SEARCH_PARAM}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search name, city or contact person"
        aria-label="Search customers"
        autoComplete="off"
        spellCheck={false}
        className="reydex-field h-10 min-w-0 flex-1 rounded-lg px-3.5 text-sm text-gold-100 placeholder:text-gold-100/35"
      />

      <button
        type="submit"
        disabled={pending}
        className="reydex-submit inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
      >
        Search
      </button>

      {term ? (
        <button
          type="button"
          onClick={() => search("")}
          className="inline-flex h-10 items-center rounded-lg border border-gold-500/25 px-4 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
