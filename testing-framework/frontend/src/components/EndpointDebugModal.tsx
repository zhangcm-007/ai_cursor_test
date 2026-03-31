import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  Alert,
  Button,
  Collapse,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BugOutlined,
  CopyOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import {
  apiRegressionApi,
  type ApiDebugResult,
  type ApiEndpoint,
  type ApiEnvironment,
} from "../api/api-regression";
import { DebugAssertionsFieldList } from "./DebugAssertionsFieldList";
import { RunVariablesFieldList } from "./RunVariablesFieldList";
import { StepExtractToEnvForm } from "./CollectionStepsTable";
import { InteractiveJsonViewer } from "./InteractiveJsonViewer";
import {
  appendAssertionToDebugForm,
  serializeAssertListForApi,
  type DebugAssertFormRow,
} from "../utils/debugAssertions";
import { mergeVariablesJsonWithRecord, runVarListToRecord, type RunVarFormRow } from "../utils/runVariablesForm";
import {
  buildDebugModalDefaults,
  debugFormValuesToDraftJson,
  hasSavedDebugDraft,
  mergeDebugDraftIntoDefaults,
  type ExtractToEnvRule,
} from "../utils/debugDraft";
import { resolveJsonPath } from "../utils/jsonPathAssert";

const { TextArea } = Input;

function parseDebugBody(text: string): { json?: unknown; body?: string } {
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

function formatDebugResponseBody(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return raw;
  }
}

function ExtractToEnvRulesEditor({
  value = [],
  onChange,
}: {
  value?: ExtractToEnvRule[];
  onChange?: (v: ExtractToEnvRule[]) => void;
}) {
  const rules = value;
  const add = () => onChange?.([...rules, { varName: "", path: "" }]);
  const remove = (idx: number) => onChange?.(rules.filter((_, i) => i !== idx));
  const update = (idx: number, field: "varName" | "path", val: string) =>
    onChange?.(rules.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  return (
    <div>
      {rules.map((rule, idx) => (
        <Space key={idx} style={{ display: "flex", marginBottom: 6 }} size={6}>
          <Input
            size="small"
            placeholder="变量名，如 code"
            value={rule.varName}
            onChange={(e) => update(idx, "varName", e.target.value)}
            style={{ width: 130 }}
          />
          <Input
            size="small"
            placeholder="JSONPath，如 $.data.code"
            value={rule.path}
            onChange={(e) => update(idx, "path", e.target.value)}
            style={{ width: 220 }}
          />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(idx)} />
        </Space>
      ))}
      <Button type="dashed" size="small" onClick={add} style={{ width: "100%" }}>
        + 添加提取规则
      </Button>
    </div>
  );
}

export type EndpointDebugModalProps = {
  open: boolean;
  endpoint: ApiEndpoint | null;
  onClose: () => void;
};

