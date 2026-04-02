import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { InputRef } from "antd/es/input";
import { BugOutlined, CaretRightOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, HolderOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Collapse, Input, Popconfirm, Popover, Select, Space, Spin, Switch, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  apiRegressionApi,
  type ApiCollection,
  type ApiDebugChainResult,
  type ApiEndpoint,
} from "../api/api-regression";
import { getApiEnvironmentsFromCache, patchApiEnvironmentInCache } from "../utils/apiEnvsCache";
import { mergeAutoExtractedVariablesJson } from "../utils/runVariablesForm";
import {
  addAssertionsToDefinitionStep,
  findEndpointForStep,
  formatAssertionLabel,
  getAllStepAssertionsFromDefinition,
  parseCollectionDefinitionSteps,
  removeAssertionFromDefinitionStep,
  removeStepFromDefinition,
  reorderStepsInDefinition,
  updateAssertionInDefinitionStep,
  mergeStepExtractInDefinition,
  updateStepFieldInDefinition,
  updateStepNameInDefinition,
  type DefinitionStepAssertion,
} from "../utils/collectionSteps";
import { resolveJsonPath } from "../utils/jsonPathAssert";
import { EndpointDebugModal } from "./EndpointDebugModal";
import { InteractiveJsonViewer } from "./InteractiveJsonViewer";

const COLS_CORE = "40px minmax(160px, 1.4fr) 76px 72px minmax(140px, 1.2fr) minmax(120px, 1fr)";
const GRID_COLS_BASE = COLS_CORE;
const GRID_COLS_DRAG = `28px ${COLS_CORE} 60px`;
const GRID_COLS_WITH_DEBUG = `${COLS_CORE} 76px`;
const GRID_COLS_DRAG_DEBUG = `28px ${COLS_CORE} 76px 60px`;

function isHttpDebuggableEndpoint(ep: ApiEndpoint): boolean {
  const p = (ep.protocol || "http").toLowerCase();
  return p === "http" || p === "https";
}

type Row = {
  key: number;
  jsonIndex: number;
  order: number;
  stepName: string;
  method: string;
  path: string;
  protocol: string;
  priority: string;
  includeInSubset: boolean;
  matched: ApiEndpoint | undefined;
};

