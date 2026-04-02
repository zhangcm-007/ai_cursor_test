import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "react-query";
import {
  Button,
  Collapse,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, HolderOutlined, PlusOutlined, SendOutlined } from "@ant-design/icons";
import {
  apiRegressionApi,
  type ApiDebugChainResult,
  type ApiEndpoint,
} from "../api/api-regression";
import { RunVariablesFieldList } from "./RunVariablesFieldList";
import { runVarListToRecord, type RunVarFormRow } from "../utils/runVariablesForm";
import { buildDebugModalDefaults, mergeDebugDraftIntoDefaults } from "../utils/debugDraft";
import { buildChainDebugSeedFromDefinition } from "../utils/collectionSteps";

const { TextArea } = Input;

function parseChainBody(text: string): { json?: unknown; body?: string } {
  const t = text.trim();
  if (!t) return {};
  try {
    const v = JSON.parse(t) as unknown;
    if (v !== null && typeof v === "object") return { json: v };
  } catch {
    /* raw */
  }
  return { body: t };
}

export type ChainRow = {
  key: string;
  endpointId: string | undefined;
  method: string;
  path: string;
  headers: string;
  body: string;
  extractJson: string;
};

function newRow(): ChainRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    endpointId: undefined,
    method: "GET",
    path: "/",
    headers: "{}",
    body: "",
    extractJson: "{}",
  };
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export type DebugChainSeedFromCollection = {
  definitionRaw: string;
  endpoints: ApiEndpoint[];
};

