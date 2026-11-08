import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  api,
  ApiError,
  errorMessage,
  type Paginated,
} from "@/lib/api";
import type { FieldConfig, ResourceConfig, SelectOption } from "@/lib/resources";
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  Toggle,
  cn,
  useToast,
} from "@/components/ui";

type Row = Record<string, unknown>;
type FormValues = Record<string, string | number | boolean | null>;

const PAGE_SIZE = 25;

function initialValues(config: ResourceConfig, row?: Row): FormValues {
  const values: FormValues = {};
  for (const field of config.fields) {
    const raw = row ? row[field.name] : config.createDefaults?.[field.name];
    if (field.type === "checkbox") {
      values[field.name] = Boolean(raw);
    } else if (field.type === "number" || field.type === "relation") {
      values[field.name] = raw === null || raw === undefined ? "" : String(raw);
    } else if (field.type === "date") {
      values[field.name] =
        typeof raw === "string" && raw ? raw.slice(0, 10) : "";
    } else {
      values[field.name] =
        raw === null || raw === undefined
          ? ""
          : typeof raw === "string"
            ? raw
            : String(raw);
    }
  }
  return values;
}

function buildPayload(config: ResourceConfig, values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (field.type === "file") continue;
    const value = values[field.name];

    if (field.type === "checkbox") {
      payload[field.name] = Boolean(value);
      continue;
    }
    if (field.type === "number" || field.type === "relation") {
      payload[field.name] = value === "" || value === null ? null : Number(value);
      continue;
    }
    if (field.type === "date") {
      payload[field.name] = value === "" ? null : value;
      continue;
    }
    payload[field.name] = typeof value === "string" ? value.trim() : (value ?? "");
  }
  return payload;
}