export function EndpointDebugModal({ open, endpoint, onClose }: EndpointDebugModalProps) {
  const [localEp, setLocalEp] = useState<ApiEndpoint | null>(null);
  const [debugResult, setDebugResult] = useState<ApiDebugResult | null>(null);
  const [debugForm] = Form.useForm();
  const [syncToEnvTarget, setSyncToEnvTarget] = useState<number | "all" | null>(null);
  const [formInited, setFormInited] = useState(false);
  const qc = useQueryClient();
  const { data: environments = [] } = useQuery("api-envs", apiRegressionApi.environments.list);

  useEffect(() => {
    if (!open) {
      setLocalEp(null);
      setDebugResult(null);
      setFormInited(false);
      return;
    }
    if (endpoint) setLocalEp(endpoint);
  }, [open, endpoint]);

  const saveDebugDraftMut = useMutation(
    ({ id, debugDraft }: { id: string; debugDraft: string }) =>
      apiRegressionApi.endpoints.update(id, { debugDraft }),
    {
      onSuccess: (_, vars) => {
        qc.invalidateQueries("api-endpoints");
        message.success("调试内容已保存，下次打开将自动恢复");
        setLocalEp((prev) => (prev && prev.id === vars.id ? { ...prev, debugDraft: vars.debugDraft } : prev));
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "保存调试失败");
      },
    }
  );

  const syncRunVarsToEnvironment = useMutation(
    ({ environmentId, variables }: { environmentId: string; variables: string }) =>
      apiRegressionApi.environments.update(environmentId, { variables }),
    {
      onSuccess: () => {
        qc.invalidateQueries("api-environments");
        qc.invalidateQueries("api-envs");
      },
      onSettled: () => setSyncToEnvTarget(null),
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "同步到环境失败");
      },
    }
  );

  const autoExtractAndSave = (responseBody: string | undefined) => {
    const rules = (debugForm.getFieldValue("extractToEnv") as ExtractToEnvRule[] | undefined) ?? [];
    if (!rules.length || !responseBody?.trim()) return;
    let body: unknown;
    try { body = JSON.parse(responseBody); } catch { return; }
    const vars: Record<string, string> = {};
    for (const rule of rules) {
      if (!rule.varName || !rule.path) continue;
      const r = resolveJsonPath(body, rule.path);
      if (r.ok) {
        vars[rule.varName] = typeof r.value === "object" ? JSON.stringify(r.value) : String(r.value ?? "");
      }
    }
    if (!Object.keys(vars).length) return;
    const envId = debugForm.getFieldValue("environmentId") as string | undefined;
    const freshEnvs = (qc.getQueryData("api-envs") as ApiEnvironment[] | undefined) ?? environments;
    const env = envId ? freshEnvs.find((e) => e.id === envId) : undefined;
    if (!env) return;
    const merged = mergeVariablesJsonWithRecord(env.variables, vars);
    syncRunVarsToEnvironment.mutate(
      { environmentId: env.id, variables: merged },
      {
        onSuccess: () => {
          qc.invalidateQueries("api-envs");
          message.success(`自动提取 ${Object.keys(vars).join(", ")} 已更新到环境「${env.name}」`);
        },
      }
    );
  };

  const debugReq = useMutation(apiRegressionApi.debug.request, {
    onSuccess: (r) => {
      setDebugResult(r);
      if (r.error) message.warning("请求异常，见下方详情");
      else if (r.assertionsPassed === false) message.error("断言未通过");
      else if (r.assertionsPassed === true) message.success(`断言通过 · ${r.durationMs} ms`);
      else message.success(`完成 ${r.durationMs} ms`);
      autoExtractAndSave(r.responseBody);
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "调试请求失败");
    },
  });

  useEffect(() => {
    if (!open || !localEp || formInited) return;
    if (!environments.length) return;
    const base = buildDebugModalDefaults(localEp, environments);
    const merged = mergeDebugDraftIntoDefaults(base, localEp.debugDraft, environments);
    debugForm.setFieldsValue(merged);
    setDebugResult(null);
    setFormInited(true);
  }, [open, localEp, environments, debugForm, formInited]);

  const resolveDebugEnvironment = (): { envId: string; env: ApiEnvironment } | null => {
    const envId = debugForm.getFieldValue("environmentId") as string | undefined;
    if (!envId) {
      message.warning("请先选择环境");
      return null;
    }
    const env = environments.find((e) => e.id === envId);
    if (!env) {
      message.error("环境不存在，请刷新后重试");
      return null;
    }
    return { envId, env };
  };

  const handleSyncOneRunVarToEnvironment = (fieldIndex: number) => {
    const resolved = resolveDebugEnvironment();
    if (!resolved) return;
    const { envId, env } = resolved;
    const list = debugForm.getFieldValue("runVarList") as RunVarFormRow[] | undefined;
    const row = list?.[fieldIndex];
    if (!row) {
      message.warning("未找到该行");
      return;
    }
    const k = (row.varName ?? "").trim();
    if (!k) {
      message.warning("请先填写变量名");
      return;
    }
    if (!/^\w+$/.test(k)) {
      message.error("变量名仅支持字母数字下划线");
      return;
    }
    const patch = { [k]: String(row.varValue ?? "") };
    const merged = mergeVariablesJsonWithRecord(env.variables, patch);
    setSyncToEnvTarget(fieldIndex);
    syncRunVarsToEnvironment.mutate(
      { environmentId: envId, variables: merged },
      {
        onSuccess: () => {
          message.success(`已将变量「${k}」合并到环境「${env.name}」（同名键已覆盖）`);
        },
      }
    );
  };

  const handleSyncRunVarsToEnvironment = () => {
    const resolved = resolveDebugEnvironment();
    if (!resolved) return;
    const { envId, env } = resolved;
    const rows = debugForm.getFieldValue("runVarList") as RunVarFormRow[] | undefined;
    const parsed = runVarListToRecord(rows);
    if (!parsed.ok) {
      message.error(parsed.message);
      return;
    }
    if (!parsed.record || Object.keys(parsed.record).length === 0) {
      message.warning("请先在「运行变量」中填写至少一条有效的变量名与值");
      return;
    }
    const merged = mergeVariablesJsonWithRecord(env.variables, parsed.record);
    const n = Object.keys(parsed.record).length;
    setSyncToEnvTarget("all");
    syncRunVarsToEnvironment.mutate(
      { environmentId: envId, variables: merged },
      {
        onSuccess: () => {
          message.success(`已将全部 ${n} 个运行变量合并到环境「${env.name}」（同名键已覆盖）`);
        },
      }
    );
  };

  const handleImportEnvVars = () => {
    const resolved = resolveDebugEnvironment();
    if (!resolved) return;
    const { env } = resolved;
    let envVars: Record<string, unknown> = {};
    try {
      const o = JSON.parse((env.variables ?? "").trim() || "{}") as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) envVars = o as Record<string, unknown>;
    } catch { /* empty */ }
    const keys = Object.keys(envVars);
    if (!keys.length) {
      message.info(`环境「${env.name}」中没有变量可导入`);
      return;
    }
    const existing = (debugForm.getFieldValue("runVarList") as RunVarFormRow[] | undefined) ?? [];
    const existingNames = new Set(existing.map((r) => (r.varName ?? "").trim()).filter(Boolean));
    const toAdd: RunVarFormRow[] = [];
    for (const k of keys) {
      if (existingNames.has(k)) continue;
      toAdd.push({ varName: k, varValue: String(envVars[k] ?? "") });
    }
    if (!toAdd.length) {
      message.info("环境中的变量已全部存在于运行变量中");
      return;
    }
    debugForm.setFieldsValue({ runVarList: [...existing, ...toAdd] });
    message.success(`已导入 ${toAdd.length} 个环境变量（跳过 ${keys.length - toAdd.length} 个重复项）`);
  };

  const parsedDebugResponseJson = useMemo(() => {
    const t = debugResult?.responseBody?.trim();
    if (!t) return null;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }, [debugResult?.responseBody]);

  const debugResolvedRequestText = useMemo(() => {
    if (!debugResult) return "";
    const h = (debugResult.requestHeadersMasked ?? "").trim() || "（无）";
    const b = (debugResult.requestBodyMasked ?? "").trim() || "（无）";
    return `${debugResult.requestMethod} ${debugResult.requestUrl}\n\n请求头:\n${h}\n\n请求体:\n${b}`;
  }, [debugResult]);

  return (
      <Modal
        title={
          localEp ? (
            <Space align="center" wrap>
              <span>调试 · {localEp.name || localEp.path}</span>
              {hasSavedDebugDraft(localEp.debugDraft) ? (
                <Tag color="processing">已保存调试草稿</Tag>
              ) : null}
              <Popover
                placement="bottomLeft"
                trigger="hover"
                overlayStyle={{ maxWidth: 440 }}
                content={
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <p style={{ marginBottom: 8 }}>
                      使用<strong>所选环境</strong>的 baseUrl 与下方 Path 拼成完整 URL；<code>{"{{var}}"}</code> 优先来自「接口测试 ·
                      环境」里该环境的<strong>环境变量</strong>（多接口共用），并与下方运行变量合并，同名时运行变量优先。断言支持{" "}
                      <code>status</code>、<code>jsonpath_exists</code>、
                      <code>jsonpath_equals</code>、<code>header_contains</code>、<code>body_contains</code> 等，详见{" "}
                      <code>docs/API_REGRESSION.md</code>。
                    </p>
                    <p style={{ margin: 0, color: "#d48806" }}>
                      未点「保存调试」时，修改仅在本次弹窗内有效；保存后写入本接口，下次打开自动加载草稿。
                    </p>
                  </div>
                }
              >
                <InfoCircleOutlined
                  style={{ color: "rgba(255,255,255,0.45)", cursor: "help", fontSize: 16 }}
                  title="使用说明"
                />
              </Popover>
            </Space>
          ) : (
            "调试"
          )
        }
        open={open}
        onCancel={onClose}
        footer={null}
        destroyOnClose
        width={760}
      >
        <Form
          form={debugForm}
          layout="vertical"
          onFinish={(v) => {
            let headers: Record<string, string> = {};
            try {
              const ho = JSON.parse((v.headers as string) || "{}");
              if (ho && typeof ho === "object" && !Array.isArray(ho)) {
                headers = Object.fromEntries(
                  Object.entries(ho as Record<string, unknown>).map(([k, val]) => [k, String(val)])
                );
              }
            } catch {
              message.error("Headers 须为合法 JSON 对象");
              return;
            }
            const { json, body } = parseDebugBody(String(v.body || ""));
            const envId = v.environmentId as string | undefined;
            if (!envId) {
              message.error("请选择环境；若无环境请先到「环境」页创建并填写 baseUrl 与 variables");
              return;
            }
            const rvParsed = runVarListToRecord(v.runVarList as RunVarFormRow[] | undefined);
            if (!rvParsed.ok) {
              message.error(rvParsed.message);
              return;
            }
            const runVariables = rvParsed.record;
            const assertPayload = serializeAssertListForApi(v.assertList as DebugAssertFormRow[] | undefined);
            debugReq.mutate({
              environmentId: envId,
              method: String(v.method || "GET"),
              path: String(v.path || "/"),
              headers: Object.keys(headers).length ? headers : undefined,
              json,
              body,
              runVariables,
              timeout: Number(v.timeout) || 30,
              assert: assertPayload,
            });
          }}
        >
          {environments.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="暂无测试环境"
              description="请先到「接口测试 · 环境」页新建环境：填写 Base URL，并在 variables（JSON）中配置占位符用到的键值。"
            />
          ) : null}
          <Form.Item
            label="环境"
            name="environmentId"
            rules={[{ required: true, message: "请选择环境" }]}
            extra="须选择环境；baseUrl 与 variables 在环境页维护，无需在此单独填域名。"
          >
            <Select
              placeholder="选择测试环境"
              options={environments.map((e) => ({ value: e.id, label: `${e.name} (${e.baseUrl})` }))}
            />
          </Form.Item>
          <Space style={{ width: "100%" }} size={12} wrap>
            <Form.Item name="method" label="Method" rules={[{ required: true }]} style={{ width: 120, marginBottom: 0 }}>
              <Input />
            </Form.Item>
            <Form.Item name="path" label="Path" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <Input placeholder="/api/..." />
            </Form.Item>
            <Form.Item name="timeout" label="超时(s)" style={{ width: 100, marginBottom: 0 }}>
              <Input type="number" min={1} max={120} />
            </Form.Item>
          </Space>
          <Form.Item label="Headers（JSON 对象）" name="headers">
            <TextArea rows={4} style={{ fontFamily: "monospace", fontSize: 12 }} />
          </Form.Item>
          <Form.Item label="Body（JSON 对象/数组走 application/json；否则按原始文本发送）" name="body">
            <TextArea rows={6} style={{ fontFamily: "monospace", fontSize: 12 }} />
          </Form.Item>
          <Form.Item
            label="运行变量（可选）"
            extra={
              <>
                与环境 variables 合并后用于 Path / Header / Body 中的 <code>{"{{name}}"}</code>；值中可直接写内置占位，如{" "}
                <code>{"{{$randEmail|qq.com}}"}</code> 等，见 <code>docs/API_REGRESSION.md</code>。每行可「合并此项」；底部按钮可一次合并<strong>全部</strong>
                有效行到所选环境的「环境变量」（同名键以运行变量为准）。
              </>
            }
          >
            <div>
              <RunVariablesFieldList
                onMergeRowToEnvironment={handleSyncOneRunVarToEnvironment}
                mergeRowLoadingIndex={
                  syncRunVarsToEnvironment.isLoading && typeof syncToEnvTarget === "number" ? syncToEnvTarget : null
                }
              />
              <Space style={{ width: "100%", marginTop: 10 }}>
                <Button
                  style={{ flex: 1 }}
                  icon={<ImportOutlined />}
                  onClick={handleImportEnvVars}
                >
                  从环境导入
                </Button>
                <Button
                  style={{ flex: 1 }}
                  icon={<CloudUploadOutlined />}
                  loading={syncRunVarsToEnvironment.isLoading && syncToEnvTarget === "all"}
                  onClick={handleSyncRunVarsToEnvironment}
                >
                  全部合并到环境
                </Button>
              </Space>
            </div>
          </Form.Item>
          <Form.Item
            label="断言"
            extra="列表形式配置；收到响应后可用「状态码 / 选中文本 / 响应体下方一键 jsonpath 按钮」追加。无有效行时不发断言。"
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 10, fontSize: 12 }}>
              每条断言选类型后填写对应字段；默认可保留「HTTP 状态码 = 200」一条。
            </Typography.Paragraph>
            <DebugAssertionsFieldList />
          </Form.Item>
          <Form.Item
            label="自动提取到环境变量"
            extra={
              <>
                每次调试成功后，自动从响应体提取指定路径的值并保存到所选环境变量。
                也可在下方响应体中点击字段旁的 <span style={{ color: "#52c41a" }}>↑</span> 按钮快速添加。
                点「保存调试」可持久化这些规则。
              </>
            }
          >
            <Form.Item name="extractToEnv" noStyle>
              <ExtractToEnvRulesEditor />
            </Form.Item>
          </Form.Item>
          <Space wrap>
            <Button type="primary" loading={debugReq.isLoading} htmlType="submit" icon={<BugOutlined />}>
              发送请求
            </Button>
            <Button
              icon={<SaveOutlined />}
              loading={saveDebugDraftMut.isLoading}
              disabled={!localEp}
              onClick={() => {
                if (!localEp) return;
                const v = debugForm.getFieldsValue();
                saveDebugDraftMut.mutate({
                  id: localEp.id,
                  debugDraft: debugFormValuesToDraftJson(v),
                });
              }}
            >
              保存调试
            </Button>
          </Space>
        </Form>

        {debugResult && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <Typography.Title level={5}>实际请求</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
              以下为变量替换后真正发出的请求（敏感字段已脱敏）。服务端日志中会打印同内容摘要。
            </Typography.Paragraph>
            <Space wrap style={{ marginBottom: 8 }}>
              <Typography.Text strong>Method</Typography.Text>
              <Typography.Text code>{debugResult.requestMethod}</Typography.Text>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(debugResolvedRequestText);
                    message.success("已复制完整请求文本");
                  } catch {
                    message.error("复制失败");
                  }
                }}
              >
                复制完整请求
              </Button>
            </Space>
            <div style={{ marginBottom: 8 }}>
              <Typography.Text strong>URL </Typography.Text>
              <Typography.Text code copyable>
                {debugResult.requestUrl}
              </Typography.Text>
            </div>
            <Typography.Text strong>请求头</Typography.Text>
            <pre
              style={{
                marginTop: 6,
                marginBottom: 12,
                maxHeight: 200,
                overflow: "auto",
                fontSize: 12,
                background: "rgba(0,0,0,0.25)",
                padding: 8,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {(debugResult.requestHeadersMasked ?? "").trim() || "（无）"}
            </pre>
            <Typography.Text strong>请求体</Typography.Text>
            <pre
              style={{
                marginTop: 6,
                marginBottom: 16,
                maxHeight: 240,
                overflow: "auto",
                fontSize: 12,
                background: "rgba(0,0,0,0.25)",
                padding: 8,
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {(debugResult.requestBodyMasked ?? "").trim() || "（无）"}
            </pre>
            <Typography.Title level={5}>响应</Typography.Title>
            {debugResult.assertionsPassed != null && (
              <div style={{ marginBottom: 12 }}>
                <Tag color={debugResult.assertionsPassed ? "success" : "error"} style={{ marginRight: 8 }}>
                  {debugResult.assertionsPassed ? "断言通过" : "断言未通过"}
                </Tag>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="__k"
                  dataSource={(debugResult.assertionResults || []).map((r, i) => ({ ...r, __k: i }))}
                  columns={[
                    { title: "#", width: 44, render: (_v, r) => (r as { __k: number }).__k + 1 },
                    { title: "类型", dataIndex: "type", width: 140, ellipsis: true },
                    {
                      title: "结果",
                      width: 72,
                      render: (_, row) => (row.passed ? "通过" : "失败"),
                    },
                    { title: "说明", dataIndex: "message", ellipsis: true },
                  ]}
                />
              </div>
            )}
            {debugResult.error ? (
              <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
                {debugResult.error}
              </Typography.Paragraph>
            ) : null}
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <div>
                <Typography.Text strong>状态码 </Typography.Text>
                <Typography.Text>{debugResult.statusCode ?? "—"}</Typography.Text>
                <Typography.Text type="secondary"> · {debugResult.durationMs} ms</Typography.Text>
                {debugResult.responseByteLength != null && (
                  <Typography.Text type="secondary"> · 响应体 {debugResult.responseByteLength} 字节</Typography.Text>
                )}
                <Space wrap size={8} style={{ marginTop: 8, display: "flex" }}>
                  {debugResult.statusCode != null ? (
                    <Button
                      size="small"
                      type="dashed"
                      onClick={() =>
                        appendAssertionToDebugForm(debugForm, { type: "status", equals: debugResult.statusCode })
                      }
                    >
                      + 断言状态码 = {debugResult.statusCode}
                    </Button>
                  ) : null}
                  {debugResult.responseBody?.trim() ? (
                    <Button
                      size="small"
                      type="dashed"
                      onClick={() => {
                        const t = window.getSelection()?.toString().trim();
                        if (!t) {
                          message.warning(
                            parsedDebugResponseJson !== null
                              ? "请展开「原始 JSON」面板，在文本中拖选一段内容"
                              : "请先在下方「响应体」文本中拖选一段内容"
                          );
                          return;
                        }
                        appendAssertionToDebugForm(debugForm, { type: "body_contains", contains: t });
                      }}
                    >
                      选中文本 → body_contains 断言
                    </Button>
                  ) : null}
                </Space>
              </div>
              <Collapse
                bordered={false}
                style={{ background: "transparent" }}
                defaultActiveKey={[]}
                items={[
                  {
                    key: "headers",
                    label: <Typography.Text strong>响应头</Typography.Text>,
                    children: (
                      <pre
                        style={{
                          marginTop: 0,
                          marginBottom: 0,
                          maxHeight: 200,
                          overflow: "auto",
                          fontSize: 12,
                          background: "rgba(0,0,0,0.25)",
                          padding: 8,
                          borderRadius: 6,
                        }}
                      >
                        {JSON.stringify(debugResult.responseHeaders || {}, null, 2)}
                      </pre>
                    ),
                  },
                ]}
              />
              <div>
                <Typography.Text strong>
                  响应体（脱敏展示）
                  {debugResult.responseBodyTruncated ? "（已截断）" : ""}
                </Typography.Text>
                {parsedDebugResponseJson !== null ? (
                  <>
                    <Typography.Text type="secondary" style={{ display: "block", marginTop: 6, marginBottom: 6, fontSize: 12 }}>
                      点字段旁
                      <span style={{ color: "#52c41a" }}> ↑ </span>立即保存到环境变量并建立自动提取规则（下次调试自动更新），
                      <span style={{ color: "#1890ff" }}> + </span>添加到断言。
                    </Typography.Text>
                    <InteractiveJsonViewer
                      data={parsedDebugResponseJson}
                      onAddToEnv={(varName, value, jsonPath) => {
                        const resolved = resolveDebugEnvironment();
                        if (!resolved) return;
                        const { envId, env } = resolved;
                        const merged = mergeVariablesJsonWithRecord(env.variables, { [varName]: value });
                        syncRunVarsToEnvironment.mutate(
                          { environmentId: envId, variables: merged },
                          {
                            onSuccess: () => {
                              qc.invalidateQueries("api-envs");
                              message.success(`已保存 ${varName}=${value.length > 20 ? value.slice(0, 20) + "…" : value} 到环境「${env.name}」，后续调试将自动更新`);
                            },
                          }
                        );
                        const existing = (debugForm.getFieldValue("extractToEnv") as ExtractToEnvRule[] | undefined) ?? [];
                        const dup = existing.findIndex((r) => r.varName === varName);
                        const updated = dup >= 0
                          ? existing.map((r, i) => (i === dup ? { varName, path: jsonPath } : r))
                          : [...existing, { varName, path: jsonPath }];
                        debugForm.setFieldsValue({ extractToEnv: updated });
                        if (localEp) {
                          const draft = debugFormValuesToDraftJson({ ...debugForm.getFieldsValue(), extractToEnv: updated });
                          saveDebugDraftMut.mutate({ id: localEp.id, debugDraft: draft });
                        }
                      }}
                      onAddAssertion={(path, value) => {
                        appendAssertionToDebugForm(debugForm, {
                          type: "jsonpath_equals",
                          path,
                          equals: value as string | number | boolean | null,
                        });
                      }}
                    />
                    <Collapse
                      bordered={false}
                      style={{ background: "transparent", marginTop: 8 }}
                      defaultActiveKey={[]}
                      items={[
                        {
                          key: "rawBody",
                          label: (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              原始 JSON（可拖选文本 → 上方「选中文本 → body_contains」）
                            </Typography.Text>
                          ),
                          children: (
                            <pre
                              id="debug-response-body-pre"
                              style={{
                                marginTop: 0,
                                marginBottom: 0,
                                maxHeight: 280,
                                overflow: "auto",
                                fontSize: 12,
                                background: "rgba(0,0,0,0.25)",
                                padding: 8,
                                borderRadius: 6,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                userSelect: "text",
                              }}
                            >
                              {debugResult.responseBody?.trim()
                                ? formatDebugResponseBody(debugResult.responseBody)
                                : debugResult.responseByteLength != null && debugResult.responseByteLength > 0
                                  ? "（无法以 UTF-8 文本展示，可能为二进制或非文本编码；已记录字节数见上方）"
                                  : "（无响应体）"}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Typography.Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                      可在下框中选中文本，再点上方「选中文本 → body_contains 断言」。
                    </Typography.Text>
                    <pre
                      id="debug-response-body-pre"
                      style={{
                        marginTop: 6,
                        maxHeight: 320,
                        overflow: "auto",
                        fontSize: 12,
                        background: "rgba(0,0,0,0.25)",
                        padding: 8,
                        borderRadius: 6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        userSelect: "text",
                      }}
                    >
                      {debugResult.responseBody?.trim()
                        ? formatDebugResponseBody(debugResult.responseBody)
                        : debugResult.responseByteLength != null && debugResult.responseByteLength > 0
                          ? "（无法以 UTF-8 文本展示，可能为二进制或非文本编码；已记录字节数见上方）"
                          : "（无响应体）"}
                    </pre>
                  </>
                )}
              </div>
            </Space>
            {debugResult.responseBody?.trim() && !parsedDebugResponseJson ? (
              <StepExtractToEnvForm
                responseBody={debugResult.responseBody}
                onSave={(vars) => {
                  const resolved = resolveDebugEnvironment();
                  if (!resolved) return;
                  const { envId, env } = resolved;
                  const merged = mergeVariablesJsonWithRecord(env.variables, vars);
                  syncRunVarsToEnvironment.mutate(
                    { environmentId: envId, variables: merged },
                    {
                      onSuccess: () => {
                        const keys = Object.keys(vars).join(", ");
                        message.success(`变量「${keys}」已保存到环境「${env.name}」`);
                      },
                    }
                  );
                }}
                loading={syncRunVarsToEnvironment.isLoading}
              />
            ) : null}
          </div>
        )}
      </Modal>
  );
}