export function DebugChainModal({
  open,
  onClose,
  seedFromCollection,
}: {
  open: boolean;
  onClose: () => void;
  /** 集合详情页传入：每次打开弹窗时按当前 definition 预填 HTTP(S) 步骤（含 extract） */
  seedFromCollection?: DebugChainSeedFromCollection | null;
}) {
  const [rows, setRows] = useState<ChainRow[]>(() => [newRow(), newRow()]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<ApiDebugChainResult | null>(null);
  const [form] = Form.useForm();
  const openedRef = useRef(false);
  /** 已用「非空环境列表」做过一次 definition 预填（避免 env 晚到仍停留在写死示例） */
  const appliedEnvMergeRef = useRef(false);
  const seedRef = useRef(seedFromCollection ?? null);
  seedRef.current = seedFromCollection ?? null;

  const { data: environments = [] } = useQuery("api-envs", apiRegressionApi.environments.list);
  const { data: endpoints = [] } = useQuery("api-endpoints", apiRegressionApi.endpoints.list);

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      appliedEnvMergeRef.current = false;
      return;
    }

    form.setFieldsValue({
      runVarList: [] as RunVarFormRow[],
      chainTimeout: 30,
    });

    const seed = seedRef.current;
    const applySeeds = (envs: typeof environments) => {
      if (!seed?.definitionRaw?.trim()) return false;
      const seeds = buildChainDebugSeedFromDefinition(seed.definitionRaw, seed.endpoints, envs);
      if (seeds.length > 0) {
        setRows(
          seeds.map((s, i) => ({
            key: `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
            endpointId: s.endpointId,
            method: s.method,
            path: s.path,
            headers: s.headers,
            body: s.body,
            extractJson: s.extractJson,
          }))
        );
        return true;
      }
      setRows([newRow(), newRow()]);
      message.info("当前 definition 中暂无 HTTP(S) 步骤，已使用空白链模板");
      return true;
    };

    if (!openedRef.current) {
      openedRef.current = true;
      setLastResult(null);
      if (seed?.definitionRaw?.trim()) {
        applySeeds(environments);
        if (environments.length > 0) appliedEnvMergeRef.current = true;
      } else {
        setRows([newRow(), newRow()]);
      }
    } else if (
      seed?.definitionRaw?.trim() &&
      environments.length > 0 &&
      !appliedEnvMergeRef.current
    ) {
      appliedEnvMergeRef.current = true;
      applySeeds(environments);
    }

    const envId = form.getFieldValue("environmentId");
    if (!envId && environments[0]?.id) {
      form.setFieldValue("environmentId", environments[0].id);
    }
  }, [open, environments, form]);

  const httpEndpoints = endpoints.filter((e) => {
    const p = (e.protocol || "http").toLowerCase();
    return p === "http" || p === "https";
  });

  const applyEndpoint = (rowKey: string, ep: ApiEndpoint) => {
    const base = buildDebugModalDefaults(ep, environments);
    const merged = mergeDebugDraftIntoDefaults(base, ep.debugDraft, environments);
    setRows((prev) =>
      prev.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              endpointId: ep.id,
              method: String(merged.method ?? "GET").toUpperCase(),
              path: String(merged.path ?? "/"),
              headers: String(merged.headers ?? "{}"),
              body: String(merged.body ?? ""),
            }
          : r
      )
    );
  };

  const chainMut = useMutation(apiRegressionApi.debug.requestChain, {
    onSuccess: (r) => {
      setLastResult(r);
      if (r.error && !r.steps?.length) {
        message.error(r.error);
        return;
      }
      if (r.ok) message.success(`链式调试完成，共 ${r.steps.length} 步`);
      else message.warning(r.error || `在第 ${(r.stoppedAt ?? 0) + 1} 步停止（断言失败或请求错误）`);
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "链式调试失败");
    },
  });

  const runChain = async () => {
    try {
      await form.validateFields(["environmentId"]);
    } catch {
      return;
    }
    const envId = form.getFieldValue("environmentId") as string;
    const rvParsed = runVarListToRecord(form.getFieldValue("runVarList") as RunVarFormRow[] | undefined);
    if (!rvParsed.ok) {
      message.error(rvParsed.message);
      return;
    }
    const timeout = Number(form.getFieldValue("chainTimeout")) || 30;

    const steps: {
      method: string;
      path: string;
      headers?: Record<string, string>;
      json?: unknown;
      body?: string;
      extract?: Record<string, string>;
    }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let headersObj: Record<string, string> = {};
      try {
        const ho = JSON.parse((row.headers || "").trim() || "{}");
        if (ho && typeof ho === "object" && !Array.isArray(ho)) {
          headersObj = Object.fromEntries(
            Object.entries(ho as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          );
        } else {
          message.error(`步骤 ${i + 1}：Headers 须为 JSON 对象`);
          return;
        }
      } catch {
        message.error(`步骤 ${i + 1}：Headers JSON 无效`);
        return;
      }

      const { json, body } = parseChainBody(row.body);

      let extract: Record<string, string> | undefined;
      const exRaw = (row.extractJson || "").trim();
      if (exRaw && exRaw !== "{}") {
        try {
          const o = JSON.parse(exRaw) as unknown;
          if (o && typeof o === "object" && !Array.isArray(o)) {
            extract = Object.fromEntries(
              Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, String(v)])
            );
          } else {
            message.error(`步骤 ${i + 1}：提取配置须为 JSON 对象`);
            return;
          }
        } catch {
          message.error(`步骤 ${i + 1}：提取配置 JSON 无效`);
          return;
        }
      }

      steps.push({
        method: (row.method || "GET").toUpperCase(),
        path: row.path || "/",
        headers: Object.keys(headersObj).length ? headersObj : undefined,
        ...(json !== undefined ? { json } : {}),
        ...(body ? { body } : {}),
        ...(extract && Object.keys(extract).length ? { extract } : {}),
      });
    }

    chainMut.mutate({
      environmentId: envId,
      runVariables: rvParsed.record,
      timeout,
      steps,
    });
  };

  return (
    <Modal
      title="链式调试（多接口顺序请求）"
      open={open}
      onCancel={onClose}
      width={960}
      footer={[
        <Button key="c" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="r"
          type="primary"
          icon={<SendOutlined />}
          loading={chainMut.isLoading}
          onClick={runChain}
        >
          按顺序执行
        </Button>,
      ]}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {seedFromCollection ? (
          <>
            已从当前集合 definition 载入 HTTP(S) 步骤（含请求体与 extract）；可在下方增删、拖动改序后再执行。
            <br />
          </>
        ) : null}
        从上到下的顺序依次请求；拖动左侧 <HolderOutlined /> 可调整顺序。某步响应为 JSON 时，可在「提取」中配置{" "}
        <Typography.Text code>{"{ \"变量名\": \"jsonpath\" }"}</Typography.Text>
        （与集合步骤 extract 相同），后续步骤的 Path / Headers / Body 里可用{" "}
        <Typography.Text code>{"{{变量名}}"}</Typography.Text>
        引用。环境变量与下方运行变量会先合并进上下文。
      </Typography.Paragraph>

      <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item name="environmentId" label="环境" rules={[{ required: true, message: "请选择环境" }]}>
          <Select
            placeholder="选择测试环境"
            options={environments.map((e) => ({ value: e.id, label: `${e.name} (${e.baseUrl})` }))}
          />
        </Form.Item>
        <Form.Item name="chainTimeout" label="每步默认超时（秒）">
          <Input type="number" min={1} max={120} />
        </Form.Item>
        <Form.Item label="运行变量（可选）" extra="与接口清单单次调试相同；键可参与各步 {{name}} 替换。">
          <RunVariablesFieldList />
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 8 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setRows((r) => [...r, newRow()])}>
          添加步骤
        </Button>
      </Space>

      <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === i) return;
              setRows((prev) => moveItem(prev, dragIndex, i));
              setDragIndex(null);
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr",
              gap: 8,
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: dragIndex === i ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.15)",
            }}
          >
            <span
              role="button"
              aria-label={`拖动排序步骤 ${i + 1}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              style={{ cursor: "grab", paddingTop: 6, color: "rgba(255,255,255,0.45)" }}
            >
              <HolderOutlined />
            </span>
            <div>
              <Space wrap style={{ marginBottom: 8 }}>
                <Typography.Text strong>步骤 {i + 1}</Typography.Text>
                <Select
                  style={{ minWidth: 220 }}
                  placeholder="从接口清单填充"
                  allowClear
                  value={row.endpointId}
                  options={httpEndpoints.map((e) => ({
                    value: e.id,
                    label: `${e.method} ${e.path}${e.name ? ` · ${e.name}` : ""}`,
                  }))}
                  onChange={(id) => {
                    if (!id) {
                      setRows((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, endpointId: undefined } : r))
                      );
                      return;
                    }
                    const ep = httpEndpoints.find((e) => e.id === id);
                    if (ep) applyEndpoint(row.key, ep);
                  }}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  删除
                </Button>
              </Space>
              <Space wrap style={{ width: "100%" }} size={8}>
                <Input
                  style={{ width: 100 }}
                  value={row.method}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, method: e.target.value } : r))
                    )
                  }
                  placeholder="GET"
                />
                <Input
                  style={{ flex: 1, minWidth: 200 }}
                  value={row.path}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, path: e.target.value } : r))
                    )
                  }
                  placeholder="/api/..."
                />
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6 }}>
                Headers（JSON）
              </Typography.Text>
              <TextArea
                rows={2}
                value={row.headers}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, headers: e.target.value } : r))
                  )
                }
                style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 6 }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                Body（JSON 对象/数组走 application/json；否则原文本）
              </Typography.Text>
              <TextArea
                rows={3}
                value={row.body}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, body: e.target.value } : r))
                  )
                }
                style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 6 }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                提取 {"{ \"token\": \"$.data.token\" }"}（本步成功后写入上下文）
              </Typography.Text>
              <TextArea
                rows={2}
                value={row.extractJson}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, extractJson: e.target.value } : r))
                  )
                }
                style={{ fontFamily: "monospace", fontSize: 12 }}
                placeholder="{}"
              />
            </div>
          </div>
        ))}
      </div>

      {lastResult && lastResult.steps.length > 0 ? (
        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Typography.Text strong>执行结果</Typography.Text>
            <Tag color={lastResult.ok ? "success" : "error"}>{lastResult.ok ? "全部完成" : "已中断"}</Tag>
            {lastResult.ctxKeys.length ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                上下文键：{lastResult.ctxKeys.join(", ")}
              </Typography.Text>
            ) : null}
          </Space>
          {(lastResult.initialCtxKeys ?? []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                初始环境变量（共 {lastResult.initialCtxKeys!.length} 个）：
              </Typography.Text>
              <Space wrap size={[4, 2]} style={{ marginLeft: 4 }}>
                {lastResult.initialCtxKeys!.map((k) => (
                  <Tag key={k} style={{ fontSize: 11, margin: 0 }}>{k}</Tag>
                ))}
              </Space>
            </div>
          )}
          <Collapse
            size="small"
            items={lastResult.steps.map((st, idx) => ({
              key: String(idx),
              label: (
                <Space>
                  <span>步骤 {idx + 1}</span>
                  <Tag color={st.error ? "red" : st.assertionsPassed === false ? "orange" : "blue"}>
                    HTTP {st.statusCode ?? "—"} · {st.durationMs}ms
                  </Tag>
                  {Object.keys(st.extracted || {}).length ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      提取 {Object.keys(st.extracted).join(", ")}
                    </Typography.Text>
                  ) : null}
                </Space>
              ),
              children: (
                <div style={{ fontSize: 12 }}>
                  {st.error ? <Typography.Text type="danger">{st.error}</Typography.Text> : null}
                  <div style={{ marginTop: 6, marginBottom: 4 }}>
                    <Typography.Text type="secondary">请求 </Typography.Text>
                    <Typography.Text code copyable>
                      {st.requestMethod} {st.requestUrl}
                    </Typography.Text>
                  </div>
                  {st.requestHeadersMasked?.trim() ? (
                    <Collapse
                      bordered={false}
                      size="small"
                      style={{ background: "transparent", marginBottom: 4 }}
                      items={[{
                        key: "h",
                        label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求头</Typography.Text>,
                        children: (
                          <pre style={{ margin: 0, maxHeight: 120, overflow: "auto", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {st.requestHeadersMasked}
                          </pre>
                        ),
                      }]}
                    />
                  ) : null}
                  {st.requestBodyMasked?.trim() ? (
                    <Collapse
                      bordered={false}
                      size="small"
                      defaultActiveKey={["b"]}
                      style={{ background: "transparent", marginBottom: 4 }}
                      items={[{
                        key: "b",
                        label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>请求体</Typography.Text>,
                        children: (
                          <pre style={{ margin: 0, maxHeight: 160, overflow: "auto", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {st.requestBodyMasked}
                          </pre>
                        ),
                      }]}
                    />
                  ) : null}
                  {st.assertionResults?.length ? (
                    <div style={{ marginBottom: 4 }}>
                      {st.assertionResults.map((ar, ai) => (
                        <Tag key={ai} color={ar.passed ? "green" : "red"} style={{ marginBottom: 4 }}>
                          {ar.type}: {ar.passed ? "通过" : ar.message || "失败"}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                  {Object.keys(st.extracted || {}).length ? (
                    <div style={{ marginBottom: 4 }}>
                      {Object.entries(st.extracted).map(([k, v]) => (
                        <Tag key={k} color="processing" style={{ marginBottom: 2 }}>
                          {k} = {String(v).length > 60 ? String(v).slice(0, 60) + "…" : String(v)}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                  <Typography.Text type="secondary">响应体</Typography.Text>
                  <pre
                    style={{
                      marginTop: 4,
                      maxHeight: 200,
                      overflow: "auto",
                      background: "rgba(0,0,0,0.25)",
                      padding: 8,
                      borderRadius: 6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {st.responseBody || "（无响应体）"}
                  </pre>
                </div>
              ),
            }))}
          />
        </div>
      ) : null}
    </Modal>
  );
}