function statusTone(value: string) {
  if (["completed", "live", "true"].includes(value)) return "mint" as const;
  if (["ongoing", "in_progress"].includes(value)) return "flame" as const;
  if (["planned", "upcoming"].includes(value)) return "violet" as const;
  return "muted" as const;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: Row } | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const listQuery = useQuery({
    queryKey: ["resource", config.key, page, debouncedSearch, filters],
    queryFn: () =>
      api.list<Row>(config.path, {
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch,
        ...filters,
      }),
  });

  const relationPaths = useMemo(
    () =>
      Array.from(
        new Set(
          config.fields
            .filter((field) => field.relation)
            .map((field) => field.relation!.path),
        ),
      ),
    [config],
  );

  const relationLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const field of config.fields) {
      if (field.relation) labels[field.relation.path] = field.relation.labelField;
    }
    return labels;
  }, [config]);

  const relationResults = useQueries({
    queries: relationPaths.map((path) => ({
      queryKey: ["relation", path],
      queryFn: () => api.list<Row>(path, { page_size: 500 }),
      staleTime: 60_000,
    })),
  });

  const relationOptions = useMemo(() => {
    const options: Record<string, SelectOption[]> = {};
    relationPaths.forEach((path, index) => {
      const data = relationResults[index]?.data as Paginated<Row> | undefined;
      const labelField = relationLabels[path] ?? "name";
      options[path] =
        data?.results.map((row) => ({
          value: String(row.id),
          label: String(row[labelField] ?? `#${String(row.id)}`),
        })) ?? [];
    });
    return options;
  }, [relationPaths, relationResults, relationLabels]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["resource"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function openCreate() {
    setEditing({ mode: "create" });
    setValues(initialValues(config));
    setFiles({});
    setFieldErrors({});
    setFormError(null);
  }

  function openEdit(row: Row) {
    setEditing({ mode: "edit", row });
    setValues(initialValues(config, row));
    setFiles({});
    setFieldErrors({});
    setFormError(null);
  }

  function closeEditor() {
    if (saveMutation.isPending) return;
    setEditing(null);
    setFiles({});
    setFormError(null);
    setFieldErrors({});
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Nothing to save.");
      const payload = buildPayload(config, values);
      const mode = editing.mode;
      const existingId = editing.row?.id as number | string | undefined;

      let savedId = existingId;
      if (mode === "create" && config.createWithUpload) {
        const form = new FormData();
        for (const [key, value] of Object.entries(payload)) {
          if (value === null || value === "") continue;
          form.append(key, String(value));
        }
        const file = Object.values(files).find(Boolean);
        if (!file) throw new Error("This resource needs an image before it can be created.");
        form.append("image", file);
        const created = await api.createMultipart<Row>(config.path, form);
        savedId = created.id as number;
      } else if (mode === "create") {
        const created = await api.create<Row>(config.path, payload);
        savedId = created.id as number;
      } else {
        await api.update<Row>(config.path, existingId!, payload);
      }

      for (const [field, file] of Object.entries(files)) {
        if (file && savedId !== undefined) {
          await api.upload(config.path, savedId, field, file);
        }
      }
      return savedId;
    },
    onSuccess: () => {
      toast.push(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} saved.`);
      setEditing(null);
      setFiles({});
      invalidate();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.details) {
        setFieldErrors(error.details);
      }
      setFormError(errorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Row) => api.remove(config.path, row.id as number),
    onSuccess: () => {
      toast.push(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} deleted.`);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.push(errorMessage(error), "error"),
  });

  const listFields = config.fields.filter((field) => field.inList);
  const rows = listQuery.data?.results ?? [];
  const total = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={15} aria-hidden="true" />
            New {config.singular}
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fog"
            aria-hidden="true"
          />
          <input
            className="input pl-9"
            placeholder={config.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={`Search ${config.title}`}
          />
        </div>
        {config.filters?.map((filter) => (
          <select
            key={filter.name}
            className="input w-auto min-w-[140px]"
            aria-label={`Filter by ${filter.label}`}
            value={filters[filter.name] ?? ""}
            onChange={(event) =>
              setFilters((current) => {
                const next = { ...current };
                if (event.target.value) next[filter.name] = event.target.value;
                else delete next[filter.name];
                return next;
              })
            }
          >
            <option value="">All {filter.label.toLowerCase()}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <span className="font-mono text-[10.5px] tracking-[0.1em] text-fog uppercase">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      {listQuery.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-line py-20">
          <Spinner className="h-5 w-5 text-mint" />
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          title="Could not load this list"
          description={errorMessage(listQuery.error)}
          action={
            <button type="button" className="btn-ghost" onClick={() => void listQuery.refetch()}>
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? "No matches" : `No ${config.title.toLowerCase()} yet`}
          description={
            debouncedSearch
              ? "Try a different search term or clear the filters."
              : `Create the first ${config.singular} — it will appear on the public site immediately.`
          }
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={15} aria-hidden="true" />
              New {config.singular}
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-line bg-panel-2/60">
                <tr>
                  {listFields.map((field) => (
                    <th key={field.name} className="th">
                      {field.label}
                    </th>
                  ))}
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={String(row.id)}
                    className="border-b border-line/60 last:border-0 hover:bg-panel-2/40"
                  >
                    {listFields.map((field) => (
                      <td key={field.name} className="td">
                        <Cell
                          field={field}
                          row={row}
                          relationOptions={relationOptions}
                        />
                      </td>
                    ))}
                    <td className="td text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {typeof row.slug === "string" && row.slug && (
                          <a
                            href={`${import.meta.env.VITE_SITE_URL ?? "http://localhost:5173"}/projects/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="icon-btn"
                            aria-label="View on site"
                            title="View on site"
                          >
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${config.singular}`}
                          title="Edit"
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn hover:border-danger/40 hover:text-danger"
                          onClick={() => setDeleteTarget(row)}
                          aria-label={`Delete ${config.singular}`}
                          title="Delete"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="font-mono text-[10.5px] text-fog">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={closeEditor}
        title={
          editing?.mode === "create"
            ? `New ${config.singular}`
            : `Edit ${config.singular}`
        }
        description={
          editing?.mode === "edit" && typeof editing.row?.title === "string"
            ? editing.row.title
            : undefined
        }
        wide
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={closeEditor}
              disabled={saveMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Spinner />}
              {editing?.mode === "create" ? "Create" : "Save changes"}
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <div
              key={field.name}
              className={cn(field.full || field.type === "textarea" ? "sm:col-span-2" : "")}
            >
              <FieldRenderer
                field={field}
                value={values[field.name]}
                row={editing?.row}
                error={fieldErrors[field.name]?.[0]}
                options={
                  field.relation
                    ? (relationOptions[field.relation.path] ?? [])
                    : (field.options ?? [])
                }
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.name]: value }))
                }
                onFile={(file) =>
                  setFiles((current) => ({ ...current, [field.name]: file }))
                }
              />
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.singular}?`}
        message={`This permanently removes “${String(
          deleteTarget?.title ?? deleteTarget?.name ?? deleteTarget?.question ?? deleteTarget?.label ?? deleteTarget?.text ?? deleteTarget?.id ?? "",
        )}”. This cannot be undone.`}
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </>
  );
}

function Cell({
  field,
  row,
  relationOptions,
}: {
  field: FieldConfig;
  row: Row;
  relationOptions: Record<string, SelectOption[]>;
}) {
  const value = row[field.name];

  if (field.type === "checkbox") {
    return value ? <Badge tone="mint">Live</Badge> : <Badge>Hidden</Badge>;
  }

  if (field.type === "select") {
    const label =
      field.options?.find((option) => option.value === String(value))?.label ??
      String(value ?? "—");
    return <Badge tone={statusTone(String(value))}>{label}</Badge>;
  }

  if (field.type === "relation") {
    const label = field.relation
      ? relationOptions[field.relation.path]?.find(
          (option) => option.value === String(value),
        )?.label
      : undefined;
    return <span>{label ?? "—"}</span>;
  }

  if (field.type === "date") {
    return <span className="font-mono text-xs text-fog">{formatDate(value)}</span>;
  }

  if (field.type === "file") {
    return value ? <Badge tone="mint">Uploaded</Badge> : <span className="text-fog">—</span>;
  }

  if (field.type === "number") {
    return <span className="font-mono text-xs">{value === null || value === "" ? "—" : String(value)}</span>;
  }

  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return (
    <span className={cn("block max-w-[18rem] truncate", field.mono && "font-mono text-xs text-fog")} title={text}>
      {text || "—"}
    </span>
  );
}

function FieldRenderer({
  field,
  value,
  row,
  error,
  options,
  onChange,
  onFile,
}: {
  field: FieldConfig;
  value: string | number | boolean | null | undefined;
  row?: Row;
  error?: string;
  options: SelectOption[];
  onChange: (value: string | number | boolean) => void;
  onFile: (file: File | null) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <Toggle
        checked={Boolean(value)}
        onChange={onChange}
        label={field.label}
        hint={field.hint}
      />
    );
  }

  const common = {
    id: `field-${field.name}`,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <Field label={`${field.label}${field.required ? " *" : ""}`} hint={field.hint} error={error}>
      {field.type === "textarea" ? (
        <textarea
          {...common}
          className="input resize-y"
          rows={field.rows ?? 4}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" || field.type === "relation" ? (
        <select
          {...common}
          className="input"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {field.required ? `Select ${field.label.toLowerCase()}…` : "— none —"}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <div>
          <input
            {...common}
            type="file"
            accept={field.accept}
            className="block w-full text-xs text-fog file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-paper/80 file:hover:bg-[#182231]"
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
          {typeof row?.[field.name] === "string" &&
            (row[field.name] as string).length > 0 && (
            <a
              href={String(row[field.name])}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-mint hover:underline"
            >
              <ExternalLink size={11} aria-hidden="true" />
              Current file
            </a>
          )}
        </div>
      ) : (
        <input
          {...common}
          className={cn("input", field.mono && "font-mono text-xs")}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