function StepNameCell({
  stepJsonIndex,
  initialName,
  definitionRaw,
  onDefinitionChange,
}: {
  stepJsonIndex: number;
  initialName: string;
  definitionRaw: string;
  onDefinitionChange: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(initialName);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    setV(initialName);
  }, [initialName]);

  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(id);
  }, [editing]);

  const commit = () => {
    const next = updateStepNameInDefinition(definitionRaw, stepJsonIndex, v.trim());
    if (next !== definitionRaw) onDefinitionChange(next);
  };

  const finishEditing = () => {
    commit();
    setEditing(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  if (!editing) {
    const display = v.trim() ? v : "";
    return (
      <div
        role="button"
        tabIndex={0}
        title="单击或双击编辑步骤名"
        onClick={startEditing}
        onDoubleClick={startEditing}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        style={{
          cursor: "text",
          minHeight: 22,
          padding: "2px 2px",
          borderRadius: 4,
          maxWidth: 280,
        }}
      >
        {display ? (
          <Typography.Text ellipsis title={display} style={{ fontSize: 13 }}>
            {display}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            步骤显示名
          </Typography.Text>
        )}
      </div>
    );
  }

  return (
    <Input
      ref={inputRef}
      size="small"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={finishEditing}
      onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      placeholder="步骤显示名"
      style={{
        width: "100%",
        maxWidth: 280,
        background: "rgba(15,23,42,0.65)",
      }}
    />
  );
}

export function CollectionStepsTable({
  definitionRaw,
  endpoints,
  onDefinitionChange,
  onDebugEndpoint,
  debugResult,
  environmentId,
  onSyncToEnv,
  syncLoading,
  /** 集合详情页为 true：点绿钮写入 extract 后只改本地，需用户点「保存」才落库 */
  definitionWritesRequireManualSave,
}: {
  definitionRaw: string;
  endpoints: ApiEndpoint[];
  onDefinitionChange?: (nextDefinitionJson: string) => void;
  onDebugEndpoint?: (ep: ApiEndpoint) => void;
  debugResult?: ApiDebugChainResult | null;
  environmentId?: string;
  onSyncToEnv?: (vars: Record<string, string>) => void;
  syncLoading?: boolean;
  definitionWritesRequireManualSave?: boolean;
}) {
  const canDrag = !!onDefinitionChange;
  const gridCols = canDrag
    ? onDebugEndpoint
      ? GRID_COLS_DRAG_DEBUG
      : GRID_COLS_DRAG
    : onDebugEndpoint
      ? GRID_COLS_WITH_DEBUG
      : GRID_COLS_BASE;

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!debugResult?.steps?.length) return;
    const failedIdxs = new Set<number>();
    debugResult.steps.forEach((st, i) => {
      if (st.error || st.assertionsPassed === false) failedIdxs.add(i);
    });
    if (failedIdxs.size > 0) {
      setExpandedIdx(failedIdxs);
    }
  }, [debugResult]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleDrop = (targetJsonIdx: number) => {
    if (dragIdx === null || dragIdx === targetJsonIdx || !onDefinitionChange) return;
    const next = reorderStepsInDefinition(definitionRaw, dragIdx, targetJsonIdx);
    if (next !== definitionRaw) onDefinitionChange(next);
    setDragIdx(null);
  };

  const allStepAsserts = useMemo(
    () => getAllStepAssertionsFromDefinition(definitionRaw),
    [definitionRaw]
  );

  const data: Row[] = useMemo((): Row[] => {
    const steps = parseCollectionDefinitionSteps(definitionRaw);
    return steps.map((s) => ({
      key: s.jsonIndex,
      jsonIndex: s.jsonIndex,
      order: s.order,
      stepName: s.name,
      method: s.method,
      path: s.path,
      protocol: s.protocol,
      priority: s.priority,
      includeInSubset: s.includeInSubset,
      matched: findEndpointForStep({ method: s.method, path: s.path }, endpoints),
    }));
  }, [definitionRaw, endpoints]);

  if (data.length === 0) {
    return (
      <Typography.Text type="secondary">
        无步骤或 definition 无法解析（需包含 steps 数组）。
      </Typography.Text>
    );
  }

  const headerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: gridCols,
    gap: 8,
    alignItems: "center",
    padding: "8px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 600,
    color: "#cbd5e1",
  };

  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: gridCols,
    gap: 8,
    alignItems: "center",
    padding: "8px 4px",
    fontSize: 13,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={headerStyle}>
        {canDrag ? <div /> : null}
        <div>#</div>
        <div>步骤名</div>
        <div>协议</div>
        <div>Method</div>
        <div>Path</div>
        <div>接口清单</div>
        {onDebugEndpoint ? <div>调试</div> : null}
        {canDrag ? <div>操作</div> : null}
      </div>
      {data.map((r) => {
        const st = debugResult?.steps?.[r.jsonIndex];
        const stepAsserts = allStepAsserts[r.jsonIndex] ?? [];
        const hasErr = !!st?.error;
        const assertFail = st?.assertionsPassed === false;
        const isExpanded = expandedIdx.has(r.jsonIndex);
        const hasExpandContent = !!st || stepAsserts.length > 0 || !!onDefinitionChange;

        return (
          <div
            key={r.jsonIndex}
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={(e) => { e.preventDefault(); handleDrop(r.jsonIndex); }}
          >
            <div
              style={{
                ...rowStyle,
                cursor: hasExpandContent ? "pointer" : undefined,
                background: dragIdx === r.jsonIndex
                  ? "rgba(59,130,246,0.12)"
                  : isExpanded
                    ? "rgba(255,255,255,0.03)"
                    : undefined,
              }}
              onClick={() => hasExpandContent && toggleExpand(r.jsonIndex)}
            >
              {canDrag ? (
                <span
                  draggable
                  onDragStart={() => setDragIdx(r.jsonIndex)}
                  onDragEnd={() => setDragIdx(null)}
                  style={{ cursor: "grab", color: "rgba(255,255,255,0.35)" }}
                  title="拖动排序"
                  onClick={(e) => e.stopPropagation()}
                >
                  <HolderOutlined />
                </span>
              ) : null}
              <div>{r.order}</div>
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div onClick={(e) => e.stopPropagation()} style={{ minWidth: 0 }}>
                  {onDefinitionChange ? (
                    <StepNameCell
                      stepJsonIndex={r.jsonIndex}
                      initialName={r.stepName}
                      definitionRaw={definitionRaw}
                      onDefinitionChange={onDefinitionChange}
                    />
                  ) : (
                    <Typography.Text ellipsis title={r.stepName}>
                      {r.stepName}
                    </Typography.Text>
                  )}
                </div>
                {st ? (
                  <Tag
                    color={hasErr ? "red" : assertFail ? "orange" : "blue"}
                    style={{ fontSize: 11, margin: 0 }}
                  >
                    {st.statusCode ?? "—"} · {st.durationMs}ms
                  </Tag>
                ) : null}
                {stepAsserts.length > 0 ? (
                  <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>
                    {stepAsserts.length} 断言
                  </Tag>
                ) : null}
                {r.priority ? (
                  <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>{r.priority}</Tag>
                ) : null}
                {r.includeInSubset ? (
                  <Tag color="green" style={{ fontSize: 11, margin: 0 }}>精简</Tag>
                ) : null}
              </div>
              <div>
                <Tag color={r.protocol === "http" || r.protocol === "https" ? "blue" : "default"}>
                  {r.protocol}
                </Tag>
              </div>
              <Typography.Text code style={{ fontSize: 12 }}>
                {r.method}
              </Typography.Text>
              <Typography.Text ellipsis title={r.path} style={{ fontSize: 12 }}>
                {r.path}
              </Typography.Text>
              <div style={{ minWidth: 0 }}>
                {r.matched ? (
                  <Typography.Text ellipsis title={r.matched.id} style={{ fontSize: 12 }}>
                    {r.matched.name || r.matched.path}
                  </Typography.Text>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    未匹配
                  </Typography.Text>
                )}
              </div>
              {onDebugEndpoint ? (
                <div onClick={(e) => e.stopPropagation()}>
                  {r.matched && isHttpDebuggableEndpoint(r.matched) ? (
                    <Button
                      type="link"
                      size="small"
                      icon={<BugOutlined />}
                      onClick={() => onDebugEndpoint(r.matched!)}
                    >
                      调试
                    </Button>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
                  )}
                </div>
              ) : null}
              {canDrag ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <Popconfirm
                    title="确认删除该步骤？"
                    description={`${r.method} ${r.path}`}
                    onConfirm={() => {
                      const next = removeStepFromDefinition(definitionRaw, r.jsonIndex);
                      if (next !== definitionRaw) {
                        onDefinitionChange!(next);
                        message.success(`已删除步骤「${r.stepName}」`);
                      }
                    }}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ) : null}
            </div>
            {isExpanded ? (
              <StepExpandedContent
                stepIdx={r.jsonIndex}
                stepResult={st ?? null}
                stepAsserts={stepAsserts}
                definitionRaw={definitionRaw}
                onDefinitionChange={onDefinitionChange}
                definitionWritesRequireManualSave={definitionWritesRequireManualSave}
                environmentId={environmentId}
                onSyncToEnv={onSyncToEnv}
                syncLoading={syncLoading}
                priority={r.priority}
                includeInSubset={r.includeInSubset}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EditableAssertionTag({
  assertion,
  stepIdx,
  assertIdx,
  definitionRaw,
  onDefinitionChange,
}: {
  assertion: DefinitionStepAssertion;
  stepIdx: number;
  assertIdx: number;
  definitionRaw: string;
  onDefinitionChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const a = assertion;

  const hasEditable = a.type === "jsonpath_equals" || a.type === "jsonpath_not_equals"
    || a.type === "status" || a.type === "body_contains" || a.type === "body_not_contains"
    || a.type === "header_contains" || a.type === "status_in";

  const openEdit = () => {
    if (a.type === "status" || a.type === "jsonpath_equals" || a.type === "jsonpath_not_equals") {
      setEditValue(a.equals === undefined ? "" : JSON.stringify(a.equals));
    } else if (a.type === "body_contains" || a.type === "body_not_contains" || a.type === "header_contains") {
      setEditValue(a.contains ?? "");
    } else if (a.type === "status_in") {
      setEditValue(a.values ? a.values.join(", ") : "");
    }
    setOpen(true);
  };

  const handleSave = () => {
    let patch: Record<string, unknown> = {};
    if (a.type === "status") {
      const n = parseInt(editValue, 10);
      if (isNaN(n)) { message.error("状态码需为数字"); return; }
      patch = { equals: n };
    } else if (a.type === "jsonpath_equals" || a.type === "jsonpath_not_equals") {
      try { patch = { equals: JSON.parse(editValue) }; }
      catch { patch = { equals: editValue }; }
    } else if (a.type === "body_contains" || a.type === "body_not_contains" || a.type === "header_contains") {
      patch = { contains: editValue };
    } else if (a.type === "status_in") {
      const codes = editValue.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      patch = { values: codes };
    }
    const next = updateAssertionInDefinitionStep(definitionRaw, stepIdx, assertIdx, patch);
    if (next !== definitionRaw) {
      onDefinitionChange(next);
      message.success("断言已更新");
    }
    setOpen(false);
  };

  const editLabel = a.type === "status" ? "状态码"
    : a.type === "jsonpath_equals" || a.type === "jsonpath_not_equals" ? `${a.path} 的值`
    : a.type === "body_contains" || a.type === "body_not_contains" ? "匹配内容"
    : a.type === "header_contains" ? "匹配内容"
    : a.type === "status_in" ? "状态码列表（逗号分隔）"
    : "";

  const content = (
    <div style={{ width: 280 }}>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
        {editLabel}
      </Typography.Text>
      <Input
        size="small"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onPressEnter={handleSave}
        autoFocus
        style={{ marginBottom: 8, fontFamily: "monospace", fontSize: 12 }}
      />
      <Space size={4}>
        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSave}>
          确认
        </Button>
        <Button size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)}>
          取消
        </Button>
      </Space>
    </div>
  );

  return (
    <Tag
      color="geekblue"
      style={{ fontSize: 11, cursor: hasEditable ? "pointer" : undefined }}
      closable
      onClose={(e) => {
        e.preventDefault();
        const next = removeAssertionFromDefinitionStep(definitionRaw, stepIdx, assertIdx);
        if (next !== definitionRaw) {
          onDefinitionChange(next);
          message.success(`已删除断言「${a.label}」`);
        }
      }}
    >
      {hasEditable ? (
        <Popover
          content={content}
          trigger="click"
          open={open}
          onOpenChange={(v) => { if (!v) setOpen(false); }}
          placement="bottom"
        >
          <span onClick={(e) => { e.stopPropagation(); openEdit(); }}>
            {a.label} <EditOutlined style={{ fontSize: 10, opacity: 0.6 }} />
          </span>
        </Popover>
      ) : (
        a.label
      )}
    </Tag>
  );
}

const PRIORITY_OPTIONS = [
  { value: "", label: "无" },
  { value: "P0", label: "P0 - 冒烟" },
  { value: "P1", label: "P1 - 核心" },
  { value: "P2", label: "P2 - 一般" },
];

function StepExpandedContent({
  stepIdx,
  stepResult,
  stepAsserts,
  definitionRaw,
  onDefinitionChange,
  definitionWritesRequireManualSave,
  environmentId,
  onSyncToEnv,
  syncLoading,
  priority,
  includeInSubset,
}: {
  stepIdx: number;
  stepResult: ApiDebugChainResult["steps"][number] | null;
  stepAsserts: DefinitionStepAssertion[];
  definitionRaw: string;
  onDefinitionChange?: (s: string) => void;
  definitionWritesRequireManualSave?: boolean;
  environmentId?: string;
  onSyncToEnv?: (vars: Record<string, string>) => void;
  syncLoading?: boolean;
  priority: string;
  includeInSubset: boolean;
}) {
  const st = stepResult;

  return (
    <div style={{ padding: "8px 12px 12px 40px", fontSize: 12, borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
      {onDefinitionChange ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
          <Space size={6}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>优先级：</Typography.Text>
            <Select
              size="small"
              value={priority}
              options={PRIORITY_OPTIONS}
              style={{ width: 120 }}
              onClick={(e) => e.stopPropagation()}
              onChange={(val) => {
                const next = updateStepFieldInDefinition(definitionRaw, stepIdx, { priority: val || undefined });
                if (next !== definitionRaw) onDefinitionChange(next);
              }}
            />
          </Space>
          <Space size={6}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>包含在精简集：</Typography.Text>
            <Switch
              size="small"
              checked={includeInSubset}
              onClick={(_, e) => e.stopPropagation()}
              onChange={(checked) => {
                const next = updateStepFieldInDefinition(definitionRaw, stepIdx, { includeInSubset: checked || undefined });
                if (next !== definitionRaw) onDefinitionChange(next);
              }}
            />
          </Space>
        </div>
      ) : null}

      {st?.error ? (
        <Typography.Text type="danger" style={{ display: "block", marginBottom: 8 }}>
          {st.error}
        </Typography.Text>
      ) : null}

      {st?.assertionResults?.length ? (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
            断言执行结果：
          </Typography.Text>
          {st.assertionResults.map((ar, ai) => (
            <Tag key={ai} color={ar.passed ? "green" : "red"} style={{ marginBottom: 4 }}>
              {ar.type}: {ar.passed ? "通过" : ar.message || "失败"}
            </Tag>
          ))}
        </div>
      ) : null}

      {stepAsserts.length > 0 ? (
        <div style={{ marginBottom: 8, padding: "6px 10px", background: "rgba(22,119,255,0.06)", borderRadius: 6, border: "1px solid rgba(22,119,255,0.15)" }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
            已配置 {stepAsserts.length} 条断言{!st?.assertionResults?.length ? "（下次调试时执行）" : ""}：
          </Typography.Text>
          <Space wrap size={[4, 4]}>
            {stepAsserts.map((a, ai) =>
              onDefinitionChange ? (
                <EditableAssertionTag
                  key={ai}
                  assertion={a}
                  stepIdx={stepIdx}
                  assertIdx={ai}
                  definitionRaw={definitionRaw}
                  onDefinitionChange={onDefinitionChange}
                />
              ) : (
                <Tag key={ai} color="geekblue" style={{ fontSize: 11 }}>
                  {a.label}
                </Tag>
              )
            )}
          </Space>
        </div>
      ) : null}

      {st ? (
        <>
          <div style={{ marginBottom: 4 }}>
            <Typography.Text type="secondary">请求 </Typography.Text>
            <Typography.Text code copyable>{st.requestMethod} {st.requestUrl}</Typography.Text>
          </div>
          {st.requestHeadersMasked?.trim() ? (
            <Collapse
              bordered={false}
              size="small"
              style={{ background: "transparent", marginBottom: 4 }}
              items={[{
                key: "reqH",
                label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求头</Typography.Text>,
                children: <pre style={{ margin: 0, maxHeight: 120, overflow: "auto", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{st.requestHeadersMasked}</pre>,
              }]}
            />
          ) : null}
          {st.requestBodyMasked?.trim() ? (
            <Collapse
              bordered={false}
              size="small"
              defaultActiveKey={["reqB"]}
              style={{ background: "transparent", marginBottom: 4 }}
              items={[{
                key: "reqB",
                label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求体</Typography.Text>,
                children: <pre style={{ margin: 0, maxHeight: 160, overflow: "auto", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{st.requestBodyMasked}</pre>,
              }]}
            />
          ) : null}
          {Object.keys(st.extracted || {}).length ? (
            <div style={{ marginBottom: 4 }}>
              {Object.entries(st.extracted).map(([k, v]) => (
                <Tag key={k} style={{ marginBottom: 2 }}>
                  {k} = {String(v).length > 60 ? String(v).slice(0, 60) + "…" : String(v)}
                </Tag>
              ))}
            </div>
          ) : null}
          <Typography.Text type="secondary">响应体</Typography.Text>
          {(() => {
            const body = st.responseBody || "";
            let parsed: unknown = null;
            try { parsed = body.trim() ? JSON.parse(body) : null; } catch { /* noop */ }
            const canAddEnv = !!onSyncToEnv && !!environmentId;
            const canAddAssert = !!onDefinitionChange;
            if (parsed !== null && typeof parsed === "object" && (canAddEnv || canAddAssert)) {
              const handleAddAssertion = canAddAssert
                ? (path: string, value: unknown) => {
                    const typeStr = typeof value === "number" ? "jsonpath_equals"
                      : typeof value === "boolean" ? "jsonpath_equals"
                      : value === null ? "jsonpath_equals"
                      : "jsonpath_equals";
                    const assertion = { type: typeStr, path, equals: value, label: formatAssertionLabel({ type: typeStr, path, equals: value }) };
                    const { next, added } = addAssertionsToDefinitionStep(definitionRaw, stepIdx, [assertion]);
                    if (added > 0) {
                      onDefinitionChange!(next);
                      message.success(`已添加断言: ${path} = ${JSON.stringify(value)}`);
                    } else {
                      message.info("该断言已存在");
                    }
                  }
                : undefined;
              return (
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
                    绿色「上传」图标：写入环境「自动提取」变量并在本步骤记下 JSONPath；蓝色「+」仅添加断言，不会写环境。
                  </Typography.Text>
                  <InteractiveJsonViewer
                    data={parsed}
                    onAddToEnv={
                      canAddEnv
                        ? (varName, value, path) => {
                            onSyncToEnv!({ [varName]: value });
                            if (onDefinitionChange && path) {
                              const next = mergeStepExtractInDefinition(definitionRaw, stepIdx, varName, path);
                              if (next !== definitionRaw) {
                                onDefinitionChange(next);
                                if (definitionWritesRequireManualSave) {
                                  message.info("已将 JSONPath 写入本步骤 extract；请点击页面顶部「保存」持久化集合。");
                                }
                              }
                            }
                          }
                        : undefined
                    }
                    onAddAssertion={handleAddAssertion}
                  />
                </div>
              );
            }
            return (
              <>
                <pre style={{ marginTop: 4, maxHeight: 200, overflow: "auto", background: "rgba(0,0,0,0.25)", padding: 8, borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {body || "（无响应体）"}
                </pre>
                {canAddEnv && body ? (
                  <StepExtractToEnvForm
                    responseBody={body}
                    onSave={onSyncToEnv!}
                    loading={syncLoading}
                    disabled={!environmentId}
                  />
                ) : null}
              </>
            );
          })()}
        </>
      ) : null}

      {!st && stepAsserts.length === 0 ? (
        <Typography.Text type="secondary">点击「执行调试」后查看请求/响应详情。</Typography.Text>
      ) : null}
    </div>
  );
}

export function StepExtractToEnvForm({
  responseBody,
  onSave,
  loading,
  disabled,
}: {
  responseBody: string;
  onSave: (vars: Record<string, string>) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [varName, setVarName] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [preview, setPreview] = useState<{ value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(() => {
    setError(null);
    setPreview(null);
    if (!varName.trim()) { setError("请输入变量名"); return; }
    if (!jsonPath.trim()) { setError("请输入路径"); return; }
    let body: unknown;
    try { body = JSON.parse(responseBody); } catch { setError("响应体不是有效的 JSON"); return; }
    const r = resolveJsonPath(body, jsonPath);
    if (!r.ok) { setError(r.error); return; }
    const val = typeof r.value === "object" ? JSON.stringify(r.value) : String(r.value ?? "");
    setPreview({ value: val });
  }, [responseBody, varName, jsonPath]);

  const handleSave = () => {
    if (!preview) return;
    onSave({ [varName.trim()]: preview.value });
    message.success(`变量 ${varName.trim()} 已保存`);
    setVarName("");
    setJsonPath("");
    setPreview(null);
    setError(null);
  };

  return (
    <div style={{ marginTop: 8, padding: "6px 8px", border: "1px dashed #555", borderRadius: 6 }}>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
        提取响应值到环境变量（路径示例：<code>data.code</code>、<code>data.list[0].id</code>）
      </Typography.Text>
      <Space wrap size={[6, 6]}>
        <Input
          size="small"
          placeholder="变量名，如 code"
          value={varName}
          onChange={(e) => { setVarName(e.target.value); setPreview(null); }}
          style={{ width: 130 }}
          disabled={disabled}
        />
        <Input
          size="small"
          placeholder="路径，如 data.code"
          value={jsonPath}
          onChange={(e) => { setJsonPath(e.target.value); setPreview(null); }}
          style={{ width: 180 }}
          disabled={disabled}
          onPressEnter={handlePreview}
        />
        <Button size="small" onClick={handlePreview} disabled={disabled}>
          预览
        </Button>
        {preview !== null && (
          <>
            <Tag color="processing">
              {varName} = {preview.value.length > 40 ? preview.value.slice(0, 40) + "…" : preview.value}
            </Tag>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
              disabled={disabled}
            >
              保存到环境
            </Button>
          </>
        )}
      </Space>
      {error && (
        <Typography.Text type="danger" style={{ fontSize: 11, display: "block", marginTop: 3 }}>
          {error}
        </Typography.Text>
      )}
    </div>
  );
}

/** 展开行时拉取集合 definition 再渲染表格（列表页可在此编辑步骤名，失焦后自动保存） */
export function CollectionStepsExpandContent({
  collectionId,
  endpoints,
}: {
  collectionId: string;
  endpoints: ApiEndpoint[];
}) {
  const [debugEp, setDebugEp] = useState<ApiEndpoint | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEnvId, setDebugEnvId] = useState<string | undefined>();
  const [debugResult, setDebugResult] = useState<ApiDebugChainResult | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(
    ["api-collection", collectionId],
    () => apiRegressionApi.collections.get(collectionId),
    { staleTime: 60_000 }
  );
  const { data: environments = [] } = useQuery("api-envs", apiRegressionApi.environments.list);

  const saveDefinition = useMutation(
    (definition: string) => apiRegressionApi.collections.update(collectionId, { definition }),
    {
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "保存失败");
        qc.invalidateQueries(["api-collection", collectionId]);
      },
    }
  );

  const debugDefMut = useMutation(apiRegressionApi.debug.debugDefinition, {
    onSuccess: (r) => {
      qc.invalidateQueries("api-envs");
      setDebugResult(r);
      if (r.ok) {
        message.success(`调试完成，共 ${r.steps.length} 步全部通过`);
      } else if (r.error && !r.steps?.length) {
        message.error(r.error);
      } else {
        const failCount = r.steps.filter((s) => s.error || s.assertionsPassed === false).length;
        const total = r.steps.length;
        if (r.stoppedAt !== null && r.stoppedAt !== undefined) {
          message.warning(`在第 ${r.stoppedAt + 1} 步停止（已执行 ${total} 步，${failCount} 步失败）`);
        } else {
          message.warning(`调试完成，${failCount}/${total} 步存在断言失败或错误`);
        }
      }
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "调试失败");
    },
  });

  const syncToEnvMut = useMutation(
    ({
      environmentId,
      autoExtractedVariables,
    }: {
      environmentId: string;
      autoExtractedVariables: string;
    }) => apiRegressionApi.environments.update(environmentId, { autoExtractedVariables }),
    {
      onSuccess: (resp, vars) => {
        console.log("[syncToEnvMut] success, response=", resp);
        patchApiEnvironmentInCache(qc, vars.environmentId, { autoExtractedVariables: vars.autoExtractedVariables });
        qc.invalidateQueries("api-envs");
        message.destroy("sync-to-env");
        message.success(
          "已写入环境「自动提取的变量」区 ✓（去「环境」页编辑即可看到）"
        );
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        console.error("[syncToEnvMut] error=", e);
        message.destroy("sync-to-env");
        message.error(e.response?.data?.detail ?? "保存到环境失败");
      },
    }
  );

  const handleSyncToEnv = (vars: Record<string, string>) => {
    console.log("[handleSyncToEnv] called, debugEnvId=", debugEnvId, "vars=", vars);
    if (!debugEnvId) {
      message.warning("请先选择调试环境");
      return;
    }
    const env = getApiEnvironmentsFromCache(qc, environments).find((e) => e.id === debugEnvId);
    if (!env) {
      message.error("环境不存在，请刷新后重试");
      return;
    }
    console.log("[handleSyncToEnv] env.autoExtractedVariables=", env.autoExtractedVariables);
    const merged = mergeAutoExtractedVariablesJson(env.autoExtractedVariables, vars);
    console.log("[handleSyncToEnv] merged=", merged, "→ PUT env", env.name);
    message.loading({ content: `正在写入环境「${env.name}」的自动提取区…`, key: "sync-to-env", duration: 10 });
    syncToEnvMut.mutate({ environmentId: debugEnvId, autoExtractedVariables: merged });
  };

  const handleDebugRun = () => {
    if (!debugEnvId) {
      message.warning("请先选择调试环境");
      return;
    }
    setDebugResult(null);
    debugDefMut.mutate({
      environmentId: debugEnvId,
      definition: data?.definition ?? "{}",
      continueOnFailure: true,
      persistExtractToEnv: true,
    });
  };

  const onDefinitionChange = (next: string) => {
    qc.setQueryData<ApiCollection | undefined>(["api-collection", collectionId], (old) =>
      old ? { ...old, definition: next } : old
    );
    saveDefinition.mutate(next);
  };

  if (isLoading) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 12px 24px", maxWidth: 1040 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Select
          style={{ minWidth: 200 }}
          size="small"
          placeholder="选择调试环境"
          value={debugEnvId}
          onChange={setDebugEnvId}
          options={environments.map((e) => ({ value: e.id, label: `${e.name} (${e.baseUrl})` }))}
          allowClear
        />
        <Button
          type="primary"
          size="small"
          icon={<CaretRightOutlined />}
          loading={debugDefMut.isLoading}
          onClick={handleDebugRun}
        >
          调试集合
        </Button>
        {debugResult ? (
          <Tag color={debugResult.ok ? "success" : "error"}>
            {debugResult.ok ? "全部通过" : `在第 ${(debugResult.stoppedAt ?? 0) + 1} 步停止`}
          </Tag>
        ) : null}
        {saveDefinition.isLoading ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>保存中…</Typography.Text>
        ) : null}
      </div>

      <CollectionStepsTable
        definitionRaw={data?.definition ?? "{}"}
        endpoints={endpoints}
        onDefinitionChange={onDefinitionChange}
        onDebugEndpoint={(ep) => {
          setDebugEp(ep);
          setDebugOpen(true);
        }}
        debugResult={debugResult}
        environmentId={debugEnvId}
        onSyncToEnv={handleSyncToEnv}
        syncLoading={syncToEnvMut.isLoading}
      />
      <EndpointDebugModal
        open={debugOpen}
        endpoint={debugEp}
        onClose={() => {
          setDebugOpen(false);
          setDebugEp(null);
        }}
      />
    </div>
  );
}
