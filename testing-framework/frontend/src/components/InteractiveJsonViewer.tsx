import { useState, type CSSProperties, type ReactNode } from "react";
import { Tooltip } from "antd";
import { CloudUploadOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { extendJsonPath } from "../utils/jsonPathAssert";

const INDENT = 16;
const MAX_ITEMS_DISPLAY = 50;
const AUTO_COLLAPSE_DEPTH = 4;

const C = {
  key: "#e06c75",
  string: "#98c379",
  number: "#d19a66",
  boolean: "#56b6c2",
  null: "#636d83",
  punct: "#abb2bf",
};

const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 3,
  background: "transparent",
  cursor: "pointer",
  fontSize: 10,
  marginLeft: 4,
  padding: 0,
  verticalAlign: "middle",
  lineHeight: 1,
  opacity: 0.7,
  transition: "opacity 0.15s, background 0.15s",
};

function varNameFromPath(path: string): string {
  const segs = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i] !== "$" && !/^\d+$/.test(segs[i])) return segs[i];
  }
  return segs[segs.length - 1] || "value";
}

function LeafActions({
  path,
  value,
  onAddToEnv,
  onAddAssertion,
}: {
  path: string;
  value: unknown;
  onAddToEnv?: (varName: string, value: string, path: string) => void;
  onAddAssertion?: (path: string, value: unknown) => void;
}) {
  const vn = varNameFromPath(path);
  const sv = value === null ? "" : String(value);
  const short = sv.length > 20 ? sv.slice(0, 20) + "…" : sv;

  return (
    <span className="ij-actions" style={{ marginLeft: 6 }}>
      {onAddToEnv && (
        <Tooltip
          title={`写入环境「自动提取」区（非手动变量列表）· 变量名 ${vn} · ${path} · 集合调试成功后也会按步骤 extract 更新；若环境里有同名「手动」键会覆盖自动值`}
          mouseEnterDelay={0.3}
        >
          <button
            style={{ ...btnBase, color: "#52c41a" }}
            onClick={(e) => {
              e.stopPropagation();
              onAddToEnv(vn, sv, path);
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget;
              t.style.opacity = "1";
              t.style.background = "rgba(82,196,26,0.18)";
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget;
              t.style.opacity = "0.7";
              t.style.background = "transparent";
            }}
          >
            <CloudUploadOutlined />
          </button>
        </Tooltip>
      )}
      {onAddAssertion && (
        <Tooltip title={`仅添加断言（不写环境变量）: ${path} = ${short}`} mouseEnterDelay={0.3}>
          <button
            style={{ ...btnBase, color: "#1890ff" }}
            onClick={(e) => {
              e.stopPropagation();
              onAddAssertion(path, value);
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget;
              t.style.opacity = "1";
              t.style.background = "rgba(24,144,255,0.18)";
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget;
              t.style.opacity = "0.7";
              t.style.background = "transparent";
            }}
          >
            <PlusCircleOutlined />
          </button>
        </Tooltip>
      )}
    </span>
  );
}

function ToggleArrow({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-block",
        width: 12,
        cursor: "pointer",
        userSelect: "none",
        color: C.punct,
        fontSize: 10,
        textAlign: "center",
        marginRight: 2,
      }}
      title={collapsed ? "展开" : "折叠"}
    >
      {collapsed ? "▶" : "▼"}
    </span>
  );
}

