import { useMemo, type CSSProperties } from "react";
import { Table, Typography } from "antd";

export type HeadersTableRaw = string | Record<string, unknown> | undefined | null;

/** 解析后端返回的请求头：JSON 对象字符串，或「Header: value」按行文本（与 api_case_runner 一致） */
export function parseHeadersRaw(raw: HeadersTableRaw): { name: string; value: string }[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const obj = JSON.parse(t) as unknown;
      if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.entries(obj as Record<string, unknown>).map(([k, v]) => ({
          name: k,
          value: String(v ?? ""),
        }));
      }
    } catch {
      /* 按行解析 Key: Value */
    }
    return t.split(/\r?\n/).filter(Boolean).map((line) => {
      const idx = line.indexOf(":");
      if (idx >= 0) {
        return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      }
      return { name: line.trim(), value: "" };
    });
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw).map(([k, v]) => ({ name: k, value: String(v ?? "") }));
}

/** 调试结果里请求头 / 响应头：统一用表格展示（与断言结果表格风格一致） */
export function HeadersTable({ raw }: { raw: HeadersTableRaw }) {
  const rows = useMemo(() => parseHeadersRaw(raw), [raw]);

  if (rows.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", margin: "6px 0 12px" }}>
        （无）
      </Typography.Text>
    );
  }

  const mono: CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

  return (
    <Table
      size="small"
      bordered
      pagination={false}
      style={{ margin: "6px 0 12px" }}
      rowKey={(_, i) => `hdr-${i}`}
      dataSource={rows}
      columns={[
        {
          title: "Header",
          dataIndex: "name",
          width: "32%",
          ellipsis: true,
          render: (name: string) => <span style={mono}>{name}</span>,
        },
        {
          title: "Value",
          dataIndex: "value",
          ellipsis: true,
          render: (value: string) => <span style={mono}>{value}</span>,
        },
      ]}
    />
  );
}
