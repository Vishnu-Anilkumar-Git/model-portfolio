import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { api, errorMessage, type Paginated } from "@/lib/api";
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Spinner,
  cn,
  useToast,
} from "@/components/ui";

interface MessageRow {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  is_read: boolean;
  user_agent: string;
}

const PAGE_SIZE = 20;

export function Messages() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageRow | null>(null);

  const query = useQuery({
    queryKey: ["messages", page, unreadOnly],
    queryFn: () =>
      api.list<MessageRow>("/admin/messages/", {
        page,
        page_size: PAGE_SIZE,
        unread: unreadOnly ? "true" : undefined,
      }),
  });

  const data = query.data as Paginated<MessageRow> | undefined;
  const rows = data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["messages"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const markRead = useMutation({
    mutationFn: ({ id, is_read }: { id: number; is_read: boolean }) =>
      api.update(`/admin/messages/`, id, { is_read }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.push(errorMessage(error), "error"),
  });

  const deleteMessage = useMutation({
    mutationFn: (id: number) => api.remove("/admin/messages/", id),
    onSuccess: () => {
      toast.push("Message deleted.");
      setDeleteTarget(null);
      setSelected(null);
      invalidate();
    },
    onError: (error) => toast.push(errorMessage(error), "error"),
  });

  function open(message: MessageRow) {
    setSelected(message.is_read ? message : { ...message, is_read: true });
    if (!message.is_read) {
      markRead.mutate({ id: message.id, is_read: true });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Contact messages"
        description="Submissions from the public contact form. Marking read is shared with the dashboard counter."
        actions={
          <button
            type="button"
            className={cn("btn-ghost", unreadOnly && "border-mint/40 text-mint")}
            onClick={() => {
              setUnreadOnly((current) => !current);
              setPage(1);
            }}
            aria-pressed={unreadOnly}
          >
            <Mail size={14} aria-hidden="true" />
            {unreadOnly ? "Showing unread" : "Unread only"}
          </button>
        }
      />

      {query.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-line py-24">
          <Spinner className="h-5 w-5 text-mint" />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Inbox unavailable"
          description={errorMessage(query.error)}
          action={
            <button type="button" className="btn-ghost" onClick={() => void query.refetch()}>
              Retry
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "No unread messages" : "No messages yet"}
          description="When someone uses the contact form, their message appears here and is emailed to you."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="border-b border-line bg-panel-2/60">
                <tr>
                  <th className="th">From</th>
                  <th className="th">Subject</th>
                  <th className="th">Received</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((message) => (
                  <tr
                    key={message.id}
                    className={cn(
                      "cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel-2/40",
                      !message.is_read && "bg-mint/[0.03]",
                    )}
                    onClick={() => open(message)}
                  >
                    <td className="td">
                      <div className="flex items-center gap-2">
                        {!message.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-flame" aria-label="Unread" />
                        )}
                        <div>
                          <p className={cn("text-[13px]", !message.is_read && "font-medium text-paper")}>
                            {message.name}
                          </p>
                          <p className="font-mono text-[10.5px] text-fog">{message.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <p className="max-w-[20rem] truncate text-[13px]">
                        {message.subject || <span className="text-fog">(no subject)</span>}
                      </p>
                      <p className="max-w-[20rem] truncate text-[11.5px] text-fog">{message.message}</p>
                    </td>
                    <td className="td whitespace-nowrap font-mono text-[10.5px] text-fog">
                      {new Date(message.created_at).toLocaleString(undefined, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="td text-right whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          className="icon-btn"
                          title={message.is_read ? "Mark unread" : "Mark read"}
                          aria-label={message.is_read ? "Mark unread" : "Mark read"}
                          onClick={() =>
                            markRead.mutate({ id: message.id, is_read: !message.is_read })
                          }
                        >
                          {message.is_read ? (
                            <Mail size={13} aria-hidden="true" />
                          ) : (
                            <MailOpen size={13} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="icon-btn hover:border-danger/40 hover:text-danger"
                          title="Delete"
                          aria-label="Delete message"
                          onClick={() => setDeleteTarget(message)}
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
        title={selected?.subject || `Message from ${selected?.name ?? ""}`}
        description={
          selected
            ? `${selected.name} · ${selected.email} · ${new Date(selected.created_at).toLocaleString()}`
            : undefined
        }
        wide
        footer={
          selected && (
            <>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setDeleteTarget(selected)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
              <a
                className="btn-primary"
                href={`mailto:${selected.email}?subject=${encodeURIComponent(
                  `Re: ${selected.subject || "your message"}`,
                )}`}
              >
                <Reply size={14} aria-hidden="true" />
                Reply by email
              </a>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selected.is_read ? "muted" : "flame"}>
                {selected.is_read ? "read" : "unread"}
              </Badge>
              {selected.user_agent && (
                <span className="max-w-full truncate font-mono text-[10px] text-fog/50">
                  {selected.user_agent}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-paper/90">{selected.message}</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete message?"
        message={`This permanently deletes the message from ${
          deleteTarget?.name ?? "this sender"
        }. This cannot be undone.`}
        busy={deleteMessage.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMessage.mutate(deleteTarget.id)}
      />
    </>
  );
}