function JsonNode({
  value,
  path,
  depth,
  keyName,
  isLast,
  onAddToEnv,
  onAddAssertion,
}: {
  value: unknown;
  path: string;
  depth: number;
  keyName?: string;
  isLast: boolean;
  onAddToEnv?: (varName: string, value: string, path: string) => void;
  onAddAssertion?: (path: string, value: unknown) => void;
}): ReactNode {
  const [collapsed, setCollapsed] = useState(depth >= AUTO_COLLAPSE_DEPTH);
  const pad = depth * INDENT;
  const comma = isLast ? "" : ",";

  const keyEl = keyName !== undefined && (
    <>
      <span style={{ color: C.key }}>{JSON.stringify(keyName)}</span>
      <span style={{ color: C.punct }}>: </span>
    </>
  );

  if (value === null || typeof value !== "object") {
    let color: string;
    let display: string;
    if (value === null) {
      color = C.null;
      display = "null";
    } else if (typeof value === "string") {
      color = C.string;
      display = JSON.stringify(value);
    } else if (typeof value === "boolean") {
      color = C.boolean;
      display = String(value);
    } else {
      color = C.number;
      display = String(value);
    }

    return (
      <div style={{ paddingLeft: pad, lineHeight: "22px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {keyEl}
        <span style={{ color }}>{display}</span>
        <span style={{ color: C.punct }}>{comma}</span>
        <LeafActions path={path} value={value} onAddToEnv={onAddToEnv} onAddAssertion={onAddAssertion} />
      </div>
    );
  }

  const isArr = Array.isArray(value);
  const open = isArr ? "[" : "{";
  const close = isArr ? "]" : "}";
  const entries = isArr
    ? value.map((v, i) => ({ key: String(i), val: v, jp: `${path}[${i}]` }))
    : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
        key: k,
        val: v,
        jp: extendJsonPath(path, k),
      }));

  if (entries.length === 0) {
    return (
      <div style={{ paddingLeft: pad, lineHeight: "22px" }}>
        {keyEl}
        <span style={{ color: C.punct }}>
          {open}
          {close}
          {comma}
        </span>
      </div>
    );
  }

  const truncated = entries.length > MAX_ITEMS_DISPLAY;
  const visible = truncated ? entries.slice(0, MAX_ITEMS_DISPLAY) : entries;

  if (collapsed) {
    return (
      <div style={{ paddingLeft: pad, lineHeight: "22px" }}>
        <ToggleArrow collapsed onClick={() => setCollapsed(false)} />
        {keyEl}
        <span style={{ color: C.punct, cursor: "pointer" }} onClick={() => setCollapsed(false)}>
          {open}{" "}
          <span style={{ color: "#636d83", fontStyle: "italic" }}>
            {entries.length} {isArr ? "items" : "keys"}
          </span>{" "}
          {close}
          {comma}
        </span>
      </div>
    );
  }

  return (
    <>
      <div style={{ paddingLeft: pad, lineHeight: "22px" }}>
        <ToggleArrow collapsed={false} onClick={() => setCollapsed(true)} />
        {keyEl}
        <span style={{ color: C.punct }}>{open}</span>
      </div>
      {visible.map((entry, idx) => (
        <JsonNode
          key={entry.key}
          value={entry.val}
          path={entry.jp}
          depth={depth + 1}
          keyName={isArr ? undefined : entry.key}
          isLast={idx === (truncated ? visible.length : entries.length) - 1 && !truncated}
          onAddToEnv={onAddToEnv}
          onAddAssertion={onAddAssertion}
        />
      ))}
      {truncated && (
        <div style={{ paddingLeft: (depth + 1) * INDENT, lineHeight: "22px", color: "#636d83", fontStyle: "italic" }}>
          … 还有 {entries.length - MAX_ITEMS_DISPLAY} 项未显示
        </div>
      )}
      <div style={{ paddingLeft: pad, lineHeight: "22px" }}>
        <span style={{ display: "inline-block", width: 14 }} />
        <span style={{ color: C.punct }}>
          {close}
          {comma}
        </span>
      </div>
    </>
  );
}

export type InteractiveJsonViewerProps = {
  data: unknown;
  onAddToEnv?: (varName: string, value: string, path: string) => void;
  onAddAssertion?: (path: string, value: unknown) => void;
};

export function InteractiveJsonViewer({ data, onAddToEnv, onAddAssertion }: InteractiveJsonViewerProps) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.3)",
        borderRadius: 6,
        padding: "8px 4px",
        fontSize: 12,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace",
        maxHeight: 360,
        overflow: "auto",
        lineHeight: "22px",
      }}
    >
      <JsonNode value={data} path="$" depth={0} isLast onAddToEnv={onAddToEnv} onAddAssertion={onAddAssertion} />
    </div>
  );
}
