import { ResourceNode } from "@/features/graph/useResources";
import { formatResourceKind } from "@/lib/utils";
import { X, Tag, MapPin, Hash } from "lucide-react";

interface Props {
  resource: ResourceNode;
  onClose: () => void;
}

export function ResourcePanel({ resource, onClose }: Props) {
  const tags = Object.entries(resource.tags ?? {});
  const reported = resource.reported ?? {};

  return (
    <aside className="w-80 border-l border-surface-border bg-surface-card overflow-y-auto flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border sticky top-0 bg-surface-card">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
            {formatResourceKind(resource.kind)}
          </p>
          <h3 className="font-semibold text-sm truncate max-w-[200px]">
            {resource.name ?? resource.id}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="text-gray-500 hover:text-white transition-colors p-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 text-sm">
        {/* Core fields */}
        <Section title="Details">
          <Field icon={Hash} label="ID" value={resource.id} mono />
          {resource.region && <Field icon={MapPin} label="Region" value={resource.region} />}
          {resource.account_id && <Field icon={Hash} label="Account" value={resource.account_id} mono />}
        </Section>

        {/* Tags */}
        {tags.length > 0 && (
          <Section title="Tags">
            {tags.map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-300 break-all">{v}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Raw reported fields */}
        <Section title="Properties">
          {Object.entries(reported)
            .filter(([k]) => !["id", "name", "region", "account_id", "tags"].includes(k))
            .slice(0, 12)
            .map(([k, v]) => (
              <Field
                key={k}
                label={k.replace(/_/g, " ")}
                value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                mono={typeof v !== "string"}
              />
            ))}
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />}
      <span className="text-gray-500 shrink-0 capitalize">{label}:</span>
      <span className={`text-gray-300 break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
