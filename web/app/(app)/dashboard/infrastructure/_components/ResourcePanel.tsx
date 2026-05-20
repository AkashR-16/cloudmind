import { ResourceNode } from "@/features/graph/useResources";
import { formatResourceKind } from "@/lib/utils";
import { X, Tag, MapPin, Hash, AlertTriangle, CheckCircle, Clock } from "lucide-react";

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
        {/* Status badges */}
        <StatusBadges resource={resource} reported={reported} />

        {/* Core fields */}
        <Section title="Details">
          <Field icon={Hash} label="ID" value={resource.id} mono />
          {resource.region && <Field icon={MapPin} label="Region" value={resource.region} />}
          {resource.account_id && <Field icon={Hash} label="Account" value={resource.account_id} mono />}
        </Section>

        {/* Kind-specific properties */}
        <KindProperties kind={resource.kind} reported={reported} />

        {/* Tags */}
        {tags.length > 0 && (
          <Section title="Tags">
            {tags.map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-xs">
                <Tag className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-300 break-all">{v}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}

// ── Status badges ────────────────────────────────────────────
function StatusBadges({ resource, reported }: { resource: ResourceNode; reported: Record<string, unknown> }) {
  const badges: React.ReactNode[] = [];

  if (resource.kind === "aws_ec2_instance") {
    const status = reported.instance_status as string | undefined;
    if (status === "running") {
      badges.push(<Badge key="status" color="green" icon={<CheckCircle className="w-3 h-3" />} label="Running" />);
    } else if (status === "stopped") {
      badges.push(<Badge key="status" color="yellow" icon={<Clock className="w-3 h-3" />} label="Stopped" />);
    } else if (status === "terminated") {
      badges.push(<Badge key="status" color="gray" icon={<Clock className="w-3 h-3" />} label="Terminated" />);
    }
    if (reported.public_ip_address) {
      badges.push(<Badge key="public-ip" color="blue" label={`IP: ${reported.public_ip_address}`} />);
    }
  }

  if (resource.kind === "aws_s3_bucket") {
    if (reported.is_public) {
      badges.push(<Badge key="public" color="red" icon={<AlertTriangle className="w-3 h-3" />} label="Public" />);
    } else {
      badges.push(<Badge key="private" color="green" icon={<CheckCircle className="w-3 h-3" />} label="Private" />);
    }
    if (reported.versioning_enabled) {
      badges.push(<Badge key="versioning" color="blue" label="Versioning On" />);
    }
  }

  if (resource.kind === "aws_rds_instance") {
    if (reported.storage_encrypted) {
      badges.push(<Badge key="enc" color="green" icon={<CheckCircle className="w-3 h-3" />} label="Encrypted" />);
    } else {
      badges.push(<Badge key="enc" color="red" icon={<AlertTriangle className="w-3 h-3" />} label="Not Encrypted" />);
    }
    if (reported.publicly_accessible) {
      badges.push(<Badge key="pub" color="red" icon={<AlertTriangle className="w-3 h-3" />} label="Publicly Accessible" />);
    }
  }

  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{badges}</div>;
}

const BADGE_COLORS = {
  green:  "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  red:    "bg-red-500/15 border-red-500/30 text-red-400",
  yellow: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  blue:   "bg-blue-500/15 border-blue-500/30 text-blue-400",
  gray:   "bg-gray-500/15 border-gray-500/30 text-gray-400",
};

function Badge({ color, icon, label }: { color: keyof typeof BADGE_COLORS; icon?: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${BADGE_COLORS[color]}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Kind-specific properties ─────────────────────────────────
function KindProperties({ kind, reported }: { kind: string; reported: Record<string, unknown> }) {
  if (kind === "aws_ec2_instance") {
    return (
      <Section title="Instance">
        {!!reported.instance_type && <Field label="Type" value={String(reported.instance_type)} />}
        {!!reported.instance_status && <Field label="Status" value={String(reported.instance_status)} />}
        {!!reported.private_ip_address && <Field label="Private IP" value={String(reported.private_ip_address)} mono />}
        {!!reported.public_ip_address && <Field label="Public IP" value={String(reported.public_ip_address)} mono />}
      </Section>
    );
  }

  if (kind === "aws_s3_bucket") {
    return (
      <Section title="Bucket">
        <Field label="Public Access" value={!!reported.is_public ? "⚠ Open to internet" : "Blocked"} />
        <Field label="Versioning" value={!!reported.versioning_enabled ? "Enabled" : "Disabled"} />
      </Section>
    );
  }

  if (kind === "aws_security_group") {
    const rules = reported.ip_permissions as Array<{ IpProtocol: string; FromPort?: number; ToPort?: number; IpRanges?: Array<{ CidrIp: string }> }> | undefined;
    return (
      <Section title="Inbound Rules">
        {rules && rules.length > 0 ? rules.map((rule, i) => {
          const cidrs = rule.IpRanges?.map(r => r.CidrIp).join(", ") ?? "—";
          const port = rule.FromPort === rule.ToPort ? String(rule.FromPort) : `${rule.FromPort}–${rule.ToPort}`;
          const isOpen = cidrs.includes("0.0.0.0/0");
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{rule.IpProtocol.toUpperCase()} :{port}</span>
              <span className={isOpen ? "text-red-400 font-medium" : "text-gray-400"}>{cidrs}</span>
            </div>
          );
        }) : <span className="text-xs text-gray-600">No inbound rules</span>}
      </Section>
    );
  }

  if (kind === "aws_vpc") {
    return (
      <Section title="Network">
        {!!reported.cidr_block && <Field label="CIDR" value={String(reported.cidr_block)} mono />}
        <Field label="Default VPC" value={!!reported.is_default ? "Yes" : "No"} />
      </Section>
    );
  }

  if (kind === "aws_subnet") {
    return (
      <Section title="Network">
        {!!reported.cidr_block && <Field label="CIDR" value={String(reported.cidr_block)} mono />}
        {!!reported.vpc_id && <Field label="VPC" value={String(reported.vpc_id)} mono />}
      </Section>
    );
  }

  if (kind === "aws_iam_role") {
    return (
      <Section title="Trust">
        {!!reported.assume_role_policy && <Field label="Principal" value={String(reported.assume_role_policy)} />}
      </Section>
    );
  }

  if (kind === "aws_rds_instance") {
    return (
      <Section title="Database">
        {!!reported.engine && <Field label="Engine" value={String(reported.engine)} />}
        {!!reported.instance_class && <Field label="Class" value={String(reported.instance_class)} />}
        <Field label="Encrypted" value={!!reported.storage_encrypted ? "Yes" : "No"} />
        <Field label="Public" value={!!reported.publicly_accessible ? "⚠ Yes" : "No"} />
      </Section>
    );
  }

  if (kind === "aws_lambda_function") {
    return (
      <Section title="Function">
        {!!reported.runtime && <Field label="Runtime" value={String(reported.runtime)} />}
        {!!reported.memory_size && <Field label="Memory" value={`${reported.memory_size} MB`} />}
      </Section>
    );
  }

  return null;
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
