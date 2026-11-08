import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flag, MessagesSquare } from "lucide-react";
import { api, errorMessage, type Paginated } from "@/lib/api";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  Spinner,
  cn,
} from "@/components/ui";

interface ChatLogRow {
  id: number;
  question: string;
  answer: string;
  sources: Array<{ label?: string; url?: string; kind?: string }> | null;
  provider: string;
  latency_ms: number;
  session_id: string;
  flagged: boolean;
  created_at: string;
}

const PAGE_SIZE = 25;

export function ChatLogs() {
  const [page, setPage] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<ChatLogRow | null>(null);

  const query = useQuery({
    queryKey: ["chat-logs", page, flaggedOnly],
    queryFn: () =>
      api.list<ChatLogRow>("/admin/chat-logs/", {
        page,
        page_size: PAGE_SIZE,
        flagged: flaggedOnly ? "true" : undefined,
      }),
  });

  const data = query.data as Paginated<ChatLogRow> | undefined;
  const rows = data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Assistant"
        title="Chat logs"
        description="Every assistant turn: the question, the grounded answer, latency, provider and retrieval sources. Read-only."
        actions={
          <button
            type="button"
            className={cn("btn-ghost", flaggedOnly && "border-danger/40 text-danger")}
            onClick={() => {
              setFlaggedOnly((current) => !current);
              setPage(1);
            }}
            aria-pressed={flaggedOnly}
          >
            <Flag size={14} aria-hidden="true" />
            {flaggedOnly ? "Showing flagged" : "Flagged only"}
          </button>
        }
      />

      {query.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-line py-24">
          <Spinner className="h-5 w-5 text-mint" />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Logs unavailable"
          description={errorMessage(query.error)}
          action={
            <button type="button" className="btn-ghost" onClick={() => void query.refetch()}>
              Retry
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={flaggedOnly ? "No flagged conversations" : "No conversations yet"}
          description="Ask the assistant something on the public site and the exchange will appear here."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-line bg-panel-2/60">
                <tr>
                  <th className="th">Question</th>
                  <th className="th">Provider</th>
                  <th className="th">Latency</th>
                  <th className="th">When</th>
                  <th className="th text-right">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel-2/40"
                    onClick={() => setSelected(log)}
                  >
                    <td className="td">
                      <p className="max-w-[26rem] truncate text-[13px] text-paper">{log.question}</p>
                      <p className="max-w-[26rem] truncate text-[11.5px] text-fog">{log.answer}</p>
                    </td>
                    <td className="td">
                      <Badge>{log.provider || "unknown"}</Badge>
                    </td>
                    <td className="td font-mono text-[11px] text-fog">{log.latency_ms}ms</td>
                    <td className="td whitespace-nowrap font-mono text-[10.5px] text-fog">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="td text-right">
                      {log.flagged ? (
                        <Badge tone="danger">
                          <Flag size={9} aria-hidden="true" />
                          flagged
                        </Badge>
                      ) : (
                        <Badge tone="mint">grounded</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="font-mono text-[10.5px] text-fog">
              Page {page} of {totalPages} · {data?.count ?? 0} total
            </span>
            <div className="flex gap-1.5">
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
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Assistant exchange"
        description={
          selected
            ? `${new Date(selected.created_at).toLocaleString()} · ${selected.provider || "unknown"} · ${
                selected.latency_ms
              }ms`
            : undefined
        }
        wide
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {selected.flagged && <Badge tone="danger">injection flag</Badge>}
              {selected.session_id && (
                <Badge>session {selected.session_id.slice(0, 8)}</Badge>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] text-fog uppercase">Visitor</p>
              <p className="mt-1.5 rounded-lg border border-line bg-ink/50 px-3 py-2.5 text-sm text-paper">
                {selected.question}
              </p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-fog uppercase">
                <MessagesSquare size={11} aria-hidden="true" />
                Assistant
              </p>
              <p className="mt-1.5 rounded-lg border border-mint/20 bg-mint/[0.04] px-3 py-2.5 text-sm leading-7 whitespace-pre-wrap text-paper/90">
                {selected.answer || "No answer was recorded."}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] text-fog uppercase">
                Retrieval sources
              </p>
              {selected.sources && selected.sources.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {selected.sources.map((source, index) => {
                    const label = source.label ?? source.url ?? source.kind ?? `source ${index + 1}`;
                    return (
                      <li key={`${label}-${index}`}>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] text-fog hover:border-mint/40 hover:text-mint"
                          >
                            {label}
                          </a>
                        ) : (
                          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] text-fog">
                            {label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1.5 text-[12px] text-fog">No sources were attached.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
