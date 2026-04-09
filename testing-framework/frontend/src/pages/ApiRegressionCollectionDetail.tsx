import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  SaveOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  BugOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import {
  apiRegressionApi,
  type ApiDebugChainResult,
  type ApiEndpoint,
} from "../api/api-regression";
import { RunVariablesFieldList } from "../components/RunVariablesFieldList";
import { CollectionStepsTable } from "../components/CollectionStepsTable";
import { EndpointDebugModal } from "../components/EndpointDebugModal";
import { getSingleStepDefinition } from "../utils/collectionSteps";
import { getApiEnvironmentsFromCache, patchApiEnvironmentInCache } from "../utils/apiEnvsCache";
import { mergeAutoExtractedVariablesJson, runVarListToRecord, type RunVarFormRow } from "../utils/runVariablesForm";


export default function ApiRegressionCollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [defText, setDefText] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEp, setDebugEp] = useState<ApiEndpoint | null>(null);
  const [selectedEp, setSelectedEp] = useState<string[]>([]);
  const [runForm] = Form.useForm();
  const [debugEnvId, setDebugEnvId] = useState<string | undefined>();
  const [debugResult, setDebugResult] = useState<ApiDebugChainResult | null>(null);

  const savedSnapshot = useRef({ name: "", desc: "", defText: "{}" });
  const isDirty = useCallback(() => {
    const s = savedSnapshot.current;
    return name !== s.name || desc !== s.desc || defText !== s.defText;
  }, [name, desc, defText]);

  const { data: col, isLoading } = useQuery(
    ["api-collection", id],
    () => apiRegressionApi.collections.get(id!),
    {
      enabled: !!id,
      onSuccess: (c) => {
        setName(c.name);
        setDesc(c.description || "");
        setDefText(c.definition || "{}");
        savedSnapshot.current = { name: c.name, desc: c.description || "", defText: c.definition || "{}" };
        if (c.lastDebugResult && !debugResult) {
          try {
            const parsed = JSON.parse(c.lastDebugResult);
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) {
              setDebugResult(parsed);
            }
          } catch { /* ignore */ }
        }
      },
    }
  );

  const { data: envs = [] } = useQuery("api-envs", apiRegressionApi.environments.list);
  const { data: endpoints = [] } = useQuery("api-endpoints", apiRegressionApi.endpoints.list);

  const update = useMutation(
    () =>
      apiRegressionApi.collections.update(id!, {
        name,
        description: desc,
        definition: defText,
      }),
    {
      onSuccess: () => {
        savedSnapshot.current = { name, desc, defText };
        qc.invalidateQueries(["api-collection", id]);
        qc.invalidateQueries("api-collections");
        message.success("已保存");
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "保存失败");
      },
    }
  );

  const generate = useMutation(
    () => apiRegressionApi.collections.generateFromEndpoints(id!, selectedEp),
    {
      onSuccess: (r: { definition: string }) => {
        setDefText(r.definition);
        qc.invalidateQueries(["api-collection", id]);
        message.success("已生成步骤");
        setGenOpen(false);
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "生成失败");
      },
    }
  );

  const run = useMutation(
    (body: {
      environmentId: string;
      regressionMode: string;
      runVariables?: Record<string, string>;
    }) => apiRegressionApi.runs.create({ collectionId: id!, ...body }),
    {
      onSuccess: (r) => {
        message.success("运行完成");
        setRunOpen(false);
        qc.invalidateQueries("api-runs");
        navigate(`/api-tests/runs/${r.id}`);
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "运行失败");
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
        console.log("[detail/syncToEnvMut] success, response=", resp);
        patchApiEnvironmentInCache(qc, vars.environmentId, { autoExtractedVariables: vars.autoExtractedVariables });
        qc.invalidateQueries("api-envs");
        message.destroy("sync-to-env");
        message.success("已写入环境「自动提取的变量」区 ✓（去「环境」页编辑即可看到）");
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        console.error("[detail/syncToEnvMut] error=", e);
        message.destroy("sync-to-env");
        message.error(e.response?.data?.detail ?? "保存到环境失败");
      },
    }
  );

  const autoSaveDefinition = useMutation(
    (definition: string) =>
      apiRegressionApi.collections.update(id!, { definition }),
    {
      onSuccess: (_resp, definition) => {
        savedSnapshot.current = { ...savedSnapshot.current, defText: definition };
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "自动保存失败");
        qc.invalidateQueries(["api-collection", id]);
      },
    }
  );

  const handleDefinitionChange = useCallback(
    (next: string) => {
      setDefText(next);
      autoSaveDefinition.mutate(next);
    },
    [autoSaveDefinition],
  );

  const syncDraftsMut = useMutation(
    () => apiRegressionApi.collections.syncStepsFromDrafts(id!),
    {
      onSuccess: (r) => {
        setDefText(r.definition);
        qc.invalidateQueries(["api-collection", id]);
        if (r.updated > 0) {
          message.success(`已从接口调试配置同步 ${r.updated}/${r.total} 个步骤的请求参数`);
        } else {
          message.info(
            "未更新：请确认步骤已带接口 id（重新「从清单生成」或「添加接口」），且对应接口在清单里保存过调试草稿"
          );
        }
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "同步失败");
      },
    }
  );

  const handleSyncToEnv = (vars: Record<string, string>) => {
    console.log("[detail/handleSyncToEnv] called, debugEnvId=", debugEnvId, "vars=", vars);
    if (!debugEnvId) {
      message.warning("请先选择调试环境");
      return;
    }
    const env = getApiEnvironmentsFromCache(qc, envs).find((e) => e.id === debugEnvId);
    if (!env) {
      message.error("环境不存在，请刷新后重试");
      return;
    }
    console.log("[detail/handleSyncToEnv] env.autoExtractedVariables=", env.autoExtractedVariables);
    const merged = mergeAutoExtractedVariablesJson(env.autoExtractedVariables, vars);
    console.log("[detail/handleSyncToEnv] merged=", merged, "→ PUT env", env.name);
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
      definition: defText,
      collectionId: id,
      continueOnFailure: true,
      persistExtractToEnv: true,
    });
  };

  const handleRunSingleStep = useCallback(async (stepJsonIndex: number) => {
    if (!debugEnvId) {
      message.warning("请先选择调试环境");
      throw new Error("no env");
    }
    const miniDef = getSingleStepDefinition(defText, stepJsonIndex);
    if (!miniDef) {
      message.error("无法提取该步骤信息");
      throw new Error("bad step");
    }
    return apiRegressionApi.debug.debugDefinition({
      environmentId: debugEnvId,
      definition: miniDef,
      collectionId: id,
      continueOnFailure: false,
      persistExtractToEnv: false,
    });
  }, [debugEnvId, defText, id]);

  /**
   * 集合内「从清单生成步骤」「添加接口到集合」共用的下拉选项。
   * - 列表主文案：优先显示接口名称（接口清单里维护的 name）；无名称时退回「METHOD path」，避免空白项。
   * - 鼠标悬停：用原生 title 展示「METHOD path」，路径一目了然且不占用列表宽度。
   * - 搜索：可按名称、Path、Method 过滤（与主文案是否含 path 无关）。
   */
  const epOptions = useMemo(
    () =>
      endpoints.map((e) => {
        const methodPath = `${e.method} ${e.path}`;
        const displayName = (e.name || "").trim() || methodPath;
        return {
          value: e.id,
          label: (
            <span title={methodPath}>{displayName}</span>
          ),
        };
      }),
    [endpoints]
  );

  /** 与 epOptions 配套：多选下拉按接口名称 / 路径 / 方法过滤 */
  const filterEndpointSelectOption = useCallback(
    (input: string, option: { value?: string } | undefined) => {
      const id = option?.value;
      if (!id) return false;
      const ep = endpoints.find((x) => x.id === id);
      if (!ep) return false;
      const q = input.trim().toLowerCase();
      if (!q) return true;
      const name = (ep.name || "").toLowerCase();
      const path = (ep.path || "").toLowerCase();
      const method = (ep.method || "").toLowerCase();
      return name.includes(q) || path.includes(q) || method.includes(q);
    },
    [endpoints]
  );

  const dirty = isDirty();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!id) return null;
  if (isLoading && !col) return <Typography.Paragraph>加载中…</Typography.Paragraph>;

  return (
    <div>
      {dirty ? (
        <div style={{ marginBottom: 10, padding: "6px 12px", background: "rgba(250,173,20,0.12)", border: "1px solid rgba(250,173,20,0.3)", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <ExclamationCircleOutlined style={{ color: "#faad14" }} />
          <Typography.Text style={{ fontSize: 12 }}>有未保存的修改，请记得点击「保存」。</Typography.Text>
        </div>
      ) : null}
      <Typography.Title level={4} className="page-title">
        集合：{name || id}
      </Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => update.mutate()}
          loading={update.isLoading}
          danger={dirty}
        >
          {dirty ? "保存 *" : "保存"}
        </Button>
        <Button icon={<ThunderboltOutlined />} onClick={() => setGenOpen(true)}>
          从接口清单生成
        </Button>
        <Button type="primary" ghost icon={<PlayCircleOutlined />} onClick={() => setRunOpen(true)}>
          运行
        </Button>
      </Space>
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="名称" />
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述" />
        </Space>
      </Card>
      <Card
        title="测试步骤"
        style={{ marginBottom: 16 }}
        extra={
          <Space wrap>
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={syncDraftsMut.isLoading}
              onClick={() => syncDraftsMut.mutate()}
            >
              同步接口调试配置
            </Button>
            <Select
              style={{ minWidth: 200 }}
              size="small"
              placeholder="选择调试环境"
              value={debugEnvId}
              onChange={setDebugEnvId}
              options={envs.map((e) => ({ value: e.id, label: `${e.name} (${e.baseUrl})` }))}
              allowClear
            />
            <Button
              type="primary"
              size="small"
              icon={<BugOutlined />}
              loading={debugDefMut.isLoading}
              onClick={handleDebugRun}
            >
              执行调试
            </Button>
          </Space>
        }
      >
        {debugResult ? (
          <Space wrap style={{ marginBottom: 10 }}>
            <Tag color={debugResult.ok ? "success" : "error"}>
              {debugResult.ok ? "全部通过" : `在第 ${(debugResult.stoppedAt ?? 0) + 1} 步停止`}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共 {debugResult.steps.length} 步已执行
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
            点击行可展开查看断言配置；执行调试后可查看每步的请求/响应详情。
          </Typography.Paragraph>
        )}
        <CollectionStepsTable
          definitionRaw={defText}
          endpoints={endpoints}
          onDefinitionChange={handleDefinitionChange}
          onDebugEndpoint={(ep) => {
            setDebugEp(ep);
            setDebugOpen(true);
          }}
          onRunSingleStep={debugEnvId ? handleRunSingleStep : undefined}
          debugResult={debugResult}
          environmentId={debugEnvId}
          onSyncToEnv={handleSyncToEnv}
          syncLoading={syncToEnvMut.isLoading}
        />
      </Card>

      <Modal
        title="从接口清单生成步骤"
        open={genOpen}
        onCancel={() => setGenOpen(false)}
        onOk={() => {
          if (!selectedEp.length) {
            message.warning("请选择接口");
            return;
          }
          generate.mutate();
        }}
        confirmLoading={generate.isLoading}
      >
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="选择接口（列表显示名称，悬停可看 Path）"
          options={epOptions}
          value={selectedEp}
          onChange={setSelectedEp}
          showSearch
          filterOption={filterEndpointSelectOption}
        />
      </Modal>

      <Modal
        title="运行回归"
        open={runOpen}
        onCancel={() => setRunOpen(false)}
        onOk={() => runForm.submit()}
        confirmLoading={run.isLoading}
        destroyOnClose
      >
        <Form
          form={runForm}
          layout="vertical"
          initialValues={{ regressionMode: "full", runVarList: [] }}
          onFinish={(v) => {
            const rvParsed = runVarListToRecord(v.runVarList as RunVarFormRow[] | undefined);
            if (!rvParsed.ok) {
              message.error(rvParsed.message);
              return;
            }
            run.mutate({
              environmentId: v.environmentId,
              regressionMode: v.regressionMode,
              runVariables: rvParsed.record,
            });
          }}
        >
          <Form.Item name="environmentId" label="环境" rules={[{ required: true }]}>
            <Select
              options={envs.map((e) => ({ label: `${e.name} (${e.baseUrl})`, value: e.id }))}
              placeholder="选择环境"
            />
          </Form.Item>
          <Form.Item name="regressionMode" label="回归模式" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "全量", value: "full" },
                { label: "精简（P1 或 includeInSubset）", value: "subset" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="本次运行变量（可选）"
            extra="键值列表，与集合步骤中的 {{name}} 及环境 variables 合并；空行或仅未填变量名的行会被忽略。"
          >
            <RunVariablesFieldList />
          </Form.Item>
        </Form>
      </Modal>

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
